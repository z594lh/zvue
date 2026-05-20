import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import JsonTools from '../views/JsonToolstView.vue'
import AiImageView from '../views/AiImageView.vue'
import ImageGallery from '../views/ImageGallery.vue'
import LoginView from '../views/LoginView.vue'
import ExpenseView from '../views/ExpenseView.vue'
import PricingView from '../views/PricingView.vue'
import FbaLabelView from '../views/FbaLabelView.vue'
import PdfToolsView from '../views/PdfToolsView.vue'
import AmazonShipmentView from '../views/AmazonShipmentView.vue'
import AmazonInventoryView from '../views/AmazonInventoryView.vue'
import AmazonOrderView from '../views/AmazonOrderView.vue'
import AmazonListingView from '../views/AmazonListingView.vue'
import SupplierView from '../views/SupplierView.vue'
import PurchaseOrderView from '../views/PurchaseOrderView.vue'
import ProductView from '../views/ProductView.vue'
import CategoryView from '../views/CategoryView.vue'
import LogisticsProviderView from '../views/LogisticsProviderView.vue'
import LogisticsWaybillView from '../views/LogisticsWaybillView.vue'
import ShopView from '../views/ShopView.vue'
import ProductBoardView from '../views/ProductBoardView.vue'
import ReportView from '../views/ReportView.vue'
import AdvertisingReportView from '../views/AdvertisingReportView.vue'
import ProfileView from '../views/ProfileView.vue'
import ForbiddenView from '../views/ForbiddenView.vue'
import SystemPermissionsView from '../views/SystemPermissionsView.vue'
import { isAuthenticated, getUserPermissions, findPermissionCodeByPath } from '@/services/api.js'

const CronTasksView = () => import('../views/CronTasksView.vue')

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView
  },
  {
    path: '/json',
    name: 'JsonTools',
    component: JsonTools
  },
  {
    path: '/ai-image',
    name: 'AiImage',
    component: AiImageView
  },
  {
    path: '/gallery',
    name: 'ImageGallery',
    component: ImageGallery
  },
  {
    path: '/expense',
    name: 'Expense',
    component: ExpenseView
  },
  {
    path: '/pricing',
    name: 'Pricing',
    component: PricingView
  },
  {
    path: '/fba-label',
    name: 'FbaLabel',
    component: FbaLabelView
  },
  {
    path: '/pdf-tools',
    name: 'PdfTools',
    component: PdfToolsView
  },
  {
    path: '/amazon-shipments',
    name: 'AmazonShipments',
    component: AmazonShipmentView
  },
  {
    path: '/amazon-inventory',
    name: 'AmazonInventory',
    component: AmazonInventoryView
  },
  {
    path: '/amazon-orders',
    name: 'AmazonOrders',
    component: AmazonOrderView
  },
  {
    path: '/amazon-listings',
    name: 'AmazonListings',
    component: AmazonListingView
  },
  {
    path: '/suppliers',
    name: 'Suppliers',
    component: SupplierView
  },
  {
    path: '/purchase-orders',
    name: 'PurchaseOrders',
    component: PurchaseOrderView
  },
  {
    path: '/products',
    name: 'Products',
    component: ProductView
  },
  {
    path: '/categories',
    name: 'Categories',
    component: CategoryView
  },
  {
    path: '/logistics-providers',
    name: 'LogisticsProviders',
    component: LogisticsProviderView
  },
  {
    path: '/logistics-waybills',
    name: 'LogisticsWaybills',
    component: LogisticsWaybillView
  },
  {
    path: '/shops',
    name: 'Shops',
    component: ShopView
  },
  {
    path: '/product-board',
    name: 'ProductBoard',
    component: ProductBoardView
  },
  {
    path: '/reports',
    name: 'Reports',
    component: ReportView
  },
  {
    path: '/reports/advertising',
    name: 'AdvertisingReports',
    component: AdvertisingReportView
  },
  {
    path: '/system/cron-tasks',
    name: 'CronTasks',
    component: CronTasksView
  },
  {
    path: '/system/permissions',
    name: 'SystemPermissions',
    component: SystemPermissionsView
  },
  {
    path: '/profile',
    name: 'Profile',
    component: ProfileView
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: ForbiddenView
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// 全局前置守卫
const publicPaths = ['/', '/json', '/login', '/403']

router.beforeEach((to, from, next) => {
  // 1. 未登录检查
  if (!publicPaths.includes(to.path) && !isAuthenticated()) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // 2. 权限检查（从 /api/menus 缓存中动态查找 permission_code）
  if (isAuthenticated()) {
    const needed = findPermissionCodeByPath(to.path)
    if (needed) {
      const permissions = getUserPermissions()
      if (permissions.length > 0 && !permissions.includes(needed)) {
        next('/403')
        return
      }
    }
  }

  next()
})

export default router
