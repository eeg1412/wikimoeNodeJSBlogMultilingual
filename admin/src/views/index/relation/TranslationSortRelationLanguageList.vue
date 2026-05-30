<template>
  <RelationLanguageVersionList
    title="分类"
    collection-name="sorts"
    source-list-route-name="TranslationSortRelationList"
  />
</template>

<script>
import RelationLanguageVersionList from './RelationLanguageVersionList.vue'

export default {
  name: 'TranslationSortRelationLanguageList',
  components: {
    RelationLanguageVersionList
  }
}
</script>
