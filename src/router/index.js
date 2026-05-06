import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import JsonTools from '../views/JsonToolstView.vue'
import AiImageView from '../views/AiImageView.vue'
import ImageGallery from '../views/ImageGallery.vue'
import LoginView from '../views/LoginView.vue'
import ExpenseView from '../views/ExpenseView.vue'
import FbaLabelView from '../views/FbaLabelView.vue'
import PdfToolsView from '../views/PdfToolsView.vue'
import AmazonShipmentView from '../views/AmazonShipmentView.vue'
import AmazonInventoryView from '../views/AmazonInventoryView.vue'
import SupplierView from '../views/SupplierView.vue'
import PurchaseOrderView from '../views/PurchaseOrderView.vue'
import ProductView from '../views/ProductView.vue'
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
