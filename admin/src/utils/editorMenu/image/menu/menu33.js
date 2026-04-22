import { DomEditor } from '@wangeditor/core'
import { Transforms } from 'slate'

class ImageWidth33ButtonMenu {
  constructor() {
    this.title = '33%'
    this.tag = 'button'
  }

  getValue() {
    return ''
  }

  isActive() {
    return false
  }

  getSelectedNode(editor) {
    return DomEditor.getSelectedNodeByType(editor, 'image')
  }

  isDisabled(editor) {
    if (editor.selection == null) {
      return true
    }

    return !this.getSelectedNode(editor)
  }

  exec(editor) {
    if (this.isDisabled(editor)) {
      return
    }

    const imageNode = this.getSelectedNode(editor)
    const hoverbar = DomEditor.getHoverbar(editor)
    if (hoverbar) {
      hoverbar.hideAndClean()
    }

    const { style = {} } = imageNode
    Transforms.setNodes(
      editor,
      {
        style: {
          ...style,
          width: '33.33333333%',
          height: ''
        }
      },
      {
        match: node => DomEditor.checkNodeType(node, 'image')
      }
    )
  }
}

const imageWidth33Conf = {
  key: 'imageWidth33',
  factory() {
    return new ImageWidth33ButtonMenu()
  }
}

export default imageWidth33Conf
