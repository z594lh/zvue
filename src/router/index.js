import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import JsonTools from '../views/JsonToolstView.vue'
import AiImageView from '../views/AiImageView.vue'
import ImageGallery from '../views/ImageGallery.vue'
import LoginView from '../views/LoginView.vue'
import ExpenseView from '../views/ExpenseView.vue'
import PricingView from '../views/PricingView.vue'
import FbaLabelView from '../views/FbaLabelView.vue'
import LabelOrganizeView from '../views/LabelOrganizeView.vue'
import InvoiceExportView from '../views/InvoiceExportView.vue'
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
import CompanyView from '../views/CompanyView.vue'
import { isAuthenticated, getUserPermissions, findPermissionCodeByPath } from '@/services/api.js'

const CronTasksView = () => import('../views/CronTasksView.vue')

const routes = [
  {
    path: '/',
    name: 'Home',
    component: CompanyView,
    meta: { title: '公司主页', componentName: 'CompanyView' }
  },
  {
    path: '/fanyi',
    name: 'Fanyi',
    component: HomeView,
    meta: { title: '翻译', componentName: 'app' }
  },
  {
    path: '/company',
    name: 'Company',
    component: CompanyView,
    meta: { title: '公司主页', componentName: 'CompanyView' }
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { title: '登录', componentName: 'LoginView' }
  },
  {
    path: '/json',
    name: 'JsonTools',
    component: JsonTools,
    meta: { title: 'JSON工具', componentName: 'app' }
  },
  {
    path: '/ai-image',
    name: 'AiImage',
    component: AiImageView,
    meta: { title: 'AI图片', componentName: 'AiImageView' }
  },
  {
    path: '/gallery',
    name: 'ImageGallery',
    component: ImageGallery,
    meta: { title: '图片库', componentName: 'ImageGalleryView' }
  },
  {
    path: '/expense',
    name: 'Expense',
    component: ExpenseView,
    meta: { title: '支出记账', componentName: 'ExpenseView' }
  },
  {
    path: '/pricing',
    name: 'Pricing',
    component: PricingView,
    meta: { title: '计算售价', componentName: 'PricingView' }
  },
  {
    path: '/fba-label',
    name: 'FbaLabel',
    component: FbaLabelView,
    meta: { title: 'FBA标签', componentName: 'FbaLabelView' }
  },
  {
    path: '/label-organize',
    name: 'LabelOrganize',
    component: LabelOrganizeView,
    meta: { title: '箱唛助手', componentName: 'LabelOrganizeView' }
  },
  {
    path: '/invoice-export',
    name: 'InvoiceExport',
    component: InvoiceExportView,
    meta: { title: '发票导出', componentName: 'InvoiceExportView' }
  },
  {
    path: '/pdf-tools',
    name: 'PdfTools',
    component: PdfToolsView,
    meta: { title: 'PDF工具', componentName: 'PdfToolsView' }
  },
  {
    path: '/amazon-shipments',
    name: 'AmazonShipments',
    component: AmazonShipmentView,
    meta: { title: '货件列表', componentName: 'AmazonShipmentView' }
  },
  {
    path: '/amazon-inventory',
    name: 'AmazonInventory',
    component: AmazonInventoryView,
    meta: { title: '库存列表', componentName: 'AmazonInventoryView' }
  },
  {
    path: '/amazon-orders',
    name: 'AmazonOrders',
    component: AmazonOrderView,
    meta: { title: '订单列表', componentName: 'AmazonOrderView' }
  },
  {
    path: '/amazon-listings',
    name: 'AmazonListings',
    component: AmazonListingView,
    meta: { title: 'Listing列表', componentName: 'AmazonListingView' }
  },
  {
    path: '/suppliers',
    name: 'Suppliers',
    component: SupplierView,
    meta: { title: '供应商管理', componentName: 'SupplierView' }
  },
  {
    path: '/purchase-orders',
    name: 'PurchaseOrders',
    component: PurchaseOrderView,
    meta: { title: '进货单管理', componentName: 'PurchaseOrderView' }
  },
  {
    path: '/products',
    name: 'Products',
    component: ProductView,
    meta: { title: '产品维护', componentName: 'ProductView' }
  },
  {
    path: '/categories',
    name: 'Categories',
    component: CategoryView,
    meta: { title: '类目维护', componentName: 'CategoryView' }
  },
  {
    path: '/logistics-providers',
    name: 'LogisticsProviders',
    component: LogisticsProviderView,
    meta: { title: '货代管理', componentName: 'LogisticsProviderView' }
  },
  {
    path: '/logistics-waybills',
    name: 'LogisticsWaybills',
    component: LogisticsWaybillView,
    meta: { title: '货代运单管理', componentName: 'LogisticsWaybillView' }
  },
  {
    path: '/shops',
    name: 'Shops',
    component: ShopView,
    meta: { title: '店铺管理', componentName: 'ShopView' }
  },
  {
    path: '/product-board',
    name: 'ProductBoard',
    component: ProductBoardView,
    meta: { title: '备货看板', componentName: 'ProductBoardView' }
  },
  {
    path: '/reports',
    name: 'Reports',
    component: ReportView,
    meta: { title: '店铺报表', componentName: 'ReportView' }
  },
  {
    path: '/reports/advertising',
    name: 'AdvertisingReports',
    component: AdvertisingReportView,
    meta: { title: '广告报表', componentName: 'AdvertisingReportView' }
  },
  {
    path: '/system/cron-tasks',
    name: 'CronTasks',
    component: CronTasksView,
    meta: { title: '计划任务', componentName: 'CronTasksView' }
  },
  {
    path: '/system/permissions',
    name: 'SystemPermissions',
    component: SystemPermissionsView,
    meta: { title: '权限管理', componentName: 'SystemPermissionsView' }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: ProfileView,
    meta: { title: '个人中心', componentName: 'ProfileView' }
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: ForbiddenView,
    meta: { title: '无权限', componentName: 'ForbiddenView' }
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// 全局前置守卫
const publicPaths = ['/', '/json', '/login', '/403', '/company', '/fanyi']

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
