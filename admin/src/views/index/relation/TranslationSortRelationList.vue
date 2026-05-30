<template>
  <RelationSourceListBySource
    title="分类"
    collection-name="sorts"
    language-route-name="TranslationSortRelationLanguageList"
  />
</template>

<script>
import RelationSourceListBySource from './RelationSourceListBySource.vue'

export default {
  name: 'TranslationSortRelationList',
  components: {
    RelationSourceListBySource
  }
}
</script>
