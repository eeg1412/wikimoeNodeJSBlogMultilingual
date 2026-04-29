<template>
  <el-dialog
    v-model="visible"
    title="插入媒体库"
    width="min(1080px, 96vw)"
    align-center
    destroy-on-close
    append-to-body
    :close-on-click-modal="false"
    class="multilingual-rich-media-dialog"
    @closed="onDialogClosed"
    @paste="handlePaste"
  >
    <div class="rich-media-filter-row">
      <el-tag effect="plain">{{ languageLabel }}</el-tag>
      <el-input
        v-model="params.keyword"
        placeholder="文件名、描述、路径、媒体 ID"
        clearable
        class="rich-media-keyword"
        @keyup.enter="getMediaList(true)"
        @clear="getMediaList(true)"
      >
        <template #append>
          <el-button :icon="Search" @click="getMediaList(true)" />
        </template>
      </el-input>
      <el-select
        v-model="params.mediaMode"
        clearable
        placeholder="全部媒体"
        class="rich-media-mode"
        @change="getMediaList(true)"
        @clear="getMediaList(true)"
      >
        <el-option label="远程媒体" value="remote" />
        <el-option label="本地文件" value="local" />
      </el-select>
      <el-button :icon="Refresh" @click="getMediaList(false)" />
    </div>

    <div v-show="selectedMediaList.length > 0" class="rich-media-select-bar">
      <div class="rich-media-select-content">
        <div>
          已选中<span class="fb">{{ selectedMediaList.length }}</span
          >件媒体文件
        </div>
        <div class="rich-media-select-actions">
          <el-button
            v-if="shouldSelectOk && selectedMediaList.length > 1"
            type="info"
            size="small"
            circle
            :icon="Sort"
            title="调整顺序"
            @click="changeOrderDialogVisible = true"
          />
          <el-button
            v-if="shouldShowSelectPage"
            type="info"
            size="small"
            circle
            :icon="CircleCheck"
            title="本页全选"
            @click="selectPageMedia"
          />
          <el-button
            type="info"
            size="small"
            circle
            :icon="Remove"
            title="取消本页选择"
            @click="clearSelectedPageMedia"
          />
          <el-button
            v-if="shouldSelectOk"
            type="primary"
            size="small"
            circle
            :icon="Select"
            title="确定选择"
            @click="selectMediaOk"
          />
          <el-button
            size="small"
            circle
            :icon="Close"
            title="取消选择"
            @click="clearSelectedMediaList"
          />
        </div>
      </div>
    </div>

    <div v-show="selectedMediaList.length <= 0" class="rich-media-upload-panel">
      <div
        class="rich-media-upload-actions"
        :class="{ 'is-single-uploader': canUploadImage !== canUploadVideo }"
      >
        <el-upload
          v-if="canUploadImage"
          class="rich-media-image-upload"
          drag
          multiple
          :show-file-list="true"
          v-model:file-list="fileList"
          accept="image/*"
          :http-request="uploadImageFile"
          :on-success="handleUploadSuccess"
          :on-error="handleUploadError"
        >
          <el-icon class="el-icon--upload"><Picture /></el-icon>
          <div class="el-upload__text">拖动文件或点击上传</div>
          <div class="mt5">
            <el-popover placement="bottom" :width="200" trigger="click">
              <div>
                <el-checkbox
                  @click.stop
                  size="small"
                  v-model="uploadOptions.noCompress"
                  label="不压缩图片"
                />
                <el-checkbox
                  @click.stop
                  size="small"
                  v-model="uploadOptions.noThumbnail"
                  label="不生成缩略图"
                />
                <el-checkbox
                  @click.stop
                  size="small"
                  v-model="uploadOptions.is360Panorama"
                  label="是360°全景图片"
                />
                <div class="rich-media-option-field">
                  <div class="rich-media-option-label">最长边</div>
                  <el-input-number
                    v-model="uploadOptions.imgSettingCompressMaxSize"
                    :step="10"
                    :precision="0"
                    :min="1"
                    size="small"
                    controls-position="right"
                  />
                </div>
              </div>
              <template #reference>
                <el-button
                  size="small"
                  :type="uploadOptionsCount > 0 ? 'primary' : ''"
                  :plain="uploadOptionsCount <= 0"
                  @click.stop
                >
                  <el-icon><Setting /></el-icon>
                  <span class="pl3">
                    设置<template v-if="uploadOptionsCount > 0"
                      >（已设置 {{ uploadOptionsCount }} 项）</template
                    >
                  </span>
                </el-button>
              </template>
            </el-popover>
          </div>
        </el-upload>
        <VideoUploader
          v-if="canUploadVideo"
          :requireAlbumId="false"
          :uploadApi="uploadVideoLocal"
          :optionApi="getMediaSettingValues"
          successMessage="上传成功"
          @onVideoUploaded="handleVideoUploaded"
        />
      </div>
    </div>

    <div
      :class="{ 'rich-media-list': mediaList.length > 0 }"
      v-loading="loading"
    >
      <template v-if="mediaList.length > 0">
        <div
          v-for="item in mediaList"
          :key="item._id"
          class="rich-media-item"
          :class="{
            'is-selected': findMediaSelectedIndex(item._id) > -1,
            'is-disabled': !isSelectableMedia(item)
          }"
          @click="toggleMediaSelection(item)"
        >
          <button
            type="button"
            class="rich-media-preview"
            title="预览"
            @click.stop="openPreviewer(item)"
          >
            <el-image
              v-if="getPreviewUrl(item)"
              :src="getPreviewUrl(item)"
              fit="cover"
              loading="lazy"
              class="rich-media-preview-image"
            />
            <div v-else class="rich-media-preview-empty">无预览</div>
            <div v-if="isVideoMedia(item)" class="rich-media-play-icon">
              <el-icon><VideoPlay /></el-icon>
            </div>
            <div v-if="item.is360Panorama" class="rich-media-360-icon">
              360°
            </div>
          </button>
          <div class="rich-media-item-body">
            <div class="rich-media-item-title" :title="getMediaTitle(item)">
              {{ getMediaTitle(item) }}
            </div>
            <div class="rich-media-item-desc" :title="item.description">
              {{ item.description || item.filepath || '-' }}
            </div>
            <div class="rich-media-item-meta">
              <el-tag
                size="small"
                :type="getMediaModeTagType(item)"
                effect="plain"
              >
                {{ getMediaModeText(item) }}
              </el-tag>
              <span>{{ getSizeText(item) }}</span>
            </div>
          </div>
          <button
            type="button"
            class="rich-media-selector-button"
            :class="{
              'is-selected': findMediaSelectedIndex(item._id) > -1
            }"
            title="选择媒体"
            @click.stop="toggleMediaSelection(item)"
          >
            <span v-if="findMediaSelectedIndex(item._id) > -1">
              {{ findMediaSelectedIndex(item._id) + 1 }}
            </span>
          </button>
          <el-button
            v-if="isPureLocalMedia(item)"
            class="rich-media-delete-button"
            type="danger"
            size="small"
            circle
            :icon="Delete"
            title="删除纯本地媒体"
            @click.stop="deleteLocalMedia(item)"
          />
        </div>
      </template>
      <el-empty v-else description="暂无媒体文件" />
    </div>

    <div class="clearfix mt10">
      <el-pagination
        class="fr"
        background
        layout="total, prev, pager, next"
        :total="total"
        :pager-count="5"
        size="small"
        v-model:page-size="params.limit"
        v-model:current-page="params.page"
      />
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :disabled="selectedMediaList.length === 0"
        @click="selectMediaOk"
      >
        插入选中媒体
      </el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="changeOrderDialogVisible"
    title="拖动媒体更改选择顺序"
    width="min(760px, 94vw)"
    align-center
    destroy-on-close
    append-to-body
  >
    <draggable
      v-model="selectedMediaListCopy"
      group="rich-media"
      item-key="_id"
      class="rich-media-order-list"
    >
      <template #item="{ element }">
        <div class="rich-media-order-item">
          <el-image :src="getPreviewUrl(element)" fit="cover" />
          <span>{{ getMediaTitle(element) }}</span>
        </div>
      </template>
    </draggable>
    <template #footer>
      <el-button @click="changeOrderDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="applySelectedOrder">确定</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CircleCheck,
  Close,
  Delete,
  Picture,
  Refresh,
  Remove,
  Search,
  Select,
  Setting,
  Sort,
  VideoPlay
} from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import { multilingualApi } from '@/api'
import VideoUploader from '@/components/VideoUploader.vue'
import CheckDialogService from '@/services/CheckDialogService'
import { loadAndOpenImg } from '@/utils/utils'
import { getLanguageText } from '@/utils/multilingual'

export default {
  name: 'MultilingualRichMediaDialog',
  components: {
    VideoUploader,
    draggable
  },
  props: {
    languageCode: {
      type: String,
      default: ''
    },
    shouldSelectOk: {
      type: Boolean,
      default: true
    },
    selectLimit: {
      type: Number,
      default: null
    },
    typeList: {
      type: Array,
      default() {
        return ['image', 'video']
      }
    },
    is360Panorama: {
      type: Boolean,
      default: undefined
    }
  },
  emits: ['selectAttachments', 'onDialogClosed'],
  setup(props, { emit }) {
    const visible = ref(false)
    const loading = ref(false)
    const mediaList = ref([])
    const total = ref(0)
    const sourceSiteUrl = ref('')
    const selectedMediaList = ref([])
    const selectedMediaListCopy = ref([])
    const changeOrderDialogVisible = ref(false)
    const fileList = ref([])

    const params = reactive({
      page: 1,
      limit: 24,
      keyword: '',
      mediaMode: ''
    })

    const shouldShowSelectPage = computed(() => {
      if (props.selectLimit === null) {
        return true
      }
      return props.selectLimit > params.limit
    })

    const uploadOptions = reactive({
      noCompress: false,
      noThumbnail: false,
      is360Panorama: false,
      imgSettingCompressMaxSize: null
    })

    const languageLabel = computed(() => {
      return getLanguageText(props.languageCode)
    })

    const canUploadImage = computed(() => {
      return props.typeList.includes('image')
    })

    const canUploadVideo = computed(() => {
      if (props.is360Panorama === true) {
        return false
      }
      return props.typeList.includes('video')
    })

    const uploadOptionsCount = computed(() => {
      return Object.keys(uploadOptions).filter(key => {
        return uploadOptions[key] !== null && uploadOptions[key] !== false
      }).length
    })

    const resetUploadState = () => {
      fileList.value = []
      uploadOptions.noCompress = false
      uploadOptions.noThumbnail = false
      uploadOptions.imgSettingCompressMaxSize = null
      uploadOptions.is360Panorama = props.is360Panorama === true
    }

    const clearSelectedMediaList = () => {
      selectedMediaList.value = []
    }

    const open = () => {
      if (!props.languageCode) {
        ElMessage.error('请先选择语言')
        return
      }
      clearSelectedMediaList()
      resetUploadState()
      visible.value = true
      getMediaList(true)
    }

    const onDialogClosed = () => {
      clearSelectedMediaList()
      emit('onDialogClosed')
    }

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit,
        recordKind: 'translation',
        languageCode: props.languageCode,
        typeList: props.typeList
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.mediaMode) {
        requestParams.mediaMode = params.mediaMode
      }
      if (props.is360Panorama !== undefined) {
        requestParams.is360Panorama = props.is360Panorama
      }
      return requestParams
    }

    const getMediaList = resetPage => {
      if (!props.languageCode) {
        mediaList.value = []
        total.value = 0
        return Promise.resolve()
      }
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return Promise.resolve()
      }

      loading.value = true
      return multilingualApi
        .getMediaList(getRequestParams(), true)
        .then(response => {
          const responseData = response.data.data || {}
          sourceSiteUrl.value = responseData.sourceSiteUrl || ''
          mediaList.value = (responseData.list || []).map(item => {
            return {
              ...item,
              sourceSiteUrl: sourceSiteUrl.value
            }
          })
          total.value = responseData.total || 0
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    const isImageMedia = item => {
      return Boolean(item?.mimetype && item.mimetype.includes('image'))
    }

    const isVideoMedia = item => {
      return Boolean(item?.mimetype && item.mimetype.includes('video'))
    }

    const getPreviewUrl = item => {
      const candidateList = [
        item?.localThumbnailPath,
        item?.thumfor,
        item?.localFilepath,
        item?.filepath,
        item?.remoteFilepath
      ]
      for (const candidate of candidateList) {
        if (candidate) {
          return candidate
        }
      }
      return ''
    }

    const getOriginalUrl = item => {
      const candidateList = [
        item?.localFilepath,
        item?.filepath,
        item?.remoteFilepath,
        item?.localThumbnailPath,
        item?.thumfor
      ]
      for (const candidate of candidateList) {
        if (candidate) {
          return candidate
        }
      }
      return ''
    }

    const getMediaTitle = item => {
      return item?.name || item?.filename || item?._id || '-'
    }

    const getSizeText = item => {
      if (!item?.width || !item?.height) {
        return '-'
      }
      return `${item.width} x ${item.height}`
    }

    const hasRemoteOrigin = item => {
      if (item?.remoteSourceId) {
        return true
      }
      if (item?.remoteFilepath) {
        return true
      }
      if (item?.remoteSnapshot && Object.keys(item.remoteSnapshot).length > 0) {
        return true
      }
      return false
    }

    const isPureLocalMedia = item => {
      if (!item || item.mediaMode !== 'local') {
        return false
      }
      return !hasRemoteOrigin(item)
    }

    const getMediaModeText = item => {
      if (isPureLocalMedia(item)) {
        return '纯本地'
      }
      if (item?.mediaMode === 'local') {
        return '本地替换'
      }
      return '远程媒体'
    }

    const getMediaModeTagType = item => {
      if (isPureLocalMedia(item)) {
        return 'success'
      }
      if (item?.mediaMode === 'local') {
        return 'warning'
      }
      return 'info'
    }

    const isSelectableMedia = item => {
      if (!item?.mimetype) {
        return false
      }
      const mediaType = item.mimetype.split('/')[0]
      if (!props.typeList.includes(mediaType)) {
        return false
      }
      if (props.is360Panorama === true && !item.is360Panorama) {
        return false
      }
      return true
    }

    const selectedMediaIdList = computed(() => {
      return selectedMediaList.value.map(item => {
        return item._id
      })
    })

    const findMediaSelectedIndex = id => {
      return selectedMediaIdList.value.findIndex(item => {
        return item === id
      })
    }

    const toggleMediaSelection = item => {
      if (!isSelectableMedia(item)) {
        ElMessage.error('当前无法选择该类型的媒体文件')
        return
      }

      const selectedIndex = findMediaSelectedIndex(item._id)
      if (selectedIndex > -1) {
        selectedMediaList.value.splice(selectedIndex, 1)
        return
      }

      if (props.selectLimit === 1) {
        selectedMediaList.value = [item]
        return
      }

      if (props.selectLimit !== null) {
        if (selectedMediaList.value.length >= props.selectLimit) {
          ElMessage.error(`最多只能选择${props.selectLimit}件媒体文件`)
          return
        }
      }

      selectedMediaList.value.push(item)
    }

    const selectPageMedia = () => {
      mediaList.value.forEach(item => {
        if (!isSelectableMedia(item)) {
          return
        }
        if (findMediaSelectedIndex(item._id) > -1) {
          return
        }
        if (props.selectLimit !== null) {
          if (selectedMediaList.value.length >= props.selectLimit) {
            return
          }
        }
        selectedMediaList.value.push(item)
      })
    }

    const clearSelectedPageMedia = () => {
      mediaList.value.forEach(item => {
        const selectedIndex = findMediaSelectedIndex(item._id)
        if (selectedIndex > -1) {
          selectedMediaList.value.splice(selectedIndex, 1)
        }
      })
    }

    const selectMediaOk = () => {
      if (selectedMediaList.value.length === 0) {
        ElMessage.error('请选择媒体文件')
        return
      }
      emit('selectAttachments', selectedMediaList.value)
      visible.value = false
    }

    const applySelectedOrder = () => {
      selectedMediaList.value = selectedMediaListCopy.value.slice()
      changeOrderDialogVisible.value = false
    }

    const appendBaseCreateFormData = formData => {
      formData.append('languageCode', props.languageCode)
      formData.append('name', '')
      formData.append('description', '')
    }

    const appendImageOptions = formData => {
      formData.append('noCompress', uploadOptions.noCompress ? '1' : '0')
      formData.append('noThumbnail', uploadOptions.noThumbnail ? '1' : '0')
      formData.append('is360Panorama', uploadOptions.is360Panorama ? '1' : '0')
      if (uploadOptions.imgSettingCompressMaxSize) {
        formData.append(
          'imgSettingCompressMaxSize',
          String(uploadOptions.imgSettingCompressMaxSize)
        )
      }
    }

    const handleCreateSuccess = () => {
      getMediaList(true)
    }

    const uploadQueue = ref([])
    const uploading = ref(0)
    const maxUploads = 1

    const uploadImageFile = uploadRequest => {
      if (!props.languageCode) {
        return Promise.reject(new Error('请先选择语言'))
      }
      return new Promise((resolve, reject) => {
        uploadQueue.value.push({
          uploadRequest,
          resolve,
          reject
        })
        processUploadQueue()
      })
    }

    const processUploadQueue = () => {
      if (uploadQueue.value.length === 0) {
        return
      }
      if (uploading.value >= maxUploads) {
        return
      }

      uploading.value++
      const { uploadRequest, resolve, reject } = uploadQueue.value.shift()
      const formData = new FormData()
      appendBaseCreateFormData(formData)
      appendImageOptions(formData)
      formData.append('file', uploadRequest.file, uploadRequest.file.name)

      multilingualApi
        .createLocalMedia(formData)
        .then(response => {
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
        .finally(() => {
          uploading.value--
          processUploadQueue()
        })
    }

    const handleUploadSuccess = response => {
      ElMessage.success('上传成功')
      handleCreateSuccess(response.data.data)
      clearSuccessFileList()
    }

    const handleUploadError = error => {
      console.log(error)
    }

    let clearSuccessFileListTimer = null
    const clearSuccessFileList = () => {
      clearTimeout(clearSuccessFileListTimer)
      clearSuccessFileListTimer = setTimeout(() => {
        fileList.value = fileList.value.filter(item => {
          return item.status !== 'success'
        })
      }, 500)
    }

    const uploadVideoLocal = formData => {
      appendBaseCreateFormData(formData)
      formData.append('is360Panorama', '0')
      return multilingualApi.createLocalMedia(formData)
    }

    const handleVideoUploaded = response => {
      handleCreateSuccess(response.data.data)
    }

    const getMediaSettingValues = () => {
      return multilingualApi.getMediaSettings({}, true)
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

    const handlePaste = event => {
      if (!canUploadImage.value) {
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
        uploadImageFile({ file })
          .then(response => {
            handleUploadSuccess(response)
          })
          .catch(error => {
            handleUploadError(error)
          })
        event.preventDefault()
        return
      }
    }

    const getPreviewSize = item => {
      if (item?.width && item?.height) {
        return {
          width: item.width,
          height: item.height
        }
      }
      if (isVideoMedia(item)) {
        return {
          width: 1280,
          height: 720
        }
      }
      return {
        width: 1600,
        height: 900
      }
    }

    const openPreviewer = item => {
      const src = getOriginalUrl(item)
      if (!src) {
        return
      }
      const previewSize = getPreviewSize(item)
      loadAndOpenImg(0, [
        {
          src,
          width: previewSize.width,
          height: previewSize.height,
          mimetype: item.mimetype || '',
          is360Panorama: Boolean(item.is360Panorama)
        }
      ])
    }

    const removeDeletedItemFromSelection = id => {
      selectedMediaList.value = selectedMediaList.value.filter(item => {
        return item._id !== id
      })
    }

    const deleteLocalMedia = item => {
      if (!isPureLocalMedia(item)) {
        ElMessage.error('只有纯本地媒体可以直接删除')
        return
      }
      CheckDialogService.open({
        correctAnswer: 'DELETE',
        content:
          '确认删除这个<span class="cRed">纯本地媒体文件</span>吗？文件会从服务器移除。',
        success: () => {
          return multilingualApi
            .deleteLocalMedia({
              id: item._id,
              languageCode: props.languageCode
            })
            .then(() => {
              ElMessage.success('删除成功')
              removeDeletedItemFromSelection(item._id)
              getMediaList(false)
            })
        }
      }).catch(() => {})
    }

    watch(
      () => params.page,
      () => {
        if (visible.value) {
          getMediaList(false)
        }
      }
    )

    watch(
      () => props.languageCode,
      () => {
        if (visible.value) {
          clearSelectedMediaList()
          getMediaList(true)
        }
      }
    )

    watch(changeOrderDialogVisible, value => {
      if (value) {
        selectedMediaListCopy.value = selectedMediaList.value.slice()
      }
    })

    return {
      CircleCheck,
      Close,
      Delete,
      Picture,
      Refresh,
      Remove,
      Search,
      Select,
      Setting,
      Sort,
      VideoPlay,
      visible,
      loading,
      mediaList,
      total,
      params,
      uploadOptions,
      uploadOptionsCount,
      fileList,
      selectedMediaList,
      selectedMediaListCopy,
      changeOrderDialogVisible,
      languageLabel,
      canUploadImage,
      canUploadVideo,
      shouldShowSelectPage,
      open,
      onDialogClosed,
      getMediaList,
      getPreviewUrl,
      getMediaTitle,
      getSizeText,
      getMediaModeText,
      getMediaModeTagType,
      isVideoMedia,
      isPureLocalMedia,
      isSelectableMedia,
      findMediaSelectedIndex,
      toggleMediaSelection,
      selectPageMedia,
      clearSelectedPageMedia,
      clearSelectedMediaList,
      selectMediaOk,
      applySelectedOrder,
      uploadImageFile,
      handleUploadSuccess,
      handleUploadError,
      uploadVideoLocal,
      handleVideoUploaded,
      getMediaSettingValues,
      handlePaste,
      openPreviewer,
      deleteLocalMedia
    }
  }
}
</script>

<style scoped>
.rich-media-filter-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.rich-media-keyword {
  width: min(360px, 100%);
}

.rich-media-mode {
  width: 140px;
}

.rich-media-select-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 117px;
  box-sizing: border-box;
  margin-bottom: 0px;
  padding: 0 12px;
}

.rich-media-select-content {
  width: 100%;
  text-align: center;
}

.rich-media-select-actions {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.rich-media-upload-panel {
  height: 117px;
  box-sizing: border-box;
  margin-bottom: 0px;
  padding: 0;
  overflow: hidden;
}

.rich-media-upload-actions {
  display: flex;
  justify-content: center;
  height: 100%;
  gap: 12px;
  align-items: center;
  overflow: hidden;
}

.rich-media-image-upload,
.rich-media-upload-actions :deep(.attachments-upload) {
  width: 260px;
  max-width: calc(50% - 6px);
  overflow: hidden;
}

.rich-media-upload-actions.is-single-uploader .rich-media-image-upload,
.rich-media-upload-actions.is-single-uploader :deep(.attachments-upload) {
  max-width: 100%;
  width: 100%;
}

.rich-media-image-upload :deep(.el-upload-dragger),
.rich-media-upload-actions :deep(.attachments-upload .el-upload-dragger) {
  height: 97px;
  padding: 5px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.rich-media-image-upload :deep(.el-icon--upload),
.rich-media-upload-actions :deep(.attachments-upload .el-icon--upload) {
  margin-bottom: 6px;
  font-size: 30px;
  line-height: 42px;
}

.rich-media-upload-actions :deep(.attachments-upload.mb20) {
  margin-bottom: 0;
}

.rich-media-image-upload :deep(.el-upload-list) {
  max-height: 100px;
  margin: 10px 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.rich-media-option-field {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rich-media-option-label {
  width: 52px;
  color: var(--el-text-color-secondary);
}

.rich-media-list {
  min-height: 260px;
  max-height: 52vh;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
  padding: 2px;
}

.rich-media-item {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.rich-media-item.is-selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.rich-media-item.is-disabled {
  opacity: 0.55;
}

.rich-media-preview {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  padding: 0;
  border: 0;
  background: var(--el-fill-color-light);
  color: inherit;
  cursor: zoom-in;
}

.rich-media-preview-image {
  width: 100%;
  height: 100%;
  display: block;
}

.rich-media-preview-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rich-media-preview-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.rich-media-play-icon,
.rich-media-360-icon {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}

.rich-media-play-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 24px;
  background: rgba(0, 0, 0, 0.45);
}

.rich-media-360-icon {
  min-width: 46px;
  min-height: 26px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.48);
}

.rich-media-item-body {
  padding: 9px;
}

.rich-media-item-title,
.rich-media-item-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rich-media-item-title {
  font-weight: 600;
}

.rich-media-item-desc {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.rich-media-item-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.rich-media-selector-button {
  position: absolute;
  right: 8px;
  top: 8px;
  display: flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.36);
  cursor: pointer;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.26);
}

.rich-media-selector-button.is-selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
}

.rich-media-selector-button:focus-visible {
  outline: 2px solid var(--el-color-primary-light-3);
  outline-offset: 2px;
}

.rich-media-delete-button {
  position: absolute;
  left: 8px;
  top: 8px;
}

.rich-media-order-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
  max-height: 54vh;
  overflow: auto;
}

.rich-media-order-item {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-bg-color);
  cursor: move;
}

.rich-media-order-item .el-image {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: block;
}

.rich-media-order-item span {
  display: block;
  padding: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

@media (max-width: 767px) {
  .rich-media-filter-row {
    align-items: stretch;
  }

  .rich-media-keyword,
  .rich-media-mode {
    width: 100%;
  }

  .rich-media-upload-actions {
    gap: 8px;
  }

  .rich-media-image-upload,
  .rich-media-upload-actions :deep(.attachments-upload) {
    max-width: calc(50% - 4px);
  }

  .rich-media-upload-actions.is-single-uploader .rich-media-image-upload,
  .rich-media-upload-actions.is-single-uploader :deep(.attachments-upload) {
    max-width: 100%;
  }

  .rich-media-list {
    grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
  }
}
</style>
