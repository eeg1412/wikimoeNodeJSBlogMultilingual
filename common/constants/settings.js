function createSettingDefinition(namespace, key, config) {
  const finalConfig = config || {}
  const definition = {
    namespace,
    key,
    fullKey: `${namespace}.${key}`,
    valueType: 'string',
    isPublic: false,
    isSecret: false,
    description: ''
  }

  if (finalConfig.valueType) {
    definition.valueType = finalConfig.valueType
  }

  if (finalConfig.isPublic === true) {
    definition.isPublic = true
  }

  if (finalConfig.isSecret === true) {
    definition.isSecret = true
  }

  if (finalConfig.description) {
    definition.description = finalConfig.description
  }

  if (Object.prototype.hasOwnProperty.call(finalConfig, 'defaultValue')) {
    definition.defaultValue = finalConfig.defaultValue
  }

  return definition
}

const SYSTEM_SETTING_DEFINITIONS = Object.freeze([
  createSettingDefinition('system', 'sourceBlogApiBaseUrl', {
    defaultValue: null,
    description: '原站公开接口基地址'
  }),
  createSettingDefinition('system', 'sourceBlogPublicOrigin', {
    defaultValue: null,
    description: '原站静态资源访问域名'
  }),
  createSettingDefinition('system', 'sourceBlogRequestTimeoutMs', {
    valueType: 'number',
    defaultValue: null,
    description: '原站接口请求超时'
  }),
  createSettingDefinition('system', 'aiTranslationEnabled', {
    valueType: 'boolean',
    defaultValue: false,
    description: 'AI 翻译总开关'
  }),
  createSettingDefinition('system', 'aiProvider', {
    defaultValue: 'google-genai',
    description: 'AI 提供商'
  }),
  createSettingDefinition('system', 'aiModel', {
    defaultValue: null,
    description: '当前 AI 模型'
  }),
  createSettingDefinition('system', 'aiApiKey', {
    defaultValue: null,
    isSecret: true,
    description: 'Gemini Developer API 凭据'
  }),
  createSettingDefinition('system', 'aiApiVersion', {
    defaultValue: null,
    description: 'GenAI API 版本'
  }),
  createSettingDefinition('system', 'aiGatewayUrl', {
    defaultValue: null,
    isSecret: true,
    description: 'AI 网关地址'
  }),
  createSettingDefinition('system', 'aiThinkingBudget', {
    valueType: 'number',
    defaultValue: null,
    description: 'AI 思考预算'
  }),
  createSettingDefinition('system', 'translationSystemPrompt', {
    defaultValue: null,
    description: '翻译系统提示词'
  }),
  createSettingDefinition('system', 'translationHtmlBatchMaxSegments', {
    valueType: 'number',
    defaultValue: 80,
    description: 'HTML 翻译单批最大 segment 数'
  }),
  createSettingDefinition('system', 'translationHtmlBatchMaxChars', {
    valueType: 'number',
    defaultValue: 6000,
    description: 'HTML 翻译单批最大字符数'
  }),
  createSettingDefinition('system', 'translationRetryLimit', {
    valueType: 'number',
    defaultValue: null,
    description: '翻译失败重试次数'
  }),
  createSettingDefinition('system', 'adminTokenDefaultTtlHours', {
    valueType: 'number',
    defaultValue: 1,
    description: '后台默认登录时长'
  }),
  createSettingDefinition('system', 'adminTokenRememberMeTtlDays', {
    valueType: 'number',
    defaultValue: 365,
    description: '后台记住登录时长'
  }),
  createSettingDefinition('system', 'adminLoginAttemptWindowMinutes', {
    valueType: 'number',
    defaultValue: 5,
    description: '后台登录失败统计窗口'
  }),
  createSettingDefinition('system', 'adminLoginMaxAttempts', {
    valueType: 'number',
    defaultValue: 3,
    description: '后台登录失败最大次数'
  })
])

const SITE_SETTING_DEFINITIONS = Object.freeze([
  createSettingDefinition('site', 'title', {
    defaultValue: null,
    isPublic: true,
    description: '站点标题'
  }),
  createSettingDefinition('site', 'subTitle', {
    defaultValue: null,
    isPublic: true,
    description: '站点副标题'
  }),
  createSettingDefinition('site', 'description', {
    defaultValue: null,
    isPublic: true,
    description: '站点描述'
  }),
  createSettingDefinition('site', 'keywords', {
    defaultValue: null,
    isPublic: true,
    description: '站点关键字'
  }),
  createSettingDefinition('site', 'url', {
    defaultValue: null,
    isPublic: true,
    description: '站点 URL'
  }),
  createSettingDefinition('site', 'favicon', {
    defaultValue: null,
    isPublic: true,
    description: '站点图标'
  }),
  createSettingDefinition('site', 'footerInfo', {
    defaultValue: null,
    isPublic: true,
    description: '页脚信息'
  }),
  createSettingDefinition('site', 'extraCss', {
    defaultValue: null,
    isPublic: true,
    description: '额外 CSS'
  }),
  createSettingDefinition('site', 'extraJs', {
    defaultValue: null,
    isPublic: true,
    description: '额外 JS'
  }),
  createSettingDefinition('site', 'themeMode', {
    defaultValue: null,
    isPublic: true,
    description: '主题模式'
  }),
  createSettingDefinition('site', 'allowSwitchTheme', {
    valueType: 'boolean',
    defaultValue: false,
    isPublic: true,
    description: '是否允许切换主题'
  }),
  createSettingDefinition('site', 'pageSize', {
    valueType: 'number',
    defaultValue: null,
    isPublic: true,
    description: '站点分页大小'
  }),
  createSettingDefinition('site', 'timeZone', {
    defaultValue: null,
    isPublic: true,
    description: '时区'
  }),
  createSettingDefinition('site', 'enableSitemap', {
    valueType: 'boolean',
    defaultValue: false,
    isPublic: true,
    description: '是否启用 sitemap'
  }),
  createSettingDefinition('site', 'robotsTxt', {
    defaultValue: null,
    description: 'robots.txt 内容'
  }),
  createSettingDefinition('site', 'defaultLanguageCode', {
    defaultValue: 'en',
    isPublic: true,
    description: '默认语言代码'
  }),
  createSettingDefinition('site', 'showBlogVersion', {
    valueType: 'boolean',
    defaultValue: false,
    isPublic: true,
    description: '是否展示博客版本'
  }),
  createSettingDefinition('site', 'googleAdEnabled', {
    valueType: 'boolean',
    defaultValue: false,
    isPublic: true,
    description: '是否启用谷歌广告'
  }),
  createSettingDefinition('site', 'googleAdClientId', {
    defaultValue: null,
    isPublic: true,
    description: '谷歌广告客户端 ID'
  }),
  createSettingDefinition('site', 'googleAdPostBottomEnabled', {
    valueType: 'boolean',
    defaultValue: false,
    isPublic: true,
    description: '文章底部广告开关'
  }),
  createSettingDefinition('site', 'googleAdPostBottomParams', {
    valueType: 'object',
    defaultValue: null,
    isPublic: true,
    description: '文章底部广告参数'
  }),
  createSettingDefinition('site', 'adsTxtContent', {
    defaultValue: null,
    description: 'ads.txt 内容'
  })
])

module.exports = {
  SITE_SETTING_DEFINITIONS,
  SYSTEM_SETTING_DEFINITIONS,
  createSettingDefinition
}
