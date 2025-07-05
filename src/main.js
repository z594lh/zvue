// main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // ✅ 正确引入 router 实例

const app = createApp(App)
app.use(router) // ✅ 使用 router 插件
app.mount('#app')