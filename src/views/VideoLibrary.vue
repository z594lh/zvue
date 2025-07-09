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
    
    <!-- 上传进度 -->
    <div v-if="uploading" class="upload-progress">
      <el-card shadow="hover">
        <div class="progress-header">
          <h3>{{ uploadFileName }}</h3>
          <el-button 
            size="small" 
            type="danger" 
            icon="el-icon-close" 
            @click="cancelUpload"
          >取消</el-button>
        </div>
        
        <el-progress 
          :percentage="uploadPercent" 
          :color="progressColor" 
          status="active"
        ></el-progress>
        
        <div class="progress-info">
          <span>{{ uploadSpeed }} MB/s</span>
          <span>{{ uploadPercent }}%</span>
          <span>{{ remainingTime }}</span>
        </div>
      </el-card>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="loading && !uploading" class="loading">
      <el-skeleton animated />
    </div>
    
    <!-- 空状态 -->
    <div v-else-if="videos.length === 0 && !uploading" class="empty-state">
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
import { ref, onMounted, onUnmounted } from 'vue'
import { ElNotification ,ElButton, ElUpload, ElSkeleton, ElEmpty, ElTooltip, ElProgress, ElCard } from 'element-plus'
import { videoApi } from '@/services/api';

// 状态管理
const videos = ref([])
const loading = ref(false)
const uploading = ref(false)
const uploadFileName = ref('')
const uploadPercent = ref(0)
const uploadSpeed = ref('0')
const remainingTime = ref('计算中...')
const progressColor = ref('#409EFF')
let uploadAbortController = null  // 用于取消上传
let uploadStartTime = 0
let uploadLastBytes = 0
let speedTimer = null

// 获取视频列表
async function fetchVideos() {
  loading.value = true
  try {
    const res = await videoApi.getVideoList()
    videos.value = res.data
  } catch (err) {
    showNotification('错误', `获取视频列表失败: ${err.message}`, 'error')
  } finally {
    loading.value = false
  }
}

// 自定义上传方法
async function customUpload({ file }) {
  if (uploading.value) {
    showNotification('提示', '已有正在上传的文件，请等待完成', 'warning')
    return
  }
  
  // 初始化上传状态
  uploading.value = true
  uploadFileName.value = file.name
  uploadPercent.value = 0
  uploadSpeed.value = '0'
  remainingTime.value = '计算中...'
  progressColor.value = '#409EFF'
  
  // 创建AbortController用于取消上传
  uploadAbortController = new AbortController()
  uploadStartTime = Date.now()
  uploadLastBytes = 0
  
  // 启动速度计算定时器
  speedTimer = setInterval(() => {
    calculateSpeed()
  }, 1000)
  
  try {
    await videoApi.uploadVideo(file, {
      signal: uploadAbortController.signal,  // 关联取消信号
      onUploadProgress: (progressEvent) => {
        const total = progressEvent.total
        const loaded = progressEvent.loaded
        uploadPercent.value = Math.round((loaded / total) * 100)
        
        // 根据进度调整颜色
        if (uploadPercent.value >= 90) {
          progressColor.value = '#67C23A'  // 绿色
        } else if (uploadPercent.value >= 60) {
          progressColor.value = '#E6A23C'  // 黄色
        }
      }
    })
    
    showNotification('成功', '视频上传成功', 'success')
    fetchVideos()  // 刷新视频列表
  } catch (err) {
    if (err.name === 'AbortError') {
      showNotification('提示', '已取消上传', 'info')
    } else {
      showNotification('错误', `上传失败: ${err.message}`, 'error')
    }
  } finally {
    // 清理上传状态
    uploading.value = false
    clearInterval(speedTimer)
    uploadAbortController = null
  }
}

// 计算上传速度和剩余时间
function calculateSpeed() {
  if (!uploading.value || uploadPercent.value <= 0) return
  
  const now = Date.now()
  const elapsed = (now - uploadStartTime) / 1000  // 秒
  const loadedBytes = (uploadPercent.value / 100) * (uploadLastBytes || 1)
  
  // 计算速度 (MB/s)
  const speed = (loadedBytes / elapsed) / (1024 * 1024)
  uploadSpeed.value = speed.toFixed(2)
  
  // 计算剩余时间
  if (uploadPercent.value < 100 && speed > 0) {
    const remainingBytes = (100 - uploadPercent.value) * (loadedBytes / uploadPercent.value)
    const remainingSeconds = remainingBytes / (speed * 1024 * 1024)
    
    if (remainingSeconds < 60) {
      remainingTime.value = `${Math.round(remainingSeconds)}秒`
    } else {
      const minutes = Math.floor(remainingSeconds / 60)
      const seconds = Math.round(remainingSeconds % 60)
      remainingTime.value = `${minutes}分${seconds}秒`
    }
  }
  
  uploadLastBytes = loadedBytes
}

// 取消上传
function cancelUpload() {
  if (uploadAbortController) {
    uploadAbortController.abort()  // 取消请求
    clearInterval(speedTimer)
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

// 显示通知
function showNotification(title, message, type = 'success') {
  ElNotification({
    title,
    message,
    type,
    duration: 3000
  })
}

// 页面加载时获取视频列表
onMounted(() => {
  fetchVideos()
})

// 组件卸载时清理资源
onUnmounted(() => {
  if (speedTimer) clearInterval(speedTimer)
  if (uploadAbortController) uploadAbortController.abort()
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

.upload-progress {
  margin-bottom: 20px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
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