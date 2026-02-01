class BuildError extends Error {
  constructor(message, details = {}, options = {}) {
    super(message);
    this.name = 'BuildError';
    this.details = details;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

class ValidationError extends BuildError {
  constructor(message, details = {}, options = {}) {
    super(message, details, options);
    this.name = 'ValidationError';
    this.severity = 'error';
  }
}

class DataIntegrityError extends BuildError {
  constructor(message, details = {}, options = {}) {
    super(message, details, options);
    this.name = 'DataIntegrityError';
    this.severity = 'error';
  }
}

class StatsCalculationError extends BuildError {
  constructor(message, details = {}, options = {}) {
    super(message, details, options);
    this.name = 'StatsCalculationError';
    this.severity = 'error';
  }
}

export {
  BuildError,
  ValidationError,
  DataIntegrityError,
  StatsCalculationError
};
