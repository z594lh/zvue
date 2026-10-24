// 自然问题与最终回复分开阅读；工具及执行原文归到对应回复，不改变持久化消息。
/** 大整数消息ID按十进制字符串排序，不能转Number丢失精度。 */
function compareId(a,b){return String(a.id).length-String(b.id).length || String(a.id).localeCompare(String(b.id))}
/** 方案编号可来自事件自身或所属任务，人工方案生成后的旧事件没有回填plan_id。 */
function planId(item){return item.plan_id ?? item.task?.plan_id}
/** 仅使用真实关联建立分组；执行任务归原方案，多个分析任务有歧义时不跨任务合并。 */
function groupKey(item,owners){
  const plan=planId(item),owner=plan!=null?owners.get(String(plan)):null
  if(item.task_id!=null && item.task?.task_type!=='execute')return `task:${item.task_id}`
  return owner || (plan!=null?`plan:${plan}`:`message:${item.id}`)
}
/** 中间回复/查询/校验/执行事件只作审计；人工原话和每日首轮自然问题保留独立气泡。 */
function technical(item,hasUser){
  return item.technical || ['data_response','validation_feedback','execution_feedback','execution_recovery','confirmation_feedback'].includes(item.event_type) ||
    item.event_type==='model_response' && ['tool_calls','tool_progress'].includes(item.response_type) ||
    item.event_type==='model_request' && (hasUser || Number(item.round)>1)
}
/** 构造阅读时间线：过程只归AI回复；后续执行事实通过真实方案关联，不能另造空过程气泡。 */
export function buildChatTimeline(items){
  const sorted=[...items].sort(compareId),owners=new Map(),groups=new Map(),timeline=[],seenLegacy=new Set()
  for(const item of sorted){
    const plan=planId(item)
    if(item.legacy || plan==null || item.task_id==null || !['model_request','model_response'].includes(item.event_type))continue
    const key=String(plan),task=`task:${item.task_id}`
    owners.set(key,owners.has(key) && owners.get(key)!==task?null:task)
  }
  for(const item of sorted){
    const key=groupKey(item,owners)
    if(item.legacy){if(!seenLegacy.has(key)){seenLegacy.add(key);timeline.push({...item,text:item.text || '',records:[item],auxiliary:false,nativeTrace:false})}continue}
    if(!groups.has(key))groups.set(key,[])
    groups.get(key).push(item)
  }
  for(const records of groups.values()){
    const hasUser=records.some(r=>r.event_type==='user_message'),internal=[],answers=[],questions=[]
    for(const item of records){
      if(technical(item,hasUser)){internal.push(item);continue}
      const row={...item,text:item.text || '',records:[item],auxiliary:false}
      timeline.push(row)
      if(item.role==='assistant' && item.event_type==='model_response')answers.push(row)
      else questions.push(row)
    }
    let owner=answers.at(-1)
    if(!owner && internal.length){
      const first=internal[0],hasModel=internal.some(r=>['model_request','model_response','data_response'].includes(r.event_type))
      const running=records.some(r=>r.task && ['queued','running'].includes(r.task.status))
      owner={...first,role:hasModel?'assistant':'erp',title:hasModel?'DeepSeek · 过程记录':'ERP · 关联执行记录',text:'',records:[],auxiliary:false,processOnly:true,
        processNote:hasModel?(running?'AI正在处理，尚未收到最终回复；以下为已保存的调用记录。':'当前记录尚无可展示的最终回复，可展开过程或加载更早消息核对。'):'原方案回复未在当前分页中，执行反馈已保留，可加载更早消息查看。'}
      timeline.push(owner)
    }
    if(owner){
      owner.records.push(...internal)
      // 完整提问/规则与过程统一在回复下核对，提问气泡只保留自然原话和任务状态。
      for(const question of questions){owner.records.push(...question.records);question.records=[]}
    }
  }
  for(const row of timeline){
    row.records.sort(compareId)
    // 即使分页仅载最终回复，也能用其真实ID读取所属任务的完整轮次。
    row.nativeTrace=!row.legacy && row.role==='assistant' && row.records.some(r=>r.engine==='native-tools-v1' && ['model_request','model_response','data_response'].includes(r.event_type))
  }
  return timeline.sort(compareId)
}
