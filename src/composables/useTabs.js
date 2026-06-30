import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// 模块级共享状态，确保所有组件实例共用同一份数据
const tabs = ref([])
const cachedViews = ref([])
const refreshKeys = ref({})

const excludedPaths = ['/', '/login', '/403', '/json', '/company', '/fanyi']

export function useTabs() {
  const router = useRouter()
  const route = useRoute()

  const activePath = computed(() => route.path)

  function findTabIndex(path) {
    return tabs.value.findIndex(t => t.path === path)
  }

  function getComponentName(toRoute) {
    return toRoute.meta?.componentName || toRoute.name
  }

  function getTitle(toRoute) {
    return toRoute.meta?.title || toRoute.name || toRoute.path
  }

  function addTab(toRoute) {
    if (excludedPaths.includes(toRoute.path)) return

    const exists = findTabIndex(toRoute.path)
    if (exists !== -1) {
      tabs.value[exists].fullPath = toRoute.fullPath
      tabs.value[exists].query = toRoute.query
      return
    }

    const compName = getComponentName(toRoute)
    tabs.value.push({
      path: toRoute.path,
      fullPath: toRoute.fullPath,
      title: getTitle(toRoute),
      componentName: compName,
      query: toRoute.query,
      closable: true
    })

    if (compName && !cachedViews.value.includes(compName)) {
      cachedViews.value.push(compName)
    }
  }

  function removeTab(path) {
    const idx = findTabIndex(path)
    if (idx === -1) return

    const tab = tabs.value[idx]
    const compName = tab.componentName

    tabs.value.splice(idx, 1)

    const cacheIdx = cachedViews.value.indexOf(compName)
    if (cacheIdx !== -1) {
      cachedViews.value.splice(cacheIdx, 1)
    }

    if (path === route.path) {
      if (tabs.value.length > 0) {
        const nextTab = tabs.value[Math.min(idx, tabs.value.length - 1)]
        router.push(nextTab.fullPath)
      } else {
        router.push('/')
      }
    }
  }

  function moveTab(path, toIndex) {
    const fromIdx = findTabIndex(path)
    if (fromIdx === -1) return
    const arr = tabs.value.slice()
    const [moved] = arr.splice(fromIdx, 1)
    const clamped = Math.max(0, Math.min(toIndex, arr.length))
    if (clamped === fromIdx) return
    arr.splice(clamped, 0, moved)
    tabs.value = arr
  }

  function refreshTab(path) {
    refreshKeys.value = {
      ...refreshKeys.value,
      [path]: (refreshKeys.value[path] || 0) + 1
    }
  }

  function closeOther(path) {
    const keep = tabs.value.find(t => t.path === path)
    if (!keep) return

    tabs.value.filter(t => t.path !== path).forEach(t => {
      const ci = cachedViews.value.indexOf(t.componentName)
      if (ci !== -1) cachedViews.value.splice(ci, 1)
    })

    tabs.value = tabs.value.filter(t => t.path === path)

    if (path !== route.path) {
      router.push(path)
    }
  }

  function closeRight(path) {
    const idx = findTabIndex(path)
    if (idx === -1) return

    const rightTabs = tabs.value.slice(idx + 1)
    rightTabs.forEach(t => {
      const ci = cachedViews.value.indexOf(t.componentName)
      if (ci !== -1) cachedViews.value.splice(ci, 1)
    })

    tabs.value.splice(idx + 1)

    if (route.path !== path && tabs.value.findIndex(t => t.path === route.path) === -1) {
      router.push(path)
    }
  }

  function closeLeft(path) {
    const idx = findTabIndex(path)
    if (idx === -1) return

    const leftTabs = tabs.value.slice(0, idx)
    leftTabs.forEach(t => {
      const ci = cachedViews.value.indexOf(t.componentName)
      if (ci !== -1) cachedViews.value.splice(ci, 1)
    })

    tabs.value.splice(0, idx)

    if (findTabIndex(route.path) === -1) {
      router.push(path)
    }
  }

  function closeAll() {
    tabs.value.forEach(t => {
      const ci = cachedViews.value.indexOf(t.componentName)
      if (ci !== -1) cachedViews.value.splice(ci, 1)
    })
    tabs.value = []
    router.push('/')
  }

  function getTabKey(path) {
    const rk = refreshKeys.value[path] || 0
    return path + (rk ? '__' + rk : '')
  }

  return {
    tabs,
    cachedViews,
    refreshKeys,
    activePath,
    excludedPaths,
    addTab,
    removeTab,
    refreshTab,
    closeOther,
    closeRight,
    closeLeft,
    closeAll,
    moveTab,
    getTabKey
  }
}
