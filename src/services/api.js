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

// 新增：视频相关接口
export const videoApi = {
  // 获取视频列表
  getVideoList: () => {
    return api.get('/videos');  // 对应后端 /api/videos 接口
  },
  
  // 上传视频（单独处理multipart/form-data）
  uploadVideo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload-video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 600000,  // 10分钟超时（600,000毫秒）
      // 移除返回对象的逻辑，仅计算进度（不返回值）
      onUploadProgress: (progressEvent) => {
        // 只计算进度，不返回对象
        Math.round((progressEvent.loaded * 100) / progressEvent.total);
      }
    });
  },
  
  // 获取视频播放地址（生成完整URL）
  getVideoUrl: (filename) => {
    // 根据环境生成完整播放地址
    return process.env.NODE_ENV === 'production'
      ? `${process.env.VUE_APP_API_BASE_URL}/api/video-detail/${filename}`
      : `/api/video-detail/${filename}`;
  }
};