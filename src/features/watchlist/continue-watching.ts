import { resolveEpisodeTotal } from './watchlist-lifecycle-runtime.ts';
const buildContinueWatchingModel = (entries: any[], animeData: any[] = []) => {
  const catalog = new Map(animeData.map(anime => [anime.id, anime]));
  return entries.filter(entry => entry.status === 'watching')
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3).map(entry => {
      const catalogAnime = catalog.get(entry.id);
      const anime = catalogAnime || entry.snapshot || {};
      // Same total rule the Watchlist Lifecycle Runtime uses when the button is pressed.
      const episodeCount = resolveEpisodeTotal(catalogAnime, entry.snapshot);
      return { id: entry.id, title: anime.title || 'Saved title', progress: entry.progress,
        episodeCount, complete: Boolean(episodeCount && entry.progress >= episodeCount) };
    });
};
export { buildContinueWatchingModel };
