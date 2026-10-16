import { inject, onBeforeUnmount, provide, ref } from 'vue'

const REFRESH_KEY = Symbol('cpc-entity-refresh')
// 跨 CPC 路由共享进行中状态，避免换页后重复提交同一次同步。
export const cpcEntitySyncBusy = ref(false)

export function provideCpcEntityRefresh() {
  const callbacks = new Set()
  provide(REFRESH_KEY, callbacks)
  return async () => {
    const results = await Promise.allSettled([...callbacks].map(callback => Promise.resolve().then(callback)))
    return results.every(result => result.status === 'fulfilled' && result.value !== false)
  }
}

export function useCpcEntityRefresh(callback) {
  const callbacks = inject(REFRESH_KEY, null)
  if (!callbacks) return
  callbacks.add(callback)
  onBeforeUnmount(() => callbacks.delete(callback))
}
