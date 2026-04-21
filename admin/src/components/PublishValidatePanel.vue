<template>
  <el-card class="publish-validate-panel" shadow="never">
    <template #header>
      <div class="publish-validate-panel-header">
        <span>发布校验</span>
        <div class="publish-validate-panel-actions">
          <el-tag
            v-if="lastCheckedAt"
            type="info"
            size="small"
            :title="lastCheckedAt"
          >
            {{ formatTime(lastCheckedAt) }}
          </el-tag>
          <el-button size="small" :loading="validating" @click="runValidate">
            重新校验
          </el-button>
          <el-button
            type="primary"
            size="small"
            :disabled="!passed"
            :loading="publishing"
            @click="doPublish"
          >
            立即发布
          </el-button>
          <el-button size="small" :loading="unpublishing" @click="doUnpublish">
            撤回为草稿
          </el-button>
        </div>
      </div>
    </template>

    <div class="publish-validate-panel-summary">
      <el-tag v-if="passed" type="success">校验通过</el-tag>
      <el-tag v-else type="danger">未通过</el-tag>
      <span class="publish-validate-panel-count">
        error: {{ errorCount }} / warn: {{ warnCount }}
      </span>
    </div>

    <el-table
      v-if="issues.length"
      :data="issues"
      size="small"
      border
      class="publish-validate-panel-table"
    >
      <el-table-column label="级别" width="80">
        <template #default="{ row }">
          <el-tag
            :type="row.level === 'error' ? 'danger' : 'warning'"
            size="small"
          >
            {{ row.level }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="code" label="编码" width="220" />
      <el-table-column prop="message" label="说明" />
      <el-table-column label="详情" width="320">
        <template #default="{ row }">
          <pre v-if="row.meta" class="publish-validate-panel-meta">{{
            JSON.stringify(row.meta, null, 0)
          }}</pre>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else description="暂无 issue" :image-size="60" />
  </el-card>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { validatePostApi, publishPostApi, unpublishPostApi } from '@/api/post'

export default {
  name: 'PublishValidatePanel',
  props: {
    postId: { type: String, required: true },
    initialState: {
      type: Object,
      default: () => ({ passed: false, issues: [], checkedAt: null })
    }
  },
  emits: ['status-change'],
  setup(props, { emit }) {
    const issues = ref(
      Array.isArray(props.initialState.issues)
        ? props.initialState.issues.slice()
        : []
    )
    const passed = ref(!!props.initialState.passed)
    const lastCheckedAt = ref(props.initialState.checkedAt || null)
    const validating = ref(false)
    const publishing = ref(false)
    const unpublishing = ref(false)

    const errorCount = computed(
      () => issues.value.filter(i => i.level === 'error').length
    )
    const warnCount = computed(
      () => issues.value.filter(i => i.level === 'warn').length
    )

    watch(
      () => props.initialState,
      v => {
        if (!v) return
        issues.value = Array.isArray(v.issues) ? v.issues.slice() : []
        passed.value = !!v.passed
        lastCheckedAt.value = v.checkedAt || null
      },
      { deep: true }
    )

    function formatTime(v) {
      if (!v) return ''
      try {
        return new Date(v).toLocaleString()
      } catch (_) {
        return String(v)
      }
    }

    async function runValidate() {
      validating.value = true
      try {
        const resp = await validatePostApi(props.postId)
        const data = (resp && resp.data) || {}
        issues.value = Array.isArray(data.issues) ? data.issues : []
        passed.value = !!data.passed
        lastCheckedAt.value = new Date().toISOString()
        ElMessage[data.passed ? 'success' : 'warning'](
          data.passed ? '校验通过' : '存在 error/warn，请确认'
        )
      } finally {
        validating.value = false
      }
    }

    async function doPublish() {
      try {
        await ElMessageBox.confirm('确认发布该文章？', '发布确认', {
          confirmButtonText: '发布',
          cancelButtonText: '取消'
        })
      } catch (_) {
        return
      }
      publishing.value = true
      try {
        await publishPostApi(props.postId)
        ElMessage.success('已发布')
        emit('status-change', 'published')
      } catch (err) {
        const details = err?.response?.data?.errors?.[0]?.details
        if (details && details.issues) {
          issues.value = details.issues
          passed.value = false
        }
      } finally {
        publishing.value = false
      }
    }

    async function doUnpublish() {
      try {
        await ElMessageBox.confirm('将该文章回退为草稿？', '撤回发布', {
          confirmButtonText: '撤回',
          cancelButtonText: '取消'
        })
      } catch (_) {
        return
      }
      unpublishing.value = true
      try {
        await unpublishPostApi(props.postId)
        ElMessage.success('已撤回为草稿')
        emit('status-change', 'draft')
      } finally {
        unpublishing.value = false
      }
    }

    return {
      issues,
      passed,
      lastCheckedAt,
      validating,
      publishing,
      unpublishing,
      errorCount,
      warnCount,
      formatTime,
      runValidate,
      doPublish,
      doUnpublish
    }
  }
}
</script>

<style scoped>
.publish-validate-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.publish-validate-panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.publish-validate-panel-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.publish-validate-panel-count {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.publish-validate-panel-meta {
  margin: 0;
  font-size: 11px;
  max-height: 96px;
  overflow: auto;
  background: var(--el-fill-color-lighter);
  padding: 4px 6px;
  border-radius: 3px;
  word-break: break-all;
  white-space: pre-wrap;
}
.publish-validate-panel-table {
  margin-top: 8px;
}
</style>
