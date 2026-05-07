<template>
  <div class="common-right-panel-form translation-job-list-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>多语言数据管理</el-breadcrumb-item>
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
        <ResponsiveTableColumn label="状态" width="130">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" effect="plain">
              {{ row.status }}
            </el-tag>
            <div v-if="row.runtimeState" class="source-meta">
              {{ row.runtimeState }}
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
                {{ getAppliedEntryCount(tab.entries) }}
              </el-descriptions-item>
              <el-descriptions-item label="已选择">
                {{ getSelectedEntryCount(tab.entryKeys) }}
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
              v-if="tab.entryKeys.length > 0"
              class="translation-json-toolbar"
            >
              <div class="translation-dialog-intro">
                <div class="translation-dialog-intro-title">选择采纳字段</div>
                <div class="translation-dialog-intro-text">
                  默认仅勾选未采纳条目，已选择
                  {{ getSelectedEntryCount(tab.entryKeys) }} 项。重新勾选已采纳条目时会二次确认。
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
              v-if="tab.groups.length === 0 && tab.skippedEntries.length === 0"
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
  { label: '等待审核', value: '等待审核' },
  { label: '不采纳', value: '不采纳' },
  { label: '部分采纳', value: '部分采纳' },
  { label: '完全采纳', value: '完全采纳' }
]

const applyStatusSet = new Set(['等待审核', '不采纳', '部分采纳', '完全采纳'])
const deleteStatusSet = new Set(['未开始', '不采纳', '部分采纳', '完全采纳'])

const progressStageTextMap = {
  pending: '等待领取',
  claimed: '已领取任务',
  BuildEntries: '构建翻译条目',
  TranslatePost: '翻译文章',
  TranslateContent: '翻译内容',
  ImportSourceSnapshot: '导入源快照',
  PrepareTargetPost: '准备目标文章',
  ValidateJob: '校验任务',
  FinalizeReview: '整理审核结果'
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
      const adoptionEntryList = Array.isArray(currentJob.value?.adoption?.entries)
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
        return entry && entry.entryKey && !entry.aiSkipReason
      })
    })

    const skippedReviewEntries = computed(() => {
      return previewEntries.value.filter(entry => {
        return entry && entry.aiSkipReason
      })
    })

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
        const adoptionEntry = adoptionEntryMap.value.get(String(entry.entryKey || ''))
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

      return Array.from(tabMap.values()).map(tab => {
        return {
          ...tab,
          entryKeys: tab.entries.map(entry => entry.id),
          groups: buildReviewEntryGroups(tab.entries)
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
      const pendingEntryList = (tab?.entries || reviewDisplayEntries.value).filter(
        entry => {
          return entry?.id && !selectedEntryKeys.value.includes(entry.id)
        }
      )
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
      canDelete,
      canReject,
      canRetry,
      beforeReviewEntrySelect,
      beforeReviewGroupSelect,
      conflictList,
      currentJob,
      clearReviewEntries,
      deferJob,
      deleteJob,
      detailDrawerVisible,
      formatDate,
      getJobList,
      getJobTypeText,
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

  .translation-json-toolbar-actions {
    flex-wrap: wrap;
  }
}
</style>
