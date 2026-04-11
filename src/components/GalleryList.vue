<template>
  <div class="gallery-container">
    <!-- 图片预览遮罩层 -->
    <div v-if="showOverlay" class="image-preview-overlay" @click="showOverlay = false">
      <div class="overlay-content" @click.stop>
        <img :src="overlayImgUrl" class="full-img" />
        <div class="overlay-actions-bar">
          <button class="overlay-btn" @click="downloadImage(overlayImgUrl)">下载原图</button>
          <button class="overlay-btn close" @click="showOverlay = false">关闭</button>
        </div>
      </div>
    </div>

    <div class="gallery-header">
      <div class="header-left">
        <h2>作品图库</h2>
      </div>
      
      <button 
        v-if="allImages.length > 0" 
        @click="deleteCurrentPage" 
        class="delete-page-btn"
      >
        🗑️ 删除本页所有图片
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>正在努力加载作品...</p>
    </div>
    
    <div v-else-if="allImages.length === 0" class="empty-state">
      <div class="empty-icon">🎨</div>
      <p>图库空空如也，快去创作吧！</p>
    </div>

    <div v-else class="image-grid">
      <div v-for="(url, index) in allImages" :key="index" class="image-item">
        <img :src="url" @load="onImageLoad" />
        
        <div class="image-overlay">
          <div class="overlay-actions">
            <button class="action-btn edit" @click.stop="gotoCreate(url)" title="去创作">
              ✏️
            </button>
            <button class="action-btn preview" @click.stop="previewImage(url)" title="全屏预览">
              🔍
            </button>
            <button class="action-btn download" @click.stop="downloadImage(url)" title="下载图片">
              📥
            </button>
            <button class="action-btn delete" @click.stop="deleteSingleImage(url, index)" title="删除作品">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="pagination-container" v-if="allImages.length > 0">
      <button 
        class="pag-btn" 
        :disabled="page === 1" 
        @click="page--"
      >
        <span class="arrow">←</span> 上一页
      </button>
      
      <div class="page-indicator">
        第 <span class="current-num">{{ page }}</span> 页
        <span class="total-count" v-if="total"> / 共 {{ Math.ceil(total / pageSize) }} 页</span>
      </div>
      
      <button 
        class="pag-btn" 
        :disabled="!hasMore" 
        @click="page++"
      >
        下一页 <span class="arrow">→</span>
      </button>
    </div>
  </div>
</template>

<script>
import { getGalleryList, deleteImageApi } from '@/services/api';

export default {
  data() {
    return {
      page: 1,
      pageSize: 20,
      loading: false,
      allImages: [],
      total: 0,
      hasMore: true,
      showOverlay: false,
      overlayImgUrl: ''
    };
  },
  watch: {
    page: "fetchGallery"
  },
  mounted() {
    this.fetchGallery();
  },
  methods: {
    // 获取列表
    async fetchGallery() {
      this.loading = true;
      try {
        const res = await getGalleryList(this.page, this.pageSize);
        const data = res.data || res;
        this.allImages = data.images || [];
        this.total = data.total || 0;
        this.hasMore = data.has_more;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        console.error("加载图库失败:", e);
      } finally {
        this.loading = false;
      }
    },

    // 预览 - 使用遮罩层显示
    previewImage(url) {
      if (!url) return;
      this.overlayImgUrl = url;
      this.showOverlay = true;
    },

    // 去创作 - 跳转到 AI 绘图页面并带上图片 URL
    gotoCreate(url) {
      // 从 URL 中提取图片信息，构造 imageItem 对象
      const filename = url.split('/').pop();
      // 使用 image_id 作为 filename（去掉扩展名）
      const imageId = filename.replace(/\.[^/.]+$/, '');
      // 使用完整页面跳转，确保组件重新加载
      window.location.href = `/ai-image?refImageUrl=${encodeURIComponent(url)}&refImageId=${imageId}`;
    },

    // 下载
    async downloadImage(url) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `AI-Work-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        window.open(url, '_blank');
      }
    },

    // 删除单张
    async deleteSingleImage(url, index) {
      if (!confirm("确定要永久删除这张作品吗？")) return;
      try {
        const filename = url.split('/').pop();
        await deleteImageApi(filename);
        this.allImages.splice(index, 1);
        this.total--;
      } catch (err) {
        alert("删除失败，请检查网络");
      }
    },

    // 删除本页
    async deleteCurrentPage() {
      if (!confirm(`确定要清空本页这 ${this.allImages.length} 张图片吗？`)) return;
      try {
        const filenames = this.allImages.map(url => url.split('/').pop());
        await Promise.all(filenames.map(name => deleteImageApi(name)));
        this.fetchGallery(); // 重新加载本页
      } catch (err) {
        alert("批量删除时遇到错误");
      }
    }
  }
};
</script>

<style scoped>
.gallery-container {
  padding: 40px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
  background-color: #ffffff;
}

/* 头部布局 */
.gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 25px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 1.5px solid #409eff;
  background: rgba(64, 158, 255, 0.05);
  color: #409eff;
  font-weight: bold;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.back-btn:hover {
  background: #409eff;
  color: white;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}

.delete-page-btn {
  padding: 10px 20px;
  background: #fff;
  color: #f56c6c;
  border: 1.5px solid #f56c6c;
  border-radius: 10px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.delete-page-btn:hover {
  background: #f56c6c;
  color: #fff;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.2);
}

/* 图片网格 */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 25px;
}

.image-item {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  background: #f0f2f5;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.image-item img {
  width: 100%;
  aspect-ratio: 1/1;
  object-fit: cover;
  display: block;
  transition: transform 0.6s cubic-bezier(0.165, 0.84, 0.44, 1);
}

/* 悬停遮罩 */
.image-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.image-item:hover .image-overlay {
  opacity: 1;
}

.image-item:hover img {
  transform: scale(1.1);
}

.overlay-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: white;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 20px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  transition: all 0.2s;
}

.action-btn:hover {
  transform: translateY(-5px) scale(1.1);
}

.action-btn.download:hover { color: #409eff; }
.action-btn.delete:hover { color: #f56c6c; }
.action-btn.edit:hover { color: #67c23a; }
.action-btn.preview:hover { color: #e6a23c; }

/* 图片预览遮罩层样式 */
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(5px);
}

.image-preview-overlay .overlay-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.image-preview-overlay .full-img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.image-preview-overlay .overlay-actions-bar {
  margin-top: 20px;
  display: flex;
  gap: 15px;
}

.image-preview-overlay .overlay-btn {
  padding: 10px 25px;
  border-radius: 20px;
  border: none;
  background: #409eff;
  color: white;
  cursor: pointer;
  font-weight: bold;
  transition: 0.3s;
}

.image-preview-overlay .overlay-btn.close {
  background: #909399;
}

.image-preview-overlay .overlay-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

/* 分页组件 */
.pagination-container {
  margin: 60px auto;
  padding: 12px 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 40px;
  background: #f8f9fa;
  border-radius: 50px;
  border: 1px solid #eee;
  width: fit-content;
}

.pag-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border: 1px solid #409eff;
  background: transparent;
  color: #409eff;
  border-radius: 25px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
}

.pag-btn:hover:not(:disabled) {
  background: #409eff;
  color: white;
}

.pag-btn:disabled {
  border-color: #ccc;
  color: #999;
  cursor: not-allowed;
}

.current-num {
  color: #409eff;
  font-weight: 800;
  font-size: 22px;
  margin: 0 5px;
}

/* 加载与空状态 */
.loading-state, .empty-state {
  text-align: center;
  padding: 100px 0;
  color: #909399;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>