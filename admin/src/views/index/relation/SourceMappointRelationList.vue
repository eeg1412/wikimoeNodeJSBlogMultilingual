<template>
  <RelationList scope="source" title="源地点" collection-name="mappoints" />
</template>

<script>
import RelationList from './RelationList.vue'

export default {
  name: 'SourceMappointRelationList',
  components: {
    RelationList
  }
}
</script>
