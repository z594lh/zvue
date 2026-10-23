// 当前原生对话的阅读投影：自然问答为主，工具过程折叠；旧协议只保留一条占位。
/** 按实际任务或方案关联事件，不靠文本猜测归属。 */
function groupKey(item){return item.task_id?`task:${item.task_id}`:item.plan_id?`plan:${item.plan_id}`:`message:${item.id}`}
/** 构造原生时间线，不再兼容旧资料首包、附件或request_data回答。 */
export function buildChatTimeline(items){
  const anchors=new Map(),internal=new Set(),timeline=[],seenLegacy=new Set()
  for(const item of items)if(item.event_type==='user_message' && !item.legacy)anchors.set(groupKey(item),item.id)
  for(const item of items){
    if(item.legacy)continue
    const technical=item.technical || ['data_response','validation_feedback'].includes(item.event_type) ||
      item.event_type==='model_request' && (anchors.has(groupKey(item)) || Number(item.round)>1)
    if(technical)internal.add(item.id)
    else if(!anchors.has(groupKey(item)) && item.event_type==='model_request')anchors.set(groupKey(item),item.id)
  }
  const byId=new Map()
  for(const item of items){
    if(internal.has(item.id))continue
    if(item.legacy){if(seenLegacy.has(groupKey(item)))continue;seenLegacy.add(groupKey(item))}
    const row={...item,text:item.text || '',records:[item],auxiliary:false}
    byId.set(item.id,row);timeline.push(row)
  }
  for(const item of items){
    if(!internal.has(item.id))continue
    const key=groupKey(item);let row=byId.get(anchors.get(key))
    if(!row){row={...item,role:'erp',text:'',title:'本轮分析过程',records:[],auxiliary:true};byId.set(item.id,row);anchors.set(key,item.id);timeline.push(row)}
    row.records.push(item)
  }
  for(const row of timeline){
    row.records.sort((a,b)=>String(a.id).length-String(b.id).length || String(a.id).localeCompare(String(b.id)))
    row.nativeTrace=!row.legacy && row.records.some(r=>r.engine==='native-tools-v1' && (r.event_type!=='model_response' || ['tool_calls','tool_progress'].includes(r.response_type)))
  }
  return timeline.sort((a,b)=>String(a.id).length-String(b.id).length || String(a.id).localeCompare(String(b.id)))
}
