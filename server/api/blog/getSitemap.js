const { Posts, Sorts } = require('../../mongodb/models')
const { POST_STATUS_PUBLISHED } = require('@wikimoe-ml/common/constants')
const { getAllOptions } = require('../../utils/options')
const { SUPPORTED_LANGUAGE_CODES } = require('@wikimoe-ml/common/constants')

function escapeXml(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function trimTrailingSlash(s) {
  return (s || '').replace(/\/+$/, '')
}

function buildPostUrl(origin, lang, post) {
  const idPart =
    post.alias && post.alias.length > 0 ? post.alias : String(post._id)
  return `${origin}/${lang}/post/${encodeURIComponent(idPart)}`
}

module.exports = async function getSitemap(req, res) {
  const options = await getAllOptions()
  const origin = trimTrailingSlash(options.siteUrl || '')
  const enableSitemap = options.siteEnableSitemap !== false

  res.set('Content-Type', 'application/xml; charset=utf-8')

  if (!enableSitemap) {
    const empty =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`
    res.send(empty)
    return
  }

  // 按 groupSourceId 聚合已发布文章，每组输出一条带 xhtml:link hreflang alternate 的 <url>
  const posts = await Posts.find({
    status: POST_STATUS_PUBLISHED
  })
    .select('_id alias languageCode groupSourceId lastChangDate updatedAt')
    .lean()

  const groupMap = new Map()
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i]
    const key = p.groupSourceId
    if (!groupMap.has(key)) {
      groupMap.set(key, [])
    }
    groupMap.get(key).push(p)
  }

  const urls = []

  // 首页（每种语言一条）
  for (let i = 0; i < SUPPORTED_LANGUAGE_CODES.length; i++) {
    const lang = SUPPORTED_LANGUAGE_CODES[i]
    urls.push({
      loc: `${origin}/${lang}`,
      lastmod: null,
      alternates: SUPPORTED_LANGUAGE_CODES.map(l => ({
        hreflang: l,
        href: `${origin}/${l}`
      }))
    })
  }

  // 文章
  groupMap.forEach(group => {
    const alternates = group.map(p => ({
      hreflang: p.languageCode,
      href: buildPostUrl(origin, p.languageCode, p)
    }))
    for (let i = 0; i < group.length; i++) {
      const p = group[i]
      urls.push({
        loc: buildPostUrl(origin, p.languageCode, p),
        lastmod: p.lastChangDate || p.updatedAt || null,
        alternates
      })
    }
  })

  // 分类列表页
  const sorts = await Sorts.find({}).select('_id alias languageCode').lean()
  for (let i = 0; i < sorts.length; i++) {
    const s = sorts[i]
    const idPart = s.alias && s.alias.length > 0 ? s.alias : String(s._id)
    urls.push({
      loc: `${origin}/${s.languageCode}/post/list/sort/${encodeURIComponent(idPart)}`,
      lastmod: null,
      alternates: []
    })
  }

  const lines = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
  )
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i]
    lines.push('  <url>')
    lines.push(`    <loc>${escapeXml(u.loc)}</loc>`)
    if (u.lastmod) {
      lines.push(`    <lastmod>${new Date(u.lastmod).toISOString()}</lastmod>`)
    }
    for (let j = 0; j < u.alternates.length; j++) {
      const a = u.alternates[j]
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}"/>`
      )
    }
    lines.push('  </url>')
  }
  lines.push('</urlset>')
  res.send(lines.join('\n'))
}
