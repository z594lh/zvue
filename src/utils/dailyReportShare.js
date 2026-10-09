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

/** 分享正文与图片共用同一内容结构，涵盖全部重点、人工文字及来源限制。 */
export function dailyReportBlocks(report) {
  const snapshot = report.snapshot, sum = snapshot.summaries.day, v = sum.values
  const bySku = new Map(snapshot.rows.map(row => [row.seller_sku, row]))
  const rows = report.selected_skus.map(sku => bySku.get(sku)).filter(Boolean)
  const blocks = [
    { kind: 'meta', text: `${snapshot.shop_name} · ${snapshot.currency} · 数据截至 ${snapshot.report_date || '暂无来源'}` },
    { kind: 'meta', text: report.is_preview ? '未保存预览 · 本次填写尚未保存或提交' : `${report.status === 'submitted' ? '已提交' : '草稿'} · 版本 ${report.version} · 最近保存 ${dailyReportTime(report.updated_at)}（北京时间）` },
    { kind: 'heading', text: '一、SKU 经营概况' },
    { kind: 'body', text: `整理时负责 ${sum.sku_count} 个SKU；本次重点 ${rows.length} 个，其余 ${sum.sku_count - rows.length} 个未展开。` },
    { kind: 'metric', text: `销量 ${number(v.sales_qty, 0)} 件    销售额 ${number(v.sales_amount)}    广告费 ${number(v.ad_cost)}    SKU报表利润 ${number(v.sku_report_profit)}` },
    { kind: 'body', text: `较上一数据日：销量${dailyChange(snapshot.changes.sales_qty, true)}；利润${dailyChange(snapshot.changes.sku_report_profit)}。` }
  ]
  if (sum.incomplete_count) blocks.push({ kind: 'warning', text: `有 ${sum.incomplete_count} 个SKU当日缺来源；金额仅为已记录小计，不代表完整经营情况。` })
  if (!snapshot.report_date || snapshot.stale_days > 1) blocks.push({ kind: 'warning', text: `注意：经营来源${snapshot.report_date ? `比工作日期早${snapshot.stale_days}天` : '尚无可用数据'}，不是今日实时销售。` })
  for (const row of rows) {
    const day = row.day.values, week = row.week.values
    blocks.push({ kind: 'sku', text: `${row.product_name || '未维护中文名'}｜${row.seller_sku}` },
      { kind: 'body', text: `当日：销量 ${number(day.sales_qty, 0)}，销售额 ${number(day.sales_amount)}，广告费 ${number(day.ad_cost)}，利润 ${number(day.sku_report_profit)}，ACOS ${pct(day.acos)}，TACOS ${pct(day.tacos)}。` },
      { kind: 'body', text: `近7天：销量 ${number(week.sales_qty, 0)}，利润 ${number(week.sku_report_profit)}；记录 ${row.week.recorded_days}/7 天。` },
      { kind: 'body', text: `提醒：${row.recommendation.tags.join('；')}。` })
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
    const tokens = paragraph.match(/[A-Za-z0-9][A-Za-z0-9._%:/+-]*|[^\r\n]/gu) || []
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
    metric: [30, '#2563eb', 46], warning: [27, '#b45309', 40], sku: [29, '#0f766e', 46], note: [24, '#64748b', 36]
  }
  const measureCanvas = document.createElement('canvas'), measure = measureCanvas.getContext('2d')
  if (!measure) throw new Error('当前浏览器无法生成日报图片，请使用复制文字')
  const layout = []; let content = 0
  for (const block of dailyReportBlocks(report)) {
    const [size, color, height] = styles[block.kind]
    measure.font = `${['heading', 'sku', 'metric'].includes(block.kind) ? '600 ' : ''}${size}px "Microsoft YaHei", sans-serif`
    const lines = wrap(measure, block.text, 920)
    const gap = block.kind === 'heading' ? 22 : 12
    layout.push({ gap }); content += gap
    for (const line of lines) {
      layout.push({ line, size, color, height, weight: ['heading', 'sku', 'metric'].includes(block.kind) ? '600 ' : '' }); content += height
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
      ctx.fillText(line.line, 80, y + line.height * .76); y += line.height
    }
    ctx.fillStyle = '#94a3b8'; ctx.font = '21px "Microsoft YaHei", sans-serif'
    ctx.fillText(`系统已保存版本 · 日报 #${report.id} · 导出 ${exported}`, 80, canvas.height - 58)
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('浏览器无法生成这份长图，请精简文字或使用复制文字')), 'image/png'))
  } finally {
    // 编码完成或失败后均释放像素内存，重复下载不保留上一张大画布。
    canvas.width = 1; canvas.height = 1
  }
}
