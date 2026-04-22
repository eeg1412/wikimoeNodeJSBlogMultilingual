import { DomEditor } from '@wangeditor/core'
import { Transforms } from 'slate'

function withPanorama360(editor) {
  const { isInline, isVoid, normalizeNode } = editor
  const nextEditor = editor

  nextEditor.isInline = elem => {
    const type = DomEditor.getNodeType(elem)
    if (type === 'panorama360') {
      return false
    }
    return isInline(elem)
  }

  nextEditor.isVoid = elem => {
    const type = DomEditor.getNodeType(elem)
    if (type === 'panorama360') {
      return true
    }
    return isVoid(elem)
  }

  nextEditor.normalizeNode = ([node, path]) => {
    const type = DomEditor.getNodeType(node)
    if (type === 'panorama360' && DomEditor.isLastNode(nextEditor, node)) {
      Transforms.insertNodes(nextEditor, DomEditor.genEmptyParagraph(), {
        at: [path[0] + 1]
      })
    }
    return normalizeNode([node, path])
  }

  return nextEditor
}

export default withPanorama360
