// Recommendation prerequisites come from catalog watch-order metadata, never title guesses.
const prepareDiscoveryCandidates = (animeList: any[], watchlistEntries: any[] = []) => {
  const completed = new Set(watchlistEntries.filter(entry => entry.status === 'completed').map(entry => entry.id));
  return animeList.filter(anime => {
    const franchise = anime.franchise;
    if (!franchise?.entryAnimeId || !Array.isArray(franchise.items)) return true;
    if (anime.id === franchise.entryAnimeId) return true;
    const item = franchise.items.find((item: any) => item.animeId === anime.id);
    if (!item) return false;
    // Unknown branch prerequisites stay conservative; side stories use their recorded anchor.
    if (item.bucket !== 'main') return Boolean(item.anchorAnimeId && completed.has(item.anchorAnimeId));
    if (!Number.isFinite(item.mainOrder)) return false;
    const previous = franchise.items.filter((prior: any) => prior.bucket === 'main' && prior.mainOrder < item.mainOrder);
    return previous.length > 0 && previous.every((prior: any) => prior.animeId && completed.has(prior.animeId));
  }).map(anime => ({ ...anime, franchiseReason: anime.franchise?.entryAnimeId === anime.id
    ? 'A starting point for this series' : anime.franchise?.entryAnimeId && Array.isArray(anime.franchise.items) ? 'Follows your completed series entries' : '' }));
};

export { prepareDiscoveryCandidates };
