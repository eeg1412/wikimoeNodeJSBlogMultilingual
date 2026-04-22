import { rotateJwtSecret } from '../../../utils/jwtManager.js'
import log4js from 'log4js'

const logger = log4js.getLogger('admin')

export default async function regenerateJwtHandler(req, res, next) {
  try {
    const admin = req.adminUser

    // 写入安全审计日志
    logger.info(
      `[Security] 管理员 ${admin.username}(${admin._id}) 触发后台 JWT 密钥重新生成`
    )

    // 重新生成并立即刷新进程内引用
    rotateJwtSecret()

    return res.json({
      data: { message: '后台 JWT 密钥已重新生成，所有既有 token 立即失效' }
    })
  } catch (err) {
    next(err)
  }
}
