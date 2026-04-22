function eventspanToHtml(elem) {
  const { id = '', textContent = '' } = elem
  return `<span data-w-e-type="eventspan" data-w-e-is-void data-w-e-is-inline data-id="${id}">${textContent}</span>`
}

const conf = {
  type: 'eventspan',
  elemToHtml: eventspanToHtml
}

export default conf
