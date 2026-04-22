import { ensureJWTSecretAdmin, regenerateJWTSecretAdmin } from './utils.js'
import { setAdminJwtSecret } from '../middleware/adminAuth.js'

let _currentSecret = null

/**
 * 确保密钥存在并加载到内存
 * @returns {string}
 */
export function loadJwtSecret() {
  _currentSecret = ensureJWTSecretAdmin()
  setAdminJwtSecret(_currentSecret)
  return _currentSecret
}

/**
 * 重新生成密钥并立即刷新内存引用
 * 所有既有 token 将立即失效
 * @returns {string}
 */
export function rotateJwtSecret() {
  _currentSecret = regenerateJWTSecretAdmin()
  setAdminJwtSecret(_currentSecret)
  return _currentSecret
}

export function getCurrentJwtSecret() {
  return _currentSecret
}

// 供 app.js 初始化调用的别名
export { loadJwtSecret as ensureJWTSecretAdmin }

export function setAdminJwtSecretGlobal(secret) {
  _currentSecret = secret
  setAdminJwtSecret(secret)
}
