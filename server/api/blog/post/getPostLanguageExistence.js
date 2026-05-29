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

/**
 * 为所有支持语言预先补齐默认值，避免前端判断缺失字段。
 * @returns {Record<string, boolean>} 默认全部为 false 的语言存在表。
 */
function buildEmptyExistenceMap() {
  const existenceMap = {}

  // 逐个写入支持语言，确保响应结构稳定。
  for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
    existenceMap[languageCode] = false
  }

  return existenceMap
}

/**
 * 读取同一源文章关联的全部有效记录。
 * 这里只取两类数据：
 * 1. 源文章快照记录，用来确认源语言和翻译归属关系。
 * 2. 已发布的翻译记录，用来判断目标语言是否可访问。
 * @param {mongoose.Types.ObjectId} sourceId - 源站文章 id。
 * @returns {Promise<object[]>} 多语言文章记录列表。
 */
async function getSourceArticleRecordList(sourceId) {
  return await postUtils.find(
    {
      // 限定为文章集合，避免命中其他源集合的多语言记录。
      sourceCollection: SOURCE_POST_COLLECTION,
      sourceId,
      $or: [
        {
          // 源文章快照始终需要返回，用于校验翻译关系。
          recordKind: SOURCE_RECORD_KIND
        },
        {
          // 翻译记录只统计已发布内容，未发布内容不能参与语言切换。
          recordKind: TRANSLATION_RECORD_KIND,
          status: 1
        }
      ]
    },
    undefined,
    '_id sourceId sourceLanguageCode languageCode translationGroupId sourceSnapshotId recordKind status alias'
  )
}

/**
 * 获取源站文章仓库，统一从全局连接对象读取。
 * @returns {object} 源站文章仓库实例。
 */
function getSourcePostRepository() {
  return global.$mongodDB.source.repositories.posts
}

/**
 * 查询源站文章当前是否处于发布状态。
 * 如果源站文章本身未发布，就返回 null，让前端知道源文章不可访问。
 * @param {mongoose.Types.ObjectId} sourceId - 源站文章 id。
 * @returns {Promise<object|null>} 源文章公开信息或 null。
 */
async function getSourceArticleStatus(sourceId) {
  const sourceArticle = await getSourcePostRepository().findOne(
    {
      // 只接受已发布的源文章，未发布文章不应暴露为可切换目标。
      _id: sourceId,
      status: 1
    },
    'status _id alias',
    {
      lean: true
    }
  )

  // 没有查到记录时直接返回 null，交给响应体原样表达状态。
  if (!sourceArticle) {
    return null
  }

  return sourceArticle
}

/**
 * 把后台启用的博客语言转换成 Set，便于后续高频判断。
 * @returns {Promise<Set<string>>} 已启用语言集合。
 */
async function getEnabledLanguageCodeSet() {
  const enabledLanguageCodes =
    await languageSettingsService.getBlogEnabledLanguageCodes()
  const enabledLanguageCodeSet = new Set()

  // 逐个写入 Set，后续可用 O(1) 查询语言是否启用。
  for (const languageCode of enabledLanguageCodes) {
    enabledLanguageCodeSet.add(languageCode)
  }

  return enabledLanguageCodeSet
}

/**
 * 统一把记录 id 类字段转成字符串，避免 ObjectId 和字符串混用。
 * @param {any} value - 任意记录 id 值。
 * @returns {string} 可比较的字符串 id；空值返回空字符串。
 */
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
  // 统一保留源文章 id，前端切换语言时需要知道同一篇文章的源归属。
  const sourceId = getRecordIdText(record.sourceId)

  // 默认公开 id 使用当前记录自身 id，适用于翻译记录。
  let id = getRecordIdText(record._id)

  // 源语言页面路由使用源站文章 id，保持与源站文章 URL 规则一致。
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
  // 未启用的语言即使存在记录，也不能出现在前端切换列表里。
  if (!enabledLanguageCodeSet.has(languageCode)) {
    return
  }

  // 缺少公开 id 或源文章 id 的记录无法正确路由，直接忽略。
  if (!postInfo.id || !postInfo.sourceId) {
    return
  }

  // 通过校验后同步写入存在状态和对应文章标识信息。
  existenceMap[languageCode] = true
  languagePostMap[languageCode] = postInfo
}

/**
 * 把混合记录拆成源快照和翻译记录两类，方便后续分别处理。
 * @param {object[]} recordList - 数据库返回的混合记录列表。
 * @returns {{ sourceSnapshotList: object[], translationList: object[] }} 拆分后的结果。
 */
function splitSourceArticleRecords(recordList) {
  const sourceSnapshotList = []
  const translationList = []

  for (const record of recordList) {
    // 源记录单独保存，稍后需要用它校验源语言和翻译归属。
    if (record.recordKind === SOURCE_RECORD_KIND) {
      sourceSnapshotList.push(record)
      continue
    }

    // 翻译记录放入另一组，稍后统一校验后再写入结果。
    if (record.recordKind === TRANSLATION_RECORD_KIND) {
      translationList.push(record)
    }
  }

  return {
    sourceSnapshotList,
    translationList
  }
}

/**
 * 提取源快照中的关键关系标识，用于过滤掉挂错源快照或翻译组的脏数据。
 * @param {object[]} sourceSnapshotList - 源文章快照列表。
 * @returns {{ sourceSnapshotIdSet: Set<string>, translationGroupIdSet: Set<string> }} 源快照身份集合。
 */
function buildSourceSnapshotIdentitySet(sourceSnapshotList) {
  const sourceSnapshotIdSet = new Set()
  const translationGroupIdSet = new Set()

  for (const sourceSnapshot of sourceSnapshotList) {
    // 收集源快照自身 id，翻译记录必须指向这些快照之一才算合法。
    const sourceSnapshotId = getRecordIdText(sourceSnapshot._id)
    if (sourceSnapshotId) {
      sourceSnapshotIdSet.add(sourceSnapshotId)
    }

    // 同时收集翻译组 id，确保翻译记录属于同一组文章。
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
  // 兼容两种传参方式，最后统一裁剪成无空白的字符串。
  const sourceId = String(req.query.sourceId || req.query.id || '').trim()

  // 请求参数不是合法 ObjectId 时，立即返回 400，避免继续查询数据库。
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

  // 先构造完整的语言存在表，默认所有语言都不可访问。
  const existenceMap = buildEmptyExistenceMap()
  // 只记录发布状态、语言开启且具备公开路由标识的语言文章。
  const languagePostMap = {}

  // 后续数据库查询需要 ObjectId 类型，这里统一转换一次。
  const sourceObjectId = new mongoose.Types.ObjectId(sourceId)

  try {
    // 并行读取启用语言、关联记录和源文章发布状态，减少接口等待时间。
    const [
      enabledLanguageCodeSet,
      sourceArticleRecordList,
      sourceLanguageData
    ] = await Promise.all([
      getEnabledLanguageCodeSet(),
      getSourceArticleRecordList(sourceObjectId),
      getSourceArticleStatus(sourceObjectId)
    ])

    // 先把混合记录拆开，避免后续在同一个循环里处理多种职责。
    const { sourceSnapshotList, translationList } = splitSourceArticleRecords(
      sourceArticleRecordList
    )

    // 连源快照都不存在时，说明这篇文章没有可校验的多语言主体数据。
    if (sourceSnapshotList.length === 0) {
      // res.status(404).json({
      //   errors: [
      //     {
      //       message: '源文章快照不存在'
      //     }
      //   ]
      // })
      res.send({
        sourceLanguageCode: null,
        sourceLanguageData: null,
        existenceMap: {},
        languagePostMap: {}
      })

      return
    }

    // 从源快照中提取有效身份信息，供翻译记录做归属校验。
    const { sourceSnapshotIdSet, translationGroupIdSet } =
      buildSourceSnapshotIdentitySet(sourceSnapshotList)

    // 源语言码应当在所有源快照中保持一致，这里先初始化为空。
    let sourceLanguageCode = null

    // 逐个检查源快照，确认源语言合法、一致，并决定源语言是否可访问。
    for (const sourceSnapshot of sourceSnapshotList) {
      const currentSourceLanguageCode = normalizeLanguageCode(
        sourceSnapshot.sourceLanguageCode
      )

      // 源快照语言无法归一化时，说明数据本身不受支持，直接报错。
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

      // 第一条有效源快照负责确定整篇文章的源语言。
      if (!sourceLanguageCode) {
        sourceLanguageCode = currentSourceLanguageCode
      }

      // 同一篇文章的多个源快照语言必须一致，否则数据已损坏。
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

      // 只有源快照本身处于发布状态时，才把源语言写入可访问结果。
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

    // 逐个处理翻译记录，只接纳通过源快照关系校验的数据。
    for (const translation of translationList) {
      const sourceSnapshotId = getRecordIdText(translation.sourceSnapshotId)

      // 翻译记录指向的源快照不存在时，说明关系已经失效，跳过。
      if (!sourceSnapshotIdSet.has(sourceSnapshotId)) {
        continue
      }

      const translationGroupId = getRecordIdText(translation.translationGroupId)

      // 翻译组不在源快照所属组里时，说明这条翻译不属于当前文章。
      if (!translationGroupIdSet.has(translationGroupId)) {
        continue
      }

      const languageCode = normalizeLanguageCode(translation.languageCode)

      // 语言码不受支持时不报错，直接忽略这条无效翻译记录。
      if (!languageCode) {
        continue
      }

      // 翻译语言使用翻译记录自身 id 作为公开路由 id。
      const translationPostInfo = buildLanguagePostInfo(translation)
      setLanguagePostInfo(
        existenceMap,
        languagePostMap,
        enabledLanguageCodeSet,
        languageCode,
        translationPostInfo
      )
    }

    // 返回源语言、源文章状态以及各语言是否可访问的完整映射。
    res.send({
      sourceLanguageCode,
      sourceLanguageData,
      existenceMap,
      languagePostMap
    })
  } catch (err) {
    // 数据读取或处理失败时统一返回错误，并记录日志便于排查。
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
