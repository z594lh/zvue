import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production'
    ? `${process.env.VUE_APP_API_BASE_URL}/api/cpc`
    : '/api/cpc',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' }
})

// ==================== 账号列表 ====================
export const getCpcAccounts = () => {
  return api.get('/campaigns/accounts')
}

// ==================== 实体同步 ====================
export const syncCpcEntities = (data) => {
  return api.post('/entities/sync', data)
}

export const syncAllCpcEntities = () => {
  return api.post('/entities/sync-all')
}

// ==================== 广告活动 ====================
export const getCpcCampaigns = (params = {}) => {
  return api.get('/campaigns', { params })
}

export const updateCpcCampaign = (campaignId, data) => {
  return api.put(`/campaigns/${campaignId}`, data)
}

export const getCpcCampaign = (campaignId, params = {}) => {
  return api.get(`/campaigns/${campaignId}`, { params })
}

// ==================== 广告组 ====================
export const getCpcGroups = (params = {}) => {
  return api.get('/groups', { params })
}

export const getCpcGroup = (adGroupId, params = {}) => {
  return api.get(`/groups/${adGroupId}`, { params })
}

export const updateCpcGroup = (adGroupId, data) => {
  return api.put(`/groups/${adGroupId}`, data)
}

// ==================== 产品广告 ====================
export const getCpcProductAds = (params = {}) => {
  return api.get('/product-ads', { params })
}

export const updateCpcProductAd = (adId, data) => {
  return api.put(`/product-ads/${adId}`, data)
}

// ==================== 关键词 ====================
export const getCpcKeywords = (params = {}) => {
  return api.get('/keywords', { params })
}

export const updateCpcKeyword = (keywordId, data) => {
  return api.put(`/keywords/${keywordId}`, data)
}

export const batchCreateCpcKeywords = (data) => {
  return api.post('/keywords/batch', data)
}

export const getCpcBidRecommendationsKeywords = (data) => {
  return api.post('/keywords/bid-recommendations', data)
}

// ==================== 投放 ====================
export const getCpcTargets = (params = {}) => {
  return api.get('/targets', { params })
}

export const getCpcTargetsAuto = (params = {}) => {
  return api.get('/targets/auto', { params })
}

export const updateCpcTarget = (targetId, data) => {
  return api.put(`/targets/${targetId}`, data)
}

export const batchCreateCpcTargets = (data) => {
  return api.post('/targets/batch', data)
}

export const getCpcBidRecommendationsTargets = (data) => {
  return api.post('/targets/bid-recommendations', data)
}

// ==================== 否定关键词 ====================
export const getCpcNegativeKeywords = (params = {}) => {
  return api.get('/negative-keywords', { params })
}

export const updateCpcNegativeKeyword = (keywordId, data) => {
  return api.put(`/negative-keywords/${keywordId}`, data)
}

export const createCpcNegativeKeyword = (data) => {
  return api.post('/negative-keywords', data)
}

// ==================== 否定投放 ====================
export const getCpcNegativeTargets = (params = {}) => {
  return api.get('/negative-targets', { params })
}

export const updateCpcNegativeTarget = (targetId, data) => {
  return api.put(`/negative-targets/${targetId}`, data)
}

export const createCpcNegativeTarget = (data) => {
  return api.post('/negative-targets', data)
}

// ==================== 搜索词报告 ====================
export const getCpcSearchTerms = (params = {}) => {
  return api.get('/search-terms', { params })
}

// ==================== 广告位 ====================
export const getCpcPlacements = (params = {}) => {
  return api.get('/placements', { params })
}

export const updateCpcPlacement = (campaignId, data) => {
  return api.put(`/campaigns/${campaignId}/placement`, data)
}

// ==================== 分日数据 ====================
export const getCpcDailyData = (params = {}) => {
  return api.get('/daily-data', { params })
}

// ==================== 广告结构树 ====================
export const getCpcStructureTree = (params = {}) => {
  return api.get('/structure/tree', { params })
}

// ==================== 预算规则 ====================
export const getCpcBudgetRules = (params = {}) => {
  return api.get('/budget-rules', { params })
}

export const createCpcBudgetRule = (data) => {
  return api.post('/budget-rules', data)
}

export const updateCpcBudgetRule = (ruleId, data) => {
  return api.put(`/budget-rules/${ruleId}`, data)
}

export const deleteCpcBudgetRule = (ruleId, params = {}) => {
  return api.delete(`/budget-rules/${ruleId}`, { params })
}

// ==================== 创建向导 ====================
export const getCpcCreatePortfolios = (shopId) => {
  return api.get('/create/portfolios', { params: { shop_id: shopId } })
}

export const getCpcCreateProducts = (params = {}) => {
  return api.get('/create/products', { params })
}

export const createCpcCampaign = (data) => {
  return api.post('/create-campaign', data)
}
