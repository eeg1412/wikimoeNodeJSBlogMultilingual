<template>
  <el-select
    :model-value="normalizedValue"
    multiple
    filterable
    allow-create
    default-first-option
    clearable
    style="width: 100%"
    :placeholder="placeholder"
    @update:model-value="onChange"
  >
    <el-option
      v-for="item in normalizedValue"
      :key="item"
      :label="item"
      :value="item"
    />
  </el-select>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'StringArrayEditor',
  props: {
    modelValue: { type: Array, default: () => [] },
    placeholder: { type: String, default: '输入后回车，支持多个值' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const normalizedValue = computed(() => {
      if (!Array.isArray(props.modelValue)) return []
      return Array.from(
        new Set(
          props.modelValue
            .map(item => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        )
      )
    })

    function onChange(value) {
      const next = Array.from(
        new Set(
          (value || [])
            .map(item => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        )
      )
      emit('update:modelValue', next)
    }

    return {
      normalizedValue,
      onChange
    }
  }
}
</script>
