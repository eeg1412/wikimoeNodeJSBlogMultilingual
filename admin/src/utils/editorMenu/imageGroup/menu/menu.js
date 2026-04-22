import { Range } from 'slate'
import { DomEditor } from '@wangeditor/core'

class ImageGroupButtonMenu {
  constructor() {
    this.title = '从媒体库插入图片组'
    this.iconSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M160 80l352 0c8.8 0 16 7.2 16 16l0 224c0 8.8-7.2 16-16 16l-21.2 0L388.1 178.9c-4.4-6.8-12-10.9-20.1-10.9s-15.7 4.1-20.1 10.9l-52.2 79.8-12.4-16.9c-4.5-6.2-11.7-9.8-19.4-9.8s-14.8 3.6-19.4 9.8L175.6 336 160 336c-8.8 0-16-7.2-16-16l0-224c0-8.8 7.2-16 16-16zM96 96l0 224c0 35.3 28.7 64 64 64l352 0c35.3 0 64-28.7 64-64l0-224c0-35.3-28.7-64-64-64L160 32c-35.3 0-64 28.7-64 64zM48 120c0-13.3-10.7-24-24-24S0 106.7 0 120L0 344c0 75.1 60.9 136 136 136l320 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-320 0c-48.6 0-88-39.4-88-88l0-224z"/></svg>'
    this.tag = 'button'
  }

  getValue() {
    return ''
  }

  isActive() {
    return false
  }

  isDisabled(editor) {
    const { selection } = editor
    if (selection == null || !Range.isCollapsed(selection)) {
      return true
    }

    return DomEditor.getSelectedElems(editor).some(elem => {
      const type = DomEditor.getNodeType(elem)
      if (type === 'pre' || type === 'list-item') {
        return true
      }
      return editor.isVoid(elem)
    })
  }

  exec(editor) {
    if (this.isDisabled(editor)) {
      return
    }

    editor.openAttachmentsDialog?.('imageGroup')
  }
}

const menuConf = {
  key: 'imageGroup',
  factory() {
    return new ImageGroupButtonMenu()
  }
}

export default menuConf
