"""
Convert MAL XML Export to anime_list.json for scraping

Usage:
    python convert_mal_export.py <xml_file> [options]

Options:
    --status <status>       Filter by status (Completed, Watching, etc.)
    --type <type>           Filter by type (TV, Movie, OVA, etc.)
    --min-episodes <n>      Minimum episode count
    --output <path>         Output file path (default: anime_list.json)
    --limit <n>             Limit number of anime to export
    --exclude-existing      Exclude anime already in the database (anime.json)
    --database <path>       Path to anime.json database (default: ../../data/anime.json)
"""

import argparse
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path


def parse_mal_export(xml_path: str) -> list[dict]:
    """Parse MAL XML export file."""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    anime_list = []

    for anime in root.findall("anime"):
        mal_id_elem = anime.find("series_animedb_id")
        title_elem = anime.find("series_title")
        type_elem = anime.find("series_type")
        episodes_elem = anime.find("series_episodes")
        status_elem = anime.find("my_status")
        score_elem = anime.find("my_score")

        if mal_id_elem is None or title_elem is None:
            continue

        anime_list.append({
            "mal_id": int(mal_id_elem.text),
            "title": title_elem.text,
            "type": type_elem.text if type_elem is not None else "Unknown",
            "episodes": int(episodes_elem.text) if episodes_elem is not None and episodes_elem.text else 0,
            "status": status_elem.text if status_elem is not None else "Unknown",
            "score": int(score_elem.text) if score_elem is not None and score_elem.text and score_elem.text != "0" else None
        })

    return anime_list


def filter_anime(
    anime_list: list[dict],
    status: str = None,
    anime_type: str = None,
    min_episodes: int = None
) -> list[dict]:
    """Filter anime list by criteria."""
    filtered = anime_list

    if status:
        filtered = [a for a in filtered if a["status"] == status]

    if anime_type:
        filtered = [a for a in filtered if a["type"] == anime_type]

    if min_episodes:
        filtered = [a for a in filtered if a["episodes"] >= min_episodes]

    return filtered


def main():
    parser = argparse.ArgumentParser(
        description="Convert MAL XML export to anime_list.json"
    )

    parser.add_argument(
        "xml_file",
        help="Path to MAL XML export file"
    )

    parser.add_argument(
        "--status",
        choices=["Completed", "Watching", "On-Hold", "Dropped", "Plan to Watch"],
        help="Filter by watch status"
    )

    parser.add_argument(
        "--type",
        dest="anime_type",
        choices=["TV", "Movie", "OVA", "ONA", "Special", "Music"],
        help="Filter by anime type"
    )

    parser.add_argument(
        "--min-episodes",
        type=int,
        help="Minimum episode count"
    )

    parser.add_argument(
        "--output",
        default="anime_list.json",
        help="Output file path (default: anime_list.json)"
    )

    parser.add_argument(
        "--limit",
        type=int,
        help="Limit number of anime to export"
    )

    parser.add_argument(
        "--exclude-existing",
        action="store_true",
        help="Exclude anime already in the database (anime.json)"
    )

    parser.add_argument(
        "--database",
        default="../../data/anime.json",
        help="Path to anime.json database (default: ../../data/anime.json)"
    )

    args = parser.parse_args()

    # Parse XML
    print(f"Parsing: {args.xml_file}")
    anime_list = parse_mal_export(args.xml_file)
    print(f"Found {len(anime_list)} anime in export")

    # Filter
    filtered = filter_anime(
        anime_list,
        status=args.status,
        anime_type=args.anime_type,
        min_episodes=args.min_episodes
    )

    print(f"After filtering: {len(filtered)} anime")

    # Exclude existing anime from database
    if args.exclude_existing:
        db_path = Path(__file__).parent / args.database
        if db_path.exists():
            with open(db_path, "r", encoding="utf-8") as f:
                database = json.load(f)

            # Get all MAL IDs from database
            existing_mal_ids = set()
            for anime in database.get("anime", []):
                if anime.get("malId"):
                    existing_mal_ids.add(anime["malId"])

            before_count = len(filtered)
            filtered = [a for a in filtered if a["mal_id"] not in existing_mal_ids]
            excluded_count = before_count - len(filtered)

            print(f"Excluded {excluded_count} anime already in database")
            print(f"Remaining: {len(filtered)} new anime to scrape")
        else:
            print(f"Warning: Database not found at {db_path}")
            print("Skipping --exclude-existing filter")

    # Apply limit
    if args.limit:
        filtered = filtered[:args.limit]
        print(f"Limited to: {len(filtered)} anime")

    # Convert to scraper format
    output = [
        {"mal_id": a["mal_id"], "title": a["title"]}
        for a in filtered
    ]

    # Write output
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nWritten to: {args.output}")
    print(f"\nSample entries:")
    for entry in output[:5]:
        print(f"  - {entry['title']} (MAL ID: {entry['mal_id']})")

    if len(output) > 5:
        print(f"  ... and {len(output) - 5} more")

    # Warning about scraping time
    est_time = len(output) * 6  # ~6 seconds per anime (Jikan + AniList + MAL scraping)
    if est_time > 60:
        print(f"\nNote: Scraping {len(output)} anime will take approximately {est_time // 60} minutes")
        print("Consider using --limit to test with fewer anime first")


if __name__ == "__main__":
    main()
