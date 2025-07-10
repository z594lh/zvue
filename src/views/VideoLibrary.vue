<template>
  <div class="video-library">
    <div class="header">
      <h2>视频库</h2>
      <div class="upload-container">
        <el-upload
          class="upload-btn"
          action="/api/upload-video"
          :show-file-list="false"
          accept="video/*"
          :before-upload="beforeUpload"
          :on-success="handleUploadSuccess"
          :on-error="handleUploadError"
          :on-progress="handleUploadProgress"
        >
          <el-button type="primary" icon="el-icon-upload">上传视频</el-button>
        </el-upload>
        <el-tooltip content="支持 MP4、WebM、MOV、AVI 格式，最大 2GB" placement="bottom">
          <i class="el-icon-question"></i>
        </el-tooltip>
      </div>
    </div>

    <hr class="divider" />

    <div v-if="uploading" class="upload-progress">
      <el-card shadow="hover">
        <div class="progress-header">
          <h3>{{ uploadFileName }}</h3>
        </div>
        <el-progress :percentage="uploadPercent" :color="progressColor" stroke-width="6"></el-progress>
      </el-card>
    </div>

    <div v-if="loading && !uploading" class="loading">
      <el-skeleton animated />
    </div>

    <div v-else-if="videos.length === 0 && !uploading" class="empty-state">
      <el-empty description="暂无视频，请上传视频" />
    </div>

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

const videos = ref([])
const loading = ref(false)
const uploading = ref(false)
const uploadFileName = ref('')
const uploadPercent = ref(0)
const progressColor = ref('#409EFF')

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

// 上传前检查大小
function beforeUpload(file) {
  const sizeMB = file.size / 1024 / 1024
  if (sizeMB > 2048) {
    showNotification('错误', '视频文件不能超过 2GB', 'error')
    return false
  }
  uploading.value = true
  uploadFileName.value = file.name
  uploadPercent.value = 0
  return true
}

// 上传中
function handleUploadProgress(event) {
  const percent = Math.round((event.loaded / event.total) * 100)
  uploadPercent.value = percent
}

// 上传成功
function handleUploadSuccess() {
  showNotification('成功', '视频上传成功')
  uploading.value = false
  uploadPercent.value = 100
  fetchVideos()
}

// 上传失败
function handleUploadError() {
  showNotification('错误', '上传失败，请稍后重试', 'error')
  uploading.value = false
  uploadPercent.value = 0
}

// 视频加载失败
function handleVideoError(filename) {
  showNotification('错误', `视频 ${filename} 加载失败`, 'error')
}

// 通知封装
function showNotification(title, message, type = 'success') {
  ElNotification({
    title,
    message,
    type,
    duration: 3000
  })
}

// 格式化大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化时间
function formatDateTime(timestamp) {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

// 初始化加载
onMounted(() => {
  fetchVideos()
})

// 卸载清理（可留空）
onUnmounted(() => {
  uploading.value = false
})
</script>

<style scoped>
.el-progress {
  margin: 15px 0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
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
