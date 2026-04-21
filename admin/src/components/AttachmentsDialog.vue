<template>
  <el-dialog
    v-model="visible"
    title="选择附件"
    width="900px"
    append-to-body
    destroy-on-close
    class="attachments-dialog"
    @open="onOpen"
  >
    <el-tabs v-model="activeTab" class="attachments-dialog-tabs">
      <el-tab-pane label="远程附件" name="remote">
        <div class="attachments-dialog-filter">
          <el-input
            v-model="remoteQuery.keyword"
            placeholder="按文件名/描述/URL 搜索"
            clearable
            style="width: 260px"
            @change="() => reload('remote')"
          />
          <el-select
            v-model="remoteQuery.mimetypePrefix"
            placeholder="类型"
            clearable
            style="width: 140px; margin-left: 8px"
            @change="() => reload('remote')"
          >
            <el-option label="图片" value="image/" />
            <el-option label="视频" value="video/" />
            <el-option label="音频" value="audio/" />
          </el-select>
          <el-button
            type="primary"
            style="margin-left: 8px"
            @click="showRegisterRemoteDialog = true"
          >
            登记远程资源
          </el-button>
        </div>
        <div class="attachments-dialog-grid" v-loading="remoteLoading">
          <div
            v-for="item in remoteList"
            :key="item._id"
            class="attachments-dialog-item"
            :class="{ 'is-selected': isSelected(item._id) }"
            @click="toggleSelect(item)"
          >
            <div class="attachments-dialog-thumb">
              <img
                v-if="isImage(item)"
                :src="resolveUrl(item)"
                :alt="item.name || item.filename"
                loading="lazy"
              />
              <span v-else class="attachments-dialog-placeholder">
                {{ (item.mimetype || 'file').split('/')[0] }}
              </span>
            </div>
            <div class="attachments-dialog-meta">
              <div class="attachments-dialog-name" :title="item.filename">
                {{ item.name || item.filename || '未命名' }}
              </div>
              <div class="attachments-dialog-sub">
                {{ item.sourcePath || item.externalUrl }}
              </div>
            </div>
          </div>
          <div
            v-if="!remoteLoading && !remoteList.length"
            class="attachments-dialog-empty"
          >
            暂无远程附件
          </div>
        </div>
        <el-pagination
          background
          layout="prev, pager, next, total"
          :current-page="remoteQuery.page"
          :page-size="remoteQuery.limit"
          :total="remoteTotal"
          @current-change="onRemotePageChange"
        />
      </el-tab-pane>

      <el-tab-pane label="本地上传" name="localized">
        <div class="attachments-dialog-filter">
          <el-input
            v-model="localizedQuery.keyword"
            placeholder="按文件名/描述搜索"
            clearable
            style="width: 260px"
            @change="() => reload('localized')"
          />
          <el-select
            v-model="localizedQuery.mimetypePrefix"
            placeholder="类型"
            clearable
            style="width: 140px; margin-left: 8px"
            @change="() => reload('localized')"
          >
            <el-option label="图片" value="image/" />
            <el-option label="视频" value="video/" />
            <el-option label="音频" value="audio/" />
          </el-select>
          <el-upload
            style="margin-left: 8px; display: inline-block"
            :show-file-list="false"
            :before-upload="beforeUpload"
            :http-request="doUpload"
          >
            <el-button type="primary">上传新文件</el-button>
          </el-upload>
        </div>
        <div class="attachments-dialog-grid" v-loading="localizedLoading">
          <div
            v-for="item in localizedList"
            :key="item._id"
            class="attachments-dialog-item"
            :class="{ 'is-selected': isSelected(item._id) }"
            @click="toggleSelect(item)"
          >
            <div class="attachments-dialog-thumb">
              <img
                v-if="isImage(item)"
                :src="resolveUrl(item)"
                :alt="item.name || item.filename"
                loading="lazy"
              />
              <span v-else class="attachments-dialog-placeholder">
                {{ (item.mimetype || 'file').split('/')[0] }}
              </span>
            </div>
            <div class="attachments-dialog-meta">
              <div class="attachments-dialog-name" :title="item.filename">
                {{ item.name || item.filename || '未命名' }}
              </div>
              <div class="attachments-dialog-sub">
                {{ item.mimetype }} · {{ formatSize(item.filesize) }}
              </div>
            </div>
          </div>
          <div
            v-if="!localizedLoading && !localizedList.length"
            class="attachments-dialog-empty"
          >
            还没有上传过本地附件
          </div>
        </div>
        <el-pagination
          background
          layout="prev, pager, next, total"
          :current-page="localizedQuery.page"
          :page-size="localizedQuery.limit"
          :total="localizedTotal"
          @current-change="onLocalizedPageChange"
        />
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <div class="attachments-dialog-footer">
        <span class="attachments-dialog-footer-tip">
          已选 {{ selectedItems.length }} 项
        </span>
        <el-button @click="visible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!selectedItems.length"
          @click="onConfirm"
        >
          确认选择
        </el-button>
      </div>
    </template>

    <el-dialog
      v-model="showRegisterRemoteDialog"
      title="登记远程资源"
      width="520px"
      append-to-body
    >
      <el-form :model="registerForm" label-width="110px">
        <el-form-item label="语言">
          <el-select v-model="registerForm.languageCode" placeholder="选择语言">
            <el-option
              v-for="code in site.supportedLanguageCodes"
              :key="code"
              :label="code"
              :value="code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="原站路径">
          <el-input
            v-model="registerForm.sourcePath"
            placeholder="/upload/2024/xx.jpg"
          />
        </el-form-item>
        <el-form-item label="或外链 URL">
          <el-input
            v-model="registerForm.externalUrl"
            placeholder="https://..."
          />
        </el-form-item>
        <el-form-item label="MIME">
          <el-input v-model="registerForm.mimetype" />
        </el-form-item>
        <el-form-item label="显示名">
          <el-input v-model="registerForm.name" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRegisterRemoteDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="registerSubmitting"
          @click="submitRegister"
        >
          登记
        </el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listAttachmentsApi,
  uploadAttachmentApi,
  registerRemoteAttachmentApi
} from '@/api/attachments'
import { resolveAttachmentUrl } from '@/utils/attachmentUrl'
import { useSiteStore } from '@/store/site'

export default {
  name: 'AttachmentsDialog',
  props: {
    languageCode: { type: String, default: '' },
    multiple: { type: Boolean, default: false },
    mimetypePrefix: { type: String, default: '' },
    defaultTab: { type: String, default: 'remote' }
  },
  emits: ['select'],
  setup(props, { emit, expose }) {
    const site = useSiteStore()
    const visible = ref(false)
    const activeTab = ref(props.defaultTab || 'remote')

    const remoteList = ref([])
    const remoteTotal = ref(0)
    const remoteLoading = ref(false)
    const remoteQuery = reactive({
      page: 1,
      limit: 24,
      keyword: '',
      mimetypePrefix: props.mimetypePrefix || '',
      languageCode: props.languageCode || '',
      attachmentSourceType: 'remote'
    })

    const localizedList = ref([])
    const localizedTotal = ref(0)
    const localizedLoading = ref(false)
    const localizedQuery = reactive({
      page: 1,
      limit: 24,
      keyword: '',
      mimetypePrefix: props.mimetypePrefix || '',
      languageCode: props.languageCode || '',
      attachmentSourceType: 'localized'
    })

    const selectedMap = ref({})
    const selectedItems = computed(() =>
      Object.values(selectedMap.value).filter(Boolean)
    )

    function isSelected(id) {
      return !!selectedMap.value[id]
    }
    function toggleSelect(item) {
      if (!props.multiple) {
        selectedMap.value = { [item._id]: item }
        return
      }
      if (selectedMap.value[item._id]) {
        const next = { ...selectedMap.value }
        delete next[item._id]
        selectedMap.value = next
      } else {
        selectedMap.value = { ...selectedMap.value, [item._id]: item }
      }
    }

    function resolveUrl(item) {
      return resolveAttachmentUrl(item, site.sourceBlogPublicOrigin)
    }
    function isImage(item) {
      return (item.mimetype || '').indexOf('image/') === 0
    }
    function formatSize(bytes) {
      if (!bytes) return '0'
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / 1024 / 1024).toFixed(2)} MB`
    }

    async function load(tab) {
      if (tab === 'remote') {
        remoteLoading.value = true
        try {
          const resp = await listAttachmentsApi(remoteQuery)
          remoteList.value = (resp && resp.data && resp.data.list) || []
          remoteTotal.value = (resp && resp.data && resp.data.total) || 0
        } finally {
          remoteLoading.value = false
        }
      } else {
        localizedLoading.value = true
        try {
          const resp = await listAttachmentsApi(localizedQuery)
          localizedList.value = (resp && resp.data && resp.data.list) || []
          localizedTotal.value = (resp && resp.data && resp.data.total) || 0
        } finally {
          localizedLoading.value = false
        }
      }
    }
    function reload(tab) {
      if (tab === 'remote') remoteQuery.page = 1
      else localizedQuery.page = 1
      load(tab)
    }
    function onRemotePageChange(p) {
      remoteQuery.page = p
      load('remote')
    }
    function onLocalizedPageChange(p) {
      localizedQuery.page = p
      load('localized')
    }

    function onOpen() {
      selectedMap.value = {}
      load('remote')
      load('localized')
    }

    function onConfirm() {
      emit('select', selectedItems.value)
      visible.value = false
    }

    // 上传
    function beforeUpload(file) {
      const maxMB = 50
      if (file.size > maxMB * 1024 * 1024) {
        ElMessage.error(`文件超过 ${maxMB}MB`)
        return false
      }
      return true
    }
    async function doUpload({ file }) {
      if (!props.languageCode) {
        ElMessage.error('未指定语言代码，无法上传')
        return
      }
      const form = new FormData()
      form.append('file', file)
      form.append('languageCode', props.languageCode)
      const resp = await uploadAttachmentApi(form)
      if (resp && resp.data && resp.data.attachment) {
        ElMessage.success(
          resp.data.reused ? '已存在同哈希文件，复用' : '上传成功'
        )
        load('localized')
      }
    }

    // 登记远程
    const showRegisterRemoteDialog = ref(false)
    const registerSubmitting = ref(false)
    const registerForm = reactive({
      languageCode: props.languageCode || '',
      sourcePath: '',
      externalUrl: '',
      mimetype: '',
      name: ''
    })
    async function submitRegister() {
      if (!registerForm.languageCode) {
        ElMessage.error('请选择语言')
        return
      }
      if (!registerForm.sourcePath && !registerForm.externalUrl) {
        ElMessage.error('请填写原站路径或外链 URL')
        return
      }
      const payload = { languageCode: registerForm.languageCode }
      if (registerForm.sourcePath)
        payload.sourcePath = registerForm.sourcePath.trim()
      if (registerForm.externalUrl)
        payload.externalUrl = registerForm.externalUrl.trim()
      if (registerForm.mimetype) payload.mimetype = registerForm.mimetype.trim()
      if (registerForm.name) payload.name = registerForm.name.trim()
      registerSubmitting.value = true
      try {
        const resp = await registerRemoteAttachmentApi(payload)
        if (resp && resp.data && resp.data.attachment) {
          ElMessage.success(resp.data.reused ? '已存在，已复用' : '登记成功')
          showRegisterRemoteDialog.value = false
          registerForm.sourcePath = ''
          registerForm.externalUrl = ''
          registerForm.name = ''
          load('remote')
        }
      } finally {
        registerSubmitting.value = false
      }
    }

    function open() {
      visible.value = true
    }
    expose({ open })

    return {
      site,
      visible,
      activeTab,
      remoteList,
      remoteTotal,
      remoteLoading,
      remoteQuery,
      localizedList,
      localizedTotal,
      localizedLoading,
      localizedQuery,
      selectedItems,
      isSelected,
      toggleSelect,
      resolveUrl,
      isImage,
      formatSize,
      reload,
      onRemotePageChange,
      onLocalizedPageChange,
      onOpen,
      onConfirm,
      beforeUpload,
      doUpload,
      showRegisterRemoteDialog,
      registerForm,
      registerSubmitting,
      submitRegister
    }
  }
}
</script>

<style scoped>
.attachments-dialog-filter {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.attachments-dialog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  min-height: 240px;
  margin-bottom: 12px;
}
.attachments-dialog-item {
  border: 2px solid transparent;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
  transition: border-color 0.15s;
}
.attachments-dialog-item:hover {
  border-color: var(--el-color-primary-light-5);
}
.attachments-dialog-item.is-selected {
  border-color: var(--el-color-primary);
}
.attachments-dialog-thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color);
  border-radius: 4px;
  overflow: hidden;
}
.attachments-dialog-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.attachments-dialog-placeholder {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.attachments-dialog-meta {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.3;
}
.attachments-dialog-name {
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attachments-dialog-sub {
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attachments-dialog-empty {
  grid-column: 1 / -1;
  padding: 48px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
}
.attachments-dialog-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}
.attachments-dialog-footer-tip {
  margin-right: auto;
  color: var(--el-text-color-secondary);
}
</style>
