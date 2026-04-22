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
    ipInfo: {
      type: Object,
      default: null
    },
    geo: {
      type: Object,
      default: null
    }
  },
  setup(props) {
    const normalizedGeo = computed(() => {
      if (props.ipInfo) {
        return {
          country: props.ipInfo.countryLong,
          region: props.ipInfo.region,
          city: props.ipInfo.city
        }
      }
      return props.geo
    })

    const tooltipContent = computed(() => {
      if (!normalizedGeo.value) return props.ip || '-'
      const parts = [
        normalizedGeo.value.country,
        normalizedGeo.value.region,
        normalizedGeo.value.city
      ].filter(Boolean)
      return parts.length > 0 ? parts.join(' / ') : props.ip
    })

    return { tooltipContent }
  }
}
</script>
