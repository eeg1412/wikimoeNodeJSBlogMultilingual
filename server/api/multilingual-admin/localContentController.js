const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const cacheDataUtils = require('../../config/cacheData')
const { normalizeLanguageCode } = require('../../utils/language')
const utils = require('../../utils/utils')
const {
  ApiError,
  ERROR_CODES,
  handleApiError
} = require('../../utils/multilingualAdminResponse')

const DEFAULT_LANGUAGE_CODE = 'zh-CN'
const RECORD_KIND = 'translation'

function getLanguageCode(value) {
  const languageCode = normalizeLanguageCode(value || DEFAULT_LANGUAGE_CODE)
  if (!languageCode) {
    throw new ApiError(ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED)
  }

  return languageCode
}

function getRequestLanguageCode(req) {
  const body = req.body || {}
  const query = req.query || {}
  return getLanguageCode(body.languageCode || query.languageCode)
}

function getModel(name) {
  const repository = global.$mongodDB.multilingual.repositories[name]
  if (!repository || !repository.model) {
    throw new Error(`${name} repository not found`)
  }

  return repository.model
}

function getObjectId(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.CONTENT_ID_INVALID, undefined, 'id')
  }

  return new mongoose.Types.ObjectId(id)
}

function normalizeString(value) {
  if (typeof value === 'undefined' || value === null) {
    return ''
  }

  return String(value)
}

function normalizeNumber(value, defaultValue = 0) {
  const numberValue = Number(value)
  if (Number.isNaN(numberValue)) {
    return defaultValue
  }

  return numberValue
}

function normalizeBoolean(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true
  }

  return false
}

function getLanguageParams(languageCode, params = {}) {
  return {
    languageCode,
    recordKind: RECORD_KIND,
    ...params
  }
}

function refreshCache(type, languageCode) {
  let promise = null
  if (type === 'navi') {
    promise = cacheDataUtils.getNaviList(languageCode)
  }
  if (type === 'banner') {
    promise = cacheDataUtils.getBannerList(languageCode)
  }
  if (type === 'sidebar') {
    promise = cacheDataUtils.getSidebarList(languageCode)
  }

  if (promise && typeof promise.catch === 'function') {
    promise.catch(() => {})
  }
}

function getNaviData(body, languageCode) {
  return {
    naviname: normalizeString(body.naviname),
    url: normalizeString(body.url),
    newtab: normalizeBoolean(body.newtab),
    status: normalizeNumber(body.status),
    taxis: normalizeNumber(body.taxis),
    parent: body.parent || null,
    isdefault: normalizeBoolean(body.isdefault),
    deepmatch: normalizeBoolean(body.deepmatch),
    query: normalizeString(body.query),
    languageCode,
    recordKind: RECORD_KIND
  }
}

function assertNaviData(data) {
  if (!data.naviname) {
    throw new ApiError(ERROR_CODES.CONTENT_FIELD_INVALID, '请输入导航名称')
  }
  if (data.parent && !mongoose.Types.ObjectId.isValid(data.parent)) {
    throw new ApiError(ERROR_CODES.CONTENT_ID_INVALID, undefined, 'parent')
  }
}

function getBannerData(body, languageCode) {
  return {
    title: normalizeString(body.title),
    taxis: normalizeNumber(body.taxis),
    link: normalizeString(body.link),
    status: normalizeNumber(body.status),
    isdefault: normalizeBoolean(body.isdefault),
    newtab: normalizeBoolean(body.newtab),
    languageCode,
    recordKind: RECORD_KIND
  }
}

function setBannerImage(params, img, id) {
  if (!img) {
    return
  }

  const base64Reg = /^data:image\/\w+;base64,/
  if (!base64Reg.test(img)) {
    params.img = normalizeString(img)
    return
  }

  const imgRes = utils.base64ToFile(img, './public/upload/banner/', id, {
    createDir: true
  })
  params.img = `/multilingual-assets/upload/banner/${imgRes.fileNameAll}?v=${Date.now()}`
  params.imgPath = imgRes.filepath
}

function getSidebarData(body, languageCode) {
  return {
    title: normalizeString(body.title),
    content: normalizeString(body.content),
    count: normalizeNumber(body.count, 1),
    type: normalizeNumber(body.type, 1),
    taxis: normalizeNumber(body.taxis),
    status: normalizeNumber(body.status),
    languageCode,
    recordKind: RECORD_KIND
  }
}

async function getNaviList(req) {
  const languageCode = getRequestLanguageCode(req)
  const NaviModel = getModel('navis')
  const list = await NaviModel.find(getLanguageParams(languageCode))
    .sort({ taxis: 1, _id: -1 })
    .lean()

  return { data: utils.generateTreeData(list) }
}

async function getNaviDetail(req) {
  const id = getObjectId(req.query.id)
  const languageCode = getRequestLanguageCode(req)
  const NaviModel = getModel('navis')
  const data = await NaviModel.findOne(
    getLanguageParams(languageCode, { _id: id })
  ).lean()
  if (!data) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND)
  }

  return { data }
}

async function createNavi(req) {
  const languageCode = getRequestLanguageCode(req)
  const data = getNaviData(req.body, languageCode)
  assertNaviData(data)

  const NaviModel = getModel('navis')
  const record = await NaviModel.create(data)
  refreshCache('navi', languageCode)
  return { data: record }
}

async function updateNavi(req) {
  const id = getObjectId(req.body.id)
  const languageCode = getRequestLanguageCode(req)
  const data = getNaviData(req.body, languageCode)
  assertNaviData(data)
  if (data.parent && String(data.parent) === String(id)) {
    throw new ApiError(ERROR_CODES.CONTENT_FIELD_INVALID, '父级不能和自己相同')
  }
  delete data.languageCode
  delete data.recordKind

  const NaviModel = getModel('navis')
  const result = await NaviModel.updateOne(
    getLanguageParams(languageCode, { _id: id }),
    { $set: data, $inc: { __v: 1 } }
  )
  if (result.matchedCount === 0) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND)
  }

  refreshCache('navi', languageCode)
  return { data: result }
}

async function deleteNavi(req) {
  const id = getObjectId(req.query.id)
  const languageCode = getRequestLanguageCode(req)
  const NaviModel = getModel('navis')
  const result = await NaviModel.deleteOne(
    getLanguageParams(languageCode, { _id: id })
  )
  if (result.deletedCount === 0) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND)
  }

  refreshCache('navi', languageCode)
  return { data: { message: '删除成功' } }
}

async function getBannerList(req) {
  const languageCode = getRequestLanguageCode(req)
  const BannerModel = getModel('banners')
  const params = getLanguageParams(languageCode)
  const list = await BannerModel.find(params).sort({ taxis: 1, _id: -1 }).lean()
  const total = await BannerModel.countDocuments(params)
  return { list, total }
}

async function createBanner(req) {
  const languageCode = getRequestLanguageCode(req)
  const BannerModel = getModel('banners')
  const data = getBannerData(req.body, languageCode)
  const record = await BannerModel.create(data)
  refreshCache('banner', languageCode)
  return { data: record }
}

async function updateBanner(req) {
  const id = getObjectId(req.body._id)
  const languageCode = getRequestLanguageCode(req)
  const data = getBannerData(req.body, languageCode)
  delete data.languageCode
  delete data.recordKind
  setBannerImage(data, req.body.img, String(id))
  if (data.status === 1 && !data.img) {
    const BannerModel = getModel('banners')
    const oldRecord = await BannerModel.findOne(
      getLanguageParams(languageCode, { _id: id }),
      'img'
    ).lean()
    if (!oldRecord || !oldRecord.img) {
      throw new ApiError(ERROR_CODES.CONTENT_FIELD_INVALID, '图片不能为空')
    }
  }

  const BannerModel = getModel('banners')
  const result = await BannerModel.updateOne(
    getLanguageParams(languageCode, { _id: id }),
    { $set: data, $inc: { __v: 1 } }
  )
  if (result.matchedCount === 0) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND)
  }

  refreshCache('banner', languageCode)
  return { data: result }
}

async function deleteBanner(req) {
  const id = getObjectId(req.query.id)
  const languageCode = getRequestLanguageCode(req)
  const BannerModel = getModel('banners')
  const oldRecord = await BannerModel.findOne(
    getLanguageParams(languageCode, { _id: id })
  ).lean()
  if (!oldRecord) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND)
  }
  if (oldRecord.imgPath) {
    try {
      fs.unlinkSync(path.join('./', oldRecord.imgPath))
    } catch (error) {}
  }

  const result = await BannerModel.deleteOne(
    getLanguageParams(languageCode, { _id: id })
  )
  if (result.deletedCount === 0) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND)
  }

  refreshCache('banner', languageCode)
  return { data: { message: '删除成功' } }
}

async function updateBannerTaxis(req) {
  const languageCode = getRequestLanguageCode(req)
  const BannerModel = getModel('banners')
  const bannerList = req.body.bannerList || []
  const data = []
  for (const item of bannerList) {
    if (!mongoose.Types.ObjectId.isValid(item._id)) {
      continue
    }
    const result = await BannerModel.updateOne(
      getLanguageParams(languageCode, {
        _id: new mongoose.Types.ObjectId(item._id)
      }),
      { $set: { taxis: normalizeNumber(item.taxis) }, $inc: { __v: 1 } }
    )
    data.push(result)
  }

  refreshCache('banner', languageCode)
  return { data, successCount: data.length }
}

async function getSidebarList(req) {
  const languageCode = getRequestLanguageCode(req)
  const SidebarModel = getModel('sidebars')
  const list = await SidebarModel.find(getLanguageParams(languageCode))
    .sort({ taxis: 1, _id: -1 })
    .lean()

  return { list }
}

async function createSidebar(req) {
  const languageCode = getRequestLanguageCode(req)
  const data = getSidebarData(req.body, languageCode)
  const SidebarModel = getModel('sidebars')
  const multipleType = [1, 10, 11]
  if (!multipleType.includes(data.type)) {
    const existing = await SidebarModel.findOne(
      getLanguageParams(languageCode, { type: data.type })
    ).lean()
    if (existing) {
      throw new ApiError(ERROR_CODES.CONTENT_FIELD_INVALID, '该侧边栏已存在')
    }
  }

  const record = await SidebarModel.create(data)
  refreshCache('sidebar', languageCode)
  return { data: record }
}

async function updateSidebar(req) {
  const id = getObjectId(req.body._id)
  const languageCode = getRequestLanguageCode(req)
  const data = getSidebarData(req.body, languageCode)
  delete data.languageCode
  delete data.recordKind
  delete data.type
  delete data.taxis

  const SidebarModel = getModel('sidebars')
  const result = await SidebarModel.updateOne(
    getLanguageParams(languageCode, { _id: id }),
    { $set: data, $inc: { __v: 1 } }
  )
  if (result.matchedCount === 0) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND)
  }

  refreshCache('sidebar', languageCode)
  return { data: result }
}

async function deleteSidebar(req) {
  const id = getObjectId(req.query.id)
  const languageCode = getRequestLanguageCode(req)
  const SidebarModel = getModel('sidebars')
  const result = await SidebarModel.deleteOne(
    getLanguageParams(languageCode, { _id: id })
  )
  if (result.deletedCount === 0) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND)
  }

  refreshCache('sidebar', languageCode)
  return { data: { message: '删除成功' } }
}

async function updateSidebarTaxis(req) {
  const languageCode = getRequestLanguageCode(req)
  const SidebarModel = getModel('sidebars')
  const sidebarList = req.body.sidebarList || []
  const data = []
  for (const item of sidebarList) {
    if (!mongoose.Types.ObjectId.isValid(item._id)) {
      continue
    }
    const result = await SidebarModel.updateOne(
      getLanguageParams(languageCode, {
        _id: new mongoose.Types.ObjectId(item._id)
      }),
      { $set: { taxis: normalizeNumber(item.taxis) }, $inc: { __v: 1 } }
    )
    data.push(result)
  }

  refreshCache('sidebar', languageCode)
  return { data, successCount: data.length }
}

function controller(handler, logMessage) {
  return async function (req, res) {
    try {
      const data = await handler(req)
      res.send(data)
    } catch (error) {
      handleApiError(res, error, logMessage)
    }
  }
}

module.exports = {
  getNaviList: controller(getNaviList, 'multilingual navi list get fail'),
  getNaviDetail: controller(getNaviDetail, 'multilingual navi detail get fail'),
  createNavi: controller(createNavi, 'multilingual navi create fail'),
  updateNavi: controller(updateNavi, 'multilingual navi update fail'),
  deleteNavi: controller(deleteNavi, 'multilingual navi delete fail'),
  getBannerList: controller(getBannerList, 'multilingual banner list get fail'),
  createBanner: controller(createBanner, 'multilingual banner create fail'),
  updateBanner: controller(updateBanner, 'multilingual banner update fail'),
  deleteBanner: controller(deleteBanner, 'multilingual banner delete fail'),
  updateBannerTaxis: controller(
    updateBannerTaxis,
    'multilingual banner taxis update fail'
  ),
  getSidebarList: controller(
    getSidebarList,
    'multilingual sidebar list get fail'
  ),
  createSidebar: controller(createSidebar, 'multilingual sidebar create fail'),
  updateSidebar: controller(updateSidebar, 'multilingual sidebar update fail'),
  deleteSidebar: controller(deleteSidebar, 'multilingual sidebar delete fail'),
  updateSidebarTaxis: controller(
    updateSidebarTaxis,
    'multilingual sidebar taxis update fail'
  )
}
