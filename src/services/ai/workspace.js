/** 通用AI工作区接口；复用全站鉴权、错误与会话客户端。 */
import { api } from '@/services/api'
export const getAiProducts = params => api.get('/ai-operations/products', {params,timeout:20000})
export const resolveAiProduct = params => api.get('/ai-operations/products/resolve', {params,timeout:20000})
export const getProductConversations = (id,params={}) => api.get(`/ai-operations/products/${id}/conversations`, {params,timeout:20000})
export const createProductConversation = (id,body) => api.post(`/ai-operations/products/${id}/conversations`,body,{timeout:20000})
