<template>
  <RelationLanguageVersionList
    title="关联内容"
    source-list-route-name="RelationList"
  />
</template>

<script>
import RelationLanguageVersionList from './RelationLanguageVersionList.vue'

export default {
  name: 'TranslationRelationContentLanguageList',
  components: {
    RelationLanguageVersionList
  }
}
</script>
