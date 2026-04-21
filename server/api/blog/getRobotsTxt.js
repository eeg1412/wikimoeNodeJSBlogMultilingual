const { getAllOptions } = require('../../utils/options')

module.exports = async function getRobotsTxt(req, res) {
  const options = await getAllOptions()
  const body =
    options.siteRobotsTxt && String(options.siteRobotsTxt).trim()
      ? String(options.siteRobotsTxt)
      : 'User-agent: *\nAllow: /'
  const origin = (options.siteUrl || '').replace(/\/+$/, '')
  const lines = [body]
  if (origin && options.siteEnableSitemap !== false) {
    lines.push(`Sitemap: ${origin}/sitemap.xml`)
  }
  res.set('Content-Type', 'text/plain; charset=utf-8')
  res.send(lines.join('\n'))
}
