import request from '../utils/request.js'

export function getOptions() {
  return request.get('/option/list')
}

export function updateOption(data) {
  return request.put('/option/update', data)
}

export function updateOptions(optionList) {
  return request.put('/option/update', { optionList })
}
