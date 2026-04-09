<template>
  <div class="ai-app-wrapper">
    <div class="main-content">
      
      <aside class="left-panel">
        <div class="card upload-card">
          <div class="card-title">图片上传</div>
          
          <div class="upload-area" @click="triggerUpload">
            <input type="file" ref="fileInput" hidden @change="handleFileUpload" accept="image/*" />
            
            <div v-if="!previewUrl" class="placeholder">
              <div class="upload-icon">☁️</div>
              <div class="upload-text">点击上传图片</div>
              <div class="upload-hint">支持单张参考图</div>
            </div>
            
            <div v-else class="preview-box">
              <img :src="previewUrl" class="img-preview" />
              <div class="remove-btn" @click.stop="clearImage" title="移除图片，切换为文生图">×</div>
              <div class="remove-overlay">重新上传</div>
            </div>
          </div>

          <div class="session-section">
            <div class="input-item">
              <div class="label-with-tips">
                <label>对话模式</label>
                <span class="tips-icon" data-tips="【单次生成】每次都是全新开始；【多轮修改】会关联之前的 Session ID，你可以告诉 AI：‘把刚才那张图里的头发改成红色’。">?</span>
              </div>
              <select v-model="isChatMode" class="custom-select">
                <option :value="false">单次生成 (全新)</option>
                <option :value="true">多轮修改 (基于Session)</option>
              </select>
            </div>

            <div class="input-item" v-if="isChatMode">
              <div class="label-with-tips">
                <label>Session ID</label>
                <span class="tips-icon" data-tips="Session ID 是对话的唯一凭证。每次生图操作都会产生一个Session ID，根据Session ID可以修改图。例如Session ID 为 #aa10ac3f 的会话生成了一个蓝色的小猫，你填写Session ID之后，告诉AI，把毛发换成红色，就可以得到一个红色毛发的小猫了！">?</span>
              </div>
              <input v-model="inputSessionId" placeholder="首次生成可留空" class="custom-input" />
            </div>
          </div>
          
          <button class="btn btn-primary" :disabled="loading" @click="handleSend">
            <span v-if="loading">AI 构图中...</span>
            <span v-else>
              {{ isChatMode && inputSessionId ? '立即修改图片' : (base64Image ? '开始图生图' : '开始文生图') }}
            </span>
          </button>
          
          <button class="btn btn-secondary" @click="downloadLastImage" :disabled="!lastImage">
            下载当前所有图片
          </button>

            <div class="stats-info">
            <p>系统信息</p>
            <p>日期: {{ currentDate }}</p>
            <small class="mode-tip">
                {{ isChatMode ? '当前：多轮对话模式' : (base64Image ? '当前：图生图模式' : '当前：文生图模式') }}
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
              <select v-model="selectedModel" class="custom-select" :disabled="isChatMode && inputSessionId">
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
                <option value="720">标准 (720p级)</option>
                <option value="1080">高清 (1080p级)</option>
                <option value="1440">超清 (1440p级)</option>
                </select>
            </div>
            <div class="chat-status" v-if="isChatMode && inputSessionId">
              当前 Session: <b>{{ inputSessionId }}</b> | <span class="reset-link" @click="resetChat">开启新画布</span>
            </div>
          </div>
        </div>
      </main>

        <aside class="session-sidebar">
            <div class="card history-sidebar-card">
                <div class="card-title">
                  历史会话 (Session)
                  <span class="clear-cache-btn" @click="clearSessionCache" title="清空临时历史">
                    <i class="icon-trash"></i> 清除
                  </span>
                </div>
                <div class="session-list-container">
                    <div 
                        v-for="sid in reversedSessionIds" 
                        :key="sid" 
                        :class="['session-history-item', { active: inputSessionId === sid }]"
                        @click="selectSession(sid)"
                    >
                        <div class="session-header">
                            <span class="sid-label">#{{ sid.substring(0, 6) }}</span>
                            <span class="count-tag">{{ sessionHistoryMap[sid].length }}张</span>
                        </div>
                        <div class="mini-preview-wrap">
                            <img 
                                v-if="sessionHistoryMap[sid] && sessionHistoryMap[sid].length" 
                                :src="sessionHistoryMap[sid][0]" 
                                class="mini-preview-img" 
                            />
                        </div>
                    </div>
                    
                    <div v-if="reversedSessionIds.length === 0" class="side-empty">
                        暂无历史
                    </div>
                </div>
            </div>
        </aside>

    </div>

    <footer class="result-panel">
      <div class="card result-card">
        <div class="card-header">
          <span class="card-title">生成结果展示</span>
          <span v-if="inputSessionId" class="sid-badge">SESSION #{{ inputSessionId }}</span>
        </div>
        
        <div class="result-container">
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>AI 正在全力构图中...</p>
        </div>

        <div v-else-if="imageResults.length > 0" class="image-grid">
            <div 
            v-for="(imgUrl, index) in imageResults" 
            :key="index" 
            class="image-item"
            >
            <img :src="imgUrl" class="display-img" @click="previewImage(imgUrl)" />
            <span @click.stop="downloadSingle(imgUrl)" class="mini-download">保存</span>
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
import { generateAIImage } from '@/services/api';

// 定义缓存键名，方便统一管理
const CACHE_KEY = 'AI_GENERATOR_SESSIONS';

export default {
  data() {
    // 初始化时直接从 sessionStorage 读取，实现“返回即恢复”
    let savedHistory = {};
    try {
      const data = sessionStorage.getItem(CACHE_KEY);
      if (data) savedHistory = JSON.parse(data);
    } catch (e) {
      console.error("读取缓存失败:", e);
    }

    return {
      loading: false,
      isChatMode: false,
      inputSessionId: '',
      // 初始值即为缓存数据
      sessionHistoryMap: savedHistory,
      currentPrompt: '',
      previewUrl: '', 
      base64Image: '', 
      imageResults: [],
      lastImage: '', 
      selectedModel: 'gemini-2.5-flash-image',
      config: { 
        ratio: '1:1',
        num: 1,
        quality: '1080'
      },
      stats: { count: 0 },
      currentDate: new Date().toISOString().split('T')[0],
      apiBaseUrl: process.env.VUE_APP_API_BASE_URL || '',
      showOverlay: false,
      overlayImgUrl: ''
    };
  },
  computed: {
    reversedSessionIds() {
      return Object.keys(this.sessionHistoryMap).reverse();
    }
  },
  methods: {
    triggerUpload() { this.$refs.fileInput.click(); },
    
    handleFileUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      this.previewUrl = URL.createObjectURL(file);
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.src = ev.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 1280;
          let width = img.width, height = img.height;
          if (width > maxWidth) { height = (maxWidth / width) * height; width = maxWidth; }
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          this.base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        };
      };
      reader.readAsDataURL(file);
    },

    previewImage(url) {
      if (!url) return;
      this.overlayImgUrl = url;
      this.showOverlay = true;
    },

    clearSessionCache() {
      // 1. 二次确认，防止误点
      if (!confirm("确定要清空本次浏览的所有历史会话吗？（此操作不可撤销）")) return;

      try {
        // 2. 清除浏览器 sessionStorage 里的数据
        sessionStorage.removeItem(CACHE_KEY);

        // 3. 重置当前组件内存中的数据，让界面实时更新
        this.sessionHistoryMap = {};
        
        // 4. 如果当前正处于某个会话中，顺便重置当前视图
        this.resetChat();

        console.log("会话缓存已清理完成");
      } catch (e) {
        console.error("清除缓存失败:", e);
        alert("清除失败，请手动刷新页面");
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
        const fileName = url.split('/').pop() || 'ai-design.png';
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        window.open(url, '_blank');
      }
    },
    
    clearImage() { 
      this.previewUrl = '';
      this.base64Image = '';
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = ''; 
      }
    },
    
    async handleSend() {
      if (!this.currentPrompt) return alert("请输入描述词");
      this.loading = true;
      
      try {
        const payload = {
          prompt: this.currentPrompt,
          session_id: this.isChatMode ? (this.inputSessionId || null) : null,
          image: this.base64Image,
          model: this.selectedModel,
          number_of_images: this.config.num,
          aspect_ratio: this.config.ratio,
          quality: this.config.quality
        };

        const res = await generateAIImage(payload);
        const result = res.data || res; 

        if (result.status === 'success') {
          const sid = result.session_id;
          const allImgs = result.images || [];
          this.imageResults = allImgs;
          this.lastImage = allImgs[0];
          
          this.inputSessionId = sid;

          // 核心修改：同步更新内存和 sessionStorage
          this.sessionHistoryMap = {
            ...this.sessionHistoryMap,
            [sid]: allImgs 
          };
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(this.sessionHistoryMap));

          this.stats.count++;
        }
      } catch (err) {
        console.error("生成失败:", err);
        alert(err.message.includes('timeout') ? "生成超时" : "请求失败");
      } finally {
        this.loading = false;
      }
    },
    
    selectSession(sid) {
      this.inputSessionId = sid;
      this.isChatMode = true;
      const imgs = this.sessionHistoryMap[sid];
      if (Array.isArray(imgs)) {
        this.imageResults = imgs;
        this.lastImage = imgs[0];
      } else {
        this.imageResults = [imgs];
        this.lastImage = imgs;
      }
    },
    
    resetChat() {
      this.inputSessionId = ''; 
      this.lastImage = ''; 
      this.imageResults = [];
      this.clearImage();
      this.currentPrompt = ''; 
      this.isChatMode = false;
    },
    
    async downloadLastImage() {
      if (!this.imageResults || this.imageResults.length === 0) return;
      for (let i = 0; i < this.imageResults.length; i++) {
        try {
          const url = this.imageResults[i];
          const response = await fetch(`${url}?t=${Date.now()}`);
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `ai-gen-${this.inputSessionId.substring(0, 5)}-${i+1}.jpg`;
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
  /* 调整为：左侧上传(280px) | 中间配置(1fr) | 右侧历史(220px) */
  grid-template-columns: 280px 1fr 220px; 
  gap: 20px; 
  max-width: 1400px; /* 适当放宽总宽度以容纳三栏 */
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

.card-title { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 20px; }

/* ======= 1. 左侧面板样式 (上传 & 按钮) ======= */
.upload-area { 
  border: 2px dashed #409eff; 
  border-radius: 8px; 
  height: 160px; /* 这里改小一点，空间立刻就出来了 */
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

.session-section { 
  margin-bottom: 15px; 
  background: #fcfcfc; 
  border: 1px solid #f0f0f0; 
  padding: 8px 12px; /* 减小内边距 */
  border-radius: 6px; 
}

.input-item { 
  margin-bottom: 8px; /* 减小每一项的间距 */
}

/* 专门给 Session ID 输入框减负 */
.custom-input {
  padding: 6px 10px; /* 缩减高度 */
  font-size: 13px;
}

.upload-area:hover { border-color: #79bbff; }

.img-preview { max-width: 100%; max-height: 100%; object-fit: contain; }

.remove-btn {
  position: absolute; top: 8px; right: 8px; width: 24px; height: 24px;
  background-color: rgba(255, 77, 79, 0.9); color: #fff; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; cursor: pointer; z-index: 10;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2); transition: all 0.2s; opacity: 0.8;
}
.remove-btn:hover { background-color: #ff4d4f; transform: scale(1.1) rotate(90deg); opacity: 1; }

/* ======= 2. 中间面板样式 (Prompt & 配置) ======= */
.custom-textarea { height: 260px; resize: none; line-height: 1.6; }
.config-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 15px; }

/* ======= 3. 🆕 右侧历史列表样式 (Session Sidebar) ======= */
.session-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.history-sidebar-card {
  flex: 1;
  max-height: 520px; /* 限制与输入框区域等高 */
  padding: 16px;
}

.session-list-container {
  flex: 1;
  overflow-y: auto; /* 历史多时可滚动 */
  padding-right: 4px;
}

/* 滚动条美化 */
.session-list-container::-webkit-scrollbar { width: 4px; }
.session-list-container::-webkit-scrollbar-thumb { background: #e1e4e8; border-radius: 4px; }

.session-history-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 12px;
  cursor: pointer;
  background: #fff;
  transition: all 0.2s ease;
}

.session-history-item:hover {
  border-color: #409eff;
  background: #f9fbff;
}

.session-history-item.active {
  border-color: #409eff;
  background: #f0f7ff;
  box-shadow: 0 2px 8px rgba(64,158,255,0.15);
}

.session-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
}

.sid-label { color: #333; font-weight: bold; }
.count-tag { background: #909399; color: #fff; padding: 0 6px; border-radius: 10px; }

.mini-preview-wrap {
  width: 100%;
  height: 85px;
  border-radius: 4px;
  overflow: hidden;
  background: #f5f7fa;
}

.mini-preview-img { width: 100%; height: 100%; object-fit: cover; }

/* ======= 4. 通用组件 & 底部展示区 ======= */
.custom-select, .custom-input, .custom-textarea {
  width: 100%; border: 1px solid #dcdfe6; border-radius: 6px;
  padding: 10px 12px; font-size: 14px; color: #606266; outline: none;
  box-sizing: border-box; background-color: #fff;
}
.custom-select:focus, .custom-input:focus, .custom-textarea:focus {
  border-color: #409eff; box-shadow: 0 0 0 2px rgba(64,158,255,0.1);
}

.btn { width: 100%; padding: 12px; border-radius: 6px; border: none; cursor: pointer; margin-bottom: 12px; font-weight: 600; font-size: 14px; transition: 0.3s; }
.btn-primary { background: #20a0ff; color: #fff; }
.btn-secondary { background: #009688; color: #fff; }
.btn:disabled { background: #dcdfe6; cursor: not-allowed; }

.result-panel { max-width: 1400px; margin: 0 auto; }
.result-container {
  min-height: 400px; background-color: #fafafa; border: 1px dashed #e1e4e8;
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px; width: 100%;
}

.image-item {
  position: relative; border-radius: 8px; overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1); background: #fff;
}

.display-img { width: 100%; height: auto; display: block; object-fit: contain; transition: 0.3s; }
.display-img:hover { transform: scale(1.02); cursor: zoom-in; }

.mini-download {
  position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.6);
  color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-decoration: none;
}

.stats-info { margin-top: auto; background: #f8f9fa; border-radius: 6px; padding: 15px; font-size: 13px; }
.spinner { border: 4px solid #f3f3f3; border-top: 4px solid #409eff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* 对话模式的小贴士 */
.chat-status { grid-column: span 2; font-size: 12px; padding: 8px; background: #fff8e6; border-radius: 4px; border: 1px solid #ffe58f; }
.reset-link { color: #409eff; cursor: pointer; text-decoration: underline; margin-left: 10px; }

/* 大图遮罩层样式 */
.image-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85); /* 深色背景 */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999; /* 确保在最上层 */
  backdrop-filter: blur(5px); /* 背景模糊，更有质感 */
}

.overlay-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.full-img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 0 20px rgba(0,0,0,0.5);
}

.overlay-actions {
  margin-top: 20px;
  display: flex;
  gap: 15px;
}

.overlay-btn {
  padding: 10px 25px;
  border-radius: 20px;
  border: none;
  background: #409eff;
  color: white;
  cursor: pointer;
  font-weight: bold;
  transition: 0.3s;
}

.overlay-btn.close {
  background: #909399;
}

.overlay-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.mini-download {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0,0,0,0.6);
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  text-decoration: none;
  
  /* 💡 核心修复：强制显示手型图标 */
  cursor: pointer; 
  
  /* 增加一点交互感 */
  transition: background 0.2s;
  user-select: none; /* 防止点击太快选中文字 */
}

.mini-download:hover {
  background: rgba(0, 0, 0, 0.8);
  color: #409eff; /* 悬浮时变个颜色更直观 */
}

.gallery-link {
  color: #409eff;
  text-decoration: none;
  font-size: 13px;
  cursor: pointer;
  font-weight: bold;
}
.gallery-link:hover {
  text-decoration: underline;
}

/* 放在卡片标题里的清除按钮样式 */
.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clear-cache-btn {
  font-size: 12px;
  font-weight: normal;
  color: #f56c6c; /* 危险红 */
  cursor: pointer;
  padding: 2px 8px;
  border: 1px solid rgba(245, 108, 108, 0.2);
  border-radius: 4px;
  background: rgba(245, 108, 108, 0.05);
  transition: all 0.3s;
}

.clear-cache-btn:hover {
  background: #f56c6c;
  color: #fff;
  border-color: #f56c6c;
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.3);
}

/* 侧边栏整体布局微调，确保滚动条顺滑 */
.session-list-container {
  max-height: 600px;
  overflow-y: auto;
}

/* 容器布局 */
.label-with-tips {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px; /* 根据你之前的布局调整 */
}

.label-with-tips label {
  margin-bottom: 0; /* 抵消掉原有的 margin */
}

/* 问号小图标样式 */
.tips-icon {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 16px;
  height: 16px;
  font-size: 11px;
  color: #909399;
  border: 1px solid #909399;
  border-radius: 50%;
  cursor: help;
  position: relative;
  transition: all 0.2s;
}

.tips-icon:hover {
  color: #409eff;
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.05);
}

/* Tooltip 悬浮框主体 */
.tips-icon::after {
  content: attr(data-tips); /* 读取 HTML 中的 data-tips 属性 */
  position: absolute;
  bottom: 150%; /* 出现在图标上方 */
  left: 50%;
  transform: translateX(-50%) scale(0.9);
  width: 220px; /* 提示框宽度 */
  padding: 10px;
  background: #303133; /* 深色背景 */
  color: #fff;
  font-size: 12px;
  line-height: 1.6;
  border-radius: 6px;
  z-index: 100;
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Tooltip 小箭头 */
.tips-icon::before {
  content: '';
  position: absolute;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #303133;
  opacity: 0;
  transition: all 0.2s;
  z-index: 100;
}

/* 悬停显示逻辑 */
.tips-icon:hover::after,
.tips-icon:hover::before {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}

</style>