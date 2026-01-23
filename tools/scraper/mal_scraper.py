"""
MAL Episode Score & Metadata Scraper

Scrapes episode poll scores from MyAnimeList episode list pages,
and fetches full anime metadata from Jikan API (free MAL API).

Usage:
    python mal_scraper.py --anime-id 38101 --title "5-toubun no Hanayome" -v
    python mal_scraper.py --batch anime_list.json -v
"""

import argparse
import json
import re
import time
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup


class MALScraper:
    """Scraper for MyAnimeList episode scores and metadata."""

    BASE_URL = "https://myanimelist.net"
    JIKAN_API = "https://api.jikan.moe/v4"
    ANILIST_API = "https://graphql.anilist.co"
    YOUTUBE_SEARCH_URL = "https://www.youtube.com/results"
    YOUTUBE_WATCH_URL = "https://www.youtube.com/watch?v="

    # Rate limiting
    REQUEST_DELAY = 2.0  # For MAL scraping
    JIKAN_DELAY = 1.0    # Jikan has 3 req/sec limit
    ANILIST_DELAY = 0.7  # AniList has 90 req/min limit
    YOUTUBE_DELAY = 0.5  # YouTube page fetching

    # Headers to mimic browser
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
    }

    # Season mapping
    SEASON_MAP = {
        "winter": "Winter",
        "spring": "Spring",
        "summer": "Summer",
        "fall": "Fall"
    }

    def __init__(self, verbose: bool = False):
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)
        self.verbose = verbose
        self.last_request_time = 0
        self.last_jikan_time = 0
        self.last_anilist_time = 0
        self.last_youtube_time = 0
        self.youtube_embed_cache = {}
        self.youtube_search_cache = {}

    def _rate_limit(self, api: str = "mal"):
        """Ensure we don't exceed rate limits."""
        if api == "jikan":
            elapsed = time.time() - self.last_jikan_time
            if elapsed < self.JIKAN_DELAY:
                time.sleep(self.JIKAN_DELAY - elapsed)
            self.last_jikan_time = time.time()
        elif api == "anilist":
            elapsed = time.time() - self.last_anilist_time
            if elapsed < self.ANILIST_DELAY:
                time.sleep(self.ANILIST_DELAY - elapsed)
            self.last_anilist_time = time.time()
        elif api == "youtube":
            elapsed = time.time() - self.last_youtube_time
            if elapsed < self.YOUTUBE_DELAY:
                time.sleep(self.YOUTUBE_DELAY - elapsed)
            self.last_youtube_time = time.time()
        else:
            elapsed = time.time() - self.last_request_time
            if elapsed < self.REQUEST_DELAY:
                time.sleep(self.REQUEST_DELAY - elapsed)
            self.last_request_time = time.time()

    def _log(self, message: str):
        """Log message if verbose mode is enabled."""
        if self.verbose:
            try:
                print(f"[MAL Scraper] {message}")
            except UnicodeEncodeError:
                print(f"[MAL Scraper] {message.encode('ascii', 'replace').decode()}")

    def _fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch a page and return BeautifulSoup object."""
        self._rate_limit("mal")

        try:
            self._log(f"Fetching: {url}")
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return BeautifulSoup(response.text, "lxml")
        except requests.RequestException as e:
            self._log(f"Error fetching {url}: {e}")
            return None

    def _fetch_jikan(self, endpoint: str) -> Optional[dict]:
        """Fetch data from Jikan API."""
        self._rate_limit("jikan")

        url = f"{self.JIKAN_API}{endpoint}"
        try:
            self._log(f"Jikan API: {endpoint}")
            response = self.session.get(url, timeout=30)

            # Handle rate limiting
            if response.status_code == 429:
                self._log("Jikan rate limited, waiting 5 seconds...")
                time.sleep(5)
                response = self.session.get(url, timeout=30)

            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            self._log(f"Jikan API error: {e}")
            return None

    def get_anilist_id(self, mal_id: int) -> Optional[int]:
        """
        Fetch AniList ID using MAL ID.

        AniList's GraphQL API allows querying by MAL ID (idMal).
        """
        self._rate_limit("anilist")

        query = """
        query ($malId: Int) {
            Media(idMal: $malId, type: ANIME) {
                id
            }
        }
        """

        try:
            self._log(f"AniList API: Looking up MAL ID {mal_id}")
            response = self.session.post(
                self.ANILIST_API,
                json={"query": query, "variables": {"malId": mal_id}},
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            # Handle rate limiting
            if response.status_code == 429:
                self._log("AniList rate limited, waiting 60 seconds...")
                time.sleep(60)
                response = self.session.post(
                    self.ANILIST_API,
                    json={"query": query, "variables": {"malId": mal_id}},
                    headers={"Content-Type": "application/json"},
                    timeout=30
                )

            response.raise_for_status()
            data = response.json()

            if data.get("errors"):
                self._log(f"AniList error: {data['errors'][0].get('message', 'Unknown error')}")
                return None

            anilist_id = data.get("data", {}).get("Media", {}).get("id")
            if anilist_id:
                self._log(f"Found AniList ID: {anilist_id}")
            return anilist_id

        except requests.RequestException as e:
            self._log(f"AniList API error: {e}")
            return None

    def get_anime_metadata(self, anime_id: int) -> Optional[dict]:
        """
        Fetch full anime metadata from Jikan API.

        Returns dict with: title, cover, year, season, studio, source,
                          genres, themes, demographic, type, title_english,
                          title_japanese, anilistId (if available)
        """
        data = self._fetch_jikan(f"/anime/{anime_id}/full")

        if not data or "data" not in data:
            return None

        anime = data["data"]

        # Extract studios (can be multiple)
        studios = [s["name"] for s in anime.get("studios", [])]
        studio = studios[0] if len(studios) == 1 else studios if studios else ""

        # Extract genres
        genres = [g["name"] for g in anime.get("genres", [])]

        # Extract themes
        themes = [t["name"] for t in anime.get("themes", [])]

        # Extract demographic
        demographics = anime.get("demographics", [])
        demographic = demographics[0]["name"] if demographics else ""

        # Get season and year
        season = self.SEASON_MAP.get(anime.get("season", "").lower(), "")
        year = anime.get("year") or (anime.get("aired", {}).get("prop", {}).get("from", {}).get("year"))

        # Create ID slug from title
        title = anime.get("title", "")
        title_english = anime.get("title_english") or ""
        title_japanese = anime.get("title_japanese") or ""
        id_slug = self._create_slug(title)

        trailer = self._normalize_jikan_trailer(anime.get("trailer") or {})

        return {
            "id": id_slug,
            "title": title,
            "title_english": title_english,
            "title_japanese": title_japanese,
            "malId": anime_id,
            "cover": anime.get("images", {}).get("jpg", {}).get("large_image_url", ""),
            "type": anime.get("type", ""),
            "year": year,
            "season": season,
            "studio": studio,
            "source": anime.get("source", ""),
            "genres": genres,
            "themes": themes,
            "demographic": demographic,
            # Additional useful data
            "synopsis": anime.get("synopsis", ""),
            "score": anime.get("score"),
            "episodes_count": anime.get("episodes"),
            "trailer": trailer,
        }

    def _create_slug(self, title: str) -> str:
        """Create URL-friendly slug from title."""
        # Remove special characters, convert to lowercase
        slug = re.sub(r'[^\w\s-]', '', title.lower())
        # Replace spaces with hyphens
        slug = re.sub(r'[\s_]+', '-', slug)
        # Remove multiple hyphens
        slug = re.sub(r'-+', '-', slug)
        return slug.strip('-')

    def _extract_youtube_id(self, url: str) -> Optional[str]:
        """Extract YouTube video ID from common URL formats."""
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

    def _normalize_jikan_trailer(self, trailer: dict) -> Optional[dict]:
        """Normalize Jikan trailer data to a YouTube-friendly format."""
        if not trailer:
            return None

        video_id = trailer.get("youtube_id")
        url = trailer.get("url")
        embed_url = trailer.get("embed_url")

        if not video_id:
            video_id = self._extract_youtube_id(embed_url) or self._extract_youtube_id(url)

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

    def _normalize_anilist_trailer(self, trailer: dict) -> Optional[dict]:
        """Normalize AniList trailer data to a YouTube-friendly format."""
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

    def _build_youtube_trailer(self, video_id: str, source: str) -> dict:
        return {
            "site": "youtube",
            "id": video_id,
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "embedUrl": f"https://www.youtube.com/embed/{video_id}",
            "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            "source": source,
        }

    def _extract_player_response(self, html: str) -> Optional[dict]:
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

    def _fetch_player_response(self, video_id: str) -> Optional[dict]:
        self._rate_limit("youtube")
        url = f"{self.YOUTUBE_WATCH_URL}{video_id}"
        try:
            response = self.session.get(url, timeout=20)
            if response.status_code == 429:
                self._log("YouTube rate limited, waiting 5 seconds...")
                time.sleep(5)
                response = self.session.get(url, timeout=20)
            if not response.ok:
                return None
            return self._extract_player_response(response.text)
        except requests.RequestException as e:
            self._log(f"YouTube fetch error: {e}")
            return None

    def _is_youtube_embeddable(self, video_id: str) -> bool:
        if video_id in self.youtube_embed_cache:
            return self.youtube_embed_cache[video_id]

        data = self._fetch_player_response(video_id)
        if not data:
            self.youtube_embed_cache[video_id] = False
            return False

        playability = data.get("playabilityStatus", {})
        status = playability.get("status")
        playable_in_embed = playability.get("playableInEmbed")
        embeddable = status == "OK" and playable_in_embed is not False
        self.youtube_embed_cache[video_id] = embeddable
        return embeddable

    def _search_youtube_video_ids(self, query: str, limit: int = 12) -> list[str]:
        if query in self.youtube_search_cache:
            return self.youtube_search_cache[query]

        self._rate_limit("youtube")
        try:
            response = self.session.get(
                self.YOUTUBE_SEARCH_URL,
                params={"search_query": query},
                timeout=20
            )
            if response.status_code == 429:
                self._log("YouTube search rate limited, waiting 5 seconds...")
                time.sleep(5)
                response = self.session.get(
                    self.YOUTUBE_SEARCH_URL,
                    params={"search_query": query},
                    timeout=20
                )
            if not response.ok:
                return []
        except requests.RequestException as e:
            self._log(f"YouTube search error: {e}")
            return []

        matches = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', response.text)
        results = []
        seen = set()
        for video_id in matches:
            if video_id in seen:
                continue
            seen.add(video_id)
            results.append(video_id)
            if len(results) >= limit:
                break

        self.youtube_search_cache[query] = results
        return results

    def _find_embeddable_trailer(self, title: str, blocked_ids: set[str]) -> Optional[dict]:
        if not title:
            return None

        queries = [
            f"{title} official trailer",
            f"{title} trailer",
            f"{title} PV",
        ]

        for query in queries:
            candidates = self._search_youtube_video_ids(query)
            for video_id in candidates:
                if video_id in blocked_ids:
                    continue
                if self._is_youtube_embeddable(video_id):
                    return self._build_youtube_trailer(video_id, "youtube-search")

        return None

    def _select_embeddable_trailer(
        self,
        title: str,
        anilist_trailer: Optional[dict],
        jikan_trailer: Optional[dict],
    ) -> Optional[dict]:
        blocked_ids: set[str] = set()

        for candidate, source in ((anilist_trailer, "anilist"), (jikan_trailer, "jikan")):
            if not candidate:
                continue
            video_id = candidate.get("id") or self._extract_youtube_id(candidate.get("url", ""))
            if not video_id:
                continue
            if self._is_youtube_embeddable(video_id):
                candidate["id"] = video_id
                candidate["source"] = candidate.get("source") or source
                return candidate
            blocked_ids.add(video_id)

        return self._find_embeddable_trailer(title, blocked_ids)

    def get_anilist_trailer(self, anilist_id: int) -> Optional[dict]:
        """Fetch trailer data from AniList by AniList ID."""
        self._rate_limit("anilist")

        query = """
        query ($id: Int) {
            Media(id: $id, type: ANIME) {
                trailer {
                    id
                    site
                    thumbnail
                }
            }
        }
        """

        try:
            self._log(f"AniList API: Trailer lookup for {anilist_id}")
            response = self.session.post(
                self.ANILIST_API,
                json={"query": query, "variables": {"id": anilist_id}},
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            if response.status_code == 429:
                self._log("AniList rate limited, waiting 60 seconds...")
                time.sleep(60)
                response = self.session.post(
                    self.ANILIST_API,
                    json={"query": query, "variables": {"id": anilist_id}},
                    headers={"Content-Type": "application/json"},
                    timeout=30
                )

            response.raise_for_status()
            data = response.json()

            if data.get("errors"):
                self._log(f"AniList error: {data['errors'][0].get('message', 'Unknown error')}")
                return None

            trailer = data.get("data", {}).get("Media", {}).get("trailer")
            return self._normalize_anilist_trailer(trailer)

        except requests.RequestException as e:
            self._log(f"AniList API error: {e}")
            return None

    def get_anime_slug(self, anime_id: int) -> Optional[str]:
        """Get the URL slug for an anime by fetching its main page."""
        url = f"{self.BASE_URL}/anime/{anime_id}"
        soup = self._fetch_page(url)

        if not soup:
            return None

        if soup.select_one('.error404'):
            return None

        canonical = soup.select_one('link[rel="canonical"]')
        if canonical:
            href = canonical.get('href', '')
            match = re.search(rf'/anime/{anime_id}/([^/]+)', href)
            if match:
                return match.group(1)

        return None

    def scrape_episode_scores(self, anime_id: int, slug: str) -> list[dict]:
        """Scrape episode scores from the episode list page."""
        url = f"{self.BASE_URL}/anime/{anime_id}/{slug}/episode"
        soup = self._fetch_page(url)

        if not soup:
            return []

        episodes = []

        # Find the episode table
        table = soup.select_one('table.ascend, table.mt8')

        if not table:
            for t in soup.select('table'):
                text = t.get_text()
                if 'Poll' in text or 'average' in text.lower():
                    table = t
                    break

        if not table:
            self._log("Could not find episode table")
            return []

        rows = table.select('tr')
        self._log(f"Found {len(rows)} rows in episode table")

        for row in rows:
            cells = row.select('td')
            if not cells or len(cells) < 4:
                continue

            ep_text = cells[0].get_text(strip=True)
            try:
                episode_num = int(ep_text)
            except ValueError:
                continue

            row_text = row.get_text()
            score_match = re.search(r'average\s*(\d\.\d)', row_text, re.IGNORECASE)

            if score_match:
                score = float(score_match.group(1))
                episodes.append({
                    "episode": episode_num,
                    "score": score
                })
                self._log(f"  Episode {episode_num}: {score}")
            else:
                self._log(f"  Episode {episode_num}: No score found")

        return episodes

    def scrape_anime(self, anime_id: int, anime_title: str, fetch_metadata: bool = True) -> dict:
        """
        Scrape all data for an anime.

        Args:
            anime_id: MyAnimeList anime ID
            anime_title: Anime title (for output)
            fetch_metadata: Whether to fetch full metadata from Jikan

        Returns:
            Dict with anime info, metadata, and episode scores
        """
        self._log(f"Scraping {anime_title} (MAL ID: {anime_id})")

        result = {
            "mal_id": anime_id,
            "title": anime_title,
            "metadata": None,
            "episodes": [],
            "scrape_errors": []
        }

        # Fetch metadata from Jikan API
        if fetch_metadata:
            metadata = self.get_anime_metadata(anime_id)
            if metadata:
                if metadata.get("type") and metadata.get("type") != "TV":
                    self._log(f"Skipping non-TV type: {metadata.get('type')}")
                    result["metadata"] = metadata
                    result["scrape_errors"].append("Non-TV type skipped")
                    return result
                jikan_trailer = metadata.get("trailer")
                # Also fetch AniList ID
                anilist_id = self.get_anilist_id(anime_id)
                anilist_trailer = None
                if anilist_id:
                    metadata["anilistId"] = anilist_id
                    anilist_trailer = self.get_anilist_trailer(anilist_id)
                else:
                    self._log(f"Could not find AniList ID for MAL ID {anime_id}")

                selected_trailer = self._select_embeddable_trailer(
                    metadata.get("title") or anime_title,
                    anilist_trailer,
                    jikan_trailer,
                )
                if selected_trailer:
                    metadata["trailer"] = selected_trailer
                else:
                    metadata["trailer"] = None

                result["metadata"] = metadata
                self._log(f"Got metadata: {metadata.get('year')} {metadata.get('season')}, {len(metadata.get('genres', []))} genres")
            else:
                result["scrape_errors"].append("Could not fetch metadata from Jikan")

        # Get anime slug for episode page
        slug = self.get_anime_slug(anime_id)
        if not slug:
            self._log(f"Could not get URL slug for {anime_title}")
            result["scrape_errors"].append("Could not get URL slug")
            return result

        self._log(f"URL slug: {slug}")

        # Scrape episode scores
        episodes = self.scrape_episode_scores(anime_id, slug)

        if not episodes:
            result["scrape_errors"].append("No episode scores found")
        else:
            result["episodes"] = sorted(episodes, key=lambda x: x["episode"])

        self._log(f"Completed: {len(result['episodes'])} episodes scraped")
        return result

    def scrape_batch(self, anime_list: list[dict], fetch_metadata: bool = True) -> list[dict]:
        """Scrape multiple anime."""
        results = []

        for i, anime in enumerate(anime_list):
            self._log(f"[{i+1}/{len(anime_list)}] {anime['title']}")

            result = self.scrape_anime(anime["mal_id"], anime["title"], fetch_metadata)
            results.append(result)

            if i < len(anime_list) - 1:
                time.sleep(1)

        return results

    def format_for_database(self, scrape_result: dict) -> Optional[dict]:
        """
        Format scrape result for anime.json database.

        Returns a dict ready to be added to anime.json, or None if missing data.
        """
        if not scrape_result.get("metadata") or not scrape_result.get("episodes"):
            return None

        meta = scrape_result["metadata"]
        if meta.get("type") and meta.get("type") != "TV":
            return None

        entry = {
            "id": meta["id"],
            "title": meta["title"],
            "title_english": meta.get("title_english", ""),
            "title_japanese": meta.get("title_japanese", ""),
            "malId": scrape_result["mal_id"],
            "cover": meta["cover"],
            "type": meta.get("type", ""),
            "year": meta["year"],
            "season": meta["season"],
            "studio": meta["studio"],
            "source": meta["source"],
            "genres": meta["genres"],
            "themes": meta["themes"],
            "demographic": meta["demographic"],
            "episodes": scrape_result["episodes"]
        }

        if meta.get("trailer"):
            entry["trailer"] = meta["trailer"]

        # Include anilistId if available
        if meta.get("anilistId"):
            entry["anilistId"] = meta["anilistId"]

        return entry


def main():
    parser = argparse.ArgumentParser(
        description="Scrape episode poll scores and metadata from MyAnimeList"
    )

    parser.add_argument(
        "--anime-id",
        type=int,
        help="MAL anime ID to scrape"
    )

    parser.add_argument(
        "--title",
        type=str,
        help="Anime title (for output)"
    )

    parser.add_argument(
        "--batch",
        type=str,
        help="Path to JSON file with anime list [{mal_id, title}, ...]"
    )

    parser.add_argument(
        "--output",
        type=str,
        default="output/episode_scores.json",
        help="Output file path (default: output/episode_scores.json)"
    )

    parser.add_argument(
        "--no-metadata",
        action="store_true",
        help="Skip fetching metadata from Jikan API"
    )

    parser.add_argument(
        "--format-db",
        action="store_true",
        help="Format output for anime.json database"
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output"
    )

    args = parser.parse_args()

    if not args.anime_id and not args.batch:
        parser.error("Either --anime-id or --batch must be provided")

    if args.anime_id and not args.title:
        parser.error("--title is required when using --anime-id")

    scraper = MALScraper(verbose=args.verbose)
    fetch_metadata = not args.no_metadata

    if args.batch:
        with open(args.batch, "r", encoding="utf-8") as f:
            anime_list = json.load(f)
        results = scraper.scrape_batch(anime_list, fetch_metadata)
    else:
        results = [scraper.scrape_anime(args.anime_id, args.title, fetch_metadata)]

    # Format for database if requested
    if args.format_db:
        formatted = []
        for r in results:
            entry = scraper.format_for_database(r)
            if entry:
                formatted.append(entry)
            else:
                print(f"Warning: Could not format {r['title']} - missing data")
        results = formatted

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write results
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"Results written to {output_path}")

    # Summary
    if args.format_db:
        print(f"\nSummary:")
        print(f"  Anime ready for database: {len(results)}")
    else:
        total_episodes = sum(len(r.get("episodes", [])) for r in results)
        total_errors = sum(len(r.get("scrape_errors", [])) for r in results)
        with_metadata = sum(1 for r in results if r.get("metadata"))

        print(f"\nSummary:")
        print(f"  Anime scraped: {len(results)}")
        print(f"  With metadata: {with_metadata}")
        print(f"  Total episodes: {total_episodes}")
        print(f"  Errors: {total_errors}")


if __name__ == "__main__":
    main()
