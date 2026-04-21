<template>
  <el-table-column v-if="!parentIsMobile" v-bind="columnProps">
    <template v-if="$slots.default" #default="scope">
      <slot name="default" v-bind="scope" />
    </template>
    <template v-if="$slots.header" #header="scope">
      <slot name="header" v-bind="scope" />
    </template>
  </el-table-column>
</template>

<script>
import {
  computed,
  inject,
  onBeforeUnmount,
  useAttrs,
  useSlots,
  watch
} from 'vue'

let columnIdCounter = 0

export default {
  name: 'ResponsiveTableColumn',
  inheritAttrs: false,
  props: {
    type: { type: String, default: '' },
    prop: { type: String, default: '' },
    label: { type: String, default: '' },
    width: { type: [String, Number], default: '' },
    minWidth: { type: [String, Number], default: '' },
    fixed: { type: [String, Boolean], default: false },
    sortable: { type: [Boolean, String], default: false },
    align: { type: String, default: '' },
    headerAlign: { type: String, default: '' },
    formatter: { type: Function, default: null },
    showOverflowTooltip: { type: Boolean, default: false },
    className: { type: String, default: '' },
    labelClassName: { type: String, default: '' },
    resizable: { type: Boolean, default: true },
    filters: { type: Array, default: () => [] },
    filterMethod: { type: Function, default: null },
    filteredValue: { type: Array, default: () => [] },
    filterMultiple: { type: Boolean, default: true },
    filterPlacement: { type: String, default: '' },
    selectable: { type: Function, default: null },
    reserveSelection: { type: Boolean, default: false },
    cardHidden: { type: Boolean, default: false },
    cardAction: { type: Boolean, default: false }
  },
  setup(props) {
    const slots = useSlots()
    const attrs = useAttrs()
    const parentTable = inject('responsiveTable', null)
    const columnId = Symbol(`col-${columnIdCounter++}`)

    const parentIsMobile = computed(() => parentTable?.isMobile?.value ?? false)

    const isAction = computed(() => {
      if (props.cardAction) return true
      if (props.fixed === 'right' && !props.prop && !props.type) return true
      return false
    })

    const isSelection = computed(() => props.type === 'selection')

    const columnProps = computed(() => {
      const result = { ...attrs }
      const standardPropKeys = [
        'type',
        'prop',
        'label',
        'width',
        'minWidth',
        'fixed',
        'sortable',
        'align',
        'headerAlign',
        'formatter',
        'showOverflowTooltip',
        'className',
        'labelClassName',
        'resizable',
        'filters',
        'filterMethod',
        'filteredValue',
        'filterMultiple',
        'filterPlacement',
        'selectable',
        'reserveSelection'
      ]
      standardPropKeys.forEach(key => {
        const value = props[key]
        if (
          value === '' ||
          value === null ||
          (Array.isArray(value) && value.length === 0)
        ) {
          return
        }
        result[key] = value
      })
      return result
    })

    if (parentTable) {
      const colDef = {
        columnId,
        type: props.type,
        prop: props.prop,
        label: props.label,
        width: props.width,
        minWidth: props.minWidth,
        fixed: props.fixed,
        sortable: props.sortable,
        cardHidden: props.cardHidden,
        cardAction: props.cardAction,
        isAction: isAction.value,
        isSelection: isSelection.value,
        renderFn: slots.default || null
      }

      parentTable.registerColumn(colDef)

      watch(
        () => slots.default,
        newSlot => {
          parentTable.updateColumnRenderFn(columnId, newSlot || null)
        }
      )

      watch(
        () => [
          props.label,
          props.prop,
          props.cardHidden,
          props.cardAction,
          isAction.value,
          isSelection.value
        ],
        ([
          newLabel,
          newProp,
          newCardHidden,
          newCardAction,
          newIsAction,
          newIsSelection
        ]) => {
          const existingCol = parentTable._getColumn?.(columnId)
          if (existingCol) {
            existingCol.label = newLabel
            existingCol.prop = newProp
            existingCol.cardHidden = newCardHidden
            existingCol.cardAction = newCardAction
            existingCol.isAction = newIsAction
            existingCol.isSelection = newIsSelection
          }
        }
      )

      onBeforeUnmount(() => {
        parentTable.unregisterColumn(columnId)
      })
    }

    return {
      parentIsMobile,
      columnProps
    }
  }
}
</script>
