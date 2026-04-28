<template>
  <RelationList
    scope="source"
    title="源关联内容"
    :exclude-collection-names="basicRelationCollectionNames"
  />
</template>

<script>
import RelationList from './RelationList.vue'
import { BASIC_RELATION_COLLECTION_NAMES } from './relationCollection'

export default {
  name: 'SourceRelationList',
  components: {
    RelationList
  },
  setup() {
    return {
      basicRelationCollectionNames: BASIC_RELATION_COLLECTION_NAMES
    }
  }
}
</script>
