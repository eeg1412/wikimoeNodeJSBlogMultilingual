module.exports = async function me(req, res) {
  const admin = req.admin
  res.json({
    data: {
      _id: admin._id,
      username: admin.username,
      nickname: admin.nickname,
      role: admin.role
    }
  })
}
