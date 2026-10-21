// 历史页只解释保存的证据，不以今天的时钟改写过去的观察进度。
export const metricLabels={impressions:'广告曝光',clicks:'点击',cost:'广告花费',ctr:'CTR',cpc:'CPC',purchases_7d:'归因购买',sales_7d:'归因销售',acos:'ACOS',sales_qty:'SKU销量',sales_amount:'销售额',net_profit:'净利润',ad_cost:'广告费',tacos:'TACOS',organic_rank:'自然排名',sponsored_rank:'广告排名',traffic_share:'关键词流量占比',organic_share:'自然占比',sponsored_share:'广告占比',weekly_impressions:'预估周曝光',refund_amount:'退款',ad_sales:'广告销售',ad_orders:'广告订单'}
const rates=new Set(['acos','ctr','tacos','traffic_share','organic_share','sponsored_share','profit_margin'])
const money=new Set(['cost','cpc','sales_7d','sales_amount','net_profit','ad_cost','refund_amount','ad_sales'])
/** 返回现有资料指标的中文名称。 */
export function metricName(key){return key==='profit_margin'?'净利润率':metricLabels[key] || key}
/** 按指标单位显示数值，缺值不补0。 */
export function metricValue(key,value){
  if(value==null || value==='' || !Number.isFinite(Number(value)))return '暂无数据'
  const n=Number(value)
  if(rates.has(key))return `${(n*100).toFixed(2)}%`
  if(money.has(key))return `USD ${n.toFixed(2)}`
  return n.toLocaleString('zh-CN',{maximumFractionDigits:2})
}
/** 将保存的UTC时间解析成日期对象，拒绝无效日期。 */
function utc(value){
  if(!value)return null
  const iso=String(value).replace(' ','T')
  const parsed=new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(iso)?iso:`${iso}Z`)
  return Number.isNaN(parsed.getTime())?null:parsed
}
/** 按指定业务偏移量计算日期，不依赖浏览器本地时区。 */
function shiftedDay(value,hours){
  const d=utc(value)
  return d?new Date(d.getTime()+hours*3600000).toISOString().slice(0,10):null
}
/** 在纯业务日期上增加天数，避免跨夏令时偏移。 */
function addDay(day,n){return new Date(Date.parse(`${day}T00:00:00Z`)+n*86400000).toISOString().slice(0,10)}
/** 合并会话原有观察和本次已确认执行，不再恢复旧版缺时间或缺周期的记录。 */
export function buildObservations(detail){
  if(!detail)return []
  const observations=(detail.context?.observations || []).map(o=>({...o,
    changed_on:shiftedDay(o.changed_at,8),newly_confirmed:false,
    current_assessment:detail.plan?.result?.history_reviews?.find(r=>String(r.execution_id)===String(o.execution_id))?.conclusion || detail.plan?.result?.actions?.find(a=>a.ref===o.ref && (a.mode==='observe' || a.kind==='observe'))?.reason}))
  const ids=new Set(observations.map(o=>String(o.execution_id)))
  for(const record of detail.executions || []){
    if(record.status!=='confirmed' || !record.verified_at || ids.has(String(record.id)))continue
    const action=record.action,days=Number(action.observation.duration_days),confirmed=shiftedDay(record.verified_at,8)
    if(!action || !days || !confirmed)continue
    const elapsed=Math.min(days,Math.max(0,Math.round((Date.parse(detail.run.run_date)-Date.parse(confirmed))/86400000)))
    const start=addDay(shiftedDay(record.verified_at,-7),1)
    observations.push({execution_id:record.id,plan_id:record.plan_id,label:action.label,kind:action.kind,
      before:action.before,after:action.after,unit:action.unit,reason:action.reason,
      changed_on:shiftedDay(record.created_at,8),
      duration_days:days,elapsed_days:elapsed,remaining_days:days-elapsed,started_on:start,due_on:addDay(start,days-1),
      phase:elapsed<days?'observing':'waiting_data',newly_confirmed:true,report_date:detail.run.report_date,
      observation_plan:action.observation,baseline_snapshot:record.baseline,post_evidence:{},
      progress_note:'本次刚确认修改，尚无改后完整报告；观察计划将带入下一次每日分析。'})
  }
  return observations.sort((a,b)=>(b.changed_on || '').localeCompare(a.changed_on || '') || Number(b.execution_id)-Number(a.execution_id))
}
/** 提取同指标的改前基线和实际改后区间小计，不混用滚动窗口。 */
export function observationMetrics(observation){
  const baseline=observation.baseline_snapshot?.windows?.[String(observation.duration_days)] || []
  const keys=observation.observation_plan?.metrics || []
  // 排名及流量占比按完整关键词呈现，不把多个关键词平均成一个虚假排名。
  return keys.filter(k=>!['organic_rank','sponsored_rank','traffic_share','organic_share','sponsored_share','weekly_impressions'].includes(k)).map(key=>({
    key,before:baseline.find(m=>m.metric===key)?.before,after:['net_profit','sales_qty','sales_amount','ad_cost','tacos','refund_amount','ad_sales','ad_orders','profit_margin'].includes(key)?(observation.post_evidence?.business_metrics?.[key] ?? observation.post_evidence?.metrics?.[key]):observation.post_evidence?.metrics?.[key]
  }))
}
/** 只比较完整关键词及真正更新的文件版本，不把同版或旧版充当改后效果。 */
export function observationKeywords(observation){
  if(!(observation.observation_plan?.metrics || []).some(k=>['organic_rank','sponsored_rank','traffic_share','organic_share','sponsored_share','weekly_impressions'].includes(k)))return []
  const before=observation.baseline_snapshot?.keywords || [],post=observation.post_evidence || {}
  const snapshot=post.snapshot || {},original=observation.baseline_snapshot?.keyword_snapshot || {}
  // 同一文件或早于观察起点的版本不能冒充改后结果。
  const fresh=!!snapshot.record_date && String(snapshot.record_date).slice(0,10)>=observation.started_on && (!original.id || String(snapshot.id)!==String(original.id))
  return (observation.observation_plan?.keywords || []).map(keyword=>({keyword,
    before:before.find(w=>w.keyword===keyword),after:fresh?(post.items || []).find(w=>w.keyword===keyword):null
  }))
}
