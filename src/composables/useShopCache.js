import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getShopOptions } from '@/services/api.js'

// 模块级缓存，跨组件共享
const shopList = ref([])
const loaded = ref(false)

// 监听 ShopView 的店铺变更事件，自动清缓存
if (typeof window !== 'undefined') {
  window.addEventListener('shop-changed', () => {
    loaded.value = false
  })
}

export function useShopCache() {
  const fetchShopList = async (force = false) => {
    if (loaded.value && !force) return

    try {
      const response = await getShopOptions()
      if (response.data.status === 'success') {
        const list = response.data.data || []
        shopList.value = list
        loaded.value = true
      } else {
        ElMessage.error(response.data.message || '获取店铺列表失败')
      }
    } catch (error) {
      console.error('获取店铺列表失败:', error)
      ElMessage.error('获取店铺列表失败: ' + (error.response?.data?.message || error.message))
    }
  }

  const refreshShopList = () => fetchShopList(true)

  const getShopName = (shopId) => {
    if (!shopId) return '-'
    const shop = shopList.value.find(s => s.id === shopId)
    return shop ? shop.shop_name : '-'
  }

  const defaultShopId = () => {
    if (shopList.value.length === 0) return null
    const def = shopList.value.find(s => s.is_default === 1)
    return def ? def.id : shopList.value[0].id
  }

  // 通知店铺数据已变更（供 ShopView 调用的便捷方法）
  const notifyShopChanged = () => {
    loaded.value = false
  }

  return { shopList, fetchShopList, refreshShopList, getShopName, defaultShopId, notifyShopChanged }
}
