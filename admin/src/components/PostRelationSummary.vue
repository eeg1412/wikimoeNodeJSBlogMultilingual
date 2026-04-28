<template>
  <div>
    <div class="post-list-about-body" v-if="recommendList.length > 0">
      <div class="fb">
        推文内关联内容<template v-if="hasRecommendCustomSort"
          >(自定义排序)</template
        >：
      </div>
      <div
        v-for="content in recommendList"
        :key="`${content.type}-${content._id || content.title}`"
        class="postlist-content-item"
        :class="{ danger: Number(content.status) === 0 }"
      >
        <template v-if="content.type === 'bangumi'">
          <i class="fas fa-fw fa-tv"></i>{{ `${checkShowText(content)}` }}
          {{ `【${content.year}年${seasonToStr(content.season)}季新番】` }}
        </template>
        <template v-else-if="content.type === 'movie'">
          <i class="fas fa-fw fa-film"></i>{{ `${checkShowText(content)}` }}
          {{ setMovieTitle(content) }}
        </template>
        <template v-else-if="content.type === 'book'">
          <i class="fas fa-fw fa-book"></i>{{ `${checkShowText(content)}` }}
          {{ content.booktype?.name ? `【${content.booktype.name}】` : '' }}
        </template>
        <template v-else-if="content.type === 'game'">
          <i class="fas fa-fw fa-gamepad"></i>{{ `${checkShowText(content)}` }}
          {{
            content.gamePlatform?.name
              ? `【${content.gamePlatform.name}】`
              : ''
          }}
        </template>
        <template v-else-if="content.type === 'post'">
          <i class="fas fa-fw fa-newspaper"></i>
          {{ `${checkShowText(content)}` }}
          {{
            content.date ? $formatDate(content.date, '【YYYY年MM月DD日】') : ''
          }}
        </template>
        <template v-else-if="content.type === 'tweet'">
          <i class="fas fa-fw fa-align-left"></i>
          {{ `${checkShowText(content)}` }}
          {{
            content.date ? $formatDate(content.date, '【YYYY年MM月DD日】') : ''
          }}
        </template>
        <template v-else-if="content.type === 'event'">
          <i class="fas fa-fw fa-calendar-alt"></i>
          {{ `${checkShowText(content)}` }}
          {{ `【${$formatDate(content.startTime, 'YYYY年MM月')}】` }}
        </template>
        <template v-else-if="content.type === 'vote'">
          <i class="fas fa-fw fa-poll-h"></i>{{ `${checkShowText(content)}` }}
          {{ '【投票】' }}
        </template>
        {{ content.title }}
      </div>
    </div>

    <div class="post-list-about-body" v-if="contentList.length > 0">
      <div class="fb">
        详情页相关内容<template v-if="hasContentCustomSort"
          >(自定义排序)</template
        >：
      </div>
      <div
        v-for="content in contentList"
        :key="`${content.type}-${content._id || content.title}`"
        class="postlist-content-item"
        :class="{ danger: Number(content.status) === 0 }"
      >
        <template v-if="content.type === 'bangumi'">
          <i class="fas fa-fw fa-tv"></i>{{ `${checkShowText(content)}` }}
          {{ `【${content.year}年${seasonToStr(content.season)}季新番】` }}
        </template>
        <template v-else-if="content.type === 'movie'">
          <i class="fas fa-fw fa-film"></i>{{ `${checkShowText(content)}` }}
          {{ setMovieTitle(content) }}
        </template>
        <template v-else-if="content.type === 'book'">
          <i class="fas fa-fw fa-book"></i>{{ `${checkShowText(content)}` }}
          {{ content.booktype?.name ? `【${content.booktype.name}】` : '' }}
        </template>
        <template v-else-if="content.type === 'game'">
          <i class="fas fa-fw fa-gamepad"></i>{{ `${checkShowText(content)}` }}
          {{
            content.gamePlatform?.name
              ? `【${content.gamePlatform.name}】`
              : ''
          }}
        </template>
        <template v-else-if="content.type === 'post'">
          <i class="fas fa-fw fa-newspaper"></i>
          {{ `${checkShowText(content)}` }}
          {{
            content.date ? $formatDate(content.date, '【YYYY年MM月DD日】') : ''
          }}
        </template>
        <template v-else-if="content.type === 'tweet'">
          <i class="fas fa-fw fa-align-left"></i>
          {{ `${checkShowText(content)}` }}
          {{
            content.date ? $formatDate(content.date, '【YYYY年MM月DD日】') : ''
          }}
        </template>
        <template v-else-if="content.type === 'event'">
          <i class="fas fa-fw fa-calendar-alt"></i>
          {{ `${checkShowText(content)}` }}
          {{ `【${$formatDate(content.startTime, 'YYYY年MM月')}】` }}
        </template>
        <template v-else-if="content.type === 'vote'">
          <i class="fas fa-fw fa-poll-h"></i>{{ `${checkShowText(content)}` }}
          {{ '【投票】' }}
        </template>
        {{ content.title }}
      </div>
    </div>

    <span
      v-if="recommendList.length === 0 && contentList.length === 0"
      class="empty-text"
    >
      -
    </span>
  </div>
</template>

<script>
import { computed } from 'vue'
import { seasonToStr } from '@/utils/utils'
import {
  buildMergedContentRelationList,
  buildMergedRecommendContentList,
  checkShowText,
  setMovieTitle
} from '@/utils/postListDisplay'

export default {
  props: {
    post: {
      type: Object,
      default: () => ({})
    }
  },
  setup(props) {
    const recommendList = computed(() => {
      return buildMergedRecommendContentList(props.post)
    })
    const contentList = computed(() => {
      return buildMergedContentRelationList(props.post)
    })
    const hasRecommendCustomSort = computed(() => {
      return Array.isArray(props.post?.seriesSortList)
        ? props.post.seriesSortList.length > 0
        : false
    })
    const hasContentCustomSort = computed(() => {
      return Array.isArray(props.post?.contentSeriesSortList)
        ? props.post.contentSeriesSortList.length > 0
        : false
    })

    return {
      recommendList,
      contentList,
      hasRecommendCustomSort,
      hasContentCustomSort,
      seasonToStr,
      checkShowText,
      setMovieTitle
    }
  }
}
</script>

<style scoped>
.postlist-content-item {
  margin-right: 5px;
  margin-bottom: 5px;
  display: inline-block;
  vertical-align: middle;
  padding: 0 9px;
  border-width: 1px;
  border-style: solid;
  box-sizing: border-box;
  border-radius: 4px;
  color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-8);
}

.postlist-content-item.danger {
  color: var(--el-color-danger);
  background-color: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-8);
}

.post-list-about-body {
  margin-bottom: 10px;
}

.post-list-about-body:last-child {
  margin-bottom: 0;
}

.empty-text {
  color: var(--el-text-color-secondary);
}
</style>