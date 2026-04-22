function imageGroupToHtml(elem) {
  const { childrenList = [] } = elem
  let className = 'w-e-image-group'

  if (childrenList.length % 2 === 0) {
    className += ' w-e-image-group-even'
  } else {
    className += ' w-e-image-group-odd'
  }

  let html = `<div data-w-e-type="imageGroup" data-w-e-is-void class="${className}">`
  for (const child of childrenList) {
    html += `<div class="w-e-image-group-img-body"><img src="${child.src}" class="w-e-image-group-img" width="${child.width}" height="${child.height}" data-href="${child.dataHref}" data-href-width="${child.dataHrefWidth}" data-href-height="${child.dataHrefHeight}" alt="${child.alt}" /></div>`
  }
  html += '</div>'
  return html
}

const conf = {
  type: 'imageGroup',
  elemToHtml: imageGroupToHtml
}

export default conf
