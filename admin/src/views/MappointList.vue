<template>
  <div>
    <GroupedLanguageManager
      ref="groupedManagerRef"
      title="地点管理"
      :get-list="getMappointList"
    >
      <template #source="{ row, sourceSnapshot, primaryEntry }">
        <div class="space-y-1">
          <div class="font-medium">
            {{ sourceSnapshot?.title || primaryEntry?.title || row.sourceId }}
          </div>
          <div class="text-xs text-gray-500 line-clamp-2">
            {{
              sourceSnapshot?.summary || primaryEntry?.summary || '暂无源简介'
            }}
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <span>
              {{ sourceSnapshot?.longitude || primaryEntry?.longitude || 0 }},
              {{ sourceSnapshot?.latitude || primaryEntry?.latitude || 0 }}
            </span>
            <SourceSnapshotPreview :snapshot="sourceSnapshot" />
          </div>
        </div>
      </template>

      <template #language="{ entry }">
        <div v-if="entry" class="space-y-2">
          <div class="font-medium truncate">{{ entry.title || '-' }}</div>
          <div class="text-xs text-gray-500 line-clamp-2">
            {{ entry.summary || '暂无简介' }}
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <span>{{ entry.longitude }}, {{ entry.latitude }}</span>
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

      <template #mobile-card="{ row, sourceSnapshot, getLangEntry }">
        <div class="space-y-3">
          <div>
            <div class="font-medium">
              {{ sourceSnapshot?.title || row.sourceId }}
            </div>
            <div class="text-xs text-gray-500 break-all">
              {{ sourceSnapshot?.longitude || 0 }},
              {{ sourceSnapshot?.latitude || 0 }}
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
                {{ getLangEntry(row, languageCode)?.title || '缺失' }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </GroupedLanguageManager>

    <el-dialog v-model="dialogVisible" title="编辑地点" width="480px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="地点名称">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="editForm.summary" type="textarea" :rows="2" />
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
import { getMappointList, updateMappoint } from '../api/taxonomy.js'
import GroupedLanguageManager from '../components/GroupedLanguageManager.vue'
import SourceSnapshotPreview from '../components/SourceSnapshotPreview.vue'
import {
  getTranslationStatusLabel,
  getTranslationStatusTagType
} from '../utils/translationStatus.js'

const LANGUAGE_CODES = ['en', 'jp', 'tw']

export default {
  name: 'MappointList',
  components: { GroupedLanguageManager, SourceSnapshotPreview },
  setup() {
    const groupedManagerRef = ref(null)
    const saving = ref(false)
    const dialogVisible = ref(false)
    const currentId = ref('')
    const editForm = reactive({ title: '', summary: '' })

    function openEdit(entry) {
      currentId.value = entry._id
      editForm.title = entry.title || ''
      editForm.summary = entry.summary || ''
      dialogVisible.value = true
    }

    async function handleSave() {
      saving.value = true
      try {
        await updateMappoint(currentId.value, {
          title: editForm.title,
          summary: editForm.summary
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
      getMappointList,
      saving,
      dialogVisible,
      editForm,
      languageCodes: LANGUAGE_CODES,
      openEdit,
      handleSave,
      getTranslationStatusLabel,
      getTranslationStatusTagType
    }
  }
}
</script>
