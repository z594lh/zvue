// 缺失金额保留空值，图表与逐日合计也不能将未知金额当成零。
export const chartValue = (value, axis) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number * (axis === 'percent' ? 100 : 1) : null
}

export const aggregatePerformanceDays = (rows, currency, profitKey, first, last) => {
  const days = new Map()
  rows.filter(row => row.currency === currency).forEach(row => {
    if (!days.has(row.business_date)) days.set(row.business_date, { business_date: row.business_date, sales_amount: 0, profit: 0 })
    const day = days.get(row.business_date)
    for (const [target, source] of [['sales_amount', 'sales_amount'], ['profit', profitKey]]) {
      const value = chartValue(row[source])
      day[target] = day[target] === null || value === null ? null : day[target] + value
    }
  })
  if (!first || !last) return [...days.values()].sort((a, b) => a.business_date.localeCompare(b.business_date))
  // 完整展示筛选区间，未归属/无日报日为断点，不把两段经营数据跨空白直接连线。
  const result = [], day = new Date(`${first}T00:00:00Z`), end = new Date(`${last}T00:00:00Z`)
  while (day <= end && result.length < 93) {
    const businessDate = day.toISOString().slice(0, 10)
    result.push(days.get(businessDate) || { business_date: businessDate, sales_amount: null, profit: null })
    day.setUTCDate(day.getUTCDate() + 1)
  }
  return result
}

export const ownerPerformanceDays = (rows, owner, currency, profitKey, first, last) => {
  const byDay = new Map(rows.filter(row => (row.owner_user_id ?? null) === (owner ?? null) && row.currency === currency)
    .map(row => [row.business_date, row]))
  const days = [], day = new Date(`${first}T00:00:00Z`), end = new Date(`${last}T00:00:00Z`)
  // 与后端相同最多93天；无记录的日期不是零业绩。
  while (day <= end && days.length < 93) {
    const businessDate = day.toISOString().slice(0, 10), source = byDay.get(businessDate)
    days.push({ business_date: businessDate, sales_qty: source?.sales_qty ?? null,
      sales_amount: source?.sales_amount ?? null, ad_cost: source?.ad_cost ?? null, profit: source?.[profitKey] ?? null })
    day.setUTCDate(day.getUTCDate() + 1)
  }
  return days
}

export const performanceChartOption = (rows, metrics, currency) => {
  const ordered = [...rows].sort((a, b) => a.business_date.localeCompare(b.business_date))
  const axes = [...new Set(metrics.map(metric => metric.axis))]
  const unit = axis => ({ amount: currency, quantity: '件', percent: '%' }[axis] || '')
  return {
    animation: false,
    color: metrics.map(metric => metric.color),
    legend: { top: 8, left: 'center', textStyle: { color: '#64748b' } },
    tooltip: {
      trigger: 'axis', renderMode: 'richText', confine: true,
      valueFormatter: value => value === null || value === undefined ? '无数据' : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
    },
    grid: { left: 65, right: axes.length > 2 ? 130 : 70, top: 70, bottom: ordered.length > 14 ? 85 : 40, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: ordered.map(row => row.business_date), axisLabel: { formatter: value => value.slice(5), color: '#8693a5' } },
    yAxis: axes.map((axis, index) => ({
      type: 'value', name: unit(axis), position: index === 0 ? 'left' : 'right', offset: index > 1 ? 65 : 0,
      minInterval: axis === 'quantity' ? 1 : undefined,
      axisLabel: { color: '#8693a5', formatter: axis === 'percent' ? '{value}%' : '{value}' },
      splitLine: { show: index === 0, lineStyle: { color: '#edf1f7' } }
    })),
    dataZoom: ordered.length > 14 ? [{ type: 'slider', bottom: 8, height: 22, start: 0, end: 100 }] : [],
    series: metrics.map(metric => ({
      name: `${metric.label} (${unit(metric.axis)})`, type: 'line', yAxisIndex: axes.indexOf(metric.axis),
      data: ordered.map(row => chartValue(row[metric.key], metric.axis)), connectNulls: false,
      showSymbol: ordered.length <= 31, symbolSize: 5, lineStyle: { width: 2 },
      emphasis: { focus: 'series' }
    }))
  }
}
