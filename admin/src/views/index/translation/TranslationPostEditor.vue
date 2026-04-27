<template>
  <div class="common-right-panel-form translation-post-editor-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ name: 'TranslationPostList' }">
          多语言文章
        </el-breadcrumb-item>
        <el-breadcrumb-item>编辑{{ typeTitle }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <el-skeleton v-if="loading" :rows="10" animated />
    <div v-else-if="detailData && form.id">
      <el-alert
        v-if="form.pendingReview"
        class="mb20"
        type="warning"
        show-icon
        title="源文章快照已变化，保存并确认复核后会清除待复核状态。"
      />

      <el-descriptions class="mb20" :column="2" border>
        <el-descriptions-item label="语言">
          {{ getLanguageText(form.languageCode) }}
        </el-descriptions-item>
        <el-descriptions-item label="类型">
          {{ getPostTypeText(form.type) }}
        </el-descriptions-item>
        <el-descriptions-item label="快照版本">
          v{{ form.snapshotVersion || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="复核状态">
          <el-tag v-if="form.pendingReview" type="warning" effect="plain">
            待复核
          </el-tag>
          <el-tag v-else type="success" effect="plain">正常</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <el-form :model="form" label-width="90px" @submit.prevent>
        <template v-if="form.type !== 2">
          <el-form-item label="标题" required>
            <el-input v-model="form.title" placeholder="请输入标题" />
          </el-form-item>
          <el-form-item label="文章内容">
            <el-tabs
              v-model="contentTab"
              type="border-card"
              class="w_10 post-editor-body"
              @tab-change="onContentTabChange"
            >
              <el-tab-pane label="富文本" name="richText">
                <RichEditor4
                  v-if="postEditorVersion === 4"
                  v-model:content="form.content"
                />
                <RichEditor5
                  v-else
                  v-model:content="form.content"
                  :isPost="true"
                />
              </el-tab-pane>
              <el-tab-pane label="源代码" name="sourceCode">
                <el-input
                  v-model="contentSource"
                  type="textarea"
                  :rows="30"
                  placeholder="请输入源代码"
                />
              </el-tab-pane>
            </el-tabs>
          </el-form-item>
          <el-form-item label="摘要">
            <el-input
              v-model="form.excerpt"
              type="textarea"
              :rows="5"
              placeholder="请输入摘要"
            />
          </el-form-item>
          <el-form-item label="插入code">
            <el-input
              v-model="form.code"
              type="textarea"
              :rows="5"
              placeholder="请输入插入code"
            />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="推文" required>
            <EmojiTextarea
              v-model:value="form.excerpt"
              placeholder="请输入推文"
              :rows="10"
            />
            <div class="w_10 cGray666">
              ※推文正文使用摘要字段，媒体内容会显示在推文正文区域。
            </div>
          </el-form-item>
        </template>

        <el-form-item
          :label="form.type === 2 ? '媒体内容' : '封面图'"
          class="blok-form-item"
        >
          <div class="cover-image-list">
            <draggable
              v-model="relationRecords.coverImages"
              item-key="_id"
              handle=".handle"
              @change="syncRelationIds('coverImages')"
            >
              <template #item="{ element, index }">
                <div class="post-cover-image-item">
                  <el-image
                    v-if="canPreviewAttachmentImage(element)"
                    :src="getAttachmentPreview(element)"
                    fit="contain"
                    style="width: 100%; height: 100%"
                  />
                  <div v-else class="attachment-file-card">
                    <el-icon size="28"><Document /></el-icon>
                    <div>{{ getRelationName(element) }}</div>
                    <div
                      v-if="element.mediaMode === 'remote'"
                      class="f12 cGray666"
                    >
                      远程媒体
                    </div>
                  </div>
                  <div
                    class="post-cover-image-item-delete"
                    @click.stop.prevent="removeRelation('coverImages', index)"
                  >
                    <el-icon><Close /></el-icon>
                  </div>
                  <div
                    class="handle post-cover-image-item-handle"
                    v-show="relationRecords.coverImages.length > 1"
                  >
                    <el-icon><Rank /></el-icon>
                  </div>
                </div>
              </template>
            </draggable>
            <div
              class="post-cover-image-item type-add"
              v-show="relationRecords.coverImages.length < maxCoverLength"
              @click="openRelationPicker(getRelationField('coverImages'))"
            >
              <div class="dflex flexCenter w_10 full-height">
                <el-icon size="32px"><Plus /></el-icon>
              </div>
            </div>
          </div>
          <div
            class="w_10 cGray666"
            v-if="relationRecords.coverImages.length > 1"
          >
            ※可以拖动改变顺序
          </div>
        </el-form-item>

        <el-form-item label="分类" v-if="form.type !== 3">
          <RelationSelectedList
            :field="getRelationField('sort')"
            :records="relationRecords.sort"
            @pick="openRelationPicker"
            @edit="openRelationEditor"
            @remove="removeSingleRelation"
          />
        </el-form-item>

        <template v-if="form.type !== 3">
          <el-form-item label="标签">
            <RelationSelectedList
              :field="getRelationField('tags')"
              :records="relationRecords.tags"
              @pick="openRelationPicker"
              @edit="openRelationEditor"
              @remove="removeRelationById"
            />
          </el-form-item>
          <el-form-item label="地点">
            <RelationSelectedList
              :field="getRelationField('mappointList')"
              :records="relationRecords.mappointList"
              @pick="openRelationPicker"
              @edit="openRelationEditor"
              @remove="removeRelationById"
            />
          </el-form-item>
        </template>

        <div class="config-border-item" v-if="form.type === 2">
          <div class="config-border-item-title">
            <div>推文内关联内容设定</div>
            <div class="f12 cGray666">※会显示在文章列表页和详情页的正文中</div>
          </div>
          <el-form-item
            v-for="field in tweetContentRelationFields"
            :key="field.field"
            :label="field.label"
          >
            <RelationSelectedList
              :field="field"
              :records="relationRecords[field.field]"
              @pick="openRelationPicker"
              @edit="openRelationEditor"
              @remove="removeRelationById"
            />
          </el-form-item>
          <el-form-item label="更改排序">
            <el-switch
              v-model="form.contentSeriesSortListTurnOn"
              @change="onContentSeriesSortSwitch"
            />
          </el-form-item>
          <el-form-item label="排序" v-if="form.contentSeriesSortListTurnOn">
            <StringSortEditBox
              v-model:modelValue="form.contentSeriesSortList"
              :map="relationSortMap"
            />
          </el-form-item>
        </div>

        <div class="config-border-item">
          <div class="config-border-item-title">
            <div>详情页相关内容设定</div>
            <div class="f12 cGray666">※仅显示在详情页下方的相关内容</div>
          </div>
          <el-form-item
            v-for="field in detailRelationFields"
            :key="field.field"
            :label="field.label"
          >
            <RelationSelectedList
              :field="field"
              :records="relationRecords[field.field]"
              @pick="openRelationPicker"
              @edit="openRelationEditor"
              @remove="removeRelationById"
            />
          </el-form-item>
          <el-form-item label="更改排序">
            <el-switch
              v-model="form.seriesSortListTurnOn"
              @change="onSeriesSortSwitch"
            />
          </el-form-item>
          <el-form-item label="排序" v-if="form.seriesSortListTurnOn">
            <StringSortEditBox
              v-model:modelValue="form.seriesSortList"
              :map="relationSortMap"
            />
          </el-form-item>
        </div>

        <el-form-item label="文章别名">
          <el-input
            v-model="form.alias"
            maxlength="64"
            placeholder="请输入文章别名（用于别名访问）"
          />
          <el-button
            class="mt10"
            type="primary"
            size="small"
            @click="form.alias = buildTypeAlias(form.type)"
          >
            按时间随机别名
          </el-button>
          <el-button
            class="mt10"
            type="primary"
            size="small"
            @click="resetRandomAlias"
          >
            完全随机别名
          </el-button>
        </el-form-item>

        <el-form-item label="模板选择" v-if="form.type === 3">
          <el-select v-model="form.template" clearable placeholder="请选择模板">
            <el-option label="默认模板" value="" />
            <el-option label="友链模板" value="link" />
          </el-select>
        </el-form-item>

        <el-form-item label="发布时间">
          <el-date-picker
            v-model="form.date"
            type="datetime"
            placeholder="选择日期时间"
            style="width: 100%"
          />
          <el-button
            class="mt10"
            type="primary"
            size="small"
            @click="form.date = new Date()"
          >
            此刻
          </el-button>
        </el-form-item>

        <el-form-item label="允许评论">
          <el-switch v-model="form.allowRemark" />
        </el-form-item>
        <el-form-item label="是否置顶" v-if="form.type !== 3">
          <el-switch v-model="form.top" />
        </el-form-item>
        <el-form-item label="分类置顶" v-if="form.type !== 3">
          <el-switch v-model="form.sortop" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="0">草稿</el-radio>
            <el-radio :value="1">发布</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item>
          <el-button @click="goList">返回列表</el-button>
          <el-button
            v-if="form.pendingReview"
            :loading="saving"
            @click="confirmReview"
          >
            确认复核
          </el-button>
          <el-button type="primary" :loading="saving" @click="submit(false)">
            保存
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-dialog
      v-model="pickerVisible"
      :title="pickerTitle"
      width="860px"
      destroy-on-close
      append-to-body
    >
      <div class="relation-picker-toolbar">
        <el-input
          v-model="pickerParams.keyword"
          clearable
          placeholder="检索关键词"
          @keyup.enter="getPickerList(true)"
        />
        <el-button type="primary" @click="getPickerList(true)">搜索</el-button>
      </div>
      <div v-loading="pickerLoading" class="relation-picker-list">
        <el-checkbox-group
          v-if="pickerField?.multiple"
          v-model="pickerSelectedIds"
        >
          <div
            v-for="item in pickerList"
            :key="item._id"
            class="relation-picker-row"
          >
            <el-checkbox :value="item._id">
              <span>{{ getRelationName(item) }}</span>
              <span class="relation-picker-extra">{{
                item.alias || item.filename || ''
              }}</span>
            </el-checkbox>
            <el-button
              link
              type="primary"
              size="small"
              @click="openRelationEditor(pickerField, item)"
            >
              快捷编辑
            </el-button>
          </div>
        </el-checkbox-group>
        <el-radio-group v-else v-model="pickerSingleId" class="w_10">
          <div
            v-for="item in pickerList"
            :key="item._id"
            class="relation-picker-row"
          >
            <el-radio :value="item._id">
              <span>{{ getRelationName(item) }}</span>
              <span class="relation-picker-extra">{{
                item.alias || item.filename || ''
              }}</span>
            </el-radio>
            <el-button
              link
              type="primary"
              size="small"
              @click="openRelationEditor(pickerField, item)"
            >
              快捷编辑
            </el-button>
          </div>
        </el-radio-group>
      </div>
      <div class="clearfix mt15">
        <el-pagination
          class="fr"
          background
          layout="total, prev, pager, next"
          :total="pickerTotal"
          :pager-count="5"
          size="small"
          v-model:current-page="pickerParams.page"
          v-model:page-size="pickerParams.limit"
        />
      </div>
      <template #footer>
        <el-button @click="pickerVisible = false">取消</el-button>
        <el-button type="primary" @click="applyPickerSelection">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="relationEditVisible"
      :title="relationEditTitle"
      width="680px"
      destroy-on-close
      append-to-body
    >
      <el-form :model="relationEditForm" label-width="110px" @submit.prevent>
        <el-form-item
          v-for="field in relationEditFields"
          :key="field.name"
          :label="field.label"
        >
          <el-switch
            v-if="field.type === 'boolean'"
            v-model="relationEditForm[field.name]"
          />
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="relationEditForm[field.name]"
            controls-position="right"
          />
          <el-input
            v-else-if="field.type === 'textarea'"
            v-model="relationEditForm[field.name]"
            type="textarea"
            :rows="4"
          />
          <el-input v-else v-model="relationEditForm[field.name]" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="relationEditVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="relationSaving"
          @click="saveRelationEdit"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import {
  computed,
  defineComponent,
  h,
  onMounted,
  reactive,
  ref,
  watch
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton, ElMessage, ElTag } from 'element-plus'
import { Close, Document, Plus, Rank } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import RichEditor4 from '@/components/RichEditor4.vue'
import RichEditor5 from '@/components/RichEditor5'
import EmojiTextarea from '@/components/EmojiTextarea.vue'
import StringSortEditBox from '@/components/StringSortEditBox.vue'
import { multilingualApi } from '@/api'
import {
  getLanguageText,
  getPostStatusText,
  getPostTypeText
} from '@/utils/multilingual'
import { nowTimestampToBase36WithRandom } from '@/utils/utils'

const RELATION_SORT_MAP = {
  media: '媒体内容',
  event: '活动',
  vote: '投票',
  post: '博文',
  tweet: '推文',
  acgn: '番剧/电影/游戏/书籍'
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
    multiple: true
  },
  {
    label: '关联投票',
    field: 'contentVoteList',
    collectionName: 'votes',
    multiple: true
  },
  {
    label: '关联博文',
    field: 'contentPostList',
    collectionName: 'posts',
    multiple: true,
    postType: 1
  },
  {
    label: '关联推文',
    field: 'contentTweetList',
    collectionName: 'posts',
    multiple: true,
    postType: 2
  },
  {
    label: '关联番剧',
    field: 'contentBangumiList',
    collectionName: 'bangumis',
    multiple: true
  },
  {
    label: '关联电影',
    field: 'contentMovieList',
    collectionName: 'movies',
    multiple: true
  },
  {
    label: '关联书籍',
    field: 'contentBookList',
    collectionName: 'books',
    multiple: true
  },
  {
    label: '关联游戏',
    field: 'contentGameList',
    collectionName: 'games',
    multiple: true
  }
]

const DETAIL_RELATION_FIELDS = [
  {
    label: '相关活动',
    field: 'eventList',
    collectionName: 'events',
    multiple: true
  },
  {
    label: '相关投票',
    field: 'voteList',
    collectionName: 'votes',
    multiple: true
  },
  {
    label: '相关博文',
    field: 'postList',
    collectionName: 'posts',
    multiple: true,
    postType: 1
  },
  {
    label: '相关推文',
    field: 'tweetList',
    collectionName: 'posts',
    multiple: true,
    postType: 2
  },
  {
    label: '相关番剧',
    field: 'bangumiList',
    collectionName: 'bangumis',
    multiple: true
  },
  {
    label: '相关电影',
    field: 'movieList',
    collectionName: 'movies',
    multiple: true
  },
  {
    label: '相关书籍',
    field: 'bookList',
    collectionName: 'books',
    multiple: true
  },
  {
    label: '相关游戏',
    field: 'gameList',
    collectionName: 'games',
    multiple: true
  }
]

const ALL_RELATION_FIELDS = [
  ...BASE_RELATION_FIELDS,
  ...TWEET_CONTENT_RELATION_FIELDS,
  ...DETAIL_RELATION_FIELDS
]

const RELATION_EDIT_FIELD_MAP = {
  users: [
    { name: 'nickname', label: '昵称' },
    { name: 'description', label: '说明', type: 'textarea' }
  ],
  sorts: [
    { name: 'sortname', label: '分类名' },
    { name: 'alias', label: '别名' },
    { name: 'description', label: '说明', type: 'textarea' }
  ],
  tags: [{ name: 'tagname', label: '标签名' }],
  mappoints: [
    { name: 'title', label: '地点标题' },
    { name: 'summary', label: '摘要', type: 'textarea' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  bangumis: [
    { name: 'title', label: '番剧标题' },
    { name: 'summary', label: '简介', type: 'textarea' },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  movies: [
    { name: 'title', label: '电影标题' },
    { name: 'summary', label: '简介', type: 'textarea' },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  games: [
    { name: 'title', label: '游戏标题' },
    { name: 'summary', label: '简介', type: 'textarea' },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  books: [
    { name: 'title', label: '书籍标题' },
    { name: 'summary', label: '简介', type: 'textarea' },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  events: [
    { name: 'title', label: '活动标题' },
    { name: 'content', label: '内容', type: 'textarea' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  votes: [
    { name: 'title', label: '投票标题' },
    { name: 'maxSelect', label: '最大选择数', type: 'number' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  posts: [
    { name: 'title', label: '标题' },
    { name: 'excerpt', label: '摘要/推文', type: 'textarea' },
    { name: 'alias', label: '别名' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  attachments: [
    { name: 'name', label: '媒体名称' },
    { name: 'description', label: '描述', type: 'textarea' },
    { name: 'is360Panorama', label: '360 全景', type: 'boolean' }
  ]
}

function createRelationRecords() {
  const records = {}
  ALL_RELATION_FIELDS.forEach(field => {
    records[field.field] = []
  })
  return records
}

function getRecordIdList(records) {
  if (!Array.isArray(records)) {
    return []
  }

  return records.map(item => item._id).filter(Boolean)
}

const RelationSelectedList = defineComponent({
  name: 'RelationSelectedList',
  props: {
    field: { type: Object, required: true },
    records: { type: Array, default: () => [] }
  },
  emits: ['pick', 'edit', 'remove'],
  setup(props, { emit }) {
    const getName = record => {
      return (
        record.displayName ||
        record.title ||
        record.excerpt ||
        record.name ||
        record.tagname ||
        record.sortname ||
        record.filename ||
        record.alias ||
        record._id
      )
    }

    return () =>
      h('div', { class: 'relation-selected-list' }, [
        props.records.length > 0
          ? props.records.map(record =>
              h(
                ElTag,
                {
                  key: record._id,
                  class: 'relation-selected-tag',
                  closable: true,
                  onClose: () => emit('remove', props.field, record._id)
                },
                {
                  default: () => [
                    h(
                      'span',
                      { class: 'relation-selected-name' },
                      getName(record)
                    ),
                    h(
                      ElButton,
                      {
                        link: true,
                        type: 'primary',
                        size: 'small',
                        onClick: event => {
                          event.stopPropagation()
                          emit('edit', props.field, record)
                        }
                      },
                      { default: () => '快捷编辑' }
                    )
                  ]
                }
              )
            )
          : h('span', { class: 'cGray666' }, '未选择'),
        h(
          ElButton,
          {
            class: 'ml10',
            type: 'primary',
            size: 'small',
            onClick: () => emit('pick', props.field)
          },
          { default: () => (props.records.length > 0 ? '更换/追加' : '选择') }
        )
      ])
  }
})

export default {
  name: 'TranslationPostEditor',
  components: {
    Close,
    Document,
    EmojiTextarea,
    Plus,
    Rank,
    RelationSelectedList,
    RichEditor5,
    RichEditor4,
    StringSortEditBox,
    draggable
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const loading = ref(false)
    const saving = ref(false)
    const detailData = ref(null)
    const contentTab = ref('richText')
    const contentSource = ref('')
    const relationRecords = reactive(createRelationRecords())
    const form = reactive({
      id: '',
      languageCode: '',
      sourceLanguageCode: '',
      snapshotVersion: 1,
      pendingReview: false,
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
      seriesSortListTurnOn: false,
      seriesSortList: [],
      contentBangumiList: [],
      contentMovieList: [],
      contentGameList: [],
      contentBookList: [],
      contentPostList: [],
      contentTweetList: [],
      contentEventList: [],
      contentVoteList: [],
      contentSeriesSortListTurnOn: false,
      contentSeriesSortList: [],
      top: false,
      sortop: false,
      status: 0,
      allowRemark: false,
      template: '',
      code: '',
      editorVersion: 5,
      coverImages: []
    })

    const postEditorVersion = computed(() => {
      return Number(form.editorVersion || 5)
    })

    const pickerVisible = ref(false)
    const pickerLoading = ref(false)
    const pickerField = ref(null)
    const pickerList = ref([])
    const pickerTotal = ref(0)
    const pickerSelectedIds = ref([])
    const pickerSingleId = ref('')
    const pickerParams = reactive({
      page: 1,
      limit: 20,
      keyword: ''
    })

    const relationEditVisible = ref(false)
    const relationSaving = ref(false)
    const relationEditField = ref(null)
    const relationEditRecord = ref(null)
    const relationEditForm = reactive({})

    const typeTitle = computed(() => getPostTypeText(form.type))
    const maxCoverLength = computed(() => {
      if (form.type === 2) {
        return 9999
      }
      return 1
    })
    const pickerTitle = computed(() => {
      if (!pickerField.value) {
        return '选择关联内容'
      }
      return `选择${pickerField.value.label}`
    })
    const relationEditFields = computed(() => {
      if (!relationEditField.value) {
        return []
      }
      return (
        RELATION_EDIT_FIELD_MAP[relationEditField.value.collectionName] || []
      )
    })
    const relationEditTitle = computed(() => {
      if (!relationEditField.value) {
        return '快捷编辑关联内容'
      }
      return `快捷编辑${relationEditField.value.label}`
    })

    function getRelationField(fieldName) {
      return ALL_RELATION_FIELDS.find(item => item.field === fieldName)
    }

    function getRelationName(record) {
      return (
        record?.displayName ||
        record?.title ||
        record?.excerpt ||
        record?.name ||
        record?.tagname ||
        record?.sortname ||
        record?.filename ||
        record?.alias ||
        record?._id ||
        '-'
      )
    }

    function isImageAttachment(record) {
      return Boolean(record?.mimetype && record.mimetype.includes('image'))
    }

    function getAttachmentPreview(record) {
      const localPreview = record?.localThumbnailPath || record?.localFilepath
      if (localPreview) {
        return localPreview
      }

      const preview =
        record?.thumfor || record?.filepath || record?.remoteFilepath || ''
      if (!preview) {
        return ''
      }

      if (/^https?:\/\//.test(preview) || preview.startsWith('//')) {
        return preview
      }

      if (record?.mediaMode === 'remote') {
        return ''
      }

      return preview
    }

    function canPreviewAttachmentImage(record) {
      return isImageAttachment(record) && Boolean(getAttachmentPreview(record))
    }

    function generateRandomString(length) {
      const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
      let result = ''
      for (let index = 0; index < length; index++) {
        result += characters.charAt(
          Math.floor(Math.random() * characters.length)
        )
      }
      return result
    }

    function buildTypeAlias(type) {
      const timeRandomText = nowTimestampToBase36WithRandom()
      if (type === 1) {
        return `b-${timeRandomText}`
      }
      if (type === 2) {
        return `t-${timeRandomText}`
      }
      if (type === 3) {
        return `p-${timeRandomText}`
      }
      return timeRandomText
    }

    function resetRandomAlias() {
      let prefix = ''
      if (form.type === 1) {
        prefix = 'b-'
      } else if (form.type === 2) {
        prefix = 't-'
      } else if (form.type === 3) {
        prefix = 'p-'
      }
      form.alias = prefix + generateRandomString(8)
    }

    function setRelationRecordList(fieldName, records) {
      relationRecords[fieldName] = Array.isArray(records)
        ? records.filter(Boolean)
        : []
      syncRelationIds(fieldName)
    }

    function applyPost(post) {
      form.id = post._id
      form.languageCode = post.languageCode
      form.sourceLanguageCode = post.sourceLanguageCode
      form.snapshotVersion = post.snapshotVersion
      form.pendingReview = Boolean(post.pendingReview)
      form.title = post.title || ''
      form.date = post.date ? new Date(post.date) : null
      form.content = post.content || ''
      form.excerpt = post.excerpt || ''
      form.alias = post.alias || buildTypeAlias(post.type)
      form.type = Number(post.type || 1)
      form.top = Boolean(post.top)
      form.sortop = Boolean(post.sortop)
      form.status = Number(post.status || 0)
      form.allowRemark = Boolean(post.allowRemark)
      form.template = post.template || ''
      form.code = post.code || ''
      form.editorVersion = Number(post.editorVersion || 5)
      form.seriesSortList = Array.isArray(post.seriesSortList)
        ? post.seriesSortList
        : []
      form.seriesSortListTurnOn = form.seriesSortList.length > 0
      form.contentSeriesSortList = Array.isArray(post.contentSeriesSortList)
        ? post.contentSeriesSortList
        : []
      form.contentSeriesSortListTurnOn = form.contentSeriesSortList.length > 0

      setRelationRecordList('sort', post.sort ? [post.sort] : [])
      ALL_RELATION_FIELDS.forEach(field => {
        if (field.field === 'sort') {
          return
        }
        setRelationRecordList(field.field, post[field.field] || [])
      })
      contentSource.value = form.content
    }

    function getPostDetail() {
      loading.value = true
      multilingualApi
        .getTranslationPostDetail({ id: route.params.id })
        .then(response => {
          detailData.value = response.data.data
          applyPost(detailData.value.post)
        })
        .finally(() => {
          loading.value = false
        })
    }

    function syncRelationIds(fieldName) {
      if (fieldName === 'sort') {
        form.sort = relationRecords.sort[0]?._id || null
        return
      }
      form[fieldName] = getRecordIdList(relationRecords[fieldName])
    }

    function removeRelation(fieldName, index) {
      relationRecords[fieldName].splice(index, 1)
      syncRelationIds(fieldName)
    }

    function removeRelationById(field, recordId) {
      const index = relationRecords[field.field].findIndex(
        item => item._id === recordId
      )
      if (index >= 0) {
        removeRelation(field.field, index)
      }
    }

    function removeSingleRelation(field) {
      relationRecords[field.field] = []
      syncRelationIds(field.field)
    }

    function getPickerList(resetPage) {
      if (!pickerField.value) {
        return
      }
      if (resetPage === true) {
        pickerParams.page = 1
      }
      pickerLoading.value = true
      multilingualApi
        .getTranslationRelationList(
          {
            collectionName: pickerField.value.collectionName,
            languageCode: form.languageCode,
            recordKind: 'translation',
            keyword: pickerParams.keyword,
            page: pickerParams.page,
            limit: pickerParams.limit
          },
          true
        )
        .then(response => {
          const data = response.data.data || {}
          let list = data.list || []
          if (pickerField.value.postType) {
            list = list.filter(
              item => Number(item.type) === pickerField.value.postType
            )
          }
          pickerList.value = list
          pickerTotal.value = data.total || 0
        })
        .finally(() => {
          pickerLoading.value = false
        })
    }

    function openRelationPicker(field) {
      if (!field) {
        return
      }
      pickerField.value = field
      pickerParams.page = 1
      pickerParams.keyword = ''
      const selectedIds = getRecordIdList(relationRecords[field.field])
      pickerSelectedIds.value = selectedIds
      pickerSingleId.value = selectedIds[0] || ''
      pickerVisible.value = true
      getPickerList(true)
    }

    function applyPickerSelection() {
      const field = pickerField.value
      if (!field) {
        return
      }
      let selectedIds = []
      if (field.multiple) {
        selectedIds = pickerSelectedIds.value
      } else if (pickerSingleId.value) {
        selectedIds = [pickerSingleId.value]
      }
      const selectedMap = new Map()
      relationRecords[field.field].forEach(item =>
        selectedMap.set(item._id, item)
      )
      pickerList.value.forEach(item => selectedMap.set(item._id, item))
      const records = selectedIds.map(id => selectedMap.get(id)).filter(Boolean)
      relationRecords[field.field] = records
      syncRelationIds(field.field)
      pickerVisible.value = false
    }

    function openRelationEditor(field, record) {
      if (!field || !record) {
        return
      }
      relationEditField.value = field
      relationEditRecord.value = record
      Object.keys(relationEditForm).forEach(key => {
        delete relationEditForm[key]
      })
      relationEditFields.value.forEach(item => {
        relationEditForm[item.name] = record[item.name]
      })
      relationEditVisible.value = true
    }

    function replaceRecordInList(fieldName, record) {
      const index = relationRecords[fieldName].findIndex(
        item => item._id === record._id
      )
      if (index >= 0) {
        relationRecords[fieldName][index] = record
      }
    }

    function saveRelationEdit() {
      const field = relationEditField.value
      const record = relationEditRecord.value
      if (!field || !record) {
        return
      }
      const payload = {}
      relationEditFields.value.forEach(item => {
        payload[item.name] = relationEditForm[item.name]
      })
      relationSaving.value = true
      multilingualApi
        .updateTranslationRelation({
          collectionName: field.collectionName,
          id: record._id,
          languageCode: form.languageCode,
          payload
        })
        .then(response => {
          const updatedRecord = response.data.data
          replaceRecordInList(field.field, updatedRecord)
          const pickerIndex = pickerList.value.findIndex(
            item => item._id === updatedRecord._id
          )
          if (pickerIndex >= 0) {
            pickerList.value[pickerIndex] = updatedRecord
          }
          ElMessage.success('关联内容已保存')
          relationEditVisible.value = false
        })
        .finally(() => {
          relationSaving.value = false
        })
    }

    function onContentTabChange(tabName) {
      if (tabName === 'sourceCode') {
        contentSource.value = form.content
        return
      }
      form.content = contentSource.value
    }

    function onContentSeriesSortSwitch(value) {
      if (!value) {
        form.contentSeriesSortList = []
      }
    }

    function onSeriesSortSwitch(value) {
      if (!value) {
        form.seriesSortList = []
      }
    }

    function buildSubmitData(confirmReview) {
      if (contentTab.value === 'sourceCode') {
        form.content = contentSource.value
      }
      return {
        id: form.id,
        languageCode: form.languageCode,
        title: form.title,
        date: form.date,
        content: form.content,
        excerpt: form.excerpt,
        alias: form.alias,
        sort: form.sort,
        type: form.type,
        tags: form.tags,
        mappointList: form.mappointList,
        bangumiList: form.bangumiList,
        movieList: form.movieList,
        gameList: form.gameList,
        bookList: form.bookList,
        postList: form.postList,
        tweetList: form.tweetList,
        eventList: form.eventList,
        voteList: form.voteList,
        seriesSortList: form.seriesSortListTurnOn ? form.seriesSortList : [],
        contentBangumiList: form.contentBangumiList,
        contentMovieList: form.contentMovieList,
        contentGameList: form.contentGameList,
        contentBookList: form.contentBookList,
        contentPostList: form.contentPostList,
        contentTweetList: form.contentTweetList,
        contentEventList: form.contentEventList,
        contentVoteList: form.contentVoteList,
        contentSeriesSortList: form.contentSeriesSortListTurnOn
          ? form.contentSeriesSortList
          : [],
        top: form.top,
        sortop: form.sortop,
        status: form.status,
        allowRemark: form.allowRemark,
        template: form.template,
        code: form.code,
        editorVersion: form.editorVersion,
        coverImages: form.coverImages,
        confirmReview
      }
    }

    function submit(confirmReview) {
      saving.value = true
      multilingualApi
        .updateTranslationPost(buildSubmitData(confirmReview))
        .then(response => {
          detailData.value = response.data.data
          applyPost(detailData.value.post)
          ElMessage.success('保存成功')
        })
        .finally(() => {
          saving.value = false
        })
    }

    function confirmReview() {
      submit(true)
    }

    function goList() {
      router.push({ name: 'TranslationPostList' })
    }

    watch(
      () => pickerParams.page,
      () => {
        if (pickerVisible.value) {
          getPickerList(false)
        }
      }
    )

    onMounted(() => {
      getPostDetail()
    })

    return {
      Close,
      Document,
      Plus,
      Rank,
      contentSource,
      contentTab,
      confirmReview,
      detailData,
      detailRelationFields: DETAIL_RELATION_FIELDS,
      form,
      getAttachmentPreview,
      getLanguageText,
      getPostStatusText,
      getPostTypeText,
      getRelationField,
      getRelationName,
      goList,
      isImageAttachment,
      loading,
      maxCoverLength,
      onContentSeriesSortSwitch,
      onContentTabChange,
      onSeriesSortSwitch,
      openRelationEditor,
      openRelationPicker,
      pickerField,
      pickerList,
      pickerLoading,
      pickerParams,
      pickerSelectedIds,
      pickerSingleId,
      pickerTitle,
      pickerTotal,
      pickerVisible,
      relationEditFields,
      relationEditForm,
      relationEditTitle,
      relationEditVisible,
      relationRecords,
      relationSaving,
      relationSortMap: RELATION_SORT_MAP,
      postEditorVersion,
      removeRelation,
      removeRelationById,
      removeSingleRelation,
      resetRandomAlias,
      saveRelationEdit,
      saving,
      submit,
      syncRelationIds,
      tweetContentRelationFields: TWEET_CONTENT_RELATION_FIELDS,
      typeTitle,
      buildTypeAlias,
      applyPickerSelection,
      canPreviewAttachmentImage,
      getPickerList
    }
  }
}
</script>

<style scoped>
.translation-post-editor-page {
  max-width: 1180px;
}

.post-editor-body {
  width: 100%;
}

.cover-image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.cover-image-list :deep(.sortable-ghost) {
  opacity: 0.4;
}

.attachment-file-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  text-align: center;
  color: var(--el-text-color-secondary);
  word-break: break-word;
}

.relation-selected-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.relation-selected-tag {
  height: auto;
  min-height: 28px;
  padding: 4px 8px;
  white-space: normal;
}

.relation-selected-name {
  display: inline-block;
  max-width: 280px;
  vertical-align: middle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.relation-picker-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.relation-picker-list {
  min-height: 280px;
  max-height: 50vh;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}

.relation-picker-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.relation-picker-row:last-child {
  border-bottom: none;
}

.relation-picker-extra {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 767px) {
  .translation-post-editor-page {
    max-width: none;
  }

  :deep(.el-form-item) {
    display: block;
  }

  :deep(.el-form-item__label) {
    width: auto !important;
    justify-content: flex-start;
  }

  :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }

  .relation-picker-toolbar,
  .relation-picker-row {
    display: block;
  }
}
</style>
