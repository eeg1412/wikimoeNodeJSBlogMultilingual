import {
  findEntityPage,
  updateEntityById
} from '../../../mongodb/utils/entities.js'
import { sharedEntityUpdateSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'

/**
 * 生成 list + update 处理器对
 * @param {string} entityType
 */
function createEntityHandlers(entityType) {
  const listHandler = async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1
      const limit = Math.min(parseInt(req.query.limit) || 20, 100)
      const query = {}
      if (req.query.languageCode) query.languageCode = req.query.languageCode
      const { list, total } = await findEntityPage({
        entityType,
        query,
        page,
        limit
      })
      return res.json({ data: { list, total, page, limit } })
    } catch (err) {
      next(err)
    }
  }

  const updateHandler = async (req, res, next) => {
    try {
      const { id } = req.params
      const { value, error } = validateData(sharedEntityUpdateSchema, req.body)
      if (error) {
        return res.status(400).json({ errors: [{ message: error }] })
      }
      const doc = await updateEntityById(entityType, id, value)
      if (!doc) {
        return res.status(404).json({ message: `${entityType} 不存在` })
      }
      return res.json({ data: doc })
    } catch (err) {
      next(err)
    }
  }

  return { listHandler, updateHandler }
}

export const {
  listHandler: bangumiListHandler,
  updateHandler: bangumiUpdateHandler
} = createEntityHandlers('Bangumi')
export const {
  listHandler: movieListHandler,
  updateHandler: movieUpdateHandler
} = createEntityHandlers('Movie')
export const {
  listHandler: gameListHandler,
  updateHandler: gameUpdateHandler
} = createEntityHandlers('Game')
export const {
  listHandler: bookListHandler,
  updateHandler: bookUpdateHandler
} = createEntityHandlers('Book')
export const {
  listHandler: eventListHandler,
  updateHandler: eventUpdateHandler
} = createEntityHandlers('Event')
