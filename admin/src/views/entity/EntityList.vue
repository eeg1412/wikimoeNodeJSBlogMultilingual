<template>
  <div class="entity-list-page">
    <section class="entity-list-hero">
      <div>
        <div class="entity-list-eyebrow">Shared Entity</div>
        <h2 class="entity-list-title">{{ meta.label || type }}列表</h2>
        <p class="entity-list-subtitle">
          共享实体按语言维度复用。这里的修改会影响当前语言下所有引用该实体的文章，请在编辑前确认影响范围。
        </p>
      </div>
      <div class="entity-list-hero-badge">{{ total }} 条记录</div>
    </section>

    <el-alert
      type="warning"
      show-icon
      :closable="false"
      class="entity-list-alert"
      title="共享实体保存后会立即影响当前语言下所有引用文章，已发布文章不会自动回草稿。"
    />

    <el-card shadow="never" class="entity-list-card">
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
          style="width: 160px"
          @change="reload"
        >
          <el-option
            v-for="status in TRANSLATION_STATUS_OPTIONS"
            :key="status.value"
            :label="status.label"
            :value="status.value"
          />
        </el-select>
        <el-input
          v-model="query.keyword"
          placeholder="名称 / sourceId"
          clearable
          style="width: 280px"
          @change="reload"
        />
      </div>

      <ResponsiveTable :data="list" row-key="_id" border v-loading="loading">
        <ResponsiveTableColumn prop="languageCode" label="语言" width="80" />
        <ResponsiveTableColumn :label="primaryColumnLabel" min-width="240">
          <template #default="{ row }">
            <div class="entity-list-main-cell">
              <button
                class="entity-list-title-link"
                type="button"
                @click="goEdit(row)"
              >
                {{ rowLabel(row) || '(未填写)' }}
              </button>
              <div class="entity-list-subtext">
                sourceId: {{ row.sourceId || '-' }}
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="摘要" min-width="240">
          <template #default="{ row }">
            <div class="entity-list-preview">{{ rowPreview(row) }}</div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="翻译状态" width="130">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="translationTagType(row.translationStatus)"
            >
              {{ row.translationStatus }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="手工编辑" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.isManualEdited" size="small" type="info"
              >已人工处理</el-tag
            >
            <span v-else class="text-muted">否</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="更新时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.updatedAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="180" card-action>
          <template #default="{ row }">
            <el-button link type="primary" @click="goEdit(row)">编辑</el-button>
            <el-button
              v-if="row.translationStatus !== 'approved'"
              link
              type="success"
              @click="approve(row)"
            >
              批准
            </el-button>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>

      <el-pagination
        background
        layout="prev, pager, next, total"
        :current-page="query.page"
        :page-size="query.limit"
        :total="total"
        @current-change="onPageChange"
        style="margin-top: 16px"
      />
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listEntityApi, approveEntityApi } from '@/api/entity'
import { useSiteStore } from '@/store/site'
import ResponsiveTable from '@/components/ResponsiveTable.vue'
import ResponsiveTableColumn from '@/components/ResponsiveTableColumn.vue'
import {
  ENTITY_TYPE_MAP,
  TRANSLATION_STATUS_OPTIONS,
  translationTagType
} from '@/utils/entityMeta'

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
    const payload = row && row.payload
    if (payload && typeof payload.title === 'string' && payload.title) {
      return payload.title
    }
    return (row && (row.title || row.name)) || ''
  }
  const field = meta.value.labelField
  return field ? row[field] : ''
}

function rowPreview(row) {
  if (!row) return '-'
  if (type.value === 'author') return row.description || '暂无简介'
  if (type.value === 'sort')
    return row.description || row.template || '暂无描述'
  if (type.value === 'tag') return '标签实体，主要用于文章聚合'
  if (type.value === 'mappoint') return row.summary || '暂无地点摘要'
  if (type.value === 'attachment') {
    const summary = [row.attachmentSourceType, row.filename].filter(Boolean)
    return summary.length ? summary.join(' / ') : '附件信息'
  }
  if (meta.value.isRelated) {
    if (
      row.payload &&
      typeof row.payload.description === 'string' &&
      row.payload.description
    ) {
      return row.payload.description
    }
    if (
      row.payload &&
      typeof row.payload.summary === 'string' &&
      row.payload.summary
    ) {
      return row.payload.summary
    }
    if (type.value === 'vote' && Array.isArray(row.options)) {
      return `选项数：${row.options.length}`
    }
    return '关联实体译文条目'
  }
  return '-'
}

async function load() {
  loading.value = true
  try {
    await site.load()
    const params = {}
    Object.keys(query).forEach(key => {
      if (
        query[key] !== '' &&
        query[key] !== null &&
        query[key] !== undefined
      ) {
        params[key] = query[key]
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

function onPageChange(page) {
  query.page = page
  load()
}

function goEdit(row) {
  router.push(`/entity/${type.value}/edit/${row._id}`)
}

async function approve(row) {
  try {
    await ElMessageBox.confirm('确认将该共享实体标记为 approved?', '批准', {
      type: 'warning'
    })
  } catch (_) {
    return
  }
  await approveEntityApi(type.value, row._id)
  ElMessage.success('已批准')
  load()
}

function formatTime(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString()
  } catch (_) {
    return String(value)
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
</script>

<style scoped>
.entity-list-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.entity-list-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px;
  border-radius: 28px;
  background: linear-gradient(135deg, #ffffff 0%, #f5f8fe 100%);
  border: 1px solid rgba(17, 24, 39, 0.06);
}

.entity-list-eyebrow {
  color: #677791;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  margin-bottom: 8px;
}

.entity-list-title {
  margin: 0;
  font-size: 30px;
  color: #172033;
}

.entity-list-subtitle {
  margin: 10px 0 0;
  color: #65748e;
  line-height: 1.8;
  max-width: 760px;
}

.entity-list-hero-badge {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
  font-weight: 600;
}

.entity-list-alert {
  border-radius: 18px;
}

.entity-list-card {
  border-radius: 24px;
}

.entity-list-filter {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.entity-list-main-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.entity-list-title-link {
  border: none;
  padding: 0;
  background: none;
  color: var(--el-color-primary);
  text-align: left;
  font-weight: 600;
  cursor: pointer;
}

.entity-list-subtext,
.entity-list-preview {
  color: #69788f;
  font-size: 12px;
  line-height: 1.7;
}

.entity-list-preview {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.text-muted {
  color: #8a97aa;
}

@media (max-width: 768px) {
  .entity-list-hero {
    flex-direction: column;
    padding: 20px;
  }

  .entity-list-title {
    font-size: 26px;
  }
}
</style>
