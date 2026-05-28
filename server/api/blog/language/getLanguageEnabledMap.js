const languageSettingsService = require('../../multilingual-admin/services/languageSettingsService')

/**
 * @description 介绍：返回多语言博客端每个支持语言的启用状态；输入：Express 请求；输出：{ data: { [code]: boolean } }。
 * @param {import('express').Request} req 输入：接口请求对象。
 * @param {import('express').Response} res 输入：接口响应对象。
 * @param {import('express').NextFunction} next 输入：异常传递函数。
 * @returns {Promise<void>} 输出：无返回值。
 */
module.exports = async function (req, res, next) {
  try {
    const languageSettingsList =
      await languageSettingsService.getLanguageSettingsList()
    const languageEnabledMap = {}

    for (const languageCode of languageSettingsList.languages) {
      const languageSettings = languageSettingsList.settings[languageCode] || {}
      languageEnabledMap[languageCode] =
        languageSettings.blogLanguageEnabled === true
    }

    res.send({
      data: languageEnabledMap
    })
  } catch (error) {
    next(error)
  }
}
