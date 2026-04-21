<template>
  <div class="memory-list-page">
    <h3>翻译记忆</h3>
    <div class="memory-list-filter">
      <el-select
        v-model="query.targetLanguageCode"
        placeholder="目标语言"
        clearable
        style="width: 140px"
        @change="reload"
      >
        <el-option
          v-for="code in site.supportedLanguageCodes"
          :key="code"
          :label="code"
          :value="code"
        />
      </el-select>
      <el-input
        v-model="query.fieldKind"
        placeholder="fieldKind（如 title / entity:author）"
        clearable
        style="width: 240px; margin-left: 8px"
        @change="reload"
      />
      <el-select
        v-model="query.approved"
        placeholder="审批状态"
        clearable
        style="width: 140px; margin-left: 8px"
        @change="reload"
      >
        <el-option label="已批准" value="true" />
        <el-option label="未批准" value="false" />
      </el-select>
      <el-input
        v-model="query.keyword"
        placeholder="原文/译文关键字"
        clearable
        style="width: 240px; margin-left: 8px"
        @change="reload"
      />
    </div>

    <el-table :data="list" v-loading="loading" border stripe size="small">
      <el-table-column prop="targetLanguageCode" label="语言" width="80" />
      <el-table-column prop="fieldKind" label="fieldKind" width="160" />
      <el-table-column label="原文" min-width="280">
        <template #default="{ row }">
          <div class="memory-cell">{{ row.sourceText }}</div>
        </template>
      </el-table-column>
      <el-table-column label="译文" min-width="280">
        <template #default="{ row }">
          <el-input
            v-model="row.translatedText"
            type="textarea"
            :rows="2"
            resize="vertical"
          />
        </template>
      </el-table-column>
      <el-table-column label="批准" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.approved" size="small" type="success"
            >已批准</el-tag
          >
          <el-tag v-else size="small" type="info">未批准</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button
            v-if="!row.approved"
            link
            type="success"
            @click="toggleApprove(row, true)"
            >批准</el-button
          >
          <el-button
            v-else
            link
            type="warning"
            @click="toggleApprove(row, false)"
            >撤销</el-button
          >
          <el-button link type="primary" @click="saveText(row)"
            >保存译文</el-button
          >
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      background
      layout="prev, pager, next, total"
      :current-page="query.page"
      :page-size="query.limit"
      :total="total"
      @current-change="onPageChange"
      style="margin-top: 12px"
    />
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listTranslationMemoriesApi,
  approveTranslationMemoryApi,
  deleteTranslationMemoryApi
} from '@/api/translation'
import { useSiteStore } from '@/store/site'

export default {
  name: 'TranslationMemoryList',
  setup() {
    const site = useSiteStore()
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)
    const query = reactive({
      page: 1,
      limit: 20,
      targetLanguageCode: '',
      fieldKind: '',
      approved: '',
      keyword: ''
    })

    async function load() {
      loading.value = true
      try {
        const params = {}
        Object.keys(query).forEach(k => {
          if (query[k] !== '' && query[k] !== null && query[k] !== undefined) {
            params[k] = query[k]
          }
        })
        const resp = await listTranslationMemoriesApi(params)
        list.value = (resp && resp.data && resp.data.list) || []
        total.value = (resp && resp.data && resp.data.total) || 0
      } finally {
        loading.value = false
      }
    }
    function reload() {
      query.page = 1
      load()
    }
    function onPageChange(p) {
      query.page = p
      load()
    }
    async function toggleApprove(row, approved) {
      await approveTranslationMemoryApi({
        id: row._id,
        approved,
        translatedText: row.translatedText
      })
      ElMessage.success(approved ? '已批准' : '已撤销')
      load()
    }
    async function saveText(row) {
      await approveTranslationMemoryApi({
        id: row._id,
        approved: !!row.approved,
        translatedText: row.translatedText
      })
      ElMessage.success('已保存')
    }
    async function remove(row) {
      try {
        await ElMessageBox.confirm('确认删除该翻译记忆?', '删除', {
          type: 'warning'
        })
      } catch (_) {
        return
      }
      await deleteTranslationMemoryApi(row._id)
      ElMessage.success('已删除')
      load()
    }

    onMounted(load)

    return {
      site,
      list,
      total,
      loading,
      query,
      reload,
      onPageChange,
      toggleApprove,
      saveText,
      remove
    }
  }
}
</script>

<style scoped>
.memory-list-filter {
  margin-bottom: 12px;
}
.memory-cell {
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 80px;
  overflow: auto;
  font-size: 12px;
}
</style>
