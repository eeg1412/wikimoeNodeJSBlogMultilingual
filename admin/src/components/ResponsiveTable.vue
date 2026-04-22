<template>
  <!-- 桌面端：标准表格 -->
  <el-table v-if="!isMobile" v-bind="$attrs" :data="data" v-loading="loading">
    <slot />
  </el-table>

  <!-- 移动端：卡片列表 -->
  <div v-else v-loading="loading" class="responsive-card-list">
    <el-card
      v-for="(row, rowIndex) in data"
      :key="rowIndex"
      class="mb-3"
      shadow="hover"
    >
      <slot name="mobile-card" :row="row" :$index="rowIndex" />
    </el-card>

    <el-empty v-if="!data || data.length === 0" description="暂无数据" />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'

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
    }
  },
  setup() {
    const isMobile = ref(window.innerWidth < 768)

    function handleResize() {
      isMobile.value = window.innerWidth < 768
    }

    onMounted(() => window.addEventListener('resize', handleResize))
    onUnmounted(() => window.removeEventListener('resize', handleResize))

    return { isMobile }
  }
}
</script>
