<template>
  <div class="translation-entry-meta">
    <div class="translation-entry-meta-main">
      <div class="translation-entry-meta-title">{{ meta.title }}</div>
      <div v-if="meta.subtitle" class="translation-entry-meta-subtitle">
        {{ meta.subtitle }}
      </div>
    </div>
    <div v-if="meta.badgeList.length" class="translation-entry-meta-tags">
      <el-tag
        v-for="badge in meta.badgeList"
        :key="badge.key"
        size="small"
        effect="plain"
        :type="badge.type"
      >
        {{ badge.text }}
      </el-tag>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { getTranslationEntryDisplayMeta } from '@/utils/translationEntryDisplay'

export default {
  name: 'TranslationEntryMeta',
  props: {
    entry: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const meta = computed(() => {
      return getTranslationEntryDisplayMeta(props.entry)
    })

    return {
      meta
    }
  }
}
</script>

<style scoped>
.translation-entry-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.translation-entry-meta-main {
  min-width: 0;
  flex: 1;
}

.translation-entry-meta-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  word-break: break-word;
}

.translation-entry-meta-subtitle {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  word-break: break-word;
  white-space: normal;
}

.translation-entry-meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

@media (max-width: 767px) {
  .translation-entry-meta {
    flex-direction: column;
  }

  .translation-entry-meta-tags {
    justify-content: flex-start;
  }
}
</style>
