import { proxyMultilingualAsset } from '../../../utils/multilingualAssetProxy'

export default defineEventHandler(event => {
  return proxyMultilingualAsset(event)
})
