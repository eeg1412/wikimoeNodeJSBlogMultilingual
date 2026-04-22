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
    const normalizedDevice = computed(() => {
      if (!props.device) return null
      if (props.device.browser?.name || props.device.os?.name) {
        return props.device
      }
      return {
        browser: {
          name: props.device.browser || '',
          version: props.device.browserVersion || ''
        },
        os: {
          name: props.device.os || '',
          version: props.device.osVersion || ''
        },
        device: {
          type: props.device.device || 'desktop'
        }
      }
    })

    const displayText = computed(() => {
      if (!normalizedDevice.value) return '-'
      return (
        normalizedDevice.value.browser?.name ||
        normalizedDevice.value.ua?.slice(0, 30) ||
        '-'
      )
    })

    const tooltipContent = computed(() => {
      if (!normalizedDevice.value) return '-'
      const browser = [
        normalizedDevice.value.browser?.name,
        normalizedDevice.value.browser?.version
      ]
        .filter(Boolean)
        .join(' ')
      const os = [
        normalizedDevice.value.os?.name,
        normalizedDevice.value.os?.version
      ]
        .filter(Boolean)
        .join(' ')
      const deviceType = normalizedDevice.value.device?.type || 'desktop'
      return [browser, os, deviceType].filter(Boolean).join(' | ')
    })

    return { displayText, tooltipContent }
  }
}
</script>
