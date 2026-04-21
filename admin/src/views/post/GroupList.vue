<template>
  <div class="group-list-page">
    <section class="group-list-hero">
      <div>
        <div class="group-list-eyebrow">Group Matrix</div>
        <h2 class="group-list-title">多语言分组视图</h2>
        <p class="group-list-subtitle">
          按原文 sourceId 聚合，横向观察 en / jp / tw
          的导入、翻译和发布状态。缺失语种可以直接从这里补导入。
        </p>
      </div>
      <div class="group-list-hero-actions">
        <el-button type="primary" @click="router.push('/import')"
          >新建导入</el-button
        >
        <el-button @click="load">刷新</el-button>
      </div>
    </section>

    <el-card shadow="never" class="group-list-card">
      <div class="group-list-filter">
        <el-select
          v-model="query.type"
          placeholder="类型"
          clearable
          style="width: 120px"
          @change="reload"
        >
          <el-option label="博文" :value="1" />
          <el-option label="推文" :value="2" />
        </el-select>
        <el-select
          v-model="query.status"
          placeholder="状态"
          clearable
          style="width: 120px"
          @change="reload"
        >
          <el-option label="草稿" :value="0" />
          <el-option label="已发布" :value="1" />
          <el-option label="回收站" :value="99" />
        </el-select>
        <el-select
          v-model="query.languageCode"
          placeholder="聚焦语言"
          clearable
          style="width: 130px"
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
          <el-option label="pending" value="pending" />
          <el-option label="ai_draft" value="ai_draft" />
          <el-option label="manual_draft" value="manual_draft" />
          <el-option label="approved" value="approved" />
          <el-option label="not_required" value="not_required" />
          <el-option label="stub" value="stub" />
          <el-option label="outdated" value="outdated" />
        </el-select>
        <el-input
          v-model="query.keyword"
          placeholder="标题 / alias / sourceId / groupSourceId"
          clearable
          style="width: 300px"
          @change="reload"
        />
      </div>

      <ResponsiveTable
        :data="list"
        row-key="groupSourceId"
        border
        v-loading="loading"
      >
        <ResponsiveTableColumn
          prop="groupSourceId"
          label="分组"
          min-width="220"
        >
          <template #default="{ row }">
            <div class="group-list-main-cell">
              <div class="group-list-main-title">
                {{
                  row.title ||
                  row.sourceAlias ||
                  row.sourceId ||
                  row.groupSourceId
                }}
              </div>
              <div class="group-list-main-sub">
                groupSourceId: {{ row.groupSourceId }}
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="元信息" min-width="220">
          <template #default="{ row }">
            <div class="group-list-meta">
              <div>类型：{{ postTypeLabel(row.type) }}</div>
              <div>作者：{{ row.author?.nickname || '未关联' }}</div>
              <div>分类：{{ row.sort?.sortname || '未关联' }}</div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="语言矩阵" min-width="360">
          <template #default="{ row }">
            <div class="group-list-languages">
              <div
                v-for="code in site.supportedLanguageCodes"
                :key="code"
                class="group-list-language-card"
              >
                <div class="group-list-language-head">
                  <span>{{ code.toUpperCase() }}</span>
                  <el-tag
                    v-if="row.languages?.[code]"
                    size="small"
                    :type="postStatusType(row.languages[code].status)"
                  >
                    {{ postStatusLabel(row.languages[code].status) }}
                  </el-tag>
                  <el-tag v-else size="small" type="info">未导入</el-tag>
                </div>
                <template v-if="row.languages?.[code]">
                  <div class="group-list-language-title">
                    {{
                      row.languages[code].title ||
                      row.languages[code].alias ||
                      '未命名'
                    }}
                  </div>
                  <div class="group-list-language-foot">
                    <el-tag
                      size="small"
                      :type="
                        translationTagType(
                          row.languages[code].translationStatus
                        )
                      "
                    >
                      {{ row.languages[code].translationStatus }}
                    </el-tag>
                    <el-button
                      link
                      type="primary"
                      @click="openLanguage(row, code)"
                      >编辑</el-button
                    >
                  </div>
                </template>
                <template v-else>
                  <div class="group-list-language-empty">该语种尚未导入</div>
                  <el-button
                    link
                    type="primary"
                    @click="importLanguage(row, code)"
                    >导入 {{ code.toUpperCase() }}</el-button
                  >
                </template>
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="更新时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.updatedAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="130" card-action>
          <template #default="{ row }">
            <el-button link type="primary" @click="openPrimary(row)"
              >打开最近版本</el-button
            >
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
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listPostGroupsApi } from '@/api/post'
import { useSiteStore } from '@/store/site'
import ResponsiveTable from '@/components/ResponsiveTable.vue'
import ResponsiveTableColumn from '@/components/ResponsiveTableColumn.vue'

const route = useRoute()
const router = useRouter()
const site = useSiteStore()
const loading = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({
  page: 1,
  limit: 20,
  keyword: '',
  type: null,
  status: null,
  languageCode: '',
  translationStatus: ''
})

function translationTagType(status) {
  if (status === 'approved' || status === 'not_required') return 'success'
  if (status === 'ai_draft' || status === 'manual_draft') return 'warning'
  if (status === 'outdated') return 'danger'
  return 'info'
}

function postStatusType(status) {
  if (status === 1) return 'success'
  if (status === 99) return 'info'
  return 'warning'
}

function postStatusLabel(status) {
  if (status === 1) return '已发布'
  if (status === 99) return '回收站'
  return '草稿'
}

function postTypeLabel(type) {
  if (type === 1) return '博文'
  if (type === 2) return '推文'
  return '未知'
}

function formatTime(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString()
  } catch (_) {
    return String(value)
  }
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
    const resp = await listPostGroupsApi(params)
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

function openLanguage(row, code) {
  const current = row.languages?.[code]
  if (!current?._id) return
  router.push(`/post/edit/${current._id}`)
}

function importLanguage(row, code) {
  router.push({
    path: '/import',
    query: {
      sourceIdentifier: row.sourceId || row.groupSourceId,
      languageCode: code
    }
  })
}

function openPrimary(row) {
  const latestLanguage = site.supportedLanguageCodes.find(
    code => row.languages?.[code]?._id
  )
  if (latestLanguage) {
    openLanguage(row, latestLanguage)
  }
}

onMounted(() => {
  if (typeof route.query.keyword === 'string') {
    query.keyword = route.query.keyword
  }
  load()
})

watch(
  () => route.query.keyword,
  keyword => {
    if (typeof keyword === 'string' && keyword !== query.keyword) {
      query.keyword = keyword
      query.page = 1
      load()
    }
  }
)
</script>

<style scoped>
.group-list-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.group-list-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px;
  border-radius: 28px;
  background: linear-gradient(135deg, #ffffff 0%, #f2f6fd 100%);
  border: 1px solid rgba(17, 24, 39, 0.06);
}

.group-list-eyebrow {
  color: #677791;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  margin-bottom: 8px;
}

.group-list-title {
  margin: 0;
  font-size: 30px;
  color: #172033;
}

.group-list-subtitle {
  margin: 10px 0 0;
  color: #62748d;
  line-height: 1.8;
  max-width: 780px;
}

.group-list-hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.group-list-card {
  border-radius: 24px;
}

.group-list-filter {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.group-list-main-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-list-main-title {
  font-weight: 600;
  color: #172033;
}

.group-list-main-sub,
.group-list-meta {
  font-size: 12px;
  color: #677791;
  line-height: 1.7;
}

.group-list-languages {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.group-list-language-card {
  padding: 12px;
  border-radius: 16px;
  background: #f7f9fc;
  border: 1px solid rgba(17, 24, 39, 0.05);
}

.group-list-language-head,
.group-list-language-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.group-list-language-title {
  margin: 10px 0;
  color: #172033;
  font-size: 13px;
  line-height: 1.6;
}

.group-list-language-empty {
  margin: 10px 0;
  color: #76859d;
  font-size: 13px;
}

@media (max-width: 1200px) {
  .group-list-languages {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .group-list-hero {
    flex-direction: column;
    padding: 20px;
  }

  .group-list-title {
    font-size: 26px;
  }
}
</style>
