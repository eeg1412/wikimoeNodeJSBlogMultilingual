import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fsExtra from 'fs-extra'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { IP2Location } from 'ip2location-nodejs'
import UAParser from 'ua-parser-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ────────────── Crypto ──────────────

export function creatSha256Str(str) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

export function md5hex(str) {
  return crypto.createHash('md5').update(str).digest('hex')
}

export function HMACSHA256(str, secret) {
  return crypto.createHmac('sha256', secret).update(str).digest('hex')
}

export function creatBcryptStr(str) {
  const salt = bcrypt.genSaltSync(10)
  return bcrypt.hashSync(str, salt)
}

export function checkBcryptStr(str, hash) {
  return bcrypt.compareSync(str, hash)
}

export function generateJwtSecret(byteLength = 256) {
  try {
    const randomBytes = crypto.randomBytes(byteLength)
    return randomBytes.toString('base64')
  } catch (error) {
    console.error('生成 JWT SECRET 失败:', error)
    throw error
  }
}

// ────────────── JWT Admin 密钥文件管理 ──────────────

const SECRET_DIR = join(__dirname, '../secret')
const JWT_ADMIN_KEY_PATH = join(SECRET_DIR, 'JWTSecretAdmin.key')

/**
 * 确保 JWT Admin 密钥文件存在，不存在则自动生成
 * @param {boolean} reflush - 强制重新生成
 * @returns {string} 密钥字符串
 */
export function ensureJWTSecretAdmin(reflush = false) {
  try {
    fsExtra.ensureDirSync(SECRET_DIR)
    const exists = fsExtra.pathExistsSync(JWT_ADMIN_KEY_PATH)
    if (!exists || reflush) {
      console.info('[JWT] 正在生成新的后台 JWT 密钥...')
      const secret = generateJwtSecret()
      fsExtra.writeFileSync(JWT_ADMIN_KEY_PATH, secret, {
        encoding: 'utf8',
        mode: 0o600
      })
      console.info('[JWT] 后台 JWT 密钥已生成并写入文件')
    }
    return fsExtra.readFileSync(JWT_ADMIN_KEY_PATH, 'utf8').trim()
  } catch (error) {
    console.error('[JWT] 密钥文件操作失败:', error)
    throw error
  }
}

/**
 * 重新生成后台 JWT 密钥（高权限操作）
 * 调用后应立即更新进程内存中的密钥引用
 * @returns {string} 新密钥字符串
 */
export function regenerateJWTSecretAdmin() {
  return ensureJWTSecretAdmin(true)
}

// ────────────── JWT ──────────────

/**
 * 签发 JWT
 * @param {object} payload
 * @param {string} secret
 * @param {object} options
 */
export function signJwt(payload, secret, options = {}) {
  return jwt.sign(payload, secret, options)
}

/**
 * 验证 JWT
 * @param {string} token
 * @param {string} secret
 */
export function verifyJwt(token, secret) {
  return jwt.verify(token, secret)
}

// ────────────── String Utilities ──────────────

export function limitStr(str, len) {
  const arr = Array.from(String(str))
  if (arr.length > len) return arr.slice(0, len).join('') + '...'
  return str
}

// ────────────── IP & Device ──────────────

let ip2lInstance = null

function getIp2lInstance() {
  if (ip2lInstance) return ip2lInstance
  try {
    const dbPath = join(__dirname, '../ip2location/IP2LOCATION-LITE-DB11.BIN')
    if (fsExtra.pathExistsSync(dbPath)) {
      ip2lInstance = new IP2Location()
      ip2lInstance.open(dbPath)
    }
  } catch (e) {
    // ip2location 不可用时不影响主流程
  }
  return ip2lInstance
}

/**
 * 解析 IP 地址的地理位置信息
 * @param {string} ip
 * @returns {object|null}
 */
export function getIpInfo(ip) {
  try {
    const inst = getIp2lInstance()
    if (!inst) return null
    const result = inst.getAll(ip)
    return {
      countryLong: result.countryLong || '',
      region: result.region || '',
      city: result.city || '',
      latitude: result.latitude || 0,
      longitude: result.longitude || 0
    }
  } catch {
    return null
  }
}

/**
 * 解析 User-Agent 设备信息
 * @param {string} ua
 * @returns {object}
 */
export function getDeviceInfo(ua) {
  const parser = new UAParser(ua || '')
  const result = parser.getResult()
  return {
    browser: result.browser?.name || '',
    browserVersion: result.browser?.version || '',
    os: result.os?.name || '',
    osVersion: result.os?.version || '',
    device: result.device?.type || 'desktop'
  }
}

// ────────────── Hash for sourceSnapshot / sourceHash ──────────────

/**
 * 计算内容的 SHA256 哈希，用于 sourceHash 字段
 * @param {string|object} content
 */
export function computeSourceHash(content) {
  const str = typeof content === 'string' ? content : JSON.stringify(content)
  return creatSha256Str(str)
}
