<template>
  <div class="tab-bar" v-if="tabs.length > 0" @mousedown="onBarMouseDown">
    <span class="tab-scroll-btn tab-scroll-left" @click.stop="scrollTabs(-200)" v-if="showLeftArrow">‹</span>
    <div class="tab-list" ref="tabListRef" :class="{ 'no-anim': noAnim }" @wheel.prevent="onWheel">
      <div
        v-for="tab in tabs"
        :key="tab.path"
        class="tab-item"
        :class="{ active: activePath === tab.path, dragging: draggingPath === tab.path }"
        :style="tabStyle(tab)"
        :ref="el => setTabRef(tab.path, el)"
        @mousedown="onTabMouseDown($event, tab)"
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
      closeLeft,
      moveTab
    } = useTabs()

    const tabListRef = ref(null)
    const tabRefs = {}
    const showLeftArrow = ref(false)
    const showRightArrow = ref(false)
    const draggingPath = ref(null)
    const dragDx = ref(0)
    const shifts = ref({})
    const noAnim = ref(false)
    let pressPath = null
    let pressStartX = 0
    let dragMoved = false
    let startIndex = -1
    let rects = []
    let stepWidth = 0
    let currentTarget = -1

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

    function tabStyle(tab) {
      if (tab.path === draggingPath.value) {
        return { transform: `translateX(${dragDx.value}px)` }
      }
      const s = shifts.value[tab.path]
      return s ? { transform: `translateX(${s}px)` } : null
    }

    function onTabMouseDown(e, tab) {
      if (e.button !== 0) return
      if (e.target.closest('.tab-close, .tab-refresh')) return
      switchTab(tab)
      pressPath = tab.path
      pressStartX = e.clientX
      dragMoved = false
      document.addEventListener('mousemove', onDragMove)
      document.addEventListener('mouseup', onDragEnd)
    }

    function beginDrag() {
      startIndex = tabs.value.findIndex(t => t.path === pressPath)
      rects = tabs.value.map(t => {
        const r = tabRefs[t.path].getBoundingClientRect()
        return { left: r.left, width: r.width, center: r.left + r.width / 2 }
      })
      stepWidth = rects[startIndex].width + 2
      currentTarget = startIndex
      draggingPath.value = pressPath
    }

    function onDragMove(e) {
      if (!pressPath) return
      if (!dragMoved) {
        if (Math.abs(e.clientX - pressStartX) < 5) return
        dragMoved = true
        beginDrag()
      }
      const dx = e.clientX - pressStartX
      dragDx.value = dx

      const draggedCenter = rects[startIndex].center + dx
      let count = 0
      for (let k = 0; k < rects.length; k++) {
        if (k === startIndex) continue
        if (rects[k].center < draggedCenter) count++
      }
      currentTarget = count

      const ns = {}
      for (let k = 0; k < rects.length; k++) {
        if (k === startIndex) continue
        const path = tabs.value[k].path
        if (k > startIndex && k <= currentTarget) ns[path] = -stepWidth
        else if (k < startIndex && k >= currentTarget) ns[path] = stepWidth
        else ns[path] = 0
      }
      shifts.value = ns
    }

    function onDragEnd() {
      document.removeEventListener('mousemove', onDragMove)
      document.removeEventListener('mouseup', onDragEnd)
      if (dragMoved) {
        const path = pressPath
        const target = currentTarget
        noAnim.value = true
        draggingPath.value = null
        dragDx.value = 0
        shifts.value = {}
        if (target !== startIndex) moveTab(path, target)
        nextTick(() => {
          requestAnimationFrame(() => { noAnim.value = false })
        })
      }
      pressPath = null
      dragMoved = false
      startIndex = -1
      rects = []
      currentTarget = -1
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
      draggingPath,
      noAnim,
      contextMenu,
      setTabRef,
      switchTab,
      tabStyle,
      onTabMouseDown,
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
  background: #eef0f2;
  border-bottom: 1px solid #e2e4e8;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
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
  padding: 0 6px;
  align-items: center;
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
  padding: 0 14px;
  height: 32px;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-size: 13px;
  color: #5f6368;
  position: relative;
  background: transparent;
  transition: transform 0.22s cubic-bezier(0.25, 0.8, 0.3, 1),
    background 0.15s ease, color 0.15s ease, box-shadow 0.18s ease;
}

.tab-item::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 3px;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(90deg, #667eea, #764ba2);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.tab-item:hover {
  color: #2c2c3a;
  background: rgba(0, 0, 0, 0.05);
}

.tab-item.active {
  color: #1a1a2e;
  font-weight: 500;
  background: #fff;
  box-shadow: 0 2px 10px rgba(60, 64, 67, 0.18);
  z-index: 2;
}

.tab-item.active::before {
  opacity: 1;
}

.tab-item.dragging {
  z-index: 10;
  color: #1a1a2e;
  background: #fff;
  box-shadow: 0 8px 22px rgba(60, 64, 67, 0.28);
  cursor: grabbing;
  transition: none;
}

.tab-list.no-anim .tab-item {
  transition: none !important;
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
