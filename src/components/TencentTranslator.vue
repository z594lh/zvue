<template>
  <div class="translator-container">
    <div class="container">
      <h1>🌐 智能翻译</h1>

      <!-- 统一输入区 -->
      <div id="input-container" class="input-box" :class="{ 'has-image': hasImage }">
        <textarea 
          id="input-text" 
          placeholder="在此输入文字，或复制图片后 Ctrl+V 粘贴..." 
          v-model="inputText"
          @keydown="handleKeydown"
        ></textarea>
        <img id="preview-image" class="preview-image" :src="imageSrc" v-if="hasImage" />
      </div>

      <!-- 控制区 -->
      <div class="controls">
        <select id="source-lang" v-model="sourceLang">
          <option value="auto">自动检测</option>
          <option value="en">英语</option>
          <option value="zh">中文</option>
          <option value="ja">日语</option>
          <option value="ko">韩语</option>
        </select>
        <span>→</span>
        <select id="target-lang" v-model="targetLang">
          <option value="zh">中文</option>
          <option value="en">英语</option>
          <option value="ja">日语</option>
          <option value="ko">韩语</option>
        </select>
        <button @click="doTranslate('machine')">机器翻译</button>
        <button @click="doTranslate('ai')">AI翻译</button>
        <button @click="clearInput" style="background: #ccc;">清除</button>
      </div>

      <!-- 结果展示 -->
      <div class="result-box" id="result-box" v-html="translationResult"></div>
    </div>

    <footer>
      <div class="footer-content">
        <p>Powered by <a :href="authorLink" target="_blank">zhongyw</a></p>
      </div>
    </footer>

    <!-- 加载遮罩 -->
    <div class="loading-overlay" v-if="isLoading">
      <div class="loading-spinner"></div>
    </div>
  </div>
</template>

<script>

import { 
  getConfig, 
  translateText, 
  translateImage, 
  translateAIText, 
  translateAIImage 
} from '@/services/api';


export default {
  name: 'TencentTranslator',
  data() {
    return {
      inputText: '',
      sourceLang: 'auto',
      targetLang: 'zh',
      translationResult: '翻译结果显示在这里', // 定义翻译结果变量
      imageBase64: '',
      imageSrc: '',
      hasImage: false,
      isLoading: false,
      authorLink: '#' // 请替换为实际链接
    }
  },
  created() {
    // 监听粘贴事件
    document.addEventListener('paste', this.handlePaste);
    this.fetchConfig();
  },
  beforeUnmount() {
    // 移除事件监听
    document.removeEventListener('paste', this.handlePaste);
  },
  methods: {
    async fetchConfig() {
      try {
        const response = await getConfig();
        this.authorLink = response.data.author_link;
      } catch (error) {
        console.error('获取配置失败:', error);
      }
    },
    // 处理键盘事件（主要是 Enter 提交）
    handleKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.doTranslate(); // 按下 Enter 直接翻译
      }
    },

    // 清除输入内容
    clearInput() {
      this.inputText = '';
      this.imageBase64 = '';
      this.imageSrc = '';
      this.hasImage = false;
      this.translationResult = ''; // 清空翻译结果
    },

    // 处理粘贴事件
    handlePaste(e) {
      const items = (e.clipboardData || window.clipboardData).items;
      for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault(); // 阻止默认粘贴行为
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (event) => {
            this.imageBase64 = event.target.result.split(',')[1]; // 去掉前缀
            this.imageSrc = event.target.result;
            this.hasImage = true;
            this.inputText = ''; // 清空文本
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    },

    // 判断是否中文主导
    isChineseDominant(text, threshold = 0.5) {
      const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
      const totalChars = text.replace(/\s+/g, '').length;
      if (totalChars === 0) return false;
      return chineseChars.length / totalChars >= threshold;
    },

    // 判断是否英文主导
    isEnglishDominant(text, threshold = 0.7) {
      const englishChars = text.replace(/[\u4e00-\u9fa5\s]+/g, '').length;
      const totalChars = text.replace(/\s+/g, '').length;
      if (totalChars === 0) return false;
      return englishChars / totalChars >= threshold;
    },

    // 执行翻译
    async doTranslate(type = 'machine') {
      // 验证输入
      if (!this.inputText && !this.imageBase64) {
        alert("请输入文字或粘贴图片");
        return;
      }

      // 显示加载状态
      this.isLoading = true;
      this.translationResult = '翻译中...'; // 显示加载状态

      let target = this.targetLang;
      let isImage = this.hasImage;

      // 自动根据文本内容调整目标语言
      if (!isImage && this.sourceLang === 'auto') {
        if (this.isChineseDominant(this.inputText)) {
          // 中文主导，且目标语言是中文，则默认翻译成英文
          if (target === 'zh') {
            target = 'en';
            this.targetLang = 'en';
          }
        } else if (this.isEnglishDominant(this.inputText)) {
          // 英文主导，且目标语言是英文，则默认翻译成中文
          if (target === 'en') {
            target = 'zh';
            this.targetLang = 'zh';
          }
        }
      }

      try {
        let response;
        
        if (type === 'ai') {
          if (isImage) {
            // 调用 AI 图片翻译 API
            response = await translateAIImage(this.imageBase64, this.sourceLang, target);
          } else {
            // 调用 AI 文本翻译 API
            response = await translateAIText(this.inputText, this.sourceLang, target);
          }
        } else {
          if (isImage) {
            // 调用普通图片翻译 API
            response = await translateImage(this.imageBase64, this.sourceLang, target);
          } else {
            // 调用普通文本翻译 API
            response = await translateText(this.inputText, this.sourceLang, target);
          }
        }

        // 处理响应
        if (response.data && response.data.translated) {
          this.translationResult = response.data.translated;
        } else {
          this.translationResult = "翻译失败，请重试";
        }
      } catch (err) {
        console.error('翻译错误:', err);
        this.translationResult = "翻译出错，请查看控制台";
      } finally {
        this.isLoading = false;
      }

    }
  }
}
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex; /* 添加 flex 显示 */
  justify-content: center;
  align-items: center;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 6px solid #f3f3f3;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

footer {
  margin-top: auto;
  padding: 1rem 0;
  width: 100%;
}

.footer-content {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  padding: 0 1rem; /* 防止内容紧贴屏幕边缘 */
}

footer a {
  color: #42b983;
  text-decoration: none;
  transition: color 0.3s;
}

footer a:hover {
  color: #359e75;
  text-decoration: underline;
}
/* 基础样式 */
.translator-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  padding: clamp(0.5rem, 3vw, 1.5rem); /* 使用clamp函数动态调整内边距 */
}

.container {
  width: 100%;
  max-width: clamp(300px, 90vw, 1000px); /* 动态调整最大宽度 */
  margin: 0 auto;
  background: white;
  padding: clamp(1rem, 3vw, 2rem); /* 动态调整内边距 */
  border-radius: clamp(8px, 2vw, 16px); /* 动态调整圆角 */
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  box-sizing: border-box;
}

h1 {
  font-size: clamp(1.5rem, 4vw, 2.5rem); /* 动态调整标题大小 */
  text-align: center;
  color: #333;
  margin-bottom: 1.5rem;
}

/* 输入框样式 */
.input-box {
  border: 2px dashed #ccc;
  padding: clamp(1rem, 2vw, 1.5rem); /* 动态调整内边距 */
  min-height: clamp(150px, 30vh, 300px); /* 动态调整最小高度 */
  position: relative;
  cursor: text;
  transition: 0.3s;
  background: #fafafa;
  border-radius: clamp(8px, 1.5vw, 12px); /* 动态调整圆角 */
}

.input-box textarea {
  width: 100%;
  height: clamp(150px, 25vh, 250px); /* 动态调整高度 */
  font-size: clamp(1rem, 2vw, 1.2rem); /* 动态调整字体大小 */
  padding: 1rem;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  display: block;
}

/* 按钮和选择器样式 */
.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: clamp(1rem, 2vw, 1.5rem); /* 动态调整间距 */
  flex-wrap: wrap;
  gap: clamp(0.5rem, 1vw, 1rem); /* 动态调整元素间距 */
}

select {
  font-size: clamp(1rem, 1.5vw, 1.1rem); /* 动态调整字体大小 */
  padding: clamp(0.5rem, 1vw, 0.7rem); /* 动态调整内边距 */
  border-radius: 4px;
  border: 1px solid #ccc;
}

button {
  padding: clamp(0.7rem, 1.5vw, 1rem) clamp(1rem, 3vw, 1.5rem); /* 动态调整按钮大小 */
  font-size: clamp(1rem, 1.5vw, 1.1rem); /* 动态调整字体大小 */
  cursor: pointer;
  border: none;
  border-radius: 4px;
  background-color: #42b983;
  color: white;
  transition: background-color 0.3s;
}

/* 结果区域样式 */
.result-box {
  margin-top: clamp(1rem, 2vw, 1.5rem); /* 动态调整间距 */
  padding: clamp(1rem, 2vw, 1.5rem); /* 动态调整内边距 */
  background: #f1f1f1;
  border-radius: clamp(8px, 1.5vw, 12px); /* 动态调整圆角 */
  min-height: clamp(100px, 15vh, 200px); /* 动态调整最小高度 */
  white-space: pre-wrap;
  font-size: clamp(1rem, 1.5vw, 1.1rem); /* 动态调整字体大小 */
}

/* 图片预览样式 */
.preview-image {
  max-width: 100%;
  max-height: clamp(150px, 30vh, 400px); /* 动态调整最大高度 */
  margin-top: 1rem;
  display: block;
  border-radius: 6px;
}

/* 响应式调整 - 针对极小屏幕 */
@media (max-width: 360px) {
  .controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  select, button {
    width: 100%;
    margin-bottom: 0.5rem;
  }
}

.input-box.has-image textarea {
  display: none;
}

.input-box.has-image .preview-image {
  display: block;
}
</style>