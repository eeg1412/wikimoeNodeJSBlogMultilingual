<template>
  <RelationSourceListBySource
    title="作者"
    collection-name="users"
    language-route-name="TranslationAuthorRelationLanguageList"
  />
</template>

<script>
import RelationSourceListBySource from './RelationSourceListBySource.vue'

export default {
  name: 'TranslationAuthorRelationList',
  components: {
    RelationSourceListBySource
  }
}
</script>
