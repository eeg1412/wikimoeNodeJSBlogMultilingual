<template>
  <div class="common-right-panel-form relation-list-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>多语言数据管理</el-breadcrumb-item>
        <el-breadcrumb-item>多语言{{ title }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="relation-search-form"
          @submit.prevent
          @keypress.enter="getSourceList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="名称、标题、文件名、源 ID"
              clearable
              style="width: 260px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.sourceLanguageCode"
              clearable
              placeholder="源语言"
              style="width: 150px"
              @change="getSourceList(true)"
              @clear="getSourceList(true)"
            >
              <el-option
                v-for="item in languageOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.languageCode"
              clearable
              placeholder="翻译语言"
              style="width: 150px"
              @change="getSourceList(true)"
              @clear="getSourceList(true)"
            >
              <el-option
                v-for="item in languageOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="showCollectionColumn">
            <el-select
              v-model="params.collectionName"
              clearable
              placeholder="全部类型"
              style="width: 160px"
              @change="getSourceList(true)"
              @clear="getSourceList(true)"
            >
              <el-option
                v-for="item in collectionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getSourceList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr relation-actions">
        <el-button :loading="loading" @click="getSourceList(false)">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="mb20 list-table-body" v-loading="loading">
      <ResponsiveTable
        ref="tableRef"
        :data="sourceGroupList"
        :row-key="getSourceGroupRowKey"
        height="100%"
        border
      >
        <ResponsiveTableColumn
          v-if="showCollectionColumn"
          label="类型"
          width="120"
        >
          <template #default="{ row }">
            {{ getCollectionText(row.sourceRecord.collectionName) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源数据" min-width="260">
          <template #default="{ row }">
            <div class="relation-title">
              {{ getRelationDisplayName(row.sourceRecord) }}
            </div>
            <div class="source-meta">
              源 ID：{{ row.sourceRecord.sourceId }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn
          v-if="isAuthorCollection"
          label="头像"
          width="82"
        >
          <template #default="{ row }">
            <div class="relation-media-cell">
              <el-image
                v-if="getAuthorPhotoUrl(row.sourceRecord)"
                :src="getAuthorPhotoUrl(row.sourceRecord)"
                :preview-src-list="[getAuthorPhotoUrl(row.sourceRecord)]"
                preview-teleported
                fit="cover"
                class="relation-media-avatar"
              />
              <div v-else class="relation-media-empty relation-media-avatar">
                -
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn
          v-if="isAuthorCollection"
          label="封面"
          width="126"
        >
          <template #default="{ row }">
            <div class="relation-media-cell">
              <el-image
                v-if="getAuthorCoverUrl(row.sourceRecord)"
                :src="getAuthorCoverUrl(row.sourceRecord)"
                :preview-src-list="[getAuthorCoverUrl(row.sourceRecord)]"
                preview-teleported
                fit="cover"
                class="relation-media-cover"
              />
              <div v-else class="relation-media-empty relation-media-cover">
                -
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源语言" width="150">
          <template #default="{ row }">
            {{ getLanguageText(getSourceLanguageCode(row.sourceRecord)) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="语言版本" min-width="280">
          <template #default="{ row }">
            <div class="language-version-tags">
              <el-tag
                v-for="item in getTranslationRows(row)"
                :key="item.languageCode"
                size="small"
                effect="plain"
                :type="getTranslationTagType(item.translation)"
              >
                {{ item.languageCode }}
              </el-tag>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="更新时间" width="180">
          <template #default="{ row }">
            {{
              $formatDate(
                row.sourceRecord.updatedAt || row.sourceRecord.createdAt
              )
            }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-dropdown
              v-if="isAuthorCollection"
              trigger="click"
              @command="command => handleSourceActionCommand(row, command)"
            >
              <el-button type="primary" size="small">
                作者操作
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="languageList">
                    <el-icon><View /></el-icon>
                    <span>语言版本</span>
                  </el-dropdown-item>
                  <el-dropdown-item
                    command="syncAuthorMedia"
                    :disabled="isSourceAuthorMediaSyncing(row.sourceRecord)"
                  >
                    <el-icon><Refresh /></el-icon>
                    <span>同步头像封面</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button
              v-else
              type="primary"
              size="small"
              @click="goLanguageList(row)"
            >
              语言版本
            </el-button>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </div>

    <div class="clearfix">
      <el-pagination
        class="fr"
        background
        layout="total, prev, pager, next"
        :total="total"
        :pager-count="5"
        size="small"
        v-model:current-page="params.page"
        v-model:page-size="params.limit"
        @current-change="getSourceList(false)"
      />
    </div>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Refresh, View } from '@element-plus/icons-vue'
import { multilingualApi } from '@/api'
import {
  restoreListSessionParams,
  saveListSessionParams
} from '@/composables/useListSessionParams'
import {
  RELATION_COLLECTION_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText,
  getRelationDisplayName
} from '@/utils/multilingual'

export default {
  name: 'RelationSourceListBySource',
  components: {
    ArrowDown,
    Refresh,
    View
  },
  props: {
    title: {
      type: String,
      required: true
    },
    collectionName: {
      type: String,
      default: ''
    },
    excludeCollectionNames: {
      type: Array,
      default() {
        return []
      }
    },
    languageRouteName: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const route = useRoute()
    const router = useRouter()
    const tableRef = ref(null)
    const sourceGroupList = ref([])
    const total = ref(0)
    const loading = ref(false)
    const sourceAuthorMediaSyncLoadingMap = reactive({})
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: '',
      sourceLanguageCode: '',
      languageCode: '',
      collectionName: route.query.collectionName || ''
    })
    restoreListSessionParams(route, params)

    const isAuthorCollection = computed(() => {
      return props.collectionName === 'users'
    })

    const showCollectionColumn = computed(() => {
      return !props.collectionName
    })

    const isCollectionSelectable = collectionName => {
      if (!collectionName) {
        return false
      }
      return !props.excludeCollectionNames.includes(collectionName)
    }

    const collectionOptions = computed(() => {
      return RELATION_COLLECTION_OPTIONS.filter(item => {
        return isCollectionSelectable(item.value)
      })
    })

    const languageOptions = computed(() => {
      return SUPPORTED_LANGUAGE_OPTIONS.map(item => {
        return {
          label: item.label,
          value: item.value
        }
      })
    })

    if (
      params.collectionName &&
      !isCollectionSelectable(params.collectionName)
    ) {
      params.collectionName = ''
    }

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit
      }
      if (props.collectionName) {
        requestParams.collectionName = props.collectionName
      }
      if (
        !props.collectionName &&
        params.collectionName &&
        isCollectionSelectable(params.collectionName)
      ) {
        requestParams.collectionName = params.collectionName
      }
      if (!props.collectionName && props.excludeCollectionNames.length > 0) {
        requestParams.excludeCollectionNames =
          props.excludeCollectionNames.join(',')
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.sourceLanguageCode) {
        requestParams.sourceLanguageCode = params.sourceLanguageCode
      }
      if (params.languageCode) {
        requestParams.languageCode = params.languageCode
      }
      return requestParams
    }

    const getSourceList = resetPage => {
      if (resetPage === true) {
        params.page = 1
      }
      loading.value = true
      multilingualApi
        .getTranslationRelationListBySource(getRequestParams(), true)
        .then(response => {
          const responseData = response.data.data || {}
          sourceGroupList.value = responseData.list || []
          total.value = responseData.total || 0
          tableRef.value?.scrollTo({ top: 0 })
          saveListSessionParams(route, params)
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    const getSourceGroupRowKey = row => {
      return `${row.sourceRecord?.collectionName || props.collectionName}:${row.sourceRecord?.sourceId || row.sourceRecord?._id || ''}`
    }

    const getSourceLanguageCode = row => {
      return row?.sourceLanguageCode || row?.languageCode || ''
    }

    const getTranslationRows = row => {
      const translations = row.translations || {}
      const sourceLanguageCode = getSourceLanguageCode(row.sourceRecord)
      return SUPPORTED_LANGUAGE_OPTIONS.filter(item => {
        return item.value !== sourceLanguageCode
      }).map(item => {
        return {
          languageCode: item.value,
          translation: translations[item.value]
        }
      })
    }

    const getTranslationTagType = translation => {
      if (!translation) {
        return 'info'
      }
      if (translation.pendingReview) {
        return 'warning'
      }
      return 'success'
    }

    const getCollectionText = collectionName => {
      const item = RELATION_COLLECTION_OPTIONS.find(option => {
        return option.value === collectionName
      })
      if (item) {
        return item.label
      }
      return collectionName || '-'
    }

    const isAbsoluteMediaUrl = value => {
      if (!value) {
        return false
      }
      return /^(https?:)?\/\//.test(value) || value.startsWith('/')
    }

    const normalizeMediaUrl = value => {
      if (!value) {
        return ''
      }
      if (isAbsoluteMediaUrl(value)) {
        return value
      }
      return value
    }

    const appendMediaTimestamp = (url, record) => {
      if (!url) {
        return ''
      }
      const stampSource = record?.updatedAt || record?.sourceUpdatedAt
      if (!stampSource) {
        return url
      }
      const stamp = new Date(stampSource).getTime()
      if (!stamp) {
        return url
      }
      const separator = url.includes('?') ? '&' : '?'
      return `${url}${separator}s=${stamp}`
    }

    const getAuthorPhotoUrl = row => {
      return appendMediaTimestamp(normalizeMediaUrl(row?.photo), row)
    }

    const getAuthorCoverUrl = row => {
      const cover = row?.cover
      const previewCandidateList = [
        cover?.localThumbnailPath,
        cover?.localFilepath,
        cover?.thumfor,
        cover?.filepath,
        cover?.remoteFilepath
      ]
      for (const item of previewCandidateList) {
        const previewUrl = normalizeMediaUrl(item)
        if (previewUrl) {
          return appendMediaTimestamp(previewUrl, cover)
        }
      }
      return ''
    }

    const goLanguageList = row => {
      const sourceId = row.sourceRecord?.sourceId
      if (!sourceId) {
        return
      }
      const routeParams = {
        sourceId: String(sourceId)
      }
      if (!props.collectionName) {
        routeParams.collectionName = row.sourceRecord?.collectionName || ''
      }
      router.push({
        name: props.languageRouteName,
        params: routeParams
      })
    }

    const getSourceAuthorMediaSyncActionKey = row => {
      if (!row || !row._id) {
        return ''
      }
      return `sourceAuthorMedia:${row._id}`
    }

    const isSourceAuthorMediaSyncing = row => {
      const actionKey = getSourceAuthorMediaSyncActionKey(row)
      return Boolean(actionKey && sourceAuthorMediaSyncLoadingMap[actionKey])
    }

    const syncSourceAuthorMedia = row => {
      if (!row || isSourceAuthorMediaSyncing(row)) {
        return
      }
      const actionKey = getSourceAuthorMediaSyncActionKey(row)
      if (!actionKey) {
        return
      }

      ElMessageBox.confirm(
        '确认使用当前源作者快照，同步全部多语言作者的 photo 和 cover？该操作只会覆盖头像和封面，不会改动昵称、邮箱与说明。',
        '同步多语言作者头像封面',
        {
          type: 'warning',
          confirmButtonText: '同步头像封面',
          cancelButtonText: '取消'
        }
      )
        .then(() => {
          sourceAuthorMediaSyncLoadingMap[actionKey] = true
          return multilingualApi.syncSourceAuthorMedia(
            {
              id: row._id
            },
            true
          )
        })
        .then(response => {
          const result = response.data.data || {}
          const updatedCount = Number(result.updatedCount || 0)
          getSourceList(false)
          if (updatedCount > 0) {
            ElMessage.success(`已同步 ${updatedCount} 个多语言作者的头像和封面`)
            return
          }
          ElMessage.warning('当前源作者还没有可同步的多语言作者')
        })
        .catch(error => {
          if (error !== 'cancel' && error !== 'close') {
            console.log(error)
          }
        })
        .finally(() => {
          sourceAuthorMediaSyncLoadingMap[actionKey] = false
        })
    }

    const handleSourceActionCommand = (row, command) => {
      if (command === 'languageList') {
        goLanguageList(row)
        return
      }
      if (command === 'syncAuthorMedia') {
        syncSourceAuthorMedia(row.sourceRecord)
      }
    }

    onMounted(() => {
      getSourceList(false)
    })

    return {
      sourceGroupList,
      tableRef,
      total,
      loading,
      params,
      isAuthorCollection,
      showCollectionColumn,
      collectionOptions,
      languageOptions,
      getSourceList,
      getSourceGroupRowKey,
      getSourceLanguageCode,
      getTranslationRows,
      getTranslationTagType,
      getCollectionText,
      getLanguageText,
      getRelationDisplayName,
      getAuthorPhotoUrl,
      getAuthorCoverUrl,
      goLanguageList,
      isSourceAuthorMediaSyncing,
      handleSourceActionCommand
    }
  }
}
</script>

<style scoped>
.relation-list-page {
  min-width: 0;
}

.relation-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.relation-title {
  font-weight: 600;
  word-break: break-word;
}

.source-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.relation-media-cell {
  display: flex;
  align-items: center;
}

.relation-media-avatar,
.relation-media-cover,
.relation-media-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.relation-media-avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
}

.relation-media-cover {
  width: 88px;
  height: 44px;
  border-radius: 8px;
}

.language-version-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media screen and (max-width: 768px) {
  .relation-media-avatar {
    width: 40px;
    height: 40px;
  }

  .relation-media-cover {
    width: 76px;
    height: 40px;
  }
}
</style>
