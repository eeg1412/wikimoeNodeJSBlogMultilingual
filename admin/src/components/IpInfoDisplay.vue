<template>
  <span v-if="!ip" class="text-gray-400">-</span>
  <el-tooltip v-else :content="tooltipContent" placement="top">
    <span class="cursor-default">{{ ip }}</span>
  </el-tooltip>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'IpInfoDisplay',
  props: {
    ip: {
      type: String,
      default: ''
    },
    geo: {
      type: Object,
      default: null
    }
  },
  setup(props) {
    const tooltipContent = computed(() => {
      if (!props.geo) return props.ip || '-'
      const parts = [
        props.geo.country,
        props.geo.region,
        props.geo.city
      ].filter(Boolean)
      return parts.length > 0 ? parts.join(' / ') : props.ip
    })

    return { tooltipContent }
  }
}
</script>
