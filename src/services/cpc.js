import axios from 'axios'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: '/api/cpc',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' }
})

// 否定投放由后端验证登录，逐次读取 Token，避免登录/退出后沿用旧凭证。
api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (['post', 'put', 'delete'].includes(config.method) && !config.headers['X-Request-ID']) {
    config.headers['X-Request-ID'] = window.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
      const random = window.crypto?.getRandomValues ? window.crypto.getRandomValues(new Uint8Array(1))[0] % 16 : Math.floor(Math.random() * 16)
      return (char === 'x' ? random : (random & 3) | 8).toString(16)
    })
  }
  return config
})

api.interceptors.response.use(response => {
  if (response.data?.history_warning) ElMessage.warning(response.data.history_warning)
  return response
})

// ==================== 账号列表 ====================
export const getCpcAccounts = () => {
  return api.get('/campaigns/accounts')
}

// ==================== 实体同步 ====================
export const syncCpcEntities = (data) => {
  return api.post('/entities/sync', data, { timeout: 300000 })
}

export const syncAllCpcEntities = () => {
  return api.post('/entities/sync-all')
}

// ==================== 广告活动 ====================
export const getCpcChangeHistory = (params = {}) => {
  return api.get('/history', { params })
}

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

export const uploadCpcKeywords = (data, config = {}) => {
  return api.post('/keywords/upload', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  })
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

// 仅拉取当前层级实体，不修改 Amazon 广告。
export const refreshCpcNegatives = (kind, data) => {
  return api.post(kind === 'keywords' ? '/negative-keywords/refresh' : '/negative-targets/refresh', data)
}

// ==================== 搜索词报告 ====================
export const getCpcSearchTerms = (params = {}) => {
  return api.get('/search-terms', { params })
}

export const getCpcLatestReportDate = (params = {}) => {
  return api.get('/reports/latest-date', { params })
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

// 安全创建：保存提交编号后逐步推进，读取进度不会向Amazon发送写请求。
export const getCpcCreationMeta = params => api.get('/creation/meta', { params })
export const getCpcCreationProducts = params => api.get('/creation/products', { params })
export const getCpcCreationJobs = params => api.get('/creation/jobs', { params })
export const getCpcCreationJob = (id, shopId) => api.get(`/creation/jobs/${id}`, { params: { shop_id: shopId } })
export const startCpcCreation = data => api.post('/creation/jobs', data)
export const runCpcCreation = (id, data) => api.post(`/creation/jobs/${id}/run`, data)
export const repairCpcCreation = (id, data) => api.post(`/creation/jobs/${id}/repair`, data)
export const resolveCpcCreation = (id, data) => api.post(`/creation/jobs/${id}/resolve`, data)
