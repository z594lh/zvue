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
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
