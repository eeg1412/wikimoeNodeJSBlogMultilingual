<template>
  <AdminPage
    title="文章管理"
    description="集中查看每篇原文在不同语言下的发布状态，快速进入编辑器处理标题、正文与发布元数据。"
  >
    <template #meta>
      <div class="admin-stat-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">文章组数量</div>
          <div class="admin-stat-card__value">{{ total }}</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">当前筛选语言</div>
          <div class="admin-stat-card__value">
            {{ query.languageCode || '全部' }}
          </div>
        </div>
      </div>
    </template>

    <el-card shadow="never">
      <div class="admin-filter-row">
        <div class="admin-filter-row__main">
          <el-select
            v-model="query.languageCode"
            placeholder="语言"
            clearable
            style="width: 140px"
          >
            <el-option label="en" value="en" />
            <el-option label="jp" value="jp" />
            <el-option label="tw" value="tw" />
          </el-select>
          <el-select
            v-model="query.status"
            placeholder="状态"
            clearable
            style="width: 140px"
          >
            <el-option label="草稿" :value="0" />
            <el-option label="已发布" :value="1" />
          </el-select>
          <el-select
            v-model="query.type"
            placeholder="内容类型"
            clearable
            style="width: 160px"
          >
            <el-option label="文章" :value="1" />
            <el-option label="推文" :value="2" />
          </el-select>
          <el-input
            v-model="query.keyword"
            placeholder="搜索 sourceId / 标题"
            clearable
            style="min-width: 220px; max-width: 320px"
            @keyup.enter="fetchList"
          />
          <el-button type="primary" @click="fetchList">查询</el-button>
        </div>
        <div class="admin-filter-row__hint">
          支持按语言、发布状态、内容类型和关键词交叉筛选。
        </div>
      </div>

      <ResponsiveTable :data="list" :loading="loading" row-key="groupKey">
        <ResponsiveTableColumn prop="sourceId" label="Source ID" width="120" />
        <ResponsiveTableColumn
          prop="sourceAlias"
          label="原始别名"
          show-overflow-tooltip
        />
        <ResponsiveTableColumn prop="type" label="类型" width="80">
          <template #default="{ row }">
            {{ row.type === 2 ? '推文' : '文章' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="en" width="120">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <el-tag size="small" :type="statusType(getLangEntry(row, 'en'))">
                {{ statusLabel(getLangEntry(row, 'en')) }}
              </el-tag>
              <el-button
                v-if="getLangEntry(row, 'en')"
                type="primary"
                link
                size="small"
                @click="goEdit(getLangEntry(row, 'en')._id)"
                >编辑</el-button
              >
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="jp" width="120">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <el-tag size="small" :type="statusType(getLangEntry(row, 'jp'))">
                {{ statusLabel(getLangEntry(row, 'jp')) }}
              </el-tag>
              <el-button
                v-if="getLangEntry(row, 'jp')"
                type="primary"
                link
                size="small"
                @click="goEdit(getLangEntry(row, 'jp')._id)"
                >编辑</el-button
              >
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="tw" width="120">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <el-tag size="small" :type="statusType(getLangEntry(row, 'tw'))">
                {{ statusLabel(getLangEntry(row, 'tw')) }}
              </el-tag>
              <el-button
                v-if="getLangEntry(row, 'tw')"
                type="primary"
                link
                size="small"
                @click="goEdit(getLangEntry(row, 'tw')._id)"
                >编辑</el-button
              >
            </div>
          </template>
        </ResponsiveTableColumn>

        <template #mobile-card="{ row }">
          <div class="space-y-2">
            <div class="font-medium truncate">
              {{ row.sourceAlias || row.sourceId }}
            </div>
            <div class="text-xs text-gray-500">sourceId: {{ row.sourceId }}</div>
            <div class="text-xs text-gray-500">
              类型：{{ row.type === 2 ? '推文' : '文章' }}
            </div>
            <div class="space-y-1">
              <div
                v-for="lang in ['en', 'jp', 'tw']"
                :key="lang"
                class="flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <span class="text-xs uppercase text-gray-500">{{ lang }}</span>
                  <el-tag size="small" :type="statusType(getLangEntry(row, lang))">
                    {{ statusLabel(getLangEntry(row, lang)) }}
                  </el-tag>
                </div>
                <el-button
                  v-if="getLangEntry(row, lang)"
                  type="primary"
                  link
                  size="small"
                  @click="goEdit(getLangEntry(row, lang)._id)"
                  >编辑</el-button
                >
              </div>
            </div>
          </div>
        </template>
      </ResponsiveTable>

      <div class="admin-pagination">
        <el-pagination
          v-model:current-page="query.page"
          :page-size="20"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="fetchList"
        />
      </div>
    </el-card>
  </AdminPage>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getPostGroupList } from '../api/post.js'
import AdminPage from '../components/AdminPage.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import ResponsiveTableColumn from '../components/ResponsiveTableColumn.vue'

export default {
  name: 'PostGroupList',
  components: { AdminPage, ResponsiveTable, ResponsiveTableColumn },
  setup() {
    const router = useRouter()
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)

    const query = reactive({
      page: 1,
      languageCode: '',
      status: null,
      type: null,
      keyword: ''
    })

    async function fetchList() {
      loading.value = true
      try {
        const params = { ...query }
        if (params.status === null || params.status === '') delete params.status
        if (params.type === null || params.type === '') delete params.type
        if (!params.keyword) delete params.keyword
        if (!params.languageCode) delete params.languageCode

        const res = await getPostGroupList(params)
        list.value = res.data?.list || []
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    function goEdit(id) {
      router.push(`/multilingual-admin/posts/edit/${id}`)
    }

    function getLangEntry(row, languageCode) {
      if (!row || !Array.isArray(row.langs)) {
        return null
      }
      return row.langs.find(item => item.languageCode === languageCode) || null
    }

    function statusType(entry) {
      if (!entry) {
        return 'info'
      }
      if (entry.status === 1) {
        return 'success'
      }
      return 'warning'
    }

    function statusLabel(entry) {
      if (!entry) {
        return '缺失'
      }
      if (entry.status === 1) {
        return '已发布'
      }
      return '草稿'
    }

    onMounted(fetchList)

    return {
      list,
      total,
      loading,
      query,
      fetchList,
      goEdit,
      getLangEntry,
      statusType,
      statusLabel
    }
  }
}
</script>
