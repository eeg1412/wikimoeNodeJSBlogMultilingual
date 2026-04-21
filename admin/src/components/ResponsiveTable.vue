<template>
  <el-table
    v-if="!isMobile"
    ref="elTableRef"
    v-bind="tableAttrs"
    :data="data"
    v-on="tableListeners"
  >
    <slot />
  </el-table>

  <div v-else class="responsive-table-mobile" ref="mobileContainerRef">
    <div
      v-if="hasSelection || sortableColumns.length > 0"
      class="responsive-table-mobile__toolbar"
    >
      <el-checkbox
        v-if="hasSelection"
        v-model="isAllSelected"
        :indeterminate="isIndeterminate"
        @change="handleSelectAll"
        class="responsive-table-mobile__select-all"
      >
        全选
      </el-checkbox>
      <div
        v-if="sortableColumns.length > 0"
        class="responsive-table-mobile__sort"
      >
        <el-select
          v-model="mobileSortProp"
          placeholder="排序字段"
          size="small"
          clearable
          style="width: 130px"
          @change="handleMobileSortChange"
        >
          <el-option
            v-for="col in sortableColumns"
            :key="col.columnId"
            :label="col.label"
            :value="col.prop"
          />
        </el-select>
        <el-button
          v-if="mobileSortProp"
          size="small"
          @click="toggleMobileSortOrder"
          class="responsive-table-mobile__sort-btn"
        >
          {{ mobileSortOrder === 'ascending' ? '升序' : '降序' }}
        </el-button>
      </div>
    </div>

    <div class="responsive-table-mobile__list">
      <div
        v-for="(row, rowIndex) in flattenedData"
        :key="getRowKey(row.row, rowIndex)"
        class="responsive-table-mobile__row-container"
      >
        <div
          v-if="row.level > 0"
          class="responsive-table-mobile__tree-connector"
        >
          <div
            v-for="level in row.level"
            :key="level"
            class="responsive-table-mobile__tree-line"
            :style="{ left: `${(level - 1) * 20 + 8}px` }"
            :class="{ 'is-last-level': level === row.level }"
          ></div>
        </div>

        <div
          class="responsive-table-card"
          :class="{
            'responsive-table-card--selected': isRowSelected(row.row),
            'responsive-table-card--has-children': row.hasChildren
          }"
          :style="{
            marginLeft: row.level > 0 ? `${row.level * 20}px` : '0'
          }"
          @click="handleCardClick(row.row, rowIndex, $event)"
        >
          <div v-if="hasSelection" class="responsive-table-card__selection">
            <el-checkbox
              :model-value="isRowSelected(row.row)"
              @change="value => toggleRowSelect(row.row, value)"
              @click.stop
            />
          </div>

          <div class="responsive-table-card__body">
            <div
              v-for="col in normalColumns"
              :key="col.columnId"
              class="responsive-table-card__field"
            >
              <div class="responsive-table-card__label">{{ col.label }}</div>
              <div class="responsive-table-card__value">
                <ResponsiveTableCardCell
                  :column="col"
                  :row="row.row"
                  :row-index="rowIndex"
                />
              </div>
            </div>
          </div>

          <div
            v-if="actionColumns.length > 0"
            class="responsive-table-card__actions"
          >
            <template v-for="col in actionColumns" :key="col.columnId">
              <ResponsiveTableCardCell
                :column="col"
                :row="row.row"
                :row-index="rowIndex"
              />
            </template>
          </div>
        </div>
      </div>

      <div
        v-if="!data || data.length === 0"
        class="responsive-table-mobile__empty"
      >
        <slot name="empty">
          <el-empty description="暂无数据" />
        </slot>
      </div>
    </div>

    <div style="display: none">
      <slot />
    </div>
  </div>
</template>

<script>
import {
  computed,
  h,
  nextTick,
  provide,
  reactive,
  ref,
  useAttrs,
  watch
} from 'vue'
import { useIsMobile } from '@/composables/useIsMobile'

const ResponsiveTableCardCell = {
  name: 'ResponsiveTableCardCell',
  props: {
    column: { type: Object, required: true },
    row: { type: Object, required: true },
    rowIndex: { type: Number, required: true }
  },
  setup(props) {
    return () => {
      const { column, row, rowIndex } = props
      if (column.renderFn) {
        return column.renderFn({
          row,
          $index: rowIndex,
          column: { property: column.prop, label: column.label },
          cellIndex: 0,
          expanded: false
        })
      }
      if (column.prop) {
        return h('span', getNestedValue(row, column.prop))
      }
      return null
    }
  }
}

function getNestedValue(obj, path) {
  if (!path || !obj) return ''
  return path.split('.').reduce((acc, key) => {
    return acc && acc[key] !== undefined ? acc[key] : ''
  }, obj)
}

export default {
  name: 'ResponsiveTable',
  components: {
    ResponsiveTableCardCell
  },
  inheritAttrs: false,
  props: {
    data: {
      type: Array,
      default: () => []
    },
    rowKey: {
      type: [String, Function],
      default: ''
    },
    mobileBreakpoint: {
      type: Number,
      default: 768
    }
  },
  emits: [
    'selection-change',
    'sort-change',
    'row-click',
    'row-dblclick',
    'row-contextmenu',
    'cell-click',
    'cell-dblclick',
    'cell-contextmenu',
    'header-click',
    'header-contextmenu',
    'header-dragend',
    'expand-change',
    'current-change',
    'select',
    'select-all',
    'filter-change'
  ],
  setup(props, { emit, attrs, expose }) {
    const { isMobile } = useIsMobile(props.mobileBreakpoint)
    const elTableRef = ref(null)
    const mobileContainerRef = ref(null)

    const eventToListenerMap = new Map()
    const emitEvents = [
      'selection-change',
      'sort-change',
      'row-click',
      'row-dblclick',
      'row-contextmenu',
      'cell-click',
      'cell-dblclick',
      'cell-contextmenu',
      'header-click',
      'header-contextmenu',
      'header-dragend',
      'expand-change',
      'current-change',
      'select',
      'select-all',
      'filter-change'
    ]
    emitEvents.forEach(event => {
      const listenerName =
        'on' +
        event
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('')
      eventToListenerMap.set(listenerName, event)
    })

    const registeredColumns = reactive([])
    let columnOrderCounter = 0

    const registerColumn = colDef => {
      colDef._order = columnOrderCounter++
      registeredColumns.push(colDef)
      registeredColumns.sort((left, right) => left._order - right._order)
    }

    const unregisterColumn = columnId => {
      const index = registeredColumns.findIndex(
        item => item.columnId === columnId
      )
      if (index > -1) {
        registeredColumns.splice(index, 1)
      }
    }

    const updateColumnRenderFn = (columnId, renderFn) => {
      const col = registeredColumns.find(item => item.columnId === columnId)
      if (col) {
        col.renderFn = renderFn
      }
    }

    provide('responsiveTable', {
      isMobile,
      registerColumn,
      unregisterColumn,
      updateColumnRenderFn,
      _getColumn: columnId =>
        registeredColumns.find(item => item.columnId === columnId) || null
    })

    const normalColumns = computed(() =>
      registeredColumns.filter(
        col =>
          !col.isAction &&
          !col.isSelection &&
          !col.cardHidden &&
          col.type !== 'selection' &&
          col.type !== 'index' &&
          col.type !== 'expand'
      )
    )

    const actionColumns = computed(() =>
      registeredColumns.filter(col => col.isAction)
    )

    const hasSelection = computed(() =>
      registeredColumns.some(col => col.type === 'selection' || col.isSelection)
    )

    const sortableColumns = computed(() =>
      registeredColumns.filter(col => col.sortable && col.prop)
    )

    const flattenedData = computed(() => {
      const result = []
      const flatten = (rows, level = 0) => {
        if (!rows) return
        rows.forEach(row => {
          result.push({
            row,
            level,
            hasChildren: row.children && row.children.length > 0
          })
          if (row.children && row.children.length > 0) {
            flatten(row.children, level + 1)
          }
        })
      }
      flatten(props.data)
      return result
    })

    watch(
      () => props.data,
      () => {
        if (isMobile.value) {
          nextTick(() => {
            const appElement = document.querySelector('.el-main')
            if (appElement) {
              appElement.scrollTo({ top: 0 })
            }
          })
        }
      },
      { deep: false }
    )

    const selectedRows = ref([])
    const sortState = reactive({
      prop: '',
      order: null
    })
    const mobileSortProp = ref('')
    const mobileSortOrder = ref('ascending')

    watch(
      () => attrs['default-sort'],
      newVal => {
        if (newVal) {
          sortState.prop = newVal.prop || ''
          sortState.order = newVal.order || null
          mobileSortProp.value = sortState.prop
          mobileSortOrder.value = sortState.order || 'ascending'
        }
      },
      { immediate: true, deep: true }
    )

    watch(
      isMobile,
      (newIsMobile, oldIsMobile) => {
        if (newIsMobile === oldIsMobile) return

        nextTick(() => {
          if (newIsMobile) {
            if (hasSelection.value && elTableRef.value) {
              const tableSelection = elTableRef.value.getSelectionRows()
              selectedRows.value = [...tableSelection]
            }
            return
          }

          if (elTableRef.value && sortState.prop) {
            elTableRef.value.sort(sortState.prop, sortState.order)
          }
          if (hasSelection.value && elTableRef.value) {
            elTableRef.value.clearSelection()
            selectedRows.value.forEach(row => {
              elTableRef.value.toggleRowSelection(row, true)
            })
          }
        })
      },
      { immediate: false }
    )

    const getRowKey = (row, index) => {
      if (typeof props.rowKey === 'function') {
        return props.rowKey(row)
      }
      if (props.rowKey && row[props.rowKey] !== undefined) {
        return row[props.rowKey]
      }
      return index
    }

    const isRowSelected = row => {
      const key = getRowKey(row, -1)
      return selectedRows.value.some(item => getRowKey(item, -1) === key)
    }

    const toggleRowSelect = (row, selected) => {
      const key = getRowKey(row, -1)
      if (selected) {
        if (!isRowSelected(row)) {
          selectedRows.value.push(row)
        }
      } else {
        selectedRows.value = selectedRows.value.filter(
          item => getRowKey(item, -1) !== key
        )
      }
      emit('selection-change', [...selectedRows.value])
      emit('select', [...selectedRows.value], row)
    }

    const isAllSelected = computed({
      get: () => {
        if (!props.data || props.data.length === 0) return false
        return props.data.every(row => isRowSelected(row))
      },
      set: value => handleSelectAll(value)
    })

    const isIndeterminate = computed(() => {
      if (isAllSelected.value) return false
      return selectedRows.value.length > 0
    })

    const handleSelectAll = value => {
      if (value) {
        const currentKeys = new Set(
          props.data.map((row, index) => getRowKey(row, index))
        )
        const kept = selectedRows.value.filter(
          row => !currentKeys.has(getRowKey(row, -1))
        )
        selectedRows.value = [...kept, ...props.data]
      } else {
        const currentKeys = new Set(
          props.data.map((row, index) => getRowKey(row, index))
        )
        selectedRows.value = selectedRows.value.filter(
          row => !currentKeys.has(getRowKey(row, -1))
        )
      }
      emit('selection-change', [...selectedRows.value])
      emit('select-all', [...selectedRows.value])
    }

    const handleMobileSortChange = value => {
      const prop = value || ''
      const order = prop ? mobileSortOrder.value : null

      sortState.prop = prop
      sortState.order = order

      emit('sort-change', {
        column: prop ? { property: prop } : null,
        prop: prop || null,
        order
      })
    }

    const toggleMobileSortOrder = () => {
      mobileSortOrder.value =
        mobileSortOrder.value === 'ascending' ? 'descending' : 'ascending'
      handleMobileSortChange(mobileSortProp.value)
    }

    const handleCardClick = (row, index, event) => {
      emit('row-click', row, null, event)
    }

    const tableListeners = computed(() => {
      const listeners = {}
      emitEvents.forEach(event => {
        if (event === 'selection-change') {
          listeners[event] = (...args) => {
            const [selection] = args
            selectedRows.value = [...selection]
            emit(event, ...args)
          }
          return
        }
        if (event === 'sort-change') {
          listeners[event] = (...args) => {
            const sortInfo = args[0] || {}
            const { prop, order } = sortInfo
            if (!order) {
              sortState.prop = ''
              sortState.order = null
              mobileSortProp.value = ''
            } else {
              sortState.prop = prop || ''
              sortState.order = order
              mobileSortProp.value = prop || ''
              mobileSortOrder.value = order || 'ascending'
            }
            emit(event, ...args)
          }
          return
        }
        listeners[event] = (...args) => emit(event, ...args)
      })
      return listeners
    })

    const tableAttrs = computed(() => {
      const { mobileBreakpoint, ...rest } = attrs
      const filtered = {}
      Object.keys(rest).forEach(key => {
        if (!eventToListenerMap.has(key)) {
          filtered[key] = rest[key]
        }
      })

      filtered['default-sort'] = {
        prop: sortState.prop,
        order: sortState.order
      }

      return {
        ...filtered,
        rowKey: props.rowKey
      }
    })

    expose({
      scrollTo: (...args) => {
        if (elTableRef.value) {
          elTableRef.value.scrollTo(...args)
        } else if (mobileContainerRef.value) {
          mobileContainerRef.value.scrollTo(...args)
        }
      },
      clearSelection: () => {
        if (elTableRef.value) {
          elTableRef.value.clearSelection()
        } else {
          selectedRows.value = []
          emit('selection-change', [])
        }
      },
      toggleRowSelection: (row, selected) => {
        if (elTableRef.value) {
          elTableRef.value.toggleRowSelection(row, selected)
        } else {
          toggleRowSelect(
            row,
            selected !== undefined ? selected : !isRowSelected(row)
          )
        }
      },
      toggleAllSelection: () => {
        if (elTableRef.value) {
          elTableRef.value.toggleAllSelection()
        } else {
          handleSelectAll(!isAllSelected.value)
        }
      },
      setCurrentRow: row => {
        if (elTableRef.value) {
          elTableRef.value.setCurrentRow(row)
        }
      },
      clearSort: () => {
        if (elTableRef.value) {
          elTableRef.value.clearSort()
        }
        sortState.prop = ''
        sortState.order = null
        mobileSortProp.value = ''
        mobileSortOrder.value = 'ascending'
      },
      clearFilter: columnKeys => {
        if (elTableRef.value) {
          elTableRef.value.clearFilter(columnKeys)
        }
      },
      sort: (prop, order) => {
        if (elTableRef.value) {
          elTableRef.value.sort(prop, order)
        } else {
          mobileSortProp.value = prop
          mobileSortOrder.value = order || 'ascending'
          handleMobileSortChange(prop)
        }
      },
      getElTableRef: () => elTableRef.value,
      isMobile
    })

    return {
      isMobile,
      elTableRef,
      mobileContainerRef,
      normalColumns,
      actionColumns,
      hasSelection,
      sortableColumns,
      isAllSelected,
      isIndeterminate,
      mobileSortProp,
      mobileSortOrder,
      tableAttrs,
      tableListeners,
      flattenedData,
      getRowKey,
      isRowSelected,
      toggleRowSelect,
      handleSelectAll,
      handleMobileSortChange,
      toggleMobileSortOrder,
      handleCardClick
    }
  }
}
</script>

<style scoped>
.responsive-table-mobile {
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.responsive-table-mobile__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--el-bg-color-page, #f5f7fa);
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
  border-radius: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 8px;
}

.responsive-table-mobile__sort {
  display: flex;
  align-items: center;
  gap: 6px;
}

.responsive-table-mobile__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.responsive-table-mobile__row-container {
  position: relative;
  display: flex;
  align-items: stretch;
}

.responsive-table-mobile__tree-connector {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
}

.responsive-table-mobile__tree-line {
  position: absolute;
  top: -12px;
  bottom: 0;
  width: 1px;
  background-color: var(--el-border-color-lighter, #ebeef5);
}

.responsive-table-mobile__row-container:first-child
  .responsive-table-mobile__tree-line {
  top: 24px;
}

.responsive-table-mobile__tree-line.is-last-level {
  background-color: var(--el-border-color-lighter, #a0cfff);
  width: 2px;
}

.responsive-table-mobile__tree-line.is-last-level::after {
  content: '';
  position: absolute;
  top: 24px;
  left: 0;
  width: 12px;
  height: 2px;
  background-color: var(--el-border-color-lighter, #a0cfff);
}

.responsive-table-card {
  flex: 1;
  min-width: 0;
  position: relative;
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.05);
}

.responsive-table-card:hover {
  border-color: var(--el-color-primary-light-5, #a0cfff);
}

.responsive-table-card--selected {
  border-color: var(--el-color-primary, #409eff);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7, #c6e2ff);
}

.responsive-table-card__selection {
  padding: 0 10px;
  margin-bottom: -10px;
}

.responsive-table-card__body {
  padding: 8px 10px;
}

.responsive-table-card__field {
  display: flex;
  padding: 6px 0;
  line-height: 1.5;
  border-bottom: 1px dashed var(--el-border-color-extra-light, #f0f0f0);
  gap: 8px;
}

.responsive-table-card__field:last-child {
  border-bottom: none;
}

.responsive-table-card__label {
  flex-shrink: 0;
  width: 70px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 13px;
}

.responsive-table-card__value {
  flex: 1;
  min-width: 0;
  color: var(--el-text-color-primary, #303133);
  font-size: 13px;
  word-break: break-all;
}

.responsive-table-card__actions {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  border-top: 1px solid var(--el-border-color-lighter, #e4e7ed);
  background: var(--el-bg-color-page, #fafafa);
  flex-wrap: wrap;
}

.responsive-table-mobile__empty {
  padding: 40px 0;
  text-align: center;
}
</style>
