<template>
  <RelationLanguageVersionList
    title="标签"
    collection-name="tags"
    source-list-route-name="TranslationTagRelationList"
  />
</template>

<script>
import RelationLanguageVersionList from './RelationLanguageVersionList.vue'

export default {
  name: 'TranslationTagRelationLanguageList',
  components: {
    RelationLanguageVersionList
  }
}
</script>
