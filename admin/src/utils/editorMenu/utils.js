import { Editor } from 'slate'
import { DomEditor } from '@wangeditor/core'

export function isInsertSpanDisabled(editor) {
  const { selection } = editor
  if (selection == null) {
    return true
  }

  const [match] = Editor.nodes(editor, {
    match: node => {
      const type = DomEditor.getNodeType(node)

      if (type === 'code') return true
      if (type === 'pre') return true
      if (type === 'link') return true
      if (type === 'blockquote') return true
      if (type === 'image') return true
      if (type === 'video') return true
      if (type === 'eventspan') return true
      if (Editor.isVoid(editor, node)) return true

      return false
    },
    universal: true
  })

  return !!match
}
