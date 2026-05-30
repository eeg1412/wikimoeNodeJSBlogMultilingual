<template>
  <RelationSourceListBySource
    title="地点"
    collection-name="mappoints"
    language-route-name="TranslationMappointRelationLanguageList"
  />
</template>

<script>
import RelationSourceListBySource from './RelationSourceListBySource.vue'

export default {
  name: 'TranslationMappointRelationList',
  components: {
    RelationSourceListBySource
  }
}
</script>
