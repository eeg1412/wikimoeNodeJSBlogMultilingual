const { Sorts, Posts } = require('../../mongodb/models')
const { POST_STATUS_PUBLISHED } = require('@wikimoe-ml/common/constants')
const { parseLang } = require('./_helpers')

// 返回 2 层分类树（与原站保持一致的 children 结构），附带发布文章数量
module.exports = async function getSortList(req, res) {
  const lang = parseLang(req)
  const all = await Sorts.find({ languageCode: lang })
    .sort({ taxis: 1, _id: 1 })
    .lean()

  // 统计每个分类下已发布文章数
  const counts = await Posts.aggregate([
    {
      $match: {
        languageCode: lang,
        status: POST_STATUS_PUBLISHED,
        sort: { $ne: null }
      }
    },
    { $group: { _id: '$sort', count: { $sum: 1 } } }
  ])
  const countMap = {}
  for (let i = 0; i < counts.length; i++) {
    countMap[String(counts[i]._id)] = counts[i].count
  }

  const idMap = {}
  const roots = []
  for (let i = 0; i < all.length; i++) {
    const item = {
      _id: all[i]._id,
      sourceId: all[i].sourceId,
      sortname: all[i].sortname,
      alias: all[i].alias,
      description: all[i].description,
      taxis: all[i].taxis,
      parent: all[i].parent,
      postCount: countMap[String(all[i]._id)] || 0,
      children: []
    }
    idMap[String(item._id)] = item
  }
  for (let i = 0; i < all.length; i++) {
    const node = idMap[String(all[i]._id)]
    if (all[i].parent) {
      const parent = idMap[String(all[i].parent)]
      if (parent) {
        parent.children.push(node)
        continue
      }
    }
    roots.push(node)
  }

  // 把子分类的发布数汇总进父分类（便于前台显示）
  function aggregateCount(node) {
    let total = node.postCount || 0
    for (let i = 0; i < node.children.length; i++) {
      total += aggregateCount(node.children[i])
    }
    node.totalCount = total
    return total
  }
  for (let i = 0; i < roots.length; i++) {
    aggregateCount(roots[i])
  }

  res.json({ list: roots })
}
