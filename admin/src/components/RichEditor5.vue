<template>
  <div class="editor-body richeditor-5">
    <Toolbar
      style="border-bottom: 1px solid #ccc"
      :editor="editorRef"
      :defaultConfig="toolbarConfig"
      mode="default"
    />
    <Editor
      style="height: 520px; overflow-y: hidden"
      v-model="valueHtml"
      :defaultConfig="editorConfig"
      mode="default"
      @onCreated="handleCreated"
      @onBlur="handleBlur"
    />
    <AttachmentsDialog
      ref="attachmentsDialogRef"
      :language-code="languageCode"
      :multiple="true"
      :mimetype-prefix="currentMimePrefix"
      @select="onAttachmentsSelected"
    />
  </div>
</template>

<script>
import { onBeforeUnmount, ref, shallowRef, computed, nextTick } from 'vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { DomEditor } from '@wangeditor/editor'
import AttachmentsDialog from './AttachmentsDialog.vue'
import { resolveAttachmentUrl } from '@/utils/attachmentUrl'
import { useSiteStore } from '@/store/site'

export default {
  name: 'RichEditor5',
  components: { Editor, Toolbar, AttachmentsDialog },
  props: {
    modelValue: { type: String, default: '' },
    languageCode: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { emit }) {
    const site = useSiteStore()
    const editorRef = shallowRef()
    const attachmentsDialogRef = ref(null)
    const insertFn = ref(null)
    const insertType = ref('image')
    const currentMimePrefix = computed(() => {
      if (insertType.value === 'image') return 'image/'
      if (insertType.value === 'video') return 'video/'
      if (insertType.value === 'audio') return 'audio/'
      return ''
    })

    const valueHtml = computed({
      get() {
        return props.modelValue
      },
      set(v) {
        emit('update:modelValue', v)
      }
    })

    const toolbarConfig = {
      toolbarKeys: [
        'headerSelect',
        'blockquote',
        '|',
        'bold',
        'underline',
        'italic',
        'through',
        'code',
        'clearStyle',
        '|',
        'color',
        'bgColor',
        'fontSize',
        'fontFamily',
        'lineHeight',
        '|',
        'bulletedList',
        'numberedList',
        'todo',
        {
          key: 'group-justify',
          title: '对齐',
          iconSvg:
            '<svg viewBox="0 0 1024 1024"><path d="M768 793.6v102.4H51.2v-102.4h716.8z m204.8-230.4v102.4H51.2v-102.4h921.6z m-204.8-230.4v102.4H51.2v-102.4h716.8zM972.8 102.4v102.4H51.2V102.4h921.6z"></path></svg>',
          menuKeys: [
            'justifyLeft',
            'justifyRight',
            'justifyCenter',
            'justifyJustify'
          ]
        },
        {
          key: 'group-indent',
          title: '缩进',
          iconSvg:
            '<svg viewBox="0 0 1024 1024"><path d="M0 64h1024v128H0z m384 192h640v128H384z m0 192h640v128H384z m0 192h640v128H384zM0 832h1024v128H0z m0-128V320l256 192z"></path></svg>',
          menuKeys: ['indent', 'delIndent']
        },
        '|',
        'insertLink',
        'insertImage',
        'uploadImage',
        'insertVideo',
        'uploadVideo',
        'insertTable',
        'codeBlock',
        'divider',
        '|',
        'undo',
        'redo',
        '|',
        'fullScreen'
      ]
    }

    const editorConfig = {
      placeholder: '请输入内容...',
      autoFocus: false,
      hoverbarKeys: {
        link: { menuKeys: ['editLink', 'unLink', 'viewLink'] },
        image: {
          menuKeys: [
            'imageWidth33',
            'imageWidth50',
            'imageWidth100',
            'editImage',
            'viewImageLink',
            'deleteImage'
          ]
        },
        pre: { menuKeys: ['enter', 'codeBlock', 'codeSelectLang'] },
        table: {
          menuKeys: [
            'enter',
            'tableHeader',
            'tableFullWidth',
            'insertTableRow',
            'deleteTableRow',
            'insertTableCol',
            'deleteTableCol',
            'deleteTable'
          ]
        },
        divider: { menuKeys: ['enter'] },
        video: { menuKeys: ['enter', 'editVideoSize'] }
      }
    }

    onBeforeUnmount(() => {
      const editor = editorRef.value
      if (editor == null) return
      editor.destroy()
    })

    function handleCreated(editor) {
      editorRef.value = editor
      const config = editor.getConfig()
      config.MENU_CONF['uploadImage'] = {
        customBrowseAndUpload(fn) {
          insertFn.value = fn
          insertType.value = 'image'
          openAttachmentsDialog()
        }
      }
      config.MENU_CONF['uploadVideo'] = {
        customBrowseAndUpload(fn) {
          insertFn.value = fn
          insertType.value = 'video'
          openAttachmentsDialog()
        }
      }
      config.MENU_CONF['insertVideo'] = {
        checkVideo: src => !!src,
        parseVideoSrc: v => v
      }
      config.MENU_CONF['codeSelectLang'] = {
        codeLangs: [
          { text: 'CSS', value: 'css' },
          { text: 'HTML', value: 'html' },
          { text: 'JavaScript', value: 'javascript' },
          { text: 'TypeScript', value: 'typescript' },
          { text: 'Python', value: 'python' },
          { text: 'Java', value: 'java' },
          { text: 'SQL', value: 'sql' },
          { text: 'Bash', value: 'bash' },
          { text: 'JSON', value: 'json' },
          { text: 'Markdown', value: 'markdown' }
        ]
      }
    }

    function openAttachmentsDialog() {
      nextTick(() => {
        attachmentsDialogRef.value && attachmentsDialogRef.value.open()
      })
    }

    async function onAttachmentsSelected(attachments) {
      if (!attachments || !attachments.length) return
      for (const item of attachments) {
        const url = resolveAttachmentUrl(item, site.sourceBlogPublicOrigin)
        if (!url) continue
        if (insertFn.value && insertType.value === 'image') {
          await insertFn.value(url, item.name || item.filename || '', url)
        } else if (insertFn.value && insertType.value === 'video') {
          await insertFn.value(url, item.thumfor || '')
        } else {
          // 默认按图片插入
          const editor = editorRef.value
          if (editor) {
            editor.dangerouslyInsertHtml(
              `<img src="${url}" alt="${escapeHtml(
                item.name || item.filename || ''
              )}" />`
            )
          }
        }
      }
      insertFn.value = null
    }

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    function handleBlur() {
      emit('blur')
    }

    return {
      editorRef,
      valueHtml,
      toolbarConfig,
      editorConfig,
      handleCreated,
      handleBlur,
      attachmentsDialogRef,
      currentMimePrefix,
      onAttachmentsSelected
    }
  }
}
</script>

<style>
@import '@wangeditor/editor/dist/css/style.css';
.editor-body.richeditor-5 .w-e-modal {
  padding: 20px 15px 0;
}
</style>

<style scoped>
.editor-body {
  border: 1px solid #ccc;
  line-height: 1.15;
  z-index: 2;
  width: 100%;
  box-sizing: border-box;
}
</style>
