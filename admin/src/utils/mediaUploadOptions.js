/**
 * 上传媒体文件前的单独设置（不压缩、不生成缩略图、360°全景、最长边、HDR相关）的统一逻辑。
 * 供 MediaUploadOptions 组件与各上传/替换场景共享，避免设置逻辑分散重复。
 */

// HDR选择器可选值
export const HDR_OPTION_DEFAULT = 'default'
export const HDR_OPTION_KEEP = 'keep'
export const HDR_OPTION_NOT_KEEP = 'notKeep'

/**
 * 创建一份默认的上传单独设置
 * @returns {Object} 默认设置对象
 */
export function createMediaUploadOptions() {
  return {
    // 不压缩图片
    noCompress: false,
    // 不生成缩略图
    noThumbnail: false,
    // 是360°全景图片
    is360Panorama: false,
    // 压缩最长边（null表示按后台设置）
    imgSettingCompressMaxSize: null,
    // 保留HDR：default 按照后台设置 | keep 保留HDR | notKeep 不保留HDR
    keepHDR: HDR_OPTION_DEFAULT,
    // 缩略图保留HDR：default 按照后台设置 | keep 保留HDR | notKeep 不保留HDR
    thumbnailKeepHDR: HDR_OPTION_DEFAULT,
    // 手动标记为HDR（仅展示徽章，不影响转换流程）
    markAsHDR: false
  }
}

/**
 * 将传入的设置对象重置为默认值（保持引用不变）
 * @param {Object} options - 需要重置的设置对象
 */
export function resetMediaUploadOptions(options) {
  Object.assign(options, createMediaUploadOptions())
}

/**
 * 统计已生效的设置项数量，用于按钮上的提示
 * @param {Object} options - 设置对象
 * @returns {number} 已设置项数量
 */
export function getMediaUploadOptionsCount(options) {
  let count = 0
  if (options.noCompress) {
    count++
  }
  if (options.noThumbnail) {
    count++
  }
  if (options.is360Panorama) {
    count++
  }
  if (options.imgSettingCompressMaxSize) {
    count++
  }
  if (options.keepHDR !== HDR_OPTION_DEFAULT) {
    count++
  }
  if (options.thumbnailKeepHDR !== HDR_OPTION_DEFAULT) {
    count++
  }
  if (options.markAsHDR) {
    count++
  }
  return count
}

/**
 * 将上传单独设置转换为请求头（服务端从 headers 读取，全站统一走 headers）
 * @param {Object} options - 设置对象
 * @returns {Object} 请求头对象
 */
export function buildMediaUploadOptionHeaders(options) {
  return {
    'x-no-compress': options.noCompress ? '1' : '0',
    'x-no-thumbnail': options.noThumbnail ? '1' : '0',
    'x-is-360-panorama': options.is360Panorama ? '1' : '0',
    'x-compress-max-size': options.imgSettingCompressMaxSize
      ? String(options.imgSettingCompressMaxSize)
      : '',
    'x-keep-hdr': options.keepHDR,
    'x-thumbnail-keep-hdr': options.thumbnailKeepHDR,
    'x-mark-as-hdr': options.markAsHDR ? '1' : '0'
  }
}
