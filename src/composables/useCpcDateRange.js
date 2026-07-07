import { ref, watch } from 'vue'

const CPC_DATE_KEY = 'cpc_date_range'

const getLast30Days = () => {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  const fmt = (d) => d.toISOString().split('T')[0]
  return { startDate: fmt(start), endDate: fmt(end) }
}

const loadDateRange = () => {
  const saved = sessionStorage.getItem(CPC_DATE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.startDate && parsed.endDate) {
        return { startDate: parsed.startDate, endDate: parsed.endDate }
      }
    } catch { /* noop */ }
  }
  return getLast30Days()
}

const startDate = ref('')
const endDate = ref('')
let initialized = false

const initDateRange = () => {
  if (initialized) return
  initialized = true
  const { startDate: s, endDate: e } = loadDateRange()
  startDate.value = s
  endDate.value = e
}

export function useCpcDateRange() {
  initDateRange()

  const setStartDate = (val) => {
    if (val && endDate.value && val > endDate.value) {
      endDate.value = val
    }
    startDate.value = val
    sessionStorage.setItem(CPC_DATE_KEY, JSON.stringify({ startDate: startDate.value, endDate: endDate.value }))
  }

  const setEndDate = (val) => {
    if (val && startDate.value && val < startDate.value) {
      startDate.value = val
    }
    endDate.value = val
    sessionStorage.setItem(CPC_DATE_KEY, JSON.stringify({ startDate: startDate.value, endDate: endDate.value }))
  }

  // 保持 sessionStorage 与 ref 同步
  watch([startDate, endDate], ([s, e]) => {
    sessionStorage.setItem(CPC_DATE_KEY, JSON.stringify({ startDate: s, endDate: e }))
  })

  return {
    startDate,
    endDate,
    setStartDate,
    setEndDate
  }
}
