const postsUtils = require('../mongodb/utils/posts')

async function validatePostForPublish(post) {
  const errors = []

  if (!post.title || !String(post.title).trim()) {
    errors.push('标题不能为空')
  }

  if (!post.alias || !String(post.alias).trim()) {
    errors.push('别名不能为空')
  }

  if (!post.date) {
    errors.push('发布时间不能为空')
  }

  if (!post.content || !String(post.content).trim()) {
    errors.push('正文不能为空')
  }

  if (post.alias && post.languageCode) {
    const duplicatedPost = await postsUtils.findOne(
      {
        languageCode: post.languageCode,
        alias: String(post.alias).trim(),
        _id: {
          $ne: post._id
        }
      },
      '_id'
    )

    if (duplicatedPost) {
      errors.push('当前语言下别名已被其他文章占用')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    checkedAt: new Date()
  }
}

module.exports = {
  validatePostForPublish
}
