# MAL Episode Score & Metadata Scraper

Scrapes episode poll scores from MyAnimeList episode list pages and fetches full anime metadata from the **Jikan API** (free MAL API) and **AniList API**.

## Features

- **Episode Scores**: Poll averages (1-5 scale) from MAL episode pages
- **Full Metadata**: Title, English/Japanese titles, type, cover image, year, season, studio, source, genres, themes, demographic
- **AniList ID Lookup**: Automatically fetches AniList ID for each anime (used for reviews/descriptions)
- **Trailers**: YouTube trailer links from AniList with Jikan fallback, verified for embeddability
- **Database-Ready Output**: Use `--format-db` to get output matching `anime.json` format
- **TV-only Output**: Non-TV entries are skipped to keep retention metrics consistent

## Prerequisites

- Python 3.9+
- pip

## Installation

```bash
cd tools/scraper
pip install -r requirements.txt
```

## Usage

### Single Anime (with metadata)

```bash
# Scrape BanG Dream! 2nd Season with full metadata
python mal_scraper.py --anime-id 37869 --title "BanG Dream! 2nd Season" --format-db -v
```

Output:
```json
{
  "id": "bang-dream-2nd-season",
  "title": "BanG Dream! 2nd Season",
  "malId": 37869,
  "anilistId": 101633,
  "cover": "https://cdn.myanimelist.net/images/anime/1967/108632l.jpg",
  "year": 2019,
  "season": "Winter",
  "studio": "SANZIGEN",
  "source": "Mixed media",
  "genres": [],
  "themes": ["CGDCT", "Music", "School"],
  "demographic": "",
  "episodes": [
    { "episode": 1, "score": 4.1 },
    { "episode": 2, "score": 4.5 },
    ...
  ]
}
```

### Batch Scraping (Full Database)

```bash
# 1. Convert MAL export to anime_list.json
python convert_mal_export.py "../../animelist.xml" --status Completed --type TV --min-episodes 6

# 2. Scrape with metadata, formatted for database
python mal_scraper.py --batch anime_list.json --format-db -v --output output/anime_database.json
```

### Add Trailers to Existing Database

```bash
# Update data/anime.json with YouTube trailers (AniList first, Jikan fallback)
python add_trailers.py --input ../../data/anime.json
```

Trailers that are blocked from embedding are automatically replaced using YouTube search.

### Options

| Option | Description |
|--------|-------------|
| `--anime-id` | MAL anime ID to scrape |
| `--title` | Anime title (required with --anime-id) |
| `--batch` | Path to JSON file with anime list |
| `--output` | Output file path (default: output/episode_scores.json) |
| `--format-db` | Format output for anime.json database |
| `--no-metadata` | Skip fetching metadata from Jikan API |
| `-v, --verbose` | Enable verbose output |

## Data Sources

| Data | Source | Rate Limit |
|------|--------|------------|
| Episode scores | MAL episode pages (scraping) | 2 sec/request |
| Metadata | Jikan API | 3 req/sec |
| AniList ID | AniList GraphQL API | 90 req/min |

## Rate Limiting & Time Estimates

The scraper respects MAL, Jikan, and AniList rate limits:
- ~5-6 seconds per anime (4 requests: Jikan + AniList + MAL main + MAL episodes)

**Estimated time:**
- 10 anime ≈ 1 minute
- 100 anime ≈ 10-12 minutes
- 269 anime ≈ 25-30 minutes

## Adding to anime.json

After scraping with `--format-db`, the output is ready to be added to your database:

```javascript
// In anime.json
{
  "anime": [
    // ... existing entries ...
    // Paste scraped entries here
  ]
}
```

Or use the merge tool:
```bash
node ../merge-scores.js
```

## Troubleshooting

### Jikan API rate limited
- The scraper automatically waits 5 seconds and retries
- If issues persist, increase `JIKAN_DELAY` in the code

### AniList ID not found
- Some anime may not exist on AniList or have different MAL ID mappings
- The entry will still be created, but without `anilistId`
- You can manually add `anilistId` later if needed

### Missing metadata fields
- Some anime don't have genres/themes/demographic on MAL
- Empty arrays/strings are normal

### Episode scores not found
- Some anime (movies, specials, very old shows) don't have episode polls
- Short anime (<6 episodes) may have no poll data
