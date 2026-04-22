/**
 * 启动引导级 env 加载器
 * 只读取第 11.1 节定义的 5 个启动引导级键，拒绝其他业务键作为配置来源
 */
import { config as dotenvConfig } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// env.js 位于 server/config/，根目录 .env 在 ../../
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenvConfig({ path: resolve(__dirname, '../../.env') })

const REQUIRED_KEYS = [
  'DB_HOST',
  'LOCAL_ATTACHMENT_STORAGE_DIR',
  'INIT_ADMIN_USERNAME',
  'INIT_ADMIN_PASSWORD',
  'INIT_ADMIN_NICKNAME'
]

/**
 * 校验必填 env 键是否存在，缺失则打印错误并退出进程
 */
export function validateEnv() {
  const missing = REQUIRED_KEYS.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error(`[ENV] 缺少必填启动引导配置: ${missing.join(', ')}`)
    console.error('[ENV] 请在项目根目录创建 .env 文件，参考 example.env')
    process.exit(1)
  }
}

export const DB_HOST = () => process.env.DB_HOST
export const LOCAL_ATTACHMENT_STORAGE_DIR = () =>
  process.env.LOCAL_ATTACHMENT_STORAGE_DIR
export const INIT_ADMIN_USERNAME = () => process.env.INIT_ADMIN_USERNAME
export const INIT_ADMIN_PASSWORD = () => process.env.INIT_ADMIN_PASSWORD
export const INIT_ADMIN_NICKNAME = () => process.env.INIT_ADMIN_NICKNAME
