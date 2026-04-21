<template>
  <section class="glass-panel p-6">
    <div class="mb-4 text-sm uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">Vote</div>
    <h3 class="font-display text-xl">{{ vote.title }}</h3>
    <p class="mt-2 text-sm text-stone-500 dark:text-stone-400">只读信息，翻译站不提供投票提交与统计功能。</p>
    <ul class="mt-4 space-y-2">
      <li
        v-for="option in vote.options || []"
        :key="option.sourceOptionId || option.title"
        class="rounded-2xl border border-stone-200/70 px-4 py-3 dark:border-white/10"
      >
        {{ option.title }}
      </li>
    </ul>
  </section>
</template>

<script setup>
defineProps({
  vote: {
    type: Object,
    required: true
  }
})
</script>