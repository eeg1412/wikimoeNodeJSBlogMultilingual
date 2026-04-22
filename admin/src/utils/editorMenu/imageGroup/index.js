import withImageGroup from './plugin.js'
import renderElemConf from './render-elem.js'
import elemToHtmlConf from './elem-to-html.js'
import parseHtmlConf from './parse-elem-html.js'
import menuConf from './menu/menu.js'

const module = {
  editorPlugin: withImageGroup,
  renderElems: [renderElemConf],
  elemsToHtml: [elemToHtmlConf],
  parseElemsHtml: [parseHtmlConf],
  menus: [menuConf]
}

export default module
