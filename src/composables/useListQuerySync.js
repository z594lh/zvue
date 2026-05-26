import { useRoute, useRouter } from 'vue-router'

/**
 * 将列表页的分页/筛选状态与 URL query 双向同步
 *
 * @param {Object} fieldMap 字段映射，每个字段包含 get/set/type/default
 *   - get: () => currentValue
 *   - set: (val) => 赋值
 *   - type: 'string' | 'number' | 'boolean'（默认 string）
 *   - default: 默认值，等于默认值时不写入 URL
 *
 * @example
 * const { initFromQuery, syncQuery } = useListQuerySync({
 *   page:       { get: () => page.value,       set: v => page.value = v,       type: 'number', default: 1 },
 *   page_size:  { get: () => pageSize.value,   set: v => pageSize.value = v,   type: 'number', default: 20 },
 *   month:      { get: () => month.value,      set: v => month.value = v },
 *   category:   { get: () => category.value,   set: v => category.value = v },
 *   keyword:    { get: () => searchForm.keyword, set: v => searchForm.keyword = v }
 * })
 */
export function useListQuerySync(fieldMap) {
  const route = useRoute()
  const router = useRouter()

  const initFromQuery = () => {
    const q = route.query
    Object.entries(fieldMap).forEach(([key, field]) => {
      const raw = q[key]
      if (raw === undefined || raw === null || raw === '') return

      let val = raw
      if (field.type === 'number') val = Number(raw)
      if (field.type === 'boolean') val = raw === 'true'

      field.set(val)
    })
  }

  const syncQuery = () => {
    const query = {}
    Object.entries(fieldMap).forEach(([key, field]) => {
      const val = field.get()
      const defaultVal = field.default

      if (val === undefined || val === null || val === '' || val === false) return
      if (defaultVal !== undefined && val === defaultVal) return

      query[key] = String(val)
    })

    const currentQuery = { ...route.query }
    const changed =
      Object.keys(query).length !== Object.keys(currentQuery).length ||
      Object.keys(query).some(k => query[k] !== currentQuery[k])

    if (changed) {
      router.replace({ query: Object.keys(query).length ? query : undefined })
    }
  }

  return { initFromQuery, syncQuery }
}
