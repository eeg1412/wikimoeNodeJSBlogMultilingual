import Option from '../models/option.js'

export async function findOptionsByNamespace(namespace) {
  return Option.find({ namespace }).lean()
}

export async function findOptionByKey(namespace, key) {
  return Option.findOne({ namespace, key }).lean()
}

export async function upsertOption(namespace, key, value, updatedBy) {
  return Option.findOneAndUpdate(
    { namespace, key },
    { $set: { value, updatedBy, updatedAt: new Date() } },
    { upsert: true, new: true }
  )
}
