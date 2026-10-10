/** 人员/SKU/每日绩效的展示参考，不改源数值，也不是广告盈亏线或考核标准。 */
export const performanceColorGuide = [
  '颜色仅辅助阅读，不代表考核达标或广告盈亏平衡；不同产品毛利和经营阶段需分别判断。',
  '利润：亏损红；持平或正利润率≤5%黄；正利润率>5%绿。无有效销售额时只提示盈亏。',
  'ACOS：≤25%绿，>25%且≤40%黄，>40%红。',
  'TACOS：≤15%绿，>15%且≤25%黄，>25%红。',
  '广告费：沿用TACOS的颜色，不按绝对花费金额判断高低。',
  '广告占比（广告销售额÷销售额）：≤50%绿，>50%且≤75%黄，>75%红；提示广告依赖，不等于广告订单占比。',
  '销量：有日报的每SKU日均销量=0红，>0且<1件黄，≥1件绿；人员按实际SKU·日数计算，不比较负责总量。',
  '缺数据灰色，不当零；有广告花费但无相应销售额，无法计算的比率标红提醒。单日样本小，广告数据可能延迟补充，结合趋势判断。'
].join('\n')

// 接口金额可为字符串；空串、布尔值及非有限数不是有效业务数字。
const finite = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) ? Number(value) : null
const ratioRules = {
  acos: { label: 'ACOS', low: 0.25, high: 0.4, denominator: 'ad_sales', source: '广告销售额' },
  tacos: { label: 'TACOS', low: 0.15, high: 0.25, denominator: 'sales_amount', source: '销售额' },
  ad_share: { label: '广告销售占比', low: 0.5, high: 0.75 }
}
const attrs = (tone, title) => ({ class: `performance-metric performance-metric--${tone}`, title })

/** 汇总人员实际计入的SKU·日数；按人员和币种隔离，不用当前负责数×日期跨度估算。 */
export const performanceSkuDays = trend => {
  const counts = new Map()
  for (const row of trend || []) {
    const count = finite(row.selling_listing_count)
    if (row.owner_user_id == null || count === null || count <= 0) continue
    const key = JSON.stringify([row.owner_user_id, row.currency])
    counts.set(key, (counts.get(key) || 0) + count)
  }
  return counts
}

/** 只返回着色class及悬停说明；skuDays为销量实际来源覆盖，缺覆盖不套绝对总量门槛。 */
export const performanceMetricAttrs = (metric, row, skuDays = null) => {
  if ((row.source_state && row.source_state !== 'available') || row.data_day_count === 0) return attrs('neutral', '缺少已归属的日报数据，不按零值判断。')
  const value = finite(row[metric])
  const rule = ratioRules[metric]
  if (rule) {
    if (value === null) {
      // 仅在相应分母明确为零时提醒，不把缺来源或空值解释成广告无效。
      if (rule.denominator && finite(row.ad_cost) > 0 && finite(row[rule.denominator]) === 0) return attrs('danger', `有广告花费，但${rule.source}为0；${rule.label}不可计算，需关注销售及后续数据补充。`)
      return attrs('neutral', `${rule.label}无有效比率，不按0%判断。`)
    }
    if (value < 0) return attrs('neutral', `${rule.label}为负值，可能有数据调整，请核对来源。`)
    const tone = value <= rule.low ? 'success' : value <= rule.high ? 'warning' : 'danger'
    return attrs(tone, `${rule.label}参考区间：≤${rule.low * 100}%绿，>${rule.low * 100}%且≤${rule.high * 100}%黄，>${rule.high * 100}%红。${metric === 'ad_share' ? '表示广告销售依赖程度，非订单占比。' : '并非该SKU的广告盈亏平衡线。'}`)
  }
  if (value === null) return attrs('neutral', '暂无有效数据，不当作零。')
  if (metric === 'profit_margin') {
    return attrs(value < 0 ? 'danger' : value <= 0.05 ? 'warning' : 'success', '利润率参考：亏损红，持平或正利润率≤5%黄，>5%绿；并非广告盈亏平衡线。')
  }
  if (metric === 'ad_cost') {
    if (value < 0) return attrs('neutral', '广告费为负，可能为费用调整，请核对来源。')
    const reference = performanceMetricAttrs('tacos', row)
    return { ...reference, title: `广告费不按绝对金额判断，沿用TACOS颜色。${reference.title}` }
  }
  if (metric === 'profit' || metric === 'sku_report_profit') {
    // 与页面两位小数金额一致，避免显示0.00却因浮点余量判定盈利/亏损。
    if (Math.abs(value) < 0.005) return attrs('warning', '利润显示为0，当前收支持平，需关注。')
    if (value < 0) return attrs('danger', '当前利润为负，需重点关注亏损原因。')
    const sales = finite(row.sales_amount)
    if (sales !== null && sales > 0) {
      const margin = value / sales
      return attrs(margin <= 0.05 ? 'warning' : 'success', `利润率 ${(margin * 100).toFixed(2)}%；正利润率≤5%提示薄利，>5%为绿色。仅辅助阅读。`)
    }
    return attrs('success', '当前利润为正；无有效销售额，无法判断利润率。')
  }
  if (metric === 'sales_qty') {
    if (value < 0) return attrs('neutral', '销量为负值，请核对来源，不按正常销量判断。')
    const days = finite(skuDays)
    if (days === null || days <= 0) return attrs('neutral', '缺少实际SKU·日覆盖，暂不判断销售活跃度。')
    const average = value / days
    return attrs(value === 0 ? 'danger' : average < 1 ? 'warning' : 'success', `每SKU日均销量 ${average.toFixed(2)} 件（${value}件 ÷ ${days}个SKU·日）；0红，>0且<1黄，≥1绿。仅表示销售活跃度，不是考核目标。`)
  }
  return attrs('neutral', '该指标不设置统一金额门槛，请结合利润和广告效率判断。')
}
