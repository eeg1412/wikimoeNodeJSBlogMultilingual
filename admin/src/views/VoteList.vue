<template>
  <div>
    <GroupedLanguageManager
      ref="groupedManagerRef"
      title="投票管理"
      :get-list="getVoteList"
    >
      <template #source="{ row, sourceSnapshot, primaryEntry }">
        <div class="space-y-1">
          <div class="font-medium">
            {{ sourceSnapshot?.title || primaryEntry?.title || row.sourceId }}
          </div>
          <div class="text-xs text-gray-500">
            源选项数：{{
              sourceSnapshot?.options?.length ||
              primaryEntry?.options?.length ||
              0
            }}
          </div>
          <SourceSnapshotPreview :snapshot="sourceSnapshot" />
        </div>
      </template>

      <template #language="{ entry }">
        <div v-if="entry" class="space-y-2">
          <div class="font-medium truncate">{{ entry.title || '-' }}</div>
          <div class="text-xs text-gray-500">
            选项数：{{ entry.options?.length || 0 }}
          </div>
          <div class="text-xs text-gray-500 line-clamp-2">
            {{ formatVoteOptions(entry.options) }}
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
            <div class="text-xs text-gray-500">
              源选项数：{{ sourceSnapshot?.options?.length || 0 }}
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

    <el-dialog v-model="dialogVisible" title="编辑投票" width="560px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="标题">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="选项">
          <div
            v-for="(opt, index) in editForm.options"
            :key="opt.sourceOptionId || index"
            class="flex gap-2 mb-2"
          >
            <el-input
              v-model="opt.title"
              :placeholder="'选项 ' + (index + 1)"
            />
          </div>
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
import { getVoteList, updateVote } from '../api/entity.js'
import GroupedLanguageManager from '../components/GroupedLanguageManager.vue'
import SourceSnapshotPreview from '../components/SourceSnapshotPreview.vue'
import {
  getTranslationStatusLabel,
  getTranslationStatusTagType
} from '../utils/translationStatus.js'

const LANGUAGE_CODES = ['en', 'jp', 'tw']

export default {
  name: 'VoteList',
  components: { GroupedLanguageManager, SourceSnapshotPreview },
  setup() {
    const groupedManagerRef = ref(null)
    const saving = ref(false)
    const dialogVisible = ref(false)
    const currentId = ref('')
    const editForm = reactive({ title: '', options: [] })

    function openEdit(entry) {
      currentId.value = entry._id
      editForm.title = entry.title || ''
      editForm.options = (entry.options || []).map(option => ({
        title: option.title || '',
        sourceOptionId: option.sourceOptionId
      }))
      dialogVisible.value = true
    }

    async function handleSave() {
      saving.value = true
      try {
        await updateVote(currentId.value, {
          title: editForm.title,
          options: editForm.options
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

    function formatVoteOptions(options) {
      if (!Array.isArray(options) || options.length === 0) {
        return '暂无选项'
      }

      return options
        .map(option => option.title || option.sourceOptionId || '')
        .filter(Boolean)
        .slice(0, 3)
        .join(' / ')
    }

    return {
      groupedManagerRef,
      getVoteList,
      saving,
      dialogVisible,
      editForm,
      languageCodes: LANGUAGE_CODES,
      openEdit,
      handleSave,
      formatVoteOptions,
      getTranslationStatusLabel,
      getTranslationStatusTagType
    }
  }
}
</script>
