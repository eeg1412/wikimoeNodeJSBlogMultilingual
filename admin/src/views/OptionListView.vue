<template>
  <div class="page-stack">
    <el-card>
      <template #header>站点配置</template>
      <div class="option-grid">
        <el-card v-for="item in options" :key="item.key" class="option-item">
          <div class="option-title">{{ item.key }}</div>
          <el-input
            v-if="typeof item.value === 'string'"
            v-model="item.value"
            type="textarea"
            :rows="item.value.length > 80 ? 5 : 2"
          />
          <el-input-number
            v-else-if="typeof item.value === 'number'"
            v-model="item.value"
            class="w_10"
          />
          <el-switch
            v-else-if="typeof item.value === 'boolean'"
            v-model="item.value"
          />
          <el-input
            v-else
            v-model="jsonValues[item.key]"
            type="textarea"
            :rows="4"
          />
          <el-button type="primary" class="mt10" @click="save(item)">保存</el-button>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { authApi } from '@/api'

const options = ref([])
const jsonValues = reactive({})

async function loadOptions() {
  const list = await authApi.getOptionList()
  options.value = list.map(item => ({ ...item }))
  for (const item of options.value) {
    if (typeof item.value === 'object' && item.value !== null) {
      jsonValues[item.key] = JSON.stringify(item.value, null, 2)
    }
  }
}

async function save(item) {
  try {
    const value =
      typeof item.value === 'object' && item.value !== null
        ? JSON.parse(jsonValues[item.key] || '{}')
        : item.value
    await authApi.updateOption({ key: item.key, value })
    ElMessage.success(`已保存 ${item.key}`)
  } catch (error) {
    ElMessage.error(error.message)
  }
}

onMounted(loadOptions)
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.option-item {
  border-radius: 18px;
}

.option-title {
  font-weight: 700;
  margin-bottom: 12px;
}
</style>