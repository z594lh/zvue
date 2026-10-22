// 仅生成共享聊天的阅读投影，不改真实消息、请求内容、附件绑定或分页游标。

/** 优先使用真实事件类型，兼容尚未返回新字段的旧接口响应。 */
function kind(item) {
  if (item.event_type) return item.event_type
  if (item.role === 'user' && item.task_id) return 'user_message'
  if (item.role === 'assistant') return 'model_response'
  if (/^ERP · (每日例行分析|人工问题分析|继续分析|补查后继续回答)$/.test(item.title || '')) return 'model_request'
  if (item.title === 'ERP · 补充资料') return 'data_response'
  if (item.title === 'ERP · 方案校验反馈') return 'validation_feedback'
  return ''
}

/** 只按服务端真实任务/方案关联记录，不根据文字猜测某条资料属于哪次提问。 */
function groupKey(item) {
  if (item.task_id) return `task:${item.task_id}`
  if (item.plan_id) return `plan:${item.plan_id}`
  return `message:${item.id}`
}

/** 例行提问显示实际首段自然语言摘要；完整问题与固定约束仍在原记录折叠区。 */
function questionPreview(text) {
  const paragraph = String(text || '').split(/\n\s*\n/).find(value => value.trim()) || ''
  const sentences = paragraph.match(/[^。！？.!?]+[。！？.!?]?/g) || [paragraph]
  const readable = sentences.filter(value => !/final_plan|request_data|history_reviews|remaining_model_calls|JSON|type\/plan\/memory/i.test(value)).join('').trim()
  return readable || '本轮分析要求包含结构化协议，请展开原始提问查看具体内容。'
}

/** 构造主问题/自然回答及其折叠技术记录；保留分页孤立片段和错误，不丢原始事件。 */
export function buildChatTimeline(items) {
  const anchors = new Map(), humanKeys = new Set(), internal = new Set(), byId = new Map()
  for (const item of items) {
    if (kind(item) === 'user_message') {
      humanKeys.add(groupKey(item)); anchors.set(groupKey(item), item)
    }
  }
  for (const item of items) {
    const type = kind(item), key = groupKey(item)
    const human = humanKeys.has(key) || item.task?.task_type === 'chat' || /^ERP · (人工问题分析|补查后继续回答)$/.test(item.title || '')
    const technical = ['data_response', 'validation_feedback'].includes(type) ||
      (type === 'model_response' && item.response_type === 'request_data' && !item.has_error) ||
      (type === 'model_request' && (human || Number(item.round) > 1))
    if (technical) internal.add(item.id)
    if (!anchors.has(key) && !technical && type === 'model_request') anchors.set(key, item)
  }
  // 问题在上一页时，将资料归到本页实际回答；没有回答才使用紧凑折叠入口。
  for (const item of items) {
    if (!anchors.has(groupKey(item)) && kind(item) === 'model_response' && !internal.has(item.id)) anchors.set(groupKey(item), item)
  }
  const timeline = []
  for (const item of items) {
    if (internal.has(item.id)) continue
    const preview = kind(item) === 'model_request'
    const row = { ...item, text: preview ? questionPreview(item.text) : item.text,
      title: preview ? 'ERP · 例行提问' : item.title, questionPreview: preview, records: [item], auxiliary: false }
    byId.set(item.id, row); timeline.push(row)
  }
  for (const item of items) {
    if (!internal.has(item.id)) continue
    const key = groupKey(item), anchor = anchors.get(key)
    let row = anchor ? byId.get(anchor.id) : null
    if (!row) {
      row = { ...item, role: 'erp', text: '', title: '本轮资料与分析过程', records: [], auxiliary: true }
      byId.set(item.id, row); anchors.set(key, item); timeline.push(row)
    }
    row.records.push(item)
  }
  for (const row of timeline) {
    row.records.sort((a, b) => String(a.id).length - String(b.id).length || String(a.id).localeCompare(String(b.id)))
    row.documentSources = row.records.filter(record => record.documents?.length)
    row.documentCounts = row.documentSources.reduce((counts, record) => {
      for (const doc of record.documents) {
        if (doc.delivery === 'included') counts.included++
        else if (doc.delivery === 'archived') counts.archived++
      }
      return counts
    }, { included: 0, archived: 0 })
  }
  return timeline.sort((a, b) => String(a.id).length - String(b.id).length || String(a.id).localeCompare(String(b.id)))
}
