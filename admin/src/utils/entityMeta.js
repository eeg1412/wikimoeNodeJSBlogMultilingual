// 共享实体类型描述符（前端）
// 每个 type 指明如何编辑普通字段；related 类型（bangumi/movie/...）的翻译字段走 doc.translatableFields
export const ENTITY_TYPES = [
  { type: 'author', label: '作者', labelField: 'nickname' },
  { type: 'sort', label: '分类', labelField: 'sortname' },
  { type: 'tag', label: '标签', labelField: 'tagname' },
  { type: 'mappoint', label: '地点', labelField: 'title' },
  { type: 'attachment', label: '附件', labelField: 'name' },
  { type: 'bangumi', label: '番剧', labelField: 'title', isRelated: true },
  { type: 'movie', label: '电影', labelField: 'title', isRelated: true },
  { type: 'game', label: '游戏', labelField: 'title', isRelated: true },
  { type: 'book', label: '书籍', labelField: 'title', isRelated: true },
  { type: 'event', label: '活动', labelField: 'title', isRelated: true },
  { type: 'vote', label: '投票', labelField: 'title', isRelated: true }
]

export const ENTITY_TYPE_MAP = ENTITY_TYPES.reduce((acc, it) => {
  acc[it.type] = it
  return acc
}, {})

// 各类型允许人工编辑的普通字段（与后端 authorUpdateSchema 等对齐）
export const ENTITY_EDITABLE_FIELDS = {
  author: [
    { key: 'nickname', label: '昵称', type: 'text', translatable: true },
    { key: 'description', label: '简介', type: 'textarea', translatable: true }
  ],
  sort: [
    { key: 'sortname', label: '名称', type: 'text', translatable: true },
    { key: 'alias', label: '别名', type: 'text' },
    { key: 'description', label: '描述', type: 'textarea', translatable: true },
    { key: 'template', label: '模板', type: 'text', translatable: true },
    { key: 'taxis', label: '排序', type: 'number' }
  ],
  tag: [{ key: 'tagname', label: '标签名', type: 'text', translatable: true }],
  mappoint: [
    { key: 'title', label: '标题', type: 'text', translatable: true },
    { key: 'summary', label: '摘要', type: 'textarea', translatable: true }
  ],
  attachment: [
    { key: 'name', label: '名称', type: 'text', translatable: true },
    { key: 'description', label: '描述', type: 'textarea', translatable: true },
    { key: 'filename', label: '文件名', type: 'text' }
  ]
}

export const TRANSLATION_STATUS_OPTIONS = [
  { value: 'pending', label: 'pending' },
  { value: 'ai_draft', label: 'ai_draft' },
  { value: 'manual_draft', label: 'manual_draft' },
  { value: 'approved', label: 'approved' },
  { value: 'not_required', label: 'not_required' },
  { value: 'stub', label: 'stub' },
  { value: 'outdated', label: 'outdated' }
]

export function translationTagType(s) {
  switch (s) {
    case 'approved':
    case 'not_required':
      return 'success'
    case 'ai_draft':
    case 'manual_draft':
      return 'warning'
    case 'outdated':
      return 'danger'
    default:
      return 'info'
  }
}
