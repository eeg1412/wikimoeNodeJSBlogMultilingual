const cheerio = require('cheerio')

const {
  resolveSourceAssetUrl
} = require('../../../common/utils/sourceAssetResolver')

function rewriteAttribute($, selector, attributeName, sourceBlogPublicOrigin) {
  $(selector).each(function () {
    const element = $(this)
    const currentValue = element.attr(attributeName)

    if (!currentValue) {
      return
    }

    const resolvedValue = resolveSourceAssetUrl(
      currentValue,
      sourceBlogPublicOrigin
    )
    element.attr(attributeName, resolvedValue)
  })
}

function resolveContentAssets(content, sourceBlogPublicOrigin) {
  if (!content) {
    return ''
  }

  const $ = cheerio.load(content, {
    decodeEntities: false
  })

  rewriteAttribute($, 'img[src]', 'src', sourceBlogPublicOrigin)
  rewriteAttribute($, 'video[src]', 'src', sourceBlogPublicOrigin)
  rewriteAttribute($, 'source[src]', 'src', sourceBlogPublicOrigin)
  rewriteAttribute($, 'a[href]', 'href', sourceBlogPublicOrigin)

  return $.html()
}

module.exports = {
  resolveContentAssets
}
