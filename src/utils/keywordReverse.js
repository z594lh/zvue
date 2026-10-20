import { spriteValue } from './sellersprite'

// 排列参照来源页面；比例统一以百分数填写，空区间不参与查询。
export const reverseMetrics = [
  ['traffic_share','流量占比','ratio'],['organic_rank','自然排名','number'],['sponsored_rank','广告排名','number'],['aba_week_rank','ABA周排名','number'],['monthly_searches','月搜索量','number'],
  ['spr','SPR','number'],['title_density','标题密度','number'],['monthly_purchases','月购买量','number'],['purchase_rate','购买率','ratio'],['impressions','展示量','number'],
  ['clicks','点击量','number'],['products','商品数','number'],['demand_supply_ratio','需供比','number'],['sponsored_asins','近7天广告竞品数','number'],['weekly_impressions','预估周曝光量','number'],
  ['organic_share','自然流量占比','ratio'],['sponsored_share','广告流量占比','ratio'],['search_growth_mom','搜索量环比','ratio'],['search_growth_yoy','搜索量同比','ratio'],['ppc','PPC竞价','money'],
  ['total_click_share','点击总占比','ratio'],['total_conversion_share','转化总占比','ratio'],['suggested_bid_min','建议竞价下限','money'],['suggested_bid_max','建议竞价上限','money'],['word_count','单词个数','number']
].map(([key,label,type])=>({key,label,type}))

const labels={'Highly searched':'高搜索量词','Organic words':'自然流量词','SP ad words':'SP广告词'}
export const reverseLabel=value=>String(value || '').split('/').map(part=>labels[part.trim()] || part.trim()).join(' / ')
export const hasValue=value=>value!==null && value!==undefined && value!==''
export const percentWidth=value=>hasValue(value) && Number.isFinite(Number(value))?Math.max(0,Math.min(100,Number(value)*100)):0

// 合并列仅改变布局，每一项仍绑定各自的原始指标，可独立排序。
const field=(key,label)=>({key,label})
export const reverseColumns = [
  {key:'flow',label:'流量占比 / 周曝光',width:88,common:true,fields:[field('traffic_share','流量占比')]},
  {key:'distribution',label:'流量类型 / 分布',width:126,common:true,fields:[]},
  {key:'organic',label:'自然排名',width:108,common:true,fields:[field('organic_rank','自然排名')]},
  {key:'sponsored',label:'广告排名',width:108,common:true,fields:[field('sponsored_rank','广告排名')]},
  {key:'monthly_searches',label:'月搜索量 / 环比',width:94,common:true,fields:[field('monthly_searches','月搜索量')]},
  {key:'aba_week_rank',label:'ABA周排名',width:84,fields:[field('aba_week_rank','ABA周排名')]},
  {key:'spr',label:'SPR',width:58,fields:[field('spr','SPR')]},
  {key:'title_density',label:'标题密度',width:68,fields:[field('title_density','标题密度')]},
  {key:'monthly_purchases',label:'购买量 / 购买率',width:82,common:true,fields:[field('monthly_purchases','购买量'),field('purchase_rate','购买率')]},
  {key:'exposure',label:'展示量 / 点击量',width:96,common:true,fields:[field('impressions','展示量'),field('clicks','点击量')]},
  {key:'supply',label:'需供比 / 商品数',width:82,common:true,fields:[field('demand_supply_ratio','需供比'),field('products','商品数')]},
  {key:'sponsored_asins',label:'广告竞品数',width:90,common:true,fields:[field('sponsored_asins','广告竞品数')]},
  {key:'concentration',label:'ABA集中度',width:90,common:true,fields:[field('total_click_share','点击份额'),field('total_conversion_share','转化份额')]},
  {key:'bid',label:'PPC竞价',width:84,common:true,fields:[field('ppc','PPC竞价')]},
  {key:'search_growth_yoy',label:'搜索量同比',width:86,fields:[field('search_growth_yoy','搜索量同比')]},
  {key:'trend',label:'搜索量趋势（未导入）',width:100,fields:[]},
  {key:'asins',label:'前十ASIN',width:86,fields:[]},
  {key:'word_count',label:'单词个数',width:80,fields:[field('word_count','单词个数')]}
]
export const defaultColumnPrefs=()=>({version:1,order:reverseColumns.map(c=>c.key),visible:reverseColumns.filter(c=>c.common).map(c=>c.key)})
export function normalizeColumnPrefs(value) {
  if(!value || value.version!==1 || !Array.isArray(value.order) || !Array.isArray(value.visible))return defaultColumnPrefs()
  const known=new Set(reverseColumns.map(c=>c.key))
  const order=[...new Set(value.order.filter(key=>known.has(key)))]
  return {version:1,order:[...order,...reverseColumns.map(c=>c.key).filter(key=>!order.includes(key))],visible:[...new Set(value.visible.filter(key=>known.has(key)))]}
}
export function rankPageText(value) {
  if(!hasValue(value))return ''
  const raw=String(value).trim()
  const match=raw.match(/^(?:Page\s*(\d+)|第\s*(\d+)\s*页)\s*[,，]\s*(\d+)\s*\/\s*(\d+)$/i)
  return match?`第${match[1] || match[2]}页，${match[3]} / ${match[4]}`:raw
}
export function reverseCsv(rows, columns) {
  const quote=value=>'"'+String(value).replace(/"/g,'""')+'"'
  const cell=(row,column)=>{
    const value=spriteValue(column,row[column.key])
    // 来源文字可能以公式字符开头，导出仅作为文本，不能执行Excel公式。
    return column.type==='text' && /^[\s]*[=+@-]/.test(value)?"'"+value:value
  }
  return '\ufeff'+[columns.map(c=>quote(c.label)).join(','),...rows.map(row=>columns.map(c=>quote(cell(row,c))).join(','))].join('\r\n')
}
