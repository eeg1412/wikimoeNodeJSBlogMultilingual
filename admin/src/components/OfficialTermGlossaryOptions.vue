<template>
  <el-form-item label="自动整理词库">
    <el-switch
      v-model="autoOrganizeModel"
      :disabled="disabled"
      active-text="自动抽取并整理文章名词"
    />
    <div
      v-if="!autoOrganize"
      :class="['official-term-glossary-tip', autoOrganizeTipToneClass]"
    >
      {{ autoOrganizeDisabledTip }}
    </div>
    <slot name="auto-organize-related-posts" />
  </el-form-item>

  <el-form-item label="名词检索">
    <el-switch
      v-model="searchModel"
      :disabled="isSearchDisabled"
      active-text="联网检索官方译名"
    />
    <AiFeatureUnavailableTip :message="searchTipMessage" />
    <slot name="search-related-posts" />
  </el-form-item>
</template>

<script>
import { computed, watch } from 'vue'
import AiFeatureUnavailableTip from '@/components/AiFeatureUnavailableTip.vue'

export default {
  name: 'OfficialTermGlossaryOptions',
  components: {
    AiFeatureUnavailableTip
  },
  props: {
    autoOrganize: {
      type: Boolean,
      default: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    searchDefaultLoading: {
      type: Boolean,
      default: false
    },
    searchOfficialTermTranslations: {
      type: Boolean,
      default: false
    },
    searchUnavailableReason: {
      type: String,
      default: ''
    },
    sourceProperNounTermCount: {
      type: Number,
      default: 0
    },
    sourceProperNounTermCountLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'update:autoOrganize',
    'update:searchOfficialTermTranslations'
  ],
  setup(props, { emit }) {
    const autoOrganizeModel = computed({
      get() {
        return props.autoOrganize === true
      },
      set(value) {
        emit('update:autoOrganize', value === true)
      }
    })

    const searchModel = computed({
      get() {
        return props.searchOfficialTermTranslations === true
      },
      set(value) {
        emit('update:searchOfficialTermTranslations', value === true)
      }
    })

    const hasSourceProperNouns = computed(() => {
      const count = Number(props.sourceProperNounTermCount || 0)
      if (!Number.isFinite(count)) {
        return false
      }
      return count > 0
    })

    const isSearchDisabled = computed(() => {
      if (props.disabled) {
        return true
      }
      if (!props.autoOrganize) {
        return true
      }
      if (props.searchDefaultLoading) {
        return true
      }
      return Boolean(props.searchUnavailableReason)
    })

    const searchTipMessage = computed(() => {
      if (!props.autoOrganize) {
        return '关闭自动整理词库时会直接使用源文章已整理的名词词库，联网搜索只在自动整理词库时可用。'
      }
      return props.searchUnavailableReason
    })

    const autoOrganizeDisabledTip = computed(() => {
      if (props.sourceProperNounTermCountLoading) {
        return '正在检查源文章已整理的名词词库。'
      }
      if (hasSourceProperNouns.value) {
        return '本次将使用源文章对应的名词词库作为 AI 翻译参考。'
      }
      return '当前源文章没有整理名词，翻译可能会有偏差。'
    })

    const autoOrganizeTipToneClass = computed(() => {
      if (props.sourceProperNounTermCountLoading) {
        return 'is-info'
      }
      if (hasSourceProperNouns.value) {
        return 'is-info'
      }
      return 'is-warning'
    })

    watch(isSearchDisabled, value => {
      if (!value) {
        return
      }
      if (props.searchOfficialTermTranslations !== true) {
        return
      }
      emit('update:searchOfficialTermTranslations', false)
    })

    return {
      autoOrganizeDisabledTip,
      autoOrganizeModel,
      autoOrganizeTipToneClass,
      isSearchDisabled,
      searchModel,
      searchTipMessage
    }
  }
}
</script>

<style scoped>
.official-term-glossary-tip {
  width: 100%;
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.official-term-glossary-tip.is-info {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
}

.official-term-glossary-tip.is-warning {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
}
</style>
