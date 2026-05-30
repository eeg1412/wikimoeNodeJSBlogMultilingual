<template>
  <RelationLanguageVersionList
    title="作者"
    collection-name="users"
    source-list-route-name="TranslationAuthorRelationList"
  />
</template>

<script>
import RelationLanguageVersionList from './RelationLanguageVersionList.vue'

export default {
  name: 'TranslationAuthorRelationLanguageList',
  components: {
    RelationLanguageVersionList
  }
}
</script>
