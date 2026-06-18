<template>
  <div class="tab-bar" v-if="tabs.length > 0" @mousedown="onBarMouseDown">
    <span class="tab-scroll-btn tab-scroll-left" @click.stop="scrollTabs(-200)" v-if="showLeftArrow">‹</span>
    <div class="tab-list" ref="tabListRef" @wheel.prevent="onWheel">
      <div
        v-for="tab in tabs"
        :key="tab.path"
        class="tab-item"
        :class="{ active: activePath === tab.path }"
        :ref="el => setTabRef(tab.path, el)"
        @click="switchTab(tab)"
        @contextmenu.prevent="openContextMenu($event, tab)"
        @mouseup.middle.prevent="removeTab(tab.path)"
      >
        <span class="tab-title" :title="tab.title">{{ tab.title }}</span>
        <span class="tab-refresh" :class="{ invisible: activePath !== tab.path }" @click.stop="refreshTab(tab.path)" title="刷新">↻</span>
        <span class="tab-close" @click.stop="removeTab(tab.path)" title="关闭">&#x2715;</span>
      </div>
    </div>
    <span class="tab-scroll-btn tab-scroll-right" @click.stop="scrollTabs(200)" v-if="showRightArrow">›</span>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="tab-context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <div class="context-item" @click="handleClose">关闭</div>
        <div class="context-divider"></div>
        <div class="context-item" @click="handleCloseOther">关闭其他</div>
        <div class="context-item" @click="handleCloseRight">关闭右侧</div>
        <div class="context-item" @click="handleCloseLeft">关闭左侧</div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTabs } from '@/composables/useTabs.js'

export default {
  name: 'TabBar',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const {
      tabs,
      activePath,
      addTab,
      removeTab,
      refreshTab,
      closeOther,
      closeRight,
      closeLeft
    } = useTabs()

    const tabListRef = ref(null)
    const tabRefs = {}
    const showLeftArrow = ref(false)
    const showRightArrow = ref(false)

    const contextMenu = ref({
      visible: false,
      x: 0,
      y: 0,
      tab: null
    })

    function setTabRef(path, el) {
      if (el) {
        tabRefs[path] = el
      }
    }

    function switchTab(tab) {
      if (route.path !== tab.path) {
        router.push(tab.fullPath)
      }
    }

    function scrollTabs(offset) {
      if (!tabListRef.value) return
      tabListRef.value.scrollBy({ left: offset, behavior: 'smooth' })
    }

    function onWheel(e) {
      if (!tabListRef.value) return
      tabListRef.value.scrollBy({ left: e.deltaY, behavior: 'auto' })
    }

    function checkArrows() {
      if (!tabListRef.value) return
      const el = tabListRef.value
      showLeftArrow.value = el.scrollLeft > 1
      showRightArrow.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    }

    function openContextMenu(e, tab) {
      contextMenu.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        tab
      }
    }

    function closeContextMenu() {
      contextMenu.value.visible = false
    }

    function handleClose() {
      if (contextMenu.value.tab) removeTab(contextMenu.value.tab.path)
      closeContextMenu()
    }

    function handleCloseOther() {
      if (contextMenu.value.tab) closeOther(contextMenu.value.tab.path)
      closeContextMenu()
    }

    function handleCloseRight() {
      if (contextMenu.value.tab) closeRight(contextMenu.value.tab.path)
      closeContextMenu()
    }

    function handleCloseLeft() {
      if (contextMenu.value.tab) closeLeft(contextMenu.value.tab.path)
      closeContextMenu()
    }

    function onBarMouseDown() {
      closeContextMenu()
    }

    function scrollActiveIntoView() {
      nextTick(() => {
        const el = tabRefs[activePath.value]
        const container = tabListRef.value
        if (!el || !container) return
        const elLeft = el.offsetLeft
        const elWidth = el.offsetWidth
        const cw = container.clientWidth
        const sl = container.scrollLeft
        if (elLeft < sl) {
          container.scrollTo({ left: Math.max(0, elLeft - 12), behavior: 'smooth' })
        } else if (elLeft + elWidth > sl + cw) {
          container.scrollTo({ left: elLeft + elWidth - cw + 12, behavior: 'smooth' })
        }
      })
    }

    // 路由变化时新增/更新页签（fullPath 含 query，确保页签记住最新参数）
    watch(() => route.fullPath, () => {
      addTab(route)
      scrollActiveIntoView()
    }, { immediate: true })

    // 监听 tabs 长度变化以更新箭头
    watch(() => tabs.value.length, () => {
      nextTick(checkArrows)
    })

    function onResize() {
      checkArrows()
    }

    function onClickOutside() {
      if (contextMenu.value.visible) {
        closeContextMenu()
      }
    }

    onMounted(() => {
      document.addEventListener('click', onClickOutside)
      window.addEventListener('resize', onResize)
      tabListRef.value?.addEventListener('scroll', checkArrows)
      nextTick(checkArrows)
    })

    onUnmounted(() => {
      document.removeEventListener('click', onClickOutside)
      window.removeEventListener('resize', onResize)
      tabListRef.value?.removeEventListener('scroll', checkArrows)
    })

    return {
      tabs,
      activePath,
      removeTab,
      refreshTab,
      tabListRef,
      tabRefs,
      showLeftArrow,
      showRightArrow,
      contextMenu,
      setTabRef,
      switchTab,
      scrollTabs,
      onWheel,
      openContextMenu,
      handleClose,
      handleCloseOther,
      handleCloseRight,
      handleCloseLeft,
      onBarMouseDown
    }
  }
}
</script>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 60px;
  z-index: 99;
  user-select: none;
}

.tab-scroll-btn {
  flex-shrink: 0;
  width: 28px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #888;
  font-size: 18px;
  font-weight: bold;
  transition: color 0.2s;
  line-height: 1;
}

.tab-scroll-btn:hover {
  color: #667eea;
  background: #f5f5f5;
}

.tab-list {
  flex: 1;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  gap: 2px;
  padding: 0 4px;
  scroll-behavior: smooth;
}

.tab-list::-webkit-scrollbar {
  height: 0;
}

.tab-list::-webkit-scrollbar-thumb {
  background: transparent;
}

.tab-item {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 32px;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  position: relative;
  transition: all 0.2s;
}

.tab-item::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 16px;
  background: #e8e8e8;
}

.tab-item:last-child::after {
  display: none;
}

.tab-item:hover {
  color: #333;
  background: #f5f5f5;
}

.tab-item.active {
  color: #667eea;
  background: #f0f3ff;
}

.tab-title {
  width: 110px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-refresh,
.tab-close {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.tab-item:hover .tab-refresh,
.tab-item:hover .tab-close,
.tab-item.active .tab-refresh,
.tab-item.active .tab-close {
  opacity: 0.7;
}

.tab-refresh:hover,
.tab-close:hover {
  opacity: 1 !important;
  background: rgba(0, 0, 0, 0.1);
}

.tab-refresh {
  font-size: 16px;
  line-height: 1;
}

.tab-refresh.invisible {
  visibility: hidden;
}

.tab-close {
  font-size: 11px;
  line-height: 1;
}

/* 右键菜单 */
.tab-context-menu {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 120px;
  padding: 4px 0;
  animation: fadeIn 0.12s ease;
}

.context-item {
  padding: 8px 16px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: background 0.15s;
}

.context-item:hover {
  background: #f5f5f5;
  color: #667eea;
}

.context-divider {
  height: 1px;
  background: #eee;
  margin: 4px 0;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 768px) {
  .tab-title {
    width: 70px;
  }

  .tab-item {
    padding: 0 8px;
    gap: 4px;
  }
}
</style>
