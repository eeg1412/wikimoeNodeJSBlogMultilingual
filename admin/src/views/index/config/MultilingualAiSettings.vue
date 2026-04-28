<template>
  <div class="common-right-panel-form multilingual-ai-settings-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>设置</el-breadcrumb-item>
        <el-breadcrumb-item>AI 设置</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <el-skeleton v-if="loading" :rows="8" animated />
    <el-form v-else :model="settingsForm" label-width="180px">
      <div
        v-for="group in fieldGroupOptions"
        :key="group.value"
        class="config-border-item ai-settings-group"
      >
        <div class="config-border-item-title mb10">{{ group.label }}</div>
        <el-row :gutter="18">
          <el-col
            v-for="field in getFieldListByGroup(group.value)"
            :key="field.name"
            :xs="24"
            :md="getColumnSpan(field)"
          >
            <el-form-item :label="field.label">
              <el-switch
                v-if="field.type === 'boolean'"
                v-model="settingsForm[field.name]"
              />
              <el-input-number
                v-else-if="field.type === 'number' || field.type === 'float'"
                v-model="settingsForm[field.name]"
                controls-position="right"
                :min="field.min"
                :max="field.max"
                :step="getNumberStep(field)"
                :precision="getNumberPrecision(field)"
              />
              <el-radio-group
                v-else-if="field.type === 'radio'"
                v-model="settingsForm[field.name]"
              >
                <el-radio
                  v-for="option in field.options || []"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </el-radio>
              </el-radio-group>
              <el-select
                v-else-if="isSelectField(field)"
                v-model="settingsForm[field.name]"
                filterable
                :allow-create="Boolean(field.allowCreate)"
                default-first-option
                class="w_10"
              >
                <el-option
                  v-for="option in field.options || []"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                >
                  <span>{{ option.label }}</span>
                  <span v-if="option.deprecatedAt" class="ai-model-deprecated">
                    将于 {{ option.deprecatedAt }} 弃用
                  </span>
                </el-option>
              </el-select>
              <el-input
                v-else-if="field.type === 'textarea'"
                v-model="settingsForm[field.name]"
                type="textarea"
                :rows="5"
              />
              <el-input
                v-else-if="field.type === 'password'"
                v-model="settingsForm[field.name]"
                type="password"
                show-password
                autocomplete="off"
              />
              <el-input v-else v-model="settingsForm[field.name]" />
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <el-form-item class="ai-settings-actions">
        <el-button @click="getAiSettings(false)">刷新</el-button>
        <el-button type="primary" :loading="saving" @click="submitAiSettings">
          保存设置
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { multilingualApi } from '@/api'

const FIELD_GROUP_OPTIONS = [
  { label: '服务商', value: 'provider' },
  { label: 'DeepSeek 连接', value: 'deepseek' },
  { label: '模型与输出', value: 'model' },
  { label: '请求控制', value: 'request' },
  { label: '默认提示词', value: 'prompt' }
]

export default {
  name: 'MultilingualAiSettings',
  setup() {
    const loading = ref(false)
    const saving = ref(false)
    const fieldList = ref([])
    const settingsForm = reactive({})
    const fieldGroupOptions = FIELD_GROUP_OPTIONS

    function getDefaultValue(field) {
      if (field.type === 'boolean') {
        return Boolean(field.defaultValue)
      }
      if (typeof field.defaultValue === 'undefined') {
        return ''
      }
      return field.defaultValue
    }

    function ensureFormFields() {
      fieldList.value.forEach(field => {
        if (typeof settingsForm[field.name] === 'undefined') {
          settingsForm[field.name] = getDefaultValue(field)
        }
      })
    }

    function applySettingsData(data) {
      fieldList.value = data.fields || []
      ensureFormFields()
      const values = data.values || {}
      fieldList.value.forEach(field => {
        if (typeof values[field.name] !== 'undefined') {
          settingsForm[field.name] = values[field.name]
        }
      })
    }

    function getFieldListByGroup(group) {
      return fieldList.value.filter(field => field.group === group)
    }

    function getColumnSpan(field) {
      if (field.type === 'textarea') {
        return 24
      }
      return 12
    }

    function isSelectField(field) {
      return field.type === 'select' || field.type === 'modelSelect'
    }

    function getNumberStep(field) {
      if (field.step) {
        return field.step
      }
      if (field.type === 'float') {
        return 0.1
      }
      return 1
    }

    function getNumberPrecision(field) {
      if (Number.isInteger(field.precision)) {
        return field.precision
      }
      if (field.type === 'float') {
        return 2
      }
      return 0
    }

    function getAiSettings(noLoading = true) {
      loading.value = !noLoading
      return multilingualApi
        .getAiSettings({}, noLoading)
        .then(response => {
          applySettingsData(response.data.data || {})
        })
        .finally(() => {
          loading.value = false
        })
    }

    function submitAiSettings() {
      const values = {}
      fieldList.value.forEach(field => {
        values[field.name] = settingsForm[field.name]
      })

      saving.value = true
      multilingualApi
        .updateAiSettings({ values })
        .then(response => {
          applySettingsData(response.data.data || {})
          ElMessage.success('AI 设置已保存')
        })
        .finally(() => {
          saving.value = false
        })
    }

    onMounted(() => {
      getAiSettings(false)
    })

    return {
      fieldGroupOptions,
      fieldList,
      getAiSettings,
      getColumnSpan,
      getFieldListByGroup,
      getNumberPrecision,
      getNumberStep,
      isSelectField,
      loading,
      saving,
      settingsForm,
      submitAiSettings
    }
  }
}
</script>

<style scoped>
.multilingual-ai-settings-page {
  max-width: 980px;
}

.ai-settings-group {
  margin-bottom: 18px;
}

.ai-settings-actions {
  margin-top: 18px;
}

.ai-model-deprecated {
  float: right;
  margin-left: 12px;
  color: var(--el-color-warning);
  font-size: 12px;
}

@media (max-width: 767px) {
  .multilingual-ai-settings-page {
    max-width: none;
  }

  :deep(.el-form-item) {
    display: block;
  }

  :deep(.el-form-item__label) {
    width: auto !important;
    justify-content: flex-start;
  }

  :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
