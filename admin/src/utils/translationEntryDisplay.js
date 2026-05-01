import { getPostTypeText } from '@/utils/multilingual'

const VALUE_TYPE_LABEL_MAP = {
  plainText: '纯文本',
  richTextLite: 'HTML 富文本',
  richTextDocument: '结构化富文本'
}

const SCOPE_LABEL_MAP = {
  post: '文章字段',
  relation: '关联内容',
  parentRelation: '父级关联',
  record: '内容字段'
}

const SCOPE_TAG_TYPE_MAP = {
  post: 'success',
  relation: 'warning',
  parentRelation: 'danger',
  record: 'info'
}

function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback
  }

  const text = String(value).trim()
  if (!text) {
    return fallback
  }

  return text
}

function splitLabelParts(value) {
  const text = normalizeText(value)
  if (!text) {
    return []
  }

  return text
    .split(' / ')
    .map(item => item.trim())
    .filter(Boolean)
}

function prependLabelPrefix(prefix, value, fallback) {
  const text = normalizeText(value, normalizeText(fallback))
  if (!text) {
    return ''
  }

  if (text.startsWith(prefix)) {
    return text
  }

  return `${prefix}${text}`
}

function getEntryFieldLabel(entry = {}) {
  if (entry.fieldLabel) {
    return normalizeText(entry.fieldLabel)
  }

  const partList = splitLabelParts(entry.label)
  if (partList.length > 1) {
    return partList[partList.length - 1]
  }

  return normalizeText(
    entry.label,
    normalizeText(entry.fieldName, '未命名字段')
  )
}

function getContextTagLabel(entry = {}) {
  let groupTitle = normalizeText(
    entry.groupTitle,
    normalizeText(entry.relationTypeLabel)
  )
  const relationScopeLabel = normalizeText(entry.relationScopeLabel)

  if (
    entry.collectionName === 'posts' &&
    Number(entry.postType) &&
    !relationScopeLabel
  ) {
    const postTypeText = normalizeText(getPostTypeText(entry.postType))
    if (postTypeText && postTypeText !== '-') {
      groupTitle = postTypeText
    }
  }

  if (entry.scope === 'relation') {
    if (relationScopeLabel) {
      if (groupTitle) {
        return prependLabelPrefix(relationScopeLabel, groupTitle)
      }
      return relationScopeLabel
    }

    if (groupTitle) {
      return prependLabelPrefix('关联', groupTitle)
    }
    return '关联内容'
  }

  if (entry.scope === 'parentRelation') {
    if (groupTitle) {
      return prependLabelPrefix('父级', groupTitle)
    }
    return '父级内容'
  }

  if (entry.scope === 'record') {
    return normalizeText(groupTitle, '内容字段')
  }

  return '当前文章'
}

function getEntrySubtitle(entry = {}, fieldLabel) {
  if (entry.entryKind === 'richTextTemplate') {
    return '富文本结构模板，用于保留原始节点与媒体占位。'
  }

  const contextTagLabel = getContextTagLabel(entry)
  const recordLabel = normalizeText(entry.recordLabel)

  if (entry.scope === 'relation') {
    if (recordLabel) {
      return `${contextTagLabel}对象：${recordLabel}`
    }
    return `${contextTagLabel}对象未命名`
  }

  if (entry.scope === 'parentRelation') {
    if (recordLabel) {
      return `${contextTagLabel}对象：${recordLabel}`
    }
    return `${contextTagLabel}对象未命名`
  }

  if (entry.scope === 'record') {
    if (recordLabel) {
      return `${contextTagLabel}：${recordLabel}`
    }
    return `${contextTagLabel}字段`
  }

  return '文章字段'
}

function pushBadge(badgeList, text, type) {
  const normalizedText = normalizeText(text)
  if (!normalizedText) {
    return
  }

  badgeList.push({
    key: `${type || 'default'}:${normalizedText}`,
    text: normalizedText,
    type: type || ''
  })
}

export function getTranslationGroupDisplayMeta(groupLabel, sampleEntry) {
  if (sampleEntry) {
    return {
      eyebrow: '',
      title: normalizeText(getContextTagLabel(sampleEntry), '未分组')
    }
  }

  const text = normalizeText(groupLabel, '未分组')
  if (text.startsWith('推文内关联内容 / ')) {
    return {
      eyebrow: '',
      title: `推文内${text.replace('推文内关联内容 / ', '')}`
    }
  }
  if (text.startsWith('详情页相关内容 / ')) {
    return {
      eyebrow: '',
      title: `详情页${text.replace('详情页相关内容 / ', '')}`
    }
  }
  if (text.startsWith('关联内容 / ')) {
    return {
      eyebrow: '',
      title: `关联${text.replace('关联内容 / ', '')}`
    }
  }
  if (text.startsWith('父级关联 / ')) {
    return {
      eyebrow: '',
      title: `父级${text.replace('父级关联 / ', '')}`
    }
  }

  return {
    eyebrow: '',
    title: text
  }
}

export function getTranslationEntryDisplayMeta(entry = {}) {
  const fieldLabel = getEntryFieldLabel(entry)
  const badgeList = []
  const scopeLabel = getContextTagLabel(entry)
  const scopeTagType = SCOPE_TAG_TYPE_MAP[entry.scope]
  const valueTypeLabel = VALUE_TYPE_LABEL_MAP[entry.valueType]

  pushBadge(badgeList, scopeLabel, scopeTagType)
  pushBadge(badgeList, valueTypeLabel, 'info')

  if (entry.optional) {
    pushBadge(badgeList, '可选', 'warning')
  }
  if (entry.aiTranslationSkip === true) {
    pushBadge(badgeList, 'AI翻译时跳过', 'danger')
  }
  if (entry.entryKind === 'richTextTemplate') {
    pushBadge(badgeList, '结构模板', 'danger')
  }
  if (entry.segmentIndex) {
    if (entry.segmentTotal) {
      pushBadge(
        badgeList,
        `片段 ${entry.segmentIndex}/${entry.segmentTotal}`,
        'danger'
      )
    } else {
      pushBadge(badgeList, `片段 ${entry.segmentIndex}`, 'danger')
    }
  }

  return {
    title: fieldLabel,
    subtitle: getEntrySubtitle(entry, fieldLabel),
    badgeList
  }
}

export function groupTranslationEntryList(entryList) {
  if (!Array.isArray(entryList) || entryList.length === 0) {
    return []
  }

  const groupMap = new Map()
  entryList.forEach(entry => {
    const groupLabel = normalizeText(entry?.groupLabel, '未分组')
    if (!groupMap.has(groupLabel)) {
      groupMap.set(groupLabel, [])
    }
    groupMap.get(groupLabel).push(entry)
  })

  return Array.from(groupMap.entries()).map(([label, entries]) => {
    return {
      label,
      entries,
      meta: getTranslationGroupDisplayMeta(label, entries[0])
    }
  })
}
