<template>
  <div class="page-stack">
    <el-card>
      <template #header>文章列表</template>
      <el-form :model="filters" inline>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable placeholder="标题 / 摘要 / alias / sourceId" />
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="filters.languageCode" clearable style="width: 140px">
            <el-option label="English" value="en" />
            <el-option label="Japanese" value="jp" />
            <el-option label="Traditional Chinese" value="tw" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filters.type" clearable style="width: 120px">
            <el-option label="文章" :value="1" />
            <el-option label="推文" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadPosts">筛选</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <ResponsiveTable :data="posts">
        <ResponsiveTableColumn label="标题" prop="title" />
        <ResponsiveTableColumn label="源文 ID" prop="sourceId" />
        <ResponsiveTableColumn label="语言" prop="languageCode" />
        <ResponsiveTableColumn label="类型">
          <template #default="{ row }">
            {{ row.type === 1 ? '文章' : '推文' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="状态">
          <template #default="{ row }">
            {{ row.status === 1 ? '已发布' : row.status === 99 ? '回收站' : '草稿' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="翻译状态" prop="translationStatus" />
        <ResponsiveTableColumn label="更新时间">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEditor(row._id)">编辑</el-button>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/api'

const router = useRouter()
const posts = ref([])
const filters = reactive({
  keyword: '',
  languageCode: '',
  type: undefined
})

function formatDate(value) {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString()
}

async function loadPosts() {
  const result = await authApi.getPostList({ page: 1, limit: 50, ...filters })
  posts.value = result.list
}

function openEditor(id) {
  router.push({ name: 'PostEditor', params: { id } })
}

onMounted(loadPosts)
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}
</style>