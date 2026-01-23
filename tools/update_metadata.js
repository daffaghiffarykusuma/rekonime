const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'anime.json');
const SAVE_INTERVAL = 50;
const JIKAN_DELAY_MS = 1100;
const MAX_RETRIES = 5;

const args = process.argv.slice(2);
const KEEP_NON_TV = args.includes('--keep-non-tv');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'rekonime-metadata-update/1.0' }
      });

      if (res.ok) return await res.json();

      if (![429, 500, 502, 503, 504].includes(res.status) || attempt === MAX_RETRIES) {
        throw new Error(`HTTP ${res.status}`);
      }

      const retryAfter = res.headers.get('retry-after');
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : JIKAN_DELAY_MS * (attempt + 1);
      await sleep(waitMs);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(JIKAN_DELAY_MS * (attempt + 1));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

function getMalId(anime) {
  return anime?.mal_id ?? anime?.metadata?.malId ?? anime?.malId ?? anime?.metadata?.mal_id;
}

function hasKey(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function needsUpdate(meta) {
  if (!meta) return true;
  if (!meta.type) return true;
  if (!hasKey(meta, 'title_english')) return true;
  if (!hasKey(meta, 'title_japanese')) return true;
  return false;
}

(async () => {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const animeList = data.anime || [];
  const total = animeList.length;

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < animeList.length; i++) {
    const anime = animeList[i];
    const meta = anime.metadata || {};
    const malId = getMalId(anime);

    if (!malId) {
      failed += 1;
      continue;
    }

    if (!needsUpdate(meta)) {
      skipped += 1;
      continue;
    }

    try {
      const payload = await fetchJson(`https://api.jikan.moe/v4/anime/${malId}`);
      const item = payload?.data;
      if (item) {
        meta.type = item.type || meta.type || '';
        meta.title_english = item.title_english ?? '';
        meta.title_japanese = item.title_japanese ?? '';
        anime.metadata = meta;
        updated += 1;
      } else {
        failed += 1;
      }
    } catch (err) {
      failed += 1;
    }

    if ((updated + failed) % SAVE_INTERVAL === 0) {
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
      console.log(`Saved progress at ${i + 1}/${total}. Updated: ${updated}, Failed: ${failed}`);
    }

    await sleep(JIKAN_DELAY_MS);
  }

  const beforeCount = data.anime.length;
  if (!KEEP_NON_TV) {
    data.anime = data.anime.filter((anime) => {
      const type = String(anime?.metadata?.type || '').toLowerCase();
      return type === 'tv';
    });
  }
  const afterCount = data.anime.length;
  const removed = beforeCount - afterCount;

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');

  console.log('\nDone.');
  console.log(`Total: ${total}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  if (!KEEP_NON_TV) {
    console.log(`Removed non-TV: ${removed}`);
  }
})();
