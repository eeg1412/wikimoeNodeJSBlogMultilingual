<script setup>
const props = defineProps({
  post: { type: Object, required: true },
  lang: { type: String, required: true }
})

const cover = computed(() => {
  const list = props.post?.coverImages
  if (Array.isArray(list) && list.length > 0) return list[0]
  return null
})

const postUrl = computed(() => {
  const id = props.post?.alias || props.post?._id
  return `/${props.lang}/post/${encodeURIComponent(id)}`
})

const sortUrl = computed(() => {
  if (!props.post?.sort) return ''
  return `/${props.lang}/post/list/sort/${encodeURIComponent(props.post.sort.alias || props.post.sort._id)}`
})

const dateText = computed(() => {
  const date = props.post?.date
  if (!date) return ''
  try {
    return new Date(date).toISOString().slice(0, 10)
  } catch (_) {
    return ''
  }
})

const excerptText = computed(() => {
  if (props.post?.excerpt) return props.post.excerpt
  return '这篇文章还没有摘要，点击进入查看完整内容。'
})

function postTypeLabel(type) {
  if (type === 2) return 'Tweet'
  return 'Article'
}
</script>

<template>
  <article class="post-card">
    <NuxtLink :to="postUrl" class="post-card-cover-link">
      <div v-if="cover" class="post-card-cover">
        <img
          :src="cover.url"
          :alt="cover.name || post.title"
          loading="lazy"
          class="post-card-cover-image"
        />
      </div>
      <div v-else class="post-card-cover post-card-cover--placeholder">
        <span>{{ postTypeLabel(post.type) }}</span>
      </div>
    </NuxtLink>

    <div class="post-card-body">
      <div class="post-card-topline">
        <span class="post-card-type">{{ postTypeLabel(post.type) }}</span>
        <span v-if="dateText" class="post-card-date">{{ dateText }}</span>
      </div>

      <NuxtLink :to="postUrl" class="post-card-title-link">
        <h2 class="post-card-title">{{ post.title || '(未命名文章)' }}</h2>
      </NuxtLink>

      <p class="post-card-excerpt">{{ excerptText }}</p>

      <div class="post-card-bottomline">
        <NuxtLink v-if="post.sort" :to="sortUrl" class="post-card-chip">
          {{ post.sort.sortname }}
        </NuxtLink>
        <span v-if="post.author" class="post-card-author">{{
          post.author.nickname
        }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.post-card {
  display: grid;
  gap: 0;
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(23, 32, 51, 0.08);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 16px 42px rgba(23, 32, 51, 0.08);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

:global(.dark) .post-card {
  background: rgba(17, 24, 39, 0.82);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

.post-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 24px 54px rgba(23, 32, 51, 0.12);
}

.post-card-cover-link {
  display: block;
}

.post-card-cover {
  aspect-ratio: 16 / 9;
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.18),
    rgba(37, 99, 235, 0.18)
  );
}

.post-card-cover--placeholder {
  display: grid;
  place-items: center;
  font-size: 22px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5d6d86;
}

:global(.dark) .post-card-cover--placeholder {
  color: #dbe6fb;
}

.post-card-cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-card-body {
  padding: 18px 20px 20px;
}

.post-card-topline,
.post-card-bottomline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.post-card-type,
.post-card-date,
.post-card-author {
  font-size: 12px;
  color: #6f7f98;
}

.post-card-type {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(23, 32, 51, 0.06);
}

:global(.dark) .post-card-type {
  background: rgba(255, 255, 255, 0.08);
}

.post-card-title-link {
  display: block;
  margin-top: 14px;
  text-decoration: none;
  color: inherit;
}

.post-card-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.25;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
}

.post-card-excerpt {
  margin: 12px 0 18px;
  color: #5b6b84;
  line-height: 1.8;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:global(.dark) .post-card-excerpt,
:global(.dark) .post-card-date,
:global(.dark) .post-card-author {
  color: #c6d3e8;
}

.post-card-chip {
  display: inline-flex;
  text-decoration: none;
  color: inherit;
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(23, 32, 51, 0.06);
}

:global(.dark) .post-card-chip {
  background: rgba(255, 255, 255, 0.08);
}
</style>
