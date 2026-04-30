<template>
  <div class="common-layout">
    <el-container>
      <el-aside
        class="common-aside custom-scroll scroll-not-hide"
        :class="{ isCollapse: isCollapse, phoneMenuOpen: phoneMenuOpen }"
      >
        <div class="common-aside-body">
          <div
            class="common-aside-collapse-btn dflex flexCenter"
            @click="switchCollapse"
          >
            <div class="common-aside-collapse-btn-icon">
              <el-icon v-if="isCollapse"><ArrowRight /></el-icon>
              <el-icon v-else><ArrowLeft /></el-icon>
            </div>
          </div>
          <div class="common-logo">
            <div>多语言管理后台</div>
            <div class="common-logo-close-btn">
              <el-button text :icon="Close" @click="switchOpenMenu"></el-button>
            </div>
          </div>
          <el-menu
            :default-active="activeIndex"
            router
            class="admin-left-menu-body custom-scroll scroll-not-hide"
          >
            <el-sub-menu
              v-for="group in menuGroups"
              :key="group.index"
              :index="group.index"
            >
              <template #title>
                <i :class="group.icon"></i>{{ group.title }}
              </template>
              <el-menu-item
                v-for="item in group.children"
                :key="item.name"
                :index="item.name"
                @click="removeParam(item.name)"
                @click.middle="openNewTab(item.name)"
                :route="{ name: item.name }"
              >
                <i :class="item.icon"></i>
                <template #title>{{ item.title }}</template>
              </el-menu-item>
            </el-sub-menu>
          </el-menu>
        </div>
      </el-aside>
      <el-container>
        <el-header class="common-header">
          <div class="clearfix">
            <div class="fl pt5 switch-btn-body-phone">
              <el-button
                type="primary"
                :icon="Grid"
                @click="switchOpenMenu"
              ></el-button>
            </div>
            <template v-if="adminInfo">
              <div class="fr pt5">
                <el-button type="primary" circle text @click="logout">
                  <i class="fas fa-fw fa-sign-out-alt"></i>
                </el-button>
              </div>
              <div class="fr pt5">
                <el-button type="primary" circle text @click="goToBlog">
                  <i class="fas fa-fw fa-home"></i>
                </el-button>
              </div>
              <div class="fr pt5">
                <ThemeChanger />
              </div>
              <!-- adminInfo.role 999为站长 990 为管理员 -->
              <div class="fr pt10 fb dflex">
                <div class="common-header-nickname">
                  {{ adminInfo.nickname }}
                </div>
                （<template v-if="adminInfo.role === 999">站长</template
                ><template v-else>管理员</template>）
              </div>
            </template>
          </div>
        </el-header>
        <el-main>
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>
<script>
import { ref } from '@vue/reactivity'
import { computed, onMounted } from '@vue/runtime-core'
import { useRoute, useRouter } from 'vue-router'
import {
  SwitchButton,
  Setting,
  Fold,
  Expand,
  DArrowRight,
  DArrowLeft,
  Grid,
  Close,
  HomeFilled
} from '@element-plus/icons-vue'
import store from '@/store'
import { ElMessageBox } from 'element-plus'
import ThemeChanger from '@/components/ThemeChanger.vue'
import ls from '@/utils/ls'

const menuGroups = [
  {
    index: 'panel',
    title: '面板',
    icon: 'fas fa-fw fa-home pr10',
    children: [
      {
        name: 'MultilingualDashboard',
        title: '工作台',
        icon: 'fas fa-fw fa-chart-line pr10'
      }
    ]
  },
  {
    index: 'source-data',
    title: '源数据管理',
    icon: 'fas fa-fw fa-database pr10',
    children: [
      {
        name: 'SourcePostImport',
        title: '源文章导入',
        icon: 'fas fa-fw fa-file-import pr10'
      },
      {
        name: 'SourcePostSnapshotList',
        title: '源文章快照',
        icon: 'fas fa-fw fa-newspaper pr10'
      },
      {
        name: 'SourceAuthorRelationList',
        title: '源作者',
        icon: 'fas fa-fw fa-user pr10'
      },
      {
        name: 'SourceSortRelationList',
        title: '源分类',
        icon: 'fas fa-fw fa-folder pr10'
      },
      {
        name: 'SourceTagRelationList',
        title: '源标签',
        icon: 'fas fa-fw fa-tags pr10'
      },
      {
        name: 'SourceMappointRelationList',
        title: '源地点',
        icon: 'fas fa-fw fa-map-marker-alt pr10'
      },
      {
        name: 'SourceRelationList',
        title: '源关联内容',
        icon: 'fas fa-fw fa-project-diagram pr10'
      },
      {
        name: 'SourceMediaSnapshotList',
        title: '源媒体快照',
        icon: 'fas fa-fw fa-images pr10'
      }
    ]
  },
  {
    index: 'translation-data',
    title: '多语言数据管理',
    icon: 'fas fa-fw fa-language pr10',
    children: [
      {
        name: 'TranslationPostList',
        title: '多语言文章',
        icon: 'fas fa-fw fa-newspaper pr10'
      },
      {
        name: 'TranslationAuthorRelationList',
        title: '作者',
        icon: 'fas fa-fw fa-user pr10'
      },
      {
        name: 'TranslationSortRelationList',
        title: '分类',
        icon: 'fas fa-fw fa-folder pr10'
      },
      {
        name: 'TranslationTagRelationList',
        title: '标签',
        icon: 'fas fa-fw fa-tags pr10'
      },
      {
        name: 'TranslationMappointRelationList',
        title: '地点',
        icon: 'fas fa-fw fa-map-marker-alt pr10'
      },
      {
        name: 'RelationList',
        title: '关联内容',
        icon: 'fas fa-fw fa-project-diagram pr10'
      },
      {
        name: 'MultilingualMediaList',
        title: '媒体库',
        icon: 'fas fa-fw fa-images pr10'
      },
      {
        name: 'NaviList',
        title: '导航',
        icon: 'fas fa-fw fa-compass pr10'
      },
      {
        name: 'BannerList',
        title: '横幅',
        icon: 'fas fa-fw fa-image pr10'
      },
      {
        name: 'SidebarList',
        title: '侧边栏',
        icon: 'fas fa-fw fa-columns pr10'
      }
    ]
  },
  {
    index: 'settings',
    title: '设置',
    icon: 'fas fa-fw fa-cog pr10',
    children: [
      {
        name: 'MultilingualConfig',
        title: '多语言站点配置',
        icon: 'fas fa-fw fa-sliders-h pr10'
      },
      {
        name: 'MultilingualMediaSettings',
        title: '媒体设置',
        icon: 'fas fa-fw fa-photo-video pr10'
      },
      {
        name: 'MultilingualAiSettings',
        title: 'AI 设置',
        icon: 'fas fa-fw fa-robot pr10'
      }
    ]
  },
  {
    index: 'statistics',
    title: '统计',
    icon: 'fas fa-fw fa-chart-pie pr10',
    children: [
      {
        name: 'AiUsageSummary',
        title: 'AI 用量统计',
        icon: 'fas fa-fw fa-chart-bar pr10'
      },
      {
        name: 'ReaderlogList',
        title: '访客统计',
        icon: 'fas fa-fw fa-user-clock pr10'
      },
      {
        name: 'ReferrerList',
        title: '访问来源',
        icon: 'fas fa-fw fa-external-link-alt pr10'
      }
    ]
  },
  {
    index: 'system',
    title: '系统',
    icon: 'fas fa-fw fa-server pr10',
    children: [
      {
        name: 'BackupList',
        title: '备份',
        icon: 'fas fa-fw fa-archive pr10'
      }
    ]
  }
]

export default {
  components: {
    ThemeChanger
  },
  setup() {
    const route = useRoute()
    const router = useRouter()

    const activeIndex = computed(() => {
      return route.name
    })

    const removeParam = key => {
      if (key) {
        sessionStorage.removeItem(key)
      }
      phoneMenuOpen.value = false
    }
    const logout = () => {
      router.replace({
        name: 'Login'
      })
      // 清除token
      ls.removeItem('adminToken')
      sessionStorage.removeItem('adminToken')
    }

    const adminInfo = computed(() => {
      return store.getters.adminInfo
    })
    const siteUrl = computed(() => {
      return store.getters.siteUrl
    })

    const goToBlog = () => {
      const url = siteUrl.value || `${window.location.origin}/zh-CN/`
      window.open(url, '_blank')
    }

    const isCollapse = ref(false)
    const switchCollapse = () => {
      isCollapse.value = !isCollapse.value
    }
    const phoneMenuOpen = ref(false)
    const switchOpenMenu = () => {
      phoneMenuOpen.value = !phoneMenuOpen.value
    }

    const openNewTab = name => {
      const routeData = router.resolve({
        name: name
      })
      window.open(routeData.href, '_blank')
    }

    onMounted(() => {
      store.dispatch('setAdminInfo')
      store.dispatch('setOptions')
    })
    return {
      SwitchButton,
      Setting,
      Fold,
      Expand,
      DArrowRight,
      DArrowLeft,
      Grid,
      Close,
      HomeFilled,
      menuGroups,
      activeIndex,
      removeParam,
      logout,
      adminInfo,
      siteUrl,
      goToBlog,
      isCollapse,
      switchCollapse,
      phoneMenuOpen,
      switchOpenMenu,
      openNewTab
    }
  }
}
</script>
<style>
.common-layout,
.common-layout .el-container {
  height: 100%;
}
.common-header {
  border-bottom: 1px solid #dee2e6;
  background: #f8f9fa;
  height: 45px;
}
.common-aside {
  width: 191px;
  margin-right: 9px;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
}
.common-aside.isCollapse {
  width: 8px;
  overflow: hidden;
  margin-right: 0px;
}
.common-aside-body {
  width: 100%;
  position: relative;
}
.common-layout .el-menu {
  border-right: 0px;
}
.common-logo {
  padding: 20px 0;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: #ffffff;
}
.common-logo img {
  width: 50%;
}
.switch-btn-body {
  display: block;
}
.switch-btn-body-phone {
  display: none;
}
.common-logo-close-btn {
  display: none;
}
.common-aside-collapse-btn {
  position: fixed;
  top: 0;
  left: 191px;
  bottom: 0;
  z-index: 2;
  width: 8px;
  cursor: pointer;
  background-color: #fdfdfd;
  color: #979797;
  font-size: 10px;
  border-right: 1px solid #dee2e6;
}
.common-aside-collapse-btn:hover {
  background-color: #f9f9f9;
}
.isCollapse .common-aside-collapse-btn {
  left: 0px;
}
.admin-left-menu-body {
  overflow: auto;
  /* margin-right: 10px; */
}
.common-header-nickname {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 媒体查询 手机模式 */
@media (max-width: 767px) {
  .common-header-nickname {
    max-width: 75px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* 在手机模式下应用以下样式 */
  .switch-btn-body {
    display: none;
  }
  .switch-btn-body-phone {
    display: block;
  }
  .common-logo-close-btn {
    display: block;
  }
  .common-aside {
    width: 0px;
    display: none;
    border-right: none;
    position: fixed;
    z-index: 10;
    top: 0;
    left: 0;
    height: 100%;
    background: #fff;
  }
  /* .common-aside-body {
    width: 100%;
  } */
  .common-logo {
    padding: 10px 0;
    font-size: 14px;
    /* position: relative; */
  }
  .common-logo-close-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
  }
  .admin-left-menu-body {
    margin-right: 0;
  }
  .common-aside-collapse-btn {
    display: none;
  }
  /* phoneMenuOpen */
  .common-aside.phoneMenuOpen {
    display: block;
    width: 100%;
  }
}
</style>
