<template>
  <RelationList scope="source" title="源作者" collection-name="users" />
</template>

<script>
import RelationList from './RelationList.vue'

export default {
  name: 'SourceAuthorRelationList',
  components: {
    RelationList
  }
}
</script>
