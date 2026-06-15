const VIEWING_INTENT_STORAGE_KEY = 'rekonime.viewingIntent';
const VIEWING_INTENT_TTL_MS = 4 * 60 * 60 * 1000;

const VIEWING_INTENTS = [
  {
    key: 'unwind',
    label: 'Help me unwind',
    description: 'Gentle, stable, low-friction viewing.'
  },
  {
    key: 'energy',
    label: 'Give me energy',
    description: 'Fast hooks and strong episode-to-episode momentum.'
  },
  {
    key: 'emotional',
    label: 'Make me feel something',
    description: 'Character investment and a meaningful payoff.'
  },
  {
    key: 'immersive',
    label: 'Pull me into another world',
    description: 'Atmosphere, discovery, and a world worth settling into.'
  },
  {
    key: 'surprise',
    label: 'Surprise me',
    description: 'A qualified pick outside the obvious choices.'
  }
];

const VIEWING_INTENT_KEYS = new Set(VIEWING_INTENTS.map(intent => intent.key));

const createViewingIntentSession = ({
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  now = () => Date.now()
} = {}) => {
  const read = () => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(VIEWING_INTENT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!VIEWING_INTENT_KEYS.has(parsed?.key) || !Number.isFinite(parsed?.activeAt)) {
        storage.removeItem(VIEWING_INTENT_STORAGE_KEY);
        return null;
      }
      if ((now() - parsed.activeAt) >= VIEWING_INTENT_TTL_MS) {
        storage.removeItem(VIEWING_INTENT_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  return {
    get() {
      const active = read();
      if (!active) return null;
      const refreshed = { ...active, activeAt: now() };
      try {
        storage?.setItem(VIEWING_INTENT_STORAGE_KEY, JSON.stringify(refreshed));
      } catch {
        // Session context remains optional when storage is unavailable.
      }
      return refreshed;
    },

    set(key: string) {
      if (!VIEWING_INTENT_KEYS.has(key)) return null;
      const active = { key, activeAt: now() };
      try {
        storage?.setItem(VIEWING_INTENT_STORAGE_KEY, JSON.stringify(active));
      } catch {
        return active;
      }
      return active;
    },

    clear() {
      const existed = Boolean(read());
      try {
        storage?.removeItem(VIEWING_INTENT_STORAGE_KEY);
      } catch {
        // No-op when storage is unavailable.
      }
      return existed;
    }
  };
};

export {
  VIEWING_INTENTS,
  VIEWING_INTENT_STORAGE_KEY,
  VIEWING_INTENT_TTL_MS,
  createViewingIntentSession
};
