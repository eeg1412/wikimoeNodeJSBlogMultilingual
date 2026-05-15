<template>
  <el-dialog
    v-model="dialogVisible"
    title="整理文章名词"
    width="min(640px, 96vw)"
    append-to-body
    destroy-on-close
  >
    <el-form
      :model="form"
      label-width="120px"
      class="source-post-term-organize-form"
      @submit.prevent
    >
      <el-form-item label="源文章">
        <div class="source-post-term-organize-title">
          {{ sourcePostTitle }}
        </div>
      </el-form-item>
      <el-form-item label="源语言" required>
        <el-select
          v-model="form.sourceLanguageCode"
          filterable
          class="w_10"
          @change="handleSourceLanguageChange"
        >
          <el-option
            v-for="item in languageOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="目标语言" required>
        <el-checkbox-group
          v-model="form.targetLanguageCodes"
          class="source-post-term-language-checks"
        >
          <el-checkbox
            v-for="item in targetLanguageOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="联网检索">
        <el-switch
          v-model="form.searchOfficialTermTranslations"
          :loading="defaultLoading"
          active-text="开启"
          inactive-text="关闭"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">
        创建后台任务
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { multilingualApi } from '@/api'
import {
  DEFAULT_LANGUAGE_CODE,
  SUPPORTED_LANGUAGE_OPTIONS,
  getPostDisplayTitle
} from '@/utils/multilingual'
import { extractApiErrorMessages } from '@/utils/apiError'
import { getOfficialTermSearchDefaultValue } from '@/utils/internetSearchAiSettings'

function getSourcePostId(sourcePost) {
  return String(sourcePost?.sourceId || sourcePost?._id || '').trim()
}

function getDefaultTargetLanguageCodes(sourceLanguageCode) {
  return SUPPORTED_LANGUAGE_OPTIONS.filter(item => {
    return item.value !== sourceLanguageCode
  }).map(item => item.value)
}

export default {
  name: 'SourcePostTermOrganizeDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    sourcePost: {
      type: Object,
      default: null
    }
  },
  emits: ['update:modelValue', 'created'],
  setup(props, { emit }) {
    const submitting = ref(false)
    const defaultLoading = ref(false)
    let defaultRequestId = 0
    const form = reactive({
      sourceLanguageCode: DEFAULT_LANGUAGE_CODE,
      targetLanguageCodes: getDefaultTargetLanguageCodes(DEFAULT_LANGUAGE_CODE),
      searchOfficialTermTranslations: false
    })

    const dialogVisible = computed({
      get() {
        return props.modelValue
      },
      set(value) {
        emit('update:modelValue', value)
      }
    })

    const languageOptions = SUPPORTED_LANGUAGE_OPTIONS
    const targetLanguageOptions = computed(() => {
      return SUPPORTED_LANGUAGE_OPTIONS.filter(item => {
        return item.value !== form.sourceLanguageCode
      })
    })
    const sourcePostTitle = computed(() => {
      const title = getPostDisplayTitle(props.sourcePost)
      if (title && title !== '-') {
        return title
      }
      return getSourcePostId(props.sourcePost) || '-'
    })

    function resetForm() {
      form.sourceLanguageCode = DEFAULT_LANGUAGE_CODE
      form.targetLanguageCodes = getDefaultTargetLanguageCodes(
        form.sourceLanguageCode
      )
      form.searchOfficialTermTranslations = false
      defaultLoading.value = false
      defaultRequestId += 1
    }

    function handleSourceLanguageChange() {
      form.targetLanguageCodes = form.targetLanguageCodes.filter(
        languageCode => languageCode !== form.sourceLanguageCode
      )
      if (form.targetLanguageCodes.length === 0) {
        form.targetLanguageCodes = getDefaultTargetLanguageCodes(
          form.sourceLanguageCode
        )
      }
    }

    async function applyDefaultSearchValue() {
      const requestId = defaultRequestId + 1
      defaultRequestId = requestId
      defaultLoading.value = true
      try {
        const defaultValue =
          await getOfficialTermSearchDefaultValue(multilingualApi)
        if (requestId !== defaultRequestId) {
          return
        }
        if (!dialogVisible.value) {
          return
        }
        form.searchOfficialTermTranslations = defaultValue
      } catch (error) {
        if (requestId === defaultRequestId) {
          extractApiErrorMessages(error).forEach(message => {
            ElMessage.error(message)
          })
        }
      } finally {
        if (requestId === defaultRequestId) {
          defaultLoading.value = false
        }
      }
    }

    async function submit() {
      const sourceId = getSourcePostId(props.sourcePost)
      if (!sourceId) {
        ElMessage.warning('源文章不存在')
        return
      }
      if (!form.sourceLanguageCode) {
        ElMessage.warning('请选择源语言')
        return
      }
      if (form.targetLanguageCodes.length === 0) {
        ElMessage.warning('请至少选择一个目标语言')
        return
      }
      submitting.value = true
      try {
        await multilingualApi.createSourcePostProperNounOrganizeJob(
          {
            sourceId,
            sourceLanguageCode: form.sourceLanguageCode,
            targetLanguageCodes: form.targetLanguageCodes,
            title: sourcePostTitle.value,
            searchOfficialTermTranslations: form.searchOfficialTermTranslations
          },
          true
        )
        ElMessage.success('文章名词整理后台任务已创建')
        dialogVisible.value = false
        emit('created')
      } catch (error) {
        console.log(error)
      } finally {
        submitting.value = false
      }
    }

    watch(
      () => props.modelValue,
      value => {
        if (!value) {
          return
        }
        resetForm()
        applyDefaultSearchValue()
      }
    )

    return {
      defaultLoading,
      dialogVisible,
      form,
      handleSourceLanguageChange,
      languageOptions,
      sourcePostTitle,
      submit,
      submitting,
      targetLanguageOptions
    }
  }
}
</script>

<style scoped>
.source-post-term-organize-form {
  max-width: 560px;
}

.source-post-term-organize-title {
  color: var(--el-text-color-primary);
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.source-post-term-language-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  line-height: 1.6;
}

.source-post-term-language-checks :deep(.el-checkbox) {
  margin-right: 0;
}

@media (max-width: 767px) {
  .source-post-term-organize-form {
    max-width: none;
  }

  .source-post-term-organize-form :deep(.el-form-item) {
    display: block;
  }

  .source-post-term-organize-form :deep(.el-form-item__label) {
    justify-content: flex-start;
    width: auto !important;
  }

  .source-post-term-organize-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
