const UAParser = require('ua-parser-js')

function getRequestIp(req) {
  const forwardedForHeader = req.headers['x-forwarded-for']

  if (forwardedForHeader) {
    const firstForwardedIp = String(forwardedForHeader).split(',')[0]
    if (firstForwardedIp && firstForwardedIp.trim()) {
      return firstForwardedIp.trim()
    }
  }

  if (req.ip) {
    return String(req.ip).trim()
  }

  if (req.socket && req.socket.remoteAddress) {
    return String(req.socket.remoteAddress).trim()
  }

  return 'unknown'
}

function getRequestDeviceInfo(req) {
  const userAgent = req.headers['user-agent'] || ''
  const parser = new UAParser(userAgent)
  const parsedDeviceInfo = parser.getResult()

  return {
    rawUserAgent: userAgent,
    browser: parsedDeviceInfo.browser,
    device: parsedDeviceInfo.device,
    engine: parsedDeviceInfo.engine,
    os: parsedDeviceInfo.os,
    cpu: parsedDeviceInfo.cpu
  }
}

function getRequestIpInfo(ipAddress) {
  return {
    rawIp: ipAddress
  }
}

module.exports = {
  getRequestDeviceInfo,
  getRequestIp,
  getRequestIpInfo
}
