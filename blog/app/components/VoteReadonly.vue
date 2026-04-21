<script setup>
// 多语言站投票只读展示。所有交互（选择、提交、结果写入）严禁启用。
defineProps({
  vote: { type: Object, required: true }
})
</script>

<template>
  <section
    class="vote-readonly border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900"
  >
    <header class="vote-readonly-header mb-2">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
        {{ vote.title }}
      </h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Read-only vote. Interaction is disabled in the multilingual site.
      </p>
    </header>
    <ul class="vote-readonly-options space-y-1">
      <li
        v-for="opt in vote.options"
        :key="opt.sourceOptionId"
        class="vote-readonly-option px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200"
      >
        {{ opt.title }}
      </li>
    </ul>
  </section>
</template>
