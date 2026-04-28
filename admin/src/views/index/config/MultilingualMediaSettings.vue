<template>
  <div class="common-right-panel-form multilingual-media-settings-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>设置</el-breadcrumb-item>
        <el-breadcrumb-item>媒体设置</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <ConfigMediaForm
      :getSettingsApi="getSettingsApi"
      :updateSettingsApi="updateSettingsApi"
    />
  </div>
</template>

<script>
import ConfigMediaForm from '@/components/ConfigMediaForm.vue'
import { multilingualApi } from '@/api'

export default {
  name: 'MultilingualMediaSettings',
  components: {
    ConfigMediaForm
  },
  setup() {
    const getSettingsApi = () => {
      return multilingualApi.getMediaSettings({}, true)
    }

    const updateSettingsApi = optionList => {
      const values = {}
      optionList.forEach(item => {
        values[item.name] = item.value
      })

      return multilingualApi.updateMediaSettings({ values })
    }

    return {
      getSettingsApi,
      updateSettingsApi
    }
  }
}
</script>

<style scoped>
.multilingual-media-settings-page {
  max-width: 980px;
}
</style>
