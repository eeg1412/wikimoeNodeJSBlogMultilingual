<template>
  <div class="common-right-panel-form multilingual-media-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item
          v-if="fixedSourceId"
          :to="{ name: 'MultilingualMediaList' }"
        >
          媒体库
        </el-breadcrumb-item>
        <el-breadcrumb-item v-else>{{ breadcrumbGroup }}</el-breadcrumb-item>
        <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="media-search-form"
          @submit.prevent
          @keypress.enter="getMediaList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="文件名、路径、描述、媒体 ID"
              clearable
              style="width: 260px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.languageCode"
              style="width: 180px"
              clearable
              placeholder="全部语言"
              @change="getMediaList(true)"
              @clear="getMediaList(true)"
            >
              <el-option
                v-for="item in languageOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.mediaMode"
              clearable
              placeholder="媒体模式"
              style="width: 140px"
              @change="getMediaList(true)"
              @clear="getMediaList(true)"
            >
              <el-option
                v-for="item in mediaModeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getMediaList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr media-actions">
        <el-button @click="getMediaList(false)">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <el-skeleton
      v-if="loading && fixedSourceId && mediaList.length === 0"
      :rows="8"
      animated
    />
    <div v-else class="mb20 list-table-body" v-loading="loading">
      <ResponsiveTable
        ref="tableRef"
        :data="mediaList"
        row-key="_id"
        height="100%"
        border
      >
        <ResponsiveTableColumn label="预览" width="150">
          <template #default="{ row }">
            <div class="media-preview-cell">
              <button
                v-if="isImageMedia(row) && getImagePreviewUrl(row)"
                type="button"
                class="media-preview-trigger"
                title="打开预览"
                @click="openMediaPreview(row)"
              >
                <el-image
                  :src="getImagePreviewUrl(row)"
                  fit="cover"
                  loading="lazy"
                  class="media-preview-image"
                />
                <div v-if="row.is360Panorama" class="media-preview-360">
                  360°
                </div>
              </button>
              <button
                v-else-if="isVideoMedia(row) && getVideoPreviewUrl(row)"
                type="button"
                class="media-preview-trigger"
                title="播放视频"
                @click="openMediaPreview(row)"
              >
                <el-image
                  v-if="getVideoCoverUrl(row)"
                  :src="getVideoCoverUrl(row)"
                  fit="cover"
                  loading="lazy"
                  class="media-preview-image"
                />
                <div v-else class="media-preview-cover-empty">无封面</div>
                <div class="media-preview-play">
                  <el-icon><VideoPlay /></el-icon>
                </div>
              </button>
              <div v-else class="media-preview-empty">无预览</div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="媒体" min-width="280">
          <template #default="{ row }">
            <div class="media-title">
              {{ row.name || row.filename || row._id }}
            </div>
            <div class="media-subtitle">{{ row._id }}</div>
            <div class="media-path">
              {{ row.filepath || row.remoteFilepath || '-' }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="语言" width="150">
          <template #default="{ row }">
            {{ getLanguageText(row.languageCode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="模式" width="120">
          <template #default="{ row }">
            <el-tag
              :type="row.mediaMode === 'local' ? 'success' : 'info'"
              effect="plain"
            >
              {{ getMediaModeText(row.mediaMode) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="尺寸" width="130">
          <template #default="{ row }">
            {{ getSizeText(row) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="文件大小" width="120">
          <template #default="{ row }">
            {{ getFileSizeText(row.filesize) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="描述" min-width="220">
          <template #default="{ row }">
            <span>{{ row.description || '-' }}</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="360 全景" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.is360Panorama" type="success" effect="plain">
              是
            </el-tag>
            <span v-else>-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="HDR" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.isHDR" type="success" effect="plain"> 是 </el-tag>
            <span v-else>-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源 ID" min-width="210">
          <template #default="{ row }">
            {{ row.sourceId || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="更新时间" width="180">
          <template #default="{ row }">
            {{ $formatDate(row.updatedAt || row.createdAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn
          v-if="!isSourceScope"
          label="AI翻译跳过"
          width="130"
        >
          <template #default="{ row }">
            <el-switch
              :model-value="row.aiTranslationSkip === true"
              :loading="isAiSkipUpdating(row)"
              @change="value => toggleAiSkip(row, value)"
            />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn
          label="操作"
          :width="isSourceScope ? 90 : 140"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="isSourceScope"
              size="small"
              @click="openDetail(row)"
            >
              详情
            </el-button>
            <el-dropdown
              v-else
              trigger="click"
              @command="command => handleMediaActionCommand(row, command)"
            >
              <el-button type="primary" size="small">
                媒体操作
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="detail">
                    <el-icon><View /></el-icon>
                    <span>详情</span>
                  </el-dropdown-item>
                  <el-dropdown-item command="edit">
                    <el-icon><EditPen /></el-icon>
                    <span>编辑</span>
                  </el-dropdown-item>
                  <el-dropdown-item command="aiTranslate">
                    <el-icon><MagicStick /></el-icon>
                    <span>AI 翻译</span>
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="!isPureLocalMedia(row)"
                    command="restoreSnapshot"
                  >
                    <el-icon><Refresh /></el-icon>
                    <span>同步快照</span>
                  </el-dropdown-item>
                  <el-dropdown-item command="replace">
                    <el-icon><Upload /></el-icon>
                    <span>替换</span>
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="row.mediaMode === 'local' && !isPureLocalMedia(row)"
                    command="convertRemote"
                  >
                    <el-icon><Refresh /></el-icon>
                    <span>转远程</span>
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="isPureLocalMedia(row)"
                    command="deleteLocal"
                  >
                    <el-icon><Delete /></el-icon>
                    <span>删除</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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
      v-model="detailDialogVisible"
      title="媒体详情"
      width="760px"
      align-center
    >
      <div v-if="currentRow" class="media-detail-preview">
        <button
          v-if="isImageMedia(currentRow) && getImagePreviewUrl(currentRow)"
          type="button"
          class="media-detail-preview-trigger"
          title="打开预览"
          @click="openMediaPreview(currentRow)"
        >
          <el-image
            :src="getImagePreviewUrl(currentRow)"
            fit="contain"
            class="media-detail-image"
          />
          <div v-if="currentRow.is360Panorama" class="media-preview-360">
            360°
          </div>
        </button>
        <button
          v-else-if="isVideoMedia(currentRow) && getVideoPreviewUrl(currentRow)"
          type="button"
          class="media-detail-preview-trigger media-detail-video-cover"
          title="播放视频"
          @click="openMediaPreview(currentRow)"
        >
          <el-image
            v-if="getVideoCoverUrl(currentRow)"
            :src="getVideoCoverUrl(currentRow)"
            fit="cover"
            class="media-detail-image"
          />
          <div v-else class="media-detail-cover-empty">无封面</div>
          <div class="media-preview-play">
            <el-icon><VideoPlay /></el-icon>
          </div>
        </button>
      </div>
      <el-descriptions v-if="currentRow" :column="2" border>
        <el-descriptions-item label="ID">{{
          currentRow._id
        }}</el-descriptions-item>
        <el-descriptions-item label="源 ID">{{
          currentRow.sourceId || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="文件名">{{
          currentRow.filename || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="语言">{{
          getLanguageText(currentRow.languageCode)
        }}</el-descriptions-item>
        <el-descriptions-item label="媒体模式">{{
          getMediaModeText(currentRow.mediaMode)
        }}</el-descriptions-item>
        <el-descriptions-item label="MIME">{{
          currentRow.mimetype || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="360 全景">{{
          currentRow.is360Panorama ? '是' : '否'
        }}</el-descriptions-item>
        <el-descriptions-item v-if="isImageMedia(currentRow)" label="HDR">{{
          currentRow.isHDR ? '是' : '否'
        }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{
          currentRow.description || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="文件路径" :span="2">{{
          currentRow.filepath || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="远程路径" :span="2">{{
          currentRow.remoteFilepath || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="本地路径" :span="2">{{
          currentRow.localFilepath || '-'
        }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog
      v-model="editDialogVisible"
      title="编辑媒体信息"
      width="560px"
      align-center
      :close-on-click-modal="false"
    >
      <el-form :model="editForm" label-width="90px" @submit.prevent>
        <el-form-item label="媒体名称">
          <el-input v-model="editForm.name" placeholder="请输入媒体名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="5"
            placeholder="请输入描述"
          />
        </el-form-item>
        <el-form-item
          v-if="currentRow && isImageMedia(currentRow)"
          label="360 全景"
        >
          <el-switch v-model="editForm.is360Panorama" />
        </el-form-item>
        <el-form-item label="AI翻译跳过">
          <el-switch v-model="editForm.aiTranslationSkip" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="success" @click="openTranslationDialog(currentRow)">
          AI 翻译
        </el-button>
        <el-button
          type="primary"
          :loading="editSubmitting"
          @click="updateMediaInfo"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <ContentAiTranslationDialog
      v-model="aiDialogVisible"
      title="AI 翻译媒体信息"
      :content-id="currentAiRecordId"
      content-type="media"
      :source-language-code="currentAiSourceLanguageCode"
      :target-language-code="currentAiTargetLanguageCode"
      :snapshot-version="currentAiSnapshotVersion"
      :load-source-entries="loadSourceAiEntries"
      :load-current-entries="loadCurrentAiEntries"
      @confirm="confirmAiTranslation"
    />

    <el-dialog
      v-model="replaceDialogVisible"
      title="替换为本地文件"
      width="760px"
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      @closed="resetReplaceForm"
      @paste="handleReplacePaste"
    >
      <template v-if="currentRow">
        <el-upload
          v-if="isImageMedia(currentRow)"
          class="attachments-upload"
          drag
          v-model:file-list="imageFileList"
          :accept="'image/*'"
          :show-file-list="true"
          :limit="1"
          :auto-upload="true"
          :http-request="replaceImageUploadRequest"
          :on-success="handleReplaceImageUploadSuccess"
          :on-error="handleReplaceImageUploadError"
          :on-remove="clearSelectedFile"
        >
          <el-icon class="el-icon--upload"><Picture /></el-icon>
          <div class="el-upload__text">拖动文件或点击上传</div>
          <div class="mt5">
            <MediaUploadOptions :options="replaceOptions" />
          </div>
        </el-upload>
        <VideoUploader
          v-else-if="isVideoMedia(currentRow)"
          :requireAlbumId="false"
          :uploadApi="replaceVideoLocal"
          :optionApi="getMediaSettingValues"
          successMessage="替换成功"
          @onVideoUploaded="handleReplaceSuccess"
        />
        <el-empty v-else description="当前媒体类型暂不支持替换" />
      </template>
      <template #footer>
        <el-button @click="replaceDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown,
  Delete,
  EditPen,
  MagicStick,
  Picture,
  Refresh,
  Setting,
  Upload,
  VideoPlay,
  View
} from '@element-plus/icons-vue'
import { multilingualApi } from '@/api'
import CheckDialogService from '@/services/CheckDialogService'
import ContentAiTranslationDialog from '@/components/ContentAiTranslationDialog.vue'
import VideoUploader from '@/components/VideoUploader.vue'
import MediaUploadOptions from '@/components/MediaUploadOptions.vue'
import { loadAndOpenImg } from '@/utils/utils'
import {
  createMediaUploadOptions,
  resetMediaUploadOptions,
  buildMediaUploadOptionHeaders
} from '@/utils/mediaUploadOptions'
import { requestScreenWakeLock, releaseScreenWakeLock } from '@/utils/wakeLock'
import {
  restoreListSessionParams,
  saveListSessionParams
} from '@/composables/useListSessionParams'
import {
  MEDIA_MODE_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText
} from '@/utils/multilingual'
import {
  buildRecordTranslationEntries,
  buildSourceToTargetTranslationEntries
} from '@/utils/translationJson'

export default {
  components: {
    ArrowDown,
    ContentAiTranslationDialog,
    Delete,
    EditPen,
    MagicStick,
    MediaUploadOptions,
    Picture,
    Refresh,
    Setting,
    Upload,
    VideoPlay,
    VideoUploader,
    View
  },
  setup() {
    const route = useRoute()
    const tableRef = ref(null)
    const mediaList = ref([])
    const total = ref(0)
    const loading = ref(false)
    const currentRow = ref(null)
    const detailDialogVisible = ref(false)
    const editDialogVisible = ref(false)
    const aiDialogVisible = ref(false)
    const replaceDialogVisible = ref(false)
    const imageFileList = ref([])
    const replaceSubmitting = ref(false)
    const editSubmitting = ref(false)
    const aiSkipLoadingMap = reactive({})
    const editForm = reactive({
      name: '',
      description: '',
      is360Panorama: false,
      aiTranslationSkip: false
    })

    const currentAiRecordId = computed(() => currentRow.value?._id || '')
    const currentAiSourceLanguageCode = computed(() => {
      return currentRow.value?.sourceLanguageCode || ''
    })
    const currentAiTargetLanguageCode = computed(() => {
      return currentRow.value?.languageCode || ''
    })
    const currentAiSnapshotVersion = computed(() => {
      return Number(currentRow.value?.snapshotVersion || 1)
    })
    const replaceOptions = reactive(createMediaUploadOptions())

    const getDefaultParams = scope => {
      const defaultParams = {
        page: 1,
        limit: 20,
        keyword: '',
        languageCode: '',
        mediaMode: ''
      }

      if (scope === 'source') {
        defaultParams.languageCode = 'zh-CN'
      }

      restoreListSessionParams(route, defaultParams)
      return defaultParams
    }

    const params = reactive(getDefaultParams(route.meta.scope))

    const isSourceScope = computed(() => {
      return route.meta.scope === 'source'
    })

    const fixedSourceId = computed(() => {
      return String(route.params.sourceId || '')
    })

    const breadcrumbGroup = computed(() => {
      if (isSourceScope.value) {
        return '源数据管理'
      }
      return '多语言数据管理'
    })

    const pageTitle = computed(() => {
      if (isSourceScope.value) {
        return '源媒体快照'
      }
      if (fixedSourceId.value) {
        return '媒体语言版本'
      }
      return '媒体库'
    })

    const mediaModeOptions = computed(() => {
      return MEDIA_MODE_OPTIONS.map(item => {
        return {
          label: item.label,
          value: item.value
        }
      })
    })

    const getMediaModeText = value => {
      const item = MEDIA_MODE_OPTIONS.find(option => {
        return option.value === value
      })
      if (item) {
        return item.label
      }
      return value || '-'
    }

    const hasRemoteOrigin = row => {
      if (row?.remoteSourceId) {
        return true
      }
      if (row?.remoteFilepath) {
        return true
      }
      if (row?.remoteSnapshot && Object.keys(row.remoteSnapshot).length > 0) {
        return true
      }
      return false
    }

    const isPureLocalMedia = row => {
      if (!row || row.mediaMode !== 'local') {
        return false
      }
      return !hasRemoteOrigin(row)
    }

    const getSizeText = row => {
      if (!row.width || !row.height) {
        return '-'
      }
      return `${row.width} x ${row.height}`
    }

    const getFileSizeText = size => {
      const numberSize = Number(size || 0)
      if (!numberSize) {
        return '-'
      }
      if (numberSize < 1024 * 1024) {
        return `${(numberSize / 1024).toFixed(1)} KB`
      }
      return `${(numberSize / 1024 / 1024).toFixed(1)} MB`
    }

    const isAbsoluteMediaUrl = value => {
      if (!value) {
        return false
      }

      return /^(https?:)?\/\//.test(value) || value.startsWith('/')
    }

    const normalizeMediaUrl = value => {
      if (!value) {
        return ''
      }

      if (isAbsoluteMediaUrl(value)) {
        return value
      }

      return value
    }

    const isImageMedia = row => {
      return Boolean(row?.mimetype && row.mimetype.includes('image'))
    }

    const isVideoMedia = row => {
      return Boolean(row?.mimetype && row.mimetype.includes('video'))
    }

    const getImagePreviewUrl = row => {
      const previewCandidateList = [
        row?.localThumbnailPath,
        row?.localFilepath,
        row?.thumfor,
        row?.filepath,
        row?.remoteFilepath
      ]

      for (const item of previewCandidateList) {
        const previewUrl = normalizeMediaUrl(item)
        if (previewUrl) {
          return previewUrl
        }
      }

      return ''
    }

    const getImageOriginalUrl = row => {
      const previewCandidateList = [
        row?.localFilepath,
        row?.filepath,
        row?.remoteFilepath,
        row?.localThumbnailPath,
        row?.thumfor
      ]

      for (const item of previewCandidateList) {
        const previewUrl = normalizeMediaUrl(item)
        if (previewUrl) {
          return previewUrl
        }
      }

      return ''
    }

    const getVideoPreviewUrl = row => {
      const previewCandidateList = [
        row?.localFilepath,
        row?.filepath,
        row?.remoteFilepath
      ]

      for (const item of previewCandidateList) {
        const previewUrl = normalizeMediaUrl(item)
        if (previewUrl) {
          return previewUrl
        }
      }

      return ''
    }

    const getVideoCoverUrl = row => {
      const previewCandidateList = [row?.localThumbnailPath, row?.thumfor]

      for (const item of previewCandidateList) {
        const previewUrl = normalizeMediaUrl(item)
        if (previewUrl) {
          return previewUrl
        }
      }

      return ''
    }

    const getPositiveMediaSize = value => {
      const numberValue = Number(value)
      if (Number.isFinite(numberValue) && numberValue > 0) {
        return numberValue
      }
      return 0
    }

    const getMediaPreviewSize = row => {
      const width =
        getPositiveMediaSize(row?.width) || getPositiveMediaSize(row?.thumWidth)
      const height =
        getPositiveMediaSize(row?.height) ||
        getPositiveMediaSize(row?.thumHeight)

      if (width && height) {
        return { width, height }
      }

      if (isVideoMedia(row)) {
        return { width: 1280, height: 720 }
      }

      return { width: 1600, height: 900 }
    }

    const buildMediaPreviewItem = row => {
      let previewUrl = ''
      if (isImageMedia(row)) {
        previewUrl = getImageOriginalUrl(row)
      }
      if (isVideoMedia(row)) {
        previewUrl = getVideoPreviewUrl(row)
      }
      if (!previewUrl) {
        return null
      }

      const previewSize = getMediaPreviewSize(row)
      return {
        src: previewUrl,
        width: previewSize.width,
        height: previewSize.height,
        mimetype: row?.mimetype || '',
        is360Panorama: Boolean(row?.is360Panorama)
      }
    }

    const openMediaPreview = row => {
      const previewItem = buildMediaPreviewItem(row)
      if (!previewItem) {
        return
      }
      loadAndOpenImg(0, [previewItem])
    }

    const handleMediaActionCommand = (row, command) => {
      if (command === 'detail') {
        openDetail(row)
        return
      }
      if (command === 'edit') {
        openEdit(row)
        return
      }
      if (command === 'aiTranslate') {
        openTranslationDialog(row)
        return
      }
      if (command === 'restoreSnapshot') {
        restoreSnapshot(row)
        return
      }
      if (command === 'replace') {
        openReplace(row)
        return
      }
      if (command === 'convertRemote') {
        openConvert(row)
        return
      }
      if (command === 'deleteLocal') {
        deleteLocalMedia(row)
      }
    }

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit,
        recordKind: 'translation'
      }
      if (isSourceScope.value) {
        requestParams.recordKind = 'source'
      }
      if (params.languageCode) {
        requestParams.languageCode = params.languageCode
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.mediaMode) {
        requestParams.mediaMode = params.mediaMode
      }
      if (fixedSourceId.value) {
        requestParams.sourceId = fixedSourceId.value
      }
      return requestParams
    }

    const getMediaList = resetPage => {
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }

      loading.value = true
      multilingualApi
        .getMediaList(getRequestParams())
        .then(response => {
          const responseData = response.data.data || {}
          mediaList.value = responseData.list || []
          total.value = responseData.total || 0
          saveListSessionParams(route, params)
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    const preserveTableScrollForNextRefresh = () => {
      tableRef.value?.preserveScrollOnNextDataRefresh()
    }

    const openDetail = row => {
      currentRow.value = row
      detailDialogVisible.value = true
    }

    const openEdit = row => {
      currentRow.value = row
      editForm.name = row.name || ''
      editForm.description = row.description || ''
      editForm.is360Panorama = Boolean(row.is360Panorama)
      editForm.aiTranslationSkip = Boolean(row.aiTranslationSkip)
      editDialogVisible.value = true
    }

    const updateMediaListRow = record => {
      const index = mediaList.value.findIndex(item => {
        return item._id === record._id
      })
      if (index >= 0) {
        mediaList.value[index] = record
      }
      if (currentRow.value && currentRow.value._id === record._id) {
        currentRow.value = record
      }
    }

    const getAiSkipActionKey = row => {
      if (!row || !row._id) {
        return ''
      }
      return `aiSkip:${row._id}`
    }

    const isAiSkipUpdating = row => {
      const actionKey = getAiSkipActionKey(row)
      if (!actionKey) {
        return false
      }
      return aiSkipLoadingMap[actionKey] === true
    }

    const toggleAiSkip = (row, value) => {
      if (!row) {
        return
      }
      if (isAiSkipUpdating(row)) {
        return
      }

      const actionKey = getAiSkipActionKey(row)
      if (!actionKey) {
        return
      }

      aiSkipLoadingMap[actionKey] = true
      multilingualApi
        .updateTranslationAiSkip(
          {
            contentType: 'relation',
            collectionName: 'attachments',
            id: row._id,
            languageCode: row.languageCode,
            aiTranslationSkip: value === true
          },
          true
        )
        .then(response => {
          const data = response.data.data || {}
          updateMediaListRow({
            ...row,
            ...data,
            aiTranslationSkip: data.aiTranslationSkip === true
          })
          ElMessage.success('AI 翻译跳过状态已更新')
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          aiSkipLoadingMap[actionKey] = false
        })
    }

    const updateMediaInfo = () => {
      if (!currentRow.value) {
        return
      }
      const payload = {
        name: editForm.name || '',
        description: editForm.description || '',
        aiTranslationSkip: editForm.aiTranslationSkip === true
      }
      if (isImageMedia(currentRow.value)) {
        payload.is360Panorama = editForm.is360Panorama
      }

      editSubmitting.value = true
      multilingualApi
        .updateTranslationRelation({
          collectionName: 'attachments',
          id: currentRow.value._id,
          languageCode: currentRow.value.languageCode,
          payload
        })
        .then(response => {
          updateMediaListRow(response.data.data)
          ElMessage.success('保存成功')
          editDialogVisible.value = false
          preserveTableScrollForNextRefresh()
          getMediaList(false)
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          editSubmitting.value = false
        })
    }

    const buildAiEntries = record => {
      return buildRecordTranslationEntries({
        record,
        collectionName: 'attachments',
        groupLabel: '媒体信息',
        includeEmpty: true
      })
    }

    const mapSourceEntriesToCurrent = (sourceEntries, currentEntries) => {
      return buildSourceToTargetTranslationEntries({
        sourceEntries,
        targetEntries: currentEntries
      }).entries
    }

    const loadCurrentAiEntries = async () => {
      return {
        entries: currentRow.value ? buildAiEntries(currentRow.value) : []
      }
    }

    const loadSourceAiEntries = async (currentEntries, sourceLanguageCode) => {
      if (!currentRow.value?.sourceId || !sourceLanguageCode) {
        return { entries: [] }
      }
      const response = await multilingualApi.getMediaList(
        {
          recordKind: 'source',
          sourceId: currentRow.value.sourceId,
          languageCode: sourceLanguageCode,
          page: 1,
          limit: 1
        },
        true
      )
      const list = response.data.data?.list || []
      const sourceRecord = list.find(item => {
        return String(item.sourceId) === String(currentRow.value.sourceId)
      })
      if (!sourceRecord) {
        return { entries: [] }
      }
      return {
        entries: mapSourceEntriesToCurrent(
          buildAiEntries(sourceRecord),
          currentEntries
        )
      }
    }

    const openTranslationDialog = row => {
      if (!row) {
        return
      }
      currentRow.value = row
      aiDialogVisible.value = true
    }

    const confirmAiTranslation = async (payload, done, applyPlan = {}) => {
      if (!currentRow.value) {
        done?.()
        return
      }
      const relationUpdates = applyPlan.relationUpdates || []
      try {
        await Promise.all(
          relationUpdates.map(updateItem => {
            return multilingualApi.updateTranslationRelation({
              collectionName: updateItem.collectionName,
              id: updateItem.id,
              languageCode: currentRow.value.languageCode,
              payload: {
                ...updateItem.payload,
                aiTranslationSkip: true
              }
            })
          })
        )

        if (Object.keys(payload).length > 0) {
          const response = await multilingualApi.updateTranslationRelation({
            collectionName: 'attachments',
            id: currentRow.value._id,
            languageCode: currentRow.value.languageCode,
            payload: {
              ...payload,
              aiTranslationSkip: true
            }
          })
          updateMediaListRow(response.data.data)
          Object.assign(editForm, payload)
        }
        preserveTableScrollForNextRefresh()
        getMediaList(false)
        aiDialogVisible.value = false
        ElMessage.success('AI 翻译已写入')
      } catch (error) {
        console.log(error)
      } finally {
        done?.()
      }
    }

    const restoreSnapshot = row => {
      if (!row) {
        return
      }
      ElMessageBox.confirm(
        '确认将该媒体还原为当前源快照？本地替换文件不会在此操作中删除。',
        '同步快照',
        {
          type: 'warning',
          confirmButtonText: '同步快照',
          cancelButtonText: '取消'
        }
      )
        .then(() => {
          return multilingualApi.restoreMediaSnapshot({
            id: row._id,
            languageCode: row.languageCode
          })
        })
        .then(response => {
          updateMediaListRow(response.data.data)
          preserveTableScrollForNextRefresh()
          getMediaList(false)
          ElMessage.success('已同步为最新快照')
        })
        .catch(error => {
          if (error !== 'cancel' && error !== 'close') {
            console.log(error)
          }
        })
    }

    const openReplace = row => {
      currentRow.value = row
      resetReplaceForm()
      replaceDialogVisible.value = true
    }

    const openConvert = row => {
      currentRow.value = row
      CheckDialogService.open({
        correctAnswer: 'DELETE_LOCAL_FILE',
        content:
          '转回远程快照会<span class="cRed">删除本地文件</span>，是否继续？',
        success: convertRemote
      }).catch(() => {})
    }

    const generateRandomString = length => {
      const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
      let result = ''
      for (let index = 0; index < length; index++) {
        result += characters.charAt(
          Math.floor(Math.random() * characters.length)
        )
      }
      return result
    }

    const handleReplacePaste = event => {
      if (!currentRow.value || !isImageMedia(currentRow.value)) {
        return
      }
      const clipboardData =
        event.clipboardData || event.originalEvent?.clipboardData
      if (!clipboardData || !clipboardData.items) {
        return
      }
      const items = clipboardData.items
      for (let index in items) {
        const item = items[index]
        if (item.kind !== 'file') {
          continue
        }
        const blob = item.getAsFile()
        if (!blob.type.startsWith('image/')) {
          continue
        }
        const file = new File([blob], `image-${generateRandomString(8)}.png`, {
          type: blob.type
        })
        event.preventDefault()
        replaceImageFile(file).catch(handleReplaceImageUploadError)
        return
      }
    }

    const clearSelectedFile = () => {
      imageFileList.value = []
    }

    const resetReplaceForm = () => {
      imageFileList.value = []
      resetMediaUploadOptions(replaceOptions)
    }

    const appendBaseReplaceFormData = formData => {
      formData.append('id', currentRow.value._id)
      formData.append('languageCode', currentRow.value.languageCode)
    }

    const handleReplaceSuccess = () => {
      replaceDialogVisible.value = false
      resetReplaceForm()
      preserveTableScrollForNextRefresh()
      getMediaList(false)
    }

    const replaceImageFile = file => {
      if (!currentRow.value) {
        return Promise.reject(new Error('媒体不存在'))
      }
      if (!isImageMedia(currentRow.value)) {
        const error = new Error('图片媒体只能替换为图片文件')
        ElMessage.error(error.message)
        return Promise.reject(error)
      }
      if (!file) {
        const error = new Error('请选择文件')
        ElMessage.error(error.message)
        return Promise.reject(error)
      }
      if (!file.type || !file.type.includes('image')) {
        const error = new Error('图片媒体只能替换为图片文件')
        ElMessage.error(error.message)
        return Promise.reject(error)
      }

      const formData = new FormData()
      appendBaseReplaceFormData(formData)
      formData.append('file', file, file.name)

      replaceSubmitting.value = true
      // 图片替换上传期间保持屏幕常亮
      requestScreenWakeLock()
      return multilingualApi
        .replaceLocalMedia(
          formData,
          buildMediaUploadOptionHeaders(replaceOptions)
        )
        .then(() => {
          ElMessage.success('替换成功')
          handleReplaceSuccess()
        })
        .finally(() => {
          replaceSubmitting.value = false
          releaseScreenWakeLock()
        })
    }

    const replaceImageUploadRequest = uploadRequest => {
      return replaceImageFile(uploadRequest.file)
    }

    const handleReplaceImageUploadSuccess = () => {
      imageFileList.value = []
    }

    const handleReplaceImageUploadError = error => {
      console.log(error)
      imageFileList.value = []
    }

    const replaceVideoLocal = formData => {
      if (!currentRow.value) {
        return Promise.reject(new Error('媒体不存在'))
      }
      if (!isVideoMedia(currentRow.value)) {
        ElMessage.error('视频媒体只能替换为视频文件')
        return Promise.reject(new Error('视频媒体只能替换为视频文件'))
      }

      appendBaseReplaceFormData(formData)
      return multilingualApi.replaceLocalMedia(formData)
    }

    const getMediaSettingValues = () => {
      return multilingualApi.getMediaSettings({}, true)
    }

    const convertRemote = () => {
      if (!currentRow.value) {
        return Promise.resolve()
      }

      return multilingualApi
        .convertRemoteMedia({
          id: currentRow.value._id,
          languageCode: currentRow.value.languageCode,
          confirmText: 'DELETE_LOCAL_FILE'
        })
        .then(() => {
          ElMessage.success('已转回远程快照')
          preserveTableScrollForNextRefresh()
          getMediaList(false)
        })
        .catch(error => {
          console.log(error)
          throw error
        })
    }

    const deleteLocalMedia = row => {
      if (!isPureLocalMedia(row)) {
        ElMessage.error('只有纯本地媒体可以直接删除')
        return
      }
      currentRow.value = row
      CheckDialogService.open({
        correctAnswer: 'DELETE',
        content:
          '确认删除这个<span class="cRed">纯本地媒体文件</span>吗？文件会从服务器移除。',
        success: () => {
          return multilingualApi
            .deleteLocalMedia({
              id: row._id,
              languageCode: row.languageCode
            })
            .then(() => {
              ElMessage.success('删除成功')
              getMediaList(false)
            })
        }
      }).catch(() => {})
    }

    watch(
      () => params.page,
      () => {
        getMediaList(false)
      }
    )

    watch(
      () => route.meta.scope,
      scope => {
        Object.assign(params, getDefaultParams(scope))
        getMediaList(false)
      }
    )

    watch(
      () => route.params.sourceId,
      () => {
        params.page = 1
        getMediaList(false)
      }
    )

    onMounted(() => {
      getMediaList(false)
    })

    return {
      tableRef,
      params,
      mediaList,
      total,
      loading,
      fixedSourceId,
      currentRow,
      aiDialogVisible,
      detailDialogVisible,
      editDialogVisible,
      replaceDialogVisible,
      imageFileList,
      replaceSubmitting,
      editSubmitting,
      editForm,
      currentAiRecordId,
      isAiSkipUpdating,
      currentAiSnapshotVersion,
      currentAiSourceLanguageCode,
      currentAiTargetLanguageCode,
      replaceOptions,
      isSourceScope,
      breadcrumbGroup,
      pageTitle,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      mediaModeOptions,
      getLanguageText,
      getMediaModeText,
      isPureLocalMedia,
      getSizeText,
      getFileSizeText,
      isImageMedia,
      isVideoMedia,
      getImagePreviewUrl,
      getVideoPreviewUrl,
      getVideoCoverUrl,
      openMediaPreview,
      handleMediaActionCommand,
      getMediaList,
      openDetail,
      toggleAiSkip,
      openEdit,
      openTranslationDialog,
      confirmAiTranslation,
      loadCurrentAiEntries,
      loadSourceAiEntries,
      restoreSnapshot,
      updateMediaInfo,
      openReplace,
      openConvert,
      replaceImageUploadRequest,
      handleReplaceImageUploadSuccess,
      handleReplaceImageUploadError,
      handleReplacePaste,
      clearSelectedFile,
      resetReplaceForm,
      replaceVideoLocal,
      getMediaSettingValues,
      handleReplaceSuccess,
      convertRemote,
      deleteLocalMedia
    }
  }
}
</script>

<style scoped>
.multilingual-media-page {
  min-width: 0;
}

.media-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.media-title {
  font-weight: 600;
  word-break: break-word;
}

.media-preview-cell {
  width: 120px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.media-preview-trigger {
  position: relative;
  width: 100%;
  height: 100%;
  display: block;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  color: inherit;
  cursor: pointer;
  background: transparent;
}

.media-preview-trigger:focus-visible,
.media-detail-preview-trigger:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.media-preview-image {
  width: 100%;
  height: 100%;
  display: block;
}

.media-preview-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-preview-cover-empty,
.media-detail-cover-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  background: var(--el-fill-color);
}

.media-preview-play,
.media-preview-360 {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.88);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}

.media-preview-play {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-size: 28px;
  background: rgba(0, 0, 0, 0.42);
}

.media-preview-360 {
  min-width: 48px;
  height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.46);
}

.media-preview-empty {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.media-subtitle,
.media-path {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  word-break: break-all;
}

.media-detail-preview {
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
}

.media-detail-preview-trigger {
  position: relative;
  width: 100%;
  max-width: 520px;
  height: 320px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  color: inherit;
  cursor: pointer;
  background: var(--el-fill-color-light);
}

.media-detail-image {
  width: 100%;
  height: 100%;
  display: block;
  background: var(--el-fill-color-light);
}

.media-detail-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.media-detail-video-cover .media-detail-image :deep(img) {
  object-fit: cover;
}

@media (max-width: 767px) {
  .media-search-form :deep(.el-form-item) {
    margin-right: 0;
    width: 100%;
  }

  .media-search-form :deep(.el-input),
  .media-search-form :deep(.el-select) {
    width: 100% !important;
  }

  .media-actions {
    float: none;
    margin-top: 10px;
  }

  .media-detail-preview-trigger {
    height: 220px;
  }
}
</style>
