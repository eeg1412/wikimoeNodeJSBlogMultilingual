const bcrypt = require('bcryptjs')
const { adminLoginSchema } = require('@wikimoe-ml/common/validation')
const { AdminUsers } = require('../../../mongodb/models')
const { signAdminToken } = require('../../../utils/jwt')
const { unauthorized, forbidden } = require('../../../utils/errors')

module.exports = async function login(req, res) {
  const { value, error } = adminLoginSchema.validate(req.body || {}, {
    abortEarly: false
  })
  if (error) throw error

  const admin = await AdminUsers.findOne({ username: value.username })
  if (!admin) throw unauthorized('账号或密码错误')
  if (admin.disabled) throw forbidden('账号已禁用')

  const ok = await bcrypt.compare(value.password, admin.password)
  if (!ok) throw unauthorized('账号或密码错误')

  const token = signAdminToken({
    adminId: admin._id.toString(),
    pwv: admin.pwversion || 0
  })

  res.json({
    data: {
      token,
      admin: {
        _id: admin._id,
        username: admin.username,
        nickname: admin.nickname,
        role: admin.role
      }
    }
  })
}
