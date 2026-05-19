<template>
  <el-tooltip :content="tooltipText" placement="top">
    <el-button
      class="proper-noun-star-button"
      :class="{ 'is-starred': isStarred }"
      :disabled="disabled"
      :loading="loading"
      :size="size"
      :aria-label="tooltipText"
      @click="$emit('click')"
      ><el-icon v-show="!loading">
        <StarFilled v-if="isStarred" />
        <Star v-else />
      </el-icon>
    </el-button>
  </el-tooltip>
</template>

<script>
import { computed } from 'vue'
import { Star, StarFilled } from '@element-plus/icons-vue'

export default {
  name: 'ProperNounStarButton',
  components: {
    Star,
    StarFilled
  },
  props: {
    disabled: {
      type: Boolean,
      default: false
    },
    isStarred: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    },
    size: {
      type: String,
      default: 'small'
    }
  },
  emits: ['click'],
  setup(props) {
    const tooltipText = computed(() => {
      if (props.isStarred) {
        return '取消标星'
      }
      return '标星'
    })

    return {
      tooltipText
    }
  }
}
</script>

<style scoped>
.proper-noun-star-button {
  color: var(--el-text-color-placeholder);
}

.proper-noun-star-button.is-starred {
  background: rgba(245, 179, 1, 0.08);
  border-color: rgba(245, 179, 1, 0.35);
  color: #f5b301;
}

.proper-noun-star-button :deep(.el-icon) {
  font-size: 16px;
}

.proper-noun-star-button.is-starred :deep(svg) {
  fill: currentColor;
}
.proper-noun-star-button :deep(.el-icon.is-loading + span) {
  display: none;
}
</style>
