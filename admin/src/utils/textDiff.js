// 计算两段文本的字符级差异，用于在校验报告中高亮被修改的部分。
// 返回 before / after 两个分段数组，每个分段标记是否发生变化。

function toCharList(value) {
  if (value === null || typeof value === 'undefined') {
    return []
  }
  return Array.from(String(value))
}

function mergeSegments(segments) {
  const merged = []
  segments.forEach(segment => {
    const last = merged[merged.length - 1]
    if (last && last.changed === segment.changed) {
      last.text += segment.text
      return
    }
    merged.push({ text: segment.text, changed: segment.changed })
  })
  return merged
}

// 基于最长公共子序列，标记删除（before）与新增（after）的字符。
export function diffTextSegments(before, after) {
  const beforeChars = toCharList(before)
  const afterChars = toCharList(after)
  const beforeLength = beforeChars.length
  const afterLength = afterChars.length

  const lcsTable = []
  for (let i = 0; i <= beforeLength; i++) {
    lcsTable.push(new Array(afterLength + 1).fill(0))
  }
  for (let i = beforeLength - 1; i >= 0; i--) {
    for (let j = afterLength - 1; j >= 0; j--) {
      if (beforeChars[i] === afterChars[j]) {
        lcsTable[i][j] = lcsTable[i + 1][j + 1] + 1
      } else {
        lcsTable[i][j] = Math.max(lcsTable[i + 1][j], lcsTable[i][j + 1])
      }
    }
  }

  const beforeSegments = []
  const afterSegments = []
  let i = 0
  let j = 0
  while (i < beforeLength && j < afterLength) {
    if (beforeChars[i] === afterChars[j]) {
      beforeSegments.push({ text: beforeChars[i], changed: false })
      afterSegments.push({ text: afterChars[j], changed: false })
      i++
      j++
    } else if (lcsTable[i + 1][j] >= lcsTable[i][j + 1]) {
      beforeSegments.push({ text: beforeChars[i], changed: true })
      i++
    } else {
      afterSegments.push({ text: afterChars[j], changed: true })
      j++
    }
  }
  while (i < beforeLength) {
    beforeSegments.push({ text: beforeChars[i], changed: true })
    i++
  }
  while (j < afterLength) {
    afterSegments.push({ text: afterChars[j], changed: true })
    j++
  }

  return {
    before: mergeSegments(beforeSegments),
    after: mergeSegments(afterSegments)
  }
}
