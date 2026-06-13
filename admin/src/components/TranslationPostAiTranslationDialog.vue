<template>
  <el-dialog
    v-model="visible"
    title="AI 翻译"
    width="min(1100px, 96vw)"
    align-center
    destroy-on-close
    append-to-body
    :show-close="!isAiBusy"
    :close-on-click-modal="!isAiBusy"
    :close-on-press-escape="!isAiBusy"
    :before-close="handleAiDialogBeforeClose"
  >
    <div
      v-loading="aiApplying"
      element-loading-text="正在写入，请稍候"
      class="ai-translation-dialog-body"
    >
      <el-skeleton v-if="aiLoading" :rows="8" animated />
      <template v-else>
        <el-descriptions class="mb20" :column="3" border>
          <el-descriptions-item label="源语言">
            {{ getLanguageText(currentAiSourceLanguageCode) }}
          </el-descriptions-item>
          <el-descriptions-item label="目标语言">
            {{ getLanguageText(form.languageCode) }}
          </el-descriptions-item>
          <el-descriptions-item label="可翻译条目">
            {{ aiEntryList.length }}
          </el-descriptions-item>
        </el-descriptions>

        <div
          v-if="aiSkippedEntries.length > 0 && !aiImportPreview"
          class="translation-json-warning-list"
        >
          <div class="ai-skipped-header">
            <div class="translation-json-group-title">暂未翻译的关联内容</div>
            <el-button
              v-if="creatableAiSkippedEntries.length > 0"
              size="small"
              type="primary"
              plain
              :loading="creatingAllSkippedTranslations"
              :disabled="isAiBusy"
              @click="createAllSkippedTranslations"
            >
              全部创建
            </el-button>
          </div>
          <div
            v-for="item in aiSkippedEntries"
            :key="item.id"
            class="translation-json-warning-item ai-skipped-item"
          >
            <span>{{
              item.message || `${item.label || item.id}：${item.reason}`
            }}</span>
            <el-button
              v-if="canCreateSkippedTranslation(item)"
              size="small"
              type="primary"
              link
              :loading="isSkippedTranslationCreating(item)"
              :disabled="isAiBusy || creatingAllSkippedTranslations"
              @click="createSkippedTranslation(item)"
            >
              创建
            </el-button>
          </div>
        </div>

        <template v-if="!aiImportPreview">
          <el-form class="translation-json-option-form" label-width="110px">
            <el-form-item label="源语言">
              <el-select
                v-model="aiSourceLanguageCode"
                class="w_10"
                :disabled="isAiBusy"
                filterable
                placeholder="请选择源语言"
                @change="handleAiSourceLanguageChange"
              >
                <el-option
                  v-for="option in languageOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="翻译用文章">
              <el-radio-group
                v-model="aiBaseMode"
                :disabled="isAiBusy"
                @change="handleAiBaseModeChange"
              >
                <el-radio value="source">源文章</el-radio>
                <el-radio value="current">当前文章</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>
          <div class="translation-json-toolbar">
            <div class="translation-dialog-intro">
              <div class="translation-dialog-intro-title">选择 AI 翻译字段</div>
              <div class="translation-dialog-intro-text">
                已选择
                {{ selectedAiEntryIds.length }} 项。按分组检查本次会提交给 AI
                的字段，关联内容会直接显示所属对象与具体字段。
              </div>
            </div>
            <div class="translation-json-toolbar-actions">
              <el-button
                size="small"
                :disabled="isAiBusy"
                @click="selectAllAiEntries"
              >
                全选
              </el-button>
              <el-button
                size="small"
                :disabled="isAiBusy"
                @click="clearAiEntries"
              >
                清空
              </el-button>
            </div>
          </div>

          <TranslationEntrySelectableGroups
            v-model="selectedAiEntryIds"
            :groups="aiEntryGroups"
            :disabled="isAiBusy"
            class="w_10"
          />

          <div
            v-if="showAiCoverImageTranslationOption"
            class="translation-json-group ai-cover-translation-group"
          >
            <div class="translation-json-group-header">
              <div class="translation-json-group-heading">
                <div class="translation-json-group-title">封面图处理</div>
                <div class="translation-dialog-intro-text">
                  直接对照当前语言内容与源内容的封面图，决定是否识别并翻译图中标题。
                </div>
              </div>
              <div class="translation-json-group-count">1 项</div>
            </div>

            <div
              class="translation-json-entry-list ai-cover-translation-entry-list"
            >
              <el-checkbox
                v-model="aiTranslateCoverImage"
                :disabled="isAiCoverImageTranslationDisabled"
                class="translation-json-entry"
              >
                <div class="ai-cover-translation-entry-body">
                  <div class="ai-cover-translation-entry-title">封面图标题</div>
                  <div class="translation-entry-preview-rows">
                    <div class="translation-entry-preview-row">
                      <div class="translation-entry-preview-label">
                        当前语言下的内容
                      </div>
                      <div
                        class="translation-entry-preview-value ai-cover-entry-preview-value"
                      >
                        <div class="cover-image-list ai-cover-translation-list">
                          <div
                            v-for="(element, index) in currentAiCoverImageList"
                            :key="element._id || element.id || index"
                            class="post-cover-image-item"
                          >
                            <button
                              v-if="
                                isImageAttachment(element) &&
                                getImagePreviewUrl(element)
                              "
                              type="button"
                              class="post-cover-image-preview-trigger"
                              title="打开预览"
                              @click="openMediaPreview(element)"
                            >
                              <el-image
                                :src="getImagePreviewUrl(element)"
                                fit="contain"
                                style="width: 100%; height: 100%"
                              />
                            </button>
                            <button
                              v-else-if="
                                isVideoAttachment(element) &&
                                getVideoPreviewUrl(element)
                              "
                              type="button"
                              class="post-cover-image-preview-trigger"
                              title="播放视频"
                              @click="openMediaPreview(element)"
                            >
                              <el-image
                                v-if="getVideoCoverUrl(element)"
                                :src="getVideoCoverUrl(element)"
                                fit="cover"
                                style="width: 100%; height: 100%"
                              />
                              <div v-else class="attachment-cover-empty">
                                无封面
                              </div>
                            </button>
                            <div v-else class="attachment-file-card">
                              <el-icon size="28"><Document /></el-icon>
                              <div>{{ getRelationName(element) }}</div>
                            </div>
                            <div
                              v-if="element.is360Panorama"
                              class="attachment-360-icon"
                            >
                              360°
                            </div>
                            <div
                              v-if="isVideoAttachment(element)"
                              class="attachment-play-icon"
                            >
                              <el-icon><VideoPlay /></el-icon>
                            </div>
                          </div>
                          <span
                            v-if="currentAiCoverImageList.length === 0"
                            class="translation-media-empty cGray666"
                          >
                            未关联封面图
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="translation-entry-preview-row">
                      <div class="translation-entry-preview-label">源内容</div>
                      <div
                        class="translation-entry-preview-value ai-cover-entry-preview-value"
                      >
                        <div class="cover-image-list ai-cover-translation-list">
                          <div
                            v-for="(element, index) in sourceAiCoverImageList"
                            :key="element._id || element.id || index"
                            class="post-cover-image-item"
                          >
                            <button
                              v-if="
                                isImageAttachment(element) &&
                                getImagePreviewUrl(element)
                              "
                              type="button"
                              class="post-cover-image-preview-trigger"
                              title="打开预览"
                              @click="openMediaPreview(element)"
                            >
                              <el-image
                                :src="getImagePreviewUrl(element)"
                                fit="contain"
                                style="width: 100%; height: 100%"
                              />
                            </button>
                            <button
                              v-else-if="
                                isVideoAttachment(element) &&
                                getVideoPreviewUrl(element)
                              "
                              type="button"
                              class="post-cover-image-preview-trigger"
                              title="播放视频"
                              @click="openMediaPreview(element)"
                            >
                              <el-image
                                v-if="getVideoCoverUrl(element)"
                                :src="getVideoCoverUrl(element)"
                                fit="cover"
                                style="width: 100%; height: 100%"
                              />
                              <div v-else class="attachment-cover-empty">
                                无封面
                              </div>
                            </button>
                            <div v-else class="attachment-file-card">
                              <el-icon size="28"><Document /></el-icon>
                              <div>{{ getRelationName(element) }}</div>
                            </div>
                            <div
                              v-if="element.is360Panorama"
                              class="attachment-360-icon"
                            >
                              360°
                            </div>
                            <div
                              v-if="isVideoAttachment(element)"
                              class="attachment-play-icon"
                            >
                              <el-icon><VideoPlay /></el-icon>
                            </div>
                          </div>
                          <span
                            v-if="sourceAiCoverImageList.length === 0"
                            class="translation-media-empty cGray666"
                          >
                            未关联封面图
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </el-checkbox>
              <AiFeatureUnavailableTip
                :message="aiCoverImageTranslationUnavailableReason"
              />
            </div>
          </div>

          <el-form class="ai-translation-prompt-form" label-width="110px">
            <OfficialTermGlossaryOptions
              v-model:auto-organize="aiAutoOrganizeOfficialTermGlossary"
              v-model:search-official-term-translations="
                aiSearchOfficialTermTranslations
              "
              :disabled="isAiBusy"
              :search-default-loading="officialTermSearchDefaultLoading"
              :search-unavailable-reason="officialTermSearchUnavailableReason"
              :source-proper-noun-term-count="sourceProperNounTermCount"
              :source-proper-noun-term-count-loading="
                sourceProperNounTermCountLoading
              "
            />
            <el-form-item label="校验译文">
              <el-switch
                v-model="aiVerificationEnabled"
                :disabled="isAiBusy"
                active-text="AI 参与校验"
              />
              <AiFeatureHintTip
                message="开启后，校验 AI 会在后台任务翻译完成后对全部译文进行全局校验与修正；实时翻译不参与校验。"
              />
            </el-form-item>
            <el-form-item label="此次提示词">
              <el-input
                v-model="aiPrompt"
                type="textarea"
                :rows="5"
                :disabled="isAiBusy"
                placeholder="可补充本次翻译的语气、专有名词、保留词或风格要求"
              />
            </el-form-item>
          </el-form>

          <div
            v-if="aiStreamStatusList.length > 0 || aiStreamContent"
            ref="aiStreamFeedbackRef"
            class="ai-stream-feedback"
          >
            <div class="translation-json-group-title">实时反馈</div>
            <div
              v-for="item in aiStreamStatusList"
              :key="item.id"
              class="ai-stream-status-item"
            >
              {{ item.message }}
            </div>
            <pre v-if="aiStreamContent" class="ai-stream-content">{{
              aiStreamContent
            }}</pre>
          </div>
        </template>

        <div v-else class="translation-import-preview-section">
          <el-alert
            class="mb20"
            type="warning"
            show-icon
            :closable="false"
            title="确认写入后，会立即保存当前文章和相关关联内容。若当前页存在未保存改动，也会一并提交。"
          />

          <el-descriptions class="mb20" :column="3" border>
            <el-descriptions-item label="可写入变更">
              {{ aiImportPreviewTotalChangeCount }}
            </el-descriptions-item>
            <el-descriptions-item label="跳过条目">
              {{ aiImportPreview.skippedCount }}
            </el-descriptions-item>
            <el-descriptions-item label="目标语言">
              {{ getLanguageText(form.languageCode) }}
            </el-descriptions-item>
          </el-descriptions>

          <div
            v-if="aiImportPreview.warningList.length > 0"
            class="translation-json-warning-list"
          >
            <div class="translation-json-group-title">跳过说明</div>
            <div
              v-for="warning in aiImportPreview.warningList"
              :key="warning"
              class="translation-json-warning-item"
            >
              {{ warning }}
            </div>
          </div>

          <div
            v-if="aiImportPreviewCoverEntries.length > 0"
            class="translation-import-preview-group"
          >
            <div class="translation-json-group-header">
              <div class="translation-json-group-heading">
                <div class="translation-json-group-title">封面图</div>
              </div>
              <div class="translation-json-group-count">
                {{ aiImportPreviewCoverEntries.length }} 项
              </div>
            </div>
            <div
              v-for="item in aiImportPreviewCoverEntries"
              :key="item.entryKey || item.artifactId"
              class="translation-import-preview-item"
            >
              <div class="translation-import-preview-item-title">
                <div class="translation-import-preview-cover-header">
                  <span>封面图翻译</span>
                  <el-tag
                    :type="getAiCoverPreviewStatusTagType(item)"
                    effect="plain"
                  >
                    {{ getAiCoverPreviewStatusText(item) }}
                  </el-tag>
                </div>
              </div>
              <div
                v-if="item.warningMessage"
                class="translation-json-warning-item"
              >
                {{ item.warningMessage }}
              </div>
              <div class="translation-import-preview-columns">
                <div class="translation-import-preview-panel">
                  <div class="translation-import-preview-panel-title">
                    源封面图
                  </div>
                  <div class="translation-import-preview-cover-card">
                    <el-image
                      v-if="item.sourceCoverUrl"
                      :src="item.sourceCoverUrl"
                      fit="cover"
                      :preview-src-list="[item.sourceCoverUrl]"
                      preview-teleported
                      class="translation-import-preview-cover-image"
                    />
                    <div v-else class="translation-import-preview-cover-empty">
                      未找到源封面图
                    </div>
                  </div>
                  <pre class="translation-import-preview-raw">{{
                    item.sourceTitle || '未提供源标题'
                  }}</pre>
                </div>
                <div class="translation-import-preview-panel">
                  <div class="translation-import-preview-panel-title">
                    AI 翻译后
                  </div>
                  <div class="translation-import-preview-cover-card">
                    <el-image
                      v-if="item.generatedCoverUrl"
                      :src="item.generatedCoverUrl"
                      fit="cover"
                      :preview-src-list="[item.generatedCoverUrl]"
                      preview-teleported
                      class="translation-import-preview-cover-image"
                    />
                    <div v-else class="translation-import-preview-cover-empty">
                      {{ item.warningMessage || '未生成封面图' }}
                    </div>
                  </div>
                  <pre class="translation-import-preview-raw">{{
                    item.targetTitle || form.title || '未提供目标标题'
                  }}</pre>
                </div>
              </div>
            </div>
          </div>

          <div
            v-for="group in aiImportPreviewGroups"
            :key="group.label"
            class="translation-import-preview-group"
          >
            <div class="translation-json-group-header">
              <div class="translation-json-group-heading">
                <div
                  v-if="group.meta.eyebrow"
                  class="translation-json-group-eyebrow"
                >
                  {{ group.meta.eyebrow }}
                </div>
                <div class="translation-json-group-title">
                  {{ group.meta.title || group.label || '未命名分组' }}
                </div>
              </div>
              <div class="translation-json-group-count">
                {{ group.entries.length }} 项
              </div>
            </div>
            <div
              v-for="item in group.entries"
              :key="item.id"
              class="translation-import-preview-item"
            >
              <div class="translation-import-preview-item-title">
                <TranslationEntryMeta :entry="item" />
              </div>
              <div class="translation-import-preview-columns">
                <div
                  v-if="item.hasSourceValue"
                  class="translation-import-preview-panel"
                >
                  <div class="translation-import-preview-panel-title">
                    源文
                    <div
                      v-if="
                        item.sourceRecordLabel &&
                        item.sourceRecordLabel !== item.recordLabel
                      "
                      class="translation-import-preview-panel-context"
                    >
                      {{ item.sourceRecordLabel }}
                    </div>
                  </div>
                  <div
                    v-if="item.sourceHtml"
                    class="translation-import-preview-html"
                    v-html="item.sourceHtml"
                  />
                  <pre class="translation-import-preview-raw">{{
                    item.sourceValue
                  }}</pre>
                </div>
                <div class="translation-import-preview-panel">
                  <div class="translation-import-preview-panel-title">当前</div>
                  <div
                    v-if="item.currentHtml"
                    class="translation-import-preview-html"
                    v-html="item.currentHtml"
                  />
                  <pre class="translation-import-preview-raw">{{
                    item.currentValue
                  }}</pre>
                </div>
                <div class="translation-import-preview-panel">
                  <div class="translation-import-preview-panel-title">
                    AI 翻译后
                  </div>
                  <div
                    v-if="item.nextHtml"
                    class="translation-import-preview-html"
                    v-html="item.nextHtml"
                  />
                  <pre class="translation-import-preview-raw">{{
                    item.nextValue
                  }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
    <template #footer>
      <el-button :disabled="isAiBusy" @click="visible = false">
        取消
      </el-button>
      <el-button v-if="aiTranslating" type="warning" @click="stopAiTranslation">
        停止翻译
      </el-button>
      <el-button
        v-if="aiImportPreview"
        :disabled="isAiBusy"
        @click="resetAiTranslationPreview"
      >
        返回调整
      </el-button>
      <el-button
        v-if="!aiImportPreview"
        type="primary"
        plain
        :disabled="isAiBusy || !canCreateAiTranslationJob"
        @click="createAiTranslationJob"
      >
        创建后台任务
      </el-button>
      <el-button
        v-if="!aiImportPreview"
        type="primary"
        :loading="aiTranslating"
        :disabled="isAiBusy || !canStartAiTranslation"
        @click="requestAiTranslation"
      >
        开始翻译
      </el-button>
      <el-button
        v-else
        type="primary"
        :loading="aiApplying"
        :disabled="isAiBusy || aiImportPreviewTotalChangeCount === 0"
        @click="confirmAiTranslationImport"
      >
        确认写入
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, VideoPlay } from '@element-plus/icons-vue'
import store from '@/store'
import { multilingualApi } from '@/api'
import AiFeatureUnavailableTip from '@/components/AiFeatureUnavailableTip.vue'
import AiFeatureHintTip from '@/components/AiFeatureHintTip.vue'
import OfficialTermGlossaryOptions from '@/components/OfficialTermGlossaryOptions.vue'
import TranslationEntryMeta from '@/components/TranslationEntryMeta.vue'
import TranslationEntrySelectableGroups from '@/components/TranslationEntrySelectableGroups.vue'
import {
  getLanguageText,
  getPostDisplayTitle,
  getRelationDisplayName,
  isCoverImageTranslationSupportedPostType,
  SUPPORTED_LANGUAGE_OPTIONS
} from '@/utils/multilingual'
import {
  createApiErrorFromResponse,
  extractApiErrorMessages
} from '@/utils/apiError'
import { groupTranslationEntryList } from '@/utils/translationEntryDisplay'
import {
  createAiSettingsAvailability,
  createAiSettingsLoadErrorAvailability,
  getImageGenerationUnavailableReason,
  getInternetSearchUnavailableReason,
  loadAiSettingsAvailability
} from '@/utils/aiSettingsAvailability'
import { loadAndOpenImg } from '@/utils/utils'
import {
  buildSourceToTargetTranslationEntries,
  buildTranslationExportEntries,
  buildTranslationImportPreview
} from '@/utils/translationJson'
import { normalizeTagRecord } from '@/utils/tagName'

const AI_COVER_IMAGE_ENTRY_TYPE = 'coverImageTranslation'

const AUTHOR_RELATION_FIELD = {
  label: '作者',
  field: 'author',
  collectionName: 'users',
  multiple: false
}

const BASE_RELATION_FIELDS = [
  { label: '分类', field: 'sort', collectionName: 'sorts', multiple: false },
  { label: '标签', field: 'tags', collectionName: 'tags', multiple: true },
  {
    label: '地点',
    field: 'mappointList',
    collectionName: 'mappoints',
    multiple: true
  },
  {
    label: '媒体内容',
    field: 'coverImages',
    collectionName: 'attachments',
    multiple: true
  }
]

const TWEET_CONTENT_RELATION_FIELDS = [
  {
    label: '关联活动',
    field: 'contentEventList',
    collectionName: 'events',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联投票',
    field: 'contentVoteList',
    collectionName: 'votes',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联博文',
    field: 'contentPostList',
    collectionName: 'posts',
    multiple: true,
    postType: 1,
    relationScope: 'tweetContent'
  },
  {
    label: '关联推文',
    field: 'contentTweetList',
    collectionName: 'posts',
    multiple: true,
    postType: 2,
    relationScope: 'tweetContent'
  },
  {
    label: '关联番剧',
    field: 'contentBangumiList',
    collectionName: 'bangumis',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联电影',
    field: 'contentMovieList',
    collectionName: 'movies',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联书籍',
    field: 'contentBookList',
    collectionName: 'books',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联游戏',
    field: 'contentGameList',
    collectionName: 'games',
    multiple: true,
    relationScope: 'tweetContent'
  }
]

const DETAIL_RELATION_FIELDS = [
  {
    label: '相关活动',
    field: 'eventList',
    collectionName: 'events',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关投票',
    field: 'voteList',
    collectionName: 'votes',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关博文',
    field: 'postList',
    collectionName: 'posts',
    multiple: true,
    postType: 1,
    relationScope: 'detail'
  },
  {
    label: '相关推文',
    field: 'tweetList',
    collectionName: 'posts',
    multiple: true,
    postType: 2,
    relationScope: 'detail'
  },
  {
    label: '相关番剧',
    field: 'bangumiList',
    collectionName: 'bangumis',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关电影',
    field: 'movieList',
    collectionName: 'movies',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关书籍',
    field: 'bookList',
    collectionName: 'books',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关游戏',
    field: 'gameList',
    collectionName: 'games',
    multiple: true,
    relationScope: 'detail'
  }
]

const ALL_RELATION_FIELDS = [
  AUTHOR_RELATION_FIELD,
  ...BASE_RELATION_FIELDS,
  ...TWEET_CONTENT_RELATION_FIELDS,
  ...DETAIL_RELATION_FIELDS
]

// 详情页"相关博文/相关推文"由各自文章独立维护，关联条目的内容无法在翻译时稳妥控制，
// 因此多语言（已导入）AI 翻译从根本不纳入这两类字段，避免误翻或污染关联内容。
const AI_TRANSLATION_EXCLUDED_RELATION_FIELD_SET = new Set([
  'postList',
  'tweetList'
])

const AI_TRANSLATABLE_RELATION_FIELDS = ALL_RELATION_FIELDS.filter(field => {
  return !AI_TRANSLATION_EXCLUDED_RELATION_FIELD_SET.has(field.field)
})

function createRelationRecords() {
  const records = {}
  ALL_RELATION_FIELDS.forEach(field => {
    records[field.field] = []
  })
  return records
}

function createPostForm() {
  return {
    id: '',
    languageCode: '',
    sourceLanguageCode: '',
    sourceId: '',
    sourceSnapshotId: '',
    snapshotVersion: 1,
    pendingReview: false,
    author: null,
    title: '',
    date: null,
    content: '',
    excerpt: '',
    alias: '',
    sort: null,
    type: 1,
    tags: [],
    mappointList: [],
    bangumiList: [],
    movieList: [],
    gameList: [],
    bookList: [],
    postList: [],
    tweetList: [],
    eventList: [],
    voteList: [],
    contentBangumiList: [],
    contentMovieList: [],
    contentGameList: [],
    contentBookList: [],
    contentPostList: [],
    contentTweetList: [],
    contentEventList: [],
    contentVoteList: [],
    top: false,
    sortop: false,
    status: 0,
    allowRemark: false,
    aiTranslationSkip: false,
    template: '',
    code: '',
    editorVersion: 5,
    coverImages: []
  }
}

function getRecordIdList(records) {
  if (!Array.isArray(records)) {
    return []
  }

  return records.map(item => item._id).filter(Boolean)
}

function getRelationRecordDisplayName(record, field = {}) {
  if (!record) {
    return '-'
  }

  if (field.collectionName === 'posts') {
    return getPostDisplayTitle({
      ...record,
      type: record.type || field.postType
    })
  }

  return getRelationDisplayName(record)
}

export default {
  name: 'TranslationPostAiTranslationDialog',
  components: {
    AiFeatureUnavailableTip,
    AiFeatureHintTip,
    Document,
    OfficialTermGlossaryOptions,
    TranslationEntryMeta,
    TranslationEntrySelectableGroups,
    VideoPlay
  },
  props: {
    modelValue: { type: Boolean, default: false },
    postId: { type: String, default: '' },
    form: { type: Object, default: null },
    relationRecords: { type: Object, default: null },
    originalEditorVersion: { type: Number, default: undefined }
  },
  emits: ['update:modelValue', 'saved'],
  setup(props, { emit }) {
    const internalForm = reactive(createPostForm())
    const internalRelationRecords = reactive(createRelationRecords())
    const form = props.form || internalForm
    const relationRecords = props.relationRecords || internalRelationRecords
    const internalOriginalEditorVersion = ref(undefined)
    const detailData = ref(null)
    const aiLoading = ref(false)
    const aiTranslating = ref(false)
    const aiApplying = ref(false)
    const aiEntryList = ref([])
    const aiSkippedEntries = ref([])
    const selectedAiEntryIds = ref([])
    const aiPrompt = ref('')
    const aiBaseMode = ref('source')
    const aiSourceLanguageCode = ref('')
    const aiTranslateCoverImage = ref(false)
    const aiAutoOrganizeOfficialTermGlossary = ref(true)
    const aiSearchOfficialTermTranslations = ref(false)
    const aiVerificationEnabled = ref(false)
    const aiSettingsAvailability = ref(createAiSettingsAvailability())
    const officialTermSearchDefaultLoading = ref(false)
    const sourceProperNounTermCount = ref(0)
    const sourceProperNounTermCountLoading = ref(false)
    const aiImportPreview = ref(null)
    const sourceReferenceEntries = ref([])
    const sourceReferencePost = ref(null)
    const aiStreamStatusList = ref([])
    const aiStreamContent = ref('')
    const aiStreamReasoning = ref('')
    const aiStreamFeedbackRef = ref(null)
    const aiAbortController = ref(null)
    const skippedTranslationCreatingIds = ref([])
    const creatingAllSkippedTranslations = ref(false)
    let aiEntryLoadRequestId = 0
    let officialTermSearchDefaultRequestId = 0
    let sourceProperNounTermCountRequestId = 0

    const visible = computed({
      get() {
        return props.modelValue
      },
      set(value) {
        emit('update:modelValue', value)
      }
    })
    const hasExternalContext = computed(() => {
      return Boolean(props.form && props.relationRecords)
    })
    const languageOptions = computed(() => SUPPORTED_LANGUAGE_OPTIONS)
    const aiEntryGroups = computed(() => {
      return groupTranslationEntryList(aiEntryList.value)
    })
    const aiImportPreviewGroups = computed(() => {
      return groupTranslationEntryList(aiImportPreview.value?.changeList || [])
    })
    const aiImportPreviewCoverEntries = computed(() => {
      return getAiImportPreviewCoverEntries(aiImportPreview.value)
    })
    const aiImportPreviewTotalChangeCount = computed(() => {
      return getAiImportPreviewTotalChangeCount(aiImportPreview.value)
    })
    const currentAiCoverImageList = computed(() => {
      if (!Array.isArray(relationRecords.coverImages)) {
        return []
      }
      return relationRecords.coverImages.filter(Boolean)
    })
    const sourceAiCoverImageList = computed(() => {
      if (!Array.isArray(sourceReferencePost.value?.coverImages)) {
        return []
      }
      return sourceReferencePost.value.coverImages.filter(Boolean)
    })
    const showAiCoverImageTranslationOption = computed(() => {
      return isCoverImageTranslationSupportedPostType(form.type)
    })
    const aiCoverImageTranslationUnavailableReason = computed(() => {
      if (!showAiCoverImageTranslationOption.value) {
        return ''
      }
      return getImageGenerationUnavailableReason(aiSettingsAvailability.value)
    })
    const isAiCoverImageTranslationDisabled = computed(() => {
      if (isAiBusy.value) {
        return true
      }
      if (officialTermSearchDefaultLoading.value) {
        return true
      }
      return Boolean(aiCoverImageTranslationUnavailableReason.value)
    })
    const hasSourceCoverTranslationCandidate = computed(() => {
      if (!showAiCoverImageTranslationOption.value) {
        return false
      }
      return sourceAiCoverImageList.value.length > 0
    })
    const creatableAiSkippedEntries = computed(() => {
      return aiSkippedEntries.value.filter(item => {
        return canCreateSkippedTranslation(item)
      })
    })
    const hasSelectedAiEntries = computed(() => {
      return selectedAiEntryIds.value.length > 0
    })
    const hasSelectedAiCoverImage = computed(() => {
      if (!showAiCoverImageTranslationOption.value) {
        return false
      }
      if (aiCoverImageTranslationUnavailableReason.value) {
        return false
      }
      return aiTranslateCoverImage.value === true
    })
    const canCreateAiTranslationJob = computed(() => {
      return hasSelectedAiEntries.value || hasSelectedAiCoverImage.value
    })
    const canStartAiTranslation = computed(() => {
      return canCreateAiTranslationJob.value
    })
    const isAiBusy = computed(() => {
      return aiLoading.value || aiTranslating.value || aiApplying.value
    })
    const currentAiSourceLanguageCode = computed(() => {
      return aiSourceLanguageCode.value
    })
    const officialTermSearchUnavailableReason = computed(() => {
      return getInternetSearchUnavailableReason(aiSettingsAvailability.value)
    })

    function shouldSearchOfficialTermTranslations() {
      if (!shouldAutoOrganizeOfficialTermGlossary()) {
        return false
      }
      if (officialTermSearchUnavailableReason.value) {
        return false
      }
      return aiSearchOfficialTermTranslations.value === true
    }

    function shouldAutoOrganizeOfficialTermGlossary() {
      return aiAutoOrganizeOfficialTermGlossary.value === true
    }

    function shouldTranslateAiCoverImage() {
      if (!showAiCoverImageTranslationOption.value) {
        return false
      }
      if (aiCoverImageTranslationUnavailableReason.value) {
        return false
      }
      return aiTranslateCoverImage.value === true
    }

    function enforceAiCoverImageTranslationAvailability() {
      if (showAiCoverImageTranslationOption.value) {
        if (!aiCoverImageTranslationUnavailableReason.value) {
          return
        }
      }
      aiTranslateCoverImage.value = false
    }

    function enforceOfficialTermSearchAvailability() {
      if (!shouldAutoOrganizeOfficialTermGlossary()) {
        aiSearchOfficialTermTranslations.value = false
        return
      }
      if (!officialTermSearchUnavailableReason.value) {
        return
      }
      aiSearchOfficialTermTranslations.value = false
    }

    function getDefaultAiSourceLanguageCode() {
      return form.sourceLanguageCode || ''
    }

    function syncDefaultAiSourceLanguageCode(options = {}) {
      if (!options.force && aiSourceLanguageCode.value) {
        return
      }

      const defaultSourceLanguageCode = getDefaultAiSourceLanguageCode()
      if (!defaultSourceLanguageCode) {
        return
      }

      aiSourceLanguageCode.value = defaultSourceLanguageCode
    }

    function getSourceSnapshotId() {
      return form.sourceSnapshotId
    }

    function getActivePostId() {
      if (!hasExternalContext.value && props.postId) {
        return props.postId
      }
      if (form.id) {
        return form.id
      }
      return props.postId
    }

    function getRelationField(fieldName) {
      return ALL_RELATION_FIELDS.find(item => item.field === fieldName)
    }

    function getRelationName(record, field = {}) {
      return getRelationRecordDisplayName(record, field)
    }

    function syncRelationIds(fieldName) {
      const field = getRelationField(fieldName)
      if (field && !field.multiple) {
        form[fieldName] = relationRecords[fieldName][0]?._id || null
        return
      }
      form[fieldName] = getRecordIdList(relationRecords[fieldName])
    }

    function setRelationRecordList(fieldName, records) {
      const list = Array.isArray(records) ? records.filter(Boolean) : []
      relationRecords[fieldName] =
        fieldName === 'tags' ? list.map(normalizeTagRecord) : list
      syncRelationIds(fieldName)
    }

    function applyPost(post) {
      form.id = post._id
      form.languageCode = post.languageCode
      form.sourceLanguageCode = post.sourceLanguageCode
      form.sourceId = post.sourceId || ''
      form.sourceSnapshotId = post.sourceSnapshotId || ''
      sourceReferenceEntries.value = []
      form.snapshotVersion = post.snapshotVersion
      form.pendingReview = Boolean(post.pendingReview)
      setRelationRecordList('author', post.author ? [post.author] : [])
      form.title = post.title || ''
      form.date = post.date ? new Date(post.date) : null
      form.content = post.content || ''
      form.excerpt = post.excerpt || ''
      form.alias = post.alias || ''
      form.type = Number(post.type || 1)
      form.top = Boolean(post.top)
      form.sortop = Boolean(post.sortop)
      form.status = Number(post.status || 0)
      form.allowRemark = Boolean(post.allowRemark)
      form.aiTranslationSkip = Boolean(post.aiTranslationSkip)
      form.template = post.template || ''
      form.code = post.code || ''
      internalOriginalEditorVersion.value = undefined
      if (
        Object.prototype.hasOwnProperty.call(post, 'editorVersion') &&
        post.editorVersion !== null &&
        typeof post.editorVersion !== 'undefined'
      ) {
        internalOriginalEditorVersion.value = Number(post.editorVersion || 5)
      }
      form.editorVersion = internalOriginalEditorVersion.value || 5

      setRelationRecordList('sort', post.sort ? [post.sort] : [])
      ALL_RELATION_FIELDS.forEach(field => {
        if (field.field === 'author' || field.field === 'sort') {
          return
        }
        setRelationRecordList(field.field, post[field.field] || [])
      })
    }

    function applyPostDetailData(nextDetailData, options = {}) {
      if (!nextDetailData || !nextDetailData.post) {
        return false
      }
      detailData.value = nextDetailData
      applyPost(nextDetailData.post)
      syncDefaultAiSourceLanguageCode({
        force: options.forceAiSourceLanguageCode === true
      })
      if (options.emitSaved === true) {
        emit('saved', nextDetailData)
      }
      return true
    }

    async function getPostDetail() {
      const postId = getActivePostId()
      if (!postId) {
        return null
      }
      const response = await multilingualApi.getTranslationPostDetail({
        id: postId
      })
      const responseData = response.data.data
      applyPostDetailData(responseData, {
        forceAiSourceLanguageCode: true
      })
      return responseData
    }

    function buildTranslationEntries(options = {}) {
      return buildTranslationExportEntries({
        form,
        relationFields: AI_TRANSLATABLE_RELATION_FIELDS,
        relationRecords,
        includeEmpty: Boolean(options.includeEmpty)
      })
    }

    function buildRelationRecordsFromPost(post) {
      const records = createRelationRecords()
      records.author = post.author ? [post.author] : []
      records.sort = post.sort ? [post.sort] : []
      ALL_RELATION_FIELDS.forEach(field => {
        if (field.field === 'author' || field.field === 'sort') {
          return
        }
        records[field.field] = []
        if (Array.isArray(post[field.field])) {
          records[field.field] = post[field.field].filter(Boolean)
        }
      })
      return records
    }

    function buildSourceSnapshotEntries(sourcePost) {
      const sourceForm = {
        ...sourcePost,
        id: sourcePost._id,
        languageCode: sourcePost.languageCode || sourcePost.sourceLanguageCode,
        sourceLanguageCode: sourcePost.sourceLanguageCode
      }
      return buildTranslationExportEntries({
        form: sourceForm,
        relationFields: AI_TRANSLATABLE_RELATION_FIELDS,
        relationRecords: buildRelationRecordsFromPost(sourcePost)
      })
    }

    async function loadSourceReferenceEntries(options = {}) {
      if (!options.force && sourceReferenceEntries.value.length > 0) {
        return {
          entries: sourceReferenceEntries.value,
          skippedEntries: []
        }
      }

      const sourceSnapshotId = getSourceSnapshotId()
      if (!sourceSnapshotId) {
        sourceReferencePost.value = null
        return {
          entries: [],
          skippedEntries: []
        }
      }

      const response = await multilingualApi.getSourcePostDetail({
        id: sourceSnapshotId
      })
      const sourceDetail = response.data.data || {}
      const sourcePost = sourceDetail.post
      if (!sourcePost) {
        sourceReferencePost.value = null
        return {
          entries: [],
          skippedEntries: []
        }
      }

      sourceReferencePost.value = sourcePost

      const sourceEntries = buildSourceSnapshotEntries(sourcePost)
      const targetEntries = buildTranslationEntries({ includeEmpty: true })
      const mappedResult = buildSourceToTargetTranslationEntries({
        sourceEntries,
        targetEntries
      })
      sourceReferenceEntries.value = mappedResult.entries
      return mappedResult
    }

    function attachEntryPreviewRows(entries, currentEntries, sourceEntries) {
      const currentEntryMap = new Map(
        currentEntries.map(entry => [entry.id, entry])
      )
      const sourceEntryMap = new Map(
        sourceEntries.map(entry => [entry.id, entry])
      )

      return entries.map(entry => {
        const currentEntry = currentEntryMap.get(entry.id)
        const sourceEntry = sourceEntryMap.get(entry.id)
        return {
          ...entry,
          currentPreviewText:
            currentEntry?.previewText || entry.currentPreviewText || '',
          currentPreviewRawValue:
            currentEntry?.previewRawValue || entry.currentPreviewRawValue || '',
          sourcePreviewText:
            sourceEntry?.previewText || entry.sourcePreviewText || '',
          sourcePreviewRawValue:
            sourceEntry?.previewRawValue || entry.sourcePreviewRawValue || ''
        }
      })
    }

    async function loadTranslationEntriesByBaseMode(mode, options = {}) {
      const currentEntries = buildTranslationEntries(options)
      const sourceResult = await loadSourceReferenceEntries({
        force: options.force === true
      })
      const sourceEntries = sourceResult.entries || []

      if (mode === 'current') {
        return {
          entries: attachEntryPreviewRows(
            currentEntries,
            currentEntries,
            sourceEntries
          ),
          skippedEntries: sourceResult.skippedEntries || []
        }
      }

      return {
        ...sourceResult,
        entries: attachEntryPreviewRows(
          sourceEntries,
          currentEntries,
          sourceEntries
        )
      }
    }

    function isVideoAttachment(record) {
      return Boolean(record?.mimetype && record.mimetype.includes('video'))
    }

    function isImageAttachment(record) {
      return Boolean(record?.mimetype && record.mimetype.includes('image'))
    }

    function isAbsoluteMediaUrl(value) {
      if (!value) {
        return false
      }

      return /^(https?:)?\/\//.test(value) || value.startsWith('/')
    }

    function normalizeMediaUrl(value) {
      if (!value) {
        return ''
      }

      if (isAbsoluteMediaUrl(value)) {
        return value
      }

      return value
    }

    function getFirstMediaUrl(candidateList) {
      for (const item of candidateList) {
        const previewUrl = normalizeMediaUrl(item)
        if (previewUrl) {
          return previewUrl
        }
      }

      return ''
    }

    function getImagePreviewUrl(record) {
      return getFirstMediaUrl([
        record?.localThumbnailPath,
        record?.localFilepath,
        record?.thumfor,
        record?.filepath,
        record?.remoteFilepath
      ])
    }

    function getImageOriginalUrl(record) {
      return getFirstMediaUrl([
        record?.localFilepath,
        record?.filepath,
        record?.remoteFilepath,
        record?.localThumbnailPath,
        record?.thumfor
      ])
    }

    function getVideoPreviewUrl(record) {
      return getFirstMediaUrl([
        record?.localFilepath,
        record?.filepath,
        record?.remoteFilepath
      ])
    }

    function getVideoCoverUrl(record) {
      return getFirstMediaUrl([record?.localThumbnailPath, record?.thumfor])
    }

    function getPositiveMediaSize(value) {
      const numberValue = Number(value)
      if (Number.isFinite(numberValue) && numberValue > 0) {
        return numberValue
      }
      return 0
    }

    function getMediaPreviewSize(record) {
      const width =
        getPositiveMediaSize(record?.width) ||
        getPositiveMediaSize(record?.thumWidth)
      const height =
        getPositiveMediaSize(record?.height) ||
        getPositiveMediaSize(record?.thumHeight)

      if (width && height) {
        return { width, height }
      }

      if (isVideoAttachment(record)) {
        return { width: 1280, height: 720 }
      }

      return { width: 1600, height: 900 }
    }

    function buildMediaPreviewItem(record) {
      let previewUrl = ''
      if (isImageAttachment(record)) {
        previewUrl = getImageOriginalUrl(record)
      }
      if (isVideoAttachment(record)) {
        previewUrl = getVideoPreviewUrl(record)
      }
      if (!previewUrl) {
        return null
      }

      const previewSize = getMediaPreviewSize(record)
      return {
        src: previewUrl,
        width: previewSize.width,
        height: previewSize.height,
        mimetype: record?.mimetype || '',
        is360Panorama: Boolean(record?.is360Panorama)
      }
    }

    function openMediaPreview(record) {
      const previewItem = buildMediaPreviewItem(record)
      if (!previewItem) {
        return
      }

      loadAndOpenImg(0, [previewItem])
    }

    function resetAiTranslationState() {
      if (aiAbortController.value) {
        aiAbortController.value.abort()
        aiAbortController.value = null
      }
      aiEntryList.value = []
      aiSkippedEntries.value = []
      selectedAiEntryIds.value = []
      aiPrompt.value = ''
      aiBaseMode.value = 'source'
      aiSourceLanguageCode.value = getDefaultAiSourceLanguageCode()
      aiTranslateCoverImage.value = false
      aiAutoOrganizeOfficialTermGlossary.value = true
      aiSearchOfficialTermTranslations.value = false
      aiVerificationEnabled.value = false
      aiSettingsAvailability.value = createAiSettingsAvailability()
      officialTermSearchDefaultLoading.value = false
      officialTermSearchDefaultRequestId += 1
      sourceProperNounTermCount.value = 0
      sourceProperNounTermCountLoading.value = false
      sourceProperNounTermCountRequestId += 1
      aiImportPreview.value = null
      sourceReferenceEntries.value = []
      sourceReferencePost.value = null
      aiStreamStatusList.value = []
      aiStreamContent.value = ''
      aiStreamReasoning.value = ''
      skippedTranslationCreatingIds.value = []
      creatingAllSkippedTranslations.value = false
    }

    async function applyOfficialTermSearchDefault() {
      const requestId = officialTermSearchDefaultRequestId + 1
      officialTermSearchDefaultRequestId = requestId
      officialTermSearchDefaultLoading.value = true
      try {
        const availability = await loadAiSettingsAvailability(multilingualApi)
        if (requestId !== officialTermSearchDefaultRequestId) {
          return
        }
        if (!visible.value) {
          return
        }
        aiSettingsAvailability.value = availability
        if (
          availability.internetSearchEnabled === true &&
          shouldAutoOrganizeOfficialTermGlossary()
        ) {
          aiSearchOfficialTermTranslations.value = true
        } else {
          aiSearchOfficialTermTranslations.value = false
        }
        enforceAiCoverImageTranslationAvailability()
        enforceOfficialTermSearchAvailability()
      } catch (error) {
        if (requestId === officialTermSearchDefaultRequestId) {
          aiSettingsAvailability.value =
            createAiSettingsLoadErrorAvailability(error)
          aiSearchOfficialTermTranslations.value = false
          enforceAiCoverImageTranslationAvailability()
          extractApiErrorMessages(error).forEach(message => {
            ElMessage.error(message)
          })
        }
      } finally {
        if (requestId === officialTermSearchDefaultRequestId) {
          officialTermSearchDefaultLoading.value = false
        }
      }
    }

    function normalizeSourceProperNounTermCount(value) {
      const count = Number(value || 0)
      if (!Number.isFinite(count) || count < 0) {
        return 0
      }
      return Math.floor(count)
    }

    function applyAutoOrganizeOfficialTermGlossaryDefault() {
      if (sourceProperNounTermCount.value > 0) {
        aiAutoOrganizeOfficialTermGlossary.value = false
      } else {
        aiAutoOrganizeOfficialTermGlossary.value = true
      }
      enforceOfficialTermSearchAvailability()
    }

    async function refreshSourceProperNounTermCount(options = {}) {
      const requestId = sourceProperNounTermCountRequestId + 1
      sourceProperNounTermCountRequestId = requestId
      sourceProperNounTermCountLoading.value = true
      const sourceId = String(form.sourceId || '').trim()
      const sourceLanguageCode = String(
        aiSourceLanguageCode.value || form.sourceLanguageCode || ''
      ).trim()

      try {
        if (!sourceId || !sourceLanguageCode) {
          sourceProperNounTermCount.value = 0
          if (options.applyDefault === true) {
            applyAutoOrganizeOfficialTermGlossaryDefault()
          }
          return
        }

        const response = await multilingualApi.getSourcePostProperNounTermList(
          {
            sourceId,
            sourceLanguageCode,
            page: 1,
            limit: 1
          },
          true
        )
        if (requestId !== sourceProperNounTermCountRequestId) {
          return
        }
        const responseData = response.data?.data || {}
        sourceProperNounTermCount.value = normalizeSourceProperNounTermCount(
          responseData.relationCount
        )
        if (options.applyDefault === true) {
          applyAutoOrganizeOfficialTermGlossaryDefault()
        }
      } catch (error) {
        if (requestId === sourceProperNounTermCountRequestId) {
          sourceProperNounTermCount.value = 0
          aiAutoOrganizeOfficialTermGlossary.value = true
          enforceOfficialTermSearchAvailability()
          extractApiErrorMessages(error).forEach(message => {
            ElMessage.error(message)
          })
        }
      } finally {
        if (requestId === sourceProperNounTermCountRequestId) {
          sourceProperNounTermCountLoading.value = false
        }
      }
    }

    function canCreateSkippedTranslation(item) {
      return Boolean(
        item &&
        item.actionType === 'createTranslationPost' &&
        item.sourceSnapshotId &&
        item.relationField
      )
    }

    function isSkippedTranslationCreating(item) {
      return skippedTranslationCreatingIds.value.includes(item.id)
    }

    function setSkippedTranslationCreating(item, isCreating) {
      const idList = skippedTranslationCreatingIds.value.filter(id => {
        return id !== item.id
      })
      if (isCreating) {
        idList.push(item.id)
      }
      skippedTranslationCreatingIds.value = idList
    }

    async function refreshAiTranslationCandidates(nextDetailData = null) {
      const requestId = aiEntryLoadRequestId + 1
      aiEntryLoadRequestId = requestId
      aiLoading.value = true
      const loadOptions = {}
      try {
        const isDetailApplied = applyPostDetailData(nextDetailData, {
          emitSaved: true
        })
        if (!isDetailApplied && !hasExternalContext.value && !form.id) {
          await getPostDetail()
        }
        const requestMode = aiBaseMode.value
        const mappedResult = await loadTranslationEntriesByBaseMode(
          requestMode,
          loadOptions
        )
        if (
          requestId !== aiEntryLoadRequestId ||
          requestMode !== aiBaseMode.value
        ) {
          return
        }
        aiEntryList.value = mappedResult.entries
        aiSkippedEntries.value = mappedResult.skippedEntries
        selectedAiEntryIds.value = aiEntryList.value
          .filter(entry => entry.defaultSelected)
          .map(entry => entry.id)
      } finally {
        if (requestId === aiEntryLoadRequestId) {
          aiLoading.value = false
        }
      }
    }

    async function createSkippedTranslation(item) {
      if (!canCreateSkippedTranslation(item)) {
        return
      }

      setSkippedTranslationCreating(item, true)
      try {
        const response =
          await multilingualApi.createMissingPostRelationTranslation({
            postId: form.id,
            sourceSnapshotId: item.sourceSnapshotId,
            relationField: item.relationField
          })
        const responseData = response.data.data || {}
        await refreshAiTranslationCandidates(responseData.post)
        ElMessage.success('已创建关联文章语言版本')
      } finally {
        setSkippedTranslationCreating(item, false)
      }
    }

    async function createAllSkippedTranslations() {
      const itemList = creatableAiSkippedEntries.value
      if (itemList.length === 0) {
        return
      }

      creatingAllSkippedTranslations.value = true
      skippedTranslationCreatingIds.value = itemList.map(item => item.id)
      try {
        let lastResponseData = null
        for (const item of itemList) {
          const response =
            await multilingualApi.createMissingPostRelationTranslation({
              postId: form.id,
              sourceSnapshotId: item.sourceSnapshotId,
              relationField: item.relationField
            })
          lastResponseData = response.data.data || null
        }
        await refreshAiTranslationCandidates(lastResponseData?.post || null)
        ElMessage.success(`已创建 ${itemList.length} 个关联文章语言版本`)
      } finally {
        creatingAllSkippedTranslations.value = false
        skippedTranslationCreatingIds.value = []
      }
    }

    function resetAiStreamState() {
      aiStreamStatusList.value = []
      aiStreamContent.value = ''
      aiStreamReasoning.value = ''
    }

    function pushAiStreamStatus(message) {
      if (!message) {
        return
      }
      aiStreamStatusList.value.push({
        id: `${Date.now()}-${aiStreamStatusList.value.length}`,
        message
      })
      scrollAiStreamFeedbackToBottom()
    }

    function scrollAiStreamFeedbackToBottom() {
      nextTick(() => {
        const feedbackElement = aiStreamFeedbackRef.value
        if (!feedbackElement) {
          return
        }
        feedbackElement.scrollTop = feedbackElement.scrollHeight
      })
    }

    function handleAiDialogBeforeClose(done) {
      if (isAiBusy.value) {
        return
      }
      done()
    }

    function isAbortError(error) {
      if (!error) {
        return false
      }
      if (error.name === 'AbortError') {
        return true
      }
      if (error.code === 'ABORT_ERR') {
        return true
      }
      return false
    }

    function stopAiTranslation() {
      if (!aiAbortController.value) {
        return
      }
      aiAbortController.value.abort()
      pushAiStreamStatus('已停止翻译请求')
    }

    function handleAiBaseModeChange() {
      aiImportPreview.value = null
      resetAiStreamState()
      refreshAiTranslationCandidates()
    }

    function handleAiSourceLanguageChange() {
      resetAiTranslationPreview()
      refreshSourceProperNounTermCount({ applyDefault: true })
    }

    function selectAllAiEntries() {
      selectedAiEntryIds.value = aiEntryList.value.map(entry => entry.id)
    }

    function clearAiEntries() {
      selectedAiEntryIds.value = []
    }

    function getAiImportPreviewCoverEntries(preview) {
      if (!Array.isArray(preview?.coverImagePreviewEntries)) {
        return []
      }
      return preview.coverImagePreviewEntries.filter(Boolean)
    }

    function isGeneratedAiCoverPreviewEntry(entry) {
      return Boolean(
        entry &&
        entry.entryType === AI_COVER_IMAGE_ENTRY_TYPE &&
        entry.status === 'generated' &&
        entry.generatedCoverUrl
      )
    }

    function getAiImportPreviewTotalChangeCount(preview) {
      const textChangeCount = Number(preview?.changeCount || 0)
      const coverImageChangeCount = getAiImportPreviewCoverEntries(
        preview
      ).filter(entry => {
        return isGeneratedAiCoverPreviewEntry(entry)
      }).length
      return textChangeCount + coverImageChangeCount
    }

    function normalizeAiCoverWarningList(warningList) {
      if (!Array.isArray(warningList)) {
        return []
      }
      return warningList
        .map(item => {
          if (typeof item === 'string') {
            return item.trim()
          }
          if (item && typeof item.message === 'string') {
            return item.message.trim()
          }
          return ''
        })
        .filter(Boolean)
    }

    function buildAiImportPreview(data, referenceEntries) {
      const preview = buildTranslationImportPreview({
        parsedPayload: data.payload,
        currentEntries: buildTranslationEntries({ includeEmpty: true }),
        form,
        referenceEntries
      })
      const coverImagePreviewEntries = Array.isArray(
        data.coverImagePreviewEntries
      )
        ? data.coverImagePreviewEntries.filter(Boolean)
        : []
      const coverImageArtifacts = Array.isArray(data.coverImageArtifacts)
        ? data.coverImageArtifacts.filter(Boolean)
        : []
      const coverImageWarnings = normalizeAiCoverWarningList(
        data.coverImageWarnings
      )
      const mergedWarningList = preview.warningList.concat(coverImageWarnings)
      const coverImageChangeCount = coverImagePreviewEntries.filter(entry => {
        return isGeneratedAiCoverPreviewEntry(entry)
      }).length
      return {
        ...preview,
        coverImagePreviewEntries,
        coverImageArtifacts,
        coverImageWarnings,
        coverImageChangeCount,
        totalChangeCount: preview.changeCount + coverImageChangeCount,
        warningList: mergedWarningList,
        skippedCount: mergedWarningList.length + preview.aiSkipList.length
      }
    }

    function getAiCoverPreviewStatusText(entry) {
      if (entry?.status === 'generated') {
        if (entry.reused) {
          return '已复用'
        }
        return '已生成'
      }
      if (entry?.warningMessage) {
        return '未生成'
      }
      return '待处理'
    }

    function getAiCoverPreviewStatusTagType(entry) {
      if (entry?.status === 'generated') {
        return 'success'
      }
      return 'warning'
    }

    function resetAiTranslationPreview() {
      aiImportPreview.value = null
      resetAiStreamState()
    }

    function parseClientSseBlock(block) {
      const eventData = {
        eventName: 'message',
        data: {}
      }
      const dataLines = []
      block.split(/\r?\n/).forEach(line => {
        if (line.startsWith('event:')) {
          eventData.eventName = line.slice(6).trim()
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart())
        }
      })
      if (dataLines.length === 0) {
        return null
      }
      try {
        eventData.data = JSON.parse(dataLines.join('\n'))
      } catch (error) {
        eventData.data = {}
      }
      return eventData
    }

    function findClientSseBoundary(buffer) {
      const lfIndex = buffer.indexOf('\n\n')
      const crlfIndex = buffer.indexOf('\r\n\r\n')
      if (lfIndex < 0 && crlfIndex < 0) {
        return { index: -1, length: 0 }
      }
      if (lfIndex < 0) {
        return { index: crlfIndex, length: 4 }
      }
      if (crlfIndex < 0) {
        return { index: lfIndex, length: 2 }
      }
      if (lfIndex < crlfIndex) {
        return { index: lfIndex, length: 2 }
      }
      return { index: crlfIndex, length: 4 }
    }

    function handleAiStreamEvent(eventData, referenceEntries) {
      if (!eventData) {
        return null
      }
      const data = eventData.data || {}
      if (eventData.eventName === 'status') {
        pushAiStreamStatus(data.message)
      }
      if (eventData.eventName === 'chunk') {
        if (data.reasoningDelta) {
          aiStreamReasoning.value += data.reasoningDelta
        }
        if (data.contentDelta) {
          aiStreamContent.value += data.contentDelta
          scrollAiStreamFeedbackToBottom()
        }
      }
      if (eventData.eventName === 'chunkRollback') {
        const contentLength = Number(data.contentLength || 0)
        const reasoningLength = Number(data.reasoningLength || 0)
        if (contentLength > 0) {
          aiStreamContent.value = aiStreamContent.value.slice(
            0,
            Math.max(aiStreamContent.value.length - contentLength, 0)
          )
        }
        if (reasoningLength > 0) {
          aiStreamReasoning.value = aiStreamReasoning.value.slice(
            0,
            Math.max(aiStreamReasoning.value.length - reasoningLength, 0)
          )
        }
      }
      if (eventData.eventName === 'result') {
        const preview = buildAiImportPreview(data, referenceEntries)
        aiImportPreview.value = preview
        if (getAiImportPreviewTotalChangeCount(preview) === 0) {
          ElMessage.info('AI 返回结果中没有可写入的变更')
        }
      }
      if (eventData.eventName === 'error') {
        return new Error(data.message || 'AI 翻译失败')
      }
      return null
    }

    async function readAiTranslationStream(response, previewReferenceEntries) {
      if (!response.body) {
        throw new Error('浏览器不支持读取 AI 翻译流')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let streamError = null

      function consumeBuffer() {
        let boundary = findClientSseBoundary(buffer)
        while (boundary.index >= 0) {
          const block = buffer.slice(0, boundary.index)
          buffer = buffer.slice(boundary.index + boundary.length)
          const eventData = parseClientSseBlock(block)
          const error = handleAiStreamEvent(eventData, previewReferenceEntries)
          if (error) {
            streamError = error
          }
          boundary = findClientSseBoundary(buffer)
        }
      }

      let done = false
      while (!done) {
        const result = await reader.read()
        done = result.done
        if (result.value) {
          buffer += decoder.decode(result.value, { stream: !done })
          consumeBuffer()
        }
      }

      if (buffer.trim()) {
        const eventData = parseClientSseBlock(buffer)
        const error = handleAiStreamEvent(eventData, previewReferenceEntries)
        if (error) {
          streamError = error
        }
      }

      if (streamError) {
        throw streamError
      }
    }

    async function requestAiTranslation() {
      if (aiLoading.value) {
        ElMessage.warning('正在加载翻译用文章，请稍候')
        return
      }
      if (
        selectedAiEntryIds.value.length === 0 &&
        !shouldTranslateAiCoverImage()
      ) {
        ElMessage.warning('请至少选择一项翻译内容')
        return
      }
      if (!aiSourceLanguageCode.value) {
        ElMessage.warning('请选择源语言')
        return
      }
      if (sourceProperNounTermCountLoading.value) {
        ElMessage.warning('正在检查源文章名词词库，请稍候')
        return
      }

      const selectedIdSet = new Set(selectedAiEntryIds.value)
      const selectedEntries = aiEntryList.value.filter(entry => {
        return selectedIdSet.has(entry.id)
      })

      resetAiStreamState()
      aiImportPreview.value = null
      aiTranslating.value = true
      const abortController = new AbortController()
      aiAbortController.value = abortController
      try {
        pushAiStreamStatus('正在开始翻译')
        const response = await fetch(
          '/api/multilingual-admin/translation/post/ai-translate-stream',
          {
            method: 'POST',
            signal: abortController.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${store.getters.adminToken}`
            },
            body: JSON.stringify({
              postId: form.id,
              sourceLanguageCode: aiSourceLanguageCode.value,
              targetLanguageCode: form.languageCode,
              prompt: aiPrompt.value,
              entries: selectedEntries,
              translateCoverImage: shouldTranslateAiCoverImage(),
              autoOrganizeOfficialTermGlossary:
                shouldAutoOrganizeOfficialTermGlossary(),
              searchOfficialTermTranslations:
                shouldSearchOfficialTermTranslations()
            })
          }
        )

        if (!response.ok) {
          throw await createApiErrorFromResponse(response, 'AI 翻译请求失败')
        }

        await readAiTranslationStream(response, selectedEntries)
      } catch (error) {
        if (isAbortError(error)) {
          ElMessage.info('已停止 AI 翻译')
          return
        }
        extractApiErrorMessages(error).forEach(message => {
          ElMessage.error(message)
        })
      } finally {
        aiAbortController.value = null
        aiTranslating.value = false
      }
    }

    async function createAiTranslationJob() {
      if (
        selectedAiEntryIds.value.length === 0 &&
        !shouldTranslateAiCoverImage()
      ) {
        ElMessage.warning('请至少选择一项翻译内容')
        return
      }
      if (!aiSourceLanguageCode.value) {
        ElMessage.warning('请选择源语言')
        return
      }
      if (!form.sourceId) {
        ElMessage.warning('当前文章缺少源文章身份，无法创建后台任务')
        return
      }
      if (sourceProperNounTermCountLoading.value) {
        ElMessage.warning('正在检查源文章名词词库，请稍候')
        return
      }

      const selectedIdSet = new Set(selectedAiEntryIds.value)
      const selectedEntries = aiEntryList.value.filter(entry => {
        return selectedIdSet.has(entry.id)
      })

      try {
        await multilingualApi.createTranslationJob({
          jobType: 'post-ai-translation',
          source: {
            postId: form.sourceId,
            snapshotId: form.sourceSnapshotId,
            snapshotVersion: form.snapshotVersion,
            languageCode: aiSourceLanguageCode.value,
            title: form.title
          },
          target: {
            postId: form.id,
            languageCode: form.languageCode,
            title: form.title
          },
          request: {
            prompt: aiPrompt.value,
            baseMode: aiBaseMode.value,
            options: {
              translateCoverImage: shouldTranslateAiCoverImage(),
              autoOrganizeOfficialTermGlossary:
                shouldAutoOrganizeOfficialTermGlossary(),
              searchOfficialTermTranslations:
                shouldSearchOfficialTermTranslations(),
              aiVerificationEnabled: aiVerificationEnabled.value === true
            },
            entries: selectedEntries,
            selectedEntryKeys: selectedEntries.map(entry => entry.id)
          }
        })
        ElMessage.success('后台任务已创建')
        visible.value = false
        resetAiTranslationState()
      } catch (error) {
        console.log(error)
      }
    }

    async function applyAiPreviewCoverImages(preview) {
      const previewEntryList = getAiImportPreviewCoverEntries(preview).filter(
        entry => {
          return isGeneratedAiCoverPreviewEntry(entry)
        }
      )
      if (previewEntryList.length === 0) {
        return
      }

      const artifactList = Array.isArray(preview?.coverImageArtifacts)
        ? preview.coverImageArtifacts
        : []
      const artifactMap = new Map(
        artifactList.map(item => {
          return [String(item?.artifactId || '').trim(), item]
        })
      )

      for (const previewEntry of previewEntryList) {
        const artifact = artifactMap.get(
          String(previewEntry?.artifactId || '').trim()
        )
        if (!artifact) {
          throw new Error('AI 封面图预览缺少对应产物，不能写入')
        }
        await multilingualApi.adoptTranslationPreviewCoverImage({
          artifact,
          previewEntry,
          targetPostId: form.id,
          languageCode: form.languageCode,
          name: previewEntry.targetTitle || form.title || 'ai-cover-image'
        })
      }
    }

    function buildSubmitData(confirmReview) {
      return {
        id: form.id,
        languageCode: form.languageCode,
        title: form.title,
        date: form.date,
        content: form.content,
        excerpt: form.excerpt,
        alias: form.alias,
        type: form.type,
        top: form.top,
        sortop: form.sortop,
        status: form.status,
        allowRemark: form.allowRemark,
        aiTranslationSkip: form.aiTranslationSkip,
        template: form.template,
        code: form.code,
        editorVersion: form.editorVersion,
        author: form.author,
        sort: form.sort,
        tags: form.tags,
        mappointList: form.mappointList,
        coverImages: form.coverImages,
        bangumiList: form.bangumiList,
        movieList: form.movieList,
        gameList: form.gameList,
        bookList: form.bookList,
        postList: form.postList,
        tweetList: form.tweetList,
        eventList: form.eventList,
        voteList: form.voteList,
        contentBangumiList: form.contentBangumiList,
        contentMovieList: form.contentMovieList,
        contentGameList: form.contentGameList,
        contentBookList: form.contentBookList,
        contentPostList: form.contentPostList,
        contentTweetList: form.contentTweetList,
        contentEventList: form.contentEventList,
        contentVoteList: form.contentVoteList,
        confirmReview
      }
    }

    function getOriginalEditorVersion() {
      if (hasExternalContext.value) {
        return props.originalEditorVersion
      }
      return internalOriginalEditorVersion.value
    }

    function buildImportSubmitData(postPatch) {
      const submitData = {
        ...buildSubmitData(false),
        ...postPatch
      }
      const originalEditorVersion = getOriginalEditorVersion()
      if (typeof originalEditorVersion === 'undefined') {
        delete submitData.editorVersion
      } else {
        submitData.editorVersion = originalEditorVersion
      }
      return submitData
    }

    async function refreshSavedPostDetail() {
      const response = await multilingualApi.getTranslationPostDetail({
        id: form.id
      })
      applyPostDetailData(response.data.data, { emitSaved: true })
    }

    async function applyTranslationImportPreview(preview, options = {}) {
      const markAiTranslationSkip = options.markAiTranslationSkip === true
      const relationUpdates = preview.applyPlan.relationUpdates
      if (relationUpdates.length > 0) {
        await Promise.all(
          relationUpdates.map(updateItem => {
            return multilingualApi.updateTranslationRelation({
              collectionName: updateItem.collectionName,
              id: updateItem.id,
              languageCode: form.languageCode,
              payload: {
                ...updateItem.payload,
                ...(markAiTranslationSkip ? { aiTranslationSkip: true } : {})
              }
            })
          })
        )
      }

      const postPatch = { ...preview.applyPlan.postPatch }
      if (markAiTranslationSkip && Object.keys(postPatch).length > 0) {
        postPatch.aiTranslationSkip = true
      }
      if (Object.keys(postPatch).length > 0) {
        await multilingualApi.updateTranslationPost(
          buildImportSubmitData(postPatch)
        )
      }

      await applyAiPreviewCoverImages(preview)
      await refreshSavedPostDetail()
    }

    async function confirmAiTranslationImport() {
      if (
        !aiImportPreview.value ||
        getAiImportPreviewTotalChangeCount(aiImportPreview.value) === 0
      ) {
        ElMessage.warning('请先完成 AI 翻译预览')
        return
      }

      try {
        await ElMessageBox.confirm(
          '确认写入后，将立即保存 AI 翻译结果。请确认预览内容无误。',
          '确认写入 AI 翻译',
          {
            type: 'warning',
            confirmButtonText: '确认写入',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }

      aiApplying.value = true
      try {
        await applyTranslationImportPreview(aiImportPreview.value, {
          markAiTranslationSkip: true
        })
        visible.value = false
        resetAiTranslationState()
        ElMessage.success('AI 翻译已写入')
      } finally {
        aiApplying.value = false
      }
    }

    async function openDialog() {
      resetAiTranslationState()
      aiBaseMode.value = 'source'
      if (!hasExternalContext.value) {
        aiLoading.value = true
        try {
          await getPostDetail()
        } finally {
          aiLoading.value = false
        }
      }

      const sourceSnapshotId = getSourceSnapshotId()
      if (!sourceSnapshotId) {
        ElMessage.warning('当前文章缺少源快照，无法进行 AI 翻译')
        visible.value = false
        return
      }

      applyOfficialTermSearchDefault()
      refreshSourceProperNounTermCount({ applyDefault: true })
      refreshAiTranslationCandidates().then(() => {
        if (
          aiEntryList.value.length === 0 &&
          !hasSourceCoverTranslationCandidate.value
        ) {
          ElMessage.warning('没有找到可提交给 AI 的源内容条目')
          return
        }
        if (
          aiEntryList.value.length === 0 &&
          hasSourceCoverTranslationCandidate.value
        ) {
          ElMessage.info('当前没有可翻译正文条目，仍可仅翻译封面图')
        }
      })
    }

    watch(
      () => props.modelValue,
      value => {
        if (value) {
          openDialog()
          return
        }
        resetAiTranslationState()
      }
    )

    watch(showAiCoverImageTranslationOption, () => {
      enforceAiCoverImageTranslationAvailability()
    })

    watch(aiCoverImageTranslationUnavailableReason, () => {
      enforceAiCoverImageTranslationAvailability()
    })

    watch(officialTermSearchUnavailableReason, () => {
      enforceOfficialTermSearchAvailability()
    })

    watch(aiAutoOrganizeOfficialTermGlossary, () => {
      enforceOfficialTermSearchAvailability()
    })

    return {
      Document,
      VideoPlay,
      aiApplying,
      aiAutoOrganizeOfficialTermGlossary,
      aiBaseMode,
      aiEntryGroups,
      aiEntryList,
      aiImportPreview,
      aiImportPreviewCoverEntries,
      aiImportPreviewGroups,
      aiImportPreviewTotalChangeCount,
      aiCoverImageTranslationUnavailableReason,
      aiLoading,
      aiPrompt,
      aiSearchOfficialTermTranslations,
      aiSourceLanguageCode,
      aiTranslateCoverImage,
      aiVerificationEnabled,
      aiSkippedEntries,
      aiStreamFeedbackRef,
      aiStreamContent,
      aiStreamStatusList,
      aiTranslating,
      canCreateAiTranslationJob,
      canCreateSkippedTranslation,
      canStartAiTranslation,
      clearAiEntries,
      confirmAiTranslationImport,
      creatableAiSkippedEntries,
      createAiTranslationJob,
      createAllSkippedTranslations,
      createSkippedTranslation,
      creatingAllSkippedTranslations,
      currentAiCoverImageList,
      currentAiSourceLanguageCode,
      form,
      getAiCoverPreviewStatusTagType,
      getAiCoverPreviewStatusText,
      getImagePreviewUrl,
      getLanguageText,
      getRelationName,
      getVideoCoverUrl,
      getVideoPreviewUrl,
      handleAiBaseModeChange,
      handleAiDialogBeforeClose,
      handleAiSourceLanguageChange,
      isAiCoverImageTranslationDisabled,
      isAiBusy,
      isImageAttachment,
      isSkippedTranslationCreating,
      isVideoAttachment,
      languageOptions,
      officialTermSearchDefaultLoading,
      officialTermSearchUnavailableReason,
      openMediaPreview,
      requestAiTranslation,
      resetAiTranslationPreview,
      selectAllAiEntries,
      selectedAiEntryIds,
      sourceAiCoverImageList,
      sourceProperNounTermCount,
      sourceProperNounTermCountLoading,
      showAiCoverImageTranslationOption,
      stopAiTranslation,
      visible
    }
  }
}
</script>

<style scoped>
.ai-translation-dialog-body {
  min-height: 220px;
}

.translation-json-toolbar,
.translation-json-toolbar-actions,
.ai-skipped-header,
.translation-import-preview-cover-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.translation-json-toolbar-actions,
.translation-import-preview-cover-header {
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 0;
}

.translation-json-option-form,
.ai-translation-prompt-form {
  margin-bottom: 12px;
}

.translation-dialog-intro {
  min-width: 0;
}

.translation-dialog-intro-title,
.translation-json-group-title,
.ai-cover-translation-entry-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.translation-dialog-intro-text,
.translation-entry-preview-label,
.translation-import-preview-panel-context {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.translation-json-group,
.translation-json-warning-list,
.translation-import-preview-group,
.translation-import-preview-item {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  background: var(--el-bg-color);
}

.translation-json-warning-list {
  background: var(--el-fill-color-extra-light);
}

.translation-json-group-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.translation-json-group-heading {
  flex: 1;
  min-width: 0;
}

.translation-json-group-eyebrow {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-color-primary);
}

.translation-json-group-title {
  display: flex;
  align-items: center;
  margin: 4px 0 0;
  min-height: 21px;
  font-size: 15px;
  line-height: 1.5;
}

.translation-json-group-count {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 4px 10px;
  min-height: 24px;
  color: var(--el-color-primary-dark-2);
  font-size: 12px;
  font-weight: 600;
}

.translation-json-entry-list {
  display: grid;
  gap: 0;
}

.translation-json-entry {
  width: 100%;
  margin-right: 0;
  align-items: flex-start;
  padding: 10px 0;
}

.translation-json-entry + .translation-json-entry {
  border-top: 1px dashed var(--el-border-color-lighter);
}

.translation-json-entry :deep(.el-checkbox__label) {
  width: 100%;
  padding-left: 12px;
}

.translation-json-entry :deep(.el-checkbox__input) {
  margin-top: 4px;
}

.translation-entry-preview-rows,
.translation-import-preview-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.translation-entry-preview-row,
.translation-import-preview-panel {
  min-width: 0;
}

.translation-entry-preview-value,
.translation-import-preview-raw,
.ai-stream-content {
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  max-height: 260px;
  overflow: auto;
  color: var(--el-text-color-regular);
}

.translation-import-preview-raw,
.ai-stream-content {
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.translation-import-preview-item-title {
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.translation-import-preview-item + .translation-import-preview-item {
  margin-top: 12px;
}

.translation-import-preview-panel-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
}

.translation-import-preview-html {
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  max-height: 220px;
  overflow: auto;
}

.translation-json-warning-item,
.ai-stream-status-item,
.ai-skipped-item {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

.ai-skipped-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ai-stream-feedback {
  margin-top: 16px;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-lighter);
  max-height: 320px;
  overflow: auto;
}

.cover-image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.post-cover-image-item {
  position: relative;
  width: 100px;
  height: 76px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
}

.post-cover-image-preview-trigger {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.attachment-file-card,
.attachment-cover-empty,
.translation-media-empty,
.translation-import-preview-cover-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
}

.attachment-360-icon,
.attachment-play-icon {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  min-height: 22px;
  padding: 0 5px;
  border-radius: 11px;
  color: #fff;
  background: rgba(0, 0, 0, 0.58);
  font-size: 12px;
}

.attachment-play-icon {
  left: 6px;
  right: auto;
  padding: 0;
}

.translation-import-preview-cover-card {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  margin-bottom: 8px;
}

.translation-import-preview-cover-image {
  width: 100%;
  height: 100%;
}

@media (max-width: 767px) {
  .translation-json-toolbar,
  .translation-json-group-header,
  .ai-skipped-header {
    display: grid;
    grid-template-columns: 1fr;
  }

  .translation-json-toolbar-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .translation-entry-preview-rows,
  .translation-import-preview-columns {
    grid-template-columns: 1fr;
  }
}
</style>
