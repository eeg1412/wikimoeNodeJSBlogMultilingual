const jwt = require('jsonwebtoken')

const { ensureAdminJwtSecret } = require('./adminJwtSecret')

function signAdminJwt(payload, expiresIn) {
  const secret = ensureAdminJwtSecret()
  return jwt.sign(payload, secret, { expiresIn })
}

function verifyAdminJwt(token) {
  const secret = ensureAdminJwtSecret()
  return jwt.verify(token, secret)
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = String(authorizationHeader).split(' ')

  if (scheme !== 'Bearer') {
    return null
  }

  if (!token) {
    return null
  }

  return token.trim()
}

module.exports = {
  extractBearerToken,
  signAdminJwt,
  verifyAdminJwt
}
