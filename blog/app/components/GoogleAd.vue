<template>
  <div v-if="shouldRender" class="google-ad" :class="slotClass">
    <ins
      class="adsbygoogle"
      style="display: block"
      :data-ad-client="adClient"
      v-bind="dataAttrs"
    ></ins>
  </div>
</template>

<script setup>
const props = defineProps({
  // 广告位参数（来自 options.googleAdPostBottomParams 之类的 JSON 配置）
  params: {
    type: Object,
    default: () => ({})
  },
  slotClass: {
    type: String,
    default: ''
  },
  // 是否由调用方判定是否渲染；默认依赖 site.googleAdEnabled
  enabled: {
    type: Boolean,
    default: null
  }
})

const { enabled: globalEnabled, adClient } = useGoogleAds()

const shouldRender = computed(() => {
  if (!adClient.value) return false
  if (props.enabled === null) return globalEnabled.value
  return Boolean(props.enabled) && globalEnabled.value
})

// 把任意 params 转成 data-* 透传给 ins 标签
const dataAttrs = computed(() => {
  const src = props.params || {}
  const result = {}
  Object.keys(src).forEach(k => {
    if (src[k] === undefined || src[k] === null || src[k] === '') return
    // 允许用户直接写 data-ad-slot 或 adSlot
    if (k.startsWith('data-')) {
      result[k] = String(src[k])
    } else {
      const kebab = k.replace(/([A-Z])/g, '-$1').toLowerCase()
      result[`data-${kebab}`] = String(src[k])
    }
  })
  return result
})

// 每次组件挂载时推一次 adsbygoogle 队列，让 AdSense 渲染本位。
onMounted(() => {
  if (!shouldRender.value) return
  if (typeof window === 'undefined') return
  try {
    window.adsbygoogle = window.adsbygoogle || []
    window.adsbygoogle.push({})
  } catch (_) {
    // 忽略 AdSense 异常，不影响页面渲染
  }
})
</script>

<style scoped>
.google-ad {
  display: block;
  width: 100%;
  margin: 1rem 0;
}
</style>
