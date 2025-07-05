<template>
    <div class="json-tool-container">
      <h1>JSON 格式化工具</h1>
      <!-- 左右布局容器 -->
      <div class="layout-row">
        <!-- 左侧历史记录 -->
        <div class="history-panel">
          <h2>最近操作</h2>
          <div 
            v-for="(item, idx) in history" 
            :key="idx" 
            class="history-item"
            @click="loadHistory(idx)"
          >
            <p class="action">{{ item.action }}</p>
            <p class="time">{{ item.timestamp }}</p>
          </div>
        </div>
        <!-- 右侧 JSON 内容 -->
        <div class="json-panel">
          <label for="json-content">JSON 内容</label>
          <textarea 
            id="json-content" 
            v-model="inputJson" 
            placeholder="请输入 JSON 内容"
            class="json-textarea"
          ></textarea>
          <div class="btn-group">
            <button @click="formatJson" class="btn primary-btn">格式化</button>
            <button @click="removeEscape" class="btn">去除转义</button>
            <button @click="unicodeToChinese" class="btn">Unicode 转中文</button>
            <button @click="chineseToUnicode" class="btn">中文转 Unicode</button>
            <button @click="clearInput" class="btn">清空</button>
            <button @click="copyToClipboard" class="btn primary-btn">复制</button>
          </div>
          <div class="error" v-if="errorMessage">
            <p>错误：{{ errorMessage }}</p>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        inputJson: '',
        history: [],
        errorMessage: '',
        indent: 2
      }
    },
    methods: {
        formatJson() {
        try {
            // 如果以引号开头和结尾，尝试去除
            if (this.inputJson.startsWith('"') && this.inputJson.endsWith('"')) {
                this.inputJson = this.inputJson.slice(1, -1);
                this.inputJson = this.inputJson.replace(/\\"/g, '"');
            }
            const json = JSON.parse(this.inputJson);
            const formattedJson = JSON.stringify(json, null, this.indent);
            this.inputJson = formattedJson;
            this.errorMessage = '';
            this.addToHistory('格式化成功', formattedJson); // 保存格式化后的内容
        } catch (e) {
            this.errorMessage = e.message;
            this.addToHistory(`格式化失败: ${e.message}`, this.inputJson); // 保存当前内容
        }
      },
      removeEscape() {
        try {
            let processed = this.inputJson
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\b/g, '\b')
            .replace(/\\f/g, '\f')
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)))
            .replace(/\\\//g, '/');
            this.inputJson = processed;
            this.errorMessage = '';
            this.addToHistory('去除转义成功', processed); // 保存处理后的内容
        } catch (e) {
            this.errorMessage = e.message;
            this.addToHistory(`去除转义失败: ${e.message}`, this.inputJson); // 保存当前内容
        }
      },
      unicodeToChinese() {
        try {
          this.inputJson = this.inputJson.replace(/\\u([0-9a-fA-F]{4})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
          this.errorMessage = '';
          this.addToHistory(`Unicode 转中文成功`,this.inputJson);
        } catch (e) {
          this.errorMessage = e.message;
          this.addToHistory(`Unicode 转中文失败: ${e.message}`,this.inputJson);
        }
      },
      chineseToUnicode() {
        try {
          this.inputJson = this.inputJson.split('').map(char => {
            const code = char.charCodeAt(0);
            return code > 127 ? `\\u${code.toString(16).padStart(4, '0')}` : char;
          }).join('');
          this.errorMessage = '';
          this.addToHistory(`中文转 Unicode 成功`,this.inputJson);
        } catch (e) {
          this.errorMessage = e.message;
          this.addToHistory(`中文转 Unicode 失败: ${e.message}`,this.inputJson);
        }
      },
      clearInput() {
        this.inputJson = '';
        this.errorMessage = '';
        this.addToHistory(`清空输入`);
      },
      copyToClipboard() {
        navigator.clipboard.writeText(this.inputJson)
          .then(() => {
            this.addToHistory(`复制成功`);
          })
          .catch((e) => {
            this.errorMessage = e.message;
            this.addToHistory(`复制失败: ${e.message}`);
          });
      },
      addToHistory(action, content) {
        const timestamp = new Date();
        this.history.unshift({ action, content, timestamp }); // 存储 content 字段
        if (this.history.length > 10) {
            this.history.pop();
        }
      },
      loadHistory(idx) {
        const item = this.history[idx];
        if (item && item.content) {
            this.inputJson = item.content;
        } else {
            this.inputJson = item.action;
        }
        this.errorMessage = '';
      }
    }
  }
  </script>
  
  <style scoped>
  .json-tool-container {
    width: 90%;
    margin: 0 auto;
    font-family: Arial, sans-serif;
  }
  .layout-row {
    display: flex;
    gap: 20px;
  }
  .history-panel {
    width: 10%;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 15px;
    background-color: #fafafa;
  }
  .history-panel h2 {
    margin-top: 0;
    border-bottom: 1px solid #ddd;
    padding-bottom: 10px;
  }
  .history-item {
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px dashed #ddd;
    cursor: pointer;
  }
  .history-item:hover {
    background-color: #f0f0f0;
  }
  .action {
    margin: 0;
    font-weight: bold;
  }
  .time {
    margin: 0;
    color: #666;
    font-size: 12px;
  }
  .json-panel {
    width: 70%;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 15px;
  }
  .json-textarea {
    width: 100%;
    height: calc(100vh - 300px);
    margin-bottom: 10px;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: none;
  }
  .btn-group {
    display: flex;
    margin-bottom: 20px;
    justify-content: flex-end;
  }
  .btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    transition: background-color 0.3s ease;
    margin-right: 5px;
  }
    /* 默认按钮为灰色 */
  .btn {
    background-color: #6c757d;
  }
  .btn:hover {
    background-color: #5a6268;
  }
    /* 主要按钮为蓝色 */
  .primary-btn {
    background-color: #007bff;
  }

  .primary-btn:hover {
    background-color: #6163eb;
  }
  .error {
    color: red;
    margin-top: 10px;
  }
  </style>