type SessionDismissal = { id: string; title: string };
type DiscoverySession = { activeAt: number; dismissed: SessionDismissal[] };

const DISCOVERY_SESSION_STORAGE_KEY = 'rekonime.discoverySession';
const DISCOVERY_SESSION_TTL_MS = 4 * 60 * 60 * 1000;

// Tracks recommendations skipped during this tab's session. Skips expire after
// four hours without activity and never touch saved taste or the Watchlist.
const createDiscoverySession = ({
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  now = () => Date.now()
} = {}) => {
  const read = (): DiscoverySession | null => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(DISCOVERY_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Number.isFinite(parsed?.activeAt) || (now() - parsed.activeAt) >= DISCOVERY_SESSION_TTL_MS) {
        storage.removeItem(DISCOVERY_SESSION_STORAGE_KEY);
        return null;
      }
      const dismissed = Array.isArray(parsed.dismissed)
        ? parsed.dismissed.filter((item: SessionDismissal | null) => typeof item?.id === 'string' && typeof item?.title === 'string')
        : [];
      return { activeAt: parsed.activeAt, dismissed };
    } catch {
      return null;
    }
  };

  const write = (session: DiscoverySession) => {
    if (!storage) return false;
    try {
      storage.setItem(DISCOVERY_SESSION_STORAGE_KEY, JSON.stringify(session));
      return true;
    } catch {
      return false;
    }
  };

  const getDismissed = () => read()?.dismissed.map(item => ({ ...item })) || [];

  return {
    getDismissed,

    recordActivity() {
      const active = read();
      if (active) write({ ...active, activeAt: now() });
    },

    dismiss({ id, title }: { id: string | number; title: string }) {
      if (id === null || id === undefined || !String(id) || !title) return { changed: false };
      const dismissed = getDismissed();
      const entry = { id: String(id), title: String(title) };
      if (dismissed.some(item => item.id === entry.id)) return { changed: false };
      return { changed: write({ dismissed: [...dismissed, entry], activeAt: now() }) };
    },

    restore(id: string | number) {
      const dismissed = getDismissed();
      if (!dismissed.some(item => item.id === String(id))) return { changed: false };
      return { changed: write({ dismissed: dismissed.filter(item => item.id !== String(id)), activeAt: now() }) };
    }
  };
};

export { createDiscoverySession };
