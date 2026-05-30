<template>
  <RelationSourceListBySource
    title="标签"
    collection-name="tags"
    language-route-name="TranslationTagRelationLanguageList"
  />
</template>

<script>
import RelationSourceListBySource from './RelationSourceListBySource.vue'

export default {
  name: 'TranslationTagRelationList',
  components: {
    RelationSourceListBySource
  }
}
</script>
