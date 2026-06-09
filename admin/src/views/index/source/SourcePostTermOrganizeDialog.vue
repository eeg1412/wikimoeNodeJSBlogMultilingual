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
          :disabled="isOfficialTermSearchDisabled"
          active-text="开启"
          inactive-text="关闭"
        />
        <AiFeatureUnavailableTip
          :message="officialTermSearchUnavailableReason"
        />
      </el-form-item>
      <el-form-item v-if="showSyncRelatedPostsOption" label="相关文章">
        <el-switch
          v-model="form.syncRelatedPosts"
          active-text="同步整理相关文章"
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
import AiFeatureUnavailableTip from '@/components/AiFeatureUnavailableTip.vue'
import {
  DEFAULT_LANGUAGE_CODE,
  SUPPORTED_LANGUAGE_OPTIONS,
  getPostDisplayTitle
} from '@/utils/multilingual'
import { extractApiErrorMessages } from '@/utils/apiError'
import {
  createAiSettingsAvailability,
  createAiSettingsLoadErrorAvailability,
  getInternetSearchUnavailableReason,
  loadAiSettingsAvailability
} from '@/utils/aiSettingsAvailability'
import { hasPostRelatedSourcePosts } from '@/utils/sourcePostRelatedPosts'
import ls from '@/utils/ls'

const TERM_ORGANIZE_TARGET_LANGUAGES_STORAGE_KEY =
  'wikimoe-source-post-term-organize-target-languages'

function getSourcePostId(sourcePost) {
  return String(sourcePost?.sourceId || sourcePost?._id || '').trim()
}

function getDefaultTargetLanguageCodes(sourceLanguageCode) {
  return SUPPORTED_LANGUAGE_OPTIONS.filter(item => {
    return item.value !== sourceLanguageCode
  }).map(item => item.value)
}

function parseStoredTargetLanguageCodes() {
  const storedValue = ls.getItem(TERM_ORGANIZE_TARGET_LANGUAGES_STORAGE_KEY)
  if (!storedValue) {
    return []
  }
  try {
    const parsedValue = JSON.parse(storedValue)
    if (Array.isArray(parsedValue)) {
      return parsedValue
    }
  } catch (error) {
    return String(storedValue)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }
  return []
}

function getStoredTargetLanguageCodes(sourceLanguageCode) {
  const supportedCodeSet = new Set(
    SUPPORTED_LANGUAGE_OPTIONS.map(item => item.value)
  )
  const storedList = parseStoredTargetLanguageCodes()
  const targetList = storedList.filter(languageCode => {
    return (
      supportedCodeSet.has(languageCode) &&
      languageCode !== sourceLanguageCode
    )
  })
  if (targetList.length > 0) {
    return targetList
  }
  return getDefaultTargetLanguageCodes(sourceLanguageCode)
}

function rememberTargetLanguageCodes(targetLanguageCodes) {
  if (!Array.isArray(targetLanguageCodes)) {
    return
  }
  ls.setItem(
    TERM_ORGANIZE_TARGET_LANGUAGES_STORAGE_KEY,
    JSON.stringify(targetLanguageCodes)
  )
}

export default {
  name: 'SourcePostTermOrganizeDialog',
  components: {
    AiFeatureUnavailableTip
  },
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
    const aiSettingsAvailability = ref(createAiSettingsAvailability())
    let defaultRequestId = 0
    const form = reactive({
      sourceLanguageCode: DEFAULT_LANGUAGE_CODE,
      targetLanguageCodes: getDefaultTargetLanguageCodes(DEFAULT_LANGUAGE_CODE),
      searchOfficialTermTranslations: false,
      syncRelatedPosts: true
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
    const showSyncRelatedPostsOption = computed(() => {
      return hasPostRelatedSourcePosts(props.sourcePost)
    })
    const officialTermSearchUnavailableReason = computed(() => {
      return getInternetSearchUnavailableReason(aiSettingsAvailability.value)
    })
    const isOfficialTermSearchDisabled = computed(() => {
      if (defaultLoading.value) {
        return true
      }
      return Boolean(officialTermSearchUnavailableReason.value)
    })

    function shouldSearchOfficialTermTranslations() {
      if (officialTermSearchUnavailableReason.value) {
        return false
      }
      return form.searchOfficialTermTranslations === true
    }

    function resetForm() {
      form.sourceLanguageCode = DEFAULT_LANGUAGE_CODE
      form.targetLanguageCodes = getStoredTargetLanguageCodes(
        form.sourceLanguageCode
      )
      form.searchOfficialTermTranslations = false
      aiSettingsAvailability.value = createAiSettingsAvailability()
      form.syncRelatedPosts = true
      defaultLoading.value = false
      defaultRequestId += 1
    }

    function handleSourceLanguageChange() {
      form.targetLanguageCodes = form.targetLanguageCodes.filter(
        languageCode => languageCode !== form.sourceLanguageCode
      )
      if (form.targetLanguageCodes.length === 0) {
        form.targetLanguageCodes = getStoredTargetLanguageCodes(
          form.sourceLanguageCode
        )
      }
    }

    async function applyDefaultSearchValue() {
      const requestId = defaultRequestId + 1
      defaultRequestId = requestId
      defaultLoading.value = true
      try {
        const availability = await loadAiSettingsAvailability(multilingualApi)
        if (requestId !== defaultRequestId) {
          return
        }
        if (!dialogVisible.value) {
          return
        }
        aiSettingsAvailability.value = availability
        form.searchOfficialTermTranslations =
          availability.internetSearchEnabled === true
      } catch (error) {
        if (requestId === defaultRequestId) {
          aiSettingsAvailability.value =
            createAiSettingsLoadErrorAvailability(error)
          form.searchOfficialTermTranslations = false
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
      rememberTargetLanguageCodes(form.targetLanguageCodes)
      submitting.value = true
      try {
        await multilingualApi.createSourcePostProperNounOrganizeJob(
          {
            sourceId,
            sourceLanguageCode: form.sourceLanguageCode,
            targetLanguageCodes: form.targetLanguageCodes,
            title: sourcePostTitle.value,
            recursion: {
              maxDepth: 3
            },
            searchOfficialTermTranslations:
              shouldSearchOfficialTermTranslations(),
            syncRelatedPosts:
              showSyncRelatedPostsOption.value && form.syncRelatedPosts === true
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

    watch(officialTermSearchUnavailableReason, reason => {
      if (!reason) {
        return
      }
      form.searchOfficialTermTranslations = false
    })

    watch(
      () => form.targetLanguageCodes.join(','),
      () => {
        if (form.targetLanguageCodes.length === 0) {
          return
        }
        rememberTargetLanguageCodes(form.targetLanguageCodes)
      }
    )

    return {
      defaultLoading,
      dialogVisible,
      form,
      handleSourceLanguageChange,
      isOfficialTermSearchDisabled,
      languageOptions,
      officialTermSearchUnavailableReason,
      showSyncRelatedPostsOption,
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
