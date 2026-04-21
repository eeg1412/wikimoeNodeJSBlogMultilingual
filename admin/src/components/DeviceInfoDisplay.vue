<template>
  <div class="device-info-display">
    <div class="device-info-display-line">
      <span class="device-info-display-label">浏览器</span>
      <span>{{ browserText }}</span>
    </div>
    <div class="device-info-display-line">
      <span class="device-info-display-label">系统</span>
      <span>{{ osText }}</span>
    </div>
    <div class="device-info-display-line">
      <span class="device-info-display-label">设备</span>
      <span>{{ deviceText }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: Object,
    default: () => ({})
  }
})

const browserText = computed(() => {
  const browser = props.value.browser || {}
  return [browser.name, browser.version].filter(Boolean).join(' ') || '-'
})

const osText = computed(() => {
  const os = props.value.os || {}
  return [os.name, os.version].filter(Boolean).join(' ') || '-'
})

const deviceText = computed(() => {
  const device = props.value.device || {}
  return [device.vendor, device.model, device.type].filter(Boolean).join(' ') || '-'
})
</script>

<style scoped>
.device-info-display {
  font-size: 12px;
  line-height: 1.6;
}

.device-info-display-line {
  display: flex;
  gap: 8px;
}

.device-info-display-label {
  min-width: 36px;
  color: var(--el-text-color-secondary);
}
</style>