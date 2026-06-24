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
        <template v-for="unit in getGroupDisplayUnits(group)" :key="unit.key">
          <el-checkbox
            v-if="!unit.merged"
            :model-value="isEntrySelected(unit.primaryEntry)"
            :disabled="disabled"
            class="translation-json-entry"
            @change="checked => setEntrySelected(unit.primaryEntry, checked)"
          >
            <TranslationEntryMeta
              :entry="unit.primaryEntry"
              :show-subtitle="false"
            />
            <div
              v-if="showAdoptionInfo && unit.primaryEntry.isApplied"
              class="translation-json-entry-adoption"
            >
              <el-tag size="small" type="success" effect="plain">
                已采纳
              </el-tag>
              <span class="translation-json-entry-adoption-text">
                采纳时间：{{ formatAdoptionTime(unit.primaryEntry.appliedAt) }}
              </span>
              <span class="translation-json-entry-adoption-text">
                采纳人：{{ getAppliedByText(unit.primaryEntry) }}
              </span>
            </div>
            <TranslationEntryPreviewRows
              :entry="unit.primaryEntry"
              :current-label="currentPreviewLabel"
              :source-label="sourcePreviewLabel"
              :next-label="nextPreviewLabel"
            />
          </el-checkbox>
          <div
            v-else
            class="translation-json-entry translation-json-entry-merged"
          >
            <el-checkbox
              :model-value="isUnitSelected(unit)"
              :indeterminate="isUnitIndeterminate(unit)"
              :disabled="disabled"
              class="translation-json-entry-merged-head"
              @change="checked => setUnitSelected(unit, checked)"
            >
              <TranslationEntryMeta
                :entry="unit.primaryEntry"
                :show-subtitle="false"
              />
              <span class="translation-json-entry-merged-count">
                共 {{ unit.entries.length }} 项 · 整组翻译
              </span>
            </el-checkbox>
            <div class="translation-json-entry-merged-members">
              <div
                v-for="member in unit.entries"
                :key="member.id"
                class="translation-json-entry-member"
              >
                <div class="translation-json-entry-member-title">
                  {{ member.fieldLabel || member.label }}
                </div>
                <div
                  v-if="showAdoptionInfo && member.isApplied"
                  class="translation-json-entry-adoption"
                >
                  <el-tag size="small" type="success" effect="plain">
                    已采纳
                  </el-tag>
                  <span class="translation-json-entry-adoption-text">
                    采纳时间：{{ formatAdoptionTime(member.appliedAt) }}
                  </span>
                  <span class="translation-json-entry-adoption-text">
                    采纳人：{{ getAppliedByText(member) }}
                  </span>
                </div>
                <TranslationEntryPreviewRows
                  :entry="member"
                  :current-label="currentPreviewLabel"
                  :source-label="sourcePreviewLabel"
                  :next-label="nextPreviewLabel"
                />
              </div>
            </div>
          </div>
        </template>
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

// 判断条目是否属于“按 index 拆分的数组型字段元素”（label / urlList / options）。
function isArrayFieldEntry(entry) {
  return (
    Number.isInteger(Number(entry?.labelIndex)) ||
    Number.isInteger(Number(entry?.urlIndex)) ||
    Number.isInteger(Number(entry?.optionIndex))
  )
}

// 数组型字段（label / urlList / options）元素条目的“字段级分组键”（不含 index）。直接由条目自身的
// 业务字段（scope / 关联字段 / 集合 / 记录 / 字段名）拼成，不解析 id 字符串。同一记录同一字段的
// 全部元素共享该键，用于把它们合并成一个整组单元。
function getEntryArrayFieldKey(entry) {
  if (!isArrayFieldEntry(entry)) {
    return ''
  }
  const recordId = String(entry?.recordId || entry?.sourceId || '')
  return [
    entry?.scope || '',
    entry?.relationField || '',
    entry?.collectionName || '',
    recordId,
    entry?.fieldName || ''
  ].join('|')
}

// 去掉标签里的 “ #数字” 序号后缀，作为整组单元的字段标题（仅影响展示文案，不解析 id）。
function stripEntryIndexSuffix(text) {
  const value = String(text || '')
  const markerIndex = value.lastIndexOf(' #')
  if (markerIndex === -1) {
    return value
  }
  const suffix = value.slice(markerIndex + 2)
  if (suffix.length > 0 && Number.isInteger(Number(suffix))) {
    return value.slice(0, markerIndex)
  }
  return value
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
    },
    showAdoptionInfo: {
      type: Boolean,
      default: false
    },
    beforeEntrySelect: {
      type: Function,
      default: null
    },
    beforeGroupSelect: {
      type: Function,
      default: null
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

    // 把分组内的条目转换为“显示单元”：数组型字段（label / urlList / options）的全部元素合并成
    // 一个整组单元（一个勾选框管理整组），其它字段维持一条一个单元。顺序按首次出现保持不变。
    function getGroupDisplayUnits(group) {
      const units = []
      const arrayUnitMap = new Map()
      ;(group?.entries || []).forEach(entry => {
        const arrayKey = getEntryArrayFieldKey(entry)
        if (!arrayKey) {
          units.push({
            key: getEntryId(entry),
            merged: false,
            primaryEntry: entry,
            entries: [entry],
            entryIds: [getEntryId(entry)].filter(Boolean)
          })
          return
        }
        if (!arrayUnitMap.has(arrayKey)) {
          const primaryEntry = {
            ...entry,
            label: stripEntryIndexSuffix(entry.label),
            fieldLabel: stripEntryIndexSuffix(entry.fieldLabel)
          }
          const unit = {
            key: `array:${arrayKey}`,
            merged: true,
            primaryEntry,
            entries: [],
            entryIds: []
          }
          arrayUnitMap.set(arrayKey, unit)
          units.push(unit)
        }
        const unit = arrayUnitMap.get(arrayKey)
        unit.entries.push(entry)
        const id = getEntryId(entry)
        if (id) {
          unit.entryIds.push(id)
        }
      })
      return units
    }

    function isUnitSelected(unit) {
      if (!unit || unit.entryIds.length === 0) {
        return false
      }
      return unit.entryIds.every(id => selectedIdSet.value.has(id))
    }

    function isUnitIndeterminate(unit) {
      if (!unit || unit.entryIds.length === 0) {
        return false
      }
      const selectedCount = unit.entryIds.filter(id =>
        selectedIdSet.value.has(id)
      ).length
      return selectedCount > 0 && selectedCount < unit.entryIds.length
    }

    async function setUnitSelected(unit, checked) {
      if (!unit || unit.entryIds.length === 0) {
        return
      }
      if (
        checked &&
        typeof props.beforeEntrySelect === 'function' &&
        (await props.beforeEntrySelect({
          entry: unit.primaryEntry,
          checked
        })) === false
      ) {
        return
      }
      const nextIdSet = new Set(selectedIdSet.value)
      unit.entryIds.forEach(id => {
        if (checked) {
          nextIdSet.add(id)
          return
        }
        nextIdSet.delete(id)
      })
      updateSelectedIds(nextIdSet)
    }

    async function setEntrySelected(entry, checked) {
      const id = getEntryId(entry)
      if (!id) {
        return
      }
      if (
        checked &&
        typeof props.beforeEntrySelect === 'function' &&
        (await props.beforeEntrySelect({ entry, checked })) === false
      ) {
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
        indeterminate: selectedCount > 0 && selectedCount < groupIdList.length
      }
    }

    function isGroupAllSelected(group) {
      return getGroupSelectionState(group).checked
    }

    function isGroupIndeterminate(group) {
      return getGroupSelectionState(group).indeterminate
    }

    async function setGroupSelected(group, checked) {
      const pendingEntryList = checked
        ? (group?.entries || []).filter(entry => {
            const id = getEntryId(entry)
            return Boolean(id && !selectedIdSet.value.has(id))
          })
        : []
      if (
        checked &&
        typeof props.beforeGroupSelect === 'function' &&
        (await props.beforeGroupSelect({
          group,
          checked,
          entries: pendingEntryList
        })) === false
      ) {
        return
      }
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

    function formatAdoptionTime(value) {
      if (!value) {
        return '-'
      }
      return new Date(value).toLocaleString()
    }

    function getAppliedByText(entry) {
      if (entry?.appliedByName) {
        return entry.appliedByName
      }
      const appliedBy = entry?.appliedBy || {}
      return appliedBy.displayName || appliedBy.username || '-'
    }

    return {
      formatAdoptionTime,
      getAppliedByText,
      getGroupDisplayUnits,
      getGroupEntryIds,
      getGroupSelectionState,
      getGroupTitle,
      currentPreviewLabel: props.currentPreviewLabel,
      isEntrySelected,
      isGroupAllSelected,
      isGroupIndeterminate,
      isUnitIndeterminate,
      isUnitSelected,
      nextPreviewLabel: props.nextPreviewLabel,
      setEntrySelected,
      setGroupSelected,
      setUnitSelected,
      showAdoptionInfo: props.showAdoptionInfo,
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

/* 数组型字段整组单元：一个勾选框管理整组，组内各元素只读展示。 */
.translation-json-entry-merged {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.translation-json-entry-merged-head {
  width: 100%;
  margin-right: 0;
  align-items: flex-start;
  height: auto;
}

.translation-json-entry-merged-head :deep(.el-checkbox__label) {
  width: 100%;
  padding-left: 12px;
}

.translation-json-entry-merged-head :deep(.el-checkbox__input) {
  margin-top: 4px;
}

.translation-json-entry-merged-count {
  display: inline-block;
  margin-top: 4px;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
}

.translation-json-entry-merged-members {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 24px;
  box-sizing: border-box;
  width: 100%;
}

.translation-json-entry-member {
  padding: 8px 0;
}

.translation-json-entry-member + .translation-json-entry-member {
  border-top: 1px dashed var(--el-border-color-lighter);
}

.translation-json-entry-member-title {
  margin-bottom: 6px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.translation-json-entry-adoption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.translation-json-entry-adoption-text {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
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
