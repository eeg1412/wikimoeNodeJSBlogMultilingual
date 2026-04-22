import { DomEditor } from '@wangeditor/editor'
import { Transforms } from 'slate'

function withImageGroup(editor) {
  const { isVoid, normalizeNode } = editor
  const nextEditor = editor

  nextEditor.isVoid = elem => {
    const type = DomEditor.getNodeType(elem)
    if (type === 'imageGroup') {
      return true
    }

    return isVoid(elem)
  }

  nextEditor.normalizeNode = ([node, path]) => {
    const type = DomEditor.getNodeType(node)
    if (type === 'imageGroup' && DomEditor.isLastNode(nextEditor, node)) {
      Transforms.insertNodes(nextEditor, DomEditor.genEmptyParagraph(), {
        at: [path[0] + 1]
      })
    }

    return normalizeNode([node, path])
  }

  return nextEditor
}

export default withImageGroup
