const defaultGates = {
  // Keep schema/integrity error ratio low enough to block degraded releases.
  maxErrorPercentage: 5,
  // Catch accidental truncation or malformed episode imports.
  minAverageEpisodes: 8,
  // Catch duplicated/merged feeds that inflate episode counts unexpectedly.
  maxAverageEpisodes: 30,
  // Ensure score profile is based on a representative corpus.
  minSampleSize: 1000
};

const round2 = (value) => Math.round(value * 100) / 100;

const summarizeIssues = (issues = []) => {
  const errors = issues.filter(issue => issue.severity === 'error');
  const warnings = issues.filter(issue => issue.severity !== 'error');
  const errorAnime = new Set(errors.map(issue => issue.animeId).filter(Boolean));
  const warningAnime = new Set(warnings.map(issue => issue.animeId).filter(Boolean));
  return {
    errorCount: errors.length,
    warningCount: warnings.length,
    animeWithErrors: errorAnime.size,
    animeWithWarnings: warningAnime.size
  };
};

const buildQualityReport = ({
  anime = [],
  validation = { errors: [], warnings: [] },
  integrityIssues = [],
  scoreProfile = null,
  durationMs = 0
} = {}) => {
  const totalAnime = anime.length;
  const totalEpisodes = anime.reduce((sum, item) => {
    const count = Array.isArray(item?.episodes) ? item.episodes.length : 0;
    return sum + count;
  }, 0);
  const averageEpisodesPerAnime = totalAnime ? round2(totalEpisodes / totalAnime) : 0;

  const validationIssues = [
    ...(validation.errors || []),
    ...(validation.warnings || [])
  ];
  const integritySummary = summarizeIssues(integrityIssues);
  const validationSummary = summarizeIssues(validationIssues);

  return {
    buildId: new Date().toISOString(),
    duration: Math.round(durationMs),
    stats: {
      totalAnime,
      totalEpisodes,
      averageEpisodesPerAnime,
      animeWithErrors: validationSummary.animeWithErrors,
      animeWithWarnings: validationSummary.animeWithWarnings
    },
    validation: {
      schemaErrors: validation.errors?.length || 0,
      schemaWarnings: validation.warnings?.length || 0,
      integrityIssues: integrityIssues.length,
      warnings: validation.warnings?.slice(0, 10) || []
    },
    integrity: {
      errorCount: integritySummary.errorCount,
      warningCount: integritySummary.warningCount
    },
    statsProfile: scoreProfile || null
  };
};

const runQualityGates = (report, { gates = defaultGates, strict = false } = {}) => {
  const results = [];
  const errorPercentage = report.stats.totalAnime
    ? (report.stats.animeWithErrors / report.stats.totalAnime) * 100
    : 0;

  if (errorPercentage > gates.maxErrorPercentage) {
    results.push({
      name: 'maxErrorPercentage',
      passed: false,
      message: `Error percentage ${errorPercentage.toFixed(1)}% exceeds ${gates.maxErrorPercentage}%`
    });
  }

  if (report.stats.averageEpisodesPerAnime && report.stats.averageEpisodesPerAnime < gates.minAverageEpisodes) {
    results.push({
      name: 'minAverageEpisodes',
      passed: false,
      message: `Average episodes ${report.stats.averageEpisodesPerAnime} below minimum ${gates.minAverageEpisodes}`
    });
  }

  if (report.stats.averageEpisodesPerAnime && report.stats.averageEpisodesPerAnime > gates.maxAverageEpisodes) {
    results.push({
      name: 'maxAverageEpisodes',
      passed: false,
      message: `Average episodes ${report.stats.averageEpisodesPerAnime} above maximum ${gates.maxAverageEpisodes}`
    });
  }

  if (report.statsProfile && Number.isFinite(report.statsProfile.sampleSize) && report.statsProfile.sampleSize < gates.minSampleSize) {
    results.push({
      name: 'minSampleSize',
      passed: false,
      message: `Sample size ${report.statsProfile.sampleSize} below minimum ${gates.minSampleSize}`
    });
  }

  if (strict && results.length) {
    return results.map(result => ({ ...result, severity: 'error' }));
  }

  return results.map(result => ({ ...result, severity: 'warning' }));
};

export { buildQualityReport, runQualityGates, defaultGates };
