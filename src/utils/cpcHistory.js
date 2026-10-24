// 历史展示复用全系统字典；未知枚举保留原值，不据中文名称判断业务状态。
import { dictionaryMap } from '@/utils/businessDictionary'
const changes=dictionaryMap('ads.change'),states=dictionaryMap('ads.state'),strategies=dictionaryMap('ads.strategy')
const placements=dictionaryMap('ads.placement'),autoNames=dictionaryMap('ads.auto_target',true),matchNames=dictionaryMap('ads.match')
const entities=dictionaryMap('ads.entity')

function objectName(row) {
  const value = row.metadata?.keyword || row.metadata?.targetingExpression || row.metadata?.predefinedTarget || row.entityName
  return (row.entityType==='PRODUCT_TARGETING'?autoNames[value]:null) || value || row.entityId || '未知对象'
}

function isCreated(row) {
  return row.changeType === 'CREATED' || (row.changeType === 'STATUS' && row.newValue === 'CREATED')
}
const dateOptions = {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
}
const timezones = { 'Asia/Shanghai': '北京时间', 'America/Los_Angeles': '美国太平洋时间', UTC: 'UTC' }
const dateFormatters = Object.fromEntries(Object.keys(timezones).map(timeZone => [timeZone, new Intl.DateTimeFormat('zh-CN', { ...dateOptions, timeZone })]))

export function historyTime(value, timeZone = 'Asia/Shanghai') {
  if (value == null || value === '' || value === 'null') return '—'
  const date = new Date(Number(value))
  return Number.isNaN(date.getTime()) ? String(value) : (dateFormatters[timeZone] || dateFormatters['Asia/Shanghai']).format(date)
}

export function historyChange(row) {
  if (typeof row.display?.change === 'string') return row.display.change
  const entity = entities[row.entityType] || row.entityType || '未知对象'
  if (row.changeType === 'PLACEMENT_GROUP') {
    const position = row.metadata?.placementGroupPosition
    return `${placements[position] || position || '广告位'}的竞价调整`
  }
  if (['KEYWORD', 'NEGATIVE_KEYWORD', 'PRODUCT_TARGETING', 'NEGATIVE_PRODUCT_TARGETING', 'THEME', 'AD'].includes(row.entityType)) {
    const match = matchNames[row.metadata?.negativeTargetingType || row.metadata?.keywordType]
    const label = `${entity}${match ? `（${match}）` : ''}`
    return `${label} - ${objectName(row)} - ${isCreated(row) ? '已添加' : changes[row.changeType] || row.changeType || '未知更改'}`
  }
  if (row.entityType === 'CAMPAIGN' && row.changeType === 'BUDGET_AMOUNT') {
    return row.metadata?.campaignBudgetType === 'LIFETIME_BUDGET' ? '广告活动总预算' : '广告活动每日预算'
  }
  if (row.changeType === 'IN_BUDGET') return '广告活动预算状态'
  return `${entity}${isCreated(row) ? '已创建' : changes[row.changeType] || ` · ${row.changeType || '未知更改'}`}`
}

export function historyDetail(row) {
  if (typeof row.display?.detail === 'string') return row.display.detail
  // 所属层级显式展示，同名否定词也不能把活动级、组级混为一条。
  const group = Object.prototype.hasOwnProperty.call(row, 'adGroupId') ? row.adGroupId : row.metadata?.adGroupId
  const scope = group ? `广告组 ID：${group}` : row.campaignId || row.metadata?.campaignId ? '广告活动级' : ''
  const name = (row.entityType==='PRODUCT_TARGETING'?autoNames[row.entityName]:null) || row.entityName
  return [name && !historyChange(row).includes(name) ? name : '', scope].filter(Boolean).join(' · ')
}

export function historyValue(row, key, timeZone = 'Asia/Shanghai') {
  // 新接口以统一后端展示为准；旧接口/旧时区响应仍保留原兼容计算。
  const dateChange = ['START_DATE', 'END_DATE', 'CREATION_DATE'].includes(row.changeType)
  if (typeof row.display?.[key] === 'string' && (!dateChange || row.display.timezone === timeZone)) return row.display[key]
  const value = row[key]
  if (value == null || value === '' || value === 'null') return '—'
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (row.changeType === 'STATUS' || row.changeType === 'CREATED') {
    if (raw === 'CREATED' && !['CAMPAIGN', 'AD_GROUP'].includes(row.entityType)) return '已添加'
    return states[raw] || raw
  }
  if (row.changeType === 'SMART_BIDDING_STRATEGY') return strategies[raw] || raw
  if (row.changeType === 'IN_BUDGET') return ({ true: '在预算内', false: '超出预算' })[raw] || raw
  if (['BUDGET_AMOUNT', 'DEFAULT_BID_AMOUNT', 'BID_AMOUNT', 'RULE_BASED_BUDGET_VALUE'].includes(row.changeType)) {
    return Number.isFinite(Number(raw)) ? Number(raw).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : raw
  }
  if (row.changeType === 'PLACEMENT_GROUP') return Number.isFinite(Number(raw)) ? `${raw}%` : raw
  if (['START_DATE', 'END_DATE', 'CREATION_DATE'].includes(row.changeType) && /^\d{10}(\d{3})?$/.test(raw)) {
    return historyTime(Number(raw) * (raw.length === 10 ? 1000 : 1), timeZone)
  }
  return raw
}

export function historyDates(days = 90, timeZone = 'Asia/Shanghai') {
  const now = Date.now()
  // 按选择的时区计算自然日，不使用浏览器所在时区。
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const day = ms => {
    const parts = Object.fromEntries(format.formatToParts(new Date(ms)).map(part => [part.type, part.value]))
    return `${parts.year}-${parts.month}-${parts.day}`
  }
  const last = day(now)
  const first = new Date(Date.parse(`${last}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10)
  return [first, last]
}

export const historyTimezones = Object.entries(timezones).map(([value, label]) => ({ value, label }))

export function historyFilters() {
  const keys = [
    'BUDGET_AMOUNT', 'STATUS', 'NAME', 'START_DATE', 'END_DATE',
    'SMART_BIDDING_STRATEGY', 'PLACEMENT_GROUP', 'IN_BUDGET', 'DEFAULT_BID_AMOUNT', 'BID_AMOUNT', 'CREATED'
  ]
  return keys.map(value => ({ value, label: changes[value] }))
}

export function historyCategories(scope, view = 'console') {
  return [
    { value: 'settings', label: scope === 'group' ? '广告组设置' : view === 'all' ? '活动 / 广告组设置' : '广告活动设置' },
    ...((scope === 'group' || view === 'all') ? [{ value: 'targeting', label: '投放方案' }] : []),
    { value: 'negative', label: '否定投放' },
    ...((scope === 'group' || view === 'all') ? [{ value: 'ad', label: '广告' }] : [])
  ]
}
