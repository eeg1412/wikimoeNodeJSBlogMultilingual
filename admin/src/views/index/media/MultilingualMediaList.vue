<template>
  <div class="common-right-panel-form multilingual-media-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>{{ breadcrumbGroup }}</el-breadcrumb-item>
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

    <div class="mb20 list-table-body">
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
              <el-image
                v-if="isImageMedia(row) && getImagePreviewUrl(row)"
                :src="getImagePreviewUrl(row)"
                :preview-src-list="[getImagePreviewUrl(row)]"
                fit="cover"
                loading="lazy"
                preview-teleported
                class="media-preview-image"
              />
              <video
                v-else-if="isVideoMedia(row) && getVideoPreviewUrl(row)"
                :src="getVideoPreviewUrl(row)"
                :poster="getVideoPoster(row) || undefined"
                class="media-preview-video"
                controls
                preload="metadata"
                playsinline
              ></video>
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
        <ResponsiveTableColumn label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDetail(row)">详情</el-button>
            <el-button
              v-if="!isSourceScope"
              type="primary"
              size="small"
              @click="openReplace(row)"
            >
              替换
            </el-button>
            <el-button
              v-if="!isSourceScope && row.mediaMode === 'local'"
              type="warning"
              size="small"
              @click="openConvert(row)"
            >
              转远程
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

    <el-dialog v-model="detailDialogVisible" title="媒体详情" width="760px">
      <div v-if="currentRow" class="media-detail-preview">
        <el-image
          v-if="isImageMedia(currentRow) && getImagePreviewUrl(currentRow)"
          :src="getImagePreviewUrl(currentRow)"
          :preview-src-list="[getImagePreviewUrl(currentRow)]"
          fit="contain"
          preview-teleported
          class="media-detail-image"
        />
        <video
          v-else-if="isVideoMedia(currentRow) && getVideoPreviewUrl(currentRow)"
          :src="getVideoPreviewUrl(currentRow)"
          :poster="getVideoPoster(currentRow) || undefined"
          class="media-detail-video"
          controls
          preload="metadata"
          playsinline
        ></video>
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
      v-model="replaceDialogVisible"
      title="替换为本地文件"
      width="560px"
    >
      <el-upload
        :show-file-list="true"
        :limit="1"
        :auto-upload="false"
        :on-change="handleFileChange"
        :on-remove="clearSelectedFile"
      >
        <el-button type="primary">选择文件</el-button>
      </el-upload>
      <template #footer>
        <el-button @click="replaceDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="replaceSubmitting"
          @click="replaceLocal"
        >
          替换
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="convertDialogVisible"
      title="转回远程快照"
      width="560px"
    >
      <el-alert
        class="mb20"
        type="warning"
        :closable="false"
        show-icon
        title="转回远程会删除本地文件。请输入 DELETE_LOCAL_FILE 确认。"
      />
      <el-input
        v-model="confirmText"
        placeholder="DELETE_LOCAL_FILE"
        clearable
      />
      <template #footer>
        <el-button @click="convertDialogVisible = false">取消</el-button>
        <el-button
          type="warning"
          :loading="convertSubmitting"
          @click="convertRemote"
        >
          转远程
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { multilingualApi } from '@/api'
import {
  MEDIA_MODE_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText
} from '@/utils/multilingual'

export default {
  setup() {
    const route = useRoute()
    const tableRef = ref(null)
    const mediaList = ref([])
    const total = ref(0)
    const currentRow = ref(null)
    const detailDialogVisible = ref(false)
    const replaceDialogVisible = ref(false)
    const convertDialogVisible = ref(false)
    const selectedFile = ref(null)
    const replaceSubmitting = ref(false)
    const convertSubmitting = ref(false)
    const confirmText = ref('')

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

      return defaultParams
    }

    const params = reactive(getDefaultParams(route.meta.scope))

    const isSourceScope = computed(() => {
      return route.meta.scope === 'source'
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

    const getVideoPoster = row => {
      return normalizeMediaUrl(
        row?.localThumbnailPath || row?.thumfor || row?.localFilepath || ''
      )
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
      return requestParams
    }

    const getMediaList = resetPage => {
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }

      multilingualApi
        .getMediaList(getRequestParams())
        .then(response => {
          const responseData = response.data.data || {}
          mediaList.value = responseData.list || []
          total.value = responseData.total || 0
          tableRef.value?.scrollTo({ top: 0 })
        })
        .catch(error => {
          console.log(error)
        })
    }

    const openDetail = row => {
      currentRow.value = row
      detailDialogVisible.value = true
    }

    const openReplace = row => {
      currentRow.value = row
      selectedFile.value = null
      replaceDialogVisible.value = true
    }

    const openConvert = row => {
      currentRow.value = row
      confirmText.value = ''
      convertDialogVisible.value = true
    }

    const handleFileChange = file => {
      selectedFile.value = file
    }

    const clearSelectedFile = () => {
      selectedFile.value = null
    }

    const replaceLocal = () => {
      if (!currentRow.value) {
        return
      }
      if (!selectedFile.value?.raw) {
        ElMessage.error('请选择文件')
        return
      }

      const formData = new FormData()
      formData.append('id', currentRow.value._id)
      formData.append('languageCode', currentRow.value.languageCode)
      formData.append('file', selectedFile.value.raw)

      replaceSubmitting.value = true
      multilingualApi
        .replaceLocalMedia(formData)
        .then(() => {
          ElMessage.success('替换成功')
          replaceDialogVisible.value = false
          selectedFile.value = null
          getMediaList(false)
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          replaceSubmitting.value = false
        })
    }

    const convertRemote = () => {
      if (!currentRow.value) {
        return
      }

      convertSubmitting.value = true
      multilingualApi
        .convertRemoteMedia({
          id: currentRow.value._id,
          languageCode: currentRow.value.languageCode,
          confirmText: confirmText.value
        })
        .then(() => {
          ElMessage.success('已转回远程快照')
          convertDialogVisible.value = false
          confirmText.value = ''
          getMediaList(false)
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          convertSubmitting.value = false
        })
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

    onMounted(() => {
      getMediaList(false)
    })

    return {
      tableRef,
      params,
      mediaList,
      total,
      currentRow,
      detailDialogVisible,
      replaceDialogVisible,
      convertDialogVisible,
      replaceSubmitting,
      convertSubmitting,
      confirmText,
      isSourceScope,
      breadcrumbGroup,
      pageTitle,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      mediaModeOptions,
      getLanguageText,
      getMediaModeText,
      getSizeText,
      getFileSizeText,
      isImageMedia,
      isVideoMedia,
      getImagePreviewUrl,
      getVideoPreviewUrl,
      getVideoPoster,
      getMediaList,
      openDetail,
      openReplace,
      openConvert,
      handleFileChange,
      clearSelectedFile,
      replaceLocal,
      convertRemote
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

.media-preview-image,
.media-preview-video {
  width: 100%;
  height: 100%;
  display: block;
}

.media-preview-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-preview-video {
  object-fit: cover;
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

.media-detail-image,
.media-detail-video {
  width: 100%;
  max-width: 520px;
  max-height: 320px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.media-detail-image :deep(img) {
  object-fit: contain;
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
}
</style>
