<template>
  <el-select
    :model-value="selected"
    :multiple="multiple"
    filterable
    remote
    clearable
    :remote-method="onSearch"
    :loading="loading"
    placeholder="搜索并选择"
    style="width: 100%"
    @update:model-value="onChange"
    @visible-change="onVisibleChange"
  >
    <el-option
      v-for="item in options"
      :key="item._id"
      :label="labelOf(item)"
      :value="item._id"
    />
  </el-select>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { listEntityApi } from '@/api/entity'

export default {
  name: 'EntityPicker',
  props: {
    modelValue: { type: [String, Array], default: null },
    type: { type: String, required: true },
    languageCode: { type: String, default: '' },
    multiple: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const options = ref([])
    const loading = ref(false)
    const labelField = ref('')

    const selected = computed(() => {
      if (props.multiple) {
        return Array.isArray(props.modelValue) ? props.modelValue : []
      }
      return props.modelValue || ''
    })

    function labelOf(item) {
      if (!item) return ''
      if (labelField.value && labelField.value.indexOf('.') > -1) {
        const parts = labelField.value.split('.')
        let v = item
        for (const p of parts) {
          v = v && v[p]
          if (v === undefined) break
        }
        return v || item.sourceId || item._id
      }
      return (
        (labelField.value && item[labelField.value]) ||
        item.nickname ||
        item.sortname ||
        item.tagname ||
        item.title ||
        item.sourceId ||
        item._id
      )
    }

    async function load(keyword) {
      loading.value = true
      try {
        const params = { page: 1, limit: 50 }
        if (props.languageCode) params.languageCode = props.languageCode
        if (keyword) params.keyword = keyword
        const resp = await listEntityApi(props.type, params)
        const data = (resp && resp.data) || {}
        options.value = data.list || []
        labelField.value = data.labelField || ''
      } finally {
        loading.value = false
      }
    }

    function onSearch(q) {
      load(q || '')
    }
    function onVisibleChange(v) {
      if (v && !options.value.length) load('')
    }
    function onChange(v) {
      emit('update:modelValue', props.multiple ? v || [] : v || null)
    }

    // 初次加载一批，确保已有选中项能显示 label
    load('')

    watch(
      () => props.languageCode,
      () => load('')
    )
    watch(
      () => props.type,
      () => load('')
    )

    return {
      options,
      loading,
      selected,
      labelOf,
      onSearch,
      onVisibleChange,
      onChange
    }
  }
}
</script>
