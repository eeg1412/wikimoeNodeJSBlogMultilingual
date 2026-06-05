const mongoose = require('mongoose')
const utils = require('../../../utils/utils')
const {
  ERROR_CODES,
  ApiError
} = require('../../../utils/multilingualAdminResponse')

const DEFAULT_TAG_PAGE = 1
const DEFAULT_TAG_SIZE = 100
const MAX_TAG_SIZE = 1000000

function getSourceRepository(collectionName) {
  const repository = global.$mongodDB?.source?.repositories?.[collectionName]
  if (!repository) {
    throw new Error(`source repository not found: ${collectionName}`)
  }

  return repository
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsePositiveInteger(value, defaultValue, maxValue) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultValue
  }
  if (maxValue && parsed > maxValue) {
    return maxValue
  }
  return parsed
}

/**
 * 读取源站分类并构建树形结构，供源文章导入筛选的分类选择器使用。
 * 源文章引用的是源站分类 id，因此分类数据必须取自源站数据库。
 * @returns {Promise<Array>} 树形分类列表
 */
async function getSourceSortList() {
  const sortsRepository = getSourceRepository('sorts')
  const list = await sortsRepository.find(
    {},
    '_id sortname alias taxis parent',
    {
      sort: { taxis: 1, _id: 1 },
      lean: true
    }
  )

  return utils.generateTreeData(list)
}

/**
 * 标准化源站标签筛选的 idList 参数为合法 ObjectId 数组。
 * @param {Array|string} rawIdList - 查询里的标签 id 集合
 * @returns {mongoose.Types.ObjectId[]} 合法标签 ObjectId 列表
 * @throws {ApiError} 存在非法标签 id 时抛出
 */
function normalizeTagIdList(rawIdList) {
  if (rawIdList === undefined || rawIdList === null || rawIdList === '') {
    return []
  }

  const rawList = Array.isArray(rawIdList) ? rawIdList : [rawIdList]
  const objectIdList = []

  rawList.forEach(rawId => {
    const tagId = String(rawId || '').trim()
    if (!tagId) {
      return
    }
    if (!mongoose.Types.ObjectId.isValid(tagId)) {
      throw new ApiError(
        ERROR_CODES.SOURCE_ID_INVALID,
        undefined,
        'idList',
        400
      )
    }
    objectIdList.push(new mongoose.Types.ObjectId(tagId))
  })

  return objectIdList
}

/**
 * 读取源站标签列表，支持关键词检索与按 id 集合回填，供源文章导入筛选的标签选择器使用。
 * @param {Object} query - 查询参数
 * @param {string} [query.keyword] - 标签名关键词
 * @param {Array|string} [query.idList] - 指定标签 id 集合
 * @param {number|string} [query.page] - 页码
 * @param {number|string} [query.size] - 每页数量
 * @returns {Promise<{ list: Array, total: number }>} 标签分页数据
 */
async function getSourceTagList(query = {}) {
  const tagsRepository = getSourceRepository('tags')
  const page = parsePositiveInteger(query.page, DEFAULT_TAG_PAGE)
  const size = parsePositiveInteger(query.size, DEFAULT_TAG_SIZE, MAX_TAG_SIZE)
  const params = {}

  if (query.keyword) {
    const keyword = String(query.keyword).trim()
    if (keyword) {
      params.tagname = new RegExp(escapeRegExp(keyword), 'i')
    }
  }

  const tagIdList = normalizeTagIdList(query.idList)
  if (tagIdList.length > 0) {
    params._id = { $in: tagIdList }
  }

  const total = await tagsRepository.countDocuments(params)
  const list = await tagsRepository
    .find(params, '_id tagname lastusetime', {
      sort: { lastusetime: -1, _id: -1 },
      lean: true
    })
    .skip((page - 1) * size)
    .limit(size)

  return {
    list,
    total
  }
}

module.exports = {
  getSourceSortList,
  getSourceTagList
}
