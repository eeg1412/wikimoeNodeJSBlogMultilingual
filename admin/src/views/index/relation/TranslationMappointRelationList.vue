<template>
  <RelationList scope="translation" title="地点" collection-name="mappoints" />
</template>

<script>
import RelationList from './RelationList.vue'

export default {
  name: 'TranslationMappointRelationList',
  components: {
    RelationList
  }
}
</script>
