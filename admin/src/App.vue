<template>
  <el-config-provider>
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { useAdminTheme } from './composables/useAdminTheme.js'

useAdminTheme()
</script>
