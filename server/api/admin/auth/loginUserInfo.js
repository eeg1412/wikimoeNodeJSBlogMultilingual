export default async function loginUserInfoHandler(req, res, next) {
  try {
    const admin = req.adminUser
    return res.json({
      data: {
        _id: admin._id,
        username: admin.username,
        nickname: admin.nickname,
        role: admin.role
      }
    })
  } catch (err) {
    next(err)
  }
}
