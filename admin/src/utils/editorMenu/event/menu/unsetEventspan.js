import { DomEditor } from '@wangeditor/core'
import { Transforms } from 'slate'

class UnsetEventspan {
  constructor() {
    this.title = '取消活动'
    this.iconSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M128 0c13.3 0 24 10.7 24 24V64H296V24c0-13.3 10.7-24 24-24s24 10.7 24 24V64h40c35.3 0 64 28.7 64 64v16 48V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V192 144 128C0 92.7 28.7 64 64 64h40V24c0-13.3 10.7-24 24-24zM400 192H48V448c0 8.8 7.2 16 16 16H384c8.8 0 16-7.2 16-16V192zm-95 89l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>'
    this.tag = 'button'
  }

  getValue() {
    return ''
  }

  isActive() {
    return false
  }

  isDisabled(editor) {
    if (editor.selection == null) {
      return true
    }
    return !DomEditor.getSelectedNodeByType(editor, 'eventspan')
  }

  exec(editor) {
    if (this.isDisabled(editor)) {
      return
    }

    let text = ''
    Transforms.removeNodes(editor, {
      match: node => {
        if (node.type === 'eventspan') {
          text = node.textContent
          return true
        }
        return false
      }
    })
    Transforms.insertText(editor, text)
  }
}

const unsetEventspanConf = {
  key: 'uneventspan',
  factory() {
    return new UnsetEventspan()
  }
}

export default unsetEventspanConf
