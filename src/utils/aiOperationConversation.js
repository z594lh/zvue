// 从保存的真实会话事件构造问答，不编造任务、回答或发起网络请求。

/** 尝试解析实际消息JSON，普通文本返回null。 */
function jsonValue(text) { try { return JSON.parse(text) } catch { return null } }

/** 保留已有原文字符串，仅对结构化资料进行可读序列化。 */
function stringify(value) { return typeof value === 'string' ? value : JSON.stringify(value, null, 2) }

/** 创建阅读下载卡片，不表示向DeepSeek上传了独立文件。 */
function attachment(name, value, description = '本轮实际发送的数据') {
  const content = stringify(value)
  return { name, content, description, bytes: new TextEncoder().encode(content || '').length }
}

/** 翻译资料来源模块，便于理解AI索取的数据。 */
function sourceName(source) {
  return { listing: 'Listing文案', pricing: '售价成本', business: 'SKU经营', advertising: '广告报表', keywords: '卖家精灵关键词', keyword_history: '关键词历史', history: '往期优化', current_settings: '当前设置', erp_operations: 'ERP操作' }[source] || source || '资料'
}

/** 通过保存的目录解释对象名称，不推测未知编号。 */
function refName(plan, ref) {
  return plan.dataset?.content?.ads?.find(row => row.kind === ref)?.label || plan.dataset?.catalog?.[ref]?.label || plan.dataset?.evidence?.[ref]?.label || ref || '模块列表'
}

/** 显示原始报表窗口的中文含义，不修改统计日期。 */
function windowName(window) {
  return { all: '完整资料', daily: '逐日明细', d1: '近1日', d3: '近3日', d7: '近7日', p7: '前7日', d14: '近14日', p14: '前14日', d30: '近30日', p30: '前30日' }[window] || window
}

/** 格式化最终回答，结论、改值、理由、复盘和记忆全部来自模型原文。 */
function finalAnswer(plan, response) {
  const value = response.plan || {}, parts = [value.summary || '']
  if (!Array.isArray(value.actions) || value.actions.some(action => !action || typeof action !== 'object')) return stringify(response)
  if (value.actions?.length) parts.push('本次行动方案')
  for (const [index, action] of (value.actions || []).entries()) {
    parts.push(`${index + 1}. ${refName(plan, action.ref)} · ${action.mode === 'change' ? '修改' : '观察'}`)
    if (action.mode === 'change') parts.push(`建议改为：\n${Array.isArray(action.after) ? action.after.join('\n') : action.after}`)
    parts.push(`理由：${action.reason}`)
    if (action.observation) parts.push(`观察 ${action.observation.duration_days} 天：${action.observation.hypothesis}`, `复评条件：${action.observation.review_when}`)
  }
  if (value.history_reviews?.length) parts.push('往期改动复盘')
  for (const review of Array.isArray(value.history_reviews) ? value.history_reviews : []) if (review) parts.push(`执行 #${review.execution_id} · ${review.decision}\n${review.conclusion}`)
  if (Array.isArray(value.notes) && value.notes.length) parts.push('资料边界与补充说明', ...value.notes)
  if (response.memory) {
    parts.push('留给下一次分析的运营记忆', response.memory.strategy)
    for (const [key, label] of [['focus', '后续重点'], ['open_questions', '未决问题'], ['lessons', '已知结论']]) {
      if (Array.isArray(response.memory[key]) && response.memory[key].length) parts.push(`${label}：\n${response.memory[key].join('\n')}`)
    }
  }
  return parts.filter(Boolean).join('\n\n')
}

/** 按持久化事件顺序生成ERP和DeepSeek问答，附件直接指向实际消息数据。 */
export function buildConversationMessages(plan) {
  const messages = []
  for (const event of plan.conversation_events || []) {
    const payload = event.payload
    const message = { id: event.id, round: event.round_no, time: event.created_at, role: 'erp', title: 'ERP', text: '', files: [], raw: stringify(payload) }
    if (event.event_type === 'model_request') {
      const actual = payload.messages || [], users = actual.filter(row => row.role === 'user')
      const controls = users.map(row => jsonValue(row.content)).filter(value => value?.task_control)
      const instruction = controls.at(-1)?.task_control?.instruction || ''
      const question = users.find(row => !jsonValue(row.content))?.content
      message.title = event.round_no === 1 ? 'ERP · 运营分析任务' : 'ERP · 继续分析'
      message.text = event.round_no === 1 ? [question || actual.find(row => row.role === 'system')?.content?.split('\n')[0], instruction].filter(Boolean).join('\n\n') : instruction
      if (event.round_no === 1) {
        const data = users.find(row => jsonValue(row.content)?.schema_version)
        if (data) message.files.push(attachment(`${plan.asin}_运营资料.json`, data.content))
        const system = actual.find(row => row.role === 'system')
        if (system) message.files.push(attachment('运营任务与输出规则.txt', system.content, '实际使用的系统指令'))
      }
      message.files.push(attachment(`第${event.round_no}轮_完整请求.json`, payload, '完整messages、请求参数和本轮控制信息'))
    } else if (event.event_type === 'model_response') {
      message.role = 'assistant'; message.title = 'DeepSeek'
      const response = payload.response
      if (response?.type === 'request_data' && Array.isArray(response.requests) && response.requests.every(row => row && typeof row==='object')) message.text = '需要补充以下资料后继续分析：\n\n' + response.requests.map((request, index) => `${index + 1}. ${sourceName(request.source)} · ${refName(plan, request.ref)} · ${windowName(request.window)}\n${request.reason}`).join('\n\n')
      else if (response?.type === 'final_plan') message.text = finalAnswer(plan, response)
      else message.text = payload.message || stringify(response) || '未返回有效的回答内容'
      message.raw = payload.usage?.raw_output || stringify(response || payload)
      message.usage = payload.usage
    } else if (event.event_type === 'data_response') {
      message.title = 'ERP · 补充资料'
      message.text = (payload.data_responses || []).map(row => {
        const result = row.result || row
        const state = { provided: `已提供 ${result.returned} 条`, unavailable: '暂无可用资料', already_provided: '前文已提供，无新版本' }[result.status] || result.status
        return `${sourceName(row.request?.source)} · ${refName(plan, row.request?.ref)}：${state}${result.reason ? '\n' + result.reason : ''}`
      }).join('\n\n')
      message.files = (payload.data_responses || []).map((row, index) => attachment(`第${event.round_no}轮_补充${index + 1}_${sourceName(row.request?.source)}.json`, row, '实际回传给模型的补充资料及覆盖情况'))
    } else if (event.event_type === 'validation_feedback') {
      message.title = 'ERP · 请修正方案'
      message.text = `${payload.validation_feedback.message}\n\n${payload.validation_feedback.instruction}`
      message.files = [attachment('方案校验反馈.json', payload)]
    } else if (event.event_type === 'execution_feedback') {
      message.title = 'ERP · 执行结果反馈'
      message.text = [payload.message, `本次记录 ${payload.executions?.length || 0} 项执行结果，已交由后续会话恢复。`, payload.note].filter(Boolean).join('\n\n')
      message.files = [attachment('正式执行与回读结果.json', payload, '实际记录的正式提交与独立回读结果')]
    } else continue
    messages.push(message)
  }
  return messages
}

/** 把数据库UTC时间显示为北京时间，不冒充店铺业务日期。 */
export function conversationTime(value) {
  const text = String(value || '').replace(' ', 'T')
  const date = new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}
