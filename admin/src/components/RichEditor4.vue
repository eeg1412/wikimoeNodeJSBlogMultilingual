<template>
  <div class="editor-body">
    <div ref="editorRef"></div>
    <MultilingualRichMediaDialog
      :shouldSelectOk="true"
      ref="attachmentsDialogRef"
      :typeList="['image']"
      :language-code="languageCode"
      @selectAttachments="selectAttachments"
    />
  </div>
</template>

<script>
import { onBeforeUnmount, ref, shallowRef, onMounted, watch } from 'vue'
import MultilingualRichMediaDialog from '@/components/MultilingualRichMediaDialog.vue'
import E from 'wangeditor'
import { getRichEditorMediaUrls } from '@/utils/richEditorMediaUrl'

export default {
  props: {
    content: {
      type: String,
      default: ''
    },
    languageCode: {
      type: String,
      default: ''
    }
  },
  components: { MultilingualRichMediaDialog },
  setup(props, { emit }) {
    // 编辑器实例，必须用 shallowRef
    const editorRef = ref()

    const attachmentsDialogRef = ref(null)
    const openAttachmentsDialog = () => {
      attachmentsDialogRef.value.open()
    }
    const getTime = () => {
      return new Date().getTime()
    }
    const selectAttachments = attachments => {
      console.log(attachments)
      attachments.forEach(item => {
        const mediaUrls = getRichEditorMediaUrls(item, getTime(), {
          sourceSiteUrl: item.sourceSiteUrl || ''
        })
        // v4版本的data-href需要uri解码
        editor.cmd.do(
          'insertHTML',
          `<img src="${mediaUrls.src}" width="${
            item.thumWidth || item.width
          }" height="${item.thumHeight || item.height}" data-href="${
            mediaUrls.href
          }" />`
        )
      })
    }

    let editor = null
    const initEditor = () => {
      editor = new E(editorRef.value)
      editor.config.height = 500
      editor.config.uploadImgFromMedia = function () {
        openAttachmentsDialog()
      }
      editor.create()
      editor.txt.html(props.content)
      let sendHtmlTimeout = null
      editor.config.onchange = newHtml => {
        if (sendHtmlTimeout) {
          clearTimeout(sendHtmlTimeout)
        }
        sendHtmlTimeout = setTimeout(() => {
          emit('update:content', newHtml)
        }, 100)
      }
    }

    // 重置编辑器内容
    const resetContent = () => {
      editor.txt.html(props.content)
    }

    onMounted(() => {
      initEditor()
    })

    // 组件销毁时，也及时销毁编辑器
    onBeforeUnmount(() => {
      if (editor) {
        editor.destroy()
        console.log('editor destroyed')
      }
    })

    return {
      editorRef,
      // 媒体库
      attachmentsDialogRef,
      openAttachmentsDialog,
      selectAttachments,
      resetContent
    }
  }
}
</script>
<style scoped>
.editor-body {
  border: 1px solid #ccc;
  line-height: 1.15;
  z-index: 2;
  width: 100%;
  box-sizing: border-box;
}
</style>
