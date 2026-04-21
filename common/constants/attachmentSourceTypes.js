// 附件来源分类
// remote    原站远程附件（仅登记元数据）
// localized 翻译站本地附件（本地存储实际文件）
const ATTACHMENT_SOURCE_TYPE = {
  REMOTE: 'remote',
  LOCALIZED: 'localized'
}

const ATTACHMENT_SOURCE_TYPE_VALUES = Object.values(ATTACHMENT_SOURCE_TYPE)

// 附件导入来源
// sourceAttachment   原站附件表实体
// htmlDiscovered     从正文 HTML 解析得到
// localizedUpload    多语言站直接上传的本地文件
// localizedDerived   基于 remote 附件派生出的 localized 附件
const ATTACHMENT_IMPORT_ORIGIN = {
  SOURCE_ATTACHMENT: 'sourceAttachment',
  HTML_DISCOVERED: 'htmlDiscovered',
  LOCALIZED_UPLOAD: 'localizedUpload',
  LOCALIZED_DERIVED: 'localizedDerived'
}

const ATTACHMENT_IMPORT_ORIGIN_VALUES = Object.values(ATTACHMENT_IMPORT_ORIGIN)

module.exports = {
  ATTACHMENT_SOURCE_TYPE,
  ATTACHMENT_SOURCE_TYPE_VALUES,
  ATTACHMENT_IMPORT_ORIGIN,
  ATTACHMENT_IMPORT_ORIGIN_VALUES
}
