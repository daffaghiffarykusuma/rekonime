const placeholderTimestamp = '<generated-at>';

const representativeCatalogInput = () => {
  const episodesAlpha = Array.from({ length: 12 }, (_, index) => ({
    episode: index + 1,
    score: 4.4 - ((index + 1) * 0.03)
  }));
  const episodesBeta = Array.from({ length: 10 }, (_, index) => ({
    episode: index + 1,
    score: 4.0 + ((index + 1) * 0.02)
  }));
  return {
    anime: [
      {
        id: 'alpha',
        malId: 101,
        anilistId: 201,
        title: 'Alpha',
        titleEnglish: 'Alpha',
        titleJapanese: 'アルファ',
        cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
        type: 'TV',
        year: 2024,
        season: 'Spring',
        studio: 'Studio A',
        source: 'Manga',
        score: 8.1,
        genres: ['Action', 'Adventure'],
        themes: ['School'],
        demographic: 'Shounen',
        trailer: {
          id: 'abc123',
          url: 'https://www.youtube.com/watch?v=abc123',
          embedUrl: 'https://www.youtube.com/embed/abc123'
        },
        episodes: episodesAlpha
      },
      {
        id: 'beta',
        malId: 102,
        anilistId: 202,
        title: 'Beta',
        cover: 'https://cdn.myanimelist.net/images/anime/2/2.jpg',
        type: 'TV',
        year: 2023,
        season: 'Fall',
        studio: 'Studio B',
        source: 'Original',
        score: 7.7,
        genres: ['Drama'],
        themes: ['Music'],
        trailer: {
          id: 'def456',
          url: 'https://youtu.be/def456',
          embedUrl: 'https://www.youtube.com/embed/def456'
        },
        episodes: episodesBeta
      }
    ]
  };
};

const validationPayload = () => ({
  generatedAt: '2026-01-01T00:00:00.000Z',
  scoreProfile: { p35: 4.05, p50: 4.12, p65: 4.2, sampleSize: 2000, source: 'fixture' },
  anime: [
    {
      id: 'alpha',
      title: 'Alpha',
      cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
      year: 2024,
      season: 'Spring',
      studio: 'Studio A',
      source: 'Manga',
      score: 8.1,
      anilistId: 201,
      genres: ['Action'],
      themes: ['School'],
      episodes: [{ episode: 1, score: 4.2 }],
      trailer: {
        id: 'abc123',
        url: 'https://www.youtube.com/watch?v=abc123',
        embedUrl: 'https://www.youtube.com/embed/abc123'
      },
      stats: { retentionScore: 80 }
    }
  ]
});

const trailerPolicyVectors = () => [
  {
    name: 'trusted watch and embed URLs',
    trailer: {
      id: 'abc123',
      url: 'https://www.youtube.com/watch?v=abc123',
      embedUrl: 'https://www.youtube.com/embed/abc123'
    },
    valid: true
  },
  {
    name: 'evil youtube subdomain lookalike',
    trailer: {
      id: 'bad',
      url: 'https://youtube.com.evil.example/watch?v=bad',
      embedUrl: 'https://youtube.com.evil.example/embed/bad'
    },
    valid: false
  }
];

const contractManifest = () => ({
  version: 1,
  generatedBy: 'tools/pipeline_parity_contract.py',
  adapters: [
    'tools/pipeline_parity_contract.py',
    'tools/pipeline-parity-contract.js'
  ],
  normalizations: [
    'generatedAt fields use <generated-at>',
    'quality report buildId uses <generated-at>',
    'quality report duration uses 0',
    'temporary fixture paths use <fixture-workdir>'
  ],
  fixtures: [
    'catalog-input.json',
    'catalog-full.json',
    'catalog-preview.json',
    'embedded-data.js',
    'quality-report.json',
    'validation-success.txt',
    'validation-failure.txt'
  ]
});

export {
  contractManifest,
  placeholderTimestamp,
  representativeCatalogInput,
  trailerPolicyVectors,
  validationPayload
};
