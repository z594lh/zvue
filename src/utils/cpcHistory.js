// 历史记录保留未知枚举原值，避免把未知状态翻译成正常或成功。
const changes = {
  CREATED: '已创建', STATUS: '状态', NAME: '名称', BUDGET_AMOUNT: '预算',
  DEFAULT_BID_AMOUNT: '默认竞价', BID_AMOUNT: '竞价', START_DATE: '开始日期',
  END_DATE: '结束日期', SMART_BIDDING_STRATEGY: '竞价策略',
  PLACEMENT_GROUP: '广告位竞价调整', IN_BUDGET: '预算可用状态',
  PORTFOLIO: '广告组合', PORTFOLIO_ID: '广告组合', AUTO_TARGETED: '自动投放',
  RULE_BASED_BUDGET_VALUE: '规则调整预算', APPLICABLE_RULE_NAME: '适用规则名称',
  APPLICABLE_RULE_ID: '适用规则 ID', IS_PREMIUM_BID_ENABLED: '加价设置',
  BUDGET_DOCUMENT_VERSION: '预算版本', IS_PROCESSING: '处理状态', CREATION_DATE: '创建时间'
}
const states = { CREATED: '已创建', ENABLED: '正在投放', PAUSED: '已暂停', ARCHIVED: '已归档' }
const strategies = { OPTIMIZE_FOR_SALES: '动态竞价－提高和降低', LEGACY: '动态竞价－仅降低', MANUAL: '固定竞价' }
// 实际接口返回 TOP，官方旧枚举还保留 TOP_OF_SEARCH，两者均支持。
const placements = { TOP: '搜索结果顶部（首页）', TOP_OF_SEARCH: '搜索结果顶部（首页）', DETAIL_PAGE: '商品页面', PRODUCT_PAGE: '商品页面', REST_OF_SEARCH: '搜索结果的其余位置' }
const autoNames = {
  QUERY_HIGH_REL_MATCHES: '紧密匹配（close-match）', QUERY_BROAD_REL_MATCHES: '宽泛匹配（loose-match）',
  ASIN_ACCESSORY_RELATED: '关联商品（complements）', ASIN_SUBSTITUTE_RELATED: '同类商品（substitutes）',
  'CLOSE-MATCH': '紧密匹配（close-match）', 'LOOSE-MATCH': '宽泛匹配（loose-match）',
  COMPLEMENTS: '关联商品（complements）', SUBSTITUTES: '同类商品（substitutes）'
}
const matchNames = { NEGATIVE_KEYWORD_EXACT: '精准匹配', NEGATIVE_KEYWORD_PHRASE: '词组匹配',
  NEGATIVE_KEYWORD_BROAD: '广泛匹配', KEYWORD_EXACT: '精准匹配', KEYWORD_BROAD: '广泛匹配', KEYWORD_PHRASE: '词组匹配' }

function objectName(row) {
  const value = row.metadata?.keyword || row.metadata?.targetingExpression || row.metadata?.predefinedTarget || row.entityName
  return autoNames[value] || value || row.entityId || '未知对象'
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
  const entity = ({ CAMPAIGN: '广告活动', AD_GROUP: '广告组', AD: '广告商品', KEYWORD: '关键词',
    NEGATIVE_KEYWORD: '否定关键词', PRODUCT_TARGETING: '投放项', NEGATIVE_PRODUCT_TARGETING: '否定商品', THEME: '主题投放' })[row.entityType] || row.entityType || '未知对象'
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
  const name = autoNames[row.entityName] || row.entityName
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
