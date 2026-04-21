import { ref, onMounted, onUnmounted } from 'vue'

export function useIsMobile(breakpoint = 768) {
  const isMobile = ref(false)
  let mediaQuery = null
  let handler = null

  const update = event => {
    isMobile.value = event.matches
  }

  onMounted(() => {
    mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`)
    isMobile.value = mediaQuery.matches
    handler = update
    mediaQuery.addEventListener('change', handler)
  })

  onUnmounted(() => {
    if (mediaQuery && handler) {
      mediaQuery.removeEventListener('change', handler)
    }
  })

  return { isMobile }
}
