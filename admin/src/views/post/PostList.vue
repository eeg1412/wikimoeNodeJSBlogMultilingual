<template>
  <div class="post-list-page">
    <div class="post-list-filter">
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
        v-model="query.type"
        placeholder="类型"
        clearable
        style="width: 120px; margin-left: 8px"
        @change="reload"
      >
        <el-option label="博文" :value="1" />
        <el-option label="推文" :value="2" />
      </el-select>
      <el-select
        v-model="query.status"
        placeholder="状态"
        clearable
        style="width: 120px; margin-left: 8px"
        @change="reload"
      >
        <el-option label="草稿" :value="0" />
        <el-option label="已发布" :value="1" />
        <el-option label="回收站" :value="99" />
      </el-select>
      <el-input
        v-model="query.keyword"
        placeholder="标题/别名/sourceId"
        clearable
        style="width: 260px; margin-left: 8px"
        @change="reload"
      />
    </div>

    <el-table :data="list" v-loading="loading" border stripe size="small">
      <el-table-column prop="languageCode" label="语言" width="80" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">
          {{ row.type === 1 ? '博文' : row.type === 2 ? '推文' : row.type }}
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="220">
        <template #default="{ row }">
          <router-link
            :to="`/post/edit/${row._id}`"
            class="post-list-title-link"
          >
            {{ row.title || '(未命名)' }}
          </router-link>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.status === 1" type="success" size="small"
            >已发布</el-tag
          >
          <el-tag v-else-if="row.status === 99" type="info" size="small"
            >回收站</el-tag
          >
          <el-tag v-else type="warning" size="small">草稿</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="翻译状态" width="120">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="translationTagType(row.translationStatus)"
          >
            {{ row.translationStatus }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="groupSourceId" label="分组" width="180" />
      <el-table-column label="更新时间" width="170">
        <template #default="{ row }">
          {{ formatTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button link type="primary" @click="goEdit(row)">编辑</el-button>
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
import { useRouter } from 'vue-router'
import { listPostsApi } from '@/api/post'
import { useSiteStore } from '@/store/site'

const TRANSLATION_TAG_TYPE = {
  approved: 'success',
  not_required: 'success',
  ai_draft: 'warning',
  manual_draft: 'warning',
  outdated: 'danger',
  pending: 'info',
  stub: 'info'
}

export default {
  name: 'PostList',
  setup() {
    const router = useRouter()
    const site = useSiteStore()
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)
    const query = reactive({
      page: 1,
      limit: 20,
      languageCode: '',
      type: null,
      status: null,
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
        const resp = await listPostsApi(params)
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
      router.push(`/post/edit/${row._id}`)
    }
    function formatTime(v) {
      if (!v) return ''
      try {
        return new Date(v).toLocaleString()
      } catch (_) {
        return String(v)
      }
    }
    function translationTagType(s) {
      return TRANSLATION_TAG_TYPE[s] || 'info'
    }

    onMounted(load)

    return {
      site,
      list,
      total,
      loading,
      query,
      load,
      reload,
      onPageChange,
      goEdit,
      formatTime,
      translationTagType
    }
  }
}
</script>

<style scoped>
.post-list-filter {
  margin-bottom: 12px;
}
.post-list-title-link {
  color: var(--el-color-primary);
  text-decoration: none;
}
.post-list-title-link:hover {
  text-decoration: underline;
}
</style>
