<template>
  <div v-if="message" class="ai-feature-hint-tip">
    {{ message }}
  </div>
</template>

<script>
export default {
  name: 'AiFeatureHintTip',
  props: {
    message: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
.ai-feature-hint-tip {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
  width: 100%;
}
</style>
