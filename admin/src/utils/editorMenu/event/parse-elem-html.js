function parseHtml(elem) {
  const id = elem.getAttribute('data-id') || ''
  const textContent = elem.textContent || ''
  return {
    type: 'eventspan',
    id,
    textContent,
    children: [{ text: textContent }]
  }
}

const parseHtmlConf = {
  selector: 'span[data-w-e-type="eventspan"]',
  parseElemHtml: parseHtml
}

export default parseHtmlConf
