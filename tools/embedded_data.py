"""Embedded catalog data helpers for Python migration parity."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List


EMBEDDED_DATA_IDENTIFIER = "ANIME_DATA"


def extract_embedded_data(script_content: str, *, identifier: str = EMBEDDED_DATA_IDENTIFIER) -> Any:
    source = str(script_content or "").strip()
    if not source:
        raise ValueError("Embedded data script is empty")
    match = re.search(rf"(?:const|let|var)\s+{identifier}\s*=\s*([\s\S]+?);\s*$", source)
    if not match:
        raise ValueError(f"Unable to locate {identifier} payload")
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as error:
        raise ValueError(f"Failed to parse {identifier} JSON payload: {error}") from error


def serialize_embedded_data(payload: Any, *, identifier: str = EMBEDDED_DATA_IDENTIFIER) -> str:
    return f"const {identifier}={json.dumps(payload, ensure_ascii=False, separators=(',', ':'))};"


def is_plain_object(value: Any) -> bool:
    return isinstance(value, dict)


def validate_embedded_anime_shape(payload: Any, *, sample_size: int = 25) -> Dict[str, Any]:
    errors: List[str] = []
    anime_list = payload.get("anime") if isinstance(payload, dict) else None
    if not isinstance(anime_list, list):
        errors.append("payload.anime must be an array")
        return {"valid": False, "errors": errors}
    if not anime_list:
        return {"valid": True, "errors": errors}
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
