<template>
  <div>
    <GroupedLanguageManager
      ref="groupedManagerRef"
      :title="title"
      :get-list="getList"
    >
      <template #source="{ row, primaryEntry, sourceSnapshot }">
        <div class="space-y-1">
          <div class="font-medium">
            {{ getSourceTitle(sourceSnapshot, primaryEntry, row) }}
          </div>
          <div class="text-xs text-gray-500 line-clamp-2">
            {{ getSourceDescription(sourceSnapshot, primaryEntry) }}
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <span>sourceId: {{ row.sourceId }}</span>
            <SourceSnapshotPreview :snapshot="sourceSnapshot" />
          </div>
        </div>
      </template>

      <template #language="{ entry }">
        <div v-if="entry" class="space-y-2">
          <div class="font-medium truncate">{{ entry.title || '-' }}</div>
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

      <template #mobile-card="{ row, sourceSnapshot, getLangEntry }">
        <div class="space-y-3">
          <div>
            <div class="font-medium break-all">
              {{ getSourceTitle(sourceSnapshot, null, row) }}
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
                {{ getLangEntry(row, languageCode)?.title || '缺失' }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </GroupedLanguageManager>

    <el-dialog v-model="dialogVisible" :title="'编辑 ' + title" width="520px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="标题">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="4" />
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
import GroupedLanguageManager from './GroupedLanguageManager.vue'
import SourceSnapshotPreview from './SourceSnapshotPreview.vue'
import {
  getTranslationStatusLabel,
  getTranslationStatusTagType
} from '../utils/translationStatus.js'

const LANGUAGE_CODES = ['en', 'jp', 'tw']

export default {
  name: 'EntityListBase',
  components: { GroupedLanguageManager, SourceSnapshotPreview },
  props: {
    title: { type: String, required: true },
    getList: { type: Function, required: true },
    update: { type: Function, required: true }
  },
  setup(props) {
    const groupedManagerRef = ref(null)
    const saving = ref(false)
    const dialogVisible = ref(false)
    const currentId = ref('')
    const editForm = reactive({ title: '', description: '' })

    function openEdit(entry) {
      currentId.value = entry._id
      editForm.title = entry.title || ''
      editForm.description = entry.description || ''
      dialogVisible.value = true
    }

    async function handleSave() {
      saving.value = true
      try {
        await props.update(currentId.value, {
          title: editForm.title,
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

    function getSourceTitle(sourceSnapshot, primaryEntry, row) {
      if (sourceSnapshot?.title) {
        return sourceSnapshot.title
      }
      if (sourceSnapshot?.name) {
        return sourceSnapshot.name
      }
      if (primaryEntry?.title) {
        return primaryEntry.title
      }
      if (row?.sourceId) {
        return row.sourceId
      }

      return row?.groupKey || '-'
    }

    function getSourceDescription(sourceSnapshot, primaryEntry) {
      if (sourceSnapshot?.description) {
        return sourceSnapshot.description
      }
      if (sourceSnapshot?.summary) {
        return sourceSnapshot.summary
      }
      if (primaryEntry?.description) {
        return primaryEntry.description
      }

      return '未展示完整源数据时，可点击“查看源数据”检查原始字段'
    }

    return {
      groupedManagerRef,
      saving,
      dialogVisible,
      editForm,
      languageCodes: LANGUAGE_CODES,
      openEdit,
      handleSave,
      getSourceTitle,
      getSourceDescription,
      getTranslationStatusLabel,
      getTranslationStatusTagType
    }
  }
}
</script>
