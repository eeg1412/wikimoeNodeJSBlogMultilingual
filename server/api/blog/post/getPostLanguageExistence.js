const mongoose = require('mongoose')
const log4js = require('log4js')
const userApiLog = log4js.getLogger('userApi')
const postUtils = require('../../../mongodb/utils/posts')
const utils = require('../../../utils/utils')
const {
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguageCode
} = require('../../../utils/language')
const languageSettingsService = require('../../multilingual-admin/services/languageSettingsService')

const SOURCE_POST_COLLECTION = 'posts'
const SOURCE_RECORD_KIND = 'source'
const TRANSLATION_RECORD_KIND = 'translation'

function buildEmptyExistenceMap() {
  const existenceMap = {}
  for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
    existenceMap[languageCode] = false
  }

  return existenceMap
}

async function getSourceArticleRecordList(sourceId) {
  return await postUtils.find(
    {
      sourceCollection: SOURCE_POST_COLLECTION,
      sourceId,
      $or: [
        {
          recordKind: SOURCE_RECORD_KIND
        },
        {
          recordKind: TRANSLATION_RECORD_KIND,
          status: 1
        }
      ]
    },
    undefined,
    '_id sourceId sourceLanguageCode languageCode translationGroupId sourceSnapshotId recordKind status alias'
  )
}

async function getEnabledLanguageCodeSet() {
  const enabledLanguageCodes =
    await languageSettingsService.getBlogEnabledLanguageCodes()
  const enabledLanguageCodeSet = new Set()
  for (const languageCode of enabledLanguageCodes) {
    enabledLanguageCodeSet.add(languageCode)
  }

  return enabledLanguageCodeSet
}

function getRecordIdText(value) {
  if (!value) {
    return ''
  }

  return String(value)
}

/**
 * 规范化文章别名；空别名保留为空字符串，让前端继续使用 id 生成 URL。
 * @param {any} value - 文章别名字段值。
 * @returns {string} 可直接返回给前端的别名文本。
 */
function getAliasText(value) {
  if (!value) {
    return ''
  }

  return String(value).trim()
}

/**
 * 构造语言切换需要的公开文章标识。
 * 源语言使用源站文章 id，译文语言使用译文记录 id，保持与各自 sitemap 一致。
 * @param {object} record - 多语言文章记录或源文章快照记录。
 * @param {boolean} shouldUseSourceIdAsId - 是否把源文章 id 作为当前语言公开 id。
 * @returns {{ id: string, alias: string, sourceId: string }} 语言文章标识信息。
 */
function buildLanguagePostInfo(record, shouldUseSourceIdAsId = false) {
  const sourceId = getRecordIdText(record.sourceId)
  let id = getRecordIdText(record._id)

  if (shouldUseSourceIdAsId) {
    id = sourceId
  }

  return {
    id,
    alias: getAliasText(record.alias),
    sourceId
  }
}

/**
 * 写入已经通过记录关系校验的语言文章信息。
 * 未开启语言或缺少可路由 id 的记录不会进入可用语言结果。
 * @param {object} existenceMap - 按语言记录文章是否可访问的布尔表。
 * @param {object} languagePostMap - 按语言记录文章 alias、id 和 sourceId 的映射。
 * @param {Set<string>} enabledLanguageCodeSet - 已开启博客语言集合。
 * @param {string} languageCode - 当前语言码。
 * @param {{ id: string, alias: string, sourceId: string }} postInfo - 当前语言文章标识信息。
 * @returns {void}
 */
function setLanguagePostInfo(
  existenceMap,
  languagePostMap,
  enabledLanguageCodeSet,
  languageCode,
  postInfo
) {
  if (!enabledLanguageCodeSet.has(languageCode)) {
    return
  }

  if (!postInfo.id || !postInfo.sourceId) {
    return
  }

  existenceMap[languageCode] = true
  languagePostMap[languageCode] = postInfo
}

function splitSourceArticleRecords(recordList) {
  const sourceSnapshotList = []
  const translationList = []

  for (const record of recordList) {
    if (record.recordKind === SOURCE_RECORD_KIND) {
      sourceSnapshotList.push(record)
      continue
    }

    if (record.recordKind === TRANSLATION_RECORD_KIND) {
      translationList.push(record)
    }
  }

  return {
    sourceSnapshotList,
    translationList
  }
}

function buildSourceSnapshotIdentitySet(sourceSnapshotList) {
  const sourceSnapshotIdSet = new Set()
  const translationGroupIdSet = new Set()

  for (const sourceSnapshot of sourceSnapshotList) {
    const sourceSnapshotId = getRecordIdText(sourceSnapshot._id)
    if (sourceSnapshotId) {
      sourceSnapshotIdSet.add(sourceSnapshotId)
    }

    const translationGroupId = getRecordIdText(
      sourceSnapshot.translationGroupId
    )
    if (translationGroupId) {
      translationGroupIdSet.add(translationGroupId)
    }
  }

  return {
    sourceSnapshotIdSet,
    translationGroupIdSet
  }
}

module.exports = async function (req, res) {
  const sourceId = String(req.query.sourceId || req.query.id || '').trim()
  if (!utils.isObjectId(sourceId)) {
    res.status(400).json({
      errors: [
        {
          message: 'sourceId参数错误'
        }
      ]
    })
    return
  }

  const existenceMap = buildEmptyExistenceMap()
  // 只记录发布状态、语言开启且具备公开路由标识的语言文章。
  const languagePostMap = {}
  const sourceObjectId = new mongoose.Types.ObjectId(sourceId)

  try {
    const [enabledLanguageCodeSet, sourceArticleRecordList] = await Promise.all(
      [getEnabledLanguageCodeSet(), getSourceArticleRecordList(sourceObjectId)]
    )
    const { sourceSnapshotList, translationList } = splitSourceArticleRecords(
      sourceArticleRecordList
    )
    if (sourceSnapshotList.length === 0) {
      res.status(404).json({
        errors: [
          {
            message: '源文章快照不存在'
          }
        ]
      })
      return
    }

    const { sourceSnapshotIdSet, translationGroupIdSet } =
      buildSourceSnapshotIdentitySet(sourceSnapshotList)
    let sourceLanguageCode = null
    for (const sourceSnapshot of sourceSnapshotList) {
      const currentSourceLanguageCode = normalizeLanguageCode(
        sourceSnapshot.sourceLanguageCode
      )
      if (!currentSourceLanguageCode) {
        res.status(400).json({
          errors: [
            {
              message: '源文章快照语言不支持'
            }
          ]
        })
        return
      }

      if (!sourceLanguageCode) {
        sourceLanguageCode = currentSourceLanguageCode
      }

      if (sourceLanguageCode !== currentSourceLanguageCode) {
        res.status(400).json({
          errors: [
            {
              message: '源文章快照语言不一致'
            }
          ]
        })
        return
      }

      if (sourceSnapshot.status === 1) {
        const sourcePostInfo = buildLanguagePostInfo(sourceSnapshot, true)
        setLanguagePostInfo(
          existenceMap,
          languagePostMap,
          enabledLanguageCodeSet,
          currentSourceLanguageCode,
          sourcePostInfo
        )
      }
    }

    for (const translation of translationList) {
      const sourceSnapshotId = getRecordIdText(translation.sourceSnapshotId)
      if (!sourceSnapshotIdSet.has(sourceSnapshotId)) {
        continue
      }

      const translationGroupId = getRecordIdText(translation.translationGroupId)
      if (!translationGroupIdSet.has(translationGroupId)) {
        continue
      }

      const languageCode = normalizeLanguageCode(translation.languageCode)
      if (!languageCode) {
        continue
      }

      const translationPostInfo = buildLanguagePostInfo(translation)
      setLanguagePostInfo(
        existenceMap,
        languagePostMap,
        enabledLanguageCodeSet,
        languageCode,
        translationPostInfo
      )
    }

    res.send({
      sourceLanguageCode,
      existenceMap,
      languagePostMap
    })
  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: '文章语言存在状态获取失败'
        }
      ]
    })
    userApiLog.error(`post language existence get fail, ${logErrorToText(err)}`)
  }
}
