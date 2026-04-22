import { Boot, i18nAddResources } from '@wangeditor/editor'
import editorMenuEventSpan from './editorMenu/event/index.js'
import editorMenuImageGroup from './editorMenu/imageGroup/index.js'
import editorMenuPanorama360 from './editorMenu/panorama360/index.js'
import editorMenuImage from './editorMenu/image/index.js'

let initialized = false

i18nAddResources('zh-CN', {
  videoModule: {
    uploadVideo: '从媒体库插入视频'
  },
  uploadImgModule: {
    uploadImage: '从媒体库插入图片'
  }
})

const imageToHtmlConf = {
  type: 'image',
  elemToHtml: elemNode => {
    const {
      src,
      alt = '',
      href = '',
      style = {},
      width,
      height,
      hrefWidth,
      hrefHeight
    } = elemNode
    const { width: styleWidth = '', height: styleHeight = '' } = style

    let styleStr = ''
    if (styleWidth) {
      styleStr += `width: ${styleWidth};`
    }
    if (styleHeight) {
      styleStr += `height: ${styleHeight};`
    }

    return `<img src="${src}" alt="${alt}"${
      href ? ` data-href="${href}"` : ''
    }${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}${
      hrefWidth ? ` data-href-width="${hrefWidth}"` : ''
    }${
      hrefHeight ? ` data-href-height="${hrefHeight}"` : ''
    } style="${styleStr}">`
  }
}

function genSizeStyledIframeHtml(iframeHtml, width = '', height = '') {
  const parser = new DOMParser()
  const doc = parser.parseFromString(iframeHtml, 'text/html')
  const iframe = doc.querySelector('iframe')

  if (!iframe) {
    return ''
  }

  if (width && width !== 'auto') {
    iframe.setAttribute('width', width)
  }
  if (height && height !== 'auto') {
    iframe.setAttribute('height', height)
  }
  if (width && height && width !== 'auto' && height !== 'auto') {
    iframe.setAttribute(
      'style',
      `width: 100%; height: auto; aspect-ratio: ${width} / ${height};`
    )
  }

  return iframe.outerHTML
}

const videoToHtmlConf = {
  type: 'video',
  elemToHtml: elemNode => {
    const { src = '', poster = '', width = '', height = '' } = elemNode
    let html = '<div data-w-e-type="video" data-w-e-is-void>\n'

    if (src.trim().indexOf('<iframe ') === 0) {
      html += genSizeStyledIframeHtml(src, width, height)
    } else {
      html += `<video poster="${poster}" playsinline="true" preload="none" muted="muted" loop="loop" controls="true"${
        width && width !== 'auto' ? ` width="${width}"` : ''
      }${
        height && height !== 'auto' ? ` height="${height}"` : ''
      }><source src="${src}" type="video/mp4"/></video>`
    }

    html += '\n</div>'
    return html
  }
}

function getStyleValue(elem, styleKey) {
  let result = ''
  const styleStr = elem.getAttribute('style') || ''
  const styleArr = styleStr.split(';')

  for (const styleItemStr of styleArr) {
    if (!styleItemStr) {
      continue
    }

    const parts = styleItemStr.split(':')
    if (parts[0]?.trim() === styleKey) {
      result = parts[1]?.trim() || ''
    }
  }

  return result
}

function parseImgHtml(elem) {
  let href = elem.getAttribute('data-href') || ''
  href = decodeURIComponent(href)

  return {
    type: 'image',
    src: elem.getAttribute('src') || '',
    alt: elem.getAttribute('alt') || '',
    width: elem.getAttribute('width') || '',
    height: elem.getAttribute('height') || '',
    hrefWidth: elem.getAttribute('data-href-width') || '',
    hrefHeight: elem.getAttribute('data-href-height') || '',
    href,
    style: {
      width: getStyleValue(elem, 'width'),
      height: getStyleValue(elem, 'height')
    },
    children: [{ text: '' }]
  }
}

const parseImgHtmlConf = {
  selector: 'img:not([data-w-e-type])',
  parseElemHtml: parseImgHtml
}

export function initRichEditor() {
  if (initialized) {
    return
  }

  Boot.registerElemToHtml(imageToHtmlConf)
  Boot.registerParseElemHtml(parseImgHtmlConf)
  Boot.registerElemToHtml(videoToHtmlConf)
  Boot.registerModule(editorMenuEventSpan)
  Boot.registerModule(editorMenuImageGroup)
  Boot.registerModule(editorMenuPanorama360)
  Boot.registerModule(editorMenuImage)

  initialized = true
}
