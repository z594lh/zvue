// 日报正文用于填写预览与保存后分享；图片仅导出已保存快照，不请求AI或外链图片。
const number = (value, places = 2) => value === null || value === undefined ? '—' : Number(value).toLocaleString('zh-CN', { minimumFractionDigits: places, maximumFractionDigits: places })
const pct = value => value === null || value === undefined ? '—' : `${(Number(value) * 100).toFixed(2)}%`

/** 兼容服务端ISO Z及旧无时区UTC字符串，统一显示北京时间，不能重复追加Z。 */
export function dailyReportTime(value) {
  if (!value) return '—'
  const raw = String(value).replace(' ', 'T')
  const date = new Date(/[Zz]$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai', hour12: false})
}

/** 按明确数值方向描述对比；缺来源不造涨跌，负利润不拿负分母算增长率。 */
export function dailyChange(change, quantity = false) {
  if (!change || change.direction === 'none') return '暂无有效对比'
  if (change.direction === 'flat') return '持平'
  const verb = change.direction === 'up' ? '增加' : '减少'
  if (change.point_change !== null && change.point_change !== undefined) return `${verb}${number(Math.abs(Number(change.point_change)))}个百分点`
  const rate = change.rate !== null && change.rate !== undefined ? `（${pct(Math.abs(Number(change.rate)))}）` : ''
  return `${verb}${number(Math.abs(Number(change.delta)), quantity ? 0 : 2)}${rate}`
}

/** 仅解释已保存快照；缺值/非法值不转成0，不查询新数据补齐历史。 */
function metricValue(period, key) {
  const raw = period?.values?.[key]
  return raw === null || raw === undefined || raw === '' || !Number.isFinite(Number(raw)) ? null : Number(raw)
}

/** 中文盈亏状态；部分周期只说小计，不能把部分已记录利润当成整期盈亏。 */
function profitState(period, cash) {
  const value = metricValue(period, 'sku_report_profit')
  if (value === null) return '利润暂无来源'
  if (!period.complete) return `利润小计 ${cash(value)}`
  return value > 0 ? `盈利 ${cash(value)}` : value < 0 ? `亏损 ${cash(-value)}` : '收支持平'
}

/** 计算展示用差额，不改原金额；比例用百分点，负利润和零基线不制造增长率。 */
function metricTrend(current, previous, key, cash, compact = false) {
  if (!current?.complete || !previous?.complete) return '数据不足，暂不比较'
  const now = metricValue(current, key), old = metricValue(previous, key)
  if (now === null || old === null) return '前后期无有效对比'
  const ratio = ['acos', 'tacos'].includes(key)
  // 以展示精度判断持平，避免浮点误差出现“↑0.00个百分点”或“-0.00”。
  const delta = Number(((now - old) * (ratio ? 100 : 1)).toFixed(key === 'sales_qty' ? 0 : 2))
  if (!delta) return '持平'
  const arrow = delta > 0 ? '↑' : '↓'
  if (ratio) return `${arrow}${number(Math.abs(delta))} 个百分点`
  const relative = old > 0 ? Math.abs((now - old) / old) : null
  const rate = relative !== null ? `${arrow}${relative > 0 && Number((relative * 100).toFixed(2)) === 0 ? '<0.01%' : pct(relative)}` : ''
  // 总览紧邻数值：正常基线用百分比，转盈/转亏及负利润只显示绝对差额。
  if (compact) {
    if (rate && !(key === 'sku_report_profit' && (now < 0 || old < 0))) return rate
    if (old === 0 && now > 0) return `${arrow}新增`
    return `${arrow}${number(Math.abs(delta), key === 'sales_qty' ? 0 : 2)}`
  }
  if (key === 'sku_report_profit') {
    if (old < 0 && now >= 0) return `${arrow}${now > 0 ? '扭亏为盈' : '亏损消除'}，改善 ${cash(delta)}`
    if (old >= 0 && now < 0) return `${arrow}${old > 0 ? '由盈转亏' : '开始亏损'}，减少 ${cash(-delta)}`
    if (now < 0 && old < 0) return `${arrow}亏损${delta > 0 ? '收窄' : '扩大'} ${cash(Math.abs(delta))}`
    return `${delta > 0 ? '增加' : '减少'} ${cash(Math.abs(delta))}${rate ? `，${rate}` : ''}`
  }
  if (rate) return rate
  if (old === 0 && now > 0) return `${arrow}前期为0，新增`
  return `${arrow}${delta > 0 ? '增加' : '减少'} ${key === 'sales_qty' ? `${number(Math.abs(delta), 0)} 件` : cash(Math.abs(delta))}`
}

/** 把自动生成的涨跌拆为安全文本片段；不输出HTML，红绿仅代表数值方向。 */
export function dailyReportParts(value) {
  const text = String(value), parts = [], pattern = /[↑↓](?:<?\d[\d,]*(?:\.\d+)?(?:%| 个百分点)?)?/g
  let offset = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset) parts.push({text: text.slice(offset, match.index), direction: ''})
    parts.push({text: match[0], direction: match[0][0] === '↑' ? 'up' : 'down'})
    offset = match.index + match[0].length
  }
  if (offset < text.length) parts.push({text: text.slice(offset), direction: ''})
  return parts.length ? parts : [{text, direction: ''}]
}

/** 同一个周期用销量、盈亏、广告投入说明经营变化；有缺口时显式保留覆盖天数。 */
function periodSituation(current, previous, cash) {
  if (!current || !current.recorded_days) return '暂无来源，不能判断销量、盈亏或涨跌。'
  const sales = metricValue(current, 'sales_qty'), cost = metricValue(current, 'ad_cost')
  const comparable = current.complete && previous?.complete
  const compare = key => comparable ? `（${metricTrend(current, previous, key, cash)}）` : ''
  const coverage = !current.complete ? `仅记录 ${current.recorded_days}/${current.expected_days || 7} 天，以下为小计，暂不比较；` : !previous?.complete ? '前期来源不足，暂不比较；' : ''
  return `${coverage}销量 ${number(sales, 0)} 件${compare('sales_qty')}；${profitState(current, cash)}${compare('sku_report_profit')}；广告费 ${cash(cost)}${compare('ad_cost')}。`
}

/** 广告效率不设统一好坏阈值；无分母不当0，花费但未归因销售时明确提醒等待核实。 */
function advertisingSituation(current, previous, cash) {
  return ['acos', 'tacos'].map(key => {
    const value = metricValue(current, key), label = key.toUpperCase()
    if (!current?.complete) return `${label} 数据不足`
    if (value === null) {
      const denominator = metricValue(current, key === 'acos' ? 'ad_sales' : 'sales_amount')
      const hasSpend = metricValue(current, 'ad_cost') > 0
      return `${label} 暂无法计算${hasSpend && denominator === 0 ? `（有花费但无${key === 'acos' ? '广告归因销售' : '销售额'}）` : ''}`
    }
    return `${label} ${pct(value)}（${metricTrend(current, previous, key, cash)}）`
  }).join('，')
}

/** 每SKU生成短结论＋日/周变化＋广告效率，三个分享出口共用，不调用AI、不重复扣退款。 */
export function dailySkuSummary(row, currency = 'USD') {
  const cash = value => value === null || value === undefined ? '—' : `${currency === 'USD' ? '$' : `${currency} `}${number(value)}`
  const {day, prior_day: priorDay, week, prior_week: priorWeek} = row
  const dayProfit = metricValue(day, 'sku_report_profit'), weekProfit = metricValue(week, 'sku_report_profit')
  const state = (period, value, label) => !period?.complete || value === null ? `${label}来源不足` : `${label}${value > 0 ? '盈利' : value < 0 ? '亏损' : '收支持平'}`
  let conclusion = `${state(day, dayProfit, '当日')}，${state(week, weekProfit, '近7天')}。`
  if (week?.complete && priorWeek?.complete) {
    const oldProfit = metricValue(priorWeek, 'sku_report_profit'), sales = metricValue(week, 'sales_qty'), oldSales = metricValue(priorWeek, 'sales_qty')
    if (weekProfit !== null && oldProfit !== null) {
      const change = Number((weekProfit - oldProfit).toFixed(2))
      if (change < 0 && sales !== null && oldSales !== null && sales > oldSales) conclusion += '周度销量增长，但利润反而走弱。'
      else if (weekProfit < 0 && oldProfit < 0 && change !== 0) conclusion += `周度亏损${change > 0 ? '有所收窄' : '进一步扩大'}。`
      else if (oldProfit < 0 && weekProfit >= 0) conclusion += weekProfit > 0 ? '周度已扭亏为盈。' : '周度亏损已消除。'
      else if (oldProfit >= 0 && weekProfit < 0) conclusion += '周度转入亏损，优先核查利润下降原因。'
      else if (change !== 0) conclusion += `周度利润${change > 0 ? '改善' : '下降'}。`
    }
    const tacos = metricValue(week, 'tacos'), oldTacos = metricValue(priorWeek, 'tacos'), cost = metricValue(week, 'ad_cost'), oldCost = metricValue(priorWeek, 'ad_cost')
    if (tacos !== null && oldTacos !== null && cost !== null && oldCost !== null && cost >= 0 && oldCost >= 0) {
      const points = Number(((tacos - oldTacos) * 100).toFixed(2))
      if (points) conclusion += `周度广告费占销售额的比重${points > 0 ? '上升' : '回落'}。`
    }
  }
  const kind = week?.complete && weekProfit !== null ? weekProfit < 0 ? 'summary-loss' : weekProfit > 0 ? 'summary-profit' : 'summary-neutral' : 'summary-neutral'
  return [
    {kind, text: conclusion},
    {kind: 'body', highlightChanges: true, text: `较昨日：${periodSituation(day, priorDay, cash)}`},
    {kind: 'body', highlightChanges: true, text: `近7天较前7天：${periodSituation(week, priorWeek, cash)}`},
    {kind: 'comparison', highlightChanges: true, text: `广告效率｜当日：${advertisingSituation(day, priorDay, cash)}；近7天：${advertisingSituation(week, priorWeek, cash)}。`}
  ]
}

/** 填写页、预览、文字和长图的四指标总览共用当前值及紧邻的昨日变化。 */
export function dailyOverviewMetrics(snapshot) {
  const sum = snapshot.summaries.day, v = sum.values
  const cash = value => value === null || value === undefined ? '—' : number(value)
  return [{key: 'sales_qty', label: '销量', quantity: true}, {key: 'sales_amount', label: '销售额'}, {key: 'ad_cost', label: '广告费'}, {key: 'sku_report_profit', label: '利润'}].map(metric => {
    const value = `${number(v[metric.key], metric.quantity ? 0 : 2)}${metric.quantity ? ' 件' : ''}`
    const change = metricTrend(sum, snapshot.summaries.prior_day, metric.key, cash, true)
    return {...metric, value, change, text: `${metric.label} ${value}（${change}）`}
  })
}

/** 分享正文与图片共用同一内容结构，涵盖全部重点、人工文字及来源限制。 */
export function dailyReportBlocks(report) {
  const snapshot = report.snapshot, sum = snapshot.summaries.day
  const bySku = new Map(snapshot.rows.map(row => [row.seller_sku, row]))
  const rows = report.selected_skus.map(sku => bySku.get(sku)).filter(Boolean)
  const metrics = dailyOverviewMetrics(snapshot)
  const blocks = [
    { kind: 'meta', text: `${snapshot.shop_name} · ${snapshot.currency} · 数据截至 ${snapshot.report_date || '暂无来源'}` },
    { kind: 'meta', text: report.is_preview ? '未保存预览 · 本次填写尚未保存或提交' : `${report.status === 'submitted' ? '已提交' : '草稿'} · 版本 ${report.version} · 最近保存 ${dailyReportTime(report.updated_at)}（北京时间）` },
    { kind: 'heading', text: '一、SKU 经营概况' },
    { kind: 'body', text: `整理时负责 ${sum.sku_count} 个SKU；本次重点 ${rows.length} 个，其余 ${sum.sku_count - rows.length} 个未展开。` },
    { kind: 'metric', highlightChanges: true, items: metrics, text: metrics.map(item => item.text).join('    ') }
  ]
  if (sum.incomplete_count) blocks.push({ kind: 'warning', text: `有 ${sum.incomplete_count} 个SKU当日缺来源；金额仅为已记录小计，不代表完整经营情况。` })
  if (!snapshot.report_date || snapshot.stale_days > 1) blocks.push({ kind: 'warning', text: `注意：经营来源${snapshot.report_date ? `比工作日期早${snapshot.stale_days}天` : '尚无可用数据'}，不是今日实时销售。` })
  const sample = snapshot.rows[0]
  if (rows.length && sample?.day?.date_to) blocks.push({kind: 'note', text: `日对比：${sample.day.date_to} 对比 ${sample.prior_day?.date_to || '暂无来源'}；近7天：${sample.week?.date_from || '—'}～${sample.week?.date_to || '—'}；前7天：${sample.prior_week?.date_from || '—'}～${sample.prior_week?.date_to || '—'}。下方“昨日”指报表截止日的前一自然日。↑↓仅表示数值变化；ACOS/TACOS按周期汇总金额计算，比率变化用百分点。`})
  for (const row of rows) {
    blocks.push({ kind: 'sku', text: `${row.product_name || '未维护中文名'}｜${row.seller_sku}` },
      ...dailySkuSummary(row, snapshot.currency))
  }
  if (!rows.length) blocks.push({ kind: 'body', text: '本次未选择重点SKU，以上为全部当前负责SKU的整体概况。' })
  if (report.situation_text) blocks.push({ kind: 'sku', text: '运营补充判断' }, { kind: 'body', text: report.situation_text })
  blocks.push({ kind: 'heading', text: '二、今日调整与优化' }, { kind: 'body', text: report.actions_text || '尚未填写' },
    { kind: 'heading', text: '三、问题与协助' }, { kind: report.no_issues ? 'body' : 'warning', text: report.no_issues ? '暂无需要协助的问题。' : report.issues_text || '尚未填写' },
    { kind: 'note', text: '经营数据为当前负责SKU历史，非个人绩效；利润沿用SKU日报，缺数据不当零。广告归因可能回补，规则提醒不等于调整指令。' })
  return blocks
}

/** 可复制的微信群文字版，不截断人工长文字，不把草稿冒充已提交。 */
export function dailyReportText(report) {
  return [`${report.snapshot.owner_name} · 运营日报 · ${report.work_date}`, ...dailyReportBlocks(report).map(b => b.text)].join('\n\n')
}

/** 中文/长SKU按实际Canvas宽度逐字符换行，保留显式换行，避免溢出截图边界。 */
function wrap(context, value, width) {
  const lines = []
  for (const paragraph of String(value).replace(/\r\n?/g, '\n').split('\n')) {
    let line = ''
    // 保留英文指标/数字/SKU为整体，避免把TACOS或百分比从中间断开。
    const tokens = paragraph.match(/[↑↓]<?\d[\d,]*(?:\.\d+)?(?:%| 个百分点)?|[A-Za-z0-9][A-Za-z0-9._%:/+-]*|[^\r\n]/gu) || []
    for (const token of tokens) {
      const parts = context.measureText(token).width > width ? Array.from(token) : [token]
      for (const part of parts) {
        if (line && context.measureText(line + part).width > width) {
          if (/^[，。；：、！？）】]$/.test(part) && context.measureText(line + part).width <= width + 20) { lines.push(line + part); line = ''; continue }
          lines.push(line); line = ''
        }
        line += part
      }
    }
    lines.push(line)
  }
  return lines
}

/** 导出一张完整PNG长图，保持原字号；先测高度，超出安全范围则报错，不裁剪或拆页。 */
export async function dailyReportImage(report) {
  if (!report?.id || !report?.snapshot || report.is_preview) throw new Error('请先保存日报再下载图片')
  await document.fonts?.ready
  const styles = {
    meta: [24, '#64748b', 34], heading: [34, '#1e3a5f', 56], body: [28, '#334155', 42],
    metric: [30, '#2563eb', 46], warning: [27, '#b45309', 40], sku: [29, '#0f766e', 46], note: [24, '#64748b', 36],
    'summary-loss': [28, '#b45309', 42], 'summary-profit': [28, '#047857', 42], 'summary-neutral': [28, '#475569', 42], comparison: [26, '#64748b', 40]
  }
  const measureCanvas = document.createElement('canvas'), measure = measureCanvas.getContext('2d')
  if (!measure) throw new Error('当前浏览器无法生成日报图片，请使用复制文字')
  const layout = []; let content = 0
  for (const block of dailyReportBlocks(report)) {
    const [size, color, height] = styles[block.kind]
    const weight = ['heading', 'sku', 'metric'].includes(block.kind) || block.kind.startsWith('summary-') ? '600 ' : ''
    measure.font = `${weight}${size}px "Microsoft YaHei", sans-serif`
    const lines = wrap(measure, block.text, 920)
    const gap = block.kind === 'heading' ? 22 : 12
    layout.push({ gap }); content += gap
    for (const line of lines) {
      layout.push({ line, parts: block.highlightChanges ? dailyReportParts(line) : null, size, color, height, weight }); content += height
    }
  }
  measureCanvas.width = 1; measureCanvas.height = 1
  const imageHeight = Math.max(650, content + 255)
  // 1080×14000约1512万像素，防止极端长文耗尽移动端内存；不通过缩字隐藏内容。
  if (imageHeight > 14000) throw new Error('日报内容过长，暂无法导出为一张清晰长图；请精简文字或使用复制文字')
  const exported = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
  const canvas = document.createElement('canvas')
  try {
    canvas.width = 1080; canvas.height = imageHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前浏览器无法生成日报长图，请使用复制文字')
    ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, 1080, canvas.height)
    ctx.fillStyle = '#fff'; ctx.fillRect(36, 32, 1008, canvas.height - 64)
    ctx.fillStyle = '#3b82f6'; ctx.fillRect(36, 32, 1008, 8)
    ctx.fillStyle = '#0f172a'; ctx.font = '600 36px "Microsoft YaHei", sans-serif'
    let title = `${report.snapshot.owner_name} · 运营日报`
    while (ctx.measureText(title).width > 920) title = title.slice(0, -2) + '…'
    ctx.fillText(title, 80, 102)
    ctx.fillStyle = '#64748b'; ctx.font = '26px "Microsoft YaHei", sans-serif'
    ctx.fillText(`工作日期 ${report.work_date}`, 80, 145)
    let y = 175
    for (const line of layout) {
      if (line.gap) { y += line.gap; continue }
      ctx.font = `${line.weight}${line.size}px "Microsoft YaHei", sans-serif`; ctx.fillStyle = line.color
      if (line.parts) {
        // 与页面共用片段，逐段着色，不把人工文字中的箭头自动染色。
        let x = 80
        for (const part of line.parts) {
          ctx.fillStyle = part.direction === 'up' ? '#16a34a' : part.direction === 'down' ? '#dc2626' : line.color
          ctx.fillText(part.text, x, y + line.height * .76); x += ctx.measureText(part.text).width
        }
      } else ctx.fillText(line.line, 80, y + line.height * .76)
      y += line.height
    }
    ctx.fillStyle = '#94a3b8'; ctx.font = '21px "Microsoft YaHei", sans-serif'
    ctx.fillText(`系统已保存版本 · 日报 #${report.id} · 导出 ${exported}`, 80, canvas.height - 58)
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('浏览器无法生成这份长图，请精简文字或使用复制文字')), 'image/png'))
  } finally {
    // 编码完成或失败后均释放像素内存，重复下载不保留上一张大画布。
    canvas.width = 1; canvas.height = 1
  }
}
