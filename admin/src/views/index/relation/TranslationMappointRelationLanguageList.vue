<template>
  <RelationLanguageVersionList
    title="地点"
    collection-name="mappoints"
    source-list-route-name="TranslationMappointRelationList"
  />
</template>

<script>
import RelationLanguageVersionList from './RelationLanguageVersionList.vue'

export default {
  name: 'TranslationMappointRelationLanguageList',
  components: {
    RelationLanguageVersionList
  }
}
</script>
