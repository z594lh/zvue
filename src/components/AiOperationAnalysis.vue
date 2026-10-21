<template>
  <section class="operation-chat">
    <header class="chat-heading"><div><h3>ERP 与 DeepSeek 的运营会话</h3><p>会话 #{{ conversation.id }} · 记忆 v{{ conversation.context_version }} · {{ usage.round_count || 0 }} 轮分析</p></div><el-tag type="warning" effect="plain">Amazon 正式执行</el-tag></header>
    <p class="chat-tip">资料卡片对应本轮实际发送的数据，可查看或下载；不是另行上传文件。查看记录不会重新调用 AI。</p>
    <div class="chat-thread">
      <article v-for="message in messages" :key="message.id" class="chat-message" :class="message.role">
        <div class="chat-avatar">{{ message.role==='erp'?'ERP':'DS' }}</div>
        <div class="chat-message-content"><div class="chat-message-meta"><strong>{{ message.title }}</strong><span v-if="message.round">第 {{ message.round }} 轮</span><time>{{ conversationTime(message.time) }} 北京时间</time></div>
          <div class="chat-bubble"><div class="message-preview">{{ message.text }}</div><el-button link type="primary" class="message-detail" @click="openMessage(message)">{{ message.text.length>300?'… 详情，查看完整内容':'查看详情与原文' }}</el-button>
            <div v-if="message.files.length" class="chat-files"><button v-for="file in message.files" :key="file.name" type="button" class="chat-file" @click="openFile(file)"><span class="file-icon">{{ file.name.endsWith('.json')?'JSON':'TXT' }}</span><span class="file-name"><strong>{{ file.name }}</strong><small>{{ (file.bytes/1024).toFixed(1) }} KB · 点击查看</small></span><span class="file-arrow">↗</span></button></div>
          </div><small v-if="message.usage" class="chat-usage">输入 {{ message.usage.prompt_tokens ?? '待核实' }} / 输出 {{ message.usage.completion_tokens ?? '待核实' }} token</small>
        </div>
      </article>
    </div>
    <el-empty v-if="!messages.length" description="本次尚无模型调用记录，请稍后刷新详情" />
    <footer class="chat-footer">本次累计输入 {{ usage.prompt_tokens ?? '待核实' }} / 输出 {{ usage.completion_tokens ?? '待核实' }} token · 实际执行结果见“执行与回读”</footer>
    <el-dialog v-model="readingVisible" :title="reading.title" width="min(1000px, calc(100% - 28px))" top="5vh" append-to-body destroy-on-close class="conversation-reading" :close-on-click-modal="false">
      <p v-if="reading.description" class="reading-description">{{ reading.description }}</p>
      <el-tabs v-model="readingTab"><el-tab-pane v-if="reading.text" label="完整内容" name="text"><pre class="reading-content">{{ reading.text }}</pre></el-tab-pane><el-tab-pane label="原始内容" name="raw"><pre class="reading-content raw">{{ reading.raw }}</pre></el-tab-pane></el-tabs>
      <template #footer><el-button @click="downloadReading">下载原始内容</el-button><el-button type="primary" @click="readingVisible=false">关闭</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { buildConversationMessages, conversationTime } from '@/utils/aiOperationConversation.js'
const props=defineProps({plan:{type:Object,required:true}})
// 只读取保存的会话事件，不调用AI或恢复旧单次方案。
const conversation=computed(()=>props.plan.ai_call.prompt.conversation)
const usage=computed(()=>props.plan.usage || {})
const messages=computed(()=>buildConversationMessages(props.plan))
const readingVisible=ref(false),readingTab=ref('text'),reading=ref({title:'',text:'',raw:'',filename:''})

/** 打开问答全文，阅读版与真实原文分别呈现，不渲染模型HTML。 */
function openMessage(message){
  reading.value={title:message.title,text:message.text,raw:message.raw,filename:`会话${conversation.value.id}_消息${message.id}.json`}
  readingTab.value='text';readingVisible.value=true
}

/** 展示实际资料附件，阅读和下载使用同一份保存原文。 */
function openFile(file){
  reading.value={title:file.name,description:file.description,text:'',raw:file.content,filename:file.name}
  readingTab.value='raw';readingVisible.value=true
}

/** 下载原始消息或资料，只生成浏览器本地文件。 */
function downloadReading(){
  const url=URL.createObjectURL(new Blob([reading.value.raw],{type:'text/plain;charset=utf-8'}))
  const link=document.createElement('a');link.href=url;link.download=reading.value.filename;link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
</script>

<style scoped>
.operation-chat{color:#344256}.chat-heading{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}.chat-heading h3{margin:0;font-size:18px;color:#243a55}.chat-heading p,.chat-tip,.chat-footer{font-size:12px;color:#8894a4;line-height:1.8}.chat-tip{margin:14px 0 24px}.chat-thread{display:flex;flex-direction:column;gap:28px}.chat-message{display:flex;gap:12px;max-width:92%;align-self:flex-start;min-width:0}.chat-message.erp{align-self:flex-end;flex-direction:row-reverse}.chat-avatar{display:flex;align-items:center;justify-content:center;width:36px;height:36px;flex-shrink:0;border-radius:10px;color:white;background:#147d75;font-size:12px;font-weight:700}.erp .chat-avatar{background:#4279d8}.chat-message-content{min-width:0;max-width:100%}.chat-message-meta{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 8px;font-size:12px;color:#8d98a6}.chat-message-meta strong{color:#42556d}.erp .chat-message-meta{justify-content:flex-end}.chat-message-meta time{font-size:11px}.chat-bubble{background:white;border:1px solid #e5eaf1;border-radius:2px 14px 14px;padding:17px 20px;box-shadow:0 3px 14px #2d4b7310}.erp .chat-bubble{background:#edf4ff;border-color:#d9e6fa;border-radius:14px 2px 14px 14px}.message-preview{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.85;font-size:14px;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}.message-detail{margin-top:9px;font-size:12px}.chat-files{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}.chat-file{display:flex;align-items:center;gap:10px;text-align:left;background:#ffffffd9;border:1px solid #dce5f0;border-radius:9px;padding:12px;cursor:pointer;min-width:0;max-width:100%;color:#41546d}.chat-file:hover{border-color:#79a4e6;background:white}.file-icon{background:#e8effb;color:#4777b9;padding:8px 5px;font-size:10px;border-radius:5px}.file-name{min-width:0}.file-name strong{font-size:12px;font-weight:550;display:block;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-name small{display:block;color:#99a6b6;margin-top:6px;font-size:11px}.file-arrow{color:#7390b4}.chat-usage{display:block;margin-top:7px;font-size:11px;color:#97a3b3}.chat-footer{border-top:1px solid #e4eaf1;padding-top:18px;margin-top:26px}.reading-content{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;max-height:65vh;overflow:auto;color:#34465e;margin:0;padding:8px;font-family:inherit;font-size:14px}.reading-content.raw{background:#f4f6f9;font-size:12px;font-family:monospace;padding:16px}.reading-description{font-size:12px;color:#7b8ba0}@media(max-width:700px){.chat-message{max-width:100%;gap:8px}.chat-avatar{width:28px;height:28px;font-size:10px}.chat-bubble{padding:13px}.chat-files{flex-direction:column}.chat-file{width:100%}.file-name strong{max-width:160px}.chat-message-meta{gap:5px}.message-preview{font-size:13px}.chat-heading h3{font-size:16px}}
</style>
