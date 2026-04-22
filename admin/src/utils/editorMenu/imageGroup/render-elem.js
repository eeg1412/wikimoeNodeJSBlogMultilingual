import { h } from 'snabbdom'
import { DomEditor } from '@wangeditor/core'

function renderImageGroup(elem, children, editor) {
  const cards = (elem.childrenList || []).map(child =>
    h(
      'div',
      {
        className: 'w-e-image-group-img-body'
      },
      [
        h('img', {
          className: 'w-e-image-group-img',
          src: child.src,
          width: child.width,
          height: child.height,
          'data-href': child.dataHref,
          'data-href-width': child.dataHrefWidth,
          'data-href-height': child.dataHrefHeight,
          alt: child.alt,
          text: ''
        })
      ]
    )
  )

  const selected = DomEditor.isNodeSelected(editor, elem)
  let className = 'w-e-image-group'

  if ((elem.childrenList || []).length % 2 === 0) {
    className += ' w-e-image-group-even'
  } else {
    className += ' w-e-image-group-odd'
  }

  if (selected) {
    className += ' w-e-selected'
  }

  return h(
    'div',
    {
      className
    },
    cards
  )
}

const conf = {
  type: 'imageGroup',
  renderElem: renderImageGroup
}

export default conf
