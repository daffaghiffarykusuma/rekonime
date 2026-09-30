// These are genre/theme suggestions, not measured emotional effects or viewing behavior.
const getExperienceSignals = (anime: any) => {
  const tags = new Set([...(anime?.genres || []), ...(anime?.themes || [])].map(tag => String(tag).toLowerCase()));
  const has = (...labels: string[]) => labels.some(label => tags.has(label.toLowerCase()));
  const dark = has('Horror', 'Gore', 'Psychological', 'Suspense');
  return {
    gentle: !dark && has('Iyashikei', 'Slice of Life'),
    energy: has('Action', 'Sports'),
    emotional: has('Drama', 'Romance', 'Music', 'Performing Arts'),
    immersive: has('Fantasy', 'Adventure', 'Sci-Fi', 'Isekai', 'Mythology', 'Space'),
    dark, complex: has('Psychological', 'Strategy Game', 'Time Travel')
  };
};
const getExperienceCues = (anime: any, intentKey = '') => {
  const signals = getExperienceSignals(anime);
  const candidates: Array<{ label: string; priority: number }> = [];
  const add = (condition: boolean, label: string, key: string, priority: number) => {
    if (condition) candidates.push({ label, priority: key === intentKey ? priority + 100 : priority });
  };
  add(signals.gentle, 'Slice of life / iyashikei', 'unwind', 80);
  add(signals.energy, 'Action / sports', 'energy', 70);
  add(signals.emotional, 'Drama / romance / music', 'emotional', 60);
  add(signals.immersive, 'World exploration', 'immersive', 65);
  add(signals.dark, 'Dark themes', '', 90);
  add(signals.complex, 'Complex themes', '', 75);
  return candidates.sort((a, b) => b.priority - a.priority).slice(0, 3).map(item => item.label);
};
export { getExperienceSignals, getExperienceCues };
