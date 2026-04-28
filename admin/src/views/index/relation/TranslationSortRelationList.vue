<template>
  <RelationList scope="translation" title="分类" collection-name="sorts" />
</template>

<script>
import RelationList from './RelationList.vue'

export default {
  name: 'TranslationSortRelationList',
  components: {
    RelationList
  }
}
</script>
