import { ref } from 'vue'

/** 两类操作指引共用：只有明确勾选并关闭时才记忆，不将误点视为永久已读。 */
export function useOperationGuide(feature, userId) {
  const pending = ref(false), dontRemind = ref(false)
  const remembered = new Set()
  const storageKey = () => userId() ? `${feature}:${userId()}` : ''

  /** 每次进入功能重置本次状态，旧账号标记不影响当前登录人。 */
  function begin() {
    dontRemind.value = false
    const key = storageKey()
    pending.value = false
    if (!key || remembered.has(key)) return
    try { pending.value = window.localStorage.getItem(key) !== 'seen' }
    catch { pending.value = true }
  }

  /** 未勾选只关闭本次；存储受限时保留本页记忆，不阻断正常业务操作。 */
  function dismiss() {
    pending.value = false
    const key = storageKey()
    if (!dontRemind.value || !key) return
    remembered.add(key)
    try { window.localStorage.setItem(key, 'seen') }
    catch { /* 浏览器拒绝持久化时使用页面内存降级。 */ }
  }

  return { pending, dontRemind, begin, dismiss }
}
