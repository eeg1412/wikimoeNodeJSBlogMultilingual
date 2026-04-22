import withPanorama360 from './plugin.js'
import renderElemConf from './render-elem.js'
import elemToHtmlConf from './elem-to-html.js'
import parsePanorama360HtmlConf from './parse-elem-html.js'
import menuConf from './menu/menu.js'

const module = {
  editorPlugin: withPanorama360,
  renderElems: [renderElemConf],
  elemsToHtml: [elemToHtmlConf],
  parseElemsHtml: [parsePanorama360HtmlConf()],
  menus: [menuConf]
}

export default module
