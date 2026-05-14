<template>
  <el-button
    type="success"
    :size="size"
    :disabled="disabled || buttonLoading"
    :loading="buttonLoading"
    @click="handleClick"
  >
    AI 翻译
  </el-button>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'TranslationPostAiTranslateButton',
  props: {
    post: {
      type: Object,
      default: null
    },
    size: {
      type: String,
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['translate'],
  setup(props, { emit }) {
    const buttonLoading = computed(() => {
      return props.loading === true
    })

    function handleClick() {
      emit('translate', props.post)
    }

    return {
      buttonLoading,
      handleClick
    }
  }
}
</script>
