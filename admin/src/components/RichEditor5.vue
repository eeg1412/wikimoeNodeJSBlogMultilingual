<template>
  <div class="editor-body richeditor-5">
    <Toolbar
      :editor="editorRef"
      :default-config="toolbarConfig"
      mode="default"
      style="border-bottom: 1px solid var(--admin-border)"
    />
    <Editor
      v-model="valueHtml"
      :default-config="editorConfig"
      mode="default"
      style="height: 500px; overflow-y: hidden"
      @on-created="handleCreated"
      @on-blur="handleBlur"
    />

    <AttachmentSelectorDialog
      ref="attachmentsDialogRef"
      :language-code="languageCode"
      :type-list="attachmentTypeList"
      @select-attachments="selectAttachments"
    />
    <RichEditorEventSelectorDialog
      v-model:show="showEventDialog"
      :text="eventText"
      :id="eventId"
      :language-code="languageCode"
      @ok="onEventDialogOk"
    />
  </div>
</template>

<script>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch
} from 'vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { DomEditor, SlateTransforms } from '@wangeditor/editor'
import AttachmentSelectorDialog from './AttachmentSelectorDialog.vue'
import RichEditorEventSelectorDialog from './RichEditorEventSelectorDialog.vue'

function createMediaUrl(item) {
  if (!item) {
    return ''
  }
  if (item.previewUrl) {
    return item.previewUrl
  }
  if (item.externalUrl) {
    return item.externalUrl
  }
  return item.filepath || ''
}

function createOriginUrl(item) {
  if (!item) {
    return ''
  }
  if (item.externalUrl) {
    return item.externalUrl
  }
  return item.filepath || item.previewUrl || ''
}

export default {
  name: 'RichEditor5',
  components: {
    AttachmentSelectorDialog,
    Editor,
    RichEditorEventSelectorDialog,
    Toolbar
  },
  props: {
    content: {
      type: String,
      default: ''
    },
    languageCode: {
      type: String,
      default: ''
    },
    isPost: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:content', 'blur'],
  setup(props, { emit }) {
    const editorRef = shallowRef()

    const valueHtml = computed({
      get() {
        return props.content
      },
      set(value) {
        emit('update:content', value)
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
        {
          key: 'group-more-style',
          title: '更多',
          iconSvg:
            '<svg viewBox="0 0 1024 1024"><path d="M204.8 505.6m-76.8 0a76.8 76.8 0 1 0 153.6 0 76.8 76.8 0 1 0-153.6 0Z"></path><path d="M505.6 505.6m-76.8 0a76.8 76.8 0 1 0 153.6 0 76.8 76.8 0 1 0-153.6 0Z"></path><path d="M806.4 505.6m-76.8 0a76.8 76.8 0 1 0 153.6 0 76.8 76.8 0 1 0-153.6 0Z"></path></svg>',
          menuKeys: ['through', 'code', 'sup', 'sub', 'clearStyle']
        },
        'color',
        'bgColor',
        '|',
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
        'emotion',
        'insertLink',
        {
          key: 'group-image',
          title: '图片',
          iconSvg:
            '<svg viewBox="0 0 1024 1024"><path d="M959.877 128l0.123 0.123v767.775l-0.123 0.122H64.102l-0.122-0.122V128.123l0.122-0.123h895.775zM960 64H64C28.795 64 0 92.795 0 128v768c0 35.205 28.795 64 64 64h896c35.205 0 64-28.795 64-64V128c0-35.205-28.795-64-64-64zM832 288.01c0 53.023-42.988 96.01-96.01 96.01s-96.01-42.987-96.01-96.01S682.967 192 735.99 192 832 234.988 832 288.01zM896 832H128V704l224.01-384 256 320h64l224.01-192z"></path></svg>',
          menuKeys: [
            'insertImage',
            'uploadImage',
            ...(props.isPost ? ['imageGroup', 'panorama360'] : [])
          ]
        },
        {
          key: 'group-video',
          title: '视频',
          iconSvg:
            '<svg viewBox="0 0 1024 1024"><path d="M981.184 160.096C837.568 139.456 678.848 128 512 128S186.432 139.456 42.816 160.096C15.296 267.808 0 386.848 0 512s15.264 244.16 42.816 351.904C186.464 884.544 345.152 896 512 896s325.568-11.456 469.184-32.096C1008.704 756.192 1024 637.152 1024 512s-15.264-244.16-42.816-351.904zM384 704V320l320 192-320 192z"></path></svg>',
          menuKeys: ['insertVideo', 'uploadVideo']
        },
        'insertTable',
        'codeBlock',
        'divider',
        '|',
        'undo',
        'redo',
        ...(props.isPost ? ['|', 'eventspan'] : []),
        '|',
        'fullScreen'
      ]
    }

    const editorConfig = {
      placeholder: '请输入内容...',
      autoFocus: false,
      hoverbarKeys: {
        link: {
          menuKeys: ['editLink', 'unLink', 'viewLink']
        },
        image: {
          menuKeys: [
            'imageWidth33',
            'imageWidthauto',
            'editImage',
            'viewImageLink',
            'deleteImage'
          ]
        },
        pre: {
          menuKeys: ['enter', 'codeBlock', 'codeSelectLang']
        },
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
        divider: {
          menuKeys: ['enter']
        },
        video: {
          menuKeys: ['enter', 'editVideoSize']
        },
        ...(props.isPost
          ? {
              eventspan: {
                menuKeys: ['uneventspan', 'editeventspan']
              }
            }
          : {})
      }
    }

    onBeforeUnmount(() => {
      if (editorRef.value) {
        editorRef.value.destroy()
      }
    })

    let insertFn = null
    const attachmentTypeList = ref([])
    const attachmentsDialogRef = ref(null)
    const openAttachmentsDialogType = ref('')

    function openAttachmentsDialog(type = '') {
      openAttachmentsDialogType.value = type
      if (type === 'imageGroup' || type === 'panorama360') {
        attachmentTypeList.value = ['image']
      } else {
        attachmentTypeList.value = [insertFn === null ? 'image' : attachmentTypeList.value[0]]
      }
      nextTick(() => {
        attachmentsDialogRef.value?.open()
      })
    }

    function buildImageNode(item) {
      return {
        src: createMediaUrl(item),
        width: item.thumWidth || item.width,
        height: item.thumHeight || item.height,
        dataHref: createOriginUrl(item),
        dataHrefWidth: item.width,
        dataHrefHeight: item.height,
        alt: item.description || item.filename || item.name || '',
        text: ''
      }
    }

    async function selectAttachments(attachments) {
      const editor = editorRef.value
      if (!editor || !Array.isArray(attachments) || attachments.length === 0) {
        return
      }

      if (openAttachmentsDialogType.value === 'imageGroup') {
        editor.restoreSelection()
        setTimeout(() => {
          const imageGroupElem = {
            type: 'imageGroup',
            children: [{ text: '' }],
            childrenList: attachments.map(buildImageNode)
          }
          SlateTransforms.insertNodes(editor, [imageGroupElem])
        }, 100)
      } else if (openAttachmentsDialogType.value === 'panorama360') {
        editor.restoreSelection()
        setTimeout(() => {
          for (let index = 0; index < attachments.length; index += 1) {
            const item = attachments[index]
            const panoramaElem = {
              type: 'panorama360',
              src: createMediaUrl(item),
              width: item.thumWidth || item.width || '100%',
              height: item.thumHeight || item.height || '400px',
              dataHref: createOriginUrl(item),
              dataHrefWidth: item.width || '',
              dataHrefHeight: item.height || '',
              alt: item.description || item.filename || item.name || '360°全景图片',
              children: [{ text: '' }]
            }
            SlateTransforms.insertNodes(editor, panoramaElem)

            if (index < attachments.length - 1) {
              SlateTransforms.insertNodes(editor, {
                type: 'paragraph',
                children: [{ text: '' }]
              })
            }
          }
        }, 100)
      } else {
        for (const item of attachments) {
          if (!insertFn) {
            continue
          }

          let insertFnPromise = null
          if (attachmentTypeList.value[0] === 'image') {
            insertFnPromise = insertFn(
              createMediaUrl(item),
              item.description || item.filename || item.name || '',
              createOriginUrl(item)
            )
          } else if (attachmentTypeList.value[0] === 'video') {
            insertFnPromise = insertFn(createOriginUrl(item), createMediaUrl(item))
          }

          await insertFnPromise
          SlateTransforms.setNodes(
            editor,
            {
              width: item.thumWidth || item.width,
              height: item.thumHeight || item.height,
              hrefWidth: item.width,
              hrefHeight: item.height
            },
            {
              match: node => node.type === 'image' || node.type === 'video'
            }
          )
        }
      }

      openAttachmentsDialogType.value = ''
    }

    function handleCreated(editor) {
      editorRef.value = editor
      editor.openEventDialog = openEventDialog
      editor.openAttachmentsDialog = openAttachmentsDialog

      const editorDom = editor.getEditableContainer()
      const originalInsertBreak = editor.insertBreak
      let isShiftEnter = false

      editorDom.addEventListener('keydown', event => {
        if (event.shiftKey && event.keyCode === 13) {
          isShiftEnter = true
        }
      })

      editor.insertBreak = () => {
        if (isShiftEnter) {
          editor.dangerouslyInsertHtml('<br>')
        } else {
          originalInsertBreak.call(editor)
        }
        isShiftEnter = false
      }

      const config = editor.getConfig()
      config.MENU_CONF.emotion = {
        emotions:
          '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 😘 😗 😙 😚 😋 😛 😝 😜 🤓 😎 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 😢 😭 😤 😠 😡 😳 😱 😨 🤗 🤔 😶 😑 😬 🙄 😯 😴 😷 🤑 😈 🤡 💩 👻 💀 👀 👣 👐 🙌 👏'.split(
            ' '
          )
      }
      config.MENU_CONF.codeSelectLang = {
        codeLangs: [
          { text: 'CSS', value: 'css' },
          { text: 'HTML', value: 'html' },
          { text: 'XML', value: 'xml' },
          { text: 'Javascript', value: 'javascript' },
          { text: 'Typescript', value: 'typescript' },
          { text: 'JSX', value: 'jsx' },
          { text: 'Go', value: 'go' },
          { text: 'PHP', value: 'php' },
          { text: 'Python', value: 'python' },
          { text: 'Java', value: 'java' },
          { text: 'C', value: 'c' },
          { text: 'C++', value: 'cpp' },
          { text: 'C#', value: 'csharp' },
          { text: 'Visual Basic', value: 'visual-basic' },
          { text: 'SQL', value: 'sql' },
          { text: 'Ruby', value: 'ruby' },
          { text: 'Swift', value: 'swift' },
          { text: 'Lua', value: 'lua' },
          { text: 'Groovy', value: 'groovy' },
          { text: 'Markdown', value: 'markdown' },
          { text: 'JSON', value: 'json' },
          { text: 'Bash', value: 'bash' },
          { text: 'sh', value: 'sh' }
        ]
      }
      config.MENU_CONF.uploadImage = {
        customBrowseAndUpload(fn) {
          insertFn = fn
          attachmentTypeList.value = ['image']
          openAttachmentsDialog()
        }
      }
      config.MENU_CONF.uploadVideo = {
        customBrowseAndUpload(fn) {
          insertFn = fn
          attachmentTypeList.value = ['video']
          openAttachmentsDialog()
        }
      }
      config.MENU_CONF.insertVideo = {
        onInsertedVideo() {
          return true
        },
        checkVideo(src) {
          return !!src
        },
        parseVideoSrc(videoSrc) {
          if (videoSrc.indexOf('<iframe') !== -1) {
            return videoSrc
          }
          if (videoSrc.indexOf('.bilibili.com') !== -1) {
            const url = new URL(videoSrc)
            const bvid =
              url.searchParams.get('bvid') || url.pathname.split('/')[2]
            const p = url.searchParams.get('p') || ''
            return `<iframe src="https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=${bvid}&p=${p}&as_wide=1&danmaku=0&hasMuteButton=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" width="1280" height="720" style="width: 100%; height: auto; aspect-ratio: 1280 / 720;"> </iframe>`
          }
          return videoSrc
        }
      }
    }

    function handleBlur() {
      emit('blur')
    }

    const showEventDialog = ref(false)
    const eventText = ref('')
    const eventDialogEditMode = ref(false)
    const eventId = ref('')

    function openEventDialog(editor, editMode = false, node = null) {
      if (editMode && node) {
        eventDialogEditMode.value = true
        eventId.value = node.id
        eventText.value = node.textContent
      } else {
        eventDialogEditMode.value = false
        eventId.value = ''
        eventText.value = editor.getSelectionText() || ''
      }
      showEventDialog.value = true
    }

    watch(showEventDialog, value => {
      if (!value) {
        eventText.value = ''
        eventId.value = ''
        editorRef.value?.restoreSelection()
      }
    })

    function onEventDialogOk(form) {
      const editor = editorRef.value
      if (!editor) {
        return
      }

      if (eventDialogEditMode.value) {
        setTimeout(() => {
          SlateTransforms.setNodes(
            editor,
            {
              id: form.id,
              textContent: form.text,
              children: [{ text: form.text }]
            },
            {
              match: node => node.type === 'eventspan'
            }
          )
          editor.move(1)
        }, 100)
        return
      }

      setTimeout(() => {
        const eventspanElem = {
          type: 'eventspan',
          id: form.id,
          textContent: form.text,
          children: [{ text: form.text }]
        }
        editor.insertNode(eventspanElem)
      }, 100)
    }

    return {
      editorRef,
      valueHtml,
      toolbarConfig,
      editorConfig,
      attachmentsDialogRef,
      attachmentTypeList,
      showEventDialog,
      eventText,
      eventId,
      handleCreated,
      handleBlur,
      selectAttachments,
      onEventDialogOk
    }
  }
}
</script>

<style>
@import '@wangeditor/editor/dist/css/style.css';

.editor-body.richeditor-5 .w-e-modal {
  padding: 20px 15px 0;
}

.richeditor-5 .w-e-text-container [data-slate-editor] .w-e-image-container {
  margin: 0;
}
</style>
