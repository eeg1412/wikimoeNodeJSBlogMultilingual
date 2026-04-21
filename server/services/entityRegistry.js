const { TRANSLATION_STATUS } = require('../../common/constants')

function hasTextValue(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function genericRelatedEntityMapper(source) {
  return {
    title: source.title || source.name || '',
    summary: source.summary || source.subtitle || '',
    description: source.description || source.desc || '',
    status: typeof source.status === 'number' ? source.status : 1,
    payload: source
  }
}

const ENTITY_REGISTRY = {
  author: {
    keywordFields: ['nickname', 'description'],
    modelName: 'authors',
    translatableFields: ['nickname', 'description'],
    mapSource(source, context = {}) {
      return {
        nickname: source.nickname || '',
        description: source.description || '',
        photoAttachment: context.photoAttachmentId || null,
        coverAttachment: context.coverAttachmentId || null
      }
    }
  },
  attachment: {
    keywordFields: ['name', 'filename', 'description', 'sourcePath', 'externalUrl', 'filepath'],
    modelName: 'attachments',
    translatableFields: ['name', 'description']
  },
  bangumi: {
    keywordFields: ['title', 'summary', 'description'],
    mapSource: genericRelatedEntityMapper,
    modelName: 'bangumis',
    translatableFields: ['title', 'summary', 'description']
  },
  book: {
    keywordFields: ['title', 'summary', 'description'],
    mapSource: genericRelatedEntityMapper,
    modelName: 'books',
    translatableFields: ['title', 'summary', 'description']
  },
  event: {
    keywordFields: ['title', 'summary', 'description'],
    mapSource: genericRelatedEntityMapper,
    modelName: 'events',
    translatableFields: ['title', 'summary', 'description']
  },
  game: {
    keywordFields: ['title', 'summary', 'description'],
    mapSource: genericRelatedEntityMapper,
    modelName: 'games',
    translatableFields: ['title', 'summary', 'description']
  },
  mappoint: {
    keywordFields: ['title', 'summary'],
    modelName: 'mappoints',
    translatableFields: ['title', 'summary'],
    mapSource(source) {
      return {
        title: source.title || '',
        summary: source.summary || '',
        longitude: source.longitude || 0,
        latitude: source.latitude || 0,
        zIndex: source.zIndex || 0,
        status: typeof source.status === 'number' ? source.status : 1
      }
    }
  },
  movie: {
    keywordFields: ['title', 'summary', 'description'],
    mapSource: genericRelatedEntityMapper,
    modelName: 'movies',
    translatableFields: ['title', 'summary', 'description']
  },
  post: {
    keywordFields: ['title', 'excerpt', 'alias', 'sourceId', 'groupSourceId'],
    modelName: 'posts',
    translatableFields: ['title', 'excerpt', 'content', 'alias']
  },
  sort: {
    keywordFields: ['sortname', 'alias', 'description'],
    modelName: 'sorts',
    translatableFields: ['sortname', 'alias', 'description', 'template'],
    mapSource(source) {
      return {
        sortname: source.sortname || '',
        alias: source.alias || '',
        description: source.description || '',
        template: source.template || '',
        taxis: source.taxis || 0,
        parentSourceId: source.parent?._id || source.parentSourceId || null
      }
    }
  },
  tag: {
    keywordFields: ['tagname'],
    modelName: 'tags',
    translatableFields: ['tagname'],
    mapSource(source) {
      return {
        tagname: source.tagname || '',
        lastusetime: source.lastusetime || new Date()
      }
    }
  },
  vote: {
    keywordFields: ['title'],
    modelName: 'votes',
    translatableFields: ['title'],
    mapSource(source) {
      return {
        title: source.title || '',
        status: typeof source.status === 'number' ? source.status : 1,
        maxSelect: source.maxSelect || 1,
        showResultAfter:
          typeof source.showResultAfter === 'boolean'
            ? source.showResultAfter
            : true,
        endTime: source.endTime || null,
        options: Array.isArray(source.options)
          ? source.options.map(option => ({
              sourceOptionId: option._id ? String(option._id) : '',
              title: option.title || ''
            }))
          : [],
        payload: source
      }
    }
  }
}

function getEntityConfig(entityType) {
  const config = ENTITY_REGISTRY[entityType]
  if (!config) {
    throw new Error(`Unsupported entity type: ${entityType}`)
  }
  return config
}

function getEntityInitialTranslationStatus(entityType, payload) {
  const config = getEntityConfig(entityType)
  const fields = config.translatableFields || []
  return fields.some(field => hasTextValue(payload[field]))
    ? TRANSLATION_STATUS.PENDING
    : TRANSLATION_STATUS.NOT_REQUIRED
}

function getEntityRouteKeys() {
  return Object.keys(ENTITY_REGISTRY).filter(item => item !== 'post')
}

module.exports = {
  getEntityConfig,
  getEntityInitialTranslationStatus,
  getEntityRouteKeys
}