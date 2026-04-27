import { proxySourceAsset } from '../../utils/sourceAssetProxy'

export default defineEventHandler(event => {
  return proxySourceAsset(event)
})
