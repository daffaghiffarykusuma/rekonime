#!/usr/bin/env python3
"""Python catalog build pipeline for migration parity."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from quality_reporter import build_quality_report, run_quality_gates


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "anime.json"
DEFAULT_FULL_OUTPUT = ROOT / "data" / "anime.full.json"
DEFAULT_PREVIEW_OUTPUT = ROOT / "data" / "anime.preview.json"
DEFAULT_REPORT_OUTPUT = ROOT / "data" / "build-report.json"
DEFAULT_FRANCHISE_MAP = ROOT / "data" / "franchise-map.json"
PREVIEW_LIMIT = 200
PREVIEW_BUCKET = 80
STRICTNESS_EXPONENT = 1.35
DEFAULT_SCORE_PROFILE = {"p35": 3.2, "p50": 3.6, "p65": 4.0}
MAX_EPISODE_ENTRIES = 10000


class BuildError(Exception):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message)
        self.details = details


def js_round(value: float) -> int:
    return int(math.floor(value + 0.5))


def round_to(value: float, digits: int = 2) -> float:
    factor = 10 ** digits
    rounded = math.floor((value * factor) + 0.5) / factor
    return int(rounded) if float(rounded).is_integer() else rounded


def compact_json(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def write_json_atomic(file_path: Path, payload: Any) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = file_path.parent / (".%s.%s.tmp" % (file_path.name, "python"))
    temp_path.write_text(compact_json(payload), encoding="utf-8")
    temp_path.replace(file_path)


def normalize_search_query(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower()
    return re.sub(r"\s+", " ", text).strip()


def build_search_text(*parts: Any) -> str:
    return " ".join(part for part in (normalize_search_query(value) for value in parts) if part)


def sanitize_tag_list(tags: Any) -> List[str]:
    if not isinstance(tags, list):
        return []
    seen = set()
    cleaned = []
    for tag in tags:
        label = str(tag or "").strip()
        normalized = label.lower()
        if not label or normalized in {"undefined", "null"} or normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(label)
    return cleaned


def normalize_episode_count(anime: Dict[str, Any]) -> Optional[int]:
    metadata = anime.get("metadata") or {}
    candidates = [
        anime.get("episodeCount"),
        anime.get("episodesCount"),
        anime.get("episodes_count"),
        metadata.get("episodeCount"),
        metadata.get("episodesCount"),
        metadata.get("episodes_count"),
    ]
    for candidate in candidates:
        try:
            parsed = float(candidate)
        except (TypeError, ValueError):
            continue
        if math.isfinite(parsed) and parsed > 0:
            return math.floor(parsed)
    return None


def load_franchise_resolver(franchise_map_path: Path):
    if not franchise_map_path.exists():
        return lambda anime_id: None
    payload = json.loads(franchise_map_path.read_text(encoding="utf-8"))
    by_anime_id = payload.get("byAnimeId") if isinstance(payload.get("byAnimeId"), dict) else {}
    franchises = payload.get("franchises") if isinstance(payload.get("franchises"), dict) else {}

    def resolve(anime_id: str) -> Optional[Dict[str, Any]]:
        direct = by_anime_id.get(anime_id)
        if isinstance(direct, str):
            return franchises.get(direct)
        if isinstance(direct, dict):
            return direct
        return None

    return resolve


def normalize_anime(anime: Dict[str, Any], resolve_franchise) -> Dict[str, Any]:
    metadata = anime.get("metadata") or {}
    normalized_genres = sanitize_tag_list(metadata.get("genres") or anime.get("genres") or [])
    normalized_themes = sanitize_tag_list(metadata.get("themes") or anime.get("themes") or [])
    normalized_trailer = metadata.get("trailer") or anime.get("trailer")
    normalized_synopsis = metadata.get("synopsis") or anime.get("synopsis") or ""
    candidate_id = str(metadata.get("id") or anime.get("id") or "").strip()
    title_english = metadata.get("title_english") or metadata.get("titleEnglish") or anime.get("title_english") or anime.get("titleEnglish") or ""
    title_japanese = metadata.get("title_japanese") or metadata.get("titleJapanese") or anime.get("title_japanese") or anime.get("titleJapanese") or ""
    normalized_type = metadata.get("type") or anime.get("type") or ""
    raw_community_score = anime.get("communityScore", metadata.get("score", anime.get("score")))
    try:
        community_score = float(raw_community_score)
    except (TypeError, ValueError):
        community_score = None
    episode_count = normalize_episode_count(anime)
    franchise = resolve_franchise(candidate_id) if candidate_id else None

    if metadata:
        resolved_title = metadata.get("title") or anime.get("title")
        normalized = {
            "id": metadata.get("id") or anime.get("id"),
            "title": resolved_title,
            "titleEnglish": title_english,
            "titleJapanese": title_japanese,
            "malId": metadata.get("malId") or anime.get("mal_id") or anime.get("malId"),
            "anilistId": metadata.get("anilistId") or anime.get("anilistId"),
            "cover": metadata.get("cover") or anime.get("cover"),
            "type": normalized_type,
            "year": metadata.get("year") or anime.get("year"),
            "season": metadata.get("season") or anime.get("season"),
            "studio": metadata.get("studio") or anime.get("studio"),
            "source": metadata.get("source") or anime.get("source"),
            "genres": normalized_genres,
            "themes": normalized_themes,
            "demographic": metadata.get("demographic") or anime.get("demographic"),
            "trailer": normalized_trailer,
            "synopsis": normalized_synopsis,
            "communityScore": community_score,
            "searchText": anime.get("searchText") or build_search_text(resolved_title, title_english, title_japanese),
            "episodes": anime.get("episodes") if isinstance(anime.get("episodes"), list) else [],
        }
    else:
        resolved_title = anime.get("title")
        normalized = {
            "id": anime.get("id"),
            "title": resolved_title,
            "titleEnglish": title_english,
            "titleJapanese": title_japanese,
            "malId": anime.get("malId"),
            "anilistId": anime.get("anilistId"),
            "cover": anime.get("cover"),
            "type": normalized_type,
            "year": anime.get("year"),
            "season": anime.get("season"),
            "studio": anime.get("studio"),
            "source": anime.get("source"),
            "genres": normalized_genres,
            "themes": normalized_themes,
            "demographic": anime.get("demographic"),
            "trailer": normalized_trailer,
            "synopsis": normalized_synopsis,
            "communityScore": community_score,
            "searchText": anime.get("searchText") or build_search_text(resolved_title, title_english, title_japanese),
            "episodes": anime.get("episodes") if isinstance(anime.get("episodes"), list) else [],
        }
    if episode_count:
        normalized["episodeCount"] = episode_count
    if franchise:
        normalized["franchise"] = franchise
    return {key: value for key, value in normalized.items() if value is not None}


def resolve_unique_anime_ids(anime_list: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    seen: Dict[str, int] = {}
    collisions = []

    def next_unique_id(base_id: str, anime: Dict[str, Any], index: int) -> str:
        for key in ("malId", "year"):
            try:
                parsed = int(anime.get(key))
            except (TypeError, ValueError):
                parsed = 0
            if parsed > 0:
                candidate = "%s-%s" % (base_id, parsed)
                if candidate not in seen:
                    return candidate
        counter = max(2, seen.get(base_id, 1) + 1)
        candidate = "%s-dup-%s" % (base_id, counter)
        while candidate in seen:
            counter += 1
            candidate = "%s-dup-%s" % (base_id, counter)
        return candidate

    items = []
    for index, anime in enumerate(anime_list):
        base_id = str(anime.get("id") or "").strip() or "anime-%s" % (index + 1)
        if base_id not in seen:
            seen[base_id] = 1
            items.append({**anime, "id": base_id})
            continue
        unique_id = next_unique_id(base_id, anime, index)
        seen[base_id] = seen.get(base_id, 1) + 1
        seen[unique_id] = 1
        collisions.append({
            "previousId": base_id,
            "nextId": unique_id,
            "animeId": anime.get("id") or base_id,
            "title": anime.get("title") or "index-%s" % index,
        })
        items.append({**anime, "id": unique_id})
    return items, collisions


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def normalize_score(score: float) -> float:
    return clamp((score - 1) / 4, 0, 1)


def apply_strictness(value: float, minimum: float = 0, maximum: float = 100, lower_is_better: bool = False) -> float:
    if not math.isfinite(value):
        return minimum
    value_range = maximum - minimum or 1
    clamped = clamp(value, minimum, maximum)
    ratio = (clamped - minimum) / value_range
    if lower_is_better:
        ratio = 1 - ratio
    adjusted = math.pow(ratio, STRICTNESS_EXPONENT)
    strict_ratio = 1 - adjusted if lower_is_better else adjusted
    return minimum + (strict_ratio * value_range)


def apply_centered_strictness(value: float, minimum: float = 0, maximum: float = 100, center: float = 50) -> float:
    if not math.isfinite(value):
        return center
    clamped = clamp(value, minimum, maximum)
    span = max(center - minimum, maximum - center) or 1
    normalized = clamp((clamped - center) / span, -1, 1)
    adjusted = math.copysign(math.pow(abs(normalized), STRICTNESS_EXPONENT), normalized) if normalized else 0
    return clamp(center + (adjusted * span), minimum, maximum)


def strict_percent(value: float, lower_is_better: bool = False) -> int:
    return js_round(apply_strictness(value, lower_is_better=lower_is_better))


def score_to_strict_percent(score: float) -> int:
    return strict_percent(normalize_score(score) * 100)


def calculate_percentile(values: List[float], percentile: float) -> float:
    if not values:
        return 0
    sorted_values = sorted(values)
    rank = (percentile / 100) * (len(sorted_values) - 1)
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return sorted_values[lower]
    weight = rank - lower
    return sorted_values[lower] + ((sorted_values[upper] - sorted_values[lower]) * weight)


def resolve_score_profile(profile: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not profile:
        return dict(DEFAULT_SCORE_PROFILE)
    try:
        ordered = sorted([
            clamp(float(profile["p35"]), 1, 5),
            clamp(float(profile["p50"]), 1, 5),
            clamp(float(profile["p65"]), 1, 5),
        ])
    except (KeyError, TypeError, ValueError):
        return dict(DEFAULT_SCORE_PROFILE)
    normalized: Dict[str, Any] = {"p35": ordered[0], "p50": ordered[1], "p65": ordered[2]}
    if isinstance(profile.get("sampleSize"), (int, float)):
        normalized["sampleSize"] = profile.get("sampleSize")
    if isinstance(profile.get("source"), str):
        normalized["source"] = profile.get("source")
    return normalized


def build_score_profile_from_scores(scores: Iterable[Any]) -> Dict[str, Any]:
    values = []
    for score in scores:
        try:
            parsed = float(score)
        except (TypeError, ValueError):
            continue
        if math.isfinite(parsed):
            values.append(parsed)
    if len(values) < 5:
        return {**DEFAULT_SCORE_PROFILE, "sampleSize": len(values), "source": "default"}
    return resolve_score_profile({
        "p35": round_to(clamp(calculate_percentile(values, 35), 1, 5), 2),
        "p50": round_to(clamp(calculate_percentile(values, 50), 1, 5), 2),
        "p65": round_to(clamp(calculate_percentile(values, 65), 1, 5), 2),
        "sampleSize": len(values),
        "source": "derived",
    })


def build_score_profile(anime_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    scores = []
    for anime in anime_list if isinstance(anime_list, list) else []:
        for episode in anime.get("episodes") or []:
            if isinstance(episode, dict):
                scores.append(episode.get("score"))
    return build_score_profile_from_scores(scores)


def normalize_episodes(episodes: Any, strict: bool = False, max_episode_entries: int = MAX_EPISODE_ENTRIES) -> List[Dict[str, Any]]:
    if not isinstance(episodes, list):
        if strict:
            raise BuildError("Episodes must be an array")
        return []
    source_episodes = episodes[:max_episode_entries]
    cleaned = []
    for index, episode in enumerate(source_episodes):
        if not isinstance(episode, dict):
            if strict:
                raise BuildError("Episode entry is invalid", {"index": index})
            continue
        try:
            score = float(episode.get("score"))
        except (TypeError, ValueError):
            score = float("nan")
        if not math.isfinite(score) or score < 1 or score > 5:
            if strict:
                raise BuildError("Episode score out of range", {"index": index, "score": episode.get("score")})
            continue
        try:
            episode_number = float(episode.get("episode"))
        except (TypeError, ValueError):
            episode_number = index + 1
        if not math.isfinite(episode_number):
            normalized_episode = index + 1
        elif float(episode_number).is_integer():
            normalized_episode = int(episode_number)
        else:
            normalized_episode = episode_number
        cleaned.append({**episode, "episode": normalized_episode, "score": score})
    if strict and len(episodes) > max_episode_entries:
        raise BuildError("Episode count exceeds supported limit", {"total": len(episodes), "maxEpisodeEntries": max_episode_entries})
    if strict and source_episodes and not cleaned:
        raise BuildError("No valid episodes available", {"total": len(source_episodes)})
    return cleaned


def calculate_average(episodes: List[Dict[str, Any]]) -> float:
    if not episodes:
        return 0
    return round_to(sum(ep["score"] for ep in episodes) / len(episodes), 2)


def get_episode_score_range(episodes: List[Dict[str, Any]]) -> Dict[str, float]:
    scores = [float(ep.get("score")) for ep in episodes if isinstance(ep.get("score"), (int, float))]
    return {"min": min(scores), "max": max(scores)} if scores else {"min": 0, "max": 0}


def calculate_std_dev(episodes: List[Dict[str, Any]]) -> float:
    if not episodes:
        return 0
    avg = calculate_average(episodes)
    return round_to(math.sqrt(sum(math.pow(ep["score"] - avg, 2) for ep in episodes) / len(episodes)), 2)


def calculate_auc(episodes: List[Dict[str, Any]]) -> int:
    if not episodes:
        return 0
    return score_to_strict_percent(sum(ep["score"] for ep in episodes) / len(episodes))


def get_consistency_rating(std_dev: float) -> Dict[str, str]:
    if std_dev < 0.5:
        return {"label": "Very Consistent", "class": "consistency-high"}
    if std_dev < 1.0:
        return {"label": "Consistent", "class": "consistency-medium"}
    return {"label": "Variable", "class": "consistency-low"}


def get_score_color_class(avg: float) -> str:
    if avg >= 4.5:
        return "score-excellent"
    if avg >= 3.5:
        return "score-good"
    if avg >= 2.5:
        return "score-average"
    return "score-poor"


def calculate_median(episodes: List[Dict[str, Any]]) -> float:
    if not episodes:
        return 0
    scores = sorted(ep["score"] for ep in episodes)
    mid = len(scores) // 2
    return scores[mid] if len(scores) % 2 else (scores[mid - 1] + scores[mid]) / 2


def calculate_3_episode_hook(episodes: List[Dict[str, Any]]) -> int:
    if not episodes:
        return 0
    hook = episodes[: min(3, len(episodes))]
    return score_to_strict_percent(sum(ep["score"] for ep in hook) / len(hook))


def get_early_penalty_scale(episodes: List[Dict[str, Any]], cap_length: int = 6) -> float:
    length = len(episodes) if isinstance(episodes, list) else 0
    if not length or length <= cap_length:
        return 1
    return clamp(cap_length / length, 0, 1)


def calculate_habit_break_risk(episodes: List[Dict[str, Any]]) -> float:
    if len(episodes) < 2:
        return 0
    median = calculate_median(episodes)
    current = 0
    max_chain = 0
    for ep in episodes:
        if ep["score"] < median:
            current += 1
            max_chain = max(max_chain, current)
        else:
            current = 0
    return round_to((max_chain / len(episodes)) * 10, 1)


def calculate_peak_score(episodes: List[Dict[str, Any]]) -> float:
    return get_episode_score_range(episodes)["max"] if episodes else 0


def calculate_finale_strength(episodes: List[Dict[str, Any]]) -> int:
    if len(episodes) < 4:
        if len(episodes) < 2:
            return 50
        difference = episodes[-1]["score"] - calculate_average(episodes[:-1])
        raw = clamp(50 + (difference * 25), 0, 100)
        return js_round(apply_centered_strictness(raw))
    quarter_length = math.ceil(len(episodes) / 4)
    final_avg = calculate_average(episodes[-quarter_length:])
    early_avg = calculate_average(episodes[:-quarter_length])
    raw = clamp(50 + ((final_avg - early_avg) * 25), 0, 100)
    return js_round(apply_centered_strictness(raw))


def calculate_momentum(episodes: List[Dict[str, Any]]) -> int:
    if len(episodes) < 4:
        return 0
    last3_avg = sum(ep["score"] for ep in episodes[-3:]) / 3
    return js_round(clamp((last3_avg - calculate_average(episodes)) * 50, -100, 100))


def calculate_narrative_acceleration(episodes: List[Dict[str, Any]]) -> float:
    if len(episodes) < 6:
        return 0
    second_half = episodes[len(episodes) // 2:]
    n = len(second_half)
    sum_x = sum(range(n))
    sum_y = sum(ep["score"] for ep in second_half)
    sum_xy = sum(i * ep["score"] for i, ep in enumerate(second_half))
    sum_x2 = sum(i * i for i in range(n))
    denominator = (n * sum_x2) - (sum_x * sum_x)
    return round_to(((n * sum_xy) - (sum_x * sum_y)) / denominator, 2) if denominator else 0


def calculate_worth_finishing(episodes: List[Dict[str, Any]]) -> int:
    if not episodes:
        return 0
    finale = calculate_finale_strength(episodes)
    momentum_score = clamp((calculate_momentum(episodes) + 100) / 2, 0, 100)
    accel_score = ((clamp(calculate_narrative_acceleration(episodes), -0.2, 0.2) + 0.2) / 0.4) * 100
    return strict_percent(clamp((finale * 0.5) + (momentum_score * 0.3) + (accel_score * 0.2), 0, 100))


def count_peak_episodes(episodes: List[Dict[str, Any]]) -> int:
    return len([ep for ep in episodes if ep["score"] == 5])


def count_stress_spikes(episodes: List[Dict[str, Any]]) -> float:
    if len(episodes) < 2:
        return 0
    spikes = sum(1 for i in range(1, len(episodes)) if episodes[i - 1]["score"] - episodes[i]["score"] >= 1.5)
    return round_to((spikes / len(episodes)) * 10, 1)


def calculate_emotional_stability(episodes: List[Dict[str, Any]]) -> int:
    if len(episodes) < 2:
        return 100
    avg_change = sum(abs(episodes[i]["score"] - episodes[i - 1]["score"]) for i in range(1, len(episodes))) / (len(episodes) - 1)
    return strict_percent((1 - (avg_change / 4)) * 100)


def calculate_barrier_to_entry(episodes: List[Dict[str, Any]]) -> float:
    if not episodes:
        return 0
    first5 = episodes[: min(5, len(episodes))]
    avg = sum(ep["score"] for ep in first5) / len(first5)
    variance = sum(math.pow(ep["score"] - avg, 2) for ep in first5) / len(first5)
    return round_to(math.sqrt(variance), 2)


def calculate_flow_state(episodes: List[Dict[str, Any]]) -> int:
    if len(episodes) < 2:
        return 100
    total = sum(math.pow(episodes[i]["score"] - episodes[i - 1]["score"], 2) for i in range(1, len(episodes)))
    return strict_percent((1 - (total / (16 * (len(episodes) - 1)))) * 100)


def calculate_comfort_score(episodes: List[Dict[str, Any]]) -> int:
    if not episodes:
        return 0
    flow = calculate_flow_state(episodes)
    stability = calculate_emotional_stability(episodes)
    barrier_score = 100 - clamp((min(calculate_barrier_to_entry(episodes), 2) / 2) * 100, 0, 100)
    stress_score = 100 - clamp((min(count_stress_spikes(episodes), 5) / 5) * 100, 0, 100)
    return strict_percent(clamp((flow * 0.4) + (stability * 0.3) + (barrier_score * 0.2) + (stress_score * 0.1), 0, 100))


def calculate_quality_trend(episodes: List[Dict[str, Any]]) -> Dict[str, Any]:
    if len(episodes) < 3:
        return {"slope": 0, "direction": "stable"}
    n = len(episodes)
    sum_x = sum(range(n))
    sum_y = sum(ep["score"] for ep in episodes)
    sum_xy = sum(i * ep["score"] for i, ep in enumerate(episodes))
    sum_x2 = sum(i * i for i in range(n))
    denominator = (n * sum_x2) - (sum_x * sum_x)
    slope = ((n * sum_xy) - (sum_x * sum_y)) / denominator if denominator else 0
    rounded = round_to(slope, 2)
    direction = "stable"
    if rounded > 0.05:
        direction = "improving"
    elif rounded < -0.05:
        direction = "declining"
    return {"slope": rounded, "direction": direction}


def detect_quality_dips(episodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if len(episodes) < 3:
        return []
    avg = calculate_average(episodes)
    threshold = avg - 0.8
    return [
        {"episode": ep["episode"], "score": ep["score"], "deviation": round_to(avg - ep["score"], 2)}
        for ep in episodes
        if ep["score"] < threshold
    ]


def calculate_rolling_average(episodes: List[Dict[str, Any]], window_size: int = 3) -> List[Dict[str, Any]]:
    if len(episodes) < window_size:
        return []
    rolling = []
    for index in range(window_size - 1, len(episodes)):
        window = episodes[index - window_size + 1:index + 1]
        rolling.append({"episode": episodes[index]["episode"], "rollingAvg": round_to(sum(ep["score"] for ep in window) / window_size, 2)})
    return rolling


def calculate_controversy_potential(episodes: List[Dict[str, Any]]) -> int:
    if len(episodes) < 3:
        return 0
    score_range = get_episode_score_range(episodes)
    controversy = ((score_range["max"] - score_range["min"]) / 4) * 50
    has_low = any(ep["score"] <= 1.5 for ep in episodes)
    has_high = any(ep["score"] >= 4.5 for ep in episodes)
    if has_low and has_high:
        controversy += 50
    elif has_low or has_high:
        controversy += 25
    return strict_percent(min(100, controversy))


def detect_shark_jump(episodes: List[Dict[str, Any]], window_size: int = 3) -> Optional[Dict[str, Any]]:
    if len(episodes) < window_size * 2:
        return None
    rolling = calculate_rolling_average(episodes, window_size)
    for index in range(1, len(rolling)):
        drop = rolling[index - 1]["rollingAvg"] - rolling[index]["rollingAvg"]
        if drop > 0.8:
            remaining_avg = sum(row["rollingAvg"] for row in rolling[index:]) / (len(rolling) - index)
            pre_avg = sum(row["rollingAvg"] for row in rolling[:index]) / index
            if pre_avg - remaining_avg > 0.6:
                return {"episode": rolling[index]["episode"], "dropAmount": round_to(drop, 2)}
    return None


def calculate_churn_risk(episodes: List[Dict[str, Any]], score_profile: Dict[str, Any]) -> Dict[str, Any]:
    if not episodes:
        return {"score": 0, "label": "Unknown", "factors": []}
    thresholds = resolve_score_profile(score_profile)
    risk = 0
    factors = []
    avg = calculate_average(episodes)
    drop_threshold = clamp(avg - 0.4, thresholds["p35"], thresholds["p65"])
    current = 0
    max_slump = 0
    for ep in episodes:
        if ep["score"] <= drop_threshold:
            current += 1
        else:
            max_slump = max(max_slump, current)
            current = 0
    max_slump = max(max_slump, current)
    if max_slump >= 3:
        risk += 50
        factors.append("Quality slump (%s consecutive weak episodes)" % max_slump)
    elif max_slump >= 2:
        risk += 25
        factors.append("Minor slump (2 consecutive weak episodes)")
    if len(episodes) > 1 and episodes[-1]["score"] < thresholds["p35"] and episodes[-2]["score"] < thresholds["p35"]:
        risk += 30
        factors.append("Poor recent episodes (last 2 below p35 baseline)")
    avg_penalty = (1 - normalize_score(avg)) * 35
    if avg_penalty > 0:
        risk += js_round(avg_penalty)
        factors.append("Overall quality below peak baseline")
    strict_risk = strict_percent(min(100, risk), True)
    label = "Low Risk"
    if strict_risk > 75:
        label = "Critical Drop-off Risk"
    elif strict_risk > 45:
        label = "High Risk"
    elif strict_risk > 20:
        label = "Moderate Risk"
    return {"score": strict_risk, "label": label, "factors": factors}


def get_slow_burn_signal(momentum_score: float, finale_strength: float) -> float:
    if not math.isfinite(momentum_score) or not math.isfinite(finale_strength):
        return 0
    return max(clamp((finale_strength - 65) / 35, 0, 1), clamp((momentum_score - 60) / 40, 0, 1))


def calculate_retention_score(episodes: List[Dict[str, Any]], score_profile: Dict[str, Any]) -> int:
    if not episodes:
        return 0
    hook = calculate_3_episode_hook(episodes)
    churn = calculate_churn_risk(episodes, score_profile)["score"]
    momentum_score = clamp((calculate_momentum(episodes) + 100) / 2, 0, 100)
    flow = calculate_flow_state(episodes)
    finale = calculate_finale_strength(episodes)
    base_scale = get_early_penalty_scale(episodes)
    early_scale = clamp(base_scale + ((1 - base_scale) * (get_slow_burn_signal(momentum_score, finale) * 0.35)), 0, 1)
    hook_weight = 0.35 * early_scale
    scale_up = (1 - hook_weight) / 0.65 if 0.65 > 0 else 0
    blended = (hook * hook_weight) + ((100 - churn) * 0.3 * scale_up) + (momentum_score * 0.2 * scale_up) + (flow * 0.15 * scale_up)
    return strict_percent(clamp(blended, 0, 100))


def calculate_session_safety(episodes: List[Dict[str, Any]], score_profile: Dict[str, Any]) -> int:
    if not episodes:
        return 0
    thresholds = resolve_score_profile(score_profile)
    avg = calculate_average(episodes)
    safety_floor = clamp(avg - 0.4, thresholds["p35"], thresholds["p65"])
    below = len([ep for ep in episodes if ep["score"] < safety_floor])
    blended = ((1 - (below / len(episodes))) * 0.6) + (normalize_score(avg) * 0.4)
    return strict_percent(blended * 100)


def calculate_reliability_score(episodes: List[Dict[str, Any]], score_profile: Dict[str, Any]) -> int:
    if not episodes:
        return 0
    hook = calculate_3_episode_hook(episodes)
    safety = calculate_session_safety(episodes, score_profile)
    churn = calculate_churn_risk(episodes, score_profile)["score"]
    habit = calculate_habit_break_risk(episodes)
    hook_weight = 0.35 * get_early_penalty_scale(episodes)
    scale_up = (1 - hook_weight) / 0.65 if 0.65 > 0 else 0
    habit_safety = js_round(clamp(1 - (min(habit, 6) / 6), 0, 1) * 100)
    reliability = (hook * hook_weight) + (safety * 0.35 * scale_up) + ((100 - churn) * 0.2 * scale_up) + (habit_safety * 0.1 * scale_up)
    return strict_percent(clamp(reliability, 0, 100))


def calculate_production_quality_index(episodes: List[Dict[str, Any]], score_profile: Dict[str, Any]) -> int:
    if not episodes:
        return 0
    avg_score = (calculate_average(episodes) / 5) * 100
    consistency_score = 100 - clamp((min(calculate_std_dev(episodes), 2) / 2) * 100, 0, 100)
    trend_score = ((clamp(calculate_quality_trend(episodes)["slope"], -0.2, 0.2) + 0.2) / 0.4) * 100
    pqi = (avg_score * 0.35) + (consistency_score * 0.15) + (trend_score * 0.2) + (calculate_3_episode_hook(episodes) * 0.15) + ((100 - calculate_churn_risk(episodes, score_profile)["score"]) * 0.15)
    pqi -= len(detect_quality_dips(episodes)) * 3
    return strict_percent(clamp(pqi, 0, 100))


def calculate_all_stats(anime: Dict[str, Any], score_profile: Dict[str, Any], strict: bool = False) -> Dict[str, Any]:
    episodes = normalize_episodes(anime.get("episodes") or [], strict=strict)
    profile = resolve_score_profile(score_profile)
    avg = calculate_average(episodes)
    std_dev = calculate_std_dev(episodes)
    momentum = calculate_momentum(episodes)
    momentum_score = clamp((momentum + 100) / 2, 0, 100)
    finale = calculate_finale_strength(episodes)
    slow_burn_signal = get_slow_burn_signal(momentum_score, finale)
    direct_episode_count = 0
    metadata = anime.get("metadata") or {}
    for candidate in [anime.get("episodeCount"), anime.get("episodesCount"), anime.get("episodes_count"), metadata.get("episodeCount"), metadata.get("episodesCount"), metadata.get("episodes_count")]:
        try:
            parsed = int(candidate)
        except (TypeError, ValueError):
            parsed = 0
        if parsed > 0:
            direct_episode_count = max(direct_episode_count, parsed)
    observed_episode_count = 0
    for index, episode in enumerate(episodes):
        try:
            count = int(episode.get("episode"))
        except (TypeError, ValueError):
            count = index + 1
        observed_episode_count = max(observed_episode_count, count)
    score_range = get_episode_score_range(episodes)
    return {
        "average": avg,
        "stdDev": std_dev,
        "auc": calculate_auc(episodes),
        "consistency": get_consistency_rating(std_dev),
        "scoreClass": get_score_color_class(avg),
        "episodeCount": max(direct_episode_count, observed_episode_count),
        "highestScore": score_range["max"],
        "lowestScore": score_range["min"],
        "retentionScore": calculate_retention_score(episodes, profile),
        "malSatisfactionScore": anime.get("communityScore") if isinstance(anime.get("communityScore"), (int, float)) else 0,
        "reliabilityScore": calculate_reliability_score(episodes, profile),
        "sessionSafety": calculate_session_safety(episodes, profile),
        "threeEpisodeHook": calculate_3_episode_hook(episodes),
        "habitBreakRisk": calculate_habit_break_risk(episodes),
        "peakScore": calculate_peak_score(episodes),
        "finaleStrength": finale,
        "worthFinishing": calculate_worth_finishing(episodes),
        "peakEpisodeCount": count_peak_episodes(episodes),
        "momentum": momentum,
        "narrativeAcceleration": calculate_narrative_acceleration(episodes),
        "comfortScore": calculate_comfort_score(episodes),
        "stressSpikes": count_stress_spikes(episodes),
        "emotionalStability": calculate_emotional_stability(episodes),
        "barrierToEntry": calculate_barrier_to_entry(episodes),
        "flowState": calculate_flow_state(episodes),
        "qualityTrend": calculate_quality_trend(episodes),
        "qualityDips": detect_quality_dips(episodes),
        "productionQualityIndex": calculate_production_quality_index(episodes, profile),
        "rollingAverage": calculate_rolling_average(episodes),
        "controversyPotential": calculate_controversy_potential(episodes),
        "sharkJump": detect_shark_jump(episodes),
        "churnRisk": calculate_churn_risk(episodes, profile),
        "slowBurn": {
            "signal": round_to(slow_burn_signal, 2),
            "isActive": slow_burn_signal > 0,
            "momentumScore": js_round(momentum_score),
            "finaleStrength": js_round(finale),
        },
    }


def validate_catalog(anime_list: List[Dict[str, Any]], strict: bool = False) -> Dict[str, List[Dict[str, Any]]]:
    errors = []
    warnings = []
    seen = set()
    for index, anime in enumerate(anime_list):
        anime_id = anime.get("id") or (anime.get("metadata") or {}).get("id") or "index-%s" % index
        if not anime.get("id") and not (anime.get("metadata") or {}).get("id"):
            errors.append({"animeId": anime_id, "field": "id", "message": "Missing id", "severity": "error"})
        elif anime_id in seen:
            errors.append({"animeId": anime_id, "field": "id", "message": "Duplicate id", "severity": "error"})
        seen.add(anime_id)
        episodes = anime.get("episodes")
        if not isinstance(episodes, list) or not episodes:
            warnings.append({"animeId": anime_id, "field": "episodes", "message": "Missing episodes", "severity": "warning"})
    return {"errors": errors, "warnings": warnings}


def check_referential_integrity(anime_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    issues = []
    seen_mal = {}
    for index, anime in enumerate(anime_list):
        anime_id = anime.get("id") or str(index + 1)
        mal_id = anime.get("malId")
        if mal_id:
            if mal_id in seen_mal:
                issues.append({"animeId": anime_id, "field": "malId", "message": "Duplicate malId", "severity": "warning"})
            seen_mal[mal_id] = True
    return issues


def by_number_desc(value: Any) -> float:
    return float(value) if isinstance(value, (int, float)) and math.isfinite(value) else 0


def build_catalogs(
    input_path: Path,
    full_output_path: Path,
    preview_output_path: Path,
    report_output_path: Path,
    franchise_map_path: Path,
    strict: bool = True,
    emit_report: bool = False,
) -> Dict[str, Any]:
    started = time.time()
    raw = json.loads(input_path.read_text(encoding="utf-8"))
    anime_list = raw.get("anime") if isinstance(raw.get("anime"), list) else []
    validation = validate_catalog(anime_list, strict=strict)
    if validation["errors"] and strict:
        raise BuildError("Build failed due to validation errors", {"errorCount": len(validation["errors"]), "warningCount": len(validation["warnings"])})
    resolver = load_franchise_resolver(franchise_map_path)
    normalized = [normalize_anime(anime, resolver) for anime in anime_list]
    normalized, collisions = resolve_unique_anime_ids(normalized)
    integrity_issues = check_referential_integrity(normalized)
    integrity_errors = [issue for issue in integrity_issues if issue.get("severity") == "error"]
    if integrity_errors and strict:
        raise BuildError("Build failed due to integrity errors", {"errorCount": len(integrity_errors)})
    score_profile = build_score_profile(normalized)
    full_catalog = []
    for index, anime in enumerate(normalized):
        full_catalog.append({**anime, "stats": calculate_all_stats(anime, score_profile, strict=strict), "colorIndex": index})
    with_episodes = [anime for anime in full_catalog if isinstance(anime.get("episodes"), list) and anime["episodes"]]
    by_retention = sorted(with_episodes, key=lambda anime: by_number_desc((anime.get("stats") or {}).get("retentionScore")), reverse=True)[:PREVIEW_BUCKET]
    by_satisfaction = sorted([anime for anime in full_catalog if isinstance(anime.get("communityScore"), (int, float))], key=lambda anime: by_number_desc(anime.get("communityScore")), reverse=True)[:PREVIEW_BUCKET]
    by_recent = sorted(full_catalog, key=lambda anime: by_number_desc(anime.get("year")), reverse=True)[:PREVIEW_BUCKET]
    preview_map = {}
    for anime in [*by_retention, *by_satisfaction, *by_recent]:
        if anime.get("id") and anime["id"] not in preview_map:
            preview_map[anime["id"]] = anime
    preview_catalog = sorted(preview_map.values(), key=lambda anime: by_number_desc((anime.get("stats") or {}).get("retentionScore")), reverse=True)[:PREVIEW_LIMIT]
    generated_at = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    full_payload = {"generatedAt": generated_at, "scoreProfile": score_profile, "anime": full_catalog}
    preview_payload = {"generatedAt": generated_at, "scoreProfile": score_profile, "anime": preview_catalog}
    write_json_atomic(full_output_path, full_payload)
    write_json_atomic(preview_output_path, preview_payload)
    report = build_quality_report(
        anime=full_catalog,
        validation=validation,
        integrity_issues=integrity_issues,
        score_profile=score_profile,
        duration_ms=(time.time() - started) * 1000,
    )
    gate_results = run_quality_gates(report, strict=strict)
    failing_gates = [gate for gate in gate_results if gate.get("severity") == "error"]
    if failing_gates:
        raise BuildError("Build failed due to quality gates", {"gates": failing_gates})
    if emit_report:
        write_json_atomic(report_output_path, report)
    return {"full": full_payload, "preview": preview_payload, "report": report, "collisions": collisions}


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", nargs="?", default=str(DEFAULT_INPUT))
    parser.add_argument("full_output", nargs="?", default=str(DEFAULT_FULL_OUTPUT))
    parser.add_argument("preview_output", nargs="?", default=str(DEFAULT_PREVIEW_OUTPUT))
    parser.add_argument("--no-strict", action="store_true")
    parser.add_argument("--report", action="store_true")
    parser.add_argument("--report-path", default=str(DEFAULT_REPORT_OUTPUT))
    parser.add_argument("--franchise-map", default=str(DEFAULT_FRANCHISE_MAP))
    parser.add_argument("--state", default="")
    parser.add_argument("--incremental", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    input_path = Path(args.input)
    full_output_path = Path(args.full_output)
    preview_output_path = Path(args.preview_output)
    if args.incremental and not args.force and full_output_path.exists() and preview_output_path.exists():
        print("No changes detected, skipping build.")
        return 0
    try:
        result = build_catalogs(
            input_path=input_path,
            full_output_path=full_output_path,
            preview_output_path=preview_output_path,
            report_output_path=Path(args.report_path),
            franchise_map_path=Path(args.franchise_map),
            strict=not args.no_strict,
            emit_report=args.report,
        )
        if args.report:
            print("Wrote quality report to %s" % args.report_path)
        print("Wrote %s entries to %s" % (len(result["full"]["anime"]), full_output_path))
        print("Wrote %s entries to %s" % (len(result["preview"]["anime"]), preview_output_path))
        return 0
    except BuildError as error:
        print(str(error), file=sys.stderr)
        if error.details:
            print(json.dumps(error.details, indent=2), file=sys.stderr)
        return 1
    except Exception as error:
        print("Build failed unexpectedly: %s" % error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
