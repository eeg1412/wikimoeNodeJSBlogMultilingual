<template>
  <div class="page-stack">
    <el-card>
      <template #header>文章分组</template>
      <el-form :model="filters" inline>
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
        <el-form-item label="翻译状态">
          <el-select v-model="filters.translationStatus" clearable style="width: 160px">
            <el-option
              v-for="item in translationStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadGroups">筛选</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <ResponsiveTable :data="groups">
        <ResponsiveTableColumn label="源文 ID" prop="sourceId" />
        <ResponsiveTableColumn label="源别名" prop="sourceAlias" />
        <ResponsiveTableColumn label="类型">
          <template #default="{ row }">
            {{ row.type === 1 ? '文章' : '推文' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="EN">
          <template #default="{ row }">
            <StatusButton :value="row.languageStatus.en" @open="openEditor" />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="JP">
          <template #default="{ row }">
            <StatusButton :value="row.languageStatus.jp" @open="openEditor" />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="TW">
          <template #default="{ row }">
            <StatusButton :value="row.languageStatus.tw" @open="openEditor" />
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </el-card>
  </div>
</template>

<script setup>
import { defineComponent, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/api'
import { TRANSLATION_STATUS_OPTIONS } from '@/constants/entities'

const router = useRouter()
const translationStatusOptions = TRANSLATION_STATUS_OPTIONS
const groups = ref([])
const filters = reactive({
  languageCode: '',
  type: undefined,
  translationStatus: ''
})

const StatusButton = defineComponent({
  props: {
    value: {
      type: Object,
      default: null
    }
  },
  emits: ['open'],
  setup(props, { emit }) {
    return () => {
      if (!props.value) {
        return h('span', '-')
      }
      return h(
        'button',
        {
          class: 'status-button',
          onClick: () => emit('open', props.value.postId)
        },
        `${props.value.status === 1 ? '已发布' : '草稿'} / ${props.value.translationStatus}`
      )
    }
  }
})

async function loadGroups() {
  const result = await authApi.getPostGroupList({ page: 1, limit: 50, ...filters })
  groups.value = result.list
}

function openEditor(id) {
  router.push({ name: 'PostEditor', params: { id } })
}

onMounted(loadGroups)
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.status-button {
  background: none;
  border: none;
  color: var(--el-color-primary);
  cursor: pointer;
  text-align: left;
  padding: 0;
}
</style>