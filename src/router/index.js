import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import JsonTools from '../views/JsonToolstView.vue'
import AiImageView from '../views/AiImageView.vue'
import ImageGallery from '../views/ImageGallery.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView
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
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
