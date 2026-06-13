<template>
  <el-dialog
    v-model="visible"
    title="批量 AI 翻译"
    width="min(1100px, 96vw)"
    align-center
    destroy-on-close
    append-to-body
    :show-close="!isBusy"
    :close-on-click-modal="!isBusy"
    :close-on-press-escape="!isBusy"
  >
    <div v-loading="submitting" class="ai-translation-dialog-body">
      <el-skeleton v-if="loading" :rows="8" animated />
      <template v-else>
        <el-descriptions class="mb20" :column="3" border>
          <el-descriptions-item label="源语言">
            {{ getLanguageText(aiSourceLanguageCode) }}
          </el-descriptions-item>
          <el-descriptions-item label="目标语言版本">
            {{ targets.length }} 个
          </el-descriptions-item>
          <el-descriptions-item label="可翻译条目">
            {{ fieldEntryList.length }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="translation-json-warning-list">
          <div class="ai-skipped-header">
            <div class="translation-json-group-title">
              本次批量翻译的语言版本
            </div>
          </div>
          <div
            v-for="item in targetStatusList"
            :key="item.id"
            class="ai-skipped-item"
          >
            <span>
              {{ getLanguageText(item.languageCode) }}：{{ item.title || '-' }}
              <template v-if="item.message">（{{ item.message }}）</template>
            </span>
            <el-tag
              size="small"
              effect="plain"
              :type="getTargetStatusTagType(item.status)"
            >
              {{ getTargetStatusText(item.status) }}
            </el-tag>
          </div>
        </div>

        <el-form class="translation-json-option-form" label-width="110px">
          <el-form-item label="源语言">
            <el-select
              v-model="aiSourceLanguageCode"
              class="w_10"
              :disabled="isBusy"
              filterable
              placeholder="请选择源语言"
              @change="handleSourceLanguageChange"
            >
              <el-option
                v-for="option in languageOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="翻译用文章">
            <el-radio-group v-model="aiBaseMode" :disabled="isBusy">
              <el-radio value="source">源文章</el-radio>
              <el-radio value="current">当前文章</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <div class="translation-json-toolbar">
          <div class="translation-dialog-intro">
            <div class="translation-dialog-intro-title">选择 AI 翻译字段</div>
            <div class="translation-dialog-intro-text">
              已选择
              {{ selectedAiEntryIds.length }}
              项。批量翻译会对每个所选语言版本，按这里勾选的字段统一发起 AI
              翻译；因为是批量，这里只展示源内容与待翻译内容，不展示各语言下的当前内容。
            </div>
          </div>
          <div class="translation-json-toolbar-actions">
            <el-button
              size="small"
              :disabled="isBusy"
              @click="selectAllEntries"
            >
              全选
            </el-button>
            <el-button size="small" :disabled="isBusy" @click="clearEntries">
              清空
            </el-button>
          </div>
        </div>

        <el-empty
          v-if="fieldEntryGroups.length === 0"
          description="源文章没有可翻译的字段"
        />
        <TranslationEntrySelectableGroups
          v-else
          v-model="selectedAiEntryIds"
          :groups="fieldEntryGroups"
          :disabled="isBusy"
          class="w_10"
        />

        <div
          v-if="showCoverImageTranslationOption"
          class="translation-json-group ai-cover-translation-group"
        >
          <div class="translation-json-group-header">
            <div class="translation-json-group-heading">
              <div class="translation-json-group-title">封面图处理</div>
              <div class="translation-dialog-intro-text">
                勾选后会对每个所选语言版本分别识别并翻译封面图中的标题。
              </div>
            </div>
            <div class="translation-json-group-count">1 项</div>
          </div>
          <div
            class="translation-json-entry-list ai-cover-translation-entry-list"
          >
            <el-checkbox
              v-model="aiTranslateCoverImage"
              :disabled="isCoverImageTranslationDisabled"
              class="translation-json-entry"
            >
              <div class="ai-cover-translation-entry-body">
                <div class="ai-cover-translation-entry-title">封面图标题</div>
                <div class="translation-entry-preview-rows">
                  <div class="translation-entry-preview-row">
                    <div class="translation-entry-preview-label">源内容</div>
                    <div
                      class="translation-entry-preview-value ai-cover-entry-preview-value"
                    >
                      <div class="cover-image-list ai-cover-translation-list">
                        <div
                          v-for="(element, index) in sourceAiCoverImageList"
                          :key="element._id || element.id || index"
                          class="post-cover-image-item"
                        >
                          <button
                            v-if="
                              isImageAttachment(element) &&
                              getImagePreviewUrl(element)
                            "
                            type="button"
                            class="post-cover-image-preview-trigger"
                            title="打开预览"
                            @click.prevent="openMediaPreview(element)"
                          >
                            <el-image
                              :src="getImagePreviewUrl(element)"
                              fit="contain"
                              style="width: 100%; height: 100%"
                            />
                          </button>
                          <button
                            v-else-if="
                              isVideoAttachment(element) &&
                              getVideoPreviewUrl(element)
                            "
                            type="button"
                            class="post-cover-image-preview-trigger"
                            title="播放视频"
                            @click.prevent="openMediaPreview(element)"
                          >
                            <el-image
                              v-if="getVideoCoverUrl(element)"
                              :src="getVideoCoverUrl(element)"
                              fit="cover"
                              style="width: 100%; height: 100%"
                            />
                            <div v-else class="attachment-cover-empty">
                              无封面
                            </div>
                          </button>
                          <div v-else class="attachment-file-card">
                            <el-icon size="28"><Document /></el-icon>
                            <div>{{ getRelationName(element) }}</div>
                          </div>
                          <div
                            v-if="element.is360Panorama"
                            class="attachment-360-icon"
                          >
                            360°
                          </div>
                          <div
                            v-if="isVideoAttachment(element)"
                            class="attachment-play-icon"
                          >
                            <el-icon><VideoPlay /></el-icon>
                          </div>
                        </div>
                        <span
                          v-if="sourceAiCoverImageList.length === 0"
                          class="translation-media-empty cGray666"
                        >
                          未关联封面图
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-checkbox>
          </div>
          <AiFeatureUnavailableTip :message="coverImageUnavailableReason" />
        </div>

        <el-form class="ai-translation-prompt-form" label-width="110px">
          <OfficialTermGlossaryOptions
            v-model:auto-organize="aiAutoOrganizeOfficialTermGlossary"
            v-model:search-official-term-translations="
              aiSearchOfficialTermTranslations
            "
            :disabled="isBusy"
            :search-default-loading="settingsLoading"
            :search-unavailable-reason="officialTermSearchUnavailableReason"
            :source-proper-noun-term-count="sourceProperNounTermCount"
            :source-proper-noun-term-count-loading="
              sourceProperNounTermCountLoading
            "
          />
          <el-form-item label="校验译文">
            <el-switch
              v-model="aiVerificationEnabled"
              :disabled="isBusy"
              active-text="AI 参与校验"
            />
            <AiFeatureHintTip
              message="开启后，校验 AI 会在后台任务翻译完成后对全部译文进行全局校验与修正；实时翻译不参与校验。"
            />
          </el-form-item>
          <el-form-item label="此次提示词">
            <el-input
              v-model="aiPrompt"
              type="textarea"
              :rows="4"
              :disabled="isBusy"
              placeholder="可补充本次翻译的语气、专有名词、保留词或风格要求，会应用到所有所选语言版本"
            />
          </el-form-item>
        </el-form>
      </template>
    </div>

    <template #footer>
      <el-button :disabled="isBusy" @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="loading || !canSubmit"
        @click="submitBatch"
      >
        创建后台任务
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, VideoPlay } from '@element-plus/icons-vue'
import { multilingualApi } from '@/api'
import AiFeatureHintTip from '@/components/AiFeatureHintTip.vue'
import AiFeatureUnavailableTip from '@/components/AiFeatureUnavailableTip.vue'
import OfficialTermGlossaryOptions from '@/components/OfficialTermGlossaryOptions.vue'
import TranslationEntrySelectableGroups from '@/components/TranslationEntrySelectableGroups.vue'
import {
  getLanguageText,
  getPostDisplayTitle,
  getRelationDisplayName,
  isCoverImageTranslationSupportedPostType,
  SUPPORTED_LANGUAGE_OPTIONS
} from '@/utils/multilingual'
import { groupTranslationEntryList } from '@/utils/translationEntryDisplay'
import { loadAndOpenImg } from '@/utils/utils'
import {
  createAiSettingsAvailability,
  createAiSettingsLoadErrorAvailability,
  getImageGenerationUnavailableReason,
  getInternetSearchUnavailableReason,
  loadAiSettingsAvailability
} from '@/utils/aiSettingsAvailability'
import { extractApiErrorMessages } from '@/utils/apiError'
import {
  buildSourcePostFieldEntries,
  getTranslationEntryMatchSignature
} from '@/utils/translationPostBatchAi'

const TARGET_STATUS_TEXT_MAP = {
  pending: '排队中',
  creating: '创建中',
  created: '已创建',
  skipped: '已跳过',
  failed: '创建失败'
}

export default {
  name: 'TranslationPostBatchAiTranslationDialog',
  components: {
    AiFeatureHintTip,
    AiFeatureUnavailableTip,
    Document,
    OfficialTermGlossaryOptions,
    TranslationEntrySelectableGroups,
    VideoPlay
  },
  props: {
    modelValue: { type: Boolean, default: false },
    sourcePost: { type: Object, default: null },
    sourceSnapshotId: { type: String, default: '' },
    targets: {
      type: Array,
      default() {
        return []
      }
    }
  },
  emits: ['update:modelValue', 'submitted'],
  setup(props, { emit }) {
    const loading = ref(false)
    const submitting = ref(false)
    const settingsLoading = ref(false)
    const sourceProperNounTermCountLoading = ref(false)
    const sourceProperNounTermCount = ref(0)
    const sourceDetailPost = ref(null)
    const fieldEntryList = ref([])
    const selectedAiEntryIds = ref([])
    const aiSourceLanguageCode = ref('')
    const aiBaseMode = ref('source')
    const aiPrompt = ref('')
    const aiTranslateCoverImage = ref(false)
    const aiAutoOrganizeOfficialTermGlossary = ref(true)
    const aiSearchOfficialTermTranslations = ref(false)
    const aiVerificationEnabled = ref(false)
    const aiSettingsAvailability = ref(createAiSettingsAvailability())
    const targetStatusMap = ref({})

    const visible = computed({
      get() {
        return props.modelValue
      },
      set(value) {
        emit('update:modelValue', value)
      }
    })

    const languageOptions = computed(() => SUPPORTED_LANGUAGE_OPTIONS)

    const sourceTitle = computed(() => {
      if (sourceDetailPost.value) {
        return getPostDisplayTitle(sourceDetailPost.value)
      }
      if (props.sourcePost) {
        return getPostDisplayTitle(props.sourcePost)
      }
      return ''
    })

    const fieldEntryGroups = computed(() => {
      return groupTranslationEntryList(fieldEntryList.value)
    })

    const sourcePostType = computed(() => {
      if (sourceDetailPost.value) {
        return Number(sourceDetailPost.value.type || 0)
      }
      if (props.sourcePost) {
        return Number(props.sourcePost.type || 0)
      }
      return 0
    })

    const showCoverImageTranslationOption = computed(() => {
      return isCoverImageTranslationSupportedPostType(sourcePostType.value)
    })

    const sourceAiCoverImageList = computed(() => {
      const coverImages = sourceDetailPost.value?.coverImages
      if (!Array.isArray(coverImages)) {
        return []
      }
      return coverImages.filter(Boolean)
    })

    const coverImageUnavailableReason = computed(() => {
      if (!showCoverImageTranslationOption.value) {
        return ''
      }
      return getImageGenerationUnavailableReason(aiSettingsAvailability.value)
    })

    const isCoverImageTranslationDisabled = computed(() => {
      if (isBusy.value) {
        return true
      }
      return Boolean(coverImageUnavailableReason.value)
    })

    const officialTermSearchUnavailableReason = computed(() => {
      return getInternetSearchUnavailableReason(aiSettingsAvailability.value)
    })

    const isBusy = computed(() => {
      return loading.value || submitting.value
    })

    const targetStatusList = computed(() => {
      return props.targets.map(target => {
        const status = targetStatusMap.value[target.id] || {}
        return {
          id: target.id,
          languageCode: target.languageCode,
          title: target.title,
          status: status.status || 'pending',
          message: status.message || ''
        }
      })
    })

    const shouldTranslateCoverImage = computed(() => {
      if (!showCoverImageTranslationOption.value) {
        return false
      }
      if (coverImageUnavailableReason.value) {
        return false
      }
      return aiTranslateCoverImage.value === true
    })

    const canSubmit = computed(() => {
      if (props.targets.length === 0) {
        return false
      }
      if (!aiSourceLanguageCode.value) {
        return false
      }
      return (
        selectedAiEntryIds.value.length > 0 || shouldTranslateCoverImage.value
      )
    })

    function getTargetStatusText(status) {
      return TARGET_STATUS_TEXT_MAP[status] || status
    }

    function getTargetStatusTagType(status) {
      if (status === 'created') {
        return 'success'
      }
      if (status === 'failed') {
        return 'danger'
      }
      if (status === 'creating') {
        return 'warning'
      }
      if (status === 'skipped') {
        return 'info'
      }
      return 'info'
    }

    function setTargetStatus(id, status, message = '') {
      targetStatusMap.value = {
        ...targetStatusMap.value,
        [id]: { status, message }
      }
    }

    function resetTargetStatus() {
      const nextMap = {}
      props.targets.forEach(target => {
        nextMap[target.id] = { status: 'pending', message: '' }
      })
      targetStatusMap.value = nextMap
    }

    function selectAllEntries() {
      selectedAiEntryIds.value = fieldEntryList.value.map(entry => entry.id)
    }

    function clearEntries() {
      selectedAiEntryIds.value = []
    }

    function getDefaultSourceLanguageCode() {
      if (props.sourcePost?.sourceLanguageCode) {
        return props.sourcePost.sourceLanguageCode
      }
      if (sourceDetailPost.value?.sourceLanguageCode) {
        return sourceDetailPost.value.sourceLanguageCode
      }
      const firstTarget = props.targets[0]
      return firstTarget?.sourceLanguageCode || ''
    }

    async function loadAiSettings() {
      settingsLoading.value = true
      try {
        const availability = await loadAiSettingsAvailability(multilingualApi)
        aiSettingsAvailability.value = availability
        if (
          availability.internetSearchEnabled === true &&
          aiAutoOrganizeOfficialTermGlossary.value === true
        ) {
          aiSearchOfficialTermTranslations.value = true
        } else {
          aiSearchOfficialTermTranslations.value = false
        }
        enforceCoverImageAvailability()
      } catch (error) {
        aiSettingsAvailability.value =
          createAiSettingsLoadErrorAvailability(error)
        aiSearchOfficialTermTranslations.value = false
        aiTranslateCoverImage.value = false
        extractApiErrorMessages(error).forEach(message => {
          ElMessage.error(message)
        })
      } finally {
        settingsLoading.value = false
      }
    }

    function enforceCoverImageAvailability() {
      if (showCoverImageTranslationOption.value) {
        if (!coverImageUnavailableReason.value) {
          return
        }
      }
      aiTranslateCoverImage.value = false
    }

    async function loadSourceProperNounTermCount() {
      sourceProperNounTermCountLoading.value = true
      const sourceId = String(
        props.sourcePost?.sourceId || sourceDetailPost.value?.sourceId || ''
      ).trim()
      const sourceLanguageCode = String(aiSourceLanguageCode.value || '').trim()
      try {
        if (!sourceId || !sourceLanguageCode) {
          sourceProperNounTermCount.value = 0
          aiAutoOrganizeOfficialTermGlossary.value = true
          return
        }
        const response = await multilingualApi.getSourcePostProperNounTermList(
          {
            sourceId,
            sourceLanguageCode,
            page: 1,
            limit: 1
          },
          true
        )
        const responseData = response.data?.data || {}
        const count = Number(responseData.relationCount || 0)
        sourceProperNounTermCount.value =
          Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
        aiAutoOrganizeOfficialTermGlossary.value =
          sourceProperNounTermCount.value === 0
      } catch (error) {
        sourceProperNounTermCount.value = 0
        aiAutoOrganizeOfficialTermGlossary.value = true
        extractApiErrorMessages(error).forEach(message => {
          ElMessage.error(message)
        })
      } finally {
        sourceProperNounTermCountLoading.value = false
      }
    }

    async function loadSourceDetail() {
      const snapshotId = String(props.sourceSnapshotId || '').trim()
      if (!snapshotId) {
        sourceDetailPost.value = null
        fieldEntryList.value = []
        return
      }
      const response = await multilingualApi.getSourcePostDetail(
        { id: snapshotId },
        true
      )
      const sourcePost = response.data?.data?.post || null
      sourceDetailPost.value = sourcePost
      const entries = buildSourcePostFieldEntries(sourcePost)
      fieldEntryList.value = entries
      selectedAiEntryIds.value = entries
        .filter(entry => entry.defaultSelected)
        .map(entry => entry.id)
    }

    async function initializeDialog() {
      loading.value = true
      resetTargetStatus()
      aiPrompt.value = ''
      aiBaseMode.value = 'source'
      aiTranslateCoverImage.value = false
      aiVerificationEnabled.value = false
      aiSourceLanguageCode.value = getDefaultSourceLanguageCode()
      try {
        await loadSourceDetail()
        await loadAiSettings()
        await loadSourceProperNounTermCount()
      } finally {
        loading.value = false
      }
    }

    function buildSelectedEntryKeys() {
      const selectedIdSet = new Set(selectedAiEntryIds.value.map(String))
      const keySet = new Set()
      fieldEntryList.value.forEach(entry => {
        if (!selectedIdSet.has(String(entry.id))) {
          return
        }
        const signature = getTranslationEntryMatchSignature(entry)
        if (signature) {
          keySet.add(signature)
        }
      })
      return Array.from(keySet)
    }

    function shouldSearchOfficialTermTranslations() {
      if (aiAutoOrganizeOfficialTermGlossary.value !== true) {
        return false
      }
      if (officialTermSearchUnavailableReason.value) {
        return false
      }
      return aiSearchOfficialTermTranslations.value === true
    }

    async function handleSourceLanguageChange() {
      await loadSourceProperNounTermCount()
    }

    function isVideoAttachment(record) {
      return Boolean(record?.mimetype && record.mimetype.includes('video'))
    }

    function isImageAttachment(record) {
      return Boolean(record?.mimetype && record.mimetype.includes('image'))
    }

    function getFirstMediaUrl(candidateList) {
      for (const item of candidateList) {
        if (item) {
          return item
        }
      }
      return ''
    }

    function getImagePreviewUrl(record) {
      return getFirstMediaUrl([
        record?.localThumbnailPath,
        record?.localFilepath,
        record?.thumfor,
        record?.filepath,
        record?.remoteFilepath
      ])
    }

    function getImageOriginalUrl(record) {
      return getFirstMediaUrl([
        record?.localFilepath,
        record?.filepath,
        record?.remoteFilepath,
        record?.localThumbnailPath,
        record?.thumfor
      ])
    }

    function getVideoPreviewUrl(record) {
      return getFirstMediaUrl([
        record?.localFilepath,
        record?.filepath,
        record?.remoteFilepath
      ])
    }

    function getVideoCoverUrl(record) {
      return getFirstMediaUrl([record?.localThumbnailPath, record?.thumfor])
    }

    function getPositiveMediaSize(value) {
      const numberValue = Number(value)
      if (Number.isFinite(numberValue) && numberValue > 0) {
        return numberValue
      }
      return 0
    }

    function getMediaPreviewSize(record) {
      const width =
        getPositiveMediaSize(record?.width) ||
        getPositiveMediaSize(record?.thumWidth)
      const height =
        getPositiveMediaSize(record?.height) ||
        getPositiveMediaSize(record?.thumHeight)
      if (width && height) {
        return { width, height }
      }
      if (isVideoAttachment(record)) {
        return { width: 1280, height: 720 }
      }
      return { width: 1600, height: 900 }
    }

    function buildMediaPreviewItem(record) {
      let previewUrl = ''
      if (isImageAttachment(record)) {
        previewUrl = getImageOriginalUrl(record)
      }
      if (isVideoAttachment(record)) {
        previewUrl = getVideoPreviewUrl(record)
      }
      if (!previewUrl) {
        return null
      }
      const previewSize = getMediaPreviewSize(record)
      return {
        src: previewUrl,
        width: previewSize.width,
        height: previewSize.height,
        mimetype: record?.mimetype || '',
        is360Panorama: Boolean(record?.is360Panorama)
      }
    }

    function openMediaPreview(record) {
      const previewItem = buildMediaPreviewItem(record)
      if (!previewItem) {
        return
      }
      loadAndOpenImg(0, [previewItem])
    }

    function getRelationName(record) {
      return getRelationDisplayName(record)
    }

    async function submitBatch() {
      if (!canSubmit.value) {
        ElMessage.warning('请至少选择一项翻译内容并确认源语言')
        return
      }
      const sourceId = String(
        props.sourcePost?.sourceId || sourceDetailPost.value?.sourceId || ''
      ).trim()
      if (!sourceId) {
        ElMessage.error('缺少源文章身份，无法批量翻译')
        return
      }
      const selectedEntryKeys = buildSelectedEntryKeys()
      const translateCoverImage = shouldTranslateCoverImage.value
      submitting.value = true
      props.targets.forEach(target => {
        setTargetStatus(target.id, 'creating')
      })
      try {
        const response = await multilingualApi.batchCreateTranslationJob(
          {
            source: {
              postId: sourceId,
              snapshotId: props.sourceSnapshotId,
              snapshotVersion:
                props.sourcePost?.snapshotVersion ||
                sourceDetailPost.value?.snapshotVersion,
              languageCode: aiSourceLanguageCode.value,
              title: sourceTitle.value
            },
            request: {
              prompt: aiPrompt.value,
              baseMode: aiBaseMode.value,
              options: {
                translateCoverImage,
                autoOrganizeOfficialTermGlossary:
                  aiAutoOrganizeOfficialTermGlossary.value === true,
                searchOfficialTermTranslations:
                  shouldSearchOfficialTermTranslations(),
                aiVerificationEnabled: aiVerificationEnabled.value === true
              },
              selectedEntryKeys
            },
            targets: props.targets.map(target => {
              return {
                postId: target.id,
                languageCode: target.languageCode,
                title: target.title
              }
            })
          },
          true
        )
        const data = response.data?.data || {}
        const resultList = Array.isArray(data.results) ? data.results : []
        resultList.forEach(item => {
          const status = item.status === 'created' ? 'created' : 'failed'
          setTargetStatus(item.targetPostId, status, item.errorMessage || '')
        })
        const createdCount = Number(data.createdCount || 0)
        const failedCount = Number(data.failedCount || 0)
        if (createdCount > 0) {
          ElMessage.success(`已创建 ${createdCount} 个后台任务`)
          emit('submitted')
        }
        if (failedCount > 0) {
          ElMessage.error(`${failedCount} 个语言版本创建失败`)
        }
        if (failedCount === 0) {
          visible.value = false
        }
      } catch (error) {
        props.targets.forEach(target => {
          setTargetStatus(target.id, 'failed', '创建后台任务失败')
        })
        extractApiErrorMessages(error).forEach(message => {
          ElMessage.error(message)
        })
      } finally {
        submitting.value = false
      }
    }

    watch(
      () => props.modelValue,
      value => {
        if (value) {
          initializeDialog()
        }
      }
    )

    watch(aiAutoOrganizeOfficialTermGlossary, value => {
      if (value !== true) {
        aiSearchOfficialTermTranslations.value = false
      }
    })

    return {
      visible,
      loading,
      submitting,
      settingsLoading,
      languageOptions,
      sourceTitle,
      targets: computed(() => props.targets),
      targetStatusList,
      fieldEntryList,
      fieldEntryGroups,
      selectedAiEntryIds,
      aiSourceLanguageCode,
      aiBaseMode,
      aiPrompt,
      aiTranslateCoverImage,
      aiAutoOrganizeOfficialTermGlossary,
      aiSearchOfficialTermTranslations,
      aiVerificationEnabled,
      sourceProperNounTermCount,
      sourceProperNounTermCountLoading,
      showCoverImageTranslationOption,
      coverImageUnavailableReason,
      isCoverImageTranslationDisabled,
      sourceAiCoverImageList,
      officialTermSearchUnavailableReason,
      isBusy,
      canSubmit,
      getLanguageText,
      getTargetStatusText,
      getTargetStatusTagType,
      handleSourceLanguageChange,
      isImageAttachment,
      isVideoAttachment,
      getImagePreviewUrl,
      getVideoPreviewUrl,
      getVideoCoverUrl,
      getRelationName,
      openMediaPreview,
      selectAllEntries,
      clearEntries,
      submitBatch
    }
  }
}
</script>

<style scoped>
.ai-translation-dialog-body {
  min-height: 220px;
}

.translation-json-toolbar,
.translation-json-toolbar-actions,
.ai-skipped-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.translation-json-toolbar-actions {
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 0;
}

.translation-json-option-form,
.ai-translation-prompt-form {
  margin-bottom: 12px;
}

.translation-dialog-intro {
  min-width: 0;
}

.translation-dialog-intro-title,
.translation-json-group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.translation-dialog-intro-text {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.translation-json-group,
.translation-json-warning-list {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  background: var(--el-bg-color);
}

.translation-json-warning-list {
  background: var(--el-fill-color-extra-light);
}

.translation-json-group-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.translation-json-group-heading {
  flex: 1;
  min-width: 0;
}

.translation-json-group-title {
  display: flex;
  align-items: center;
  margin: 4px 0 0;
  min-height: 21px;
  font-size: 15px;
  line-height: 1.5;
}

.translation-json-group-count {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 4px 10px;
  min-height: 24px;
  color: var(--el-color-primary-dark-2);
  font-size: 12px;
  font-weight: 600;
}

.translation-json-entry-list {
  display: grid;
  gap: 0;
}

.translation-json-entry {
  width: 100%;
  margin-right: 0;
  align-items: flex-start;
  padding: 10px 0;
}

.ai-skipped-header {
  margin-bottom: 0;
}

.ai-skipped-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

.ai-cover-translation-entry-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.translation-entry-preview-rows {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.translation-entry-preview-row {
  min-width: 0;
}

.translation-entry-preview-label {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.translation-entry-preview-value {
  margin-top: 6px;
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  max-height: 260px;
  overflow: auto;
  color: var(--el-text-color-regular);
}

.cover-image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.post-cover-image-item {
  position: relative;
  width: 100px;
  height: 76px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
}

.post-cover-image-preview-trigger {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.attachment-file-card,
.attachment-cover-empty,
.translation-media-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
}

.attachment-360-icon,
.attachment-play-icon {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  min-height: 22px;
  padding: 0 5px;
  border-radius: 11px;
  color: #fff;
  background: rgba(0, 0, 0, 0.58);
  font-size: 12px;
}

.attachment-play-icon {
  left: 6px;
  right: auto;
  padding: 0;
}

@media (max-width: 767px) {
  .translation-json-toolbar,
  .translation-json-group-header,
  .ai-skipped-header {
    display: grid;
    grid-template-columns: 1fr;
  }

  .translation-json-toolbar-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
