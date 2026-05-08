<template>
  <div class="common-right-panel-form translation-job-list-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>AI</el-breadcrumb-item>
        <el-breadcrumb-item>AI 翻译任务</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="translation-search-form"
          @submit.prevent
          @keypress.enter="getJobList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="标题、任务 ID、源 ID"
              clearable
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.jobType"
              placeholder="任务类型"
              clearable
              style="width: 180px"
            >
              <el-option
                v-for="item in jobTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.status"
              placeholder="任务状态"
              clearable
              style="width: 150px"
            >
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getJobList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr translation-actions">
        <el-button @click="getJobList(true)">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="mb20 list-table-body">
      <ResponsiveTable
        ref="tableRef"
        :data="jobList"
        row-key="_id"
        height="100%"
        border
      >
        <ResponsiveTableColumn label="任务" min-width="260">
          <template #default="{ row }">
            <div class="source-title">
              {{ row.source?.title || row.target?.title || row._id }}
            </div>
            <div class="source-meta">{{ row._id }}</div>
            <div class="source-meta">
              {{ getJobTypeText(row.jobType) }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="目标" min-width="170">
          <template #default="{ row }">
            <el-tag v-if="row.target?.languageCode" size="small" effect="plain">
              {{ getLanguageText(row.target.languageCode) }}
            </el-tag>
            <div
              v-else-if="row.target?.languageCodes?.length"
              class="table-tag-list"
            >
              <el-tag
                v-for="languageCode in row.target.languageCodes"
                :key="languageCode"
                size="small"
                effect="plain"
              >
                {{ getLanguageText(languageCode) }}
              </el-tag>
            </div>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="状态" min-width="220">
          <template #default="{ row }">
            <div class="job-status-cell">
              <el-tag :type="getStatusTagType(row.status)" effect="plain">
                {{ row.status }}
              </el-tag>
              <div v-if="row.runtimeState" class="source-meta">
                {{ row.runtimeState }}
              </div>
              <el-tooltip
                v-if="
                  row.status === '执行失败' && getFailureReasonText(row.failure)
                "
                :content="getFailureReasonText(row.failure)"
                placement="top-start"
                :show-after="200"
              >
                <div class="job-status-reason">
                  {{ getFailureReasonText(row.failure) }}
                </div>
              </el-tooltip>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="进度" min-width="170">
          <template #default="{ row }">
            <el-progress
              :percentage="Number(row.progress?.percent || 0)"
              :stroke-width="8"
            />
            <div class="source-meta">
              {{ getProgressStageText(row.progress?.currentStage) }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="队列" width="120">
          <template #default="{ row }">
            <span v-if="row.queuePosition">#{{ row.queuePosition }}</span>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="330" fixed="right">
          <template #default="{ row }">
            <div class="job-row-actions">
              <el-button type="primary" size="small" @click="openDetail(row)">
                详情
              </el-button>
              <el-button
                v-if="row.status === '未开始' && !row.queueControl?.deferred"
                size="small"
                @click="deferJob(row)"
              >
                暂缓
              </el-button>
              <el-button
                v-if="row.status === '未开始' && row.queueControl?.deferred"
                size="small"
                type="primary"
                @click="resumeJob(row)"
              >
                恢复
              </el-button>
              <el-button
                v-if="canRetry(row)"
                size="small"
                type="warning"
                @click="retryJob(row)"
              >
                重试
              </el-button>
              <el-button
                v-if="canReject(row)"
                size="small"
                type="warning"
                @click="rejectJob(row)"
              >
                不采纳
              </el-button>
              <el-button
                v-if="canDelete(row)"
                size="small"
                type="danger"
                @click="deleteJob(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </div>

    <div class="clearfix">
      <el-pagination
        class="fr"
        background
        layout="total, prev, pager, next"
        :total="total"
        :pager-count="5"
        size="small"
        v-model:current-page="params.page"
        v-model:page-size="params.limit"
      />
    </div>

    <el-drawer
      v-model="detailDrawerVisible"
      title="AI 翻译任务"
      size="80%"
      class="translation-job-detail-drawer"
    >
      <template v-if="currentJob">
        <div class="detail-header">
          <div>
            <div class="source-title">
              {{ currentJob.source?.title || currentJob._id }}
            </div>
            <div class="source-meta">{{ currentJob._id }}</div>
          </div>
          <div class="detail-header-actions">
            <el-button @click="refreshDetail"> 刷新 </el-button>
            <el-button
              v-if="canCleanupCoverImages"
              :loading="coverImageCleanupLoading"
              @click="cleanupCoverImages"
            >
              清理封面临时文件
            </el-button>
            <el-button
              v-if="canApplyCurrentJob"
              type="primary"
              :disabled="selectedEntryKeys.length === 0"
              @click="applySelectedEntries"
            >
              采纳所选
            </el-button>
          </div>
        </div>

        <div class="detail-summary">
          <el-tag :type="getStatusTagType(currentJob.status)" effect="plain">
            {{ currentJob.status }}
          </el-tag>
          <span>{{ getJobTypeText(currentJob.jobType) }}</span>
          <span>{{ formatDate(currentJob.createdAt) }}</span>
          <span v-if="currentJob.result?.previewEntries?.length">
            {{ currentJob.result.previewEntries.length }} 项
          </span>
        </div>

        <div
          v-if="
            currentJob.status === '执行失败' &&
            getFailureReasonText(currentJob.failure)
          "
          class="job-state-panel job-state-panel-danger"
        >
          <div class="job-state-panel-header">
            <div>
              <div class="job-state-panel-title">任务执行失败</div>
              <div class="job-state-panel-subtitle">
                任务已停止，请根据下面的错误信息修复后再重新发起或重试。
              </div>
            </div>
            <div class="job-state-panel-tags">
              <el-tag
                v-if="currentJob.failure?.errorCode"
                type="danger"
                effect="plain"
                size="small"
              >
                {{ getFailureCodeLabel(currentJob.failure) }}
              </el-tag>
              <el-tag
                :type="
                  currentJob.failure?.retryable === true ? 'warning' : 'info'
                "
                effect="plain"
                size="small"
              >
                {{
                  currentJob.failure?.retryable === true ? '可重试' : '不可重试'
                }}
              </el-tag>
            </div>
          </div>
          <div class="job-state-panel-message">
            {{ getFailureReasonText(currentJob.failure) }}
          </div>
          <div
            v-if="getFailureCodeMeaning(currentJob.failure)"
            class="job-state-panel-code-hint"
          >
            错误码说明：{{ getFailureCodeMeaning(currentJob.failure) }}
          </div>
          <div class="job-state-panel-meta">
            <span v-if="currentJob.failure?.lastFailedAt">
              失败时间：{{ formatDate(currentJob.failure.lastFailedAt) }}
            </span>
            <span v-if="currentJob.failure?.attempts">
              失败次数：第 {{ currentJob.failure.attempts }} 次
            </span>
            <span v-if="currentJob.failure?.failedStep">
              失败阶段：{{ currentJob.failure.failedStep }}
            </span>
          </div>
        </div>

        <div v-if="conflictList.length" class="conflict-panel">
          <div class="conflict-title">采纳冲突</div>
          <div
            v-for="item in conflictList"
            :key="item.entryKey"
            class="conflict-item"
          >
            <el-tag size="small" type="warning" effect="plain">
              {{ item.code }}
            </el-tag>
            <span>{{ item.label || item.entryKey }}</span>
            <span>{{ item.message }}</span>
          </div>
        </div>

        <div v-if="canApplyCurrentJob" class="apply-toolbar">
          <el-checkbox v-model="applyForm.force">强制覆盖</el-checkbox>
          <el-checkbox v-model="applyForm.publish">采纳后发布</el-checkbox>
          <el-input
            v-model="applyForm.forceReason"
            placeholder="强制覆盖原因"
            clearable
          />
        </div>

        <el-tabs
          v-if="reviewLanguageTabs.length > 0"
          v-model="activeReviewLanguageCode"
          class="ai-preview-tabs translation-job-review-tabs"
        >
          <el-tab-pane
            v-for="tab in reviewLanguageTabs"
            :key="tab.languageCode"
            :label="tab.label"
            :name="tab.languageCode"
          >
            <el-descriptions class="mb20" :column="4" border>
              <el-descriptions-item label="可采纳条目">
                {{ tab.entryKeys.length }}
              </el-descriptions-item>
              <el-descriptions-item label="跳过条目">
                {{ tab.skippedEntries.length }}
              </el-descriptions-item>
              <el-descriptions-item label="已采纳条目">
                {{ getAppliedEntryCount(tab.reviewEntries) }}
              </el-descriptions-item>
              <el-descriptions-item label="已选择">
                {{ getSelectedEntryCount(tab.entryKeys) }}
              </el-descriptions-item>
              <el-descriptions-item label="封面图">
                {{ tab.coverImageEntries.length }}
              </el-descriptions-item>
            </el-descriptions>

            <div
              v-if="tab.skippedEntries.length > 0"
              class="translation-json-warning-list"
            >
              <div class="translation-json-group-title">跳过说明</div>
              <TranslationSkippedEntryPreviewList
                :entries="tab.skippedEntries"
                current-label="当前"
                source-label="源文"
              />
            </div>

            <div
              v-if="tab.coverImageEntries.length > 0"
              class="cover-image-review-section"
            >
              <div class="translation-json-group-title">封面图</div>
              <div
                v-for="item in tab.coverImageEntries"
                :key="item.id"
                class="cover-image-review-item"
              >
                <div class="cover-image-review-header">
                  <div class="cover-image-review-title-row">
                    <el-checkbox
                      class="cover-image-review-select"
                      :model-value="selectedEntryKeys.includes(item.id)"
                      :disabled="!canSelectCoverImage(item)"
                      :aria-label="`${item.targetTitle || item.sourceTitle || '未命名封面'} 采纳选择`"
                      @change="checked => setCoverImageSelected(item, checked)"
                    />
                    <div class="cover-image-review-title">
                      {{ item.targetTitle || item.sourceTitle || '未命名封面' }}
                    </div>
                  </div>
                  <el-tag
                    size="small"
                    :type="getCoverImageStatusTagType(item)"
                    effect="plain"
                  >
                    {{ getCoverImageStatusText(item) }}
                  </el-tag>
                </div>
                <div class="cover-image-review-grid">
                  <div class="cover-image-preview-panel">
                    <div class="cover-image-preview-label">源封面</div>
                    <img
                      v-if="item.sourceCoverUrl"
                      class="cover-image-preview-img"
                      :src="item.sourceCoverUrl"
                      alt=""
                    />
                    <div v-else class="cover-image-preview-empty">-</div>
                  </div>
                  <div class="cover-image-preview-panel">
                    <div class="cover-image-preview-label">AI 封面</div>
                    <img
                      v-if="item.generatedCoverUrl"
                      class="cover-image-preview-img"
                      :src="item.generatedCoverUrl"
                      alt=""
                    />
                    <div v-else class="cover-image-preview-empty">-</div>
                  </div>
                </div>
                <div
                  v-if="item.warningMessage || item.recognition?.reason"
                  class="cover-image-review-message"
                >
                  {{ item.warningMessage || item.recognition.reason }}
                </div>
                <div v-if="item.isApplied" class="cover-image-review-adoption">
                  <el-tag size="small" type="success" effect="plain">
                    已采纳
                  </el-tag>
                  <span class="cover-image-review-adoption-text">
                    采纳时间：{{ formatDate(item.appliedAt) }}
                  </span>
                  <span class="cover-image-review-adoption-text">
                    采纳人：{{ item.appliedByName || '-' }}
                  </span>
                </div>
              </div>
            </div>

            <div
              v-if="tab.entryKeys.length > 0"
              class="translation-json-toolbar"
            >
              <div class="translation-dialog-intro">
                <div class="translation-dialog-intro-title">选择采纳字段</div>
                <div class="translation-dialog-intro-text">
                  默认仅勾选未采纳条目，已选择
                  {{ getSelectedEntryCount(tab.entryKeys) }}
                  项。重新勾选已采纳条目时会二次确认。
                </div>
              </div>
              <div
                v-if="canApplyCurrentJob"
                class="translation-json-toolbar-actions"
              >
                <el-button size="small" @click="selectAllReviewEntries(tab)">
                  全选
                </el-button>
                <el-button size="small" @click="clearReviewEntries(tab)">
                  清空
                </el-button>
              </div>
            </div>

            <TranslationEntrySelectableGroups
              v-if="tab.groups.length > 0"
              v-model="selectedEntryKeys"
              :groups="tab.groups"
              :disabled="!canApplyCurrentJob"
              :show-adoption-info="true"
              :before-entry-select="beforeReviewEntrySelect"
              :before-group-select="beforeReviewGroupSelect"
              current-preview-label="当前"
              source-preview-label="源文"
              next-preview-label="AI 翻译后"
              class="w_10"
            />

            <el-empty
              v-if="
                tab.groups.length === 0 &&
                tab.skippedEntries.length === 0 &&
                tab.coverImageEntries.length === 0
              "
              description="暂无结果"
            />
          </el-tab-pane>
        </el-tabs>

        <el-empty v-if="previewEntries.length === 0" description="暂无结果" />
      </template>
    </el-drawer>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ResponsiveTable from '@/components/ResponsiveTable.vue'
import ResponsiveTableColumn from '@/components/ResponsiveTableColumn.vue'
import TranslationEntrySelectableGroups from '@/components/TranslationEntrySelectableGroups.vue'
import TranslationSkippedEntryPreviewList from '@/components/TranslationSkippedEntryPreviewList.vue'
import { multilingualApi } from '@/api'
import { getLanguageText as getSharedLanguageText } from '@/utils/multilingual'
import { getTranslationGroupDisplayMeta } from '@/utils/translationEntryDisplay'

const jobTypeOptions = [
  { label: '文章 AI 翻译', value: 'post-ai-translation' },
  { label: '源文生成并 AI 翻译', value: 'source-post-ai-import' },
  { label: '通用内容 AI 翻译', value: 'content-ai-translation' }
]

const statusOptions = [
  { label: '未开始', value: '未开始' },
  { label: '执行中', value: '执行中' },
  { label: '执行失败', value: '执行失败' },
  { label: '等待审核', value: '等待审核' },
  { label: '不采纳', value: '不采纳' },
  { label: '部分采纳', value: '部分采纳' },
  { label: '完全采纳', value: '完全采纳' }
]

const applyStatusSet = new Set(['等待审核', '不采纳', '部分采纳', '完全采纳'])
const deleteStatusSet = new Set([
  '未开始',
  '执行失败',
  '不采纳',
  '部分采纳',
  '完全采纳'
])

const progressStageTextMap = {
  pending: '等待领取',
  claimed: '已领取任务',
  BuildEntries: '构建翻译条目',
  TranslatePost: '翻译文章',
  TranslateCoverImage: '翻译封面图',
  TranslateContent: '翻译内容',
  ImportSourceSnapshot: '导入源快照',
  PrepareTargetPost: '准备目标文章',
  ValidateJob: '校验任务',
  FinalizeReview: '整理审核结果'
}

const failureCodeMeaningMap = {
  AI_TRANSLATION_FAILED:
    'AI 服务返回失败，或生成结果未通过当前翻译任务的处理与校验流程。',
  AI_TRANSLATION_CANCELLED:
    '任务执行过程中被后台停止，常见于 worker 租约失效、服务重启或人工中断。',
  AI_PROVIDER_CONFIG_REQUIRED: 'AI 服务配置不完整，当前任务无法发起翻译请求。',
  AI_SETTINGS_INVALID: '当前任务的 AI 参数校验失败，无法继续执行。',
  SERVICE_UNAVAILABLE: '依赖服务暂不可用，请稍后重试。'
}

const failureCodeLabelMap = {
  AI_TRANSLATION_FAILED: 'AI 翻译失败',
  AI_TRANSLATION_CANCELLED: 'AI 翻译已停止',
  AI_PROVIDER_CONFIG_REQUIRED: 'AI 服务配置不完整',
  AI_SETTINGS_INVALID: 'AI 设置校验失败',
  SERVICE_UNAVAILABLE: '服务暂不可用'
}

function normalizePreviewText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function stringifyPreviewValue(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return String(value)
  }
}

export default {
  name: 'TranslationJobList',
  components: {
    Refresh,
    ResponsiveTable,
    ResponsiveTableColumn,
    TranslationEntrySelectableGroups,
    TranslationSkippedEntryPreviewList
  },
  setup() {
    const tableRef = ref(null)
    const jobList = ref([])
    const total = ref(0)
    const currentJob = ref(null)
    const detailDrawerVisible = ref(false)
    const activeReviewLanguageCode = ref('')
    const selectedEntryKeys = ref([])
    const conflictList = ref([])
    const coverImageCleanupLoading = ref(false)
    const params = reactive({
      keyword: '',
      jobType: '',
      status: '',
      page: 1,
      limit: 20
    })
    const applyForm = reactive({
      force: false,
      publish: false,
      forceReason: ''
    })

    const previewEntries = computed(() => {
      return currentJob.value?.result?.previewEntries || []
    })

    const adoptionEntryMap = computed(() => {
      const entryMap = new Map()
      const adoptionEntryList = Array.isArray(
        currentJob.value?.adoption?.entries
      )
        ? currentJob.value.adoption.entries
        : []
      adoptionEntryList.forEach(entry => {
        if (!entry?.entryKey) {
          return
        }
        entryMap.set(String(entry.entryKey), entry)
      })
      return entryMap
    })

    const selectableReviewEntries = computed(() => {
      return previewEntries.value.filter(entry => {
        if (!entry || entry.entryType === 'coverImageTranslation') {
          return false
        }
        return entry.entryKey && !entry.aiSkipReason
      })
    })

    const skippedReviewEntries = computed(() => {
      return previewEntries.value.filter(entry => {
        if (!entry || entry.entryType === 'coverImageTranslation') {
          return false
        }
        return entry.aiSkipReason
      })
    })

    const coverImageReviewEntries = computed(() => {
      return previewEntries.value
        .filter(entry => {
          return entry && entry.entryType === 'coverImageTranslation'
        })
        .map(entry => {
          const adoptionEntry = adoptionEntryMap.value.get(
            String(entry.entryKey || '')
          )
          const appliedBy = adoptionEntry?.appliedBy || null
          return {
            ...entry,
            id: entry.entryKey || entry.artifactId,
            adoptionEntry,
            isApplied:
              entry.adopted === true || adoptionEntry?.applied === true,
            appliedAt: adoptionEntry?.appliedAt || entry.adoptedAt || '',
            appliedBy,
            appliedByName: appliedBy?.displayName || appliedBy?.username || ''
          }
        })
    })

    const canCleanupCoverImages = computed(() => {
      const artifactList = currentJob.value?.result?.coverImageArtifacts || []
      return Array.isArray(artifactList) && artifactList.length > 0
    })

    const canSelectCoverImage = entry => {
      if (!canApplyCurrentJob.value) {
        return false
      }
      if (!entry?.id || !entry?.artifactId) {
        return false
      }
      if (entry.isApplied === true) {
        return false
      }
      if (entry.status !== 'generated') {
        return false
      }
      return Boolean(entry.generatedCoverUrl)
    }

    const setCoverImageSelected = (entry, checked) => {
      const entryKey = String(entry?.id || '')
      if (!entryKey || !canSelectCoverImage(entry)) {
        return
      }
      if (checked) {
        if (!selectedEntryKeys.value.includes(entryKey)) {
          selectedEntryKeys.value = selectedEntryKeys.value.concat(entryKey)
        }
        return
      }
      selectedEntryKeys.value = selectedEntryKeys.value.filter(item => {
        return item !== entryKey
      })
    }

    const requestEntryMap = computed(() => {
      const map = new Map()
      const entries = currentJob.value?.request?.entries || []
      entries.forEach(entry => {
        if (!entry || typeof entry !== 'object') {
          return
        }
        if (entry.id) {
          map.set(String(entry.id), entry)
        }
        if (entry.entryKey) {
          map.set(String(entry.entryKey), entry)
        }
      })
      return map
    })

    const reviewDisplayEntries = computed(() => {
      return selectableReviewEntries.value.map(entry => {
        const adoptionEntry = adoptionEntryMap.value.get(
          String(entry.entryKey || '')
        )
        const requestEntry =
          requestEntryMap.value.get(String(entry.id || '')) ||
          requestEntryMap.value.get(String(entry.originalEntryKey || '')) ||
          requestEntryMap.value.get(String(entry.entryKey || '')) ||
          {}
        const currentPreviewText =
          normalizePreviewText(entry.currentPreviewText) ||
          normalizePreviewText(entry.currentPreviewRawValue) ||
          normalizePreviewText(requestEntry.currentPreviewText) ||
          normalizePreviewText(requestEntry.currentPreviewRawValue) ||
          stringifyPreviewValue(entry.targetValueSnapshotAtCompletion)
        const sourcePreviewText =
          normalizePreviewText(entry.sourcePreviewText) ||
          normalizePreviewText(entry.sourcePreviewRawValue) ||
          normalizePreviewText(requestEntry.sourcePreviewText) ||
          normalizePreviewText(requestEntry.sourcePreviewRawValue)
        const nextPreviewText =
          normalizePreviewText(entry.nextPreviewText) ||
          normalizePreviewText(entry.nextPreviewRawValue) ||
          normalizePreviewText(entry.previewRawValue) ||
          stringifyPreviewValue(entry.value)
        const currentPreviewHtml =
          normalizePreviewText(entry.currentPreviewHtml) ||
          normalizePreviewText(requestEntry.currentPreviewHtml)
        const sourcePreviewHtml =
          normalizePreviewText(entry.sourcePreviewHtml) ||
          normalizePreviewText(requestEntry.sourcePreviewHtml)
        const nextPreviewHtml =
          normalizePreviewText(entry.nextPreviewHtml) ||
          normalizePreviewText(requestEntry.nextPreviewHtml)

        const appliedBy = adoptionEntry?.appliedBy || null
        const appliedByName =
          appliedBy?.displayName || appliedBy?.username || ''

        return {
          ...entry,
          id: entry.entryKey,
          adoptionEntry,
          isApplied: adoptionEntry?.applied === true,
          appliedAt: adoptionEntry?.appliedAt || '',
          appliedBy,
          appliedByName,
          currentPreviewText,
          currentPreviewHtml,
          sourcePreviewText,
          sourcePreviewHtml,
          nextPreviewText,
          nextPreviewHtml
        }
      })
    })

    const getReviewEntryLanguageCode = entry => {
      return (
        entry?.languageCode ||
        currentJob.value?.target?.languageCode ||
        '__default'
      )
    }

    const buildReviewEntryGroups = entries => {
      const groupMap = new Map()
      entries.forEach(entry => {
        const groupLabel = entry.groupLabel || '未分组'
        if (!groupMap.has(groupLabel)) {
          groupMap.set(groupLabel, {
            label: groupLabel,
            groupLabel,
            entries: []
          })
        }
        groupMap.get(groupLabel).entries.push(entry)
      })

      return Array.from(groupMap.values()).map(group => {
        const meta = getTranslationGroupDisplayMeta(
          group.groupLabel,
          group.entries[0]
        )
        return {
          label: group.label,
          entries: group.entries,
          meta
        }
      })
    }

    const reviewLanguageTabs = computed(() => {
      const tabMap = new Map()
      const ensureTab = languageCode => {
        if (!tabMap.has(languageCode)) {
          tabMap.set(languageCode, {
            languageCode,
            label: getLanguageText(languageCode),
            entries: [],
            skippedEntries: []
          })
        }
        return tabMap.get(languageCode)
      }

      reviewDisplayEntries.value.forEach(entry => {
        ensureTab(getReviewEntryLanguageCode(entry)).entries.push(entry)
      })

      skippedReviewEntries.value.forEach(entry => {
        ensureTab(getReviewEntryLanguageCode(entry)).skippedEntries.push(entry)
      })

      coverImageReviewEntries.value.forEach(entry => {
        const tab = ensureTab(getReviewEntryLanguageCode(entry))
        if (!Array.isArray(tab.coverImageEntries)) {
          tab.coverImageEntries = []
        }
        tab.coverImageEntries.push(entry)
      })

      return Array.from(tabMap.values()).map(tab => {
        const selectableCoverImageEntries = (
          tab.coverImageEntries || []
        ).filter(entry => {
          return canSelectCoverImage(entry)
        })
        return {
          ...tab,
          entryKeys: tab.entries
            .map(entry => entry.id)
            .concat(selectableCoverImageEntries.map(entry => entry.id)),
          reviewEntries: tab.entries.concat(tab.coverImageEntries || []),
          groups: buildReviewEntryGroups(tab.entries),
          coverImageEntries: tab.coverImageEntries || []
        }
      })
    })

    const selectableEntryKeys = computed(() => {
      return reviewLanguageTabs.value.flatMap(tab => tab.entryKeys)
    })

    const canApplyCurrentJob = computed(() => {
      return currentJob.value && applyStatusSet.has(currentJob.value.status)
    })

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.jobType) {
        requestParams.jobType = params.jobType
      }
      if (params.status) {
        requestParams.status = params.status
      }
      return requestParams
    }

    const getJobList = resetPage => {
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }
      multilingualApi
        .getTranslationJobList(getRequestParams())
        .then(response => {
          const responseData = response.data.data || {}
          jobList.value = responseData.list || []
          total.value = responseData.total || 0
          tableRef.value?.scrollTo({ top: 0 })
        })
        .catch(error => {
          console.log(error)
        })
    }

    const openDetail = row => {
      detailDrawerVisible.value = true
      selectedEntryKeys.value = []
      conflictList.value = []
      multilingualApi
        .getTranslationJobDetail({ id: row._id })
        .then(response => {
          currentJob.value = response.data.data || null
          selectedEntryKeys.value = buildDefaultSelectedEntryKeys(
            currentJob.value
          )
        })
        .catch(error => {
          console.log(error)
        })
    }

    const refreshDetail = () => {
      if (!currentJob.value?._id) {
        return
      }
      openDetail(currentJob.value)
    }

    const runJobAction = (row, action, successText) => {
      action({ id: row._id })
        .then(() => {
          ElMessage.success(successText)
          getJobList(false)
          if (currentJob.value?._id === row._id) {
            refreshDetail()
          }
        })
        .catch(error => {
          console.log(error)
        })
    }

    const deferJob = row => {
      runJobAction(row, multilingualApi.deferTranslationJob, '已暂缓')
    }

    const resumeJob = row => {
      runJobAction(row, multilingualApi.resumeTranslationJob, '已恢复')
    }

    const retryJob = row => {
      runJobAction(row, multilingualApi.retryTranslationJob, '已重试')
    }

    const rejectJob = row => {
      ElMessageBox.confirm('确认不采纳该任务结果？', '确认操作', {
        type: 'warning'
      }).then(() => {
        runJobAction(row, multilingualApi.rejectTranslationJob, '已标记不采纳')
      })
    }

    const deleteJob = row => {
      ElMessageBox.confirm('确认删除该任务？', '确认操作', {
        type: 'warning'
      }).then(() => {
        runJobAction(row, multilingualApi.deleteTranslationJob, '已删除')
      })
    }

    const applySelectedEntries = () => {
      if (!currentJob.value?._id || selectedEntryKeys.value.length === 0) {
        return
      }
      conflictList.value = []
      multilingualApi
        .applyTranslationJobResult({
          id: currentJob.value._id,
          selectedEntryKeys: selectedEntryKeys.value,
          force: applyForm.force,
          forceOverwriteApplied: applyForm.force,
          forceReason: applyForm.forceReason,
          publish: applyForm.publish
        })
        .then(response => {
          const responseData = response.data.data || {}
          if (responseData.applied === false) {
            conflictList.value = responseData.conflicts || []
            return
          }
          ElMessage.success('已采纳')
          selectedEntryKeys.value = []
          refreshDetail()
          getJobList(false)
        })
        .catch(error => {
          console.log(error)
        })
    }

    const buildDefaultSelectedEntryKeys = job => {
      const adoptionMap = new Map()
      const adoptionEntryList = Array.isArray(job?.adoption?.entries)
        ? job.adoption.entries
        : []
      adoptionEntryList.forEach(entry => {
        if (!entry?.entryKey) {
          return
        }
        adoptionMap.set(String(entry.entryKey), entry)
      })

      const previewEntryList = Array.isArray(job?.result?.previewEntries)
        ? job.result.previewEntries
        : []
      return previewEntryList
        .filter(entry => {
          if (!entry?.entryKey || entry.aiSkipReason) {
            return false
          }
          if (entry.entryType === 'coverImageTranslation') {
            if (entry.adopted === true) {
              return false
            }
            if (entry.status !== 'generated') {
              return false
            }
            return Boolean(entry.artifactId && entry.generatedCoverUrl)
          }
          return adoptionMap.get(String(entry.entryKey))?.applied !== true
        })
        .map(entry => String(entry.entryKey))
    }

    const getAppliedEntryCount = entries => {
      return (entries || []).filter(entry => entry?.isApplied).length
    }

    const buildAppliedEntryConfirmMessage = entryList => {
      const appliedEntryList = entryList.filter(entry => entry?.isApplied)
      if (appliedEntryList.length === 0) {
        return ''
      }
      const entryLabelText = appliedEntryList
        .slice(0, 3)
        .map(entry => entry.label || entry.recordLabel || entry.id)
        .filter(Boolean)
        .join('、')
      const suffix =
        appliedEntryList.length > 3 ? ` 等 ${appliedEntryList.length} 项` : ''
      return `以下内容已采纳过：${entryLabelText}${suffix}。继续会再次覆盖当前内容，确定继续吗？`
    }

    const confirmAppliedEntrySelection = async entryList => {
      const appliedEntryList = entryList.filter(entry => entry?.isApplied)
      if (appliedEntryList.length === 0) {
        return true
      }
      try {
        await ElMessageBox.confirm(
          buildAppliedEntryConfirmMessage(appliedEntryList),
          '已采纳条目二次确认',
          {
            type: 'warning',
            confirmButtonText: '继续勾选',
            cancelButtonText: '取消'
          }
        )
        return true
      } catch (error) {
        return false
      }
    }

    const beforeReviewEntrySelect = async ({ entry, checked }) => {
      if (!checked || !entry?.isApplied) {
        return true
      }
      return await confirmAppliedEntrySelection([entry])
    }

    const beforeReviewGroupSelect = async ({ checked, entries }) => {
      if (!checked) {
        return true
      }
      return await confirmAppliedEntrySelection(entries || [])
    }

    const getJobTypeText = jobType => {
      return (
        jobTypeOptions.find(item => item.value === jobType)?.label || jobType
      )
    }

    const getLanguageText = languageCode => {
      if (languageCode === '__default') {
        return '全部'
      }
      return getSharedLanguageText(languageCode)
    }

    const getSelectedEntryCount = entryKeys => {
      const entryKeySet = new Set(entryKeys || [])
      return selectedEntryKeys.value.filter(entryKey => {
        return entryKeySet.has(entryKey)
      }).length
    }

    const getProgressStageText = stage => {
      const normalizedStage = normalizePreviewText(stage)
      if (!normalizedStage) {
        return '-'
      }
      if (progressStageTextMap[normalizedStage]) {
        return progressStageTextMap[normalizedStage]
      }
      const [stageName, languageCode] = normalizedStage.split(':')
      if (progressStageTextMap[stageName] && languageCode) {
        return `${progressStageTextMap[stageName]}（${getLanguageText(languageCode)}）`
      }
      return normalizedStage
    }

    const getStatusTagType = status => {
      if (status === '执行中') {
        return 'warning'
      }
      if (status === '执行失败') {
        return 'danger'
      }
      if (status === '等待审核') {
        return 'primary'
      }
      if (status === '完全采纳') {
        return 'success'
      }
      if (status === '不采纳') {
        return 'danger'
      }
      return 'info'
    }

    const getFailureReasonText = failure => {
      const message = String(failure?.errorMessage || '').trim()
      const errorCode = String(failure?.errorCode || '').trim()
      if (message && message !== errorCode) {
        return message
      }
      return getFailureCodeLabel(failure)
    }

    const getFailureCodeLabel = failure => {
      const errorCode = String(failure?.errorCode || '').trim()
      if (!errorCode) {
        return ''
      }
      return failureCodeLabelMap[errorCode] || errorCode
    }

    const getFailureCodeMeaning = failure => {
      const errorCode = String(failure?.errorCode || '').trim()
      if (!errorCode) {
        return ''
      }
      return failureCodeMeaningMap[errorCode] || ''
    }

    const formatDate = value => {
      if (!value) {
        return '-'
      }
      return new Date(value).toLocaleString()
    }

    const canRetry = row => {
      if (row.status === '执行中') {
        return false
      }
      return row.failure?.retryable === true
    }

    const canReject = row => {
      return row.status === '等待审核'
    }

    const canDelete = row => {
      return deleteStatusSet.has(row.status)
    }

    const selectAllReviewEntries = async tab => {
      const entryKeys = tab?.entryKeys || selectableEntryKeys.value
      const pendingEntryList = (
        tab?.reviewEntries || reviewDisplayEntries.value
      ).filter(entry => {
        return entry?.id && !selectedEntryKeys.value.includes(entry.id)
      })
      if ((await confirmAppliedEntrySelection(pendingEntryList)) === false) {
        return
      }
      const selectedSet = new Set(selectedEntryKeys.value)
      entryKeys.forEach(entryKey => {
        selectedSet.add(entryKey)
      })
      selectedEntryKeys.value = Array.from(selectedSet)
    }

    const clearReviewEntries = tab => {
      const entryKeys = tab?.entryKeys || selectableEntryKeys.value
      const clearSet = new Set(entryKeys)
      selectedEntryKeys.value = selectedEntryKeys.value.filter(entryKey => {
        return !clearSet.has(entryKey)
      })
    }

    const getCoverImageStatusText = entry => {
      if (entry?.adopted) {
        return '已采纳'
      }
      const status = entry?.status || ''
      if (status === 'generated') {
        return '已生成'
      }
      if (status === 'not-required') {
        return '无需处理'
      }
      if (status === 'recognition-skipped') {
        return '已跳过'
      }
      if (status === 'recognition-failed') {
        return '识别失败'
      }
      if (status === 'generation-failed') {
        return '生成失败'
      }
      if (status === 'cleaned') {
        return '已清理'
      }
      return status || '未知'
    }

    const getCoverImageStatusTagType = entry => {
      if (entry?.adopted) {
        return 'success'
      }
      if (entry?.status === 'generated') {
        return 'primary'
      }
      if (entry?.status === 'not-required') {
        return 'info'
      }
      if (entry?.status === 'recognition-skipped') {
        return 'info'
      }
      return 'warning'
    }

    const cleanupCoverImages = async () => {
      if (!currentJob.value?._id || !canCleanupCoverImages.value) {
        return
      }
      try {
        await ElMessageBox.confirm(
          '确认清理该任务的封面图临时文件？',
          '清理临时文件',
          {
            type: 'warning',
            confirmButtonText: '清理',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }
      coverImageCleanupLoading.value = true
      try {
        await multilingualApi.cleanupTranslationJobCoverImages({
          jobId: currentJob.value._id
        })
        ElMessage.success('封面图临时文件已清理')
        refreshDetail()
      } finally {
        coverImageCleanupLoading.value = false
      }
    }

    watch(
      reviewLanguageTabs,
      tabs => {
        if (tabs.length === 0) {
          activeReviewLanguageCode.value = ''
          return
        }
        const hasActiveTab = tabs.some(tab => {
          return tab.languageCode === activeReviewLanguageCode.value
        })
        if (!hasActiveTab) {
          activeReviewLanguageCode.value = tabs[0].languageCode
        }
      },
      { immediate: true }
    )

    watch(
      () => [params.page, params.limit],
      () => {
        getJobList(false)
      }
    )

    onMounted(() => {
      getJobList(false)
    })

    return {
      applyForm,
      activeReviewLanguageCode,
      canApplyCurrentJob,
      canCleanupCoverImages,
      canSelectCoverImage,
      canDelete,
      canReject,
      canRetry,
      beforeReviewEntrySelect,
      beforeReviewGroupSelect,
      conflictList,
      currentJob,
      cleanupCoverImages,
      clearReviewEntries,
      coverImageCleanupLoading,
      deferJob,
      deleteJob,
      detailDrawerVisible,
      formatDate,
      getJobList,
      getJobTypeText,
      getCoverImageStatusTagType,
      getCoverImageStatusText,
      getFailureCodeLabel,
      getFailureCodeMeaning,
      getFailureReasonText,
      getLanguageText,
      getAppliedEntryCount,
      getProgressStageText,
      getSelectedEntryCount,
      getStatusTagType,
      jobList,
      jobTypeOptions,
      openDetail,
      params,
      previewEntries,
      refreshDetail,
      rejectJob,
      reviewLanguageTabs,
      resumeJob,
      retryJob,
      selectAllReviewEntries,
      selectableEntryKeys,
      selectedEntryKeys,
      setCoverImageSelected,
      skippedReviewEntries,
      statusOptions,
      tableRef,
      total,
      applySelectedEntries
    }
  }
}
</script>

<style scoped>
.translation-job-list-page {
  min-width: 0;
}

.translation-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.source-title {
  font-weight: 600;
  word-break: break-word;
}

.source-meta {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  word-break: break-all;
}

.job-status-cell {
  min-width: 0;
}

.job-status-reason {
  margin-top: 6px;
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.table-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.table-empty-text {
  color: var(--el-text-color-secondary);
}

.job-row-actions,
.detail-summary,
.detail-header-actions,
.entry-title-line {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.job-row-actions {
  gap: 6px;
}

.detail-header {
  align-items: flex-start;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
}

.detail-summary {
  border-bottom: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
  margin-bottom: 16px;
  padding: 14px 0;
}

.apply-toolbar {
  align-items: center;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: grid;
  gap: 12px;
  grid-template-columns: auto auto minmax(180px, 1fr);
  margin-bottom: 16px;
  padding-bottom: 16px;
}

.conflict-panel {
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 6px;
  margin: 16px 0;
  padding: 12px;
}

.job-state-panel {
  border-radius: 10px;
  margin: 16px 0;
  padding: 14px 16px;
}

.job-state-panel-danger {
  background: linear-gradient(
    180deg,
    var(--el-color-danger-light-9),
    var(--el-bg-color)
  );
  border: 1px solid var(--el-color-danger-light-5);
}

.job-state-panel-header,
.job-state-panel-tags,
.job-state-panel-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.job-state-panel-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.job-state-panel-title {
  color: var(--el-color-danger-dark-2);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}

.job-state-panel-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 2px;
}

.job-state-panel-message {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.7;
  margin-top: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.job-state-panel-code-hint {
  color: var(--el-color-danger-dark-2);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 8px;
}

.job-state-panel-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 10px;
}

html.dark .job-state-panel-danger {
  background: linear-gradient(
    180deg,
    rgba(var(--el-color-danger-rgb), 0.2),
    rgba(var(--el-color-danger-rgb), 0.08)
  );
  border-color: rgba(var(--el-color-danger-rgb), 0.4);
}

html.dark .job-state-panel-title,
html.dark .job-state-panel-code-hint {
  color: var(--el-color-danger-light-3);
}

html.dark .job-state-panel-subtitle,
html.dark .job-state-panel-meta {
  color: var(--el-text-color-regular);
}

.conflict-title {
  color: var(--el-color-warning-dark-2);
  font-weight: 600;
  margin-bottom: 8px;
}

.conflict-item {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  line-height: 1.6;
}

.translation-job-review-tabs {
  margin-top: 16px;
}

.translation-json-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.translation-dialog-intro {
  min-width: 0;
}

.translation-dialog-intro-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.translation-dialog-intro-text {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.translation-json-toolbar-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.translation-json-warning-list {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  padding: 16px;
  background: var(--el-fill-color-extra-light);
}

.translation-json-group-title {
  display: flex;
  align-items: center;
  margin: 4px 0 10px;
  min-height: 21px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

.translation-json-warning-item {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

.cover-image-review-section {
  margin-bottom: 18px;
}

.cover-image-review-item {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 14px;
}

.cover-image-review-header,
.cover-image-review-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
}

.cover-image-review-title-row {
  align-items: center;
  display: flex;
  flex: 1;
  gap: 8px;
  min-width: 0;
}

.cover-image-review-select {
  flex-shrink: 0;
}

.cover-image-review-title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  min-width: 0;
  word-break: break-word;
}

.cover-image-review-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 12px;
}

.cover-image-preview-panel {
  min-width: 0;
}

.cover-image-preview-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 6px;
}

.cover-image-preview-img,
.cover-image-preview-empty {
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  min-height: 140px;
  width: 100%;
}

.cover-image-preview-img {
  aspect-ratio: 16 / 9;
  display: block;
  object-fit: contain;
}

.cover-image-preview-empty {
  align-items: center;
  display: flex;
  justify-content: center;
}

.cover-image-review-message {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 10px;
  word-break: break-word;
}

.cover-image-review-adoption {
  align-items: center;
  color: var(--el-text-color-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.cover-image-review-adoption-text {
  font-size: 12px;
}

.cover-image-review-actions {
  justify-content: flex-end;
  margin-top: 12px;
}

.ai-skipped-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-skipped-item span {
  min-width: 0;
}

@media (max-width: 767px) {
  .translation-search-form :deep(.el-form-item) {
    margin-right: 0;
    width: 100%;
  }

  .translation-search-form :deep(.el-input),
  .translation-search-form :deep(.el-select) {
    width: 100% !important;
  }

  .translation-actions {
    float: none;
    margin-top: 10px;
  }

  .detail-header {
    display: block;
  }

  .detail-header-actions {
    margin-top: 12px;
  }

  .apply-toolbar {
    grid-template-columns: 1fr;
  }

  .translation-json-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .job-state-panel-header {
    flex-direction: column;
  }

  .cover-image-review-grid {
    grid-template-columns: 1fr;
  }

  .translation-json-toolbar-actions {
    flex-wrap: wrap;
  }
}
</style>
