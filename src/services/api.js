// src/services/api.js
import axios from 'axios';

// src/services/api.js
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production'
      ? `${process.env.VUE_APP_API_BASE_URL}/api`  // 生产环境使用配置
      : '/api',                                    // 开发环境使用代理
  timeout: 30000,
  headers: {
      'Content-Type': 'application/json'
  }
});


export const getConfig = () => {
  return api.get('/api/config');
};

// 文本翻译
export const translateText = (text, source = 'auto', target = 'zh') => {
  return api.post('/api/translate', { text, source, target });
};
  
// 图片翻译
export const translateImage = (imageBase64, source = 'auto', target = 'zh') => {
  return api.post('/api/translate-image', { image: imageBase64, source, target });
};

// AI 文本翻译
export const translateAIText = (text, source = 'auto', target = 'zh') => {
  return api.post('/api/translate-ai', { text, source, target });
};

// AI 图片翻译
export const translateAIImage = (imageBase64, source = 'auto', target = 'zh') => {
  return api.post('/api/translate-ai-image', { image: imageBase64, source, target });
};