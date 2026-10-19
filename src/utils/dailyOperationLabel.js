// 同一份经营快照中文名优先；旧日报只读原快照，不查询当前产品覆盖已保存内容。
export function dailyOperationLabel(operation, skuRows = []) {
  if (operation.kind !== 'listing') return operation.display?.object_label || operation.object_label
  const legacy = /^SKU (.+?)(（来自 .+）)?$/u.exec(operation.object_label || '')
  const sku = operation.sku || legacy?.[1]
  if (!sku) return operation.object_label
  const name = skuRows.find(row => row.seller_sku === sku)?.product_name || operation.product_name || '未维护中文名'
  const source = operation.source_sku ? `（来自 ${operation.source_sku}）` : legacy?.[2] || ''
  return `${name}｜${sku}${source}`
}
