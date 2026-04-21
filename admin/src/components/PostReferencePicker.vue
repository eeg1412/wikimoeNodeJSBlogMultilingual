<template>
  <el-select
    :model-value="selected"
    :multiple="multiple"
    filterable
    remote
    clearable
    :placeholder="placeholder"
    :remote-method="onSearch"
    :loading="loading"
    style="width: 100%"
    @update:model-value="onChange"
    @visible-change="onVisibleChange"
  >
    <el-option
      v-for="item in options"
      :key="item._id"
      :label="labelOf(item)"
      :value="item._id"
    >
      <div class="post-reference-picker-option">
        <div class="post-reference-picker-title">{{ labelOf(item) }}</div>
        <div class="post-reference-picker-meta">
          <span>{{ item.languageCode }}</span>
          <span>{{
            item.status === 1
              ? '已发布'
              : item.status === 99
                ? '回收站'
                : '草稿'
          }}</span>
        </div>
      </div>
    </el-option>
  </el-select>
</template>

<script>
import { computed, ref, watch } from 'vue'
import { getPostApi, listPostsApi } from '@/api/post'

export default {
  name: 'PostReferencePicker',
  props: {
    modelValue: { type: [String, Array], default: null },
    languageCode: { type: String, default: '' },
    multiple: { type: Boolean, default: false },
    postType: { type: Number, required: true },
    placeholder: { type: String, default: '搜索文章并选择' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const options = ref([])
    const loading = ref(false)

    const selected = computed(() => {
      if (props.multiple) {
        return Array.isArray(props.modelValue) ? props.modelValue : []
      }
      return props.modelValue || ''
    })

    function labelOf(item) {
      if (!item) return ''
      const main = item.title || item.excerpt || '(未命名)'
      if (item.alias) {
        return `${main} / ${item.alias}`
      }
      return main
    }

    async function load(keyword) {
      loading.value = true
      try {
        const params = {
          page: 1,
          limit: 50,
          type: props.postType
        }
        if (props.languageCode) params.languageCode = props.languageCode
        if (keyword) params.keyword = keyword
        const resp = await listPostsApi(params)
        options.value = (resp && resp.data && resp.data.list) || []
        await loadSelectedMissing()
      } finally {
        loading.value = false
      }
    }

    async function loadSelectedMissing() {
      const ids = props.multiple
        ? Array.isArray(props.modelValue)
          ? props.modelValue
          : []
        : props.modelValue
          ? [props.modelValue]
          : []
      const exists = new Set(options.value.map(item => item._id))
      const missing = ids.filter(id => id && !exists.has(id))
      if (!missing.length) return
      const appended = await Promise.all(
        missing.map(id => getPostApi(id).catch(() => null))
      )
      const next = options.value.slice()
      appended.forEach(resp => {
        if (resp && resp.data) {
          next.push(resp.data)
        }
      })
      options.value = next
    }

    function onSearch(keyword) {
      load(keyword || '')
    }

    function onVisibleChange(visible) {
      if (visible && !options.value.length) {
        load('')
      }
    }

    function onChange(value) {
      emit('update:modelValue', props.multiple ? value || [] : value || null)
    }

    load('')

    watch(
      () => props.languageCode,
      () => load('')
    )

    watch(
      () => props.postType,
      () => load('')
    )
    watch(
      () => props.modelValue,
      () => loadSelectedMissing(),
      { deep: true }
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

<style scoped>
.post-reference-picker-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.post-reference-picker-title {
  color: var(--el-text-color-primary);
}

.post-reference-picker-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
