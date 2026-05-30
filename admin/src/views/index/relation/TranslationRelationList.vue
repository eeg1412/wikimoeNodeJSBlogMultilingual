<template>
  <RelationSourceListBySource
    title="关联内容"
    :exclude-collection-names="relationContentExcludeCollectionNames"
    language-route-name="TranslationRelationContentLanguageList"
  />
</template>

<script>
import RelationSourceListBySource from './RelationSourceListBySource.vue'
import { BASIC_RELATION_COLLECTION_NAMES } from './relationCollection'

export default {
  name: 'TranslationRelationList',
  components: {
    RelationSourceListBySource
  },
  setup() {
    return {
      relationContentExcludeCollectionNames: [
        ...BASIC_RELATION_COLLECTION_NAMES,
        'posts',
        'attachments'
      ]
    }
  }
}
</script>
