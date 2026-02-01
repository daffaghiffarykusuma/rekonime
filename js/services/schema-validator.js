const SchemaValidator = {
  defaultsRegistered: false,
  schemas: new Map(),

  register(key, schema) {
    if (!key || !schema) return;
    this.schemas.set(key, schema);
  },

  registerDefaults() {
    if (this.defaultsRegistered) return;
    this.defaultsRegistered = true;

    this.register('rekonime.settings', {
      type: 'object',
      properties: {
        trailerAutoplay: { type: 'boolean' },
        dataSaver: { type: 'boolean' },
        reducedMotion: { type: 'boolean' },
        highContrast: { type: 'boolean' },
        largeText: { type: 'boolean' }
      },
      additionalProperties: true
    });

    this.register('rekonime.bookmarks', {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      maxItems: 1000
    });

    this.register('rekonime.recMode', {
      type: 'string',
      minLength: 1
    });

    this.register('rekonime.surpriseHistory', {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        required: ['animeId', 'timestamp'],
        properties: {
          animeId: { type: 'string', minLength: 1 },
          timestamp: { type: 'number' }
        },
        additionalProperties: true
      }
    });

    this.register('rekonime:description:index', {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        required: ['key', 'lastAccess'],
        properties: {
          key: { type: 'string', minLength: 1 },
          lastAccess: { type: 'number' }
        },
        additionalProperties: true
      }
    });

    this.register('api.jikan.anime', {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'object',
          additionalProperties: true
        }
      },
      additionalProperties: true
    });

    this.register('api.jikan.reviews', {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true
          }
        }
      },
      additionalProperties: true
    });

    this.register('rekonime.theme', {
      type: 'string',
      enum: ['dark', 'light', 'auto']
    });

    this.register('rekonime.onboarding', {
      type: 'string',
      enum: ['completed', 'skipped']
    });

    this.register('rekonime.tourStep', {
      type: 'string',
      pattern: '^\\d+$'
    });

    this.register('rekonime.shortcutsAcknowledged', {
      type: 'string',
      enum: ['true']
    });

    this.register('rekonime.analyticsQueue', {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        required: ['name', 'params'],
        properties: {
          name: { type: 'string', minLength: 1 },
          params: { type: 'object', additionalProperties: true },
          queuedAt: { type: 'string', minLength: 1 }
        },
        additionalProperties: true
      }
    });

    this.register('rekonime.logs', {
      type: 'array',
      maxItems: 200,
      items: {
        type: 'object',
        required: ['timestamp', 'level', 'message'],
        properties: {
          timestamp: { type: 'string', minLength: 1 },
          level: { type: 'string', minLength: 1 },
          message: { type: 'string', minLength: 1 },
          context: { type: 'object', additionalProperties: true }
        },
        additionalProperties: true
      }
    });

    this.register('rekonime.anime', {
      type: 'object',
      required: ['id', 'title', 'cover'],
      properties: {
        id: { type: 'string', minLength: 1 },
        title: { type: 'string', minLength: 1 },
        cover: { type: 'string', minLength: 1 }
      },
      additionalProperties: true
    });
  },

  validate(key, value) {
    const schema = this.schemas.get(key);
    if (!schema) return true;
    return this.validateSchema(schema, value);
  },

  validateSchema(schema, value) {
    if (!schema || typeof schema !== 'object') return true;

    if (Array.isArray(schema.anyOf)) {
      return schema.anyOf.some((option) => this.validateSchema(option, value));
    }

    if (Array.isArray(schema.oneOf)) {
      let matches = 0;
      schema.oneOf.forEach((option) => {
        if (this.validateSchema(option, value)) matches += 1;
      });
      return matches === 1;
    }

    if (schema.enum && !schema.enum.includes(value)) return false;

    if (schema.type) {
      switch (schema.type) {
        case 'string':
          if (typeof value !== 'string') return false;
          if (schema.minLength && value.length < schema.minLength) return false;
          if (schema.maxLength && value.length > schema.maxLength) return false;
          if (schema.pattern) {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(value)) return false;
          }
          return true;
        case 'boolean':
          return typeof value === 'boolean';
        case 'number':
          return Number.isFinite(value);
        case 'integer':
          return Number.isInteger(value);
        case 'array':
          return this.validateArray(schema, value);
        case 'object':
          return this.validateObject(schema, value);
        default:
          return true;
      }
    }

    return true;
  },

  validateArray(schema, value) {
    if (!Array.isArray(value)) return false;
    if (schema.minItems && value.length < schema.minItems) return false;
    if (schema.maxItems && value.length > schema.maxItems) return false;
    if (schema.items) {
      for (const item of value) {
        if (!this.validateSchema(schema.items, item)) return false;
      }
    }
    return true;
  },

  validateObject(schema, value) {
    if (!this.isPlainObject(value)) return false;

    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
    }

    if (schema.properties) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        if (!this.validateSchema(propertySchema, value[key])) return false;
      }
    }

    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) return false;
      }
    }

    return true;
  },

  isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
};

SchemaValidator.registerDefaults();

export { SchemaValidator };
export default SchemaValidator;
