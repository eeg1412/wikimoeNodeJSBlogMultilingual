import { buildMultilingualAssetUrl } from '../../../utils/multilingualAssetProxy'

export default defineEventHandler(event => {
  const config = useRuntimeConfig()
  const originalUrl = event.node.req.url || ''
  const assetUrl = originalUrl.replace(
    /^\/api\/multilingual-asset(?=\/|$)/,
    '/multilingual-assets'
  )

  return proxyRequest(event, buildMultilingualAssetUrl(config, assetUrl))
})
