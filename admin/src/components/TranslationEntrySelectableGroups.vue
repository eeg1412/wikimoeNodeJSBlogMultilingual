<template>
  <div class="translation-entry-selectable-groups">
    <div
      v-for="group in groups"
      :key="group.label"
      class="translation-json-group"
    >
      <div class="translation-json-group-header">
        <div class="translation-json-group-heading">
          <div
            v-if="group.meta?.eyebrow"
            class="translation-json-group-eyebrow"
          >
            {{ group.meta.eyebrow }}
          </div>
          <div class="translation-json-group-title-row">
            <el-checkbox
              class="translation-json-group-select"
              :model-value="getGroupSelectionState(group).checked"
              :indeterminate="getGroupSelectionState(group).indeterminate"
              :disabled="disabled || getGroupEntryIds(group).length === 0"
              :aria-label="`${getGroupTitle(group)} 全选`"
              @change="checked => setGroupSelected(group, checked)"
            />
            <div class="translation-json-group-title">
              {{ getGroupTitle(group) }}
            </div>
          </div>
        </div>
        <div class="translation-json-group-count">
          {{ group.entries.length }} 项
        </div>
      </div>
      <div class="translation-json-entry-list">
        <el-checkbox
          v-for="entry in group.entries"
          :key="entry.id"
          :model-value="isEntrySelected(entry)"
          :disabled="disabled"
          class="translation-json-entry"
          @change="checked => setEntrySelected(entry, checked)"
        >
          <TranslationEntryMeta :entry="entry" :show-subtitle="false" />
          <TranslationEntryPreviewRows
            :entry="entry"
            :current-label="currentPreviewLabel"
            :source-label="sourcePreviewLabel"
            :next-label="nextPreviewLabel"
          />
        </el-checkbox>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import TranslationEntryMeta from '@/components/TranslationEntryMeta.vue'
import TranslationEntryPreviewRows from '@/components/TranslationEntryPreviewRows.vue'

function getEntryId(entry) {
  return entry?.id ? String(entry.id) : ''
}

export default {
  name: 'TranslationEntrySelectableGroups',
  components: {
    TranslationEntryMeta,
    TranslationEntryPreviewRows
  },
  props: {
    groups: {
      type: Array,
      default() {
        return []
      }
    },
    modelValue: {
      type: Array,
      default() {
        return []
      }
    },
    disabled: {
      type: Boolean,
      default: false
    },
    currentPreviewLabel: {
      type: String,
      default: '当前语言下的内容'
    },
    sourcePreviewLabel: {
      type: String,
      default: '源内容'
    },
    nextPreviewLabel: {
      type: String,
      default: '新内容'
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const selectedIdSet = computed(() => {
      return new Set(props.modelValue.map(id => String(id)))
    })

    function getGroupTitle(group) {
      return group?.meta?.title || group?.label || '未命名分组'
    }

    function getGroupEntryIds(group) {
      return (group?.entries || []).map(getEntryId).filter(Boolean)
    }

    function updateSelectedIds(nextIdSet) {
      const sourceOrder = []
      props.groups.forEach(group => {
        ;(group.entries || []).forEach(entry => {
          const id = getEntryId(entry)
          if (id) {
            sourceOrder.push(id)
          }
        })
      })

      const orderedSelectedIds = sourceOrder.filter(id => nextIdSet.has(id))
      const externalSelectedIds = props.modelValue
        .map(id => String(id))
        .filter(id => nextIdSet.has(id) && !sourceOrder.includes(id))

      emit('update:modelValue', orderedSelectedIds.concat(externalSelectedIds))
    }

    function isEntrySelected(entry) {
      const id = getEntryId(entry)
      return Boolean(id && selectedIdSet.value.has(id))
    }

    function setEntrySelected(entry, checked) {
      const id = getEntryId(entry)
      if (!id) {
        return
      }
      const nextIdSet = new Set(selectedIdSet.value)
      if (checked) {
        nextIdSet.add(id)
      } else {
        nextIdSet.delete(id)
      }
      updateSelectedIds(nextIdSet)
    }

    function getGroupSelectedCount(group) {
      return getGroupEntryIds(group).filter(id => selectedIdSet.value.has(id))
        .length
    }

    function getGroupSelectionState(group) {
      const groupIdList = getGroupEntryIds(group)
      if (groupIdList.length === 0) {
        return {
          checked: false,
          indeterminate: false
        }
      }

      const selectedCount = getGroupSelectedCount(group)
      return {
        checked:
          selectedCount === groupIdList.length &&
          groupIdList.every(id => selectedIdSet.value.has(id)),
        indeterminate:
          selectedCount > 0 && selectedCount < groupIdList.length
      }
    }

    function isGroupAllSelected(group) {
      return getGroupSelectionState(group).checked
    }

    function isGroupIndeterminate(group) {
      return getGroupSelectionState(group).indeterminate
    }

    function setGroupSelected(group, checked) {
      const nextIdSet = new Set(selectedIdSet.value)
      getGroupEntryIds(group).forEach(id => {
        if (checked) {
          nextIdSet.add(id)
          return
        }
        nextIdSet.delete(id)
      })
      updateSelectedIds(nextIdSet)
    }

    return {
      getGroupEntryIds,
      getGroupSelectionState,
      getGroupTitle,
      currentPreviewLabel: props.currentPreviewLabel,
      isEntrySelected,
      isGroupAllSelected,
      isGroupIndeterminate,
      nextPreviewLabel: props.nextPreviewLabel,
      setEntrySelected,
      setGroupSelected,
      sourcePreviewLabel: props.sourcePreviewLabel
    }
  }
}
</script>

<style scoped>
.translation-json-group {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  padding: 16px;
  background: var(--el-bg-color);
}

.translation-json-group-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.translation-json-group-heading {
  flex: 1;
  min-width: 0;
}

.translation-json-group-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.translation-json-group-select {
  flex: 0 0 auto;
  height: 22px;
}

.translation-json-group-select :deep(.el-checkbox__input) {
  display: inline-flex;
  align-items: center;
}

.translation-json-group-eyebrow {
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-color-primary);
}

.translation-json-group-title {
  min-width: 0;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.translation-json-group-count {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 4px 10px;
  min-height: 24px;
  color: var(--el-color-primary-dark-2);
  font-size: 12px;
  font-weight: 600;
}

.translation-json-entry-list {
  display: grid;
  gap: 0;
}

.translation-json-entry {
  width: 100%;
  margin-right: 0;
  align-items: flex-start;
  padding: 10px 0;
}

.translation-json-entry + .translation-json-entry {
  border-top: 1px dashed var(--el-border-color-lighter);
}

.translation-json-entry :deep(.el-checkbox__label) {
  width: 100%;
  padding-left: 12px;
}

.translation-json-entry :deep(.el-checkbox__input) {
  margin-top: 4px;
}

@media (max-width: 767px) {
  .translation-json-group-header {
    flex-direction: column;
  }

  .translation-json-group-count {
    align-self: flex-start;
  }
}
</style>
