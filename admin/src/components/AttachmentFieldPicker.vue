<template>
  <div class="attachment-field-picker">
    <div class="attachment-field-picker-list">
      <div
        v-for="item in resolved"
        :key="item._id"
        class="attachment-field-picker-item"
      >
        <div class="attachment-field-picker-thumb">
          <img
            v-if="isImage(item)"
            :src="resolveUrl(item)"
            :alt="item.name || item.filename"
            loading="lazy"
          />
          <span v-else class="attachment-field-picker-placeholder">
            {{ (item.mimetype || 'file').split('/')[0] }}
          </span>
        </div>
        <div class="attachment-field-picker-meta">
          <div class="attachment-field-picker-name">
            {{ item.name || item.filename || '未命名' }}
          </div>
          <el-button link type="danger" size="small" @click="remove(item._id)">
            移除
          </el-button>
        </div>
      </div>
      <el-button class="attachment-field-picker-add" @click="openDialog">
        + 选择附件
      </el-button>
    </div>
    <AttachmentsDialog
      ref="dialogRef"
      :language-code="languageCode"
      :multiple="multiple"
      @select="onSelect"
    />
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import AttachmentsDialog from './AttachmentsDialog.vue'
import { resolveAttachmentUrl } from '@/utils/attachmentUrl'
import { useSiteStore } from '@/store/site'
import http from '@/api/http'

export default {
  name: 'AttachmentFieldPicker',
  components: { AttachmentsDialog },
  props: {
    modelValue: { type: [String, Array], default: () => [] },
    languageCode: { type: String, default: '' },
    multiple: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const site = useSiteStore()
    const dialogRef = ref(null)
    const resolvedMap = ref({})

    const ids = computed(() => {
      if (props.multiple) {
        return Array.isArray(props.modelValue) ? props.modelValue : []
      }
      return props.modelValue ? [props.modelValue] : []
    })
    const resolved = computed(() =>
      ids.value.map(id => resolvedMap.value[id]).filter(Boolean)
    )

    async function loadMissing() {
      const missing = ids.value.filter(id => !resolvedMap.value[id])
      if (!missing.length) return
      try {
        const resp = await http.get('/attachments/list', {
          params: { ids: missing.join(','), limit: missing.length }
        })
        const list = (resp && resp.data && resp.data.list) || []
        const next = { ...resolvedMap.value }
        list.forEach(item => {
          next[item._id] = item
        })
        resolvedMap.value = next
      } catch (_) {}
    }

    function resolveUrl(item) {
      return resolveAttachmentUrl(item, site.sourceBlogPublicOrigin)
    }
    function isImage(item) {
      return (item.mimetype || '').indexOf('image/') === 0
    }

    function openDialog() {
      dialogRef.value && dialogRef.value.open()
    }
    function onSelect(list) {
      const next = { ...resolvedMap.value }
      list.forEach(item => {
        next[item._id] = item
      })
      resolvedMap.value = next
      if (props.multiple) {
        const existing = Array.isArray(props.modelValue)
          ? props.modelValue.slice()
          : []
        list.forEach(item => {
          if (!existing.includes(item._id)) existing.push(item._id)
        })
        emit('update:modelValue', existing)
      } else {
        emit('update:modelValue', list[0] ? list[0]._id : null)
      }
    }
    function remove(id) {
      if (props.multiple) {
        emit(
          'update:modelValue',
          (props.modelValue || []).filter(x => x !== id)
        )
      } else {
        emit('update:modelValue', null)
      }
    }

    watch(ids, loadMissing, { immediate: true })

    return {
      dialogRef,
      resolved,
      resolveUrl,
      isImage,
      openDialog,
      onSelect,
      remove
    }
  }
}
</script>

<style scoped>
.attachment-field-picker-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.attachment-field-picker-item {
  width: 140px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 4px;
  background: var(--el-fill-color-lighter);
}
.attachment-field-picker-thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color);
  border-radius: 3px;
  overflow: hidden;
}
.attachment-field-picker-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.attachment-field-picker-placeholder {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.attachment-field-picker-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 12px;
}
.attachment-field-picker-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary);
}
.attachment-field-picker-add {
  height: auto;
  min-width: 100px;
  padding: 24px 12px;
  border-style: dashed;
}
</style>
