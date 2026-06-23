// 数组型翻译字段（label / urlList / options）按源结构全量重建工具。
//
// 设计目标：翻译的源头有多少数据，目标就同步多少数据。采纳回填时不再逐元素“原地修补”，
// 而是以“源记录的完整数组”为权威结构整体重建目标数组：
//   - 结构（数组长度、urlList 的 url、投票选项的 _id/votes/sort）一律以源为准；
//   - 文本（label 文本、urlList[].text、options[].title）取已写入的译文，缺失时回退源文；
//   - 源比目标多的元素自动补齐，源比目标少的多余元素自动截断。
//
// 重建是“幂等且与采纳顺序无关”的：每次重建都保留目标数组里已有的译文、只把结构对齐到源，
// 并写入当前 index 的译文。因此同一字段的多个元素条目无论以何种顺序采纳，最终都会得到
// “长度=源长度、结构=源、文本=各 index 译文”的完整数组。
//
// 当条目缺少源结构（历史任务遗留、没有携带 source* 数组）时，回退为按 index 补齐的旧行为，
// 避免回填直接失败。

function normalizeStringListValue(value) {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map(item => {
    if (typeof item === 'string') {
      return item
    }
    if (item === null || typeof item === 'undefined') {
      return ''
    }
    return String(item)
  })
}

function normalizeUrlListValue(value) {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map(item => ({
    text: item && typeof item.text === 'string' ? item.text : '',
    url: item && typeof item.url === 'string' ? item.url : ''
  }))
}

function cloneVoteOption(option) {
  const normalized = {}
  const optionId = option && option._id ? String(option._id) : ''
  if (optionId) {
    normalized._id = optionId
  }
  normalized.title =
    option && typeof option.title === 'string' ? option.title : ''
  const votes = Number(option && option.votes)
  normalized.votes = Number.isFinite(votes) ? votes : 0
  const sort = Number(option && option.sort)
  normalized.sort = Number.isFinite(sort) ? sort : 0
  return normalized
}

// 字符串数组（label）：按源结构重建，写入 index 处译文。
function rebuildStringListFromSource(currentList, sourceList, index, text) {
  const current = normalizeStringListValue(currentList)
  const labelIndex = Number(index)

  if (!Array.isArray(sourceList) || sourceList.length === 0) {
    if (Number.isInteger(labelIndex) && labelIndex >= 0) {
      while (current.length <= labelIndex) {
        current.push('')
      }
      current[labelIndex] = text
    }
    return current
  }

  const result = sourceList.map((sourceText, sourceIndex) => {
    if (sourceIndex < current.length) {
      return current[sourceIndex]
    }
    if (typeof sourceText === 'string') {
      return sourceText
    }
    if (sourceText === null || typeof sourceText === 'undefined') {
      return ''
    }
    return String(sourceText)
  })

  if (
    Number.isInteger(labelIndex) &&
    labelIndex >= 0 &&
    labelIndex < result.length
  ) {
    result[labelIndex] = text
  }
  return result
}

// urlList：按源结构重建，url 取源，写入 index 处的译文文本。
function rebuildUrlListFromSource(currentList, sourceList, index, text) {
  const current = normalizeUrlListValue(currentList)
  const urlIndex = Number(index)

  if (!Array.isArray(sourceList) || sourceList.length === 0) {
    if (Number.isInteger(urlIndex) && urlIndex >= 0) {
      while (current.length <= urlIndex) {
        current.push({ text: '', url: '' })
      }
      current[urlIndex].text = text
    }
    return current
  }

  const normalizedSource = normalizeUrlListValue(sourceList)
  const result = normalizedSource.map((sourceItem, sourceIndex) => {
    let itemText = sourceItem.text
    if (sourceIndex < current.length) {
      itemText = current[sourceIndex].text
    }
    return { text: itemText, url: sourceItem.url }
  })

  if (Number.isInteger(urlIndex) && urlIndex >= 0 && urlIndex < result.length) {
    result[urlIndex] = { text, url: normalizedSource[urlIndex].url }
  }
  return result
}

// 投票选项：按源结构重建（_id/votes/sort 取源），写入 index 处的译文标题。
function rebuildVoteOptionsFromSource(currentList, sourceList, index, title) {
  const current = Array.isArray(currentList)
    ? currentList.map(cloneVoteOption)
    : []
  const optionIndex = Number(index)

  if (!Array.isArray(sourceList) || sourceList.length === 0) {
    if (
      Number.isInteger(optionIndex) &&
      optionIndex >= 0 &&
      current[optionIndex]
    ) {
      current[optionIndex].title = title
    }
    return current
  }

  const result = sourceList.map((sourceOption, sourceIndex) => {
    const option = cloneVoteOption(sourceOption)
    if (
      sourceIndex < current.length &&
      typeof current[sourceIndex].title === 'string' &&
      current[sourceIndex].title
    ) {
      option.title = current[sourceIndex].title
    }
    return option
  })

  if (
    Number.isInteger(optionIndex) &&
    optionIndex >= 0 &&
    optionIndex < result.length
  ) {
    const option = cloneVoteOption(sourceList[optionIndex])
    option.title = title
    result[optionIndex] = option
  }
  return result
}

module.exports = {
  normalizeStringListValue,
  normalizeUrlListValue,
  rebuildStringListFromSource,
  rebuildUrlListFromSource,
  rebuildVoteOptionsFromSource
}
