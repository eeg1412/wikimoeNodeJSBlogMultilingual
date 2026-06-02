<template>
  <div class="common-right-panel-form multilingual-media-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>多语言数据管理</el-breadcrumb-item>
        <el-breadcrumb-item>媒体库</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="media-search-form"
          @submit.prevent
          @keypress.enter="getMediaSourceList(true)"
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
              v-model="params.sourceLanguageCode"
              clearable
              placeholder="源语言"
              style="width: 150px"
              @change="getMediaSourceList(true)"
              @clear="getMediaSourceList(true)"
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
              v-model="params.languageCode"
              clearable
              placeholder="翻译语言"
              style="width: 150px"
              @change="getMediaSourceList(true)"
              @clear="getMediaSourceList(true)"
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
              @change="getMediaSourceList(true)"
              @clear="getMediaSourceList(true)"
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
            <el-button type="primary" @click="getMediaSourceList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr media-actions">
        <el-button :loading="loading" @click="getMediaSourceList(false)">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="mb20 list-table-body" v-loading="loading">
      <ResponsiveTable
        ref="tableRef"
        :data="sourceGroupList"
        :row-key="getSourceGroupRowKey"
        height="100%"
        border
      >
        <ResponsiveTableColumn label="预览" width="150">
          <template #default="{ row }">
            <div class="media-preview-cell">
              <button
                v-if="
                  isImageMedia(row.sourceRecord) &&
                  getImagePreviewUrl(row.sourceRecord)
                "
                class="media-preview-image"
                type="button"
                title="打开预览"
                @click="openMediaPreview(row.sourceRecord)"
              >
                <el-image
                  :src="getImagePreviewUrl(row.sourceRecord)"
                  fit="cover"
                  loading="lazy"
                  class="media-preview-image-inner"
                />
              </button>
              <button
                v-else-if="
                  isVideoMedia(row.sourceRecord) &&
                  getVideoPreviewUrl(row.sourceRecord)
                "
                class="media-preview-trigger"
                type="button"
                title="播放视频"
                @click="openMediaPreview(row.sourceRecord)"
              >
                <el-image
                  v-if="getVideoCoverUrl(row.sourceRecord)"
                  :src="getVideoCoverUrl(row.sourceRecord)"
                  fit="cover"
                  loading="lazy"
                  class="media-preview-image"
                />
                <div v-else class="media-preview-cover-empty">无封面</div>
                <div class="media-preview-play">
                  <el-icon><VideoPlay /></el-icon>
                </div>
              </button>
              <div v-else class="media-preview-cover-empty">无预览</div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源媒体" min-width="260">
          <template #default="{ row }">
            <div class="media-title">
              {{ getMediaDisplayName(row.sourceRecord) }}
            </div>
            <div class="source-meta">
              源 ID：{{ row.sourceRecord.sourceId }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="媒体模式" width="120">
          <template #default="{ row }">
            {{ getMediaModeText(row.sourceRecord.mediaMode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源语言" width="150">
          <template #default="{ row }">
            {{ getLanguageText(getSourceLanguageCode(row.sourceRecord)) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="语言版本" min-width="280">
          <template #default="{ row }">
            <div class="language-version-tags">
              <el-tag
                v-for="item in getTranslationRows(row)"
                :key="item.languageCode"
                size="small"
                effect="plain"
                :type="getTranslationTagType(item.translation)"
              >
                {{ item.languageCode }}
              </el-tag>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="更新时间" width="180">
          <template #default="{ row }">
            {{
              $formatDate(
                row.sourceRecord.updatedAt || row.sourceRecord.createdAt
              )
            }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="goLanguageList(row)">
              语言版本
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
        @current-change="getMediaSourceList(false)"
      />
    </div>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Refresh, VideoPlay } from '@element-plus/icons-vue'
import { multilingualApi } from '@/api'
import { loadAndOpenImg } from '@/utils/utils'
import {
  restoreListSessionParams,
  saveListSessionParams
} from '@/composables/useListSessionParams'
import { useResponsiveTableScrollSession } from '@/composables/useResponsiveTableScrollSession'
import {
  MEDIA_MODE_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText
} from '@/utils/multilingual'

export default {
  name: 'MultilingualMediaSourceList',
  components: {
    Refresh,
    VideoPlay
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const tableRef = ref(null)
    const { restoreTableScrollOnNextDataRefresh } =
      useResponsiveTableScrollSession(route, tableRef)
    const sourceGroupList = ref([])
    const total = ref(0)
    const loading = ref(false)
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: '',
      sourceLanguageCode: '',
      languageCode: '',
      mediaMode: ''
    })
    restoreListSessionParams(route, params)

    const mediaModeOptions = computed(() => {
      return MEDIA_MODE_OPTIONS.map(item => {
        return {
          label: item.label,
          value: item.value
        }
      })
    })

    const languageOptions = computed(() => {
      return SUPPORTED_LANGUAGE_OPTIONS.map(item => {
        return {
          label: item.label,
          value: item.value
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
      if (params.mediaMode) {
        requestParams.mediaMode = params.mediaMode
      }
      if (params.sourceLanguageCode) {
        requestParams.sourceLanguageCode = params.sourceLanguageCode
      }
      if (params.languageCode) {
        requestParams.languageCode = params.languageCode
      }
      return requestParams
    }

    const getMediaSourceList = resetPage => {
      if (resetPage === true) {
        params.page = 1
      }
      loading.value = true
      multilingualApi
        .getMediaListBySource(getRequestParams(), true)
        .then(response => {
          const responseData = response.data.data || {}
          sourceGroupList.value = responseData.list || []
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

    const getSourceGroupRowKey = row => {
      return row.sourceRecord?.sourceId || row.sourceRecord?._id || ''
    }

    const getSourceLanguageCode = row => {
      return row?.sourceLanguageCode || row?.languageCode || ''
    }

    const getMediaDisplayName = row => {
      return (
        row?.name || row?.filename || row?.filepath || String(row?._id || '')
      )
    }

    const getMediaModeText = value => {
      const item = MEDIA_MODE_OPTIONS.find(option => {
        return option.value === value
      })
      if (item) {
        return item.label
      }
      return value || '-'
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

    const getTranslationRows = row => {
      const translations = row.translations || {}
      const sourceLanguageCode = getSourceLanguageCode(row.sourceRecord)
      return SUPPORTED_LANGUAGE_OPTIONS.filter(item => {
        return item.value !== sourceLanguageCode
      }).map(item => {
        return {
          languageCode: item.value,
          translation: translations[item.value]
        }
      })
    }

    const getTranslationTagType = translation => {
      if (!translation) {
        return 'info'
      }
      if (translation.pendingReview) {
        return 'warning'
      }
      return 'success'
    }

    const goLanguageList = row => {
      const sourceId = row.sourceRecord?.sourceId
      if (!sourceId) {
        return
      }
      router.push({
        name: 'MultilingualMediaLanguageList',
        params: { sourceId: String(sourceId) }
      })
    }

    onMounted(() => {
      restoreTableScrollOnNextDataRefresh()
      getMediaSourceList(false)
    })

    return {
      sourceGroupList,
      tableRef,
      total,
      loading,
      params,
      mediaModeOptions,
      languageOptions,
      getMediaSourceList,
      getSourceGroupRowKey,
      getSourceLanguageCode,
      getMediaDisplayName,
      getMediaModeText,
      getLanguageText,
      isImageMedia,
      isVideoMedia,
      getImagePreviewUrl,
      getVideoPreviewUrl,
      getVideoCoverUrl,
      openMediaPreview,
      getTranslationRows,
      getTranslationTagType,
      goLanguageList
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

.source-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.media-preview-cell {
  display: flex;
  align-items: center;
}

.media-preview-trigger {
  position: relative;
  width: 112px;
  height: 64px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.media-preview-image,
.media-preview-cover-empty {
  width: 112px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.media-preview-image-inner {
  width: 100%;
  height: 100%;
}

.media-preview-cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
}

.media-preview-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}

.language-version-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media screen and (max-width: 768px) {
  .media-preview-image,
  .media-preview-cover-empty,
  .media-preview-trigger {
    width: 96px;
    height: 56px;
  }
}
</style>
