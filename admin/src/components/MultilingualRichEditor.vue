<template>
  <div class="multilingual-rich-editor">
    <Toolbar :editor="editorRef" :default-config="toolbarConfig" mode="default" />
    <Editor
      v-model="innerValue"
      :default-config="editorConfig"
      mode="default"
      style="height: 480px; overflow-y: hidden"
      @onCreated="handleCreated"
    />
  </div>
</template>

<script setup>
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { computed, onBeforeUnmount, shallowRef } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])
const editorRef = shallowRef()

const innerValue = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:modelValue', value)
  }
})

const toolbarConfig = {
  toolbarKeys: [
    'headerSelect',
    'bold',
    'italic',
    'underline',
    'through',
    '|',
    'color',
    'bgColor',
    '|',
    'bulletedList',
    'numberedList',
    'todo',
    '|',
    'blockquote',
    'insertLink',
    'insertTable',
    'codeBlock',
    'undo',
    'redo'
  ]
}

const editorConfig = {
  autoFocus: false,
  placeholder: '请输入正文内容…'
}

function handleCreated(editor) {
  editorRef.value = editor
}

onBeforeUnmount(() => {
  editorRef.value?.destroy?.()
})
</script>

<style scoped>
.multilingual-rich-editor {
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  overflow: hidden;
  background: var(--el-bg-color);
}
</style>