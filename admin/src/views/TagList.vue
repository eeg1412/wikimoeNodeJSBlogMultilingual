<template>
  <div>
    <GroupedLanguageManager
      ref="groupedManagerRef"
      title="标签管理"
      :get-list="getTagList"
    >
      <template #source="{ row, sourceSnapshot, primaryEntry }">
        <div class="space-y-1">
          <div class="font-medium">
            #{{
              sourceSnapshot?.tagname || primaryEntry?.tagname || row.sourceId
            }}
          </div>
          <div class="text-xs text-gray-500">sourceId: {{ row.sourceId }}</div>
          <SourceSnapshotPreview :snapshot="sourceSnapshot" />
        </div>
      </template>

      <template #language="{ entry }">
        <div v-if="entry" class="space-y-2">
          <div class="font-medium truncate">#{{ entry.tagname || '-' }}</div>
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
              #{{ sourceSnapshot?.tagname || row.sourceId }}
            </div>
            <div class="text-xs text-gray-500 break-all">
              sourceId: {{ row.sourceId }}
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
                {{ getLangEntry(row, languageCode)?.tagname || '缺失' }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </GroupedLanguageManager>

    <el-dialog v-model="dialogVisible" title="编辑标签" width="400px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="标签名称">
          <el-input v-model="editForm.tagname" />
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
import { getTagList, updateTag } from '../api/taxonomy.js'
import GroupedLanguageManager from '../components/GroupedLanguageManager.vue'
import SourceSnapshotPreview from '../components/SourceSnapshotPreview.vue'
import {
  getTranslationStatusLabel,
  getTranslationStatusTagType
} from '../utils/translationStatus.js'

const LANGUAGE_CODES = ['en', 'jp', 'tw']

export default {
  name: 'TagList',
  components: { GroupedLanguageManager, SourceSnapshotPreview },
  setup() {
    const groupedManagerRef = ref(null)
    const saving = ref(false)
    const dialogVisible = ref(false)
    const currentId = ref('')
    const editForm = reactive({ tagname: '' })

    function openEdit(entry) {
      currentId.value = entry._id
      editForm.tagname = entry.tagname || ''
      dialogVisible.value = true
    }

    async function handleSave() {
      saving.value = true
      try {
        await updateTag(currentId.value, { tagname: editForm.tagname })
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
      getTagList,
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
