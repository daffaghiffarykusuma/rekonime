"""
Update data/anime.json with YouTube trailer links.

Uses AniList trailers first, falls back to Jikan (MAL) trailer data,
and replaces trailers that cannot be embedded with alternatives from search.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import parse_qs, urlparse

import requests


ANILIST_API = "https://graphql.anilist.co"
JIKAN_API = "https://api.jikan.moe/v4"
YOUTUBE_SEARCH_URL = "https://www.youtube.com/results"
YOUTUBE_WATCH_URL = "https://www.youtube.com/watch?v="

ANILIST_DELAY = 0.7
JIKAN_DELAY = 0.4
YOUTUBE_DELAY = 0.5
BATCH_SIZE = 50
SEARCH_RESULTS_LIMIT = 12

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.5",
}


def chunked(items: List[int], size: int) -> Iterable[List[int]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def extract_youtube_id(url: str) -> Optional[str]:
    if not url:
        return None

    try:
        parsed = urlparse(url)
    except ValueError:
        return None

    host = parsed.netloc.lower()
    path = parsed.path

    if "youtu.be" in host:
        return path.strip("/").split("/")[0] or None

    if "youtube.com" in host or "youtube-nocookie.com" in host:
        if path.startswith("/embed/"):
            return path.split("/embed/")[1].split("/")[0] or None
        if path == "/watch":
            query = parse_qs(parsed.query)
            return query.get("v", [None])[0]

    return None


def normalize_anilist_trailer(trailer: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not trailer:
        return None

    site = (trailer.get("site") or "").lower()
    video_id = trailer.get("id")
    if site != "youtube" or not video_id:
        return None

    return {
        "site": "youtube",
        "id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "embedUrl": f"https://www.youtube.com/embed/{video_id}",
        "thumbnail": trailer.get("thumbnail") or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        "source": "anilist",
    }


def normalize_jikan_trailer(trailer: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not trailer:
        return None

    video_id = trailer.get("youtube_id")
    url = trailer.get("url")
    embed_url = trailer.get("embed_url")

    if not video_id:
        video_id = extract_youtube_id(embed_url) or extract_youtube_id(url)

    if not video_id and not url and not embed_url:
        return None

    return {
        "site": "youtube",
        "id": video_id,
        "url": url or (f"https://www.youtube.com/watch?v={video_id}" if video_id else ""),
        "embedUrl": embed_url or (f"https://www.youtube.com/embed/{video_id}" if video_id else ""),
        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else "",
        "source": "jikan",
    }


def build_youtube_trailer(video_id: str, source: str) -> Dict[str, Any]:
    return {
        "site": "youtube",
        "id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "embedUrl": f"https://www.youtube.com/embed/{video_id}",
        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        "source": source,
    }


def extract_player_response(html: str) -> Optional[Dict[str, Any]]:
    marker = "ytInitialPlayerResponse = "
    start = html.find(marker)
    if start == -1:
        return None

    start += len(marker)
    brace_count = 0
    in_string = False
    escape = False
    end = None

    for idx in range(start, len(html)):
        ch = html[idx]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == "{":
            brace_count += 1
        elif ch == "}":
            brace_count -= 1
            if brace_count == 0:
                end = idx + 1
                break

    if end is None:
        return None

    try:
        return json.loads(html[start:end])
    except json.JSONDecodeError:
        return None


def fetch_player_response(session: requests.Session, video_id: str) -> Optional[Dict[str, Any]]:
    url = f"{YOUTUBE_WATCH_URL}{video_id}"
    response = session.get(url, timeout=20)

    if response.status_code == 429:
        time.sleep(5)
        response = session.get(url, timeout=20)

    if not response.ok:
        time.sleep(YOUTUBE_DELAY)
        return None

    data = extract_player_response(response.text)
    time.sleep(YOUTUBE_DELAY)
    return data


def is_embeddable(session: requests.Session, video_id: str, cache: Dict[str, bool]) -> bool:
    if video_id in cache:
        return cache[video_id]

    data = fetch_player_response(session, video_id)
    if not data:
        cache[video_id] = False
        return False

    playability = data.get("playabilityStatus", {})
    status = playability.get("status")
    playable_in_embed = playability.get("playableInEmbed")

    embeddable = status == "OK" and playable_in_embed is not False
    cache[video_id] = embeddable
    return embeddable


def search_youtube_video_ids(session: requests.Session, query: str) -> List[str]:
    response = session.get(
        YOUTUBE_SEARCH_URL,
        params={"search_query": query},
        timeout=20
    )

    if response.status_code == 429:
        time.sleep(5)
        response = session.get(
            YOUTUBE_SEARCH_URL,
            params={"search_query": query},
            timeout=20
        )

    if not response.ok:
        return []

    matches = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', response.text)
    results = []
    seen = set()

    for video_id in matches:
        if video_id in seen:
            continue
        seen.add(video_id)
        results.append(video_id)
        if len(results) >= SEARCH_RESULTS_LIMIT:
            break

    return results


def find_embeddable_trailer(
    session: requests.Session,
    title: str,
    blocked_ids: set[str],
    embed_cache: Dict[str, bool],
) -> Optional[Dict[str, Any]]:
    queries = [
        f"{title} official trailer",
        f"{title} trailer",
        f"{title} PV",
    ]

    for query in queries:
        candidates = search_youtube_video_ids(session, query)
        time.sleep(YOUTUBE_DELAY)
        for video_id in candidates:
            if video_id in blocked_ids:
                continue
            if is_embeddable(session, video_id, embed_cache):
                return build_youtube_trailer(video_id, "youtube-search")

    return None


def fetch_anilist_batch(session: requests.Session, ids: List[int]) -> Dict[int, Dict[str, Any]]:
    query = """
    query ($ids: [Int]) {
      Page(perPage: 50) {
        media(id_in: $ids, type: ANIME) {
          id
          trailer {
            id
            site
            thumbnail
          }
        }
      }
    }
    """

    response = session.post(
        ANILIST_API,
        json={"query": query, "variables": {"ids": ids}},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )

    if response.status_code == 429:
        time.sleep(60)
        response = session.post(
            ANILIST_API,
            json={"query": query, "variables": {"ids": ids}},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

    response.raise_for_status()
    payload = response.json()

    if payload.get("errors"):
        raise RuntimeError(payload["errors"][0].get("message", "AniList GraphQL error"))

    media = payload.get("data", {}).get("Page", {}).get("media", []) or []
    return {item["id"]: item.get("trailer") for item in media if item.get("id")}


def fetch_anilist_trailers(session: requests.Session, anilist_ids: List[int]) -> Dict[int, Dict[str, Any]]:
    results: Dict[int, Dict[str, Any]] = {}

    for batch in chunked(anilist_ids, BATCH_SIZE):
        trailers = fetch_anilist_batch(session, batch)
        results.update(trailers)
        time.sleep(ANILIST_DELAY)

    return results


def fetch_jikan_trailer(session: requests.Session, mal_id: int) -> Optional[Dict[str, Any]]:
    url = f"{JIKAN_API}/anime/{mal_id}/full"
    response = session.get(url, timeout=30)

    if response.status_code == 429:
        time.sleep(5)
        response = session.get(url, timeout=30)

    response.raise_for_status()
    payload = response.json()
    return payload.get("data", {}).get("trailer")


def has_trailer(entry: Dict[str, Any]) -> bool:
    trailer = entry.get("metadata", {}).get("trailer") or entry.get("trailer") or {}
    return bool(trailer.get("id") or trailer.get("url") or trailer.get("embedUrl"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Add YouTube trailer links to anime.json.")
    parser.add_argument("--input", default="data/anime.json", help="Path to anime.json")
    parser.add_argument("--output", help="Output path (default: overwrite input)")
    parser.add_argument("--refresh", action="store_true", help="Refresh trailers even if present")
    parser.add_argument("--limit", type=int, help="Limit number of anime to update (debug)")

    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output) if args.output else input_path

    with input_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    anime_list = data.get("anime", [])
    if args.limit:
        anime_list = anime_list[: args.limit]

    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)

    needs = [
        entry for entry in anime_list
        if args.refresh or not has_trailer(entry)
    ]

    anilist_ids = [
        entry.get("metadata", {}).get("anilistId")
        for entry in needs
        if entry.get("metadata", {}).get("anilistId")
    ]

    unique_anilist_ids = sorted(set(anilist_ids))
    print(f"Fetching AniList trailers for {len(unique_anilist_ids)} anime...")
    anilist_trailers = fetch_anilist_trailers(session, unique_anilist_ids)

    updated = 0
    missing_after_anilist = []

    for entry in needs:
        metadata = entry.get("metadata") or {}
        anilist_id = metadata.get("anilistId")
        trailer_data = anilist_trailers.get(anilist_id) if anilist_id else None
        normalized = normalize_anilist_trailer(trailer_data) if trailer_data else None

        if normalized:
            metadata["trailer"] = normalized
            entry["metadata"] = metadata
            updated += 1
        else:
            missing_after_anilist.append(entry)

    print(f"AniList trailers found: {updated}")

    if missing_after_anilist:
        print(f"Falling back to Jikan for {len(missing_after_anilist)} anime...")

    jikan_updated = 0
    for entry in missing_after_anilist:
        metadata = entry.get("metadata") or {}
        mal_id = metadata.get("malId") or entry.get("mal_id") or entry.get("malId")
        if not mal_id:
            continue

        try:
            trailer_data = fetch_jikan_trailer(session, int(mal_id))
        except (requests.RequestException, ValueError) as exc:
            print(f"Jikan error for MAL {mal_id}: {exc}")
            continue

        normalized = normalize_jikan_trailer(trailer_data)
        if normalized:
            metadata["trailer"] = normalized
            entry["metadata"] = metadata
            jikan_updated += 1

        time.sleep(JIKAN_DELAY)

    print(f"Jikan trailers found: {jikan_updated}")

    embed_cache: Dict[str, bool] = {}
    replaced = 0
    removed = 0
    still_blocked = []

    print("Checking embeddability and swapping blocked trailers...")
    for entry in anime_list:
        metadata = entry.get("metadata") or {}
        trailer = metadata.get("trailer")
        if not trailer:
            continue

        video_id = trailer.get("id") or extract_youtube_id(trailer.get("url") or "")
        if not video_id:
            continue

        if is_embeddable(session, video_id, embed_cache):
            trailer["id"] = video_id
            metadata["trailer"] = trailer
            entry["metadata"] = metadata
            continue

        title = metadata.get("title") or entry.get("title") or ""
        alternative = find_embeddable_trailer(
            session,
            title,
            {video_id},
            embed_cache,
        )

        if alternative:
            metadata["trailer"] = alternative
            entry["metadata"] = metadata
            replaced += 1
        else:
            metadata["trailer"] = None
            entry["metadata"] = metadata
            removed += 1
            still_blocked.append(title or entry.get("title") or "Unknown title")

    total_trailers = sum(1 for entry in anime_list if has_trailer(entry))
    print(f"Total trailers present: {total_trailers} / {len(anime_list)}")
    print(f"Replaced blocked trailers: {replaced}")
    print(f"Removed blocked trailers (no embeddable alternative found): {removed}")
    if still_blocked:
        print("Missing embeddable trailers:")
        for title in still_blocked:
            print(f"  - {title}")

    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"Updated file written to {output_path}")


if __name__ == "__main__":
    main()
