<template>
  <EntityListBase
    title="活动"
    :getList="eventApi.getList"
    :update="eventApi.update"
  />
</template>

<script>
import EntityListBase from '../../components/EntityListBase.vue'
import { eventApi } from '../../api/entity.js'

export default {
  name: 'EventList',
  components: { EntityListBase },
  setup() {
    return { eventApi }
  }
}
</script>
