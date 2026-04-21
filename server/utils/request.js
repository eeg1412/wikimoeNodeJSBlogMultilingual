const UAParser = require('ua-parser-js')

function getUserIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    return String(forwarded).split(',')[0].trim()
  }
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  )
}

function getDeviceInfo(req) {
  const parser = new UAParser(req.headers['user-agent'] || '')
  return parser.getResult()
}

module.exports = {
  getDeviceInfo,
  getUserIp
}