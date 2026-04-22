<template>
  <span v-if="!device" class="text-gray-400">-</span>
  <el-tooltip v-else :content="tooltipContent" placement="top">
    <span class="cursor-default text-sm">{{ displayText }}</span>
  </el-tooltip>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'DeviceInfoDisplay',
  props: {
    device: {
      type: Object,
      default: null
    }
  },
  setup(props) {
    const displayText = computed(() => {
      if (!props.device) return '-'
      return props.device.browser?.name || props.device.ua?.slice(0, 30) || '-'
    })

    const tooltipContent = computed(() => {
      if (!props.device) return '-'
      const browser = [
        props.device.browser?.name,
        props.device.browser?.version
      ]
        .filter(Boolean)
        .join(' ')
      const os = [props.device.os?.name, props.device.os?.version]
        .filter(Boolean)
        .join(' ')
      const deviceType = props.device.device?.type || 'desktop'
      return [browser, os, deviceType].filter(Boolean).join(' | ')
    })

    return { displayText, tooltipContent }
  }
}
</script>
