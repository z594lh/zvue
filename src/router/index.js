import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import JsonTools from '../views/JsonToolstView.vue'
import Video from '../views/VideoLibrary.vue'

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
    path: '/v',
    name: 'Video',
    component: Video
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
