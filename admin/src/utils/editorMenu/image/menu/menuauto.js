import { DomEditor } from '@wangeditor/core'
import { Transforms } from 'slate'

class ImageWidthAutoButtonMenu {
  constructor() {
    this.title = 'auto'
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
          width: '',
          height: ''
        }
      },
      {
        match: node => DomEditor.checkNodeType(node, 'image')
      }
    )
  }
}

const imageWidthAutoConf = {
  key: 'imageWidthauto',
  factory() {
    return new ImageWidthAutoButtonMenu()
  }
}

export default imageWidthAutoConf
