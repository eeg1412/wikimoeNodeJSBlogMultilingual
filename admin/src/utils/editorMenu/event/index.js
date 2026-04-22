import withEventspan from './plugin.js'
import renderElemConf from './render-elem.js'
import elemToHtmlConf from './elem-to-html.js'
import parseHtmlConf from './parse-elem-html.js'
import menuConf from './menu/menu.js'
import unEventspanConf from './menu/unsetEventspan.js'
import editEventspanConf from './menu/editEventspan.js'

const module = {
  editorPlugin: withEventspan,
  renderElems: [renderElemConf],
  elemsToHtml: [elemToHtmlConf],
  parseElemsHtml: [parseHtmlConf],
  menus: [menuConf, unEventspanConf, editEventspanConf]
}

export default module
