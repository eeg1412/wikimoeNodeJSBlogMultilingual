<template>
  <RelationList scope="source" title="源标签" collection-name="tags" />
</template>

<script>
import RelationList from './RelationList.vue'

export default {
  name: 'SourceTagRelationList',
  components: {
    RelationList
  }
}
</script>
