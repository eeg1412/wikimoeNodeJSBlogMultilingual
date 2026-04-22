import multer from 'multer'
import path from 'path'
import { randomUUID } from 'crypto'
import { LOCAL_ATTACHMENT_STORAGE_DIR } from '../../../config/env.js'
import Attachment from '../../../mongodb/models/attachment.js'
import {
  ATTACHMENT_SOURCE_TYPE,
  ATTACHMENT_IMPORT_ORIGIN,
  LOCALIZED_UPLOAD_MIME_WHITELIST,
  TRANSLATION_STATUS
} from '../../../../common/constants/index.js'
import { fileTypeFromBuffer } from 'file-type'

/**
 * 本地化附件上传
 * 1. 文件保存至 LOCAL_ATTACHMENT_STORAGE_DIR/languageCode/uuid.ext
 * 2. 在 attachments 集合中注册 attachmentSourceType=localized 记录
 */
export default async function attachmentUploadHandler(req, res, next) {
  try {
    const { languageCode, name = '', description = '' } = req.body
    if (!languageCode) {
      return res
        .status(400)
        .json({ errors: [{ message: 'languageCode 必填' }] })
    }

    if (!req.file) {
      return res.status(400).json({ errors: [{ message: '未收到文件' }] })
    }

    // 重新验证 MIME（不信任客户端 Content-Type）
    const detectedType = await fileTypeFromBuffer(req.file.buffer)
    const mime = detectedType?.mime || req.file.mimetype || ''
    if (!LOCALIZED_UPLOAD_MIME_WHITELIST.includes(mime)) {
      return res
        .status(400)
        .json({ errors: [{ message: `文件类型 ${mime} 不在白名单内` }] })
    }

    const storageDir = LOCAL_ATTACHMENT_STORAGE_DIR()
    const uuid = randomUUID()
    const ext = detectedType?.ext
      ? `.${detectedType.ext}`
      : path.extname(req.file.originalname)
    const filename = `${uuid}${ext}`
    const relativeDir = languageCode
    const relativePath = `/${relativeDir}/${filename}`

    // 路径穿越防护：确保 relativeDir 只包含允许的语言代码
    if (!/^[a-z]{2,5}$/.test(languageCode)) {
      return res.status(400).json({ errors: [{ message: '无效的语言代码' }] })
    }

    const { promises: fs } = await import('fs')
    const absDir = path.join(storageDir, relativeDir)
    const absPath = path.join(absDir, filename)

    // 路径穿越二次确认
    if (!absPath.startsWith(storageDir)) {
      return res.status(400).json({ errors: [{ message: '非法文件路径' }] })
    }

    await fs.mkdir(absDir, { recursive: true })
    await fs.writeFile(absPath, req.file.buffer)

    const doc = await Attachment.create({
      attachmentSourceType: ATTACHMENT_SOURCE_TYPE.LOCALIZED,
      languageCode,
      filename,
      filepath: relativePath,
      name,
      description,
      filesize: req.file.size,
      mimetype: mime,
      importOrigin: ATTACHMENT_IMPORT_ORIGIN.UPLOAD,
      translationStatus: TRANSLATION_STATUS.NOT_REQUIRED
    })

    return res.json({ data: doc })
  } catch (err) {
    next(err)
  }
}

// multer 内存存储（文件类型验证后再写盘）
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
}).single('file')
