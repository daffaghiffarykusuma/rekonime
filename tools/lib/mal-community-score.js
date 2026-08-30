const HEADERS = {
  'User-Agent': 'rekonime-refresh-scores/1.0',
  Accept: 'application/json'
};

export const parseMalCommunityScore = (html) => {
  const raw = html.match(/itemprop=["']ratingValue["'][^>]*>\s*([0-9]+(?:\.[0-9]+)?)\s*</i)?.[1];
  const score = Number(raw);
  return Number.isFinite(score) ? score : null;
};

export const fetchCommunityScore = async (malId, request) => {
  try {
    const response = await request(`https://api.jikan.moe/v4/anime/${malId}`, { headers: HEADERS });
    const score = Number((await response.json())?.data?.score);
    return Number.isFinite(score) ? score : null;
  } catch {
    const response = await request(`https://myanimelist.net/anime/${malId}`, { headers: HEADERS });
    return parseMalCommunityScore(await response.text());
  }
};
