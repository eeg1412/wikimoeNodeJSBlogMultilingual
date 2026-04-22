import { findPostForDetail } from '../../../mongodb/utils/posts.js'
import { resolveContentHtmlAssets } from '../../../utils/sourceAssetResolver.js'
import { getSystemConfig } from '../../../config/globalConfig.js'

export default async function blogPostDetailHandler(req, res, next) {
  try {
    const { lang, id } = req.params
    const post = await findPostForDetail(id, lang)

    if (!post) {
      return res.status(404).json({ message: '文章不存在' })
    }

    // 解析正文 HTML 中的内部资源路径
    const systemConfig = getSystemConfig()
    if (post.content && systemConfig.sourceBlogPublicOrigin) {
      post.content = resolveContentHtmlAssets(
        post.content,
        systemConfig.sourceBlogPublicOrigin
      )
    }

    return res.json({ data: post })
  } catch (err) {
    next(err)
  }
}
