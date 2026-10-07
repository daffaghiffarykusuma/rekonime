type SessionDismissal = { id: string; title: string };
type DiscoverySession = { key: string | null; activeAt: number; dismissed: SessionDismissal[] };

const VIEWING_INTENT_STORAGE_KEY = 'rekonime.viewingIntent';
const VIEWING_INTENT_TTL_MS = 4 * 60 * 60 * 1000;

const VIEWING_INTENTS = [
  {
    key: 'unwind',
    label: 'Help me unwind',
    description: 'Slice-of-life and iyashikei suggestions.'
  },
  {
    key: 'energy',
    label: 'Give me energy',
    description: 'Action and sports suggestions.'
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
    description: 'A general discovery pick.'
  }
];

const VIEWING_INTENT_KEYS = new Set(VIEWING_INTENTS.map(intent => intent.key));
const VIEWING_INTENT_COMPLETE_ANNOUNCEMENT = 'Added to Watching now. Choose another viewing goal when you are ready.';
const getViewingIntentDefinition = (key: string) => VIEWING_INTENTS.find(intent => intent.key === key) || null;

const createViewingIntentSession = ({
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  now = () => Date.now()
} = {}) => {
  const read = (): DiscoverySession | null => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(VIEWING_INTENT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if ((parsed?.key !== null && !VIEWING_INTENT_KEYS.has(parsed?.key)) || !Number.isFinite(parsed?.activeAt)) {
        storage.removeItem(VIEWING_INTENT_STORAGE_KEY);
        return null;
      }
      if ((now() - parsed.activeAt) >= VIEWING_INTENT_TTL_MS) {
        storage.removeItem(VIEWING_INTENT_STORAGE_KEY);
        return null;
      }
      return { ...parsed, dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed.filter((item: SessionDismissal | null) => typeof item?.id === 'string' && typeof item?.title === 'string') : [] };
    } catch {
      return null;
    }
  };

  return {
    get(refresh = true) {
      const active = read();
      if (!active) return null;
      if (!refresh) return active;
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
      const active = { key, dismissed: read()?.dismissed || [], activeAt: now() };
      try {
        storage?.setItem(VIEWING_INTENT_STORAGE_KEY, JSON.stringify(active));
      } catch {
        return active;
      }
      return active;
    },

    dismiss({ id, title }: { id: string | number; title: string }) {
      if (id === null || id === undefined || !String(id) || !title) return { changed: false };
      const active = read() || { key: null, dismissed: [] };
      const entry = { id: String(id), title: String(title) };
      if (active.dismissed.some(item => item.id === entry.id)) return { changed: false };
      try {
        if (!storage) return { changed: false };
        storage.setItem(VIEWING_INTENT_STORAGE_KEY, JSON.stringify({ ...active, dismissed: [...active.dismissed, entry], activeAt: now() }));
        return { changed: true };
      } catch {
        return { changed: false };
      }
    },

    restore(id: string | number) {
      const active = read();
      if (!active?.dismissed.some(item => item.id === String(id))) return { changed: false };
      try {
        storage?.setItem(VIEWING_INTENT_STORAGE_KEY, JSON.stringify({ ...active, dismissed: active.dismissed.filter(item => item.id !== String(id)), activeAt: now() }));
        return { changed: true };
      } catch {
        return { changed: false };
      }
    },

    clear() {
      const active = read();
      const existed = Boolean(active?.key);
      try {
        if (active?.dismissed.length) storage?.setItem(VIEWING_INTENT_STORAGE_KEY, JSON.stringify({ ...active, key: null, activeAt: now() }));
        else storage?.removeItem(VIEWING_INTENT_STORAGE_KEY);
      } catch {
        // No-op when storage is unavailable.
      }
      return existed;
    }
  };
};

const createViewingIntentRuntime = (options = {}) => {
  const session = createViewingIntentSession(options);
  const getActive = ({ recordActivity = true } = {}) => {
    const active = session.get(recordActivity);
    if (!active) return null;
    const definition = active.key ? getViewingIntentDefinition(active.key) : null;
    return definition ? { ...definition, activeAt: active.activeAt } : null;
  };

  return {
    getActive,
    getDismissed: () => session.get(false)?.dismissed.map(item => ({ ...item })) || [],
    dismiss: (anime: { id: string | number; title: string }) => session.dismiss(anime),
    restore: (id: string | number) => session.restore(id),
    recordActivity: () => { session.get(); },
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
