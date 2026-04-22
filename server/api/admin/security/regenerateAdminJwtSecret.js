const { rotateAdminJwtSecret } = require('../../../security/adminJwtSecret')

module.exports = async function (req, res, next) {
  try {
    const rotatedSecret = rotateAdminJwtSecret()

    console.info(
      JSON.stringify({
        action: 'admin-jwt-secret-regenerate',
        operatorAdminId: String(req.adminUser._id),
        username: req.adminUser.username,
        createdAt: new Date().toISOString()
      })
    )

    res.json({
      data: {
        rotated: Boolean(rotatedSecret)
      }
    })
  } catch (error) {
    next(error)
  }
}
