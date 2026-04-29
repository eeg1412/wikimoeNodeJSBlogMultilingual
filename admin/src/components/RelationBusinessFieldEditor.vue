<template>
  <el-form-item v-for="field in fields" :key="field.name" :label="field.label">
    <el-switch v-if="field.type === 'boolean'" v-model="form[field.name]" />
    <el-input-number
      v-else-if="field.type === 'number'"
      v-model="form[field.name]"
      controls-position="right"
      style="width: 180px"
    />
    <el-color-picker
      v-else-if="field.type === 'color'"
      v-model="form[field.name]"
    />
    <div v-else-if="field.type === 'parentRelation'" class="parent-relation">
      <div class="parent-relation-current">
        <div
          v-if="getParentRelationId(field)"
          class="parent-relation-color-block"
          :style="getParentRelationBlockStyle(field)"
        >
          {{ getParentRelationName(field) }}
        </div>
        <span v-else class="cGray666">未关联父级</span>
        <el-button
          size="small"
          type="primary"
          :icon="EditPen"
            <el-form-item
              v-for="field in visibleFields"
              :key="field.name"
              :label="field.label"
            >
          :disabled="!getParentRelationId(field)"
          @click="openParentEditor(field)"
        >
          快捷编辑父级
        </el-button>
      </div>
    </div>
    <RichEditor5
      v-else-if="field.type === 'richText'"
      class="relation-rich-editor"
      v-model:content="form[field.name]"
      :language-code="languageCode"
    />
    <el-input
      v-else-if="field.type === 'textarea'"
      v-model="form[field.name]"
      type="textarea"
      :rows="4"
    />
    <el-input v-else v-model="form[field.name]" clearable />
  </el-form-item>

  <el-dialog
    v-model="parentEditVisible"
    :title="parentEditTitle"
    width="min(520px, 94vw)"
    align-center
    destroy-on-close
    append-to-body
  >
    <el-form :model="parentEditForm" label-width="90px" @submit.prevent>
      <el-form-item
        v-for="field in parentEditFields"
        :key="field.name"
        :label="field.label"
      >
        <el-switch
          v-if="field.type === 'boolean'"
          v-model="parentEditForm[field.name]"
        />
        <el-input-number
          v-else-if="field.type === 'number'"
          v-model="parentEditForm[field.name]"
          controls-position="right"
          style="width: 180px"
        />
        <el-color-picker
          v-else-if="field.type === 'color'"
          v-model="parentEditForm[field.name]"
        />
        <el-input
          v-else-if="field.type === 'textarea'"
          v-model="parentEditForm[field.name]"
          type="textarea"
          :rows="4"
        />
        <el-input v-else v-model="parentEditForm[field.name]" clearable />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="parentEditVisible = false">取消</el-button>
      <el-button type="primary" :loading="parentSaving" @click="saveParentEdit">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { EditPen } from '@element-plus/icons-vue'
import { multilingualApi } from '@/api'
import RichEditor5 from '@/components/RichEditor5'
import {
  getRelationEditFields,
  getRelationFieldInitialValue,
  getRelationIdValue,
  getRelationOptionLabel,
  shouldSubmitRelationEditField
} from '@/utils/relationEditFields'

export default {
  name: 'RelationBusinessFieldEditor',
  components: {
    EditPen,
    RichEditor5
  },
  emits: ['parent-updated'],
  props: {
    fields: {
      type: Array,
      default() {
        return []
      }
    },
    form: {
      type: Object,
      required: true
    },
    languageCode: {
      type: String,
      default: ''
    },
    record: {
      type: Object,
      default: null
    }
  },
  setup(props, { emit }) {
    const parentRelationStateMap = reactive({})
    const parentEditVisible = ref(false)
    const parentSaving = ref(false)
    const parentEditField = ref(null)
    const parentEditRecord = ref(null)
    const parentEditForm = reactive({})

    const parentEditFields = computed(() => {
      if (!parentEditField.value) {
        return []
      }
      const fieldNames = parentEditField.value.parentEditableFieldNames || []
      return getRelationEditFields(
        parentEditField.value.relationCollectionName
      ).filter(field => {
        if (!shouldSubmitRelationEditField(field)) {
          return false
        }
        if (fieldNames.length === 0) {
          return true
        }
        return fieldNames.includes(field.name)
      })
    })

    const parentEditTitle = computed(() => {
      if (!parentEditField.value) {
        return '快捷编辑父级'
      }
      return `快捷编辑${parentEditField.value.label}`
    })

    function getParentRelationState(field) {
      if (!parentRelationStateMap[field.name]) {
        parentRelationStateMap[field.name] = {
          record: null,
          loading: false
        }
      }

      return parentRelationStateMap[field.name]
    }

    function getParentRelationValue(field) {
      return props.record?.[field.name]
    }

    function getParentRelationId(field) {
      return getRelationIdValue(getParentRelationValue(field))
    }

    function getParentRelationRecord(field) {
      const value = getParentRelationValue(field)
      if (value && typeof value === 'object' && value._id) {
        return value
      }

      return getParentRelationState(field).record
    }

    function getParentRelationName(field) {
      const parentRecord = getParentRelationRecord(field)
      if (parentRecord) {
        return getRelationOptionLabel(parentRecord)
      }

      return getParentRelationId(field) || '-'
    }

    function getParentRelationBlockStyle(field) {
      const parentRecord = getParentRelationRecord(field)
      return {
        backgroundColor: parentRecord?.color || 'var(--el-fill-color-dark)'
      }
    }

    function loadParentRelation(field) {
      const parentId = getParentRelationId(field)
      const value = getParentRelationValue(field)
      if (!field.relationCollectionName || !props.languageCode || !parentId) {
        return Promise.resolve(null)
      }

      const state = getParentRelationState(field)
      if (value && typeof value === 'object' && value._id) {
        state.record = value
        return Promise.resolve(value)
      }

      state.loading = true
      return multilingualApi
        .getTranslationRelationList(
          {
            collectionName: field.relationCollectionName,
            languageCode: props.languageCode,
            keyword: parentId,
            page: 1,
            limit: 1
          },
          true
        )
        .then(response => {
          state.record = response.data.data?.list?.[0] || null
          return state.record
        })
        .finally(() => {
          state.loading = false
        })
    }

    function openParentEditor(field) {
      loadParentRelation(field).then(parentRecord => {
        if (!parentRecord) {
          ElMessage.error('未找到父级内容')
          return
        }
        parentEditField.value = field
        parentEditRecord.value = parentRecord
        Object.keys(parentEditForm).forEach(key => {
          delete parentEditForm[key]
        })
        parentEditFields.value.forEach(item => {
          parentEditForm[item.name] = getRelationFieldInitialValue(
            item,
            parentRecord
          )
        })
        parentEditVisible.value = true
      })
    }

    function saveParentEdit() {
      if (!parentEditField.value || !parentEditRecord.value) {
        return
      }

      const payload = {}
      parentEditFields.value.forEach(field => {
        payload[field.name] = parentEditForm[field.name]
      })

      parentSaving.value = true
      multilingualApi
        .updateTranslationRelation({
          collectionName: parentEditField.value.relationCollectionName,
          id: parentEditRecord.value._id,
          languageCode: props.languageCode,
          payload
        })
        .then(response => {
          const updatedRecord = response.data.data
          getParentRelationState(parentEditField.value).record = updatedRecord
          emit('parent-updated', {
            field: parentEditField.value,
            parentRecord: updatedRecord
          })
          ElMessage.success('父级内容已保存')
          parentEditVisible.value = false
        })
        .finally(() => {
          parentSaving.value = false
        })
    }

    watch(
      () =>
        `${props.languageCode}:${props.fields
          .map(field => {
            return `${field.name}:${field.relationCollectionName || ''}:${getParentRelationId(field) || ''}`
          })
          .join('|')}`,
      () => {
        props.fields.forEach(field => {
          if (field.type === 'parentRelation') {
            loadParentRelation(field)
          }
        })
      },
      { immediate: true }
    )

    return {
      EditPen,
      getRelationOptionLabel,
      getParentRelationId,
      getParentRelationBlockStyle,
      getParentRelationName,
      getParentRelationState,
      openParentEditor,
      parentEditFields,
      parentEditForm,
      parentEditTitle,
      parentEditVisible,
      parentSaving,
      saveParentEdit
    }
  }
}
</script>

<style scoped>
.relation-rich-editor {
  width: 100%;
  min-width: 0;
}

.parent-relation {
  width: 100%;
}

.parent-relation-current {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.parent-relation-color-block {
  display: inline-block;
  max-width: min(360px, 100%);
  padding: 2px 6px;
  overflow: hidden;
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
