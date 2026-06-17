import { onActivated } from 'vue'
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
 * const { initFromQuery, syncQuery, watchQuery } = useListQuerySync({
 *   page:       { get: () => page.value,       set: v => page.value = v,       type: 'number', default: 1 },
 *   page_size:  { get: () => pageSize.value,   set: v => pageSize.value = v,   type: 'number', default: 20 },
 *   sku:        { get: () => searchForm.sku,    set: v => searchForm.sku = v }
 * })
 * watchQuery(() => fetchData())  // 外部跳转进入页面时自动重新加载
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

  /**
   * 注册 keep-alive 激活回调：仅当 URL query 参数与上次激活时不同，才恢复表单并重新请求。
   * 同类参数切换页签不会触发刷新，保持 keep-alive 的静态缓存效果。
   */
  const watchQuery = (onChange) => {
    let lastQueryStr = JSON.stringify(route.query)
    onActivated(() => {
      const currentStr = JSON.stringify(route.query)
      if (currentStr !== lastQueryStr) {
        lastQueryStr = currentStr
        initFromQuery()
        onChange()
      }
    })
  }

  return { initFromQuery, syncQuery, watchQuery }
}
