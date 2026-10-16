import { reactive, readonly } from 'vue'
import { DEFAULT_UI_CONFIG } from '@/config/branding.js'

const state = reactive({ ...DEFAULT_UI_CONFIG })
export const uiConfig = readonly(state)
const limits = { brand_name: 64, login_welcome: 120, footer_text: 300 }
let generation = 0
let pending = null

// 只接受白名单纯文本；忽略公开响应之外的字段，不允许模板/HTML执行。
export function applyUiConfig(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return false
  const clean = {}
  for (const key of Object.keys(DEFAULT_UI_CONFIG)) {
    if (typeof values[key] !== 'string') return false
    const text = values[key].trim()
    const hasControl = [...text].some(char => (char.codePointAt(0) < 32 || char.codePointAt(0) === 127) &&
      !(key === 'footer_text' && char === '\n'))
    if ([...text].length > limits[key] || /[<>]/.test(text) || hasControl) return false
    clean[key] = text || DEFAULT_UI_CONFIG[key]
  }
  generation++
  Object.assign(state, clean)
  return true
}

export function loadUiConfig() {
  if (pending) return pending
  const startedAt = generation
  pending = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    try {
      // 与登录API隔离，不发送Token/Cookie，不等待此请求才挂载应用。
      const response = await fetch('/api/public/ui-config', {
        method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal
      })
      if (!response.ok) return false
      const payload = await response.json()
      return payload.status === 'success' && startedAt === generation ? applyUiConfig(payload.data) : false
    } catch {
      return false // 使用默认/本次页面已有配置，不影响登录，不自动重试。
    } finally {
      clearTimeout(timer)
    }
  })()
  return pending
}
