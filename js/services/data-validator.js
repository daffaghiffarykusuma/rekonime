import { AnalyticsService } from './analytics-service.js';
import { Logger } from './logger.js';
import { SchemaValidator } from './schema-validator.js';

/**
 * Runtime data validation for catalog payloads.
 */
const DataValidator = {
  config: {
    sampleSize: 20,
    maxInvalidRatio: 0.05
  },

  validateAnime(anime) {
    const errors = [];
    if (!SchemaValidator.validate('rekonime.anime', anime)) {
      errors.push('anime schema invalid');
    }
    if (!anime?.id) errors.push('missing id');
    if (!anime?.title) errors.push('missing title');
    if (!anime?.cover) errors.push('missing cover');
    return errors;
  },

  validateCatalog(animeList, context = {}) {
    if (!Array.isArray(animeList)) {
      this.reportIssue('catalog_not_array', { ...context, valueType: typeof animeList });
      return {
        total: 0,
        checked: 0,
        invalid: 0,
        valid: 0,
        invalidRatio: 1,
        errors: ['catalog_not_array']
      };
    }

    const total = animeList.length;
    const sampleSize = Math.min(this.config.sampleSize, total);
    const errors = [];
    let invalid = 0;

    for (let i = 0; i < sampleSize; i += 1) {
      const anime = animeList[i];
      const animeErrors = this.validateAnime(anime);
      if (animeErrors.length > 0) {
        invalid += 1;
        errors.push({ index: i, errors: animeErrors });
      }
    }

    const invalidRatio = sampleSize ? invalid / sampleSize : 0;
    const stats = {
      total,
      checked: sampleSize,
      invalid,
      valid: sampleSize - invalid,
      invalidRatio,
      errors
    };

    if (invalidRatio > this.config.maxInvalidRatio) {
      this.reportIssue('catalog_invalid_ratio', { ...context, invalidRatio, total, checked: sampleSize });
    }

    if (errors.length) {
      this.reportIssue('catalog_validation_errors', { ...context, errors: errors.slice(0, 5) });
    }

    return stats;
  },

  reportIssue(type, context = {}) {
    if (Logger?.warn) {
      Logger.warn('Data validation issue', { type, ...context });
    }
    if (AnalyticsService?.track) {
      AnalyticsService.track('data_validation_issue', { issue_type: type, ...context });
    }
  }
};

export { DataValidator };
export default DataValidator;
