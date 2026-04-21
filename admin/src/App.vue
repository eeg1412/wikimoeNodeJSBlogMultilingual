<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'
import { useSiteStore } from '@/store/site'

const auth = useAuthStore()
const site = useSiteStore()

onMounted(() => {
  if (auth.token) {
    site.load()
  }
})
</script>
