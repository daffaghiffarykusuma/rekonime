export const createStats = (overrides = {}) => ({
  retentionScore: 85,
  churnRisk: { score: 15, label: 'Low', factors: [] },
  threeEpisodeHook: 90,
  worthFinishing: 80,
  flowState: 75,
  stressSpikes: 1,
  comfortScore: 72,
  ...overrides
});

export const createAnime = (overrides = {}) => ({
  id: 'test-anime-1',
  title: 'Test Anime',
  titleEnglish: 'Test Anime English',
  titleJapanese: 'Test Anime Japanese',
  malId: 12345,
  anilistId: 999,
  cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
  type: 'TV',
  year: 2024,
  season: 'Spring',
  studio: 'Test Studio',
  source: 'Manga',
  demographic: 'Shounen',
  genres: ['Action', 'Adventure'],
  themes: ['Fantasy'],
  communityScore: 8.5,
  synopsis: 'A test anime synopsis.',
  episodes: [
    { episode: 1, score: 4.5 },
    { episode: 2, score: 4.0 },
    { episode: 3, score: 4.5 }
  ],
  stats: createStats(),
  ...overrides
});
