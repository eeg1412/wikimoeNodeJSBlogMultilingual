<template>
  <EntityListBase
    title="游戏"
    :getList="gameApi.getList"
    :update="gameApi.update"
  />
</template>

<script>
import EntityListBase from '../../components/EntityListBase.vue'
import { gameApi } from '../../api/entity.js'

export default {
  name: 'GameList',
  components: { EntityListBase },
  setup() {
    return { gameApi }
  }
}
</script>
