<template>
  <div class="page-stack">
    <el-card>
      <template #header>{{ meta.title }} 独立管理</template>
      <el-form :model="filters" inline>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable placeholder="支持标题或名称搜索" />
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="filters.languageCode" clearable style="width: 140px">
            <el-option label="English" value="en" />
            <el-option label="Japanese" value="jp" />
            <el-option label="Traditional Chinese" value="tw" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadList">筛选</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <ResponsiveTable :data="list">
        <ResponsiveTableColumn label="展示名">
          <template #default="{ row }">
            {{ getEntityLabel(entityType, row) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源文 ID" prop="sourceId" />
        <ResponsiveTableColumn label="语言" prop="languageCode" />
        <ResponsiveTableColumn label="翻译状态" prop="translationStatus" />
        <ResponsiveTableColumn label="操作">
          <template #default="{ row }">
            <el-button type="primary" link @click="openDialog(row)">编辑</el-button>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="`编辑${meta.title}`" width="720px">
      <el-form v-if="form" label-position="top">
        <el-form-item
          v-for="field in meta.fields"
          :key="field.key"
          :label="field.label"
        >
          <el-input
            v-if="field.type === 'input'"
            v-model="form[field.key]"
          />
          <el-input
            v-else-if="field.type === 'textarea'"
            v-model="form[field.key]"
            type="textarea"
            :rows="4"
          />
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="form[field.key]"
            class="w_10"
          />
          <el-select
            v-else-if="field.type === 'select'"
            v-model="form[field.key]"
            class="w_10"
          >
            <el-option
              v-for="option in field.options"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-input
            v-else-if="field.type === 'json'"
            v-model="jsonFields[field.key]"
            type="textarea"
            :rows="6"
          />
        </el-form-item>
        <el-form-item label="来源快照(JSON)">
          <el-input :model-value="sourceSnapshotText" type="textarea" :rows="8" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '@/api'
import { ENTITY_META, getEntityLabel } from '@/constants/entities'

const route = useRoute()
const entityType = computed(() => route.meta.entityType)
const meta = computed(() => ENTITY_META[entityType.value])
const list = ref([])
const dialogVisible = ref(false)
const filters = reactive({
  keyword: '',
  languageCode: ''
})
const form = ref(null)
const jsonFields = reactive({})

const sourceSnapshotText = computed(() =>
  form.value?.sourceSnapshot
    ? JSON.stringify(form.value.sourceSnapshot, null, 2)
    : '{}'
)

async function loadList() {
  const result = await authApi.getEntityList(entityType.value, {
    page: 1,
    limit: 50,
    ...filters
  })
  list.value = result.list
}

async function openDialog(row) {
  const detail = await authApi.getEntityDetail(entityType.value, row._id)
  form.value = JSON.parse(JSON.stringify(detail))
  Object.keys(jsonFields).forEach(key => delete jsonFields[key])
  for (const field of meta.value.fields.filter(item => item.type === 'json')) {
    jsonFields[field.key] = JSON.stringify(form.value[field.key] || [], null, 2)
  }
  dialogVisible.value = true
}

async function save() {
  try {
    const payload = { ...form.value }
    for (const field of meta.value.fields.filter(item => item.type === 'json')) {
      payload[field.key] = JSON.parse(jsonFields[field.key] || '[]')
    }
    await authApi.updateEntity(entityType.value, payload)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadList()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

watch(entityType, () => {
  loadList()
})

onMounted(loadList)
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}
</style>