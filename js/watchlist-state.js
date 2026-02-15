const WATCH_STATUS_VALUES = ['planned', 'watching', 'completed', 'dropped'];

const normalizeWatchStatus = (value, { fallback = 'planned' } = {}) => {
  const status = String(value || '').trim().toLowerCase();
  if (WATCH_STATUS_VALUES.includes(status)) {
    return status;
  }
  return fallback;
};

const normalizeWatchProgress = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

export {
  WATCH_STATUS_VALUES,
  normalizeWatchStatus,
  normalizeWatchProgress
};

