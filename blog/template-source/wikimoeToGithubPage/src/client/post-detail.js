;(function () {
  function initCodeHighlight() {
    var richContent = document.querySelector('.rich-content')
    if (!richContent || typeof window.hljs === 'undefined') {
      return
    }

    richContent.querySelectorAll('pre').forEach(function (pre) {
      var codeBlock = pre.querySelector('code')
      if (!codeBlock) {
        codeBlock = document.createElement('code')
        codeBlock.textContent = pre.textContent
        codeBlock.className = pre.className
        pre.innerHTML = ''
        pre.appendChild(codeBlock)
        pre.removeAttribute('class')
      }

      codeBlock.textContent = codeBlock.textContent.trim()
      window.hljs.highlightElement(codeBlock)

      var result = codeBlock.result
      var language = (result && result.language) || 'code'
      var lines = (codeBlock.textContent + '\n').split('\n').length - 1
      codeBlock.setAttribute(
        'data-lines',
        Array.from({ length: lines }, function (_, index) {
          return index + 1
        }).join('\n')
      )

      var header = document.createElement('div')
      header.className = 'code-header'

      var languageSpan = document.createElement('span')
      languageSpan.className = 'code-language'
      languageSpan.textContent = language

      var copyButton = document.createElement('button')
      copyButton.className = 'code-copy-btn'
      copyButton.type = 'button'
      copyButton.title = '复制代码'
      copyButton.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M384 336H192c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16l140.1 0L400 115.9V320c0 8.8-7.2 16-16 16zM192 384H384c35.3 0 64-28.7 64-64V115.9c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1H192c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H256c35.3 0 64-28.7 64-64V416H272v32c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192c0-8.8 7.2-16 16-16H96V128H64z"/></svg>'

      copyButton.addEventListener('click', function () {
        if (!navigator.clipboard) {
          return
        }

        navigator.clipboard
          .writeText(codeBlock.textContent)
          .then(function () {
            copyButton.classList.add('copied')
            if (window.WikimoeTemplateSite) {
              window.WikimoeTemplateSite.showToast('复制成功', 'success')
            }
            setTimeout(function () {
              copyButton.classList.remove('copied')
            }, 2000)
          })
          .catch(function () {
            if (window.WikimoeTemplateSite) {
              window.WikimoeTemplateSite.showToast('复制失败', 'error')
            }
          })
      })

      header.appendChild(languageSpan)
      header.appendChild(copyButton)
      pre.prepend(header)
    })
  }

  document.addEventListener('DOMContentLoaded', initCodeHighlight)
})()
