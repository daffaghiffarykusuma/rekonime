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
      anyOf: [
        {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          maxItems: 1000
        },
        {
          type: 'object',
          required: ['ids'],
          properties: {
            version: { type: 'integer' },
            ids: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              maxItems: 1000
            },
            items: {
              type: 'array',
              maxItems: 1000,
              items: {
                type: 'object',
                required: ['id', 'title', 'cover'],
                properties: {
                  id: { type: 'string', minLength: 1 },
                  title: { type: 'string', minLength: 1 },
                  cover: { type: 'string', minLength: 1 }
                },
                additionalProperties: true
              }
            }
          },
          additionalProperties: true
        }
      ]
    });

    this.register('rekonime.watchlist', {
      type: 'object',
      required: ['version', 'entries'],
      properties: {
        version: { type: 'integer' },
        updatedAt: { type: 'number' },
        entries: {
          type: 'array',
          maxItems: 5000,
          items: {
            type: 'object',
            required: ['id', 'status', 'progress', 'updatedAt'],
            properties: {
              id: { type: 'string', minLength: 1 },
              status: { type: 'string', enum: ['planned', 'watching', 'completed', 'dropped'] },
              progress: { type: 'integer' },
              updatedAt: { type: 'number' },
              startedAt: { type: 'number' },
              completedAt: { type: 'number' },
              snapshot: {
                type: 'object',
                required: ['id', 'title', 'cover'],
                properties: {
                  id: { type: 'string', minLength: 1 },
                  title: { type: 'string', minLength: 1 },
                  cover: { type: 'string', minLength: 1 },
                  year: { type: ['string', 'number', 'null'] },
                  studio: { type: 'string' }
                },
                additionalProperties: true
              }
            },
            additionalProperties: true
          }
        }
      },
      additionalProperties: true
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

    this.register('rekonime.shortcutsAcknowledged', {
      type: 'string',
      enum: ['true']
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

    if (schema.enum && !schema.enum.includes(value)) return false;

    const types = this.normalizeTypes(schema.type);
    if (types.length > 0) {
      return types.some((type) => this.validateTypedSchema(type, schema, value));
    }

    return true;
  },

  normalizeTypes(type) {
    if (Array.isArray(type)) {
      return type.filter((entry) => typeof entry === 'string' && entry.length > 0);
    }
    if (typeof type === 'string' && type.length > 0) {
      return [type];
    }
    return [];
  },

  validateTypedSchema(type, schema, value) {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') return false;
        if (schema.minLength && value.length < schema.minLength) return false;
        return true;
      case 'boolean':
        return typeof value === 'boolean';
      case 'number':
        return Number.isFinite(value);
      case 'integer':
        return Number.isInteger(value);
      case 'null':
        return value === null;
      case 'array':
        return this.validateArray(schema, value);
      case 'object':
        return this.validateObject(schema, value);
      default:
        return true;
    }
  },

  validateArray(schema, value) {
    if (!Array.isArray(value)) return false;
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

    return true;
  },

  isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
};

SchemaValidator.registerDefaults();

export { SchemaValidator };
