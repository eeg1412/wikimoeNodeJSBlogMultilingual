<template>
  <div class="responsive-table">
    <div v-if="!isMobile" class="responsive-table__desktop">
      <el-table
        v-bind="$attrs"
        :data="data"
        :row-key="rowKey"
        v-loading="loading"
        empty-text="暂无数据"
      >
        <slot />
      </el-table>
    </div>

    <div v-else v-loading="loading" class="responsive-card-list">
      <template v-if="hasData">
        <el-card
          v-for="(row, rowIndex) in data"
          :key="resolveRowKey(row, rowIndex)"
          shadow="never"
        >
          <slot name="mobile-card" :row="row" :$index="rowIndex" />
        </el-card>
      </template>
      <el-card v-else class="admin-empty-card" shadow="never">
        <el-empty description="暂无数据" />
      </el-card>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'

export default {
  name: 'ResponsiveTable',
  inheritAttrs: false,
  props: {
    data: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    rowKey: {
      type: [String, Function],
      default: '_id'
    }
  },
  setup(props) {
    const isMobile = ref(window.innerWidth < 960)
    const hasData = computed(() => Array.isArray(props.data) && props.data.length > 0)

    function handleResize() {
      isMobile.value = window.innerWidth < 960
    }

    function resolveRowKey(row, rowIndex) {
      if (typeof props.rowKey === 'function') {
        return props.rowKey(row)
      }

      if (props.rowKey && row && row[props.rowKey] !== undefined) {
        return row[props.rowKey]
      }

      return rowIndex
    }

    onMounted(() => window.addEventListener('resize', handleResize))
    onUnmounted(() => window.removeEventListener('resize', handleResize))

    return {
      isMobile,
      hasData,
      resolveRowKey
    }
  }
}
</script>
