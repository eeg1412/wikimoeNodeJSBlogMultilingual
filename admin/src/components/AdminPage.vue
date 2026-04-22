<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <div class="admin-page__hero">
        <div class="admin-page__eyebrow">
          <slot name="eyebrow">管理后台</slot>
        </div>
        <div class="admin-page__title-row">
          <div>
            <h1 class="admin-page__title">{{ title }}</h1>
            <p v-if="description" class="admin-page__description">
              {{ description }}
            </p>
          </div>
          <div v-if="$slots.actions" class="admin-page__actions">
            <slot name="actions" />
          </div>
        </div>
      </div>
      <div v-if="$slots.meta" class="admin-page__meta">
        <slot name="meta" />
      </div>
    </header>
    <div class="admin-page__content">
      <slot />
    </div>
  </section>
</template>

<script>
export default {
  name: 'AdminPage',
  props: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    }
  }
}
</script>
