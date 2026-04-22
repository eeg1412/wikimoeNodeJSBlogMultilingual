<template>
  <el-dialog
    v-model="visible"
    title="媒体库"
    width="min(1100px, 96vw)"
    destroy-on-close
    append-to-body
  >
    <div class="attachment-selector__toolbar">
      <div class="attachment-selector__toolbar-row">
        <el-select
          v-model="query.languageCode"
          placeholder="语言"
          clearable
          style="width: 140px"
        >
          <el-option label="en" value="en" />
          <el-option label="jp" value="jp" />
          <el-option label="tw" value="tw" />
        </el-select>
        <el-select
          v-model="query.attachmentSourceType"
          placeholder="来源"
          clearable
          style="width: 160px"
        >
          <el-option label="远程（源站）" value="remote" />
          <el-option label="本地上传" value="localized" />
        </el-select>
        <el-input
          v-model="query.keyword"
          clearable
          placeholder="搜索附件名称或描述"
          style="min-width: 220px; max-width: 320px"
          @keyup.enter="fetchList"
        />
        <el-button type="primary" @click="fetchList">查询</el-button>
        <el-upload
          action=""
          :show-file-list="false"
          :http-request="handleUpload"
          :accept="accept"
        >
          <el-button>上传本地附件</el-button>
        </el-upload>
      </div>
      <div class="text-xs text-gray-500">
        已选择 {{ selectedItems.length }} 项，点击卡片即可切换选中状态。
      </div>
    </div>

    <div v-loading="loading">
      <div v-if="flattenedList.length > 0" class="attachment-selector__grid">
        <article
          v-for="item in flattenedList"
          :key="item._id"
          class="attachment-selector__item"
          :class="{ 'is-selected': isSelected(item) }"
          @click="toggleSelection(item)"
        >
          <div class="attachment-selector__preview">
            <el-image
              v-if="isImage(item)"
              :src="getPreviewUrl(item)"
              fit="cover"
              style="width: 100%; height: 120px"
            />
            <div v-else class="attachment-selector__preview--icon">
              <el-icon v-if="isVideo(item)"><VideoPlay /></el-icon>
              <el-icon v-else-if="isAudio(item)"><Headset /></el-icon>
              <el-icon v-else><Picture /></el-icon>
            </div>
          </div>

          <div class="attachment-selector__meta">
            <div class="font-medium truncate">{{ item.name || item.filename || '-' }}</div>
            <div class="text-xs text-gray-500">
              {{ item.languageCode || '-' }} · {{ item.mimetype || '未知类型' }}
            </div>
            <div class="text-xs text-gray-500 line-clamp-2">
              {{ item.description || item.filepath || item.externalUrl || '暂无描述' }}
            </div>
          </div>
        </article>
      </div>
      <el-empty v-else description="暂无可选附件" />
    </div>

    <div class="admin-pagination">
      <el-pagination
        v-model:current-page="query.page"
        :page-size="query.limit"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="fetchList"
      />
    </div>

    <template #footer>
      <div class="attachment-selector__footer">
        <div class="text-xs text-gray-500">
          当前允许插入：
          {{
            normalizedTypeList.length > 0 ? normalizedTypeList.join(' / ') : '全部'
          }}
        </div>
        <div class="flex gap-2">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :disabled="selectedItems.length === 0" @click="confirmSelection">
            插入所选内容
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Headset, Picture, VideoPlay } from '@element-plus/icons-vue'
import {
  getAttachmentList,
  uploadLocalizedAttachment
} from '../api/attachment.js'

const LANGUAGE_CODES = ['en', 'jp', 'tw']

export default {
  name: 'AttachmentSelectorDialog',
  components: {
    Headset,
    Picture,
    VideoPlay
  },
  props: {
    languageCode: {
      type: String,
      default: ''
    },
    typeList: {
      type: Array,
      default: () => []
    }
  },
  emits: ['selectAttachments'],
  setup(props, { emit, expose }) {
    const visible = ref(false)
    const loading = ref(false)
    const total = ref(0)
    const flattenedList = ref([])
    const selectedMap = ref(new Map())

    const query = reactive({
      page: 1,
      limit: 20,
      languageCode: props.languageCode || 'en',
      attachmentSourceType: '',
      keyword: ''
    })

    const normalizedTypeList = computed(() =>
      Array.isArray(props.typeList) ? props.typeList.filter(Boolean) : []
    )

    const accept = computed(() => {
      if (normalizedTypeList.value.length === 0) {
        return 'image/*,video/*,audio/*'
      }

      return normalizedTypeList.value.map(type => `${type}/*`).join(',')
    })

    const selectedItems = computed(() => Array.from(selectedMap.value.values()))

    function open() {
      query.page = 1
      query.languageCode = props.languageCode || query.languageCode || 'en'
      visible.value = true
      fetchList()
    }

    function resetSelection() {
      selectedMap.value = new Map()
    }

    function normalizeKind(entry) {
      const mimetype = entry?.mimetype || ''
      if (mimetype.startsWith('image/')) {
        return 'image'
      }
      if (mimetype.startsWith('video/')) {
        return 'video'
      }
      if (mimetype.startsWith('audio/')) {
        return 'audio'
      }
      return 'other'
    }

    function filterEntry(entry) {
      if (normalizedTypeList.value.length === 0) {
        return true
      }

      return normalizedTypeList.value.includes(normalizeKind(entry))
    }

    function flattenGroupRow(row) {
      const result = []
      const langs = Array.isArray(row.langs) ? row.langs : []

      for (const entry of langs) {
        if (!filterEntry(entry)) {
          continue
        }

        if (query.keyword) {
          const keyword = query.keyword.toLowerCase()
          const haystacks = [
            entry.name,
            entry.filename,
            entry.description,
            entry.filepath,
            row.groupKey
          ]
          const matched = haystacks.some(value =>
            String(value || '')
              .toLowerCase()
              .includes(keyword)
          )
          if (!matched) {
            continue
          }
        }

        result.push({
          ...entry,
          groupKey: row.groupKey
        })
      }

      return result
    }

    async function fetchList() {
      loading.value = true
      try {
        const params = {
          page: query.page,
          limit: query.limit
        }

        if (query.languageCode) {
          params.languageCode = query.languageCode
        }
        if (query.attachmentSourceType) {
          params.attachmentSourceType = query.attachmentSourceType
        }
        if (query.keyword) {
          params.keyword = query.keyword
        }

        const res = await getAttachmentList(params)
        const groups = res.data?.list || []
        flattenedList.value = groups.flatMap(flattenGroupRow)
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    async function handleUpload({ file }) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('languageCode', query.languageCode || props.languageCode || 'en')
      try {
        await uploadLocalizedAttachment(formData)
        ElMessage.success('上传成功')
        await fetchList()
      } catch {
        ElMessage.error('上传失败')
      }
    }

    function isSelected(item) {
      return selectedMap.value.has(item._id)
    }

    function toggleSelection(item) {
      const next = new Map(selectedMap.value)
      if (next.has(item._id)) {
        next.delete(item._id)
      } else {
        next.set(item._id, item)
      }
      selectedMap.value = next
    }

    function confirmSelection() {
      emit('selectAttachments', selectedItems.value)
      visible.value = false
      resetSelection()
    }

    function getPreviewUrl(entry) {
      if (!entry) {
        return ''
      }
      if (entry.previewUrl) {
        return entry.previewUrl
      }
      if (entry.externalUrl) {
        return entry.externalUrl
      }
      return entry.filepath || ''
    }

    function isImage(entry) {
      return normalizeKind(entry) === 'image'
    }

    function isVideo(entry) {
      return normalizeKind(entry) === 'video'
    }

    function isAudio(entry) {
      return normalizeKind(entry) === 'audio'
    }

    expose({ open })

    return {
      LANGUAGE_CODES,
      visible,
      loading,
      total,
      query,
      accept,
      normalizedTypeList,
      flattenedList,
      selectedItems,
      fetchList,
      handleUpload,
      isSelected,
      toggleSelection,
      confirmSelection,
      getPreviewUrl,
      isImage,
      isVideo,
      isAudio
    }
  }
}
</script>
