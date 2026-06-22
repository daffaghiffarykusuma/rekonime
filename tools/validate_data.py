#!/usr/bin/env python3
"""Validate Rekonime catalog and embedded data."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys
from typing import Any
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from typing import Any, Dict, List, Optional, Set


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_PATH = ROOT / "data" / "anime.full.json"
DEFAULT_EMBEDDED_PATH = ROOT / "js" / "data.js"
DEFAULT_INDEX_PATH = ROOT / "index.html"
DEFAULT_BASELINE_PATH = Path(__file__).resolve().parent / "validation-baseline.json"
NON_TOLERATED_BASELINE_ERRORS = {"duplicateIds"}
TRAILER_URL_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
TRAILER_EMBED_HOSTS = {"youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_label(value: str) -> str:
    return value.replace("\\", "/")


def rel_label(path: Path) -> str:
    return normalize_label(os.path.relpath(path, Path.cwd()))


def extract_embedded_data(source: str, identifier: str = "ANIME_DATA") -> Any:
    text = source.strip()
    if not text:
        raise ValueError("Embedded data script is empty")
    match = re.search(rf"(?:const|let|var)\s+{identifier}\s*=\s*([\s\S]+?);\s*$", text)
    if not match:
        raise ValueError(f"Unable to locate {identifier} payload")
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as error:
        raise ValueError(f"Failed to parse {identifier} JSON payload: {error}") from error


def parse_embedded_data_script(path: Path) -> Any:
    return extract_embedded_data(path.read_text(encoding="utf-8"))


def is_plain_object(value: Any) -> bool:
    return isinstance(value, dict)


def validate_embedded_anime_shape(payload: Any, sample_size: int = 50) -> Dict[str, Any]:
    errors: List[str] = []
    anime_list = payload.get("anime") if isinstance(payload, dict) else None
    if not isinstance(anime_list, list):
        return {"valid": False, "errors": ["payload.anime must be an array"]}
    if not anime_list:
        return {"valid": True, "errors": []}
    limit = min(len(anime_list), max(1, sample_size))
    for index in range(limit):
        anime = anime_list[index]
        if not is_plain_object(anime):
            errors.append(f"anime[{index}] must be an object")
            continue
        if not isinstance(anime.get("genres"), list):
            errors.append(f"anime[{index}].genres must be an array")
        if not isinstance(anime.get("themes"), list):
            errors.append(f"anime[{index}].themes must be an array")
        if not isinstance(anime.get("episodes"), list):
            errors.append(f"anime[{index}].episodes must be an array")
        if anime.get("trailer") is not None and not is_plain_object(anime.get("trailer")):
            errors.append(f"anime[{index}].trailer must be an object or null")
        if not is_plain_object(anime.get("stats")):
            errors.append(f"anime[{index}].stats must be an object")
    return {"valid": len(errors) == 0, "errors": errors}


def normalize_id(anime: Dict[str, Any]) -> str:
    meta = anime.get("metadata") or {}
    return meta.get("id") or anime.get("id") or ""


def normalize_title(anime: Dict[str, Any]) -> str:
    meta = anime.get("metadata") or {}
    return meta.get("title") or anime.get("title") or ""


def normalize_score(anime: Dict[str, Any]) -> Any:
    meta = anime.get("metadata") or {}
    return meta["score"] if "score" in meta else anime.get("score")


def normalize_anilist_id(anime: Dict[str, Any]) -> Any:
    meta = anime.get("metadata") or {}
    return meta["anilistId"] if "anilistId" in meta else anime.get("anilistId")


def normalize_trailer(anime: Dict[str, Any]) -> Any:
    meta = anime.get("metadata") or {}
    return meta.get("trailer") or anime.get("trailer")


def sanitize_url(raw_url: Any, allowed_hosts: Set[str], remove_autoplay: bool = False) -> str:
    if not raw_url:
        return ""
    parsed = urlparse(str(raw_url))
    if parsed.scheme != "https":
        return ""
    if parsed.hostname not in allowed_hosts:
        return ""
    if remove_autoplay:
        query = [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if key != "autoplay"]
        parsed = parsed._replace(query=urlencode(query))
    return urlunparse(parsed)


def build_trailer_urls(trailer: Any) -> Dict[str, str]:
    if not isinstance(trailer, dict):
        return {"url": "", "embedUrl": ""}
    trailer_id = trailer.get("id")
    url = trailer.get("url") or ""
    embed_url = trailer.get("embedUrl") or trailer.get("embed_url") or ""
    if not url and trailer_id:
        url = f"https://www.youtube.com/watch?v={trailer_id}"
    if not embed_url and trailer_id:
        embed_url = f"https://www.youtube.com/embed/{trailer_id}"
    return {
        "url": sanitize_url(url, TRAILER_URL_HOSTS),
        "embedUrl": sanitize_url(embed_url, TRAILER_EMBED_HOSTS, remove_autoplay=True),
    }


def summarize(title: str, groups: Dict[str, List[Any]]) -> str:
    lines = [title + ":"]
    populated = [(key, values) for key, values in groups.items() if values]
    if not populated:
        lines.append("  none")
    else:
        lines.extend(f"  {key}: {len(values)}" for key, values in populated)
    return "\n".join(lines)


def validate_list(anime_list: List[Any], label: str) -> Dict[str, Any]:
    errors = {
        "missingId": [],
        "missingTitle": [],
        "missingCover": [],
        "missingScore": [],
        "missingTrailer": [],
        "invalidTrailer": [],
        "invalidEpisodeScore": [],
        "missingEpisodeScore": [],
        "missingEpisodeNumber": [],
        "duplicateIds": [],
    }
    warnings = {
        "missingYear": [],
        "missingSeason": [],
        "missingStudio": [],
        "missingSource": [],
        "missingAnilistId": [],
        "missingEpisodes": [],
    }
    id_map: Dict[str, bool] = {}

    for index, anime in enumerate(anime_list):
        item = anime if isinstance(anime, dict) else {}
        meta = item.get("metadata") or {}
        anime_id = normalize_id(item)
        title = normalize_title(item)
        cover = meta.get("cover") or item.get("cover")
        year = meta.get("year") or item.get("year")
        season = meta.get("season") or item.get("season")
        studio = meta.get("studio") or item.get("studio")
        source = meta.get("source") or item.get("source")
        score = normalize_score(item)
        anilist_id = normalize_anilist_id(item)
        trailer = normalize_trailer(item)
        episodes = item.get("episodes") or []
        fallback = anime_id or index + 1

        if not anime_id:
            errors["missingId"].append(index + 1)
        elif anime_id in id_map:
            errors["duplicateIds"].append(anime_id)
        else:
            id_map[anime_id] = True

        if not title:
            errors["missingTitle"].append(fallback)
        if not cover:
            errors["missingCover"].append(fallback)
        try:
            numeric_score = float(score)
        except (TypeError, ValueError):
            numeric_score = float("nan")
        if numeric_score != numeric_score:
            errors["missingScore"].append(fallback)

        if not year:
            warnings["missingYear"].append(fallback)
        if not season:
            warnings["missingSeason"].append(fallback)
        if not studio:
            warnings["missingStudio"].append(fallback)
        if not source:
            warnings["missingSource"].append(fallback)
        if not anilist_id:
            warnings["missingAnilistId"].append(fallback)

        if not isinstance(episodes, list) or not episodes:
            warnings["missingEpisodes"].append(fallback)
        else:
            for episode in episodes:
                if not isinstance(episode, dict):
                    continue
                if episode.get("episode") is None:
                    errors["missingEpisodeNumber"].append(fallback)
                if episode.get("score") is None:
                    errors["missingEpisodeScore"].append(fallback)
                else:
                    try:
                        episode_score = float(episode.get("score"))
                    except (TypeError, ValueError):
                        episode_score = float("nan")
                    if episode_score != episode_score or episode_score < 1 or episode_score > 5:
                        errors["invalidEpisodeScore"].append(fallback)

        if not trailer:
            errors["missingTrailer"].append(fallback)
        else:
            urls = build_trailer_urls(trailer)
            if not urls["url"] and not urls["embedUrl"]:
                errors["missingTrailer"].append(fallback)
            elif not urls["url"] or not urls["embedUrl"]:
                errors["invalidTrailer"].append(fallback)

    has_errors = any(len(values) > 0 for values in errors.values())
    print(f"Validation results ({label})")
    print(summarize("Errors", errors))
    print(summarize("Warnings", warnings))
    print("")
    return {"hasErrors": has_errors, "label": label, "errors": errors, "warnings": warnings}


def validate_index_references(index_path: Path) -> Dict[str, Any]:
    if not index_path.exists():
        return {"hasErrors": False, "errors": [], "warnings": [f"Missing index file: {index_path}"]}
    html = index_path.read_text(encoding="utf-8")
    errors: List[str] = []
    warnings: List[str] = []
    if re.search(r"const\s+ANIME_DATA\s*=", html):
        errors.append("index.html still contains inline ANIME_DATA payload")
    if not re.search(r"src=[\"']/js/main\.ts[\"']", html):
        warnings.append("index.html does not reference /js/main.ts")
    return {"hasErrors": bool(errors), "errors": errors, "warnings": warnings}


def run_validation(
    *,
    data_path: Path = DEFAULT_DATA_PATH,
    embedded_path: Path = DEFAULT_EMBEDDED_PATH,
    index_path: Path = DEFAULT_INDEX_PATH,
    baseline_path: Path = DEFAULT_BASELINE_PATH,
    enforce_baseline: bool = False,
    skip_embedded: bool = False,
    skip_index_check: bool = False,
) -> Dict[str, Any]:
    results: List[Dict[str, Any]] = []
    data = read_json(data_path)
    results.append(validate_list(data.get("anime") or [], rel_label(data_path)))

    if not skip_embedded:
        try:
            embedded = parse_embedded_data_script(embedded_path)
            shape = validate_embedded_anime_shape(embedded)
            if not shape["valid"]:
                print(f"Validation results ({rel_label(embedded_path)})")
                print("Errors:")
                print(f"  invalidEmbeddedShape: {len(shape['errors'])}")
                print("Warnings:")
                print("  none\n")
                results.append({
                    "hasErrors": True,
                    "label": rel_label(embedded_path),
                    "errors": {"invalidEmbeddedShape": list(range(len(shape["errors"])))},
                    "warnings": {},
                })
            else:
                results.append(validate_list(embedded.get("anime") or [], rel_label(embedded_path)))
        except Exception as error:
            print(f"Validation results ({rel_label(embedded_path)})")
            print("Errors:")
            print("  invalidEmbeddedData: 1")
            print("Warnings:")
            print(f"  detail: {error}\n")
            results.append({
                "hasErrors": True,
                "label": rel_label(embedded_path),
                "errors": {"invalidEmbeddedData": [1]},
                "warnings": {},
            })

    if not skip_index_check:
        index = validate_index_references(index_path)
        print(f"Index reference check ({rel_label(index_path)})")
        if index["errors"]:
            print("Errors:")
            for error in index["errors"]:
                print(f"  - {error}")
        else:
            print("Errors:\n  none")
        if index["warnings"]:
            print("Warnings:")
            for warning in index["warnings"]:
                print(f"  - {warning}")
        else:
            print("Warnings:\n  none")
        print("")
        results.append({
            "hasErrors": index["hasErrors"],
            "label": rel_label(index_path),
            "errors": {f"indexError{index_pos + 1}": [entry] for index_pos, entry in enumerate(index["errors"])},
            "warnings": {f"indexWarning{index_pos + 1}": [entry] for index_pos, entry in enumerate(index["warnings"])},
        })

    baseline_failures: List[str] = []
    baseline_labels: Set[str] = set()
    if enforce_baseline:
        if not baseline_path.exists():
            baseline_failures.append(f"Missing baseline file: {baseline_path}")
        else:
            baseline = read_json(baseline_path)
            baseline_labels = {str(label) for label in (baseline or {}).keys()}
            for result in results:
                label = result.get("label")
                baseline_entry = (baseline or {}).get(label)
                if not label or not baseline_entry:
                    continue
                for group_name in ["errors", "warnings"]:
                    values = result.get(group_name) or {}
                    expected = baseline_entry.get(group_name) or {}
                    for key in set(values.keys()) | set(expected.keys()):
                        observed = len(values.get(key) or []) if isinstance(values.get(key), list) else 0
                        limit = expected.get(key) if isinstance(expected.get(key), (int, float)) else 0
                        if observed > limit:
                            baseline_failures.append(f"{label} {group_name}.{key} exceeded baseline: {observed} > {limit}")
                for key in NON_TOLERATED_BASELINE_ERRORS:
                    allowed = int((baseline_entry.get("errors") or {}).get(key) or 0)
                    observed = len((result.get("errors") or {}).get(key) or [])
                    if allowed > 0:
                        baseline_failures.append(f"{label} errors.{key} baseline allowance must be 0")
                    if observed > 0:
                        baseline_failures.append(f"{label} errors.{key} must be 0 (observed {observed})")

    if baseline_failures:
        print("Baseline regression check failed:")
        for entry in baseline_failures:
            print(f"  - {entry}")
        print("")

    raw_errors = any(
        result.get("hasErrors")
        and (not enforce_baseline or not result.get("label") or result.get("label") not in baseline_labels)
        for result in results
    )
    return {"hasErrors": raw_errors or bool(baseline_failures), "baselineFailures": baseline_failures}


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(DEFAULT_DATA_PATH))
    parser.add_argument("--embedded", default=str(DEFAULT_EMBEDDED_PATH))
    parser.add_argument("--index", default=str(DEFAULT_INDEX_PATH))
    parser.add_argument("--baseline", default=str(DEFAULT_BASELINE_PATH))
    parser.add_argument("--enforce-baseline", action="store_true")
    parser.add_argument("--skip-embedded", action="store_true")
    parser.add_argument("--skip-index-check", action="store_true")
    args = parser.parse_args(argv)

    result = run_validation(
        data_path=Path(args.data),
        embedded_path=Path(args.embedded),
        index_path=Path(args.index),
        baseline_path=Path(args.baseline),
        enforce_baseline=args.enforce_baseline,
        skip_embedded=args.skip_embedded,
        skip_index_check=args.skip_index_check,
    )
    return 1 if result["hasErrors"] else 0


if __name__ == "__main__":
    sys.exit(main())
