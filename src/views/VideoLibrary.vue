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
        
        <!-- 修复：删除 status="active"，使用默认状态 -->
        <el-progress 
          :percentage="uploadPercent" 
          :color="progressColor" 
          stroke-width="6"
        ></el-progress>
        
        <div class="progress-info">
          <!-- 确保速度显示正确绑定 -->
          <span>速度: {{ uploadSpeed }} MB/s</span>
          <span>进度: {{ uploadPercent }}%</span>
          <span>剩余: {{ remainingTime }}</span>
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
import { ElButton, ElUpload, ElSkeleton, ElEmpty, ElTooltip, ElProgress, ElCard, ElNotification } from 'element-plus'
import { videoApi } from '@/services/api'

// 状态管理
const videos = ref([])
const loading = ref(false)
const uploading = ref(false)
const uploadFileName = ref('')
const uploadPercent = ref(0)
const uploadSpeed = ref('0')
const remainingTime = ref('计算中...')
const progressColor = ref('#409EFF')
let uploadAbortController = null
let uploadStartTime = 0
let uploadLastTime = 0
let uploadLastBytes = 0
let speedTimer = null
let isCanceling = false

// 获取视频列表
async function fetchVideos() {
  console.log('[获取视频列表] 开始请求...')
  loading.value = true
  try {
    const res = await videoApi.getVideoList()
    console.log('[获取视频列表] 成功:', res.data.length, '个视频')
    videos.value = res.data
  } catch (err) {
    console.error('[获取视频列表] 失败:', err)
    showNotification('错误', `获取视频列表失败: ${err.message}`, 'error')
  } finally {
    loading.value = false
  }
}

// 自定义上传方法
async function customUpload({ file }) {
  console.log('[上传开始]', file.name, '大小:', formatFileSize(file.size))
  
  if (uploading.value) {
    showNotification('提示', '已有正在上传的文件，请等待完成', 'warning')
    return
  }
  
  // 上传前检查文件大小并提示
  const fileSize = file.size / (1024 * 1024) // MB
  if (fileSize > 100) {
    showNotification('注意', '大文件上传可能需要较长时间，请耐心等待', 'info')
  }
  
  // 初始化上传状态
  uploading.value = true
  uploadFileName.value = file.name
  uploadPercent.value = 0
  uploadSpeed.value = '0'
  remainingTime.value = '计算中...'
  progressColor.value = '#409EFF'
  uploadLastBytes = 0
  uploadStartTime = Date.now()
  uploadLastTime = uploadStartTime
  
  // 创建AbortController用于取消上传
  uploadAbortController = new AbortController()
  
  try {
    console.log('[上传配置] 开始发送请求...')
    // 记录上传开始时间，用于强制中间状态
    const start = Date.now()
    let isForceUpdated = false
    
    await videoApi.uploadVideo(file, {
      signal: uploadAbortController.signal,
      onUploadProgress: (progressEvent) => {
        if (!uploading.value) return
        
        const total = progressEvent.total
        const loaded = progressEvent.loaded
        const now = Date.now()
        
        // 计算进度百分比
        const percent = Math.round((loaded / total) * 100)
        uploadPercent.value = percent
        
        // 强制中间状态更新（如果上传太快，2秒内完成则手动更新一次中间进度）
        if (!isForceUpdated && now - start < 2000 && percent < 90) {
          // 手动触发一次50%的中间状态（视觉效果）
          uploadPercent.value = Math.min(50, percent)
          isForceUpdated = true
          // 延迟100ms再更新到实际进度，确保用户看到变化
          setTimeout(() => {
            uploadPercent.value = percent
          }, 100)
        }
        
        // 速度计算逻辑不变...
        if (uploadLastBytes > 0 && now - uploadLastTime > 500) {
          // ... 原有速度计算代码 ...
        }
      }
    })
    
    // 上传成功前，确保进度条显示100%
    uploadPercent.value = 100
    // 延迟500ms再清理状态，让用户看到完成状态
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // ... 后续成功逻辑 ...
  } catch (err) {
    // ... 错误处理 ...
  } finally {
    cleanupUpload()
  }
}

// 取消上传
function cancelUpload() {
  console.log('[取消上传] 尝试取消...')
  
  // 快速点击防护
  if (isCanceling) {
    console.log('[取消上传] 已在取消中，忽略重复请求')
    return
  }
  isCanceling = true
  
  // 检查是否有正在进行的上传
  if (!uploading.value || !uploadAbortController) {
    showNotification('提示', '没有正在进行的上传', 'info')
    isCanceling = false
    return
  }
  
  try {
    uploadAbortController.abort()
    console.log('[取消上传] 已发送取消信号')
    showNotification('提示', '正在取消上传...', 'info')
    
    // 重置状态
    uploadPercent.value = 0
    uploadSpeed.value = '0'
    remainingTime.value = '已取消'
    
    setTimeout(() => {
      cleanupUpload()
    }, 500)
  } catch (err) {
    console.error('[取消上传] 失败:', err)
    showNotification('错误', `取消上传失败: ${err.message}`, 'error')
    cleanupUpload()
  }
}

// 清理上传资源
function cleanupUpload() {
  console.log('[上传清理] 重置上传状态')
  uploading.value = false
  clearInterval(speedTimer)
  uploadAbortController = null
  isCanceling = false
}

// 上传前检查
function beforeUpload(file) {
  const fileSize = file.size / 1024 / 1024
  console.log('[上传前检查] 文件大小:', fileSize.toFixed(2), 'MB')
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
  console.error('[视频错误]', filename, '加载失败')
  showNotification('错误', `视频 ${filename} 加载失败`, 'error')
}

// 显示通知
function showNotification(title, message, type = 'success') {
  console.log(`[通知] ${type.toUpperCase()}: ${title} - ${message}`)
  ElNotification({
    title,
    message,
    type,
    duration: 3000
  })
}

// 页面加载时获取视频列表
onMounted(() => {
  console.log('[组件挂载] 获取视频列表')
  fetchVideos()
})

// 组件卸载时清理资源
onUnmounted(() => {
  console.log('[组件卸载] 清理上传资源')
  cleanupUpload()
})
</script>

<style scoped>
/* 增加进度条样式，使其更明显 */
.el-progress {
  margin: 15px 0;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 14px;  /* 增大字体，更清晰 */
  color: #606266;
}

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