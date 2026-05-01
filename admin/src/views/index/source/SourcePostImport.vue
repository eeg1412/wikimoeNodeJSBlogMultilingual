<template>
  <div class="common-right-panel-form source-post-import-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>源数据管理</el-breadcrumb-item>
        <el-breadcrumb-item>源文章导入</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="source-post-search-form"
          @submit.prevent
          @keypress.enter="getSourceDatabasePostList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="标题、alias、摘要、源 ID"
              clearable
              style="width: 240px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.type"
              placeholder="类型"
              clearable
              style="width: 120px"
            >
              <el-option
                v-for="item in postTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.status"
              placeholder="状态"
              clearable
              style="width: 120px"
            >
              <el-option
                v-for="item in postStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getSourceDatabasePostList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr source-post-actions">
        <el-button @click="getSourceDatabasePostList(false)">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="mb20 list-table-body">
      <ResponsiveTable
        ref="tableRef"
        :data="sourcePostList"
        row-key="sourceId"
        height="100%"
        border
      >
        <ResponsiveTableColumn label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="getPostTypeTagType(row.type)" effect="plain">
              {{ getPostTypeText(row.type) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源文章" min-width="280">
          <template #default="{ row }">
            <div class="source-title">
              {{ getPostDisplayTitle(row) }}
            </div>
            <div class="source-meta">{{ row.sourceId }}</div>
            <div
              v-if="row.excerpt && Number(row.type) !== 2"
              class="source-excerpt"
            >
              {{ row.excerpt }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="作者" min-width="140">
          <template #default="{ row }">
            {{ row.author?.nickname || row.author?.username || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn prop="alias" label="Alias" min-width="150" />
        <ResponsiveTableColumn label="分类" min-width="160">
          <template #default="{ row }">
            {{ row.sort?.sortname || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="标签" min-width="220">
          <template #default="{ row }">
            <div v-if="row.tags?.length" class="table-tag-list">
              <el-tag
                v-for="tag in row.tags"
                :key="tag._id"
                size="small"
                effect="plain"
              >
                #{{ tag.tagname }}
              </el-tag>
            </div>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="地点" min-width="220">
          <template #default="{ row }">
            <div v-if="row.mappointList?.length" class="table-tag-list">
              <el-tag
                v-for="mappoint in row.mappointList"
                :key="mappoint._id"
                size="small"
                effect="plain"
              >
                {{ mappoint.title }}
              </el-tag>
            </div>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="关联与相关内容" min-width="420">
          <template #default="{ row }">
            <PostRelationSummary :post="row" />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getPostStatusTagType(row.status)" effect="plain">
              {{ getPostStatusText(row.status) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="快照状态" min-width="190">
          <template #default="{ row }">
            <div
              v-if="row.snapshotSummary?.length"
              class="snapshot-language-tags"
            >
              <el-tag
                v-for="snapshot in row.snapshotSummary"
                :key="snapshot._id"
                type="success"
                size="small"
                effect="plain"
              >
                {{ getLanguageText(snapshot.sourceLanguageCode) }} / v{{
                  snapshot.snapshotVersion || 1
                }}
              </el-tag>
            </div>
            <el-tag v-else type="info" effect="plain">未生成</el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源更新时间" width="180">
          <template #default="{ row }">
            {{ $formatDate(row.updatedAt || row.date || row.createdAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!row.hasSnapshot"
              type="primary"
              size="small"
              :loading="rowActionLoadingMap[row.sourceId]"
              @click="openLanguageDialog(row, 'import')"
            >
              生成快照
            </el-button>
            <el-button
              v-if="row.hasSnapshot"
              type="warning"
              size="small"
              :loading="rowActionLoadingMap[row.sourceId]"
              @click="openLanguageDialog(row, 'overwrite')"
            >
              覆盖快照
            </el-button>
            <el-button
              v-if="row.hasSnapshot"
              size="small"
              @click="goSnapshot(row)"
            >
              查看快照
            </el-button>
            <el-button
              v-if="!row.hasSnapshot"
              type="success"
              size="small"
              :loading="rowActionLoadingMap[getAiActionKey(row)]"
              :disabled="rowActionLoadingMap[row.sourceId]"
              @click="openAiImportDialog(row)"
            >
              生成并AI翻译
            </el-button>
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

    <el-dialog
      v-model="resultDialogVisible"
      title="快照生成结果"
      width="760px"
      align-center
    >
      <template v-if="result">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="源快照 ID">
            {{ result.sourceSnapshotId }}
          </el-descriptions-item>
          <el-descriptions-item label="翻译组 ID">
            {{ result.translationGroupId }}
          </el-descriptions-item>
          <el-descriptions-item label="快照版本">
            {{ result.snapshotVersion }}
          </el-descriptions-item>
          <el-descriptions-item label="待复核翻译">
            {{ result.sourceChangedTranslations || 0 }}
          </el-descriptions-item>
        </el-descriptions>
        <div class="mt20" v-if="copiedCountRows.length > 0">
          <div class="result-title">复制统计</div>
          <div class="copied-count-grid">
            <div
              v-for="item in copiedCountRows"
              :key="item.collectionName"
              class="copied-count-item"
            >
              <div class="copied-count-name">{{ item.collectionName }}</div>
              <div class="copied-count-values">
                创建 {{ item.created }} / 复用 {{ item.reused }} / 更新
                {{ item.updated }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="aiDialogVisible"
      title="生成并AI翻译"
      width="min(1120px, 96vw)"
      align-center
      destroy-on-close
      append-to-body
      :show-close="!isAiImportBusy"
      :close-on-click-modal="!isAiImportBusy"
      :close-on-press-escape="!isAiImportBusy"
      :before-close="handleAiDialogBeforeClose"
      @closed="resetAiImportState"
    >
      <div
        v-loading="aiApplying"
        element-loading-text="正在保存，请稍候"
        class="ai-import-dialog-body"
      >
        <template v-if="aiStep === 'setup'">
          <el-form
            :model="aiForm"
            label-width="120px"
            class="ai-import-form"
            @submit.prevent
          >
            <el-form-item label="源语言" required>
              <el-select
                v-model="aiForm.sourceLanguageCode"
                class="w_10"
                filterable
                :disabled="isAiImportBusy"
                @change="handleAiSourceLanguageChange"
              >
                <el-option
                  v-for="item in languageOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="翻译为" required>
              <el-checkbox-group
                v-model="aiForm.targetLanguageCodes"
                :disabled="isAiImportBusy"
                class="ai-language-checks"
              >
                <el-checkbox
                  v-for="item in targetLanguageOptions"
                  :key="item.value"
                  :label="item.value"
                >
                  {{ item.label }}
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="此次提示词">
              <el-input
                v-model="aiForm.prompt"
                type="textarea"
                :rows="5"
                :disabled="isAiImportBusy"
                placeholder="可补充本次翻译的语气、专有名词、保留词或风格要求"
              />
            </el-form-item>
          </el-form>
        </template>

        <template v-if="aiStep === 'running'">
          <el-descriptions class="mb20" :column="3" border>
            <el-descriptions-item label="源文章">
              {{ aiRow ? getPostDisplayTitle(aiRow) : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="源语言">
              {{ getLanguageText(aiForm.sourceLanguageCode) }}
            </el-descriptions-item>
            <el-descriptions-item label="目标语言">
              {{ aiForm.targetLanguageCodes.length }}
            </el-descriptions-item>
          </el-descriptions>
          <div ref="aiStreamFeedbackRef" class="ai-stream-feedback">
            <div class="translation-json-group-title">实时进度</div>
            <div
              v-for="item in aiProgressList"
              :key="item.id"
              class="ai-stream-status-item"
            >
              {{ item.message }}
            </div>
            <pre
              v-if="aiStreamContent"
              ref="aiStreamContentRef"
              class="ai-stream-content"
              >{{ aiStreamContent }}</pre
            >
          </div>
        </template>

        <template v-if="aiStep === 'preview'">
          <el-alert
            class="mb20"
            type="warning"
            show-icon
            :closable="false"
            title="确认保存后，会写入所选语言版本和关联内容。"
          />

          <el-form label-width="120px" class="ai-import-form" @submit.prevent>
            <el-form-item label="采用语言">
              <el-checkbox-group
                v-model="selectedAiResultLanguageCodes"
                :disabled="isAiImportBusy"
                class="ai-language-checks"
              >
                <el-checkbox
                  v-for="item in aiResultList"
                  :key="item.languageCode"
                  :label="item.languageCode"
                >
                  {{ getLanguageText(item.languageCode) }}
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="保存后发布">
              <el-checkbox-group
                v-model="aiPublishLanguageCodes"
                :disabled="isAiImportBusy"
                class="ai-language-checks"
              >
                <el-checkbox
                  v-for="item in aiResultList"
                  :key="item.languageCode"
                  :label="item.languageCode"
                  :disabled="
                    !selectedAiResultLanguageCodes.includes(item.languageCode)
                  "
                >
                  {{ getLanguageText(item.languageCode) }}
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
          </el-form>

          <el-tabs
            v-model="activeAiPreviewLanguageCode"
            class="ai-preview-tabs"
          >
            <el-tab-pane
              v-for="resultItem in aiResultList"
              :key="resultItem.languageCode"
              :label="getLanguageText(resultItem.languageCode)"
              :name="resultItem.languageCode"
            >
              <el-descriptions class="mb20" :column="4" border>
                <el-descriptions-item label="可写入变更">
                  {{ resultItem.preview.changeCount }}
                </el-descriptions-item>
                <el-descriptions-item label="跳过条目">
                  {{ resultItem.preview.skippedCount }}
                </el-descriptions-item>
                <el-descriptions-item label="暂未翻译">
                  {{ resultItem.skippedEntries.length }}
                </el-descriptions-item>
                <el-descriptions-item label="处理内容">
                  {{ resultItem.entryCount }}
                </el-descriptions-item>
              </el-descriptions>

              <el-alert
                v-if="resultItem.preview.changeCount === 0"
                class="mb20"
                type="info"
                show-icon
                :closable="false"
                title="内容与源内容一致，仍可采用并发布。"
              />

              <div
                v-if="
                  resultItem.preview.aiSkipList.length > 0 ||
                  resultItem.skippedEntries.length > 0 ||
                  resultItem.preview.warningList.length > 0
                "
                class="translation-json-warning-list"
              >
                <div
                  v-for="item in resultItem.preview.aiSkipList"
                  :key="item.id"
                  class="translation-skip-preview-card"
                >
                  <div class="translation-import-preview-item-title">
                    <TranslationEntryMeta :entry="item" />
                  </div>
                  <div class="translation-skip-preview-columns">
                    <div
                      v-if="item.hasSourceValue"
                      class="translation-skip-preview-panel"
                    >
                      <div class="translation-import-preview-panel-title">
                        源文
                        <div
                          v-if="
                            item.sourceRecordLabel &&
                            item.sourceRecordLabel !== item.recordLabel
                          "
                          class="translation-import-preview-panel-context"
                        >
                          {{ item.sourceRecordLabel }}
                        </div>
                      </div>
                      <div
                        v-if="item.sourceHtml"
                        class="translation-import-preview-html"
                        v-html="item.sourceHtml"
                      />
                      <pre class="translation-import-preview-raw">{{
                        item.sourceValue
                      }}</pre>
                    </div>
                    <div class="translation-skip-preview-panel">
                      <div class="translation-import-preview-panel-title">
                        当前
                      </div>
                      <div
                        v-if="item.targetHtml"
                        class="translation-import-preview-html"
                        v-html="item.targetHtml"
                      />
                      <pre class="translation-import-preview-raw">{{
                        item.targetValue
                      }}</pre>
                    </div>
                    <div class="translation-skip-preview-panel">
                      <div class="translation-import-preview-panel-title">
                        跳过说明
                      </div>
                      <div class="translation-skip-reason">
                        {{ item.reason }}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-for="item in resultItem.skippedEntries"
                  :key="item.id"
                  class="translation-json-warning-item"
                >
                  {{
                    item.message || `${item.label || item.id}：${item.reason}`
                  }}
                </div>
                <div
                  v-for="warning in resultItem.preview.warningList"
                  :key="warning"
                  class="translation-json-warning-item"
                >
                  {{ warning }}
                </div>
              </div>

              <div
                v-for="group in resultItem.previewGroups"
                :key="group.label"
                class="translation-import-preview-group"
              >
                <div class="translation-json-group-header">
                  <div class="translation-json-group-heading">
                    <div
                      v-if="group.meta.eyebrow"
                      class="translation-json-group-eyebrow"
                    >
                      {{ group.meta.eyebrow }}
                    </div>
                    <div class="translation-json-group-title">
                      {{ group.meta.title || group.label || '未命名分组' }}
                    </div>
                  </div>
                  <div class="translation-json-group-count">
                    {{ group.entries.length }} 项
                  </div>
                </div>
                <div
                  v-for="item in group.entries"
                  :key="item.id"
                  class="translation-import-preview-item"
                >
                  <div class="translation-import-preview-item-title">
                    <TranslationEntryMeta :entry="item" />
                  </div>
                  <div class="translation-import-preview-columns">
                    <div
                      v-if="item.hasSourceValue"
                      class="translation-import-preview-panel"
                    >
                      <div class="translation-import-preview-panel-title">
                        源文
                        <div
                          v-if="
                            item.sourceRecordLabel &&
                            item.sourceRecordLabel !== item.recordLabel
                          "
                          class="translation-import-preview-panel-context"
                        >
                          {{ item.sourceRecordLabel }}
                        </div>
                      </div>
                      <div
                        v-if="item.sourceHtml"
                        class="translation-import-preview-html"
                        v-html="item.sourceHtml"
                      />
                      <pre class="translation-import-preview-raw">{{
                        item.sourceValue
                      }}</pre>
                    </div>
                    <div class="translation-import-preview-panel">
                      <div class="translation-import-preview-panel-title">
                        写入前
                      </div>
                      <div
                        v-if="item.currentHtml"
                        class="translation-import-preview-html"
                        v-html="item.currentHtml"
                      />
                      <pre class="translation-import-preview-raw">{{
                        item.currentValue
                      }}</pre>
                    </div>
                    <div class="translation-import-preview-panel">
                      <div class="translation-import-preview-panel-title">
                        AI 翻译后
                      </div>
                      <div
                        v-if="item.nextHtml"
                        class="translation-import-preview-html"
                        v-html="item.nextHtml"
                      />
                      <pre class="translation-import-preview-raw">{{
                        item.nextValue
                      }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>

      <template #footer>
        <el-button :disabled="isAiImportBusy" @click="aiDialogVisible = false">
          取消
        </el-button>
        <el-button
          v-if="aiStep === 'preview'"
          :disabled="isAiImportBusy"
          @click="backToAiSetup"
        >
          返回调整
        </el-button>
        <el-button
          v-if="aiStep !== 'preview'"
          type="primary"
          :loading="aiRunning"
          :disabled="isAiImportBusy"
          @click="startAiImportTranslation"
        >
          开始
        </el-button>
        <el-button
          v-else
          type="primary"
          :loading="aiApplying"
          :disabled="
            isAiImportBusy || selectedAiResultLanguageCodes.length === 0
          "
          @click="confirmAiImportApply"
        >
          保存所选结果
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="languageDialogVisible"
      :title="languageDialogTitle"
      width="480px"
      align-center
      destroy-on-close
    >
      <el-form :model="languageForm" label-width="110px" @submit.prevent>
        <el-form-item label="快照语言" required>
          <el-select v-model="languageForm.sourceLanguageCode" class="w_10">
            <el-option
              v-for="item in languageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="languageDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmLanguageAction">
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { multilingualApi } from '@/api'
import PostRelationSummary from '@/components/PostRelationSummary.vue'
import TranslationEntryMeta from '@/components/TranslationEntryMeta.vue'
import ls from '@/utils/ls'
import store from '@/store'
import {
  createApiErrorFromResponse,
  extractApiErrorMessages
} from '@/utils/apiError'
import {
  POST_STATUS_OPTIONS,
  POST_TYPE_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText,
  getPostStatusTagType,
  getPostStatusText,
  getPostDisplayTitle,
  getPostTypeTagType,
  getPostTypeText
} from '@/utils/multilingual'
import { groupTranslationEntryList } from '@/utils/translationEntryDisplay'
import { buildTranslationImportPreview } from '@/utils/translationJson'
import {
  buildPreviewPostFromSource,
  buildPostTranslationEntries,
  buildSourceMappedTranslationEntries,
  buildTranslationPostForm
} from '@/utils/translationPostAiWorkflow'

const SOURCE_IMPORT_LANGUAGE_STORAGE_KEY = 'wikimoe-source-import-language'
const AI_IMPORT_SOURCE_LANGUAGE_STORAGE_KEY =
  'wikimoe-ai-import-source-language'
const AI_IMPORT_TARGET_LANGUAGES_STORAGE_KEY =
  'wikimoe-ai-import-target-languages'

export default {
  components: {
    PostRelationSummary,
    TranslationEntryMeta
  },
  setup() {
    const router = useRouter()
    const tableRef = ref(null)
    const sourcePostList = ref([])
    const total = ref(0)
    const result = ref(null)
    const resultDialogVisible = ref(false)
    const languageDialogVisible = ref(false)
    const aiDialogVisible = ref(false)
    const languageAction = ref('import')
    const languageRow = ref(null)
    const aiRow = ref(null)
    const aiStep = ref('setup')
    const aiRunning = ref(false)
    const aiApplying = ref(false)
    const aiResultList = ref([])
    const selectedAiResultLanguageCodes = ref([])
    const aiPublishLanguageCodes = ref([])
    const activeAiPreviewLanguageCode = ref('')
    const aiProgressList = ref([])
    const aiStreamContent = ref('')
    const aiStreamFeedbackRef = ref(null)
    const aiStreamContentRef = ref(null)
    const rowActionLoadingMap = reactive({})
    const languageForm = reactive({
      sourceLanguageCode: 'zh-CN'
    })
    const aiForm = reactive({
      sourceLanguageCode: 'zh-CN',
      targetLanguageCodes: [],
      prompt: ''
    })
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: '',
      type: '',
      status: ''
    })

    const languageDialogTitle = computed(() => {
      if (languageAction.value === 'overwrite') {
        return '选择要覆盖的快照语言'
      }
      return '选择源文章快照语言'
    })

    const isAiImportBusy = computed(() => {
      return aiRunning.value || aiApplying.value
    })

    const targetLanguageOptions = computed(() => {
      return SUPPORTED_LANGUAGE_OPTIONS.filter(item => {
        return item.value !== aiForm.sourceLanguageCode
      })
    })

    const copiedCountRows = computed(() => {
      const copiedCounts = result.value?.copiedCounts || {}
      return Object.keys(copiedCounts).map(collectionName => {
        const item = copiedCounts[collectionName] || {}
        return {
          collectionName,
          created: item.created || 0,
          reused: item.reused || 0,
          updated: item.updated || 0
        }
      })
    })

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.type !== '') {
        requestParams.type = params.type
      }
      if (params.status !== '') {
        requestParams.status = params.status
      }
      return requestParams
    }

    const getSourceDatabasePostList = resetPage => {
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }

      multilingualApi
        .getSourceDatabasePostList(getRequestParams())
        .then(response => {
          const responseData = response.data.data || {}
          sourcePostList.value = responseData.list || []
          total.value = responseData.total || 0
          tableRef.value?.scrollTo({ top: 0 })
        })
        .catch(error => {
          console.log(error)
        })
    }

    const setRowLoading = (row, value) => {
      rowActionLoadingMap[row.sourceId] = value
    }

    const syncRowSnapshot = (row, data) => {
      row.hasSnapshot = true
      row.snapshot = {
        _id: data.sourceSnapshotId,
        sourceId: row.sourceId,
        sourceLanguageCode: data.sourceLanguageCode,
        translationGroupId: data.translationGroupId,
        snapshotVersion: data.snapshotVersion,
        sourceSnapshotAt: new Date()
      }
      row.snapshotSummary = [
        ...(row.snapshotSummary || []).filter(snapshot => {
          return snapshot.sourceLanguageCode !== data.sourceLanguageCode
        }),
        row.snapshot
      ]
    }

    const getStoredSourceLanguageCode = () => {
      const storedValue = ls.getItem(SOURCE_IMPORT_LANGUAGE_STORAGE_KEY)
      const matched = SUPPORTED_LANGUAGE_OPTIONS.find(item => {
        return item.value === storedValue
      })
      if (matched) {
        return matched.value
      }
      return 'zh-CN'
    }

    const rememberSourceLanguageCode = sourceLanguageCode => {
      ls.setItem(SOURCE_IMPORT_LANGUAGE_STORAGE_KEY, sourceLanguageCode)
    }

    const getStoredAiSourceLanguageCode = () => {
      const storedValue = ls.getItem(AI_IMPORT_SOURCE_LANGUAGE_STORAGE_KEY)
      const matched = SUPPORTED_LANGUAGE_OPTIONS.find(item => {
        return item.value === storedValue
      })
      if (matched) {
        return matched.value
      }
      return getStoredSourceLanguageCode()
    }

    const getStoredAiTargetLanguageCodes = sourceLanguageCode => {
      const storedValue = ls.getItem(AI_IMPORT_TARGET_LANGUAGES_STORAGE_KEY)
      let storedList = []
      if (storedValue) {
        try {
          const parsedValue = JSON.parse(storedValue)
          if (Array.isArray(parsedValue)) {
            storedList = parsedValue
          }
        } catch (error) {
          storedList = String(storedValue)
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        }
      }
      const supportedCodeSet = new Set(
        SUPPORTED_LANGUAGE_OPTIONS.map(item => item.value)
      )
      const targetList = storedList.filter(languageCode => {
        return (
          supportedCodeSet.has(languageCode) &&
          languageCode !== sourceLanguageCode
        )
      })
      if (targetList.length > 0) {
        return targetList
      }
      const firstTarget = SUPPORTED_LANGUAGE_OPTIONS.find(item => {
        return item.value !== sourceLanguageCode
      })
      return firstTarget ? [firstTarget.value] : []
    }

    const rememberAiImportOptions = () => {
      ls.setItem(
        AI_IMPORT_SOURCE_LANGUAGE_STORAGE_KEY,
        aiForm.sourceLanguageCode
      )
      ls.setItem(
        AI_IMPORT_TARGET_LANGUAGES_STORAGE_KEY,
        JSON.stringify(aiForm.targetLanguageCodes)
      )
    }

    const openLanguageDialog = (row, action) => {
      languageRow.value = row
      languageAction.value = action
      languageForm.sourceLanguageCode = getStoredSourceLanguageCode()
      languageDialogVisible.value = true
    }

    const resetAiImportState = () => {
      aiRow.value = null
      aiStep.value = 'setup'
      aiRunning.value = false
      aiApplying.value = false
      aiResultList.value = []
      selectedAiResultLanguageCodes.value = []
      aiPublishLanguageCodes.value = []
      activeAiPreviewLanguageCode.value = ''
      aiProgressList.value = []
      aiStreamContent.value = ''
      aiForm.prompt = ''
    }

    const openAiImportDialog = row => {
      aiRow.value = row
      aiStep.value = 'setup'
      aiRunning.value = false
      aiApplying.value = false
      aiResultList.value = []
      selectedAiResultLanguageCodes.value = []
      aiPublishLanguageCodes.value = []
      activeAiPreviewLanguageCode.value = ''
      aiProgressList.value = []
      aiStreamContent.value = ''
      aiForm.sourceLanguageCode = getStoredAiSourceLanguageCode()
      aiForm.targetLanguageCodes = getStoredAiTargetLanguageCodes(
        aiForm.sourceLanguageCode
      )
      aiForm.prompt = ''
      aiDialogVisible.value = true
    }

    const handleAiSourceLanguageChange = () => {
      aiForm.targetLanguageCodes = aiForm.targetLanguageCodes.filter(
        languageCode => languageCode !== aiForm.sourceLanguageCode
      )
      if (aiForm.targetLanguageCodes.length === 0) {
        aiForm.targetLanguageCodes = getStoredAiTargetLanguageCodes(
          aiForm.sourceLanguageCode
        )
      }
    }

    const getAiActionKey = row => {
      return `ai:${row.sourceId}`
    }

    const setAiRowLoading = value => {
      if (!aiRow.value) {
        return
      }
      rowActionLoadingMap[getAiActionKey(aiRow.value)] = value
    }

    const pushAiProgress = message => {
      if (!message) {
        return
      }
      aiProgressList.value.push({
        id: `${Date.now()}-${aiProgressList.value.length}`,
        message
      })
      scrollAiStreamFeedbackToBottom()
    }

    const scrollAiStreamFeedbackToBottom = () => {
      nextTick(() => {
        window.requestAnimationFrame(() => {
          const feedbackElement = aiStreamFeedbackRef.value
          if (feedbackElement) {
            feedbackElement.scrollTop = feedbackElement.scrollHeight
          }
          const contentElement = aiStreamContentRef.value
          if (contentElement) {
            contentElement.scrollTop = contentElement.scrollHeight
          }
        })
      })
    }

    const handleAiDialogBeforeClose = done => {
      if (isAiImportBusy.value) {
        return
      }
      done()
    }

    const backToAiSetup = () => {
      aiStep.value = 'setup'
      aiResultList.value = []
      selectedAiResultLanguageCodes.value = []
      aiPublishLanguageCodes.value = []
      activeAiPreviewLanguageCode.value = ''
      aiProgressList.value = []
      aiStreamContent.value = ''
    }

    const confirmLanguageAction = () => {
      const row = languageRow.value
      if (!row) {
        return
      }
      rememberSourceLanguageCode(languageForm.sourceLanguageCode)
      languageDialogVisible.value = false
      if (languageAction.value === 'overwrite') {
        overwriteRow(row, languageForm.sourceLanguageCode)
        return
      }
      importRow(row, languageForm.sourceLanguageCode)
    }

    const importRow = async (row, sourceLanguageCode) => {
      setRowLoading(row, true)
      try {
        const response = await multilingualApi.importSourcePost({
          sourceId: String(row.sourceId),
          sourceLanguageCode,
          overwrite: false
        })
        result.value = response.data.data
        result.value.sourceLanguageCode = sourceLanguageCode
        syncRowSnapshot(row, result.value)
        resultDialogVisible.value = true
        ElMessage.success('源文章快照生成成功')
        getSourceDatabasePostList(false)
      } catch (error) {
        await handleImportError(row, error, sourceLanguageCode)
      } finally {
        setRowLoading(row, false)
      }
    }

    const assertAiRowCanPreview = row => {
      if (!row) {
        throw new Error('请选择源文章')
      }
      if (row.hasSnapshot || (row.snapshotSummary || []).length > 0) {
        throw new Error('该文章已经生成快照，不能使用导入并翻译')
      }
    }

    const loadSourceDatabasePost = async row => {
      const response = await multilingualApi.getSourceDatabasePostDetail(
        {
          id: String(row.sourceId),
          sourceLanguageCode: aiForm.sourceLanguageCode
        },
        true
      )
      const sourcePost = response.data.data?.post
      if (!sourcePost) {
        throw new Error('源文章不存在')
      }
      assertAiRowCanPreview(sourcePost)
      return sourcePost
    }

    const parseClientSseBlock = block => {
      const eventData = {
        eventName: 'message',
        data: {}
      }
      const dataLines = []
      block.split(/\r?\n/).forEach(line => {
        if (line.startsWith('event:')) {
          eventData.eventName = line.slice(6).trim()
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart())
        }
      })
      if (dataLines.length === 0) {
        return null
      }
      eventData.data = JSON.parse(dataLines.join('\n'))
      return eventData
    }

    const findClientSseBoundary = buffer => {
      const lfIndex = buffer.indexOf('\n\n')
      const crlfIndex = buffer.indexOf('\r\n\r\n')
      if (lfIndex < 0 && crlfIndex < 0) {
        return { index: -1, length: 0 }
      }
      if (lfIndex < 0) {
        return { index: crlfIndex, length: 4 }
      }
      if (crlfIndex < 0) {
        return { index: lfIndex, length: 2 }
      }
      if (lfIndex < crlfIndex) {
        return { index: lfIndex, length: 2 }
      }
      return { index: crlfIndex, length: 4 }
    }

    const buildPreviewPayloadForPost = (payload, post, languageCode) => {
      return {
        ...(payload || {}),
        meta: {
          ...(payload?.meta || {}),
          postId: String(post._id || post.id || ''),
          contentId: String(post._id || post.id || ''),
          languageCode,
          sourceLanguageCode: aiForm.sourceLanguageCode
        }
      }
    }

    const handleAiStreamEvent = (
      eventData,
      languageCode,
      targetPost,
      referenceEntries,
      currentEntries
    ) => {
      if (!eventData) {
        return null
      }
      const data = eventData.data || {}
      if (eventData.eventName === 'status') {
        pushAiProgress(`${getLanguageText(languageCode)}：${data.message}`)
      }
      if (eventData.eventName === 'chunk') {
        if (data.contentDelta) {
          aiStreamContent.value += data.contentDelta
          scrollAiStreamFeedbackToBottom()
        }
      }
      if (eventData.eventName === 'result') {
        const payload = buildPreviewPayloadForPost(
          data.payload,
          targetPost,
          languageCode
        )
        const preview = buildTranslationImportPreview({
          parsedPayload: payload,
          currentEntries,
          form: buildTranslationPostForm(targetPost),
          referenceEntries
        })
        return { preview, payload }
      }
      if (eventData.eventName === 'error') {
        throw new Error(data.message || 'AI 翻译失败')
      }
      return null
    }

    const readAiTranslationStream = async ({
      response,
      languageCode,
      targetPost,
      referenceEntries,
      currentEntries
    }) => {
      if (!response.body) {
        throw new Error('当前浏览器无法读取翻译进度')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let preview = null
      let payload = null

      const consumeBuffer = () => {
        let boundary = findClientSseBoundary(buffer)
        while (boundary.index >= 0) {
          const block = buffer.slice(0, boundary.index)
          buffer = buffer.slice(boundary.index + boundary.length)
          const result = handleAiStreamEvent(
            parseClientSseBlock(block),
            languageCode,
            targetPost,
            referenceEntries,
            currentEntries
          )
          if (result?.preview) {
            preview = result.preview
            payload = result.payload
          }
          boundary = findClientSseBoundary(buffer)
        }
      }

      let done = false
      while (!done) {
        const result = await reader.read()
        done = result.done
        if (result.value) {
          buffer += decoder.decode(result.value, { stream: !done })
          consumeBuffer()
        }
      }

      if (buffer.trim()) {
        const result = handleAiStreamEvent(
          parseClientSseBlock(buffer),
          languageCode,
          targetPost,
          referenceEntries,
          currentEntries
        )
        if (result?.preview) {
          preview = result.preview
          payload = result.payload
        }
      }

      if (!preview) {
        throw new Error(`${getLanguageText(languageCode)} 没有生成预览`)
      }
      return { preview, payload }
    }

    const canAiKeepOriginalEntry = entry => {
      return entry.scope !== 'post' && entry.valueType !== 'richTextDocument'
    }

    const translateOneLanguage = async ({ sourcePost, languageCode }) => {
      const sourcePreviewPost = buildPreviewPostFromSource({
        sourcePost,
        sourceLanguageCode: aiForm.sourceLanguageCode,
        languageCode: aiForm.sourceLanguageCode,
        previewId: `preview-source-${sourcePost.sourceId || sourcePost._id}`
      })
      const targetPreviewPost = buildPreviewPostFromSource({
        sourcePost,
        sourceLanguageCode: aiForm.sourceLanguageCode,
        languageCode,
        previewId: `preview-${languageCode}-${sourcePost.sourceId || sourcePost._id}`
      })
      const mappedResult = buildSourceMappedTranslationEntries(
        sourcePreviewPost,
        targetPreviewPost
      )
      const entries = mappedResult.entries.map(entry => {
        const aiEntry = { ...entry }
        delete aiEntry.currentValue
        if (canAiKeepOriginalEntry(entry)) {
          aiEntry.skipAllowed = true
        }
        return aiEntry
      })
      if (entries.length === 0) {
        throw new Error(`${getLanguageText(languageCode)} 没有可翻译内容`)
      }

      pushAiProgress(`正在提交 ${getLanguageText(languageCode)} 翻译`)
      const response = await fetch(
        '/api/multilingual-admin/translation/ai/translate-stream',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${store.getters.adminToken}`
          },
          body: JSON.stringify({
            contentId: targetPreviewPost._id,
            contentType: 'sourcePostImport',
            sourceLanguageCode: aiForm.sourceLanguageCode,
            targetLanguageCode: languageCode,
            prompt: aiForm.prompt,
            skipUsageLog: true,
            entries
          })
        }
      )

      if (!response.ok) {
        throw await createApiErrorFromResponse(response, 'AI 翻译请求失败')
      }

      const streamResult = await readAiTranslationStream({
        response,
        languageCode,
        targetPost: targetPreviewPost,
        referenceEntries: entries,
        currentEntries: buildPostTranslationEntries(targetPreviewPost, {
          includeEmpty: true
        })
      })

      return {
        languageCode,
        payload: streamResult.payload,
        preview: streamResult.preview,
        previewGroups: groupTranslationEntryList(
          streamResult.preview.changeList || []
        ),
        skippedEntries: mappedResult.skippedEntries || [],
        entryCount: entries.length
      }
    }

    const startAiImportTranslation = async () => {
      const row = aiRow.value
      if (!row) {
        return
      }
      if (!aiForm.sourceLanguageCode) {
        ElMessage.warning('请选择源语言')
        return
      }
      if (aiForm.targetLanguageCodes.length === 0) {
        ElMessage.warning('请至少选择一个目标语言')
        return
      }

      rememberAiImportOptions()
      aiRunning.value = true
      aiStep.value = 'running'
      aiResultList.value = []
      selectedAiResultLanguageCodes.value = []
      aiPublishLanguageCodes.value = []
      activeAiPreviewLanguageCode.value = ''
      aiProgressList.value = []
      aiStreamContent.value = ''
      setAiRowLoading(true)
      try {
        assertAiRowCanPreview(row)
        const sourcePost = await loadSourceDatabasePost(row)
        const resultList = []
        for (const languageCode of aiForm.targetLanguageCodes) {
          resultList.push(
            await translateOneLanguage({
              sourcePost,
              languageCode
            })
          )
        }
        aiResultList.value = resultList
        selectedAiResultLanguageCodes.value = resultList.map(
          item => item.languageCode
        )
        aiPublishLanguageCodes.value = []
        activeAiPreviewLanguageCode.value = resultList[0]?.languageCode || ''
        aiStep.value = 'preview'
        if (
          resultList.length > 0 &&
          resultList.every(item => item.preview.changeCount === 0)
        ) {
          ElMessage.info('AI 返回内容与源内容一致，可仍然采用并发布')
        }
      } catch (error) {
        extractApiErrorMessages(error).forEach(message => {
          ElMessage.error(message)
        })
        aiStep.value = 'setup'
      } finally {
        aiRunning.value = false
        setAiRowLoading(false)
      }
    }

    const confirmAiImportApply = async () => {
      if (selectedAiResultLanguageCodes.value.length === 0) {
        ElMessage.warning('请至少选择一个可保存的语言')
        return
      }

      try {
        await ElMessageBox.confirm(
          '确认保存所选 AI 翻译结果？',
          '保存翻译结果',
          {
            type: 'warning',
            confirmButtonText: '保存',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }

      const selectedLanguageSet = new Set(selectedAiResultLanguageCodes.value)
      const publishLanguageSet = new Set(aiPublishLanguageCodes.value)
      const selectedResults = aiResultList.value.filter(item => {
        return selectedLanguageSet.has(item.languageCode)
      })
      aiApplying.value = true
      try {
        const response = await multilingualApi.applySourcePostAiImport(
          {
            sourceId: String(aiRow.value.sourceId),
            sourceLanguageCode: aiForm.sourceLanguageCode,
            results: selectedResults.map(resultItem => {
              return {
                languageCode: resultItem.languageCode,
                payload: resultItem.payload,
                publish: publishLanguageSet.has(resultItem.languageCode)
              }
            })
          },
          true
        )
        const snapshot = response.data.data?.snapshot
        if (!snapshot) {
          throw new Error('保存结果缺少源快照信息')
        }
        syncRowSnapshot(aiRow.value, snapshot)
        aiDialogVisible.value = false
        ElMessage.success('AI 翻译已保存')
        getSourceDatabasePostList(false)
      } finally {
        aiApplying.value = false
      }
    }

    const overwriteRow = (row, sourceLanguageCode) => {
      ElMessageBox.confirm(
        `确认覆盖源文章「${getPostDisplayTitle(row)}」的 ${sourceLanguageCode} 快照？旧关联和旧媒体不会自动删除。`,
        '确认覆盖源快照',
        {
          type: 'warning',
          confirmButtonText: '覆盖',
          cancelButtonText: '取消'
        }
      )
        .then(() => submitOverwrite(row, sourceLanguageCode))
        .catch(error => {
          if (error !== 'cancel' && error !== 'close') {
            console.log(error)
          }
        })
    }

    const submitOverwrite = async (row, sourceLanguageCode) => {
      setRowLoading(row, true)
      try {
        const response = await multilingualApi.overwriteSourcePost({
          sourceId: String(row.sourceId),
          sourceLanguageCode,
          overwrite: true
        })
        result.value = response.data.data
        result.value.sourceLanguageCode = sourceLanguageCode
        syncRowSnapshot(row, result.value)
        resultDialogVisible.value = true
        ElMessage.success('源文章快照覆盖成功')
        getSourceDatabasePostList(false)
      } finally {
        setRowLoading(row, false)
      }
    }

    const handleImportError = async (row, error, sourceLanguageCode) => {
      const responseData = error?.response?.data || {}
      const errorList = responseData.errorList || []
      const existsError = errorList.find(item => item.code === 'SOURCE_EXISTS')
      if (!existsError) {
        return
      }

      row.hasSnapshot = true
      row.snapshot = {
        _id: responseData.sourceSnapshotId,
        sourceId: row.sourceId,
        snapshotVersion: responseData.snapshotVersion || 1
      }
      try {
        await ElMessageBox.confirm(
          `该源文章已存在快照，当前版本为 ${responseData.snapshotVersion || '-'}。是否立即覆盖？`,
          '源快照已存在',
          {
            type: 'warning',
            confirmButtonText: '覆盖',
            cancelButtonText: '取消'
          }
        )
        await submitOverwrite(row, sourceLanguageCode)
      } catch (confirmError) {
        if (confirmError !== 'cancel' && confirmError !== 'close') {
          console.log(confirmError)
        }
      }
    }

    const goSnapshot = row => {
      router.push({
        name: 'SourcePostSnapshotList',
        query: {
          keyword: String(row.sourceId)
        }
      })
    }

    watch(
      () => params.page,
      () => {
        getSourceDatabasePostList(false)
      }
    )

    watch(selectedAiResultLanguageCodes, languageCodes => {
      const selectedSet = new Set(languageCodes)
      aiPublishLanguageCodes.value = aiPublishLanguageCodes.value.filter(
        languageCode => selectedSet.has(languageCode)
      )
    })

    watch(aiStreamContent, () => {
      scrollAiStreamFeedbackToBottom()
    })

    onMounted(() => {
      getSourceDatabasePostList(false)
    })

    return {
      tableRef,
      params,
      sourcePostList,
      total,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      postTypeOptions: POST_TYPE_OPTIONS,
      postStatusOptions: POST_STATUS_OPTIONS,
      result,
      resultDialogVisible,
      aiApplying,
      aiDialogVisible,
      aiForm,
      aiProgressList,
      aiPublishLanguageCodes,
      aiResultList,
      aiRow,
      aiRunning,
      aiStep,
      aiStreamContent,
      aiStreamContentRef,
      aiStreamFeedbackRef,
      activeAiPreviewLanguageCode,
      selectedAiResultLanguageCodes,
      languageDialogVisible,
      languageDialogTitle,
      languageForm,
      copiedCountRows,
      isAiImportBusy,
      rowActionLoadingMap,
      targetLanguageOptions,
      getLanguageText,
      getPostTypeTagType,
      getPostTypeText,
      getPostStatusText,
      getPostStatusTagType,
      getPostDisplayTitle,
      getSourceDatabasePostList,
      confirmLanguageAction,
      backToAiSetup,
      confirmAiImportApply,
      getAiActionKey,
      handleAiDialogBeforeClose,
      handleAiSourceLanguageChange,
      openAiImportDialog,
      openLanguageDialog,
      resetAiImportState,
      startAiImportTranslation,
      goSnapshot
    }
  }
}
</script>

<style scoped>
.source-post-import-page {
  min-height: 100%;
}

.source-title {
  font-weight: 600;
  line-height: 1.5;
}

.source-meta,
.snapshot-meta,
.source-excerpt {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.source-excerpt {
  max-width: 560px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.snapshot-language-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.table-empty-text {
  color: var(--el-text-color-secondary);
}

.result-title {
  font-weight: 600;
  margin-bottom: 10px;
}

.copied-count-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.copied-count-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px;
  background: var(--el-bg-color);
}

.copied-count-name {
  font-weight: 600;
  margin-bottom: 6px;
}

.copied-count-values {
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

.ai-import-dialog-body {
  min-height: 260px;
  max-height: min(72vh, 760px);
  overflow: auto;
  padding-right: 4px;
}

.ai-import-form {
  max-width: 880px;
}

.ai-language-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
}

.ai-preview-tabs {
  margin-top: 8px;
}

.ai-stream-feedback {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-fill-color-lighter);
}

.ai-stream-status-item {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}

.ai-stream-content {
  margin: 10px 0 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.translation-json-warning-list {
  margin-bottom: 18px;
}

.translation-json-warning-item {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}

.translation-skip-preview-card {
  margin-bottom: 12px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-color-warning-light-9);
}

.translation-skip-preview-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.translation-skip-preview-panel {
  min-width: 0;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-bg-color);
}

.translation-skip-reason {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
  word-break: break-word;
  white-space: pre-wrap;
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

.translation-json-group-eyebrow {
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-color-primary);
}

.translation-json-group-title,
.translation-import-preview-item-title {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.translation-json-group-count {
  flex-shrink: 0;
  color: var(--el-color-primary-dark-2);
  font-size: 12px;
  font-weight: 600;
}

.translation-import-preview-group {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  background: var(--el-bg-color);
}

.translation-import-preview-item + .translation-import-preview-item {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.translation-import-preview-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.translation-import-preview-panel {
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-fill-color-blank);
}

.translation-import-preview-panel-title {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.translation-import-preview-panel-context {
  margin-top: 2px;
  color: var(--el-text-color-placeholder);
  font-weight: 400;
}

.translation-import-preview-html,
.translation-import-preview-raw {
  overflow: auto;
  word-break: break-word;
}

.translation-import-preview-html {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}

.translation-import-preview-raw {
  max-height: 260px;
  margin: 0;
  white-space: pre-wrap;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.6;
}

.translation-import-preview-html + .translation-import-preview-raw {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.translation-import-preview-html :deep(:not(.w-e-image-group-img-body) > img),
.translation-import-preview-html
  :deep(:not(.w-e-image-group-img-body) > video) {
  max-width: 100%;
  height: auto;
}

@media (max-width: 767px) {
  .source-post-actions {
    float: none;
  }

  .translation-import-preview-columns {
    grid-template-columns: 1fr;
  }

  .translation-skip-preview-columns {
    grid-template-columns: 1fr;
  }

  .translation-json-group-header {
    flex-direction: column;
  }
}
</style>
