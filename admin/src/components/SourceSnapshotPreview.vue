<template>
  <el-popover
    v-if="formattedSnapshot"
    placement="top-start"
    :width="420"
    trigger="click"
  >
    <template #reference>
      <el-button type="primary" link size="small">查看源数据</el-button>
    </template>

    <pre class="source-snapshot-preview">{{ formattedSnapshot }}</pre>
  </el-popover>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'SourceSnapshotPreview',
  props: {
    snapshot: {
      type: [Object, Array],
      default: null
    }
  },
  setup(props) {
    const formattedSnapshot = computed(() => {
      if (!props.snapshot) {
        return ''
      }

      return JSON.stringify(props.snapshot, null, 2)
    })

    return {
      formattedSnapshot
    }
  }
}
</script>

<style scoped>
.source-snapshot-preview {
  max-height: 360px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.5;
}
</style>
