<template>
  <div>
    <GroupedLanguageManager
      ref="groupedManagerRef"
      title="附件管理"
      :get-list="getAttachmentList"
      :initial-query="initialQuery"
      source-id-label="资源组"
      keyword-placeholder="搜索文件名 / 描述 / 路径"
    >
      <template #filters="{ query, fetchList }">
        <el-upload
          action=""
          :http-request="options => handleUpload(options, query, fetchList)"
          :show-file-list="false"
          accept="image/*,video/*,audio/*"
        >
          <el-button type="primary">上传本地附件</el-button>
        </el-upload>
        <el-select
          v-model="query.attachmentSourceType"
          placeholder="类型"
          clearable
          style="width: 140px"
        >
          <el-option label="远程（源站）" value="remote" />
          <el-option label="本地上传" value="localized" />
        </el-select>
      </template>

      <template #source="{ row, primaryEntry, sourceSnapshot }">
        <div class="flex gap-3 items-start">
          <el-image
            :src="getPreviewUrl(primaryEntry)"
            style="width: 56px; height: 56px; object-fit: cover; flex-shrink: 0"
          />
          <div class="space-y-1 min-w-0">
            <div class="font-medium truncate">
              {{ sourceSnapshot?.name || primaryEntry?.name || row.groupKey }}
            </div>
            <div class="text-xs text-gray-500 line-clamp-2">
              {{
                sourceSnapshot?.description ||
                primaryEntry?.description ||
                '暂无描述'
              }}
            </div>
            <div class="text-xs text-gray-500 break-all">
              {{
                primaryEntry?.sourcePath ||
                primaryEntry?.externalUrl ||
                primaryEntry?.filepath ||
                row.groupKey
              }}
            </div>
            <div class="flex items-center gap-2 text-xs text-gray-500">
              <span>{{ primaryEntry?.attachmentSourceType || '-' }}</span>
              <SourceSnapshotPreview :snapshot="sourceSnapshot" />
            </div>
          </div>
        </div>
      </template>

      <template #language="{ entry }">
        <div v-if="entry" class="space-y-2">
          <div class="flex gap-2 items-start">
            <el-image
              :src="getPreviewUrl(entry)"
              style="
                width: 48px;
                height: 48px;
                object-fit: cover;
                flex-shrink: 0;
              "
            />
            <div class="min-w-0 flex-1">
              <div class="font-medium truncate">{{ entry.name || '-' }}</div>
              <div class="text-xs text-gray-500 truncate">
                {{ entry.mimetype || '-' }}
              </div>
            </div>
          </div>
          <div class="text-xs text-gray-500 line-clamp-2">
            {{ entry.description || '暂无描述' }}
          </div>
          <div class="flex items-center gap-2">
            <el-tag
              size="small"
              :type="getTranslationStatusTagType(entry.translationStatus)"
            >
              {{ getTranslationStatusLabel(entry.translationStatus) }}
            </el-tag>
            <el-button type="primary" link size="small" @click="openEdit(entry)"
              >编辑</el-button
            >
          </div>
        </div>
        <el-tag v-else size="small" type="info">缺失</el-tag>
      </template>

      <template #mobile-card="{ row, primaryEntry, getLangEntry }">
        <div class="space-y-3">
          <div class="flex gap-3 items-center">
            <el-image
              :src="getPreviewUrl(primaryEntry)"
              style="
                width: 52px;
                height: 52px;
                object-fit: cover;
                flex-shrink: 0;
              "
            />
            <div class="min-w-0 flex-1">
              <div class="font-medium truncate">
                {{ primaryEntry?.name || row.groupKey }}
              </div>
              <div class="text-xs text-gray-500 break-all">
                {{
                  primaryEntry?.sourcePath ||
                  primaryEntry?.externalUrl ||
                  primaryEntry?.filepath ||
                  row.groupKey
                }}
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <div
              v-for="languageCode in languageCodes"
              :key="languageCode"
              class="rounded border border-gray-200 px-3 py-2"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs uppercase text-gray-500">{{
                  languageCode
                }}</span>
                <el-button
                  v-if="getLangEntry(row, languageCode)"
                  type="primary"
                  link
                  size="small"
                  @click="openEdit(getLangEntry(row, languageCode))"
                  >编辑</el-button
                >
              </div>
              <div class="mt-1 text-sm">
                {{ getLangEntry(row, languageCode)?.name || '缺失' }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </GroupedLanguageManager>

    <el-dialog v-model="dialogVisible" title="编辑附件" width="520px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="文件名">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getAttachmentList,
  updateAttachment,
  uploadLocalizedAttachment
} from '../api/attachment.js'
import GroupedLanguageManager from '../components/GroupedLanguageManager.vue'
import SourceSnapshotPreview from '../components/SourceSnapshotPreview.vue'
import {
  getTranslationStatusLabel,
  getTranslationStatusTagType
} from '../utils/translationStatus.js'

const LANGUAGE_CODES = ['en', 'jp', 'tw']

export default {
  name: 'AttachmentList',
  components: { GroupedLanguageManager, SourceSnapshotPreview },
  setup() {
    const groupedManagerRef = ref(null)
    const saving = ref(false)
    const dialogVisible = ref(false)
    const currentId = ref('')
    const editForm = reactive({ name: '', description: '' })
    const initialQuery = {
      page: 1,
      languageCode: 'en',
      attachmentSourceType: '',
      keyword: ''
    }

    async function handleUpload({ file }, query, fetchList) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('languageCode', query.languageCode)
      try {
        await uploadLocalizedAttachment(formData)
        ElMessage.success('上传成功')
        fetchList()
      } catch {
        ElMessage.error('上传失败')
      }
    }

    function openEdit(entry) {
      currentId.value = entry._id
      editForm.name = entry.name || ''
      editForm.description = entry.description || ''
      dialogVisible.value = true
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

    async function handleSave() {
      saving.value = true
      try {
        await updateAttachment(currentId.value, {
          name: editForm.name,
          description: editForm.description
        })
        ElMessage.success('保存成功')
        dialogVisible.value = false

        if (groupedManagerRef.value) {
          groupedManagerRef.value.fetchList()
        }
      } finally {
        saving.value = false
      }
    }

    return {
      groupedManagerRef,
      getAttachmentList,
      initialQuery,
      saving,
      dialogVisible,
      editForm,
      languageCodes: LANGUAGE_CODES,
      handleUpload,
      openEdit,
      getPreviewUrl,
      handleSave,
      getTranslationStatusLabel,
      getTranslationStatusTagType
    }
  }
}
</script>
