// 原站内部资源相对路径白名单
// 运行时通过 SOURCE_BLOG_PUBLIC_ORIGIN + 相对路径拼接实际访问地址
const SOURCE_RELATIVE_PATH_PREFIXES = [
  '/upload',
  '/content',
  '/ucloudImg',
  '/up_works',
  '/web_demo'
]

module.exports = {
  SOURCE_RELATIVE_PATH_PREFIXES
}
