export const TRANSLATION_STATUS_OPTIONS = [
  { label: '待翻译', value: 'pending' },
  { label: 'AI 草稿', value: 'ai_draft' },
  { label: '人工草稿', value: 'manual_draft' },
  { label: '已确认', value: 'approved' },
  { label: '无需翻译', value: 'not_required' },
  { label: '占位 Stub', value: 'stub' },
  { label: '已过期', value: 'outdated' }
]

export const ENTITY_META = {
  author: {
    displayField: 'nickname',
    fields: [
      { key: 'nickname', label: '昵称', type: 'input' },
      { key: 'description', label: '简介', type: 'textarea' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: '作者'
  },
  attachment: {
    displayField: 'name',
    fields: [
      { key: 'name', label: '名称', type: 'input' },
      { key: 'description', label: '描述', type: 'textarea' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: '附件'
  },
  bangumi: {
    displayField: 'title',
    fields: [
      { key: 'title', label: '标题', type: 'input' },
      { key: 'summary', label: '摘要', type: 'textarea' },
      { key: 'description', label: '描述', type: 'textarea' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: 'Bangumi'
  },
  book: {
    displayField: 'title',
    fields: [
      { key: 'title', label: '标题', type: 'input' },
      { key: 'summary', label: '摘要', type: 'textarea' },
      { key: 'description', label: '描述', type: 'textarea' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: '图书'
  },
  event: {
    displayField: 'title',
    fields: [
      { key: 'title', label: '标题', type: 'input' },
      { key: 'summary', label: '摘要', type: 'textarea' },
      { key: 'description', label: '描述', type: 'textarea' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: '事件'
  },
  game: {
    displayField: 'title',
    fields: [
      { key: 'title', label: '标题', type: 'input' },
      { key: 'summary', label: '摘要', type: 'textarea' },
      { key: 'description', label: '描述', type: 'textarea' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: '游戏'
  },
  mappoint: {
    displayField: 'title',
    fields: [
      { key: 'title', label: '标题', type: 'input' },
      { key: 'summary', label: '摘要', type: 'textarea' },
      { key: 'longitude', label: '经度', type: 'number' },
      { key: 'latitude', label: '纬度', type: 'number' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: '地点'
  },
  movie: {
    displayField: 'title',
    fields: [
      { key: 'title', label: '标题', type: 'input' },
      { key: 'summary', label: '摘要', type: 'textarea' },
      { key: 'description', label: '描述', type: 'textarea' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: '电影'
  },
  sort: {
    displayField: 'sortname',
    fields: [
      { key: 'sortname', label: '分类名', type: 'input' },
      { key: 'alias', label: '别名', type: 'input' },
      { key: 'description', label: '描述', type: 'textarea' },
      { key: 'template', label: '模板', type: 'input' },
      { key: 'taxis', label: '排序', type: 'number' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: '分类'
  },
  tag: {
    displayField: 'tagname',
    fields: [
      { key: 'tagname', label: '标签名', type: 'input' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: '标签'
  },
  vote: {
    displayField: 'title',
    fields: [
      { key: 'title', label: '标题', type: 'input' },
      { key: 'options', label: '选项(JSON)', type: 'json' },
      {
        key: 'translationStatus',
        label: '翻译状态',
        type: 'select',
        options: TRANSLATION_STATUS_OPTIONS
      }
    ],
    title: '投票'
  }
}

export const ENTITY_ROUTE_ORDER = [
  'author',
  'sort',
  'tag',
  'mappoint',
  'attachment',
  'bangumi',
  'movie',
  'game',
  'book',
  'event',
  'vote'
]

export function getEntityLabel(entityType, item) {
  if (!item) {
    return ''
  }
  const meta = ENTITY_META[entityType]
  if (!meta) {
    return item.title || item.name || item._id || ''
  }
  return item[meta.displayField] || item.title || item.name || item._id || ''
}