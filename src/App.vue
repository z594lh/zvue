<template>
  <div id="app">
    <NavBar v-if="showTabBar" />
    <TabBar v-if="showTabBar" />
    <router-view v-slot="{ Component, route }">
      <keep-alive :include="cachedViews">
        <component :is="Component" :key="getTabKey(route.path)" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/Navbar.vue'
import TabBar from '@/components/TabBar.vue'
import { useTabs } from '@/composables/useTabs.js'

export default {
  name: 'App',
  components: {
    NavBar,
    TabBar
  },
  setup() {
    const route = useRoute()
    const { cachedViews, excludedPaths, getTabKey } = useTabs()

    const showTabBar = computed(() => {
      return !excludedPaths.includes(route.path)
    })

    return {
      showTabBar,
      cachedViews,
      getTabKey
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
