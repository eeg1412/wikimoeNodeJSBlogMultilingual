import {
  getPostDisplayTitle,
  getRelationDisplayName
} from '@/utils/multilingual'
import { normalizeTagName } from '@/utils/tagName'

export const RELATION_EDIT_FIELD_MAP = {
  users: [
    { name: 'nickname', label: '昵称', translationExport: true },
    { name: 'email', label: '邮箱' },
    {
      name: 'description',
      label: '说明',
      type: 'textarea',
      translationExport: true
    }
  ],
  sorts: [
    { name: 'sortname', label: '分类名', translationExport: true },
    {
      name: 'alias',
      label: '别名'
    },
    {
      name: 'parent',
      label: '父级分类',
      type: 'parentRelation',
      relationCollectionName: 'sorts',
      parentEditableFieldNames: ['sortname', 'description']
    },
    { name: 'taxis', label: '排序', type: 'number' },
    {
      name: 'description',
      label: '说明',
      type: 'textarea',
      translationExport: true
    },
    { name: 'template', label: '模板' }
  ],
  tags: [
    {
      name: 'tagname',
      label: '标签名',
      type: 'tagName',
      translationExport: true
    }
  ],
  mappoints: [
    { name: 'title', label: '地点标题', translationExport: true },
    {
      name: 'summary',
      label: '摘要',
      type: 'textarea',
      translationExport: true
    },
    { name: 'longitude', label: '经度', type: 'number' },
    { name: 'latitude', label: '纬度', type: 'number' },
    { name: 'zIndex', label: '层级', type: 'number' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  bangumis: [
    { name: 'title', label: '番剧标题', translationExport: true },
    {
      name: 'summary',
      label: '简介',
      type: 'textarea',
      translationExport: true
    },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'year', label: '年份', type: 'number' },
    { name: 'season', label: '季度', type: 'number' },
    { name: 'label', label: '标签', translationExport: true },
    { name: 'giveUp', label: '弃番', type: 'boolean' },
    { name: 'postLinkOpen', label: '开放关联', type: 'boolean' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  movies: [
    { name: 'title', label: '电影标题', translationExport: true },
    {
      name: 'summary',
      label: '简介',
      type: 'textarea',
      translationExport: true
    },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'year', label: '年份', type: 'number' },
    { name: 'month', label: '月份', type: 'number' },
    { name: 'day', label: '日期', type: 'number' },
    { name: 'label', label: '标签', translationExport: true },
    { name: 'postLinkOpen', label: '开放关联', type: 'boolean' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  games: [
    {
      name: 'gamePlatform',
      label: '所属平台',
      type: 'parentRelation',
      relationCollectionName: 'gamePlatforms',
      parentEditableFieldNames: ['name', 'color']
    },
    { name: 'title', label: '游戏标题', translationExport: true },
    {
      name: 'summary',
      label: '简介',
      type: 'textarea',
      translationExport: true
    },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'label', label: '标签', translationExport: true },
    { name: 'giveUp', label: '弃坑', type: 'boolean' },
    { name: 'postLinkOpen', label: '开放关联', type: 'boolean' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  gamePlatforms: [
    { name: 'name', label: '平台名', translationExport: true },
    { name: 'color', label: '颜色', type: 'color' }
  ],
  books: [
    {
      name: 'booktype',
      label: '所属类型',
      type: 'parentRelation',
      relationCollectionName: 'booktypes',
      parentEditableFieldNames: ['name', 'color'],
      required: true
    },
    { name: 'title', label: '书籍标题', translationExport: true },
    {
      name: 'summary',
      label: '简介',
      type: 'textarea',
      translationExport: true
    },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'label', label: '标签', translationExport: true },
    { name: 'giveUp', label: '弃坑', type: 'boolean' },
    { name: 'postLinkOpen', label: '开放关联', type: 'boolean' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  booktypes: [
    { name: 'name', label: '类型名', translationExport: true },
    { name: 'color', label: '颜色', type: 'color' }
  ],
  events: [
    {
      name: 'eventtype',
      label: '活动类型',
      type: 'parentRelation',
      relationCollectionName: 'eventtypes',
      parentEditableFieldNames: ['name', 'color'],
      required: true
    },
    { name: 'title', label: '活动标题', translationExport: true },
    { name: 'color', label: '颜色', type: 'color' },
    {
      name: 'content',
      label: '内容',
      type: 'richText',
      translationExport: true
    },
    { name: 'status', label: '状态', type: 'number' }
  ],
  eventtypes: [
    { name: 'name', label: '类型名', translationExport: true },
    { name: 'color', label: '颜色', type: 'color' }
  ],
  posts: [
    { name: 'title', label: '标题', translationExport: true },
    {
      name: 'excerpt',
      label: '摘要/推文',
      type: 'textarea',
      translationExport: true
    },
    {
      name: 'alias',
      label: '别名'
    },
    { name: 'status', label: '状态', type: 'number' },
    { name: 'allowRemark', label: '允许评论', type: 'boolean' },
    { name: 'top', label: '置顶', type: 'boolean' },
    { name: 'sortop', label: '分类置顶', type: 'boolean' }
  ],
  votes: [
    {
      name: 'options',
      label: '选项',
      type: 'voteOptions',
      translationExport: true
    },
    { name: 'title', label: '投票标题', translationExport: true },
    { name: 'maxSelect', label: '最大选择数', type: 'number' },
    { name: 'showResultAfter', label: '投票后显示结果', type: 'boolean' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  attachments: [
    { name: 'name', label: '媒体名称', translationExport: true },
    {
      name: 'description',
      label: '描述',
      type: 'textarea',
      translationExport: true
    },
    {
      name: 'is360Panorama',
      label: '360 全景',
      type: 'boolean',
      imageOnly: true
    }
  ]
}

export function getRelationEditFields(collectionName) {
  return RELATION_EDIT_FIELD_MAP[collectionName] || []
}

export function isRelationFieldTranslationExportable(field) {
  return field?.translationExport === true
}

export function getRelationTranslationFields(collectionName) {
  return getRelationEditFields(collectionName).filter(
    isRelationFieldTranslationExportable
  )
}

export function getRelationOptionLabel(record) {
  if (!record) {
    return '-'
  }

  if ([1, 2, 3].includes(Number(record.type))) {
    return getPostDisplayTitle(record)
  }

  return getRelationDisplayName(record)
}

export function getRelationIdValue(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'object' && value._id) {
    return value._id
  }

  return value
}

export function getRelationFieldInitialValue(field, record) {
  const value = record?.[field.name]
  if (field.type === 'parentRelation') {
    return getRelationIdValue(value)
  }
  if (field.type === 'voteOptions') {
    return Array.isArray(value)
      ? value.map(item => ({
          _id: item._id,
          title: item.title || '',
          votes: Number(item.votes || 0),
          sort: Number(item.sort || 0)
        }))
      : []
  }
  if (field.type === 'tagName') {
    return normalizeTagName(value)
  }

  return value
}

export function shouldSubmitRelationEditField(field) {
  return field.type !== 'parentRelation'
}
