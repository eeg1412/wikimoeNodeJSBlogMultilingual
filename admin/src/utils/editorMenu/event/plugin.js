import { DomEditor } from '@wangeditor/editor'

function withEventspan(editor) {
  const { isInline, isVoid } = editor
  const nextEditor = editor

  nextEditor.isInline = elem => {
    const type = DomEditor.getNodeType(elem)
    if (type === 'eventspan') {
      return true
    }
    return isInline(elem)
  }

  nextEditor.isVoid = elem => {
    const type = DomEditor.getNodeType(elem)
    if (type === 'eventspan') {
      return true
    }
    return isVoid(elem)
  }

  return nextEditor
}

export default withEventspan
