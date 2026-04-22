function parseHtml(elem) {
  const children = []

  for (const divChild of elem.children) {
    if (divChild.tagName.toLowerCase() !== 'div') {
      continue
    }

    const child = divChild.children[0]
    children.push({
      src: child.getAttribute('src'),
      width: child.getAttribute('width'),
      height: child.getAttribute('height'),
      dataHref: child.getAttribute('data-href'),
      dataHrefWidth: child.getAttribute('data-href-width'),
      dataHrefHeight: child.getAttribute('data-href-height'),
      alt: child.alt,
      text: ''
    })
  }

  return {
    type: 'imageGroup',
    childrenList: children,
    children: [{ text: '' }]
  }
}

const parseHtmlConf = {
  selector: 'div[data-w-e-type="imageGroup"]',
  parseElemHtml: parseHtml
}

export default parseHtmlConf
