const sharp = require('sharp')
const coverImageTempFileService = require('./coverImageTempFileService')
const { sanitizeSafePathPart } = require('../utils/coverImageTranslationUtils')

async function resizeCoverExact({
  jobId,
  generationKey,
  attemptNo = 1,
  inputBuffer,
  targetWidth,
  targetHeight
}) {
  const width = Number(targetWidth)
  const height = Number(targetHeight)
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error('targetWidth is invalid')
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error('targetHeight is invalid')
  }
  if (!Buffer.isBuffer(inputBuffer)) {
    throw new Error('inputBuffer is required')
  }

  const safeGenerationKey = sanitizeSafePathPart(generationKey, 'generationKey')
  const safeAttemptNo = Number.isInteger(Number(attemptNo))
    ? Number(attemptNo)
    : 1
  const outputBuffer = await sharp(inputBuffer, { failOn: 'error' })
    .rotate()
    .resize({
      width,
      height,
      fit: 'cover',
      position: 'centre'
    })
    .png()
    .toBuffer()
  const metadata = await sharp(outputBuffer).metadata()
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error('postprocessed cover size mismatch')
  }
  const filename = `${safeGenerationKey}-${safeAttemptNo}.png`
  const writeResult = await coverImageTempFileService.writeBufferFile({
    jobId,
    filename,
    buffer: outputBuffer
  })
  return {
    tempFilePath: writeResult.filePath,
    previewUrl: writeResult.previewUrl,
    width,
    height,
    mimeType: 'image/png',
    fileSize: writeResult.fileSize
  }
}

module.exports = {
  resizeCoverExact
}
