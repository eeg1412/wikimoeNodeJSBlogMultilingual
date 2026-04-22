<template>
  <div>
    <GroupedLanguageManager
      ref="groupedManagerRef"
      title="分类管理"
      :get-list="getSortList"
    >
      <template #source="{ row, sourceSnapshot, primaryEntry }">
        <div class="space-y-1">
          <div class="font-medium">
            {{
              sourceSnapshot?.sortname || primaryEntry?.sortname || row.sourceId
            }}
          </div>
          <div class="text-xs text-gray-500">
            alias: {{ sourceSnapshot?.alias || primaryEntry?.alias || '-' }} ·
            排序: {{ sourceSnapshot?.taxis || primaryEntry?.taxis || 0 }}
          </div>
          <div class="text-xs text-gray-500 line-clamp-2">
            {{
              sourceSnapshot?.description ||
              primaryEntry?.description ||
              '暂无源简介'
            }}
          </div>
          <SourceSnapshotPreview :snapshot="sourceSnapshot" />
        </div>
      </template>

      <template #language="{ entry }">
        <div v-if="entry" class="space-y-2">
          <div class="font-medium truncate">{{ entry.sortname || '-' }}</div>
          <div class="text-xs text-gray-500">
            alias: {{ entry.alias || '-' }} · 排序: {{ entry.taxis || 0 }}
          </div>
          <div class="text-xs text-gray-500 line-clamp-2">
            {{ entry.description || '暂无简介' }}
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
              {{ sourceSnapshot?.sortname || row.sourceId }}
            </div>
            <div class="text-xs text-gray-500 break-all">
              alias: {{ sourceSnapshot?.alias || '-' }}
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
                {{ getLangEntry(row, languageCode)?.sortname || '缺失' }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </GroupedLanguageManager>

    <el-dialog v-model="dialogVisible" title="编辑分类" width="520px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="分类名称">
          <el-input v-model="editForm.sortname" />
        </el-form-item>
        <el-form-item label="别名（URL Slug）">
          <el-input v-model="editForm.alias" placeholder="留空则不使用别名" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="editForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editForm.taxis" :min="0" />
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
import { getSortList, updateSort } from '../api/taxonomy.js'
import GroupedLanguageManager from '../components/GroupedLanguageManager.vue'
import SourceSnapshotPreview from '../components/SourceSnapshotPreview.vue'
import {
  getTranslationStatusLabel,
  getTranslationStatusTagType
} from '../utils/translationStatus.js'

const LANGUAGE_CODES = ['en', 'jp', 'tw']

export default {
  name: 'SortList',
  components: { GroupedLanguageManager, SourceSnapshotPreview },
  setup() {
    const groupedManagerRef = ref(null)
    const saving = ref(false)
    const dialogVisible = ref(false)
    const currentId = ref('')
    const editForm = reactive({
      sortname: '',
      alias: '',
      description: '',
      taxis: 0
    })

    function openEdit(entry) {
      currentId.value = entry._id
      editForm.sortname = entry.sortname || ''
      editForm.alias = entry.alias || ''
      editForm.description = entry.description || ''
      editForm.taxis = entry.taxis || 0
      dialogVisible.value = true
    }

    async function handleSave() {
      saving.value = true
      try {
        await updateSort(currentId.value, {
          sortname: editForm.sortname,
          alias: editForm.alias,
          description: editForm.description,
          taxis: editForm.taxis
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
      getSortList,
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
