// 批量操作保持其他页选择；超过限额整次不变，由调用方明确提示。
export function pageSelection(selected, page, key = value => value) {
  const keys = new Set(selected.map(key)), count = page.filter(item => keys.has(key(item))).length
  return {all: page.length > 0 && count === page.length, partial: count > 0 && count < page.length}
}

export function selectPage(selected, page, checked, limit, key = value => value) {
  const visible = new Set(page.map(key))
  if (!checked) return selected.filter(item => !visible.has(key(item)))
  const merged = new Map(selected.map(item => [key(item), item]))
  for (const item of page) if (!merged.has(key(item))) merged.set(key(item), item)
  if (merged.size > limit) throw new Error(`最多选择${limit}条；请先取消部分已选记录`)
  return [...merged.values()]
}
