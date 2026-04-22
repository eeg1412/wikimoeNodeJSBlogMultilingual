<template>
  <EntityListBase
    title="电影"
    :getList="movieApi.getList"
    :update="movieApi.update"
  />
</template>

<script>
import EntityListBase from '../../components/EntityListBase.vue'
import { movieApi } from '../../api/entity.js'

export default {
  name: 'MovieList',
  components: { EntityListBase },
  setup() {
    return { movieApi }
  }
}
</script>
