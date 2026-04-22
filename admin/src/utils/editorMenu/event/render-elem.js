import { h } from 'snabbdom'

function renderEventspan(elem) {
  return h(
    'span',
    {
      style: {
        cursor: 'pointer',
        color: 'var(--el-color-primary)'
      }
    },
    [{ text: elem.textContent }]
  )
}

const conf = {
  type: 'eventspan',
  renderElem: renderEventspan
}

export default conf
