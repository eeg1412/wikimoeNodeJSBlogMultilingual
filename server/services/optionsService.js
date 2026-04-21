const defaultOptions = require('../config/options-defaults')
const db = require('../mongodb')

async function ensureDefaultOptions() {
  const entries = Object.entries(defaultOptions)
  for (const [key, value] of entries) {
    await db.utils.options.upsertOne(
      { key },
      { key, value },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  }
}

async function getOptionList() {
  return db.utils.options.find({}, undefined, { sort: { key: 1 } })
}

async function getOptionMap() {
  const docs = await getOptionList()
  return docs.reduce((result, item) => {
    result[item.key] = item.value
    return result
  }, {})
}

async function updateOption(key, value) {
  return db.utils.options.upsertOne({ key }, { key, value })
}

module.exports = {
  ensureDefaultOptions,
  getOptionList,
  getOptionMap,
  updateOption
}