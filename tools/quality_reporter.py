"""Python quality reporting internals for data-tool migration parity."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union


DEFAULT_GATES = {
    "maxErrorPercentage": 5,
    "minAverageEpisodes": 8,
    "maxAverageEpisodes": 30,
    "minSampleSize": 1000,
}


def round2(value: float) -> Union[float, int]:
    rounded = round(value * 100) / 100
    return int(rounded) if float(rounded).is_integer() else rounded


def summarize_issues(issues: Optional[List[Dict[str, Any]]] = None) -> Dict[str, int]:
    items = issues or []
    errors = [issue for issue in items if issue.get("severity") == "error"]
    warnings = [issue for issue in items if issue.get("severity") != "error"]
    error_anime = {issue.get("animeId") for issue in errors if issue.get("animeId")}
    warning_anime = {issue.get("animeId") for issue in warnings if issue.get("animeId")}
    return {
        "errorCount": len(errors),
        "warningCount": len(warnings),
        "animeWithErrors": len(error_anime),
        "animeWithWarnings": len(warning_anime),
    }


def build_quality_report(
    *,
    anime: Optional[List[Dict[str, Any]]] = None,
    validation: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    integrity_issues: Optional[List[Dict[str, Any]]] = None,
    score_profile: Optional[Dict[str, Any]] = None,
    duration_ms: Union[int, float] = 0,
) -> Dict[str, Any]:
    anime_items = anime or []
    validation_payload = validation or {"errors": [], "warnings": []}
    integrity_items = integrity_issues or []
    total_anime = len(anime_items)
    total_episodes = sum(len(item.get("episodes", [])) if isinstance(item.get("episodes"), list) else 0 for item in anime_items)
    average_episodes = round2(total_episodes / total_anime) if total_anime else 0

    validation_issues = [
        *(validation_payload.get("errors") or []),
        *(validation_payload.get("warnings") or []),
    ]
    integrity_summary = summarize_issues(integrity_items)
    validation_summary = summarize_issues(validation_issues)

    return {
        "buildId": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "duration": round(duration_ms),
        "stats": {
            "totalAnime": total_anime,
            "totalEpisodes": total_episodes,
            "averageEpisodesPerAnime": average_episodes,
            "animeWithErrors": validation_summary["animeWithErrors"],
            "animeWithWarnings": validation_summary["animeWithWarnings"],
        },
        "validation": {
            "schemaErrors": len(validation_payload.get("errors") or []),
            "schemaWarnings": len(validation_payload.get("warnings") or []),
            "integrityIssues": len(integrity_items),
            "warnings": (validation_payload.get("warnings") or [])[:10],
        },
        "integrity": {
            "errorCount": integrity_summary["errorCount"],
            "warningCount": integrity_summary["warningCount"],
        },
        "statsProfile": score_profile,
    }


def run_quality_gates(
    report: Dict[str, Any],
    *,
    gates: Optional[Dict[str, Any]] = None,
    strict: bool = False,
) -> List[Dict[str, Any]]:
    active_gates = gates or DEFAULT_GATES
    results: List[Dict[str, Any]] = []
    stats = report.get("stats") or {}
    total_anime = stats.get("totalAnime") or 0
    error_percentage = ((stats.get("animeWithErrors") or 0) / total_anime) * 100 if total_anime else 0

    if error_percentage > active_gates["maxErrorPercentage"]:
        results.append({
            "name": "maxErrorPercentage",
            "passed": False,
            "message": f"Error percentage {error_percentage:.1f}% exceeds {active_gates['maxErrorPercentage']}",
        })

    average = stats.get("averageEpisodesPerAnime") or 0
    if average and average < active_gates["minAverageEpisodes"]:
        results.append({
            "name": "minAverageEpisodes",
            "passed": False,
            "message": f"Average episodes {average} below minimum {active_gates['minAverageEpisodes']}",
        })
    if average and average > active_gates["maxAverageEpisodes"]:
        results.append({
            "name": "maxAverageEpisodes",
            "passed": False,
            "message": f"Average episodes {average} above maximum {active_gates['maxAverageEpisodes']}",
        })

    stats_profile = report.get("statsProfile") or {}
    sample_size = stats_profile.get("sampleSize")
    if isinstance(sample_size, (int, float)) and sample_size < active_gates["minSampleSize"]:
        results.append({
            "name": "minSampleSize",
            "passed": False,
            "message": f"Sample size {sample_size} below minimum {active_gates['minSampleSize']}",
        })

    severity = "error" if strict else "warning"
    return [{**result, "severity": severity} for result in results]
