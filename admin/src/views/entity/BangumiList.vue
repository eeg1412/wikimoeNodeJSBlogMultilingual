<template>
  <EntityListBase
    title="Bangumi"
    :getList="bangumiApi.getList"
    :update="bangumiApi.update"
  />
</template>

<script>
import EntityListBase from '../../components/EntityListBase.vue'
import { bangumiApi } from '../../api/entity.js'

export default {
  name: 'BangumiList',
  components: { EntityListBase },
  setup() {
    return { bangumiApi }
  }
}
</script>
