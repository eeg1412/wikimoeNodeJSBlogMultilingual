;(function () {
  function showToast(message, type) {
    var container = document.querySelector('[data-role="toast-container"]')
    if (!container) {
      container = document.createElement('div')
      container.className = 'toast-container'
      container.setAttribute('data-role', 'toast-container')
      document.body.appendChild(container)
    }

    var toast = document.createElement('div')
    toast.className = 'toast-item'
    if (type === 'success') {
      toast.classList.add('toast-success')
    }
    if (type === 'error') {
      toast.classList.add('toast-error')
    }
    toast.textContent = message
    container.appendChild(toast)

    requestAnimationFrame(function () {
      toast.classList.add('toast-show')
    })

    setTimeout(function () {
      toast.classList.remove('toast-show')
      toast.classList.add('toast-hide')
      setTimeout(function () {
        toast.remove()
      }, 300)
    }, 2000)
  }

  function initDropdowns() {
    var dropdowns = document.querySelectorAll('.nav-dropdown')
    dropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector('.nav-dropdown-trigger')
      if (!trigger) {
        return
      }

      trigger.addEventListener('click', function (event) {
        event.stopPropagation()
        dropdown.classList.toggle('open')
      })
    })

    document.addEventListener('click', function () {
      dropdowns.forEach(function (dropdown) {
        dropdown.classList.remove('open')
      })
    })

    document.querySelectorAll('.nav-dropdown-menu').forEach(function (menu) {
      menu.addEventListener('click', function (event) {
        event.stopPropagation()
      })
    })
  }

  function initCardNavigation() {
    document.querySelectorAll('.post-card[data-href]').forEach(function (card) {
      card.addEventListener('click', function (event) {
        if (event.target.closest('a')) {
          return
        }
        window.location.href = card.dataset.href
      })
    })
  }

  function wrapRichMediaForLightbox() {
    if (typeof window.GLightbox === 'undefined') {
      return
    }

    document.querySelectorAll('.rich-content img').forEach(function (img) {
      if (img.closest('a')) {
        return
      }

      var href = img.getAttribute('data-href') || img.getAttribute('src')
      if (!href) {
        return
      }

      var anchor = document.createElement('a')
      anchor.href = href
      anchor.className = 'glightbox'
      img.parentNode.insertBefore(anchor, img)
      anchor.appendChild(img)
    })

    document.querySelectorAll('.rich-content video').forEach(function (video) {
      if (video.closest('a')) {
        return
      }

      var source = video.querySelector('source')
      var src =
        video.getAttribute('src') || (source && source.getAttribute('src'))
      if (!src) {
        return
      }

      var anchor = document.createElement('a')
      anchor.href = src
      anchor.className = 'glightbox'
      anchor.setAttribute('data-type', 'video')
      video.parentNode.insertBefore(anchor, video)
      anchor.appendChild(video)
    })

    window.GLightbox({ selector: '.glightbox' })
  }

  function initFooterYear() {
    var yearElement = document.querySelector('[data-role="copyright-year"]')
    if (yearElement) {
      yearElement.textContent = String(new Date().getFullYear())
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initFooterYear()
    initDropdowns()
    initCardNavigation()
    wrapRichMediaForLightbox()
  })

  window.WikimoeTemplateSite = {
    showToast: showToast
  }
})()
