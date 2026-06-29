<template>
  <div class="related-post-feature-scope">
    <div class="related-post-feature-scope-header">
      <div class="related-post-feature-scope-title">
        {{ title }}
      </div>
      <div class="related-post-feature-scope-actions">
        <span class="related-post-feature-scope-count">
          {{ selectedCount }}/{{ optionCount }}
        </span>
        <el-button
          link
          type="primary"
          :disabled="disabled || loading || optionCount === 0"
          @click="selectAll"
        >
          全选
        </el-button>
        <el-button
          link
          type="primary"
          :disabled="disabled || loading || selectedCount === 0"
          @click="clearSelection"
        >
          清空
        </el-button>
      </div>
    </div>

    <div v-if="loading" class="related-post-feature-scope-empty">
      正在加载相关文章
    </div>
    <div v-else-if="optionCount === 0" class="related-post-feature-scope-empty">
      {{ emptyText }}
    </div>
    <el-checkbox-group
      v-else
      v-model="selectedModel"
      :disabled="disabled"
      class="related-post-feature-scope-list"
    >
      <el-checkbox
        v-for="item in options"
        :key="item.sourceId"
        :value="item.sourceId"
        class="related-post-feature-scope-item"
      >
        <span class="related-post-feature-scope-item-title">
          {{ item.title }}
        </span>
        <el-tag size="small" effect="plain">
          {{ item.typeLabel }}
        </el-tag>
        <el-tag
          v-if="item.alreadyHandled"
          size="small"
          type="info"
          effect="plain"
        >
          {{ handledLabel }}
        </el-tag>
        <span class="related-post-feature-scope-item-depth">
          第 {{ item.relatedDepth }} 层
        </span>
      </el-checkbox>
    </el-checkbox-group>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'RelatedPostFeatureScopeSelector',
  props: {
    disabled: {
      type: Boolean,
      default: false
    },
    emptyText: {
      type: String,
      default: '没有可设置的相关文章'
    },
    handledLabel: {
      type: String,
      default: '已处理'
    },
    loading: {
      type: Boolean,
      default: false
    },
    modelValue: {
      type: Array,
      default() {
        return []
      }
    },
    options: {
      type: Array,
      default() {
        return []
      }
    },
    title: {
      type: String,
      default: '相关文章'
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const selectedModel = computed({
      get() {
        return props.modelValue
      },
      set(value) {
        if (Array.isArray(value)) {
          emit('update:modelValue', value)
          return
        }
        emit('update:modelValue', [])
      }
    })

    const optionCount = computed(() => {
      return props.options.length
    })

    const selectedCount = computed(() => {
      const optionIdSet = new Set(
        props.options.map(item => {
          return item.sourceId
        })
      )
      return props.modelValue.filter(sourceId => {
        return optionIdSet.has(sourceId)
      }).length
    })

    function selectAll() {
      emit(
        'update:modelValue',
        props.options.map(item => {
          return item.sourceId
        })
      )
    }

    function clearSelection() {
      emit('update:modelValue', [])
    }

    return {
      clearSelection,
      optionCount,
      selectAll,
      selectedCount,
      selectedModel
    }
  }
}
</script>

<style scoped>
.related-post-feature-scope {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  margin-top: 8px;
  padding: 10px;
  width: 100%;
}

.related-post-feature-scope-header,
.related-post-feature-scope-actions,
.related-post-feature-scope-list :deep(.el-checkbox__label) {
  align-items: center;
  display: flex;
  gap: 8px;
}

.related-post-feature-scope-header {
  justify-content: space-between;
  margin-bottom: 8px;
}

.related-post-feature-scope-title {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.related-post-feature-scope-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.related-post-feature-scope-count,
.related-post-feature-scope-empty,
.related-post-feature-scope-item-depth {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.related-post-feature-scope-list {
  display: grid;
  gap: 6px;
  grid-template-columns: minmax(0, 1fr);
}

.related-post-feature-scope-item {
  align-items: flex-start;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  box-sizing: border-box;
  margin-right: 0;
  min-width: 0;
  padding: 8px;
  width: 100%;
}

.related-post-feature-scope-item-title {
  color: var(--el-text-color-primary);
  flex: 1;
  font-size: 13px;
  line-height: 1.4;
  min-width: 0;
  overflow-wrap: anywhere;
}

.related-post-feature-scope-empty {
  line-height: 1.5;
}

@media (max-width: 767px) {
  .related-post-feature-scope-header {
    align-items: stretch;
    flex-direction: column;
  }

  .related-post-feature-scope-actions {
    justify-content: flex-start;
  }

  .related-post-feature-scope-list :deep(.el-checkbox__label) {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
