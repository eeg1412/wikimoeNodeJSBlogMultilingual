const {
  entityOptionListSchema
} = require('../../common/validation/entityOption')
const authorsUtils = require('../mongodb/utils/authors')
const mappointsUtils = require('../mongodb/utils/mappoints')
const sortsUtils = require('../mongodb/utils/sorts')
const tagsUtils = require('../mongodb/utils/tags')

const ENTITY_CONFIG = {
  authors: {
    utils: authorsUtils,
    displayField: 'nickname'
  },
  sorts: {
    utils: sortsUtils,
    displayField: 'sortname'
  },
  tags: {
    utils: tagsUtils,
    displayField: 'tagname'
  },
  mappoints: {
    utils: mappointsUtils,
    displayField: 'title'
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function listEntityOptions(query) {
  const validatedQuery = await entityOptionListSchema.validateAsync(
    query || {},
    {
      abortEarly: false,
      stripUnknown: true
    }
  )
  const config = ENTITY_CONFIG[validatedQuery.type]
  const filters = {
    languageCode: validatedQuery.languageCode
  }

  if (validatedQuery.keyword) {
    filters[config.displayField] = new RegExp(
      escapeRegExp(validatedQuery.keyword),
      'i'
    )
  }

  const list = await config.utils.find(filters, null, {
    sort: {
      updatedAt: -1,
      _id: -1
    },
    lean: true
  })

  return list.map(function (item) {
    return {
      _id: String(item._id),
      label: item[config.displayField] || '',
      description: item.description || item.summary || '',
      raw: item
    }
  })
}

module.exports = {
  listEntityOptions
}
