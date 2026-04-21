// main.js
import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import router from './router' // ✅ 正确引入 router 实例
import { restoreAuthToken } from '@/services/api.js'

// 恢复登录状态（如果有保存的token）
restoreAuthToken()

const app = createApp(App)
app.use(ElementPlus, { locale: zhCn })
app.use(router) // ✅ 使用 router 插件
app.mount('#app')