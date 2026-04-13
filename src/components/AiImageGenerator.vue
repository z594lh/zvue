<template>
  <div class="ai-app-wrapper">
    <div class="main-content">
      
    <aside class="left-panel">
      <div class="card upload-card">
        <div class="card-title">图片上传 / 基准</div>
        
        <div class="upload-area" @click="triggerUpload">
          <input type="file" ref="fileInput" hidden @change="handleFileUpload" accept="image/*" multiple />

          <div v-if="previewUrls.length === 0 && currentEditIds.length === 0" class="placeholder">
            <div class="upload-icon">☁️</div>
            <div class="upload-text">点击上传图片</div>
            <div class="upload-hint">支持多张参考图 (最多5张)</div>
          </div>

          <div v-else class="preview-box multi-preview">
            <!-- 显示已上传的图片 -->
            <div v-for="(url, index) in previewUrls" :key="'upload-'+index" class="preview-item">
              <img :src="url" class="img-preview" @click.stop="previewImage(url)" />
              <div class="preview-actions">
                <span class="preview-action-icon" @click.stop="previewImage(url)" title="查看">🔍</span>
                <span class="preview-action-icon remove" @click.stop="removeImage(index)" title="移除">×</span>
              </div>
            </div>
            <!-- 显示已选中的历史图片 -->
            <div v-for="id in currentEditIds" :key="'history-'+id" class="preview-item history-item">
              <img :src="getHistoryImageUrl(id)" class="img-preview" @click.stop="previewImage(getHistoryImageUrl(id))" />
              <div class="preview-actions">
                <span class="preview-action-icon" @click.stop="previewImage(getHistoryImageUrl(id))" title="查看">🔍</span>
                <span class="preview-action-icon remove" @click.stop="removeHistoryImage(id)" title="移除">×</span>
              </div>
            </div>
            <div v-if="previewUrls.length + currentEditIds.length < 5" class="add-more" @click.stop="triggerUpload">+</div>
          </div>
        </div>

        <div class="session-section">
          <div v-if="currentEditIds.length > 0 || base64Images.length > 0" class="edit-status-info">
            <div class="label-with-tips">
              <label>当前参考图片 ({{ currentEditIds.length + base64Images.length }}张)</label>
              <span class="tips-icon" data-tips="AI会基于这些参考图片进行创作，保持人物、风格一致。">?</span>
            </div>
            <div class="id-display-box" v-if="currentEditIds.length > 0">
              <span class="id-text">IDs: {{ editIdsText }}</span>
            </div>
            <div class="reset-link-small" @click="resetToNew" style="margin-top: 5px;">清除所有参考</div>
          </div>

          <div v-else class="edit-status-empty">
            <p>✨ 当前为全新创作模式</p>
            <small>可上传图片或点击历史图片添加参考</small>
          </div>
        </div>
        
        <button class="btn btn-primary" :disabled="loading" @click="handleSend">
          <span v-if="loading">AI 构图中...</span>
          <span v-else>
            {{ hasReferenceImages ? '基于参考图生成' : (hasNewUploads ? '开始图生图' : '开始文生图') }}
          </span>
        </button>
        
        <button class="btn btn-secondary" @click="downloadLastImage" :disabled="!lastImage">
          下载当前所有图片
        </button>

        <div class="stats-info">
          <p>系统信息</p>
          <p>日期: {{ currentDate }}</p>
          <small class="mode-tip">
              {{ modeTipText }}
          </small>
          <div style="margin: 5px 0;">
              <a href="/gallery" target="_blank" class="gallery-link">【打开图库】</a>
          </div>
        </div>
      </div>
    </aside>

      <main class="right-panel">
        <div class="card config-card">
          <div class="card-title">图片描述 (Prompt)</div>
          <textarea
            v-model="currentPrompt"
            class="custom-textarea"
            placeholder="描述你想画的内容。ctrl+enter 快速发送。"
            @keyup.enter.ctrl="handleSend"
          ></textarea>

          <div class="config-grid">
            <div class="config-item">
              <label>模型选择</label>
              <select v-model="selectedModel" class="custom-select">
                <option value="doubao-seedream-4-0-250828">豆包 4.0</option>
                <option value="doubao-seedream-4-5-251128">豆包 4.5</option>
                <option value="doubao-seedream-5-0-260128">豆包 5.0</option>
                <option value="gemini-2.5-flash-image">Nano Banana</option>
                <option value="gemini-3.1-flash-image-preview">Nano Banana 2</option>
                <option value="gemini-3-pro-image-preview">Nano Banana Pro</option>
              </select>
            </div>
            <div class="config-item">
              <label>生成比例</label>
              <select v-model="config.ratio" class="custom-select">
                <option value="1:1">1:1 (正方形)</option>
                <option value="16:9">16:9 (横屏)</option>
                <option value="9:16">9:16 (竖屏)</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
              </select>
            </div>
            <div class="config-item">
                <label>生成数量</label>
                <select v-model.number="config.num" class="custom-select">
                    <option :value="1">1 张</option>
                    <option :value="2">2 张</option>
                    <option :value="4">4 张</option>
                </select>
            </div>

            <div class="config-item">
                <label>分辨率等级</label>
                <select v-model="config.quality" class="custom-select">
                <option v-for="q in availableQualities" :key="q.value" :value="q.value">{{ q.label }}</option>
                </select>
            </div>

            <div class="config-item">
                <label>参考图精度</label>
                <select v-model="config.refQuality" class="custom-select">
                <option value="standard">标准</option>
                <option value="high">高清</option>
                </select>
            </div>

          </div>
        </div>
      </main>

      <aside class="session-sidebar">
          <div class="card history-sidebar-card">
              <div class="card-title">
                历史生成 (Images)
                <span class="clear-cache-btn" @click="clearImageHistory" title="清空临时记录">
                  <i class="icon-trash"></i> 清除
                </span>
              </div>
              <div class="session-list-container">
                  <div
                      v-for="img in reversedImageHistory"
                      :key="img.image_id"
                      :class="['session-history-item', { active: isImagePreviewing(img.image_id) }]"
                      @click="toggleImageSelection(img)"
                  >
                      <div class="session-header">
                          <span class="sid-label">#{{ img.image_id.substring(0, 8) }}</span>
                          <span class="tips-icon preview-tips" data-tips="点击预览">👁</span>
                      </div>
                      <div class="mini-preview-wrap">
                          <img 
                              :src="img.url" 
                              class="mini-preview-img" 
                              loading="lazy"
                          />
                      </div>
                  </div>
                  
                  <div v-if="imageHistory.length === 0" class="side-empty">
                      暂无生成记录
                  </div>
              </div>
          </div>
      </aside>

    </div>

    <footer class="result-panel">
      <div class="card result-card">
        <div class="card-header">
          <span class="card-title">生成结果展示</span>
        </div>
        
        <div class="result-container">
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>AI 正在全力构图中...</p>
        </div>

        <div v-else-if="imageResults.length > 0" class="image-grid">
            <div v-for="(img, index) in imageResults" :key="index" class="image-item">
                <img :src="img.url" class="display-img" @click="previewImage(img.url)" />
                
                <div class="image-actions">
                    <span @click.stop="setAsReference(img)" class="action-btn edit" title="清空所有参考图，仅用此图作为参考">修改此图</span>
                    <span @click.stop="prepareEdit(img)" class="action-btn add-ref" title="添加此图到参考">添加参考</span>
                    <span @click.stop="downloadSingle(img.url)" class="action-btn download">保存</span>
                </div>
            </div>
        </div>

        <div v-else class="empty-state">
            <div class="empty-icon">🖼️</div>
            <p>暂无结果，请输入描述词后生成</p>
        </div>
        </div>
      </div>
    </footer>
    <div v-if="showOverlay" class="image-overlay" @click="showOverlay = false">
        <div class="overlay-content" @click.stop>
            <img :src="overlayImgUrl" class="full-img" />
            <div class="overlay-actions">
            <button class="overlay-btn" @click="downloadSingle(overlayImgUrl)">保存原图</button>
            <button class="overlay-btn close" @click="showOverlay = false">关闭</button>
            </div>
        </div>
    </div>
  </div>
</template>

<script>
import { generateAIImage, editAIImage } from '@/services/api';

// 定义缓存键名，统一管理。名称改为 IMAGE_LIST 以区分旧数据
const CACHE_KEY = 'AI_GENERATOR_IMAGE_HISTORY';

export default {
  data() {
    // 初始化时从 sessionStorage 读取铺平后的图片列表
    let savedHistory = [];
    try {
      const data = sessionStorage.getItem(CACHE_KEY);
      if (data) savedHistory = JSON.parse(data);
    } catch (e) {
      console.error("读取缓存失败:", e);
    }

    // 模型配置：每个模型支持的分辨率
    const modelConfig = {
      'gemini-2.5-flash-image': {
        qualities: [
          { value: '1K', label: '高清 (1K)' },
          { value: '2K', label: '超清 (2K)' }
        ]
      },
      'gemini-3.1-flash-image-preview': {
        qualities: [
          { value: '512', label: '标准 (512)' },
          { value: '1K', label: '高清 (1K)' },
          { value: '2K', label: '超清 (2K)' }
        ]
      },
      'gemini-3-pro-image-preview': {
        qualities: [
          { value: '512', label: '标准 (512)' },
          { value: '1K', label: '高清 (1K)' },
          { value: '2K', label: '超清 (2K)' }
        ]
      },
      'doubao-seedream-4-0-250828': {
        qualities: [
          { value: '1K', label: '高清 (1K)' },
          { value: '2K', label: '超清 (2K)' },
          { value: '4K', label: '极致 (4K)' }
        ]
      },
      'doubao-seedream-4-5-251128': {
        qualities: [
          { value: '2K', label: '超清 (2K)' },
          { value: '4K', label: '极致 (4K)' }
        ]
      },
      'doubao-seedream-5-0-260128': {
        qualities: [
          { value: '2K', label: '超清 (2K)' },
          { value: '3K', label: '极致 (3K)' }
        ]
      }
    };

    return {
      loading: false,
      enhanceLoading: false,
      editMode: false,
      currentEditIds: [], // 多图参考的 image_id 数组
      imageHistory: savedHistory,
      currentPrompt: '',
      previewUrls: [], // 多图参考的预览 URL 数组
      base64Images: [], // 多图参考的 base64 数组
      imageResults: [],
      lastImage: '',
      selectedModel: 'doubao-seedream-4-0-250828',
      modelConfig, // 模型配置
      config: {
        ratio: '1:1',
        num: 1,
        quality: '1K',
        refQuality: 'standard' // 参考图精度: 'standard'(0.6) 或 'high'(0.8)
      },
      stats: { count: 0 },
      currentDate: new Date().toISOString().split('T')[0],
      apiBaseUrl: process.env.VUE_APP_API_BASE_URL || '',
      showOverlay: false,
      overlayImgUrl: ''
    };
  },
  watch: {
    // 切换模型时，如果当前分辨率不被新模型支持，则自动切换到第一个支持的分辨率
    selectedModel(newModel) {
      const supportedQualities = this.modelConfig[newModel]?.qualities || [];
      const qualityValues = supportedQualities.map(q => q.value);
      if (!qualityValues.includes(this.config.quality)) {
        this.config.quality = qualityValues[0] || '1K';
      }
    }
  },

  computed: {
    // 右侧历史列表：最新的生成排在最上面
    reversedImageHistory() {
      return [...this.imageHistory].reverse();
    },
    // 是否有历史图片参考
    hasReferenceImages() {
      return this.currentEditIds.length > 0;
    },
    // 是否有新上传的图片
    hasNewUploads() {
      return this.base64Images.length > 0;
    },
    // 编辑ID文本显示
    editIdsText() {
      return this.currentEditIds.map(id => '#' + id.substring(0, 6)).join(', ');
    },
    // 模式提示文本
    modeTipText() {
      if (this.hasReferenceImages) {
        return `当前：${this.currentEditIds.length}张历史图参考`;
      } else if (this.hasNewUploads) {
        return `当前：${this.base64Images.length}张图生图`;
      }
      return '当前：文生图模式';
    },
    // 根据模型返回可用的分辨率选项
    availableQualities() {
      return this.modelConfig[this.selectedModel]?.qualities || [
        { value: '512', label: '标准 (512)' },
        { value: '1K', label: '高清 (1K)' },
        { value: '2K', label: '超清 (2K)' }
      ];
    }
  },
  mounted() {
    // 处理从图库跳转过来的参数
    const { refImageUrl, refImageId } = this.$route.query;
    if (refImageUrl && refImageId) {
      // 构造图片对象并设置为参考图
      const imgItem = {
        image_id: refImageId,
        url: refImageUrl
      };
      // 清空所有参考图，仅用此图作为参考（与"修改此图"逻辑一致）
      this.previewUrls = [];
      this.base64Images = [];
      this.currentEditIds = [imgItem.image_id];
      this.imageResults = [imgItem];
      // 添加到历史记录中（如果不存在）
      const exists = this.imageHistory.some(item => item.image_id === refImageId);
      if (!exists) {
        this.imageHistory.push(imgItem);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(this.imageHistory));
      }
      // 清空 query 参数，避免刷新时重复处理
      this.$router.replace({ path: '/ai-image', query: {} });
    }
  },
  methods: {
    triggerUpload() { this.$refs.fileInput.click(); },
    
    handleFileUpload(e) {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      // 检查总数限制（历史图 + 上传图）
      const currentTotal = this.currentEditIds.length + this.previewUrls.length;
      if (currentTotal + files.length > 5) {
        alert(`最多支持5张参考图，当前已有${currentTotal}张`);
        return;
      }

      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.src = ev.target.result;
          img.onload = () => {
            // 压缩策略：最大宽度768px，JPEG质量0.8，平衡质量与带宽
            const canvas = document.createElement('canvas');
            const maxWidth = 768;
            let width = img.width, height = img.height;
            if (width > maxWidth) {
              height = (maxWidth / width) * height;
              width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);

            // 根据用户选择决定压缩质量
            const jpegQuality = this.config.refQuality === 'high' ? 0.8 : 0.6;
            const compressedBase64 = canvas.toDataURL('image/jpeg', jpegQuality).split(',')[1];
            this.base64Images.push(compressedBase64);

            // 预览图也用压缩后的，保持一致
            this.previewUrls.push(URL.createObjectURL(file));
          };
        };
        reader.readAsDataURL(file);
      });

      // 清空 input 以便可以重复选择相同文件
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },

    previewImage(url) {
      if (!url) return;
      this.overlayImgUrl = url;
      this.showOverlay = true;
    },

    // 在 methods 模块中修改：
    clearImageHistory() {
      // 1. 二次确认
      if (!confirm("确定要清空所有历史图片记录吗？")) return;

      try {
        // 2. 清除浏览器 sessionStorage 里的数据
        // 注意：这里的 CACHE_KEY 必须和你 data() 里定义的一致
        sessionStorage.removeItem(CACHE_KEY);

        // 3. 重置当前组件内存中的数据
        this.imageHistory = [];
        
        // 4. 重置当前视图和编辑状态
        this.resetChat();

        console.log("图片历史缓存已清理");
      } catch (e) {
        console.error("清除缓存失败:", e);
        alert("清除失败");
      }
    },

    async downloadSingle(url) {
      if (!url) return;
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        const fileName = url.split('/').pop() || `ai-${Date.now()}.png`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        window.open(url, '_blank');
      }
    },
    
    // 移除单张上传的图片
    removeImage(index) {
      this.previewUrls.splice(index, 1);
      this.base64Images.splice(index, 1);
    },

    // 清除所有上传的参考图
    clearImage() {
      this.previewUrls = [];
      this.base64Images = [];
      this.currentEditIds = [];
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },

    // 重置为全新生成模式
    resetToNew() {
      this.clearImage();
    },

    async handleSend() {
      if (!this.currentPrompt) return alert("请输入描述词");
      this.loading = true;

      try {
        // 判断使用哪个接口：有参考图（历史图或上传图）用 edit-image，否则用 chat-image
        const hasReferences = this.currentEditIds.length > 0 || this.base64Images.length > 0;

        let res;
        if (hasReferences) {
          // 使用多图编辑接口
          const payload = {
            prompt: this.currentPrompt,
            image_ids: this.currentEditIds.length > 0 ? this.currentEditIds : null,
            images: this.base64Images.length > 0 ? this.base64Images : null,
            model: this.selectedModel,
            number_of_images: this.config.num,
            aspect_ratio: this.config.ratio,
            quality: this.config.quality
          };
          res = await editAIImage(payload);
        } else {
          // 使用文生图接口
          const payload = {
            prompt: this.currentPrompt,
            model: this.selectedModel,
            number_of_images: this.config.num,
            aspect_ratio: this.config.ratio,
            quality: this.config.quality
          };
          res = await generateAIImage(payload);
        }

        const result = res.data || res;

        if (result.status === 'success') {
          const details = result.image_details || [];

          this.imageResults = details;
          this.lastImage = details[0]?.url;

          // 将新生成的图片对象直接追加到数组末尾
          this.imageHistory = [...this.imageHistory, ...details];
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(this.imageHistory));

          this.stats.count++;
        }
      } catch (err) {
        console.error("生成失败:", err);
        alert(err.message.includes('timeout') ? "生成超时" : "请求失败");
      } finally {
        this.loading = false;
      }
    },
    
    // 检查图片是否正在预览
    isImagePreviewing(imageId) {
      return this.imageResults.length === 1 && this.imageResults[0].image_id === imageId;
    },

    // 根据历史图片ID获取URL
    getHistoryImageUrl(imageId) {
      const img = this.imageHistory.find(item => item.image_id === imageId);
      return img ? img.url : '';
    },

    // 移除选中的历史图片
    removeHistoryImage(imageId) {
      const index = this.currentEditIds.indexOf(imageId);
      if (index > -1) {
        this.currentEditIds.splice(index, 1);
      }
    },

    // 点击预览图片（仅显示在预览区，不添加为参考图）
    toggleImageSelection(imgItem) {
      // 只在中心区域显示该图，不添加到参考图列表
      this.imageResults = [imgItem];
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // 点击"修改此图" - 清空所有参考图，仅用此图作为参考
    setAsReference(imgItem) {
      // 清空所有上传的图片
      this.previewUrls = [];
      this.base64Images = [];
      // 清空历史参考图，只保留当前这张
      this.currentEditIds = [imgItem.image_id];
      // 显示该图片
      this.imageResults = [imgItem];
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // 点击"添加参考" - 添加此图到参考（不清空原有的）
    prepareEdit(imgItem) {
      // 先检查是否已选中
      if (this.currentEditIds.includes(imgItem.image_id)) {
        // 已选中则只显示大图
        this.imageResults = [imgItem];
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // 未选中则添加
      if (this.currentEditIds.length + this.base64Images.length >= 5) {
        alert('最多支持5张参考图');
        return;
      }
      this.currentEditIds.push(imgItem.image_id);
      this.imageResults = [imgItem];
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    resetChat() {
      this.currentEditIds = [];
      this.lastImage = '';
      this.imageResults = [];
      this.clearImage();
      this.currentPrompt = '';
    },
    
    async downloadLastImage() {
      if (!this.imageResults || this.imageResults.length === 0) return;
      for (let i = 0; i < this.imageResults.length; i++) {
        try {
          const item = this.imageResults[i];
          const url = typeof item === 'string' ? item : item.url;
          const response = await fetch(`${url}?t=${Date.now()}`);
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          const idPrefix = this.currentEditIds.length > 0 ? this.currentEditIds[0].substring(0, 5) : 'new';
          link.download = `ai-gen-${idPrefix}-${i+1}.jpg`;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
          }, 1000);
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          console.error("下载失败:", err);
        }
      }
    }
  }
};
</script>
<style scoped>
/* ======= 基础框架：升级为三栏布局 ======= */
.ai-app-wrapper { 
  background-color: #f5f7f9; 
  padding: 30px; 
  min-height: 100vh; 
  font-family: 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  box-sizing: border-box;
}

.main-content { 
  display: grid; 
  grid-template-columns: 280px 1fr 220px; 
  gap: 20px; 
  max-width: 1400px; 
  margin: 0 auto 24px; 
}

.card { 
  background: #fff; 
  border-radius: 8px; 
  border: 1px solid #e1e4e8; 
  padding: 24px; 
  box-shadow: 0 2px 12px rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
}

.card-title { 
  font-size: 16px; 
  font-weight: 600; 
  color: #333; 
  margin-bottom: 20px; 
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ======= 1. 左侧面板样式 (上传 & 按钮) ======= */
.upload-area { 
  border: 2px dashed #409eff; 
  border-radius: 8px; 
  height: 160px; 
  margin-bottom: 15px;
  cursor: pointer; 
  position: relative; 
  overflow: hidden; 
  background: #fbfdff; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  transition: border-color 0.3s;
}

.upload-area:hover { border-color: #79bbff; }

.session-section { 
  margin-bottom: 15px; 
  background: #fcfcfc; 
  border: 1px solid #f0f0f0; 
  padding: 8px 12px; 
  border-radius: 6px; 
}

.input-item { margin-bottom: 8px; }

.custom-input { padding: 6px 10px; font-size: 13px; }

.img-preview { max-width: 100%; max-height: 100%; object-fit: contain; }

/* 多图预览样式 */
.preview-box.multi-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  align-content: flex-start;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.preview-item {
  position: relative;
  width: 70px;
  height: 70px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e1e4e8;
}

.preview-item.history-item {
  border: 2px solid #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.preview-item .img-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: zoom-in;
}

.preview-actions {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 2px;
}

.preview-action-icon {
  width: 18px;
  height: 18px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
}

.preview-action-icon:hover {
  background-color: rgba(0, 0, 0, 0.85);
  transform: scale(1.1);
}

.preview-action-icon.remove {
  background-color: rgba(255, 77, 79, 0.85);
  font-size: 14px;
}

.preview-action-icon.remove:hover {
  background-color: #ff4d4f;
}

.add-more {
  width: 70px;
  height: 70px;
  border: 2px dashed #409eff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #409eff;
  cursor: pointer;
  transition: all 0.3s;
}

.add-more:hover {
  background: #f0f7ff;
  border-color: #79bbff;
}


/* ======= 2. 中间面板样式 (Prompt & 配置) ======= */
.custom-textarea { height: 260px; resize: none; line-height: 1.6; }
.config-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 15px; }

/* ======= 3. 右侧历史列表样式 (Session Sidebar) ======= */
.session-sidebar { display: flex; flex-direction: column; height: 100%; }

.history-sidebar-card { flex: 1; max-height: 520px; padding: 16px; }

.session-list-container { flex: 1; overflow-y: auto; padding-right: 4px; max-height: 600px; }

.session-list-container::-webkit-scrollbar { width: 4px; }
.session-list-container::-webkit-scrollbar-thumb { background: #e1e4e8; border-radius: 4px; }

.session-history-item {
  border: 1px solid #e4e7ed; border-radius: 8px; padding: 10px; margin-bottom: 12px;
  cursor: pointer; background: #fff; transition: all 0.2s ease;
}
.session-history-item:hover { border-color: #409eff; background: #f9fbff; }
.session-history-item.active { border-color: #409eff; background: #f0f7ff; box-shadow: 0 2px 8px rgba(64,158,255,0.15); }

.session-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; }
.sid-label { color: #333; font-weight: bold; }
.count-tag { background: #909399; color: #fff; padding: 0 6px; border-radius: 10px; }

/* 预览提示 - 在右侧边栏中使用，提示框向左显示避免超出边界 */
.tips-icon.preview-tips {
  cursor: pointer;
}
.tips-icon.preview-tips::after {
  width: 80px;
  left: auto;
  right: 150%;
  transform: translateX(0) scale(0.9);
  transform-origin: right center;
}
.tips-icon.preview-tips::before {
  left: auto;
  right: 125%;
  transform: translateX(0);
  border: 6px solid transparent;
  border-left-color: #303133;
  border-top-color: transparent;
}
.tips-icon.preview-tips:hover::after {
  transform: translateX(0) scale(1);
}

.mini-preview-wrap { width: 100%; height: 85px; border-radius: 4px; overflow: hidden; background: #f5f7fa; }
.mini-preview-img { width: 100%; height: 100%; object-fit: cover; }

/* ======= 4. 通用组件 & 底部展示区 ======= */
.custom-select, .custom-input, .custom-textarea {
  width: 100%; border: 1px solid #dcdfe6; border-radius: 6px; padding: 10px 12px;
  font-size: 14px; color: #606266; outline: none; box-sizing: border-box; background-color: #fff;
}
.custom-select:focus, .custom-input:focus, .custom-textarea:focus { border-color: #409eff; box-shadow: 0 0 0 2px rgba(64,158,255,0.1); }

.btn { width: 100%; padding: 12px; border-radius: 6px; border: none; cursor: pointer; margin-bottom: 12px; font-weight: 600; font-size: 14px; transition: 0.3s; }
.btn-primary { background: #20a0ff; color: #fff; }
.btn-secondary { background: #009688; color: #fff; }
.btn-enhance {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  width: auto;
  padding: 8px 16px;
  font-size: 13px;
  margin-bottom: 0;
}
.btn-enhance:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
.btn:disabled { background: #dcdfe6; cursor: not-allowed; }

.prompt-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.result-panel { max-width: 1400px; margin: 0 auto; }
.result-container {
  min-height: 400px; background-color: #fafafa; border: 1px dashed #e1e4e8;
  border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 20px;
}

.image-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; width: 100%; }

.image-item { position: relative; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); background: #fff; }

.display-img { width: 100%; height: auto; display: block; object-fit: contain; transition: 0.3s; z-index: 1; }
.display-img:hover { transform: scale(1.02); cursor: zoom-in; }

/* 💡 核心修改：将操作区域移至左上角，并确保 z-index 高于图片 */
.image-actions {
    position: absolute;
    top: 10px;    /* 修改为顶部 */
    left: 10px;   /* 修改为左侧 */
    display: flex;
    flex-direction: row; /* 横向排列 */
    gap: 8px;
    z-index: 5;   /* 确保在图片之上 */
}

.action-btn {
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    backdrop-filter: blur(4px);
    user-select: none;
}

.action-btn.edit {
    background: rgba(64, 158, 255, 0.85);
}

.action-btn.edit:hover {
    background: #409eff;
    transform: translateY(-2px);
}

.action-btn.add-ref {
    background: rgba(103, 194, 58, 0.85);
}

.action-btn.add-ref:hover {
    background: #67c23a;
    transform: translateY(-2px);
}

.action-btn.download:hover {
    background: rgba(0, 0, 0, 0.9);
    color: #409eff;
    transform: translateY(-2px);
}

.stats-info { margin-top: auto; background: #f8f9fa; border-radius: 6px; padding: 15px; font-size: 13px; }
.spinner { border: 4px solid #f3f3f3; border-top: 4px solid #409eff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.chat-status { grid-column: span 2; font-size: 12px; padding: 8px; background: #fff8e6; border-radius: 4px; border: 1px solid #ffe58f; }
.reset-link { color: #409eff; cursor: pointer; text-decoration: underline; margin-left: 10px; }

/* 大图遮罩层样式 */
.image-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center;
  z-index: 9999; backdrop-filter: blur(5px);
}

.overlay-content { position: relative; max-width: 90%; max-height: 90%; display: flex; flex-direction: column; align-items: center; }

.full-img { max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 4px; box-shadow: 0 0 20px rgba(0,0,0,0.5); }

.overlay-actions { margin-top: 20px; display: flex; gap: 15px; }

.overlay-btn { padding: 10px 25px; border-radius: 20px; border: none; background: #409eff; color: white; cursor: pointer; font-weight: bold; transition: 0.3s; }
.overlay-btn.close { background: #909399; }
.overlay-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }

.gallery-link { color: #409eff; text-decoration: none; font-size: 13px; cursor: pointer; font-weight: bold; }
.gallery-link:hover { text-decoration: underline; }

.clear-cache-btn {
  font-size: 12px; font-weight: normal; color: #f56c6c; cursor: pointer; padding: 2px 8px;
  border: 1px solid rgba(245, 108, 108, 0.2); border-radius: 4px;
  background: rgba(245, 108, 108, 0.05); transition: all 0.3s;
}
.clear-cache-btn:hover { background: #f56c6c; color: #fff; border-color: #f56c6c; box-shadow: 0 2px 8px rgba(245, 108, 108, 0.3); }

.label-with-tips { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.label-with-tips label { margin-bottom: 0; }

.tips-icon {
  display: inline-flex; justify-content: center; align-items: center; width: 16px; height: 16px;
  font-size: 11px; color: #909399; border: 1px solid #909399; border-radius: 50%;
  cursor: help; position: relative; transition: all 0.2s;
}
.tips-icon:hover { color: #409eff; border-color: #409eff; background: rgba(64, 158, 255, 0.05); }

.tips-icon::after {
  content: attr(data-tips); position: absolute; bottom: 150%; left: 50%; transform: translateX(-50%) scale(0.9);
  width: 220px; padding: 10px; background: #303133; color: #fff; font-size: 12px;
  line-height: 1.6; border-radius: 6px; z-index: 100; opacity: 0; pointer-events: none;
  transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.tips-icon::before {
  content: ''; position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%);
  border: 6px solid transparent; border-top-color: #303133; opacity: 0; transition: all 0.2s; z-index: 100;
}
.tips-icon:hover::after, .tips-icon:hover::before { opacity: 1; transform: translateX(-50%) scale(1); }


.edit-status-info {
  background: #f0f7ff;
  border: 1px solid #d1e9ff;
  padding: 10px;
  border-radius: 6px;
}
.id-display-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 5px;
}
.id-text {
  font-family: monospace;
  font-weight: bold;
  color: #409eff;
}
.reset-link-small {
  font-size: 12px;
  color: #f56c6c;
  cursor: pointer;
}
.edit-status-empty {
  text-align: center;
  color: #909399;
  padding: 10px 0;
  border: 1px dashed #ebeef5;
  border-radius: 6px;
}

</style>