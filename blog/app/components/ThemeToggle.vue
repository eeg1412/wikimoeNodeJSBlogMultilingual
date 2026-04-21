<template>
  <button
    class="rounded-full border border-stone-200/70 bg-white/80 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-accent-400 hover:text-accent-700 dark:border-white/10 dark:bg-white/5 dark:text-stone-200"
    @click="toggle"
  >
    {{ colorMode.value === 'dark' ? '切换亮色' : '切换暗色' }}
  </button>
</template>

<script setup>
const colorMode = useColorMode()

function toggle() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>