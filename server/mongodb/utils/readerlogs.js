const readerlogsModel = require('../models/readerlogs')

exports.findOne = async function (parmas, projection) {
  // document查询
  return await readerlogsModel.findOne(parmas, projection)
}

// 查找所有
exports.find = async function (parmas, sort, projection) {
  // document查询
  return await readerlogsModel.find(parmas, projection).sort(sort)
}

// 分页查询
exports.findPage = async function (parmas, sort, page, limit, projection) {
  // document查询
  const list = await readerlogsModel
    .find(parmas, projection)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
  const total = await readerlogsModel.countDocuments(parmas)
  // 查询失败
  if (!list || total === undefined) {
    throw new Error('查询失败')
  }
  return {
    list,
    total
  }
}

// count
exports.count = async function (filters) {
  // document查询
  return await readerlogsModel.countDocuments(filters)
}

// aggregate
exports.aggregate = async function (aggregates) {
  // document查询
  return await readerlogsModel.aggregate(aggregates)
}
