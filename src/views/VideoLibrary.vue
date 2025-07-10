<template>
  <div class="video-library">
    <div class="header">
      <h2>视频库</h2>
    </div>

    <!-- Uppy 上传面板 -->
    <div ref="uppyContainer" class="uppy-panel"></div>

    <hr class="divider" />

    <!-- 加载中 -->
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElSkeleton, ElEmpty, ElNotification } from 'element-plus'
import { videoApi } from '@/services/api'

import Uppy from '@uppy/core'
import Dashboard from '@uppy/dashboard'
import XHRUpload from '@uppy/xhr-upload'
import '@uppy/core/dist/style.css'
import '@uppy/dashboard/dist/style.css'
import zh_CN from '@uppy/locales/lib/zh_CN.js'

const videos = ref([])
const loading = ref(false)
const uppyContainer = ref(null)
let uppy = null

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

// 初始化 Uppy 上传
onMounted(() => {
  fetchVideos()

  uppy = new Uppy({
    restrictions: {
      maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
      allowedFileTypes: ['video/*']
    },
    autoProceed: true
  })

  uppy
    .use(Dashboard, {
      inline: true,
      target: uppyContainer.value,
      showProgressDetails: true,
      proudlyDisplayPoweredByUppy: false,
      note: '支持 MP4/WebM/MOV/AVI 格式，最大 2GB',
      height: 280,
      locale: zh_CN
    })
    .use(XHRUpload, {
      endpoint: '/api/upload-video', // Flask 后端上传接口
      fieldName: 'file',
      formData: true
    })

  uppy.on('complete', (result) => {
    showNotification('成功', `上传成功：${result.successful.length} 个文件`)
    fetchVideos()
  })

  uppy.on('upload-error', (file, error) => {
    console.error('上传失败', file, error)
    showNotification('错误', `上传 ${file.name} 失败：${error.message}`, 'error')
  })
})

onBeforeUnmount(() => {
  if (uppy) {
    uppy.close()
  }
})

// 通知
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
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化时间
function formatDateTime(timestamp) {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

// 视频加载失败处理
function handleVideoError(filename) {
  showNotification('错误', `视频 ${filename} 加载失败`, 'error')
}
</script>

<style scoped>
.video-library {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.uppy-panel {
  margin-bottom: 20px;
}

.divider {
  margin: 20px 0;
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
