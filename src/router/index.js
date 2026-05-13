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
import { isAuthenticated } from '@/services/api.js'

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
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// 全局前置守卫：未登录用户访问需要登录的页面时重定向到登录页
const publicPaths = ['/', '/json', '/login']

router.beforeEach((to, from, next) => {
  if (!publicPaths.includes(to.path) && !isAuthenticated()) {
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

export default router
