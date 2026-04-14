// src/services/api.js
import axios from 'axios';

// src/services/api.js
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production'
      ? `${process.env.VUE_APP_API_BASE_URL}/api`  // 生产环境使用配置
      : '/api',                                    // 开发环境使用代理
  timeout: 1000000,
  headers: {
      'Content-Type': 'application/json'
  }
});


export const getConfig = () => {
  return api.get('/config');
};

// 文本翻译
export const translateText = (text, source = 'auto', target = 'zh') => {
  return api.post('/translate', { text, source, target });
};
  
// 图片翻译
export const translateImage = (imageBase64, source = 'auto', target = 'zh') => {
  return api.post('/translate-image', { image: imageBase64, source, target });
};

// AI 文本翻译
export const translateAIText = (text, source = 'auto', target = 'zh') => {
  return api.post('/translate-ai', { text, source, target });
};

// AI 图片翻译
export const translateAIImage = (imageBase64, source = 'auto', target = 'zh') => {
  return api.post('/translate-ai-image', { image: imageBase64, source, target });
};

/**
 * AI 文生图
 * @param {Object} data 包含 prompt, model, session_id, image(可选)
 */
export const generateAIImage = (data) => {
  return api.post('/ai/chat-image', data);
};

/**
 * AI 图生图
 * @param {Object} data 包含 prompt, model, image_ids(可选), images(可选), session_id(可选)
 */
export const editAIImage = (data) => {
  return api.post('/ai/edit-image-v2', data);
};

/**
 * 获取图库列表（分页、倒序）
 * @param {number} page 页码
 * @param {number} pageSize 每页数量
 */
export const getGalleryList = (page = 1, pageSize = 20) => {
  return api.get('/ai/gallery', {
    params: { page, page_size: pageSize }
  });
};

/**
 * 删除图库中的单张图片
 * @param {string} image_id 图片 ID
 */
export const deleteImageApi = (image_id) => {
  return api.delete(`/ai/gallery/${image_id}`);
};

// ==================== 用户认证相关接口 ====================

/**
 * 用户注册
 * @param {Object} data {username, password, nickname}
 */
export const register = (data) => {
  return api.post('/user/register', data);
};

/**
 * 用户登录
 * @param {Object} data {username, password}
 */
export const login = (data) => {
  return api.post('/user/login', data);
};

/**
 * 用户登出
 */
export const logout = () => {
  return api.post('/user/logout');
};

/**
 * 获取当前用户信息
 */
export const getUserProfile = () => {
  return api.get('/user/profile');
};

/**
 * 修改用户信息
 * @param {Object} data {nickname}
 */
export const updateUserProfile = (data) => {
  return api.put('/user/profile', data);
};

/**
 * 修改密码
 * @param {Object} data {old_password, new_password}
 */
export const changePassword = (data) => {
  return api.put('/user/password', data);
};

// 设置认证token
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('auth_token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('auth_token');
  }
};

// 从localStorage恢复token
export const restoreAuthToken = () => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return token;
  }
  return null;
};

// 检查是否已登录
export const isAuthenticated = () => {
  return !!localStorage.getItem('auth_token');
};