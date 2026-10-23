/** 把数据库UTC时间显示为北京时间，不冒充店铺业务日期。 */
export function conversationTime(value) {
  const text = String(value || '').replace(' ', 'T')
  const date = new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(text) ? text : text + 'Z')
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}
