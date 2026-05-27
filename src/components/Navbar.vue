<template>
  <nav class="navbar">
    <div class="nav-brand">
      <router-link to="/" class="brand-link">ZywTools</router-link>
    </div>

    <!-- 移动端汉堡菜单按钮 -->
    <button class="hamburger" @click="toggleMobileMenu" :class="{ active: mobileMenuOpen }" aria-label="菜单">
      <span></span>
      <span></span>
      <span></span>
    </button>

    <div class="nav-links">
      <template v-for="group in visibleNavGroups" :key="group.label">
        <!-- 只有一个子项：直接跳转 -->
        <router-link
          v-if="group.children.length === 1"
          :to="group.children[0].path"
          class="nav-link"
          :class="{ active: route.path === group.children[0].path }"
        >
          {{ group.label }}
        </router-link>

        <!-- 多个子项：下拉菜单 -->
        <div
          v-else
          class="nav-item"
          :class="{ active: isGroupActive(group) }"
          @mouseenter="openGroup = group.label"
          @mouseleave="openGroup = null"
        >
          <span class="nav-label">{{ group.label }}</span>

          <div v-show="openGroup === group.label" class="sub-menu">
            <div class="sub-menu-inner">
              <router-link
                v-for="item in group.children"
                :key="item.path"
                :to="item.path"
                class="sub-link"
                @click="openGroup = null"
              >
                {{ item.label }}
              </router-link>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 移动端菜单 -->
    <div v-show="mobileMenuOpen" class="mobile-menu">
      <template v-for="group in visibleNavGroups" :key="group.label">
        <!-- 单个子项直接显示 -->
        <router-link
          v-if="group.children.length === 1"
          :to="group.children[0].path"
          class="mobile-sub-link"
          style="padding: 14px 8px; font-size: 15px; color: #333; font-weight: 500;"
          @click="closeMobileMenu"
        >
          {{ group.label }}
        </router-link>

        <!-- 多个子项可展开 -->
        <div v-else class="mobile-menu-item">
          <div class="mobile-menu-header" @click="openGroup = openGroup === group.label ? null : group.label">
            <span>{{ group.label }}</span>
            <span class="mobile-menu-arrow" :class="{ open: openGroup === group.label }">▼</span>
          </div>
          <div v-show="openGroup === group.label" class="mobile-sub-menu">
            <router-link
              v-for="item in group.children"
              :key="item.path"
              :to="item.path"
              class="mobile-sub-link"
              @click="closeMobileMenu"
            >
              {{ item.label }}
            </router-link>
          </div>
        </div>
      </template>
    </div>

    <div class="nav-user">
      <template v-if="isLoggedIn">
        <div class="user-menu" @click="toggleMenu" ref="menuRef">
          <img v-if="userAvatar" :src="userAvatar" class="user-avatar-img" alt="avatar" />
          <div v-else class="user-avatar">
            {{ userNickname?.charAt(0)?.toUpperCase() || 'U' }}
          </div>
          <span class="username">{{ userNickname || '用户' }}</span>
          <span class="arrow" :class="{ open: showMenu }">▼</span>

          <div v-show="showMenu" class="dropdown-menu">
            <div class="menu-item" @click="goToProfile">
              <span class="icon">👤</span> 个人中心
            </div>
            <div class="menu-item" @click="handleRefreshMenus">
              <span class="icon">🔄</span> 刷新权限
            </div>
            <div class="menu-divider"></div>
            <div class="menu-item logout" @click="handleLogout">
              <span class="icon">🚪</span> 退出登录
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <router-link to="/login" class="login-btn">登录 / 注册</router-link>
      </template>
    </div>
  </nav>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { isAuthenticated, getUserProfile, getMenus, logout, setAuthToken, setUserPermissions, clearUserPermissions, getUserPermissions, setUserMenus, clearUserMenus } from '@/services/api.js'

// 本地兜底菜单（当 /api/menus 接口不可用时使用）
const fallbackNavGroups = [
  {
    label: '财务',
    children: [
      { label: '支出记账', path: '/expense' },
      { label: '计算售价', path: '/pricing' }
    ]
  },
  {
    label: '亚马逊',
    children: [
      { label: '店铺管理', path: '/shops' },
      { label: '订单列表', path: '/amazon-orders' },
      { label: 'Listing列表', path: '/amazon-listings' },
      { label: '货件列表', path: '/amazon-shipments' },
      { label: '库存列表', path: '/amazon-inventory' }
    ]
  },
  {
    label: '报表',
    children: [
      { label: '店铺报表', path: '/reports' },
      { label: '广告报表', path: '/reports/advertising' }
    ]
  },
  {
    label: '供应链',
    children: [
      { label: '备货看板', path: '/product-board' },
      { label: '供应商管理', path: '/suppliers' },
      { label: '进货单管理', path: '/purchase-orders' },
      { label: '产品维护', path: '/products' },
      { label: '类目维护', path: '/categories' }
    ]
  },
  {
    label: '货代',
    children: [
      { label: '货代管理', path: '/logistics-providers' },
      { label: '货代运单管理', path: '/logistics-waybills' }
    ]
  },
  {
    label: '工具',
    children: [
      { label: 'FBA标签', path: '/fba-label' },
      { label: '箱唛助手', path: '/label-organize' },
      { label: 'PDF工具', path: '/pdf-tools' }
    ]
  },
  {
    label: '系统',
    children: [
      { label: '计划任务', path: '/system/cron-tasks' },
      { label: '权限管理', path: '/system/permissions' }
    ]
  }
]

export default {
  name: 'NavBar',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const isLoggedIn = ref(false)
    const userNickname = ref('')
    const userAvatar = ref('')
    const showMenu = ref(false)
    const menuRef = ref(null)
    const openGroup = ref(null)
    const mobileMenuOpen = ref(false)
    const dynamicMenus = ref(null) // 从 /api/menus 获取的原始菜单

    const toggleMobileMenu = () => {
      mobileMenuOpen.value = !mobileMenuOpen.value
    }

    const closeMobileMenu = () => {
      mobileMenuOpen.value = false
    }

    // 将后端扁平菜单转成树形结构
    const buildMenuTree = (flatMenus) => {
      if (!flatMenus || !flatMenus.length) return []
      const groups = []
      const groupMap = {}

      // 第一遍：先创建所有 parent_id=0 的组
      flatMenus.forEach((item) => {
        if (item.parent_id === 0 || item.parent_id === null) {
          if (item.path) {
            // 独立页面（如首页看板），包装成单个子项的组
            groups.push({
              label: item.label,
              children: [{ label: item.label, path: item.path }]
            })
          } else {
            // 分组（如财务、亚马逊）
            groupMap[item.id] = {
              label: item.label,
              children: []
            }
            groups.push(groupMap[item.id])
          }
        }
      })

      // 第二遍：添加子项到对应分组
      flatMenus.forEach((item) => {
        if (item.parent_id !== 0 && item.parent_id !== null && groupMap[item.parent_id]) {
          groupMap[item.parent_id].children.push({
            label: item.label,
            path: item.path
          })
        }
      })

      return groups.filter((g) => g.children.length > 0)
    }

    // 动态菜单（优先使用 /api/menus，失败则回退到本地兜底）
    const visibleNavGroups = computed(() => {
      if (dynamicMenus.value) {
        return buildMenuTree(dynamicMenus.value)
      }
      const permissions = getUserPermissions()
      if (permissions.length === 0) {
        return fallbackNavGroups
      }
      return fallbackNavGroups
    })

    const isGroupActive = (group) => {
      return group.children.some((item) => item.path === route.path)
    }

    const checkLoginStatus = async () => {
      if (isAuthenticated()) {
        try {
          const res = await getUserProfile()
          if (res.data.status === 'success') {
            isLoggedIn.value = true
            userNickname.value = res.data.data.nickname || res.data.data.username
            userAvatar.value = res.data.data.avatar || ''
            setUserPermissions(res.data.data.permissions || [])
            // 登录成功后拉取菜单
            fetchMenus()
          } else {
            setAuthToken(null)
            isLoggedIn.value = false
          }
        } catch (error) {
          console.error('获取用户信息失败:', error)
          setAuthToken(null)
          isLoggedIn.value = false
        }
      } else {
        isLoggedIn.value = false
      }
    }

    const fetchMenus = async () => {
      try {
        const res = await getMenus()
        if (res.data.status === 'success') {
          dynamicMenus.value = res.data.data || []
          setUserMenus(dynamicMenus.value)
        }
      } catch (error) {
        console.error('获取菜单失败:', error)
        dynamicMenus.value = null
      }
    }

    const toggleMenu = () => {
      showMenu.value = !showMenu.value
    }

    const handleClickOutside = (event) => {
      if (menuRef.value && !menuRef.value.contains(event.target)) {
        showMenu.value = false
      }
    }

    const goToProfile = () => {
      showMenu.value = false
      router.push('/profile')
    }

    const handleLogout = async () => {
      showMenu.value = false
      try {
        await logout()
      } catch (error) {
        console.error('登出请求失败:', error)
      } finally {
        setAuthToken(null)
        clearUserPermissions()
        clearUserMenus()
        dynamicMenus.value = null
        isLoggedIn.value = false
        userNickname.value = ''
        userAvatar.value = ''
        router.push('/login')
      }
    }

    const handleLoginSuccess = () => {
      checkLoginStatus()
    }

    const handleRefreshMenus = () => {
      fetchMenus()
      // 同时重新获取用户信息（权限列表可能变了）
      getUserProfile().then((res) => {
        if (res.data.status === 'success') {
          setUserPermissions(res.data.data.permissions || [])
        }
      }).catch(() => {})
    }

    onMounted(() => {
      checkLoginStatus()
      document.addEventListener('click', handleClickOutside)
      window.addEventListener('login-success', handleLoginSuccess)
      window.addEventListener('refresh-menus', handleRefreshMenus)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
      window.removeEventListener('login-success', handleLoginSuccess)
      window.removeEventListener('refresh-menus', handleRefreshMenus)
    })

    return {
      visibleNavGroups,
      route,
      isLoggedIn,
      userNickname,
      userAvatar,
      showMenu,
      menuRef,
      openGroup,
      mobileMenuOpen,
      toggleMobileMenu,
      closeMobileMenu,
      toggleMenu,
      goToProfile,
      handleRefreshMenus,
      handleLogout,
      isGroupActive
    }
  }
}
</script>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 60px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-brand {
  font-size: 20px;
  font-weight: bold;
}

.brand-link {
  color: #667eea;
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-item {
  position: relative;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-label {
  font-size: 14px;
  color: #666;
}

.nav-item:hover,
.nav-item.active {
  background: #f5f5f5;
}

.nav-item:hover .nav-label,
.nav-item.active .nav-label {
  color: #667eea;
}

.nav-item.active .nav-label {
  font-weight: 500;
}

.nav-link {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  color: #666;
  text-decoration: none;
  transition: all 0.3s;
}

.nav-link:hover,
.nav-link.active {
  color: #667eea;
  background: #f5f5f5;
}

.nav-link.active {
  font-weight: 500;
}

/* 子菜单 */
.sub-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: transparent;
  padding-top: 4px;
  min-width: 140px;
  animation: slideDown 0.2s ease;
}

.sub-menu-inner {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 6px 0;
}

.sub-link {
  display: block;
  padding: 10px 16px;
  font-size: 14px;
  color: #333;
  text-decoration: none;
  transition: background 0.2s;
  white-space: nowrap;
}

.sub-link:hover {
  background: #f5f5f5;
  color: #667eea;
}

.sub-link.router-link-active {
  color: #667eea;
  font-weight: 500;
  background: #f0f3ff;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 用户区域 */
.nav-user {
  display: flex;
  align-items: center;
}

.login-btn {
  padding: 8px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  text-decoration: none;
  border-radius: 20px;
  font-size: 14px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 用户菜单 */
.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 24px;
  cursor: pointer;
  transition: background 0.3s;
  position: relative;
}

.user-menu:hover {
  background: #f5f5f5;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
}

.user-avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.username {
  font-size: 14px;
  color: #333;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  font-size: 10px;
  color: #999;
  transition: transform 0.3s;
}

.arrow.open {
  transform: rotate(180deg);
}

/* 下拉菜单 */
.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 160px;
  padding: 8px 0;
  animation: slideDown 0.2s ease;
}

.menu-item {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #333;
  transition: background 0.2s;
}

.menu-item:hover {
  background: #f5f5f5;
}

.menu-item.logout {
  color: #e74c3c;
}

.menu-item.logout:hover {
  background: #fdf2f2;
}

.icon {
  font-size: 16px;
}

.menu-divider {
  height: 1px;
  background: #eee;
  margin: 8px 0;
}

/* 移动端菜单 */
.mobile-menu {
  display: none;
  position: fixed;
  top: 60px;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  z-index: 99;
  overflow-y: auto;
  padding: 16px;
  animation: slideDown 0.2s ease;
}

.mobile-menu-item {
  border-bottom: 1px solid #eee;
}

.mobile-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 8px;
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

.mobile-menu-arrow {
  font-size: 12px;
  color: #999;
  transition: transform 0.3s;
}

.mobile-menu-arrow.open {
  transform: rotate(180deg);
}

.mobile-sub-menu {
  padding: 0 8px 8px;
}

.mobile-sub-link {
  display: block;
  padding: 10px 12px;
  font-size: 14px;
  color: #666;
  text-decoration: none;
  border-radius: 6px;
}

.mobile-sub-link.router-link-active,
.mobile-sub-link.router-link-exact-active {
  color: #667eea;
  background: #f0f3ff;
  font-weight: 500;
}

/* 汉堡菜单按钮 */
.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
}

.hamburger span {
  display: block;
  width: 100%;
  height: 2px;
  background: #333;
  border-radius: 2px;
  transition: all 0.3s;
}

.hamburger.active span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.hamburger.active span:nth-child(2) {
  opacity: 0;
}

.hamburger.active span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* 响应式 */
@media (max-width: 768px) {
  .navbar {
    padding: 0 16px;
  }

  .nav-links {
    display: none;
  }

  .username {
    display: none;
  }

  .hamburger {
    display: flex;
  }

  .mobile-menu {
    display: block;
  }
}
</style>
