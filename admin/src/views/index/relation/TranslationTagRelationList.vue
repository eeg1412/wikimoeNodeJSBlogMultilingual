<template>
  <RelationList scope="translation" title="标签" collection-name="tags" />
</template>

<script>
import RelationList from './RelationList.vue'

export default {
  name: 'TranslationTagRelationList',
  components: {
    RelationList
  }
}
</script>
