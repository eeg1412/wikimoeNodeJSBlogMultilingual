module.exports = async function getLoginUserInfo(req, res) {
  const admin = req.admin || {}
  res.send({
    data: {
      nickname: admin.nickname,
      id: admin._id,
      role: admin.role,
      photo: admin.photo || null,
      email: admin.email || null,
      description: admin.description || null,
      cover: admin.cover || null
    }
  })
}
