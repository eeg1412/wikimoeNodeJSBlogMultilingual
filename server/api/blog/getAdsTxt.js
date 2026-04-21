const { getAllOptions } = require('../../utils/options')

module.exports = async function getAdsTxt(req, res) {
  const options = await getAllOptions()
  res.set('Content-Type', 'text/plain; charset=utf-8')
  res.send(options.AdAdsTxt || '')
}
