const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const isFiniteNumber = (value) => Number.isFinite(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const optional = (value, key, validate) => !hasOwn(value, key) || validate(value[key]);

const isStringArray = (value, maxItems) => (
  Array.isArray(value)
  && value.length <= maxItems
  && value.every(isNonEmptyString)
);

const isSnapshot = (value) => (
  isPlainObject(value)
  && isNonEmptyString(value.id)
  && isNonEmptyString(value.title)
  && isNonEmptyString(value.cover)
  && optional(value, 'year', year => year === null || typeof year === 'string' || isFiniteNumber(year))
  && optional(value, 'studio', studio => typeof studio === 'string')
);

const isWatchlistEntry = (value) => (
  isPlainObject(value)
  && isNonEmptyString(value.id)
  && ['planned', 'watching', 'completed', 'dropped'].includes(value.status)
  && Number.isInteger(value.progress)
  && isFiniteNumber(value.updatedAt)
  && optional(value, 'startedAt', isFiniteNumber)
  && optional(value, 'completedAt', isFiniteNumber)
  && optional(value, 'snapshot', isSnapshot)
);

const isBookmarkItem = (value) => (
  isPlainObject(value)
  && isNonEmptyString(value.id)
  && isNonEmptyString(value.title)
  && isNonEmptyString(value.cover)
);

const validators = {
  'rekonime.settings': value => (
    isPlainObject(value)
    && ['trailerAutoplay', 'dataSaver', 'reducedMotion', 'highContrast', 'largeText']
      .every(key => optional(value, key, setting => typeof setting === 'boolean'))
  ),
  'rekonime.bookmarks': value => (
    isStringArray(value, 1000)
    || (
      isPlainObject(value)
      && isStringArray(value.ids, 1000)
      && optional(value, 'version', Number.isInteger)
      && optional(value, 'items', items => (
        Array.isArray(items)
        && items.length <= 1000
        && items.every(isBookmarkItem)
      ))
    )
  ),
  'rekonime.watchlist': value => (
    isPlainObject(value)
    && Number.isInteger(value.version)
    && optional(value, 'updatedAt', isFiniteNumber)
    && Array.isArray(value.entries)
    && value.entries.length <= 5000
    && value.entries.every(isWatchlistEntry)
  ),
  'rekonime.recMode': isNonEmptyString,
  'rekonime.surpriseHistory': value => (
    Array.isArray(value)
    && value.length <= 40
    && value.every(entry => (
      isPlainObject(entry)
      && isNonEmptyString(entry.animeId)
      && isFiniteNumber(entry.timestamp)
    ))
  ),
  'rekonime:description:index': value => (
    Array.isArray(value)
    && value.length <= 200
    && value.every(entry => (
      isPlainObject(entry)
      && isNonEmptyString(entry.key)
      && isFiniteNumber(entry.lastAccess)
    ))
  ),
  'api.jikan.anime': value => isPlainObject(value) && isPlainObject(value.data),
  'api.jikan.reviews': value => (
    isPlainObject(value)
    && Array.isArray(value.data)
    && value.data.every(isPlainObject)
  ),
  'rekonime.theme': value => ['dark', 'light', 'auto'].includes(value),
  'rekonime.onboarding': value => ['completed', 'skipped'].includes(value),
  'rekonime.shortcutsAcknowledged': value => value === 'true',
  'rekonime.anime': value => (
    isPlainObject(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.cover)
  )
};

const SchemaValidator = {
  validate(key, value) {
    return validators[key]?.(value) ?? true;
  }
};

export { SchemaValidator };
