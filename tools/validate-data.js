const fs = require("fs");
const path = require("path");

const DEFAULT_DATA_PATH = path.join(__dirname, "..", "data", "anime.json");
const DEFAULT_INDEX_PATH = path.join(__dirname, "..", "index.html");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseEmbeddedData(indexPath) {
  const html = fs.readFileSync(indexPath, "utf8");
  const match = html.match(/const ANIME_DATA = (\{.*?\});/s);
  if (!match) return null;
  return JSON.parse(match[1]);
}

function sanitizeTrailerUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("youtube.com") && !host.includes("youtu.be")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function sanitizeTrailerEmbedUrl(rawUrl) {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("youtube.com") && !host.includes("youtube-nocookie.com")) return "";
    parsed.searchParams.delete("autoplay");
    return parsed.toString();
  } catch {
    return "";
  }
}

function buildTrailerUrls(trailer) {
  if (!trailer || typeof trailer !== "object") {
    return { url: "", embedUrl: "" };
  }

  const id = trailer.id;
  let url = trailer.url || "";
  let embedUrl = trailer.embedUrl || trailer.embed_url || "";

  if (!url && id) {
    url = `https://www.youtube.com/watch?v=${id}`;
  }

  if (!embedUrl && id) {
    embedUrl = `https://www.youtube.com/embed/${id}`;
  }

  return {
    url: sanitizeTrailerUrl(url),
    embedUrl: sanitizeTrailerEmbedUrl(embedUrl),
  };
}

function normalizeId(anime) {
  const meta = anime.metadata || {};
  return meta.id || anime.id || "";
}

function normalizeTitle(anime) {
  const meta = anime.metadata || {};
  return meta.title || anime.title || "";
}

function normalizeScore(anime) {
  const meta = anime.metadata || {};
  if (Object.prototype.hasOwnProperty.call(meta, "score")) return meta.score;
  return anime.score;
}

function normalizeAniListId(anime) {
  const meta = anime.metadata || {};
  if (Object.prototype.hasOwnProperty.call(meta, "anilistId")) return meta.anilistId;
  return anime.anilistId;
}

function normalizeTrailer(anime) {
  const meta = anime.metadata || {};
  return meta.trailer || anime.trailer || null;
}

function validateList(animeList, label) {
  const errors = {
    missingId: [],
    missingTitle: [],
    missingCover: [],
    missingScore: [],
    missingTrailer: [],
    invalidTrailer: [],
    invalidEpisodeScore: [],
    missingEpisodeScore: [],
    missingEpisodeNumber: [],
    duplicateIds: [],
  };

  const warnings = {
    missingYear: [],
    missingSeason: [],
    missingStudio: [],
    missingSource: [],
    missingAnilistId: [],
    missingEpisodes: [],
  };

  const idMap = new Map();

  animeList.forEach((anime, index) => {
    const meta = anime.metadata || {};
    const id = normalizeId(anime);
    const title = normalizeTitle(anime);
    const cover = meta.cover || anime.cover;
    const year = meta.year || anime.year;
    const season = meta.season || anime.season;
    const studio = meta.studio || anime.studio;
    const source = meta.source || anime.source;
    const score = normalizeScore(anime);
    const anilistId = normalizeAniListId(anime);
    const trailer = normalizeTrailer(anime);
    const episodes = anime.episodes || [];

    if (!id) {
      errors.missingId.push(index + 1);
    } else if (idMap.has(id)) {
      errors.duplicateIds.push(id);
    } else {
      idMap.set(id, true);
    }

    if (!title) errors.missingTitle.push(id || index + 1);
    if (!cover) errors.missingCover.push(id || index + 1);
    if (!Number.isFinite(Number(score))) errors.missingScore.push(id || index + 1);

    if (!year) warnings.missingYear.push(id || index + 1);
    if (!season) warnings.missingSeason.push(id || index + 1);
    if (!studio) warnings.missingStudio.push(id || index + 1);
    if (!source) warnings.missingSource.push(id || index + 1);
    if (!anilistId) warnings.missingAnilistId.push(id || index + 1);

    if (!Array.isArray(episodes) || episodes.length === 0) {
      warnings.missingEpisodes.push(id || index + 1);
    } else {
      episodes.forEach((ep) => {
        if (!ep || typeof ep !== "object") return;
        if (ep.episode === undefined || ep.episode === null) {
          errors.missingEpisodeNumber.push(id || index + 1);
        }
        if (ep.score === undefined || ep.score === null) {
          errors.missingEpisodeScore.push(id || index + 1);
        } else if (!Number.isFinite(Number(ep.score)) || ep.score < 1 || ep.score > 5) {
          errors.invalidEpisodeScore.push(id || index + 1);
        }
      });
    }

    if (!trailer) {
      errors.missingTrailer.push(id || index + 1);
    } else {
      const { url, embedUrl } = buildTrailerUrls(trailer);
      if (!url && !embedUrl) {
        errors.missingTrailer.push(id || index + 1);
      } else if (!url || !embedUrl) {
        errors.invalidTrailer.push(id || index + 1);
      }
    }
  });

  function summarize(title, groups) {
    const lines = [];
    Object.entries(groups).forEach(([key, values]) => {
      if (!values.length) return;
      lines.push(`  ${key}: ${values.length}`);
    });
    if (!lines.length) {
      lines.push("  none");
    }
    return [`${title}:`, ...lines].join("\n");
  }

  const hasErrors = Object.values(errors).some((values) => values.length > 0);

  console.log(`Validation results (${label})`);
  console.log(summarize("Errors", errors));
  console.log(summarize("Warnings", warnings));
  console.log("");

  return { hasErrors, errors, warnings };
}

function main() {
  const args = process.argv.slice(2);
  const dataPath = args.includes("--data")
    ? args[args.indexOf("--data") + 1]
    : DEFAULT_DATA_PATH;
  const indexPath = args.includes("--index")
    ? args[args.indexOf("--index") + 1]
    : DEFAULT_INDEX_PATH;
  const skipEmbedded = args.includes("--skip-embedded");

  const data = readJson(dataPath);
  const results = [];

  results.push(
    validateList(data.anime || [], path.relative(process.cwd(), dataPath))
  );

  if (!skipEmbedded) {
    const embedded = parseEmbeddedData(indexPath);
    if (embedded && embedded.anime) {
      results.push(
        validateList(embedded.anime, path.relative(process.cwd(), indexPath))
      );
    } else {
      console.log(`Validation results (${path.relative(process.cwd(), indexPath)})`);
      console.log("Errors:");
      console.log("  missingEmbeddedData: 1");
      console.log("Warnings:");
      console.log("  none\n");
      results.push({ hasErrors: true });
    }
  }

  const hasErrors = results.some((r) => r.hasErrors);
  if (hasErrors) {
    process.exitCode = 1;
  }
}

main();
