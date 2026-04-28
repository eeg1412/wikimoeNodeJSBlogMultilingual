<template>
  <RelationList scope="translation" title="作者" collection-name="users" />
</template>

<script>
import RelationList from './RelationList.vue'

export default {
  name: 'TranslationAuthorRelationList',
  components: {
    RelationList
  }
}
</script>
