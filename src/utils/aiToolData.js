/** 只读业务视图：仅整理同一次工具返回，绝不补查、合计或回写原始资料。 */
import { dictionaryEntry,dictionaryLabel } from '@/utils/businessDictionary'

/** 原文始终以纯文本保留，业务字段不解释为HTML。 */
export function pretty(value){return JSON.stringify(value,null,2)}

/** 所有字段名称复用全站业务字典；未知字段明确标出，不猜中文含义。 */
export function fieldLabel(key){return fieldEntry(key)?.label || `未配置中文名（${key}）`}

/** 参数与数据共用词义时直接引用同一词条，避免在展示功能中重复定义。 */
export function fieldEntry(key){return dictionaryEntry('data.field',key) || dictionaryEntry('listing.field',key) || dictionaryEntry('data.window',key) || dictionaryEntry('ai.parameter',key)}

/** 参数/工具名也使用同一字典，不能用函数名充当业务模块标题。 */
export function toolLabel(name){return dictionaryLabel('ai.tool',name,'未配置中文名的工具')}

/** 矩阵按返回的列展开；缺值保持未知，不补零。 */
export function matrixRows(value){return Array.isArray(value?.columns) && Array.isArray(value?.rows)?value.rows.map(row=>Array.isArray(row)?Object.fromEntries(value.columns.map((key,i)=>[key,row[i]])):row):[]}

/** 仅读取当前行和当前回包的币种，不借用所选店铺或其他模块币种。 */
export function rowCurrency(row,fallback=''){return row?.currency || row?.dimensions?.currency || fallback || ''}

/** 枚举翻译仅作用于已知字段，不替换买家搜索词、标题或任意人类文本。 */
export function enumText(key,value){
  const groups={window:['data.window'],tool:['ai.tool'],kind:['operation.kind','ads.change','ads.report'],operation_type:['operation.kind'],scope:['data.scope'],unit:['data.unit'],region:['amazon.region'],field:['listing.field'],state:['ads.state'],match_type:['ads.match'],keyword_match_type:['ads.match'],placement:['ads.placement'],campaign_type:['ads.targeting'],status:['data.status'],phase:['data.status'],coverage:['data.status'],keyword_text:['ads.auto_target'],targeting_expression:['ads.auto_target'],entity_type:['ads.entity'],change_type:['ads.change']}[key] || []
  return groups.map(group=>dictionaryEntry(group,String(value))?.label).find(Boolean) || value
}

/** 仅按共享字典的单位语义格式化；0保留，null未知，整数广告位单位不乘100。 */
export function formatValue(key,value,currency='',unit=''){
  if(value==null || value==='')return '未提供'
  if(typeof value==='boolean')return value?'是':'否'
  if(Array.isArray(value))return value.length?value.map(v=>typeof v==='object'?pretty(v):String(v)).join('\n'):'已返回空列表'
  if(typeof value==='object')return pretty(value)
  if(key==='metrics')return fieldLabel(String(value))
  const format=dictionaryEntry('data.field',key)?.format
  if(format==='ratio' && Number.isFinite(Number(value)))return `${Number((Number(value)*100).toFixed(4))}%`
  if(unit==='percent' && Number.isFinite(Number(value)))return `${value}%`
  if(format==='money')return `${value}${currency?' '+currency:'（币种未提供）'}`
  return String(enumText(key,value))
}

/** 口径说明是程序返回的文字，仅将已登记的技术代码替换为中文阅读名；原文不改。 */
export function readableNote(value){return typeof value==='string'?value.replace(/\b[a-z][a-z0-9_]*\b/g,code=>fieldEntry(code)?.label || dictionaryEntry('ai.tool',code)?.label || code):value}

/** 只列回包确实拥有的统计窗口，不把固定选项冒充已提供数据。 */
export function actualWindows(rows){return [...new Set(rows.flatMap(row=>matrixRows(row.periods).map(p=>p.window)).filter(Boolean))]}

/** 某行缺选定窗口时返回空对象，绝不使用其他窗口替代。 */
export function periodAt(row,window){return matrixRows(row.periods).find(p=>p.window===window) || {}}

/** 依据固定业务类型组织导航，元数据数组不再递归膨胀为业务表。 */
export function businessModules(tool,result){
  const titles={get_asin_overview:'商品与库存',read_business:'经营与利润',read_advertising:'广告表现',read_listing:'Listing文案',read_pricing:'售价与成本',simulate_price:'售价测算',read_keywords:'关键词流量',read_keyword_history:'关键词历史',read_observations:'往期改动与观察',read_current_settings:'当前可调整设置',read_operations:'操作日志',read_plan_history:'方案历史',read_chat_history:'历史问答'}
  if(!result || typeof result!=='object')return []
  if(result.error || ['error','failed','too_large','unavailable','disabled'].includes(result.status))return [{key:'unavailable',title:titles[tool] || toolLabel(tool),tool,data:result,path:'result'}]
  if(tool==='get_operation_overview'){
    const modules=[{key:'product',title:'商品与库存',tool:'get_asin_overview',data:{identity:result.identity,time:result.time,inventory:result.inventory,gaps:result.gaps},path:'identity / time / inventory'},
      {key:'ads',title:'广告表现',tool:'read_advertising',data:Array.isArray(result.advertising)?{rows:result.advertising,note:result.advertising_note}:result.advertising || {status:'unavailable',message:result.advertising_note || '本次未提供广告汇总'},path:'advertising'}]
    for(const [i,s] of (result.sections || []).entries())modules.push({key:'section'+i,title:titles[s.tool] || toolLabel(s.tool),tool:s.tool,data:s.result,path:`sections[${i}].result`,query:s.query,meta:s})
    const order=['get_asin_overview','read_business','read_advertising','read_listing','read_pricing','read_keywords','read_observations']
    return modules.sort((a,b)=>order.indexOf(a.tool)-order.indexOf(b.tool))
  }
  if(tool==='read_data_bundle')return (result.queries || []).map((q,i)=>({key:'query'+i,title:titles[q.tool] || toolLabel(q.tool),tool:q.tool,data:q.result,path:`queries[${i}].result`,query:q.query}))
  return [{key:tool,title:titles[tool] || toolLabel(tool),tool,data:result,path:'result'}]
}

/** 状态只陈述当前回包，不把空列表当作业务不存在或数据完整。 */
export function moduleState(data){
  if(!data)return '本次未提供'
  if(data.error || ['error','failed','too_large','unavailable','disabled'].includes(data.status))return dictionaryLabel('data.status',data.status,'查询失败 / 不可用')
  if(Array.isArray(data.rows) && !data.rows.length)return '已返回空列表'
  return '有返回'
}

/** 表格只暴露已返回记录；广告维度和所选窗口是同条记录的投影。 */
export function tableRow(row,window){return {...row,kind:reportKind(row),...(row.dimensions || {}),...(window?periodAt(row,window):{})}}

/** 广告类型只使用回包明示的kind或证据编号前缀；未知类型不自行分类。 */
export function reportKind(row){return row.kind || (typeof row.evidence_id==='string'?row.evidence_id.split(':')[0]:'')}
