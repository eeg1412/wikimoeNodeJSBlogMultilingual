<template>
  <div class="entity-list-page">
    <div class="entity-list-header">
      <h3>{{ meta.label || type }}列表</h3>
    </div>
    <div class="entity-list-filter">
      <el-select
        v-model="query.languageCode"
        placeholder="语言"
        clearable
        style="width: 120px"
        @change="reload"
      >
        <el-option
          v-for="code in site.supportedLanguageCodes"
          :key="code"
          :label="code"
          :value="code"
        />
      </el-select>
      <el-select
        v-model="query.translationStatus"
        placeholder="翻译状态"
        clearable
        style="width: 160px; margin-left: 8px"
        @change="reload"
      >
        <el-option
          v-for="s in TRANSLATION_STATUS_OPTIONS"
          :key="s.value"
          :label="s.label"
          :value="s.value"
        />
      </el-select>
      <el-input
        v-model="query.keyword"
        placeholder="关键字（名称/sourceId）"
        clearable
        style="width: 260px; margin-left: 8px"
        @change="reload"
      />
    </div>

    <el-table :data="list" v-loading="loading" border stripe size="small">
      <el-table-column prop="languageCode" label="语言" width="80" />
      <el-table-column :label="primaryColumnLabel" min-width="220">
        <template #default="{ row }">
          <router-link
            :to="`/entity/${type}/edit/${row._id}`"
            class="entity-list-title-link"
          >
            {{ rowLabel(row) || '(未填写)' }}
          </router-link>
        </template>
      </el-table-column>
      <el-table-column prop="sourceId" label="sourceId" width="180" />
      <el-table-column label="翻译状态" width="130">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="translationTagType(row.translationStatus)"
          >
            {{ row.translationStatus }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="手工编辑" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.isManualEdited" size="small" type="info">是</el-tag>
          <span v-else class="text-muted">否</span>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170">
        <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button link type="primary" @click="goEdit(row)">编辑</el-button>
          <el-button
            v-if="row.translationStatus !== 'approved'"
            link
            type="success"
            @click="approve(row)"
            >批准</el-button
          >
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listEntityApi, approveEntityApi } from '@/api/entity'
import { useSiteStore } from '@/store/site'
import {
  ENTITY_TYPE_MAP,
  TRANSLATION_STATUS_OPTIONS,
  translationTagType
} from '@/utils/entityMeta'

export default {
  name: 'EntityList',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const site = useSiteStore()
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)
    const type = computed(() => route.params.type)
    const meta = computed(() => ENTITY_TYPE_MAP[type.value] || {})
    const primaryColumnLabel = computed(() => meta.value.label || '名称')
    const query = reactive({
      page: 1,
      limit: 20,
      languageCode: '',
      translationStatus: '',
      keyword: ''
    })

    function rowLabel(row) {
      if (meta.value.isRelated) {
        const p = row && row.payload
        if (p && typeof p.title === 'string' && p.title) return p.title
        return (row && (row.title || row.name)) || ''
      }
      const f = meta.value.labelField
      return f ? row[f] : ''
    }

    async function load() {
      loading.value = true
      try {
        const params = {}
        Object.keys(query).forEach(k => {
          if (query[k] !== '' && query[k] !== null && query[k] !== undefined) {
            params[k] = query[k]
          }
        })
        const resp = await listEntityApi(type.value, params)
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
    function goEdit(row) {
      router.push(`/entity/${type.value}/edit/${row._id}`)
    }
    async function approve(row) {
      try {
        await ElMessageBox.confirm('确认将该条目标记为 approved?', '批准', {
          type: 'warning'
        })
      } catch (_) {
        return
      }
      await approveEntityApi(type.value, row._id)
      ElMessage.success('已批准')
      load()
    }
    function formatTime(v) {
      if (!v) return ''
      try {
        return new Date(v).toLocaleString()
      } catch (_) {
        return String(v)
      }
    }

    watch(
      () => route.params.type,
      () => {
        query.page = 1
        load()
      }
    )
    onMounted(load)

    return {
      site,
      type,
      meta,
      primaryColumnLabel,
      list,
      total,
      loading,
      query,
      reload,
      onPageChange,
      goEdit,
      approve,
      rowLabel,
      formatTime,
      translationTagType,
      TRANSLATION_STATUS_OPTIONS
    }
  }
}
</script>

<style scoped>
.entity-list-header {
  margin-bottom: 12px;
}
.entity-list-filter {
  margin-bottom: 12px;
}
.entity-list-title-link {
  color: var(--el-color-primary);
  text-decoration: none;
}
.entity-list-title-link:hover {
  text-decoration: underline;
}
.text-muted {
  color: #999;
}
</style>
