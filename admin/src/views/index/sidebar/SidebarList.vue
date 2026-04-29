<template>
  <div class="common-right-panel-form">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>侧边栏</el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-select
          v-model="params.languageCode"
          class="w_2"
          @change="getSidebarList"
        >
          <el-option
            v-for="item in languageOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <div class="fr">
        <!-- 按钮用 -->
        <!-- 排序 -->
        <el-button @click="onDragBtnClick" class="mr10">{{
          canDrag ? '完成排序' : '排序'
        }}</el-button>
        <!-- 追加 -->
        <el-dropdown trigger="click" @command="handleSideBarCommand">
          <el-button type="primary">
            追加<el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <!-- 用typeOptions v-for -->
              <el-dropdown-item
                v-for="(item, index) in sidebarSettingsTemplate"
                :key="item.type"
                :command="item.type"
                >{{ getSidebarTemplateMenuTitle(item) }}</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <!-- 侧边栏 -->
    <div class="mb20" v-if="sidebarSettingsForm.length > 0">
      <draggable
        v-model="sidebarSettingsForm"
        group="sidebarSettings"
        item-key="_id"
        handle=".handle"
      >
        <template #item="{ element }">
          <div>
            <div class="config-border-item">
              <div
                class="config-border-item-title clearfix"
                :class="{ handle: canDrag }"
              >
                <div class="fl pr10">
                  <!-- up-down-left-right -->
                  <i class="fas fa-arrows-alt-v" v-show="canDrag"></i>
                  <span class="pl5 dib">{{ element.title }}</span>
                </div>

                <!--  tag {{ element.status === 0? '不显示':'显示' }} -->
                <el-tag v-if="element.status === 1" type="success" class="fl"
                  >显示</el-tag
                >
                <el-tag
                  v-else-if="element.status === 0"
                  type="danger"
                  class="fl"
                  >不显示</el-tag
                >
                <!-- 展开按钮 -->
                <el-button
                  size="small"
                  text
                  class="fr ml10"
                  @click="
                    showIdList.includes(element._id)
                      ? showIdList.splice(showIdList.indexOf(element._id), 1)
                      : showIdList.push(element._id)
                  "
                  >{{
                    showIdList.includes(element._id) ? '收起' : '展开'
                  }}</el-button
                >
                <el-button
                  type="danger"
                  size="small"
                  class="fr"
                  @click="sidebarSettingsDelete(element)"
                  >删除</el-button
                >
              </div>
              <el-form
                :model="element"
                label-width="120px"
                label-position="left"
                v-if="showIdList.includes(element._id)"
              >
                <!-- title -->
                <el-form-item label="标题" prop="title">
                  <el-input v-model="element.title"></el-input>
                </el-form-item>
                <el-form-item label="说明" v-if="element.type === 8">
                  <div class="sidebar-form-tip">
                    <div>
                      分类项名称取自当前语言的分类翻译。未翻译的分类会继续显示源语言内容。
                    </div>
                    <el-button
                      type="primary"
                      link
                      @click="goRelationList('sorts')"
                    >
                      前往“关联内容”补齐分类翻译
                    </el-button>
                  </div>
                </el-form-item>
                <!-- content -->
                <el-form-item
                  label="内容"
                  prop="content"
                  v-if="showConetntTypeList.includes(element.type)"
                >
                  <RichEditor5
                    v-model:content="element.content"
                    :language-code="params.languageCode"
                  />
                </el-form-item>
                <!-- showTextInputTypeList -->
                <el-form-item
                  label="内容"
                  prop="content"
                  v-if="showTextInputTypeList.includes(element.type)"
                >
                  <el-input
                    v-model="element.content"
                    :placeholder="placeholderMap[element.type]"
                  ></el-input>
                </el-form-item>
                <!-- showTextareaTypeList -->
                <el-form-item
                  label="内容"
                  prop="content"
                  v-if="showTextareaTypeList.includes(element.type)"
                >
                  <el-input
                    type="textarea"
                    v-model="element.content"
                    :rows="8"
                    :placeholder="placeholderMap[element.type]"
                  ></el-input>
                </el-form-item>
                <el-form-item
                  label="显示条数"
                  prop="count"
                  v-if="showCountTypeList.includes(element.type)"
                >
                  <!-- 数字 1-100 -->
                  <el-input-number
                    v-model="element.count"
                    controls-position="right"
                    :min="1"
                    :max="100"
                    :step="1"
                    :precision="0"
                  ></el-input-number>
                </el-form-item>
                <el-form-item
                  label="参数"
                  prop="content"
                  v-if="element.type === 10"
                >
                  <GoogleAdInput v-model="element.content" />
                </el-form-item>
                <el-form-item label="状态" prop="status">
                  <!-- 0显示 1不显示 -->
                  <el-switch
                    v-model="element.status"
                    :active-value="1"
                    :inactive-value="0"
                  ></el-switch>
                </el-form-item>
                <!-- 提交按钮 -->
                <div class="mt10 clearfix">
                  <el-button
                    type="primary"
                    class="fr"
                    @click="sidebarSettingsSubmit(element)"
                    >提交更改</el-button
                  >
                </div>
              </el-form>
            </div>
          </div>
        </template>
      </draggable>
      <!-- 提交按钮 -->
      <!-- <div class="mt10 clearfix">
        <el-button type="primary" class="fr" @click="sidebarSettingsSubmit"
          >提交更改</el-button
        >
      </div> -->
    </div>
    <div class="mt30" v-else><el-empty description="暂无数据" /></div>
  </div>
</template>
<script>
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import RichEditor5 from '@/components/RichEditor5'
import GoogleAdInput from '@/components/GoogleAdInput'
import { escapeHtml } from '@/utils/utils'
import CheckDialogService from '@/services/CheckDialogService'
import {
  SUPPORTED_LANGUAGE_OPTIONS,
  getLocalizedSidebarBuiltinTitle,
  normalizeSidebarBuiltinTitle
} from '@/utils/multilingual'

const SIDEBAR_TEMPLATE_CONFIG_MAP = {
  1: {
    content: '',
    count: 1,
    status: 0
  },
  3: {
    content: '',
    count: 10,
    status: 0
  },
  4: {
    content: '',
    count: 10,
    status: 0
  },
  8: {
    content: '',
    count: 1,
    status: 0
  },
  9: {
    content: '',
    count: 1,
    status: 0
  },
  10: {
    content: '',
    count: 1,
    status: 0
  },
  11: {
    content: '',
    count: 1,
    status: 0
  },
  12: {
    content: '',
    count: 5,
    status: 0
  },
  13: {
    content: '',
    count: 10,
    status: 0
  },
  14: {
    content: '',
    count: 10,
    status: 0
  },
  15: {
    content: '',
    count: 10,
    status: 0
  }
}

const SIDEBAR_BASE_TEMPLATE_TYPES = [1, 11, 10]
const SIDEBAR_SINGLE_TEMPLATE_TYPES = [3, 4, 8, 9, 12, 13, 14, 15]

export default {
  components: {
    RichEditor5,
    draggable,
    GoogleAdInput
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    // 侧边栏设置
    const sidebarSettingsFormRef = ref(null)
    const sidebarSettingsForm = ref([])
    const params = reactive({
      languageCode: route.query.languageCode || 'zh-CN'
    })

    const normalizeSidebarItem = item => {
      return {
        ...item,
        title: normalizeSidebarBuiltinTitle(
          item?.title,
          item?.type,
          params.languageCode
        )
      }
    }

    const buildSidebarTemplate = type => {
      const config = SIDEBAR_TEMPLATE_CONFIG_MAP[type]
      if (!config) {
        return null
      }

      return {
        title: getLocalizedSidebarBuiltinTitle(type, params.languageCode),
        content: config.content,
        count: config.count,
        type,
        taxis: 0,
        status: config.status
      }
    }

    const getSidebarTemplateMenuTitle = item => {
      return getLocalizedSidebarBuiltinTitle(item?.type, 'zh-CN') || item?.title
    }

    const sidebarSettingsTemplate = computed(() => {
      // 检查 sidebarSettingsForm 里存在的 type，如果存在，只输出sidebarSettingsForm中没有的type
      const typeList = sidebarSettingsForm.value.map(item => item.type)
      const base = SIDEBAR_BASE_TEMPLATE_TYPES.map(type => {
        return buildSidebarTemplate(type)
      }).filter(Boolean)
      const result = SIDEBAR_SINGLE_TEMPLATE_TYPES.filter(type => {
        return !typeList.includes(type)
      })
        .map(type => {
          return buildSidebarTemplate(type)
        })
        .filter(Boolean)
      return base.concat(result)
    })

    const showConetntTypeList = [1]
    const showCountTypeList = [2, 3, 4, 5, 6, 12, 13, 14, 15]
    const showTextInputTypeList = []
    const showTextareaTypeList = [11]

    const placeholderMap = {
      10: '填写格式为：ad-slot,ad-format,ad-layout-key',
      11: '填写可信任的HTML代码，注意代码安全！'
    }

    const getSidebarList = () => {
      authApi.getSidebarList(params).then(res => {
        sidebarSettingsForm.value = (res.data.list || []).map(item => {
          return normalizeSidebarItem(item)
        })
      })
    }
    const handleSideBarCommand = command => {
      const item = buildSidebarTemplate(command)
      if (!item) {
        return
      }
      authApi
        .createSidebar({ ...item, languageCode: params.languageCode })
        .then(res => {
          // 在前面插入
          sidebarSettingsForm.value.unshift(normalizeSidebarItem(res.data.data))
        })
        .catch(err => {
          console.log(err)
        })
    }
    const sidebarSettingsSubmit = item => {
      const payload = normalizeSidebarItem(item)
      authApi
        .updateSidebar({ ...payload, languageCode: params.languageCode })
        .then(res => {
          item.title = payload.title
          ElMessage.success('更新成功')
        })
        .catch(err => {
          console.log(err)
        })
    }
    const sidebarSettingsDelete = row => {
      // 询问是否删除
      const id = row._id
      const title = escapeHtml(row.title) || '未定义标题'

      CheckDialogService.open({
        correctAnswer: '是',
        content: `此操作将<span class="cRed">永久删除侧边栏设置：【${title}】</span>, 是否继续?`,
        success: () => {
          return authApi
            .deleteSidebar({ id, languageCode: params.languageCode })
            .then(() => {
              ElMessage.success('删除成功')
              sidebarSettingsForm.value = sidebarSettingsForm.value.filter(
                item => item._id !== id
              )
            })
        }
      })
        .then(() => {})
        .catch(error => {
          console.log('Dialog closed:', error)
        })
    }

    const showIdList = ref([])

    const canDrag = ref(false)
    const onDragBtnClick = () => {
      if (canDrag.value) {
        const sidebarList = sidebarSettingsForm.value.map((item, index) => {
          return {
            _id: item._id,
            taxis: index
          }
        })
        updateSidebarTaxis({
          languageCode: params.languageCode,
          sidebarList
        }).then(res => {
          canDrag.value = false
          getSidebarList()
        })
      } else {
        canDrag.value = true
      }
    }
    const updateSidebarTaxis = params => {
      return authApi.updateSidebarTaxis(params).then(res => {
        ElMessage.success('更新成功')
      })
    }

    const relationRouteNameMap = {
      users: 'TranslationAuthorRelationList',
      sorts: 'TranslationSortRelationList',
      tags: 'TranslationTagRelationList',
      mappoints: 'TranslationMappointRelationList'
    }

    const goRelationList = collectionName => {
      router.push({
        name:
          relationRouteNameMap[collectionName] ||
          'TranslationAuthorRelationList',
        query: {
          languageCode: params.languageCode
        }
      })
    }

    onMounted(() => {
      getSidebarList()
    })
    return {
      // 侧边栏设置
      sidebarSettingsFormRef,
      sidebarSettingsForm,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      params,
      sidebarSettingsTemplate,
      showConetntTypeList,
      showCountTypeList,
      showTextInputTypeList,
      showTextareaTypeList,
      placeholderMap,
      getSidebarTemplateMenuTitle,
      getSidebarList,
      handleSideBarCommand,
      sidebarSettingsSubmit,
      sidebarSettingsDelete,
      showIdList,
      canDrag,
      onDragBtnClick,
      goRelationList
    }
  }
}
</script>
<style scoped>
.handle {
  cursor: move;
}

.sidebar-form-tip {
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
</style>
