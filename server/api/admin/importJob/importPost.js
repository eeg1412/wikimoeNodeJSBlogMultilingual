import { importPostSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'
import { importPost } from '../../../services/importService.js'

/**
 * 从用户输入的 sourceUrl 中提取文章标识符（alias 或 ID）
 * 支持完整 URL（如 https://example.com/post/my-alias）或直接输入标识符
 * @param {string} sourceUrl
 * @returns {string}
 */
function extractSourceIdentifier(sourceUrl) {
  try {
    const url = new URL(sourceUrl)
    const segments = url.pathname.split('/').filter(Boolean)
    return segments[segments.length - 1] || sourceUrl
  } catch {
    // 不是有效 URL，直接作为标识符使用
    return sourceUrl.trim()
  }
}

export default async function importPostHandler(req, res, next) {
  try {
    const { value, error } = validateData(importPostSchema, req.body)
    if (error) {
      return res
        .status(400)
        .json({ message: error, errors: [{ message: error }] })
    }

    const sourceIdentifier = extractSourceIdentifier(value.sourceUrl)
    if (!sourceIdentifier) {
      return res
        .status(400)
        .json({ message: '无法从输入中提取文章标识符，请检查 URL 格式' })
    }
    const { languageCode, confirmOverwrite } = value
    const operatorAdminId = String(req.adminUser._id)

    const result = await importPost({
      sourceIdentifier,
      languageCode,
      confirmOverwrite: confirmOverwrite === true,
      operatorAdminId
    })

    if (result.alreadyExists) {
      return res.status(409).json({
        message: result.warnings[0],
        data: { alreadyExists: true, postId: result.postId }
      })
    }

    return res.json({
      data: {
        postId: result.postId,
        isNew: result.isNew,
        warnings: result.warnings
      }
    })
  } catch (err) {
    next(err)
  }
}
