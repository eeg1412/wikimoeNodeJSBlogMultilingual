<template>
  <EntityListBase
    title="书籍"
    :getList="bookApi.getList"
    :update="bookApi.update"
  />
</template>

<script>
import EntityListBase from '../../components/EntityListBase.vue'
import { bookApi } from '../../api/entity.js'

export default {
  name: 'BookList',
  components: { EntityListBase },
  setup() {
    return { bookApi }
  }
}
</script>
