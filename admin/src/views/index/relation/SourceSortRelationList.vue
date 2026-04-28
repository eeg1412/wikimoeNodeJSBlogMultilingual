<template>
  <RelationList scope="source" title="源分类" collection-name="sorts" />
</template>

<script>
import RelationList from './RelationList.vue'

export default {
  name: 'SourceSortRelationList',
  components: {
    RelationList
  }
}
</script>
