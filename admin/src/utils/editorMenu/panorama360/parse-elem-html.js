function parseHtml(domElem) {
  const imgElem = domElem.querySelector('img.w-e-panorama360-img')
  if (imgElem == null) {
    return null
  }

  return {
    type: 'panorama360',
    src: imgElem.getAttribute('src'),
    width: imgElem.getAttribute('width'),
    height: imgElem.getAttribute('height'),
    dataHref: imgElem.getAttribute('data-href'),
    dataHrefWidth: imgElem.getAttribute('data-href-width'),
    dataHrefHeight: imgElem.getAttribute('data-href-height'),
    alt: imgElem.getAttribute('alt'),
    children: [{ text: '' }]
  }
}

function parsePanorama360HtmlConf() {
  return {
    selector: 'div.w-e-panorama360',
    parseElemHtml: parseHtml
  }
}

export default parsePanorama360HtmlConf
