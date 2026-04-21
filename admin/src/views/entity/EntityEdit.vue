<template>
  <div class="entity-edit-page" v-loading="loading">
    <div class="entity-edit-header">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: `/entity/${type}/list` }">
          {{ meta.label }}
        </el-breadcrumb-item>
        <el-breadcrumb-item>编辑</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="entity-edit-actions">
        <el-tag size="small" :type="translationTagType(form.translationStatus)">
          {{ form.translationStatus }}
        </el-tag>
        <el-tag size="small" style="margin-left: 6px">
          {{ form.languageCode }}
        </el-tag>
        <el-button
          size="small"
          type="warning"
          :loading="translating"
          @click="translateAll"
          style="margin-left: 8px"
          >AI 翻译全部</el-button
        >
        <el-button
          size="small"
          type="success"
          :loading="saving"
          @click="save"
          style="margin-left: 8px"
          >保存</el-button
        >
        <el-button
          size="small"
          type="primary"
          @click="approve"
          :disabled="form.translationStatus === 'approved'"
          style="margin-left: 8px"
          >批准 (approved)</el-button
        >
      </div>
    </div>

    <el-row :gutter="16" v-if="doc">
      <el-col :span="14">
        <el-card shadow="never" class="entity-edit-card">
          <template #header>译文编辑</template>

          <template v-if="!meta.isRelated">
            <el-form label-width="100px">
              <el-form-item
                v-for="f in editableFields"
                :key="f.key"
                :label="f.label"
              >
                <el-input
                  v-if="f.type === 'textarea'"
                  v-model="form[f.key]"
                  type="textarea"
                  :rows="4"
                />
                <el-input-number
                  v-else-if="f.type === 'number'"
                  v-model="form[f.key]"
                  :step="1"
                  controls-position="right"
                />
                <el-input v-else v-model="form[f.key]" />
                <el-button
                  v-if="f.translatable"
                  size="small"
                  link
                  type="warning"
                  style="margin-left: 8px"
                  @click="translateOne(f.key)"
                  >翻译此字段</el-button
                >
              </el-form-item>
              <el-form-item v-if="type === 'author'" label="头像附件">
                <AttachmentFieldPicker
                  v-model="form.photoAttachment"
                  :language-code="form.languageCode"
                />
              </el-form-item>
              <el-form-item v-if="type === 'author'" label="封面附件">
                <AttachmentFieldPicker
                  v-model="form.coverAttachment"
                  :language-code="form.languageCode"
                />
              </el-form-item>
            </el-form>
          </template>

          <template v-else>
            <!-- related 类型：遍历 translatableFields，对应 payload.xxx -->
            <el-form label-width="140px">
              <el-form-item
                v-for="path in relatedTranslatableFields"
                :key="path"
                :label="path"
              >
                <el-input
                  v-model="relatedEditable[path]"
                  :type="isLongPath(path) ? 'textarea' : 'text'"
                  :rows="isLongPath(path) ? 4 : undefined"
                />
                <el-button
                  size="small"
                  link
                  type="warning"
                  style="margin-left: 8px"
                  @click="translateOne('payload.' + path)"
                  >翻译此字段</el-button
                >
              </el-form-item>
              <!-- 投票：选项文本 -->
              <template v-if="type === 'vote' && Array.isArray(doc.options)">
                <el-form-item
                  v-for="(op, idx) in voteOptions"
                  :key="'opt-' + idx"
                  :label="`选项 #${idx + 1}`"
                >
                  <el-input v-model="voteOptions[idx].title" />
                  <el-button
                    size="small"
                    link
                    type="warning"
                    style="margin-left: 8px"
                    @click="translateOne('options.' + idx + '.title')"
                    >翻译</el-button
                  >
                </el-form-item>
              </template>
            </el-form>
          </template>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never" class="entity-edit-card">
          <template #header>原始快照（只读）</template>
          <pre class="entity-edit-snapshot">{{ snapshotText }}</pre>
        </el-card>
        <el-card
          shadow="never"
          class="entity-edit-card"
          style="margin-top: 12px"
        >
          <template #header>元信息</template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="_id">{{
              doc._id
            }}</el-descriptions-item>
            <el-descriptions-item label="sourceId">{{
              doc.sourceId
            }}</el-descriptions-item>
            <el-descriptions-item label="sourceHash">{{
              doc.sourceHash
            }}</el-descriptions-item>
            <el-descriptions-item label="更新">
              {{ formatTime(doc.updatedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="手工编辑">
              {{ doc.isManualEdited ? '是' : '否' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getEntityDetailApi,
  updateEntityApi,
  approveEntityApi,
  translateEntityApi
} from '@/api/entity'
import AttachmentFieldPicker from '@/components/AttachmentFieldPicker.vue'
import {
  ENTITY_TYPE_MAP,
  ENTITY_EDITABLE_FIELDS,
  translationTagType
} from '@/utils/entityMeta'

const LONG_PATHS = /(description|summary|content|intro|remark)/i

export default {
  name: 'EntityEdit',
  components: { AttachmentFieldPicker },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const type = computed(() => route.params.type)
    const id = computed(() => route.params.id)
    const meta = computed(() => ENTITY_TYPE_MAP[type.value] || {})
    const editableFields = computed(
      () => ENTITY_EDITABLE_FIELDS[type.value] || []
    )

    const doc = ref(null)
    const form = reactive({})
    const relatedEditable = reactive({})
    const voteOptions = ref([])
    const loading = ref(false)
    const saving = ref(false)
    const translating = ref(false)

    const relatedTranslatableFields = computed(() => {
      if (!doc.value || !Array.isArray(doc.value.translatableFields)) return []
      return doc.value.translatableFields
    })
    const snapshotText = computed(() =>
      doc.value && doc.value.sourceSnapshot
        ? JSON.stringify(doc.value.sourceSnapshot, null, 2)
        : '(无快照)'
    )

    function isLongPath(p) {
      return LONG_PATHS.test(p || '')
    }

    function resetForm() {
      Object.keys(form).forEach(k => delete form[k])
      Object.keys(relatedEditable).forEach(k => delete relatedEditable[k])
      voteOptions.value = []
    }

    function fillForm(d) {
      resetForm()
      form._id = d._id
      form.languageCode = d.languageCode
      form.translationStatus = d.translationStatus
      if (meta.value.isRelated) {
        const payload = d.payload || {}
        for (const path of d.translatableFields || []) {
          const parts = path.split('.')
          let cur = payload
          for (const p of parts) {
            cur = cur == null ? undefined : cur[p]
          }
          relatedEditable[path] =
            typeof cur === 'string' ? cur : cur == null ? '' : String(cur)
        }
        if (type.value === 'vote' && Array.isArray(d.options)) {
          voteOptions.value = d.options.map(o => ({
            sourceOptionId: o.sourceOptionId,
            title: o.title || '',
            sort: o.sort
          }))
        }
      } else {
        for (const f of editableFields.value) {
          form[f.key] = d[f.key] != null ? d[f.key] : ''
        }
        if (type.value === 'author') {
          form.photoAttachment = d.photoAttachment
            ? typeof d.photoAttachment === 'object'
              ? d.photoAttachment._id
              : d.photoAttachment
            : null
          form.coverAttachment = d.coverAttachment
            ? typeof d.coverAttachment === 'object'
              ? d.coverAttachment._id
              : d.coverAttachment
            : null
        }
      }
    }

    async function load() {
      loading.value = true
      try {
        const resp = await getEntityDetailApi(type.value, id.value)
        doc.value = (resp && resp.data) || null
        if (doc.value) fillForm(doc.value)
      } finally {
        loading.value = false
      }
    }

    function buildUpdatePayload() {
      if (meta.value.isRelated) {
        // 组装 payload：先克隆现有 payload，再按路径写回
        const payload = JSON.parse(JSON.stringify(doc.value.payload || {}))
        for (const path of relatedTranslatableFields.value) {
          const parts = path.split('.')
          let cur = payload
          for (let i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') {
              cur[parts[i]] = {}
            }
            cur = cur[parts[i]]
          }
          cur[parts[parts.length - 1]] = relatedEditable[path]
        }
        return { _id: form._id, payload }
      }
      const out = { _id: form._id }
      for (const f of editableFields.value) {
        out[f.key] = form[f.key]
      }
      if (type.value === 'author') {
        out.photoAttachment = form.photoAttachment || null
        out.coverAttachment = form.coverAttachment || null
      }
      return out
    }

    async function save() {
      saving.value = true
      try {
        const payload = buildUpdatePayload()
        // vote 选项文本只读后台修订：暂不走 relatedEntityUpdateSchema.payload，
        // 这里作为单独 options 写入（后端 relatedEntityUpdateSchema 仅支持 payload，
        // 因此选项文本通过后续 AI 翻译 + options.x.title 路径写入时走 translate 分支）
        await updateEntityApi(type.value, payload)
        ElMessage.success('已保存')
        await load()
      } finally {
        saving.value = false
      }
    }

    async function approve() {
      await approveEntityApi(type.value, id.value)
      ElMessage.success('已批准')
      await load()
    }

    async function translateOne(fieldPath) {
      translating.value = true
      try {
        await translateEntityApi(type.value, id.value, [fieldPath])
        ElMessage.success('AI 翻译完成')
        await load()
      } finally {
        translating.value = false
      }
    }

    async function translateAll() {
      translating.value = true
      try {
        await translateEntityApi(type.value, id.value, undefined)
        ElMessage.success('AI 翻译完成')
        await load()
      } finally {
        translating.value = false
      }
    }

    function formatTime(v) {
      if (!v) return ''
      try {
        return new Date(v).toLocaleString()
      } catch (_) {
        return String(v)
      }
    }

    onMounted(load)
    watch(
      () => route.params.id,
      () => {
        if (route.params.type && route.params.id) load()
      }
    )

    return {
      type,
      meta,
      doc,
      form,
      relatedEditable,
      voteOptions,
      relatedTranslatableFields,
      editableFields,
      snapshotText,
      loading,
      saving,
      translating,
      save,
      approve,
      translateOne,
      translateAll,
      isLongPath,
      formatTime,
      translationTagType
    }
  }
}
</script>

<style scoped>
.entity-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.entity-edit-actions {
  display: flex;
  align-items: center;
}
.entity-edit-card {
  margin-bottom: 0;
}
.entity-edit-snapshot {
  max-height: 400px;
  overflow: auto;
  background: #f7f7f9;
  padding: 8px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
