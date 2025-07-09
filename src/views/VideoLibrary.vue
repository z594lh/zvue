<template>
  <div class="video-library">
    <div class="header">
      <h2>视频库</h2>
      <div class="upload-container">
        <el-upload
          action="#"
          :http-request="customUpload"
          :show-file-list="false"
          accept="video/*"
          :before-upload="beforeUpload"
        >
          <el-button type="primary" icon="el-icon-upload">上传视频</el-button>
        </el-upload>
        <el-tooltip content="支持 MP4、WebM、MOV、AVI 格式，最大 2GB" placement="bottom">
          <i class="el-icon-question"></i>
        </el-tooltip>
      </div>
    </div>
    
    <hr class="divider" />
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      <el-skeleton animated />
    </div>
    
    <!-- 空状态 -->
    <div v-else-if="videos.length === 0" class="empty-state">
      <el-empty description="暂无视频，请上传视频" />
    </div>
    
    <!-- 视频列表 -->
    <div v-else class="video-grid">
      <div v-for="video in videos" :key="video.filename" class="video-card">
        <div class="video-wrapper">
          <video 
            controls 
            width="100%" 
            :src="videoApi.getVideoUrl(video.filename)"
            @error="handleVideoError(video.filename)"
          ></video>
          <div class="video-info">
            <h3 class="video-title">{{ video.filename }}</h3>
            <div class="video-meta">
              <span>{{ formatFileSize(video.size) }}</span>
              <span>{{ formatDateTime(video.modified) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElButton, ElUpload, ElSkeleton, ElEmpty, ElTooltip, ElNotification } from 'element-plus'
import { videoApi } from '@/services/api';

// 状态管理
const videos = ref([])
const loading = ref(false)

// 获取视频列表
async function fetchVideos() {
  loading.value = true
  try {
    const res = await videoApi.getVideoList();
    if (res.data.error) {
      throw new Error(res.data.error)
    }
    videos.value = res.data
  } catch (err) {
    // 确保错误信息是字符串
    const errMsg = err.message || '获取视频列表失败'
    showNotification('错误', errMsg, 'error')
  } finally {
    loading.value = false
  }
}

// 自定义上传方法
async function customUpload({ file }) {
  try {
    // 显示上传中通知
    const uploadNotice = ElNotification({
      title: '上传中',
      message: `正在上传 ${file.name}`,
      type: 'info',
      duration: 0 // 不自动关闭
    });
    
    // 调用上传接口
    await videoApi.uploadVideo(file, {
      onUploadProgress: (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        // 更新通知内容（字符串格式）
        uploadNotice.message = `正在上传 ${file.name}: ${percent}%`
      }
    });
    
    // 上传成功
    ElNotification.closeAll() // 关闭上传中通知
    showNotification('成功', '视频上传成功', 'success')
    fetchVideos() // 刷新列表
  } catch (err) {
    // 上传失败
    ElNotification.closeAll()
    const errMsg = err.message || '上传失败，请重试'
    showNotification('错误', errMsg, 'error')
  }
}

// 上传前检查
function beforeUpload(file) {
  const fileSize = file.size / 1024 / 1024
  if (fileSize > 2048) { // 2GB
    showNotification('错误', '视频文件不能超过 2GB', 'error')
    return false
  }
  return true
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期时间
function formatDateTime(timestamp) {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

// 处理视频错误
function handleVideoError(filename) {
  showNotification('错误', `视频 ${filename} 加载失败`, 'error')
}

// 显示通知（使用函数式调用）
function showNotification(title, message, type = 'success', duration = 3000) {
  ElNotification({
    title: title,
    message: message, // 确保是字符串
    type: type,
    duration: duration
  })
}

// 页面加载时获取视频列表
onMounted(() => {
  fetchVideos()
})
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.upload-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.divider {
  margin: 20px 0;
  border: 0;
  border-top: 1px solid #eee;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.video-card {
  border-radius: 8px;
  overflow: hidden;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.video-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.video-wrapper {
  position: relative;
  height: 100%;
}

video {
  display: block;
  width: 100%;
  height: auto;
  background-color: #000;
}

.video-info {
  padding: 12px 16px;
}

.video-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
}

.loading {
  padding: 20px;
  text-align: center;
}

.empty-state {
  padding: 40px 0;
}
</style>