import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@/assets/css/common.css'
import App from './App.vue'
import router from './router'
import store from './store'
import ResponsiveTable from '@/components/ResponsiveTable.vue'
import ResponsiveTableColumn from '@/components/ResponsiveTableColumn.vue'
import IpInfoDisplay from '@/components/IpInfoDisplay.vue'
import DeviceInfoDisplay from '@/components/DeviceInfoDisplay.vue'
import { initTheme } from '@/composables/useTheme'

initTheme()

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.component('ResponsiveTable', ResponsiveTable)
app.component('ResponsiveTableColumn', ResponsiveTableColumn)
app.component('IpInfoDisplay', IpInfoDisplay)
app.component('DeviceInfoDisplay', DeviceInfoDisplay)

app.use(store)
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')