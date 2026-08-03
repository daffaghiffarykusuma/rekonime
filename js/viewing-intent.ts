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
const VIEWING_INTENT_COMPLETE_ANNOUNCEMENT = 'Added to Watching now. Choose another viewing goal when you are ready.';
const getViewingIntentDefinition = (key: string) => VIEWING_INTENTS.find(intent => intent.key === key) || null;

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

const createViewingIntentRuntime = (options = {}) => {
  const session = createViewingIntentSession(options);
  const getActive = () => {
    const active = session.get();
    if (!active) return null;
    const definition = getViewingIntentDefinition(active.key);
    return definition ? { ...definition, activeAt: active.activeAt } : null;
  };

  return {
    getActive,
    getOptions: () => VIEWING_INTENTS,
    apply(key: string) {
      const active = session.set(key);
      return {
        changed: Boolean(active),
        active: active ? getActive() : null,
        effects: {
          collapseOptions: Boolean(active),
          renderViewingIntents: Boolean(active),
          renderRecommendationModes: Boolean(active),
          renderRecommendations: Boolean(active),
          announcement: ''
        }
      };
    },
    clear({ announce = false } = {}) {
      return {
        changed: session.clear(),
        active: null,
        effects: {
          collapseOptions: false,
          renderViewingIntents: true,
          renderRecommendationModes: true,
          renderRecommendations: true,
          announcement: announce ? VIEWING_INTENT_COMPLETE_ANNOUNCEMENT : ''
        }
      };
    }
  };
};

export {
  createViewingIntentRuntime
};
