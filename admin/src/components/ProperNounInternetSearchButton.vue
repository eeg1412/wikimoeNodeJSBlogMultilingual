<template>
  <span class="proper-noun-internet-search-launcher">
    <el-button
      :type="type"
      :size="size"
      :plain="plain"
      :disabled="disabled"
      @click="openDialog"
    >
      {{ buttonText }}
      <span v-if="displayCount > 0">{{ displayCount }}</span>
    </el-button>
    <ProperNounInternetSearchDialog
      v-model="dialogVisible"
      :source-id="sourceId"
      :source-language-code="sourceLanguageCode"
      :term-ids="termIds"
      :default-language-codes="defaultLanguageCodes"
      :title="title"
      @applied="handleApplied"
    />
  </span>
</template>

<script>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ProperNounInternetSearchDialog from '@/components/ProperNounInternetSearchDialog.vue'

export default {
  name: 'ProperNounInternetSearchButton',
  components: {
    ProperNounInternetSearchDialog
  },
  props: {
    buttonText: {
      type: String,
      default: '联网检索'
    },
    title: {
      type: String,
      default: '联网搜索译名'
    },
    type: {
      type: String,
      default: 'success'
    },
    size: {
      type: String,
      default: ''
    },
    plain: {
      type: Boolean,
      default: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    disabledMessage: {
      type: String,
      default: '请先选择需要联网检索的名词'
    },
    sourceId: {
      type: String,
      default: ''
    },
    sourceLanguageCode: {
      type: String,
      default: ''
    },
    termIds: {
      type: Array,
      default() {
        return []
      }
    },
    defaultLanguageCodes: {
      type: Array,
      default() {
        return []
      }
    },
    count: {
      type: Number,
      default: 0
    }
  },
  emits: ['applied'],
  setup(props, { emit }) {
    const dialogVisible = ref(false)

    const displayCount = computed(() => {
      if (props.count > 0) {
        return props.count
      }
      return 0
    })

    const hasSearchTarget = computed(() => {
      if (props.termIds.length > 0) {
        return true
      }
      return Boolean(props.sourceId)
    })

    function openDialog() {
      if (props.disabled) {
        if (props.disabledMessage) {
          ElMessage.warning(props.disabledMessage)
        }
        return
      }
      if (!hasSearchTarget.value) {
        ElMessage.warning('没有可联网检索的名词')
        return
      }
      dialogVisible.value = true
    }

    function handleApplied(data) {
      emit('applied', data)
    }

    return {
      dialogVisible,
      displayCount,
      handleApplied,
      openDialog
    }
  }
}
</script>

<style scoped>
.proper-noun-internet-search-launcher {
  display: inline-flex;
  vertical-align: middle;
}
</style>
