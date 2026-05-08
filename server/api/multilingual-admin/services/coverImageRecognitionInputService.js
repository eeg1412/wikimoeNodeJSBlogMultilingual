const fs = require('fs')
const sharp = require('sharp')
const coverImageTempFileService = require('./coverImageTempFileService')
const { sanitizeSafePathPart } = require('../utils/coverImageTranslationUtils')

const MAX_RECOGNITION_IMAGE_SIZE = 1280

function calculateRecognitionResize(width, height) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('source image metadata is invalid')
  }
  if (
    width <= MAX_RECOGNITION_IMAGE_SIZE &&
    height <= MAX_RECOGNITION_IMAGE_SIZE
  ) {
    return { width, height }
  }
  const scale = Math.min(
    MAX_RECOGNITION_IMAGE_SIZE / width,
    MAX_RECOGNITION_IMAGE_SIZE / height
  )
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

function shouldResizeRecognitionImage(sourceMetadata, targetSize) {
  const sourceWidth = Number(sourceMetadata?.width || 0)
  const sourceHeight = Number(sourceMetadata?.height || 0)
  return (
    Number.isFinite(sourceWidth) &&
    Number.isFinite(sourceHeight) &&
    (sourceWidth > MAX_RECOGNITION_IMAGE_SIZE ||
      sourceHeight > MAX_RECOGNITION_IMAGE_SIZE) &&
    (sourceWidth !== targetSize.width || sourceHeight !== targetSize.height)
  )
}

async function createRecognitionInputImage({
  jobId,
  recognitionKey,
  sourceFilePath
}) {
  const safeRecognitionKey = sanitizeSafePathPart(
    recognitionKey,
    'recognitionKey'
  )
  const sourceBuffer = await fs.promises.readFile(sourceFilePath)
  const metadata = await sharp(sourceBuffer).metadata()
  const size = calculateRecognitionResize(metadata.width, metadata.height)
  const hasAlpha = metadata.hasAlpha === true
  const extname = hasAlpha ? '.png' : '.jpg'
  const mimeType = hasAlpha ? 'image/png' : 'image/jpeg'
  const filename = `${safeRecognitionKey}-input${extname}`
  let pipeline = sharp(sourceBuffer, { failOn: 'error' }).rotate()
  if (shouldResizeRecognitionImage(metadata, size)) {
    pipeline = pipeline.resize({
      width: size.width,
      height: size.height,
      fit: 'inside',
      withoutEnlargement: true
    })
  }
  if (hasAlpha) {
    pipeline = pipeline.png()
  } else {
    pipeline = pipeline.jpeg({ quality: 88 })
  }
  const outputBuffer = await pipeline.toBuffer()
  const outputMetadata = await sharp(outputBuffer).metadata()
  if (
    outputMetadata.width > MAX_RECOGNITION_IMAGE_SIZE ||
    outputMetadata.height > MAX_RECOGNITION_IMAGE_SIZE
  ) {
    throw new Error('recognition input image size exceeds 1280px')
  }
  const writeResult = await coverImageTempFileService.writeBufferFile({
    jobId,
    filename,
    buffer: outputBuffer
  })
  return {
    inputFilePath: writeResult.filePath,
    previewUrl: writeResult.previewUrl,
    mimeType,
    width: outputMetadata.width || size.width,
    height: outputMetadata.height || size.height,
    fileSize: writeResult.fileSize,
    dataUrl: `data:${mimeType};base64,${outputBuffer.toString('base64')}`
  }
}

module.exports = {
  MAX_RECOGNITION_IMAGE_SIZE,
  calculateRecognitionResize,
  createRecognitionInputImage,
  shouldResizeRecognitionImage
}
