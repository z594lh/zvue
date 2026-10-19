export const spriteStates = {pending:'待采集',running:'采集中',downloaded:'已下载待入库',completed:'清洗完成',failed:'采集失败',action_required:'需人工处理',parse_failed:'清洗失败'}
export const spriteTime = value => value ? new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) : '—'
export function spriteValue(column, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (column.type === 'text') return String(value)
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  if (column.type === 'ratio') return (numeric * 100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'
  if (column.type === 'money') return '$'+numeric.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})
  return numeric.toLocaleString('zh-CN',{maximumFractionDigits:4})
}
