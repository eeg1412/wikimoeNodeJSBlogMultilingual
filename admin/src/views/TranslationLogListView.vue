<template>
  <div class="page-stack">
    <el-card>
      <template #header>AI 翻译日志</template>
      <ResponsiveTable :data="list">
        <ResponsiveTableColumn label="实体类型" prop="entityType" />
        <ResponsiveTableColumn label="实体 ID" prop="entityId" />
        <ResponsiveTableColumn label="字段" prop="fieldPath" />
        <ResponsiveTableColumn label="语言" prop="languageCode" />
        <ResponsiveTableColumn label="模型" prop="model" />
        <ResponsiveTableColumn label="成功">
          <template #default="{ row }">
            {{ row.success ? '是' : '否' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="时间">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { authApi } from '@/api'

const list = ref([])

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

async function loadList() {
  const result = await authApi.getTranslationLogs({ page: 1, limit: 50 })
  list.value = result.list
}

onMounted(loadList)
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}
</style>