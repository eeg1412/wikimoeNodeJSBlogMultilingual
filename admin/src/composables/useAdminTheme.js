import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const STORAGE_KEY = 'admin_theme_preference'
const mediaQuery =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

const preference = ref(
  typeof window === 'undefined'
    ? 'system'
    : localStorage.getItem(STORAGE_KEY) || 'system'
)

const systemTheme = ref(
  mediaQuery && mediaQuery.matches ? 'dark' : 'light'
)

const resolvedTheme = computed(() => {
  if (preference.value === 'system') {
    return systemTheme.value
  }

  return preference.value
})

let initialized = false

function applyTheme() {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.adminTheme = resolvedTheme.value
}

function handleSystemThemeChange(event) {
  systemTheme.value = event.matches ? 'dark' : 'light'
  applyTheme()
}

export function useAdminTheme() {
  function setPreference(nextPreference) {
    preference.value = nextPreference
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, nextPreference)
    }
    applyTheme()
  }

  function toggleTheme() {
    const nextPreference = resolvedTheme.value === 'dark' ? 'light' : 'dark'
    setPreference(nextPreference)
  }

  onMounted(() => {
    applyTheme()
    if (!initialized && mediaQuery) {
      mediaQuery.addEventListener('change', handleSystemThemeChange)
      initialized = true
    }
  })

  onBeforeUnmount(() => {
    if (initialized && mediaQuery) {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
      initialized = false
    }
  })

  return {
    preference,
    resolvedTheme,
    isDark: computed(() => resolvedTheme.value === 'dark'),
    setPreference,
    toggleTheme
  }
}
