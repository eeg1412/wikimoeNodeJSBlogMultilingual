<template>
  <div v-if="message" class="ai-feature-unavailable-tip">
    {{ message }}
  </div>
</template>

<script>
export default {
  name: 'AiFeatureUnavailableTip',
  props: {
    message: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
.ai-feature-unavailable-tip {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
  width: 100%;
}
</style>
