<template>
  <div id="app">
    <NavBar v-if="showTabBar" />
    <TabBar v-if="showTabBar" />
    <router-view v-slot="{ Component, route }">
      <TabViewport :component="Component" :route="route" />
    </router-view>
    <footer v-if="uiConfig.footer_text" class="app-brand-footer">{{ uiConfig.footer_text }}</footer>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue'
import { uiConfig, loadUiConfig } from '@/services/uiConfig.js'
import { useRoute } from 'vue-router'
import NavBar from '@/components/Navbar.vue'
import TabBar from '@/components/TabBar.vue'
import TabViewport from '@/components/workspace/TabViewport.vue'
import { useTabs } from '@/composables/useTabs.js'

export default {
  name: 'App',
  components: {
    NavBar,
    TabBar,
    TabViewport
  },
  setup() {
    const route = useRoute()
    onMounted(() => { loadUiConfig() })
    const { excludedPaths } = useTabs()

    const showTabBar = computed(() => {
      return !excludedPaths.includes(route.path)
    })

    return {
      uiConfig,
      showTabBar,
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #f5f7fa;
}

.app-brand-footer {padding:14px 20px;color:#8693a5;font-size:12px;line-height:1.7;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere}

/* ElMessage 居中显示，避免遮挡导航栏及下拉子菜单 */
.el-message {
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
}

/* 表格操作列按钮去掉默认左间距，避免挤到第二行 */
.el-table .el-button + .el-button {
  margin-left: 0;
}
</style>
