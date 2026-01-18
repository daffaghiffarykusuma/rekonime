/**
 * Merge scraped episode scores into anime.json
 *
 * Usage:
 *   node tools/merge-scores.js [options]
 *
 * Options:
 *   --input <path>   Path to scraped scores JSON (default: tools/scraper/output/episode_scores.json)
 *   --output <path>  Path to anime.json (default: data/anime.json)
 *   --dry-run        Preview changes without writing
 *   --add-new        Add new anime if not found (requires manual id)
 */

const fs = require("fs");
const path = require("path");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  input: "tools/scraper/output/episode_scores.json",
  output: "data/anime.json",
  dryRun: args.includes("--dry-run"),
  addNew: args.includes("--add-new"),
};

// Parse named arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input" && args[i + 1]) {
    options.input = args[++i];
  } else if (args[i] === "--output" && args[i + 1]) {
    options.output = args[++i];
  }
}

// Resolve paths relative to project root
const projectRoot = path.join(__dirname, "..");
const inputPath = path.join(projectRoot, options.input);
const outputPath = path.join(projectRoot, options.output);

console.log("Merge Episode Scores Tool");
console.log("=========================\n");

// Check if input file exists
if (!fs.existsSync(inputPath)) {
  console.error(`Error: Input file not found: ${inputPath}`);
  console.error("\nRun the scraper first:");
  console.error("  cd tools/scraper");
  console.error('  python mal_scraper.py --anime-id <id> --title "<title>" -v');
  process.exit(1);
}

// Check if output file exists
if (!fs.existsSync(outputPath)) {
  console.error(`Error: Output file not found: ${outputPath}`);
  process.exit(1);
}

// Load files
console.log(`Input:  ${options.input}`);
console.log(`Output: ${options.output}`);
console.log(`Mode:   ${options.dryRun ? "Dry run (no changes)" : "Live"}\n`);

const scrapedData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
const animeData = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

// Statistics
const stats = {
  matched: 0,
  updated: 0,
  added: 0,
  skipped: 0,
  errors: [],
};

/**
 * Find matching anime by MAL ID or title
 */
function findMatchingAnime(scraped, animeList) {
  // First try to match by MAL ID if we have it in the data
  const byMalId = animeList.find((a) => a.malId === scraped.mal_id);
  if (byMalId) return byMalId;

  // Try to match by title (fuzzy)
  const normalizedTitle = scraped.title.toLowerCase().trim();
  const byTitle = animeList.find((a) => {
    const animeTitle = a.title.toLowerCase().trim();
    return (
      animeTitle === normalizedTitle ||
      animeTitle.includes(normalizedTitle) ||
      normalizedTitle.includes(animeTitle)
    );
  });

  return byTitle;
}

/**
 * Convert scraped episodes to our format
 */
function convertEpisodes(scrapedEpisodes) {
  return scrapedEpisodes.map((ep) => ({
    episode: ep.episode,
    score: ep.score,
  }));
}

/**
 * Check if episodes have changed
 */
function episodesChanged(existing, newEpisodes) {
  if (existing.length !== newEpisodes.length) return true;

  for (let i = 0; i < existing.length; i++) {
    if (
      existing[i].episode !== newEpisodes[i].episode ||
      existing[i].score !== newEpisodes[i].score
    ) {
      return true;
    }
  }

  return false;
}

// Process each scraped anime
console.log("Processing scraped data...\n");

for (const scraped of scrapedData) {
  console.log(`[${scraped.title}]`);

  // Skip if no episodes scraped
  if (!scraped.episodes || scraped.episodes.length === 0) {
    console.log("  Skipped: No episodes scraped");
    stats.skipped++;

    if (scraped.scrape_errors && scraped.scrape_errors.length > 0) {
      console.log(`  Errors: ${scraped.scrape_errors.join(", ")}`);
      stats.errors.push({
        title: scraped.title,
        errors: scraped.scrape_errors,
      });
    }
    continue;
  }

  // Find matching anime in our data
  const match = findMatchingAnime(scraped, animeData.anime);

  if (match) {
    stats.matched++;

    const newEpisodes = convertEpisodes(scraped.episodes);
    const hasChanges = episodesChanged(match.episodes, newEpisodes);

    if (hasChanges) {
      console.log(`  Matched: ${match.id}`);
      console.log(
        `  Episodes: ${match.episodes.length} -> ${newEpisodes.length}`
      );

      if (!options.dryRun) {
        // Add MAL ID if not present
        if (!match.malId) {
          match.malId = scraped.mal_id;
        }
        match.episodes = newEpisodes;
      }

      stats.updated++;
      console.log("  Status: Updated");
    } else {
      console.log("  Status: No changes needed");
    }
  } else {
    console.log("  Status: No match found in anime.json");

    if (options.addNew) {
      console.log("  Note: Use --add-new with manual ID to add new entries");
    }

    stats.skipped++;
  }

  console.log("");
}

// Write updated data
if (!options.dryRun && stats.updated > 0) {
  fs.writeFileSync(outputPath, JSON.stringify(animeData, null, 2) + "\n");
  console.log(`Written to: ${outputPath}\n`);
}

// Summary
console.log("Summary");
console.log("=======");
console.log(`Matched:  ${stats.matched}`);
console.log(`Updated:  ${stats.updated}`);
console.log(`Skipped:  ${stats.skipped}`);

if (stats.errors.length > 0) {
  console.log(`\nErrors (${stats.errors.length}):`);
  for (const err of stats.errors) {
    console.log(`  - ${err.title}: ${err.errors.join(", ")}`);
  }
}

if (options.dryRun) {
  console.log("\n[Dry run - no files modified]");
}
