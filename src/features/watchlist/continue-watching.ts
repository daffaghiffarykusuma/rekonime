import { CatalogPayload } from '../catalog/catalog-payload.ts';
const buildContinueWatchingModel = (entries: any[], animeData: any[] = []) => {
  const catalog = new Map(animeData.map(anime => [anime.id, anime]));
  return entries.filter(entry => entry.status === 'watching')
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3).map(entry => {
      const anime = catalog.get(entry.id) || entry.snapshot || {};
      const total = CatalogPayload.getEpisodeCount(anime);
      const episodeCount = Number.isSafeInteger(total) && total > 0 ? total : null;
      return { id: entry.id, title: anime.title || 'Saved title', progress: entry.progress,
        episodeCount, complete: Boolean(episodeCount && entry.progress >= episodeCount) };
    });
};
export { buildContinueWatchingModel };
