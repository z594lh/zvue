<template>
  <details class="tool-rounds" @toggle="toggle">
    <summary>分析过程 · 按轮查看<span v-if="info">{{ info.model_rounds }} 轮AI请求 · {{ info.tool_calls }} 次工具调用</span></summary>
    <section class="round-list" v-loading="loading">
      <div class="round-toolbar"><small>{{ info?.note || '展开后只读已保存的查询过程，不重新调用AI。' }}</small><div><el-button link @click="original(messageId,'当前关联消息原文')">关联消息原文</el-button><el-button link type="primary" :loading="loading" @click="load">刷新过程</el-button></div></div>
      <el-alert v-if="error" :title="error" type="error" :closable="false"/>
      <el-alert v-if="info?.truncated" title="记录较多，仅展示部分；请查看原始记录核对完整过程。" type="warning" :closable="false"/>
      <p v-if="info && !info.list.length" class="empty">尚无模型请求记录；可能还在排队或资料准备阶段。</p>
      <article v-for="round in info?.list || []" :key="round.round" class="round-card">
        <header><strong>{{ round.has_request?`第 ${round.round} 轮`:'系统结束记录' }}</strong><time>{{ time(round.created_at) }} 北京时间</time></header>
        <div class="round-speech"><small>AI公开回复</small><p :class="{clamped:!expanded[round.round]}">{{ round.text || (round.tools.length?'本轮未附加文字，直接请求了以下工具。':'本轮没有公开回复正文。') }}</p><el-button v-if="round.text.length>500" link type="primary" @click="expanded[round.round]=!expanded[round.round]">{{ expanded[round.round]?'收起':'展开回复' }}</el-button><el-button v-if="round.text_truncated" link type="primary" @click="original(round.response_id,'完整AI回复')">回复超过展示上限 · 查看完整原文</el-button></div>
        <el-alert v-if="round.error_code" :title="round.message || '本轮未完成，请查看原文'" type="warning" :closable="false"/>
        <div v-if="round.tools.length" class="round-tools"><small>实际调用的工具</small>
          <div v-for="call in round.tools" :key="call.id" class="tool-call"><div class="tool-title"><strong>{{ call.label }}</strong><el-tag size="small" :type="tone(call.status)">{{ status(call.status) }}</el-tag></div><p>{{ call.query }}</p><small>{{ call.returned==null?'返回数量未记录':`返回 ${call.returned} 条` }} · {{ bytes(call.result_bytes,call.bytes_estimated) }} · {{ call.elapsed_ms==null?'耗时未记录':`工具耗时 ${call.elapsed_ms} ms` }}</small><p v-if="call.message" class="tool-result">{{ call.message }}</p>
            <ul v-if="call.children?.length" class="query-children"><li v-for="(child,index) in call.children" :key="index"><strong>{{ child.label }}</strong><span>{{ child.query }}</span><el-tag size="small" :type="tone(child.status)">{{ status(child.status) }}</el-tag><small v-if="child.returned!=null">{{ child.returned }} 条</small><p v-if="child.message">{{ child.message }}</p></li></ul>
          </div>
        </div>
        <p v-else class="empty">本轮没有工具调用。</p>
        <footer><small v-if="round.has_request">输入 {{ number(round.usage.prompt_tokens) }} / 输出 {{ number(round.usage.completion_tokens) }} token · 缓存命中 {{ number(round.usage.prompt_cache_hit_tokens) }}</small><div><el-button v-if="round.request_id" link @click="original(round.request_id,'ERP请求与上下文')">ERP请求原文</el-button><el-button v-if="round.response_id" link @click="original(round.response_id,'AI公开回复与工具请求')">AI回复原文</el-button><el-button v-if="round.result_id" link @click="original(round.result_id,'工具查询返回')">工具返回原文</el-button></div></footer>
      </article>
    </section>
  </details>
</template>

<script setup>
import { onBeforeUnmount,ref,watch } from 'vue'
import { getAiToolRounds } from '@/services/api'
import { conversationTime as time } from '@/utils/aiOperationConversation'
const props=defineProps({sessionId:{type:String,required:true},messageId:{type:String,required:true},version:{type:String,default:''}})
const emit=defineEmits(['original']),opened=ref(false),loading=ref(false),error=ref(''),info=ref(null),expanded=ref({})
let active=true,revision=0
/** 读取完整作业的真实轮次，不受外层聊天20条分页影响，也不触发模型请求。 */
async function load(){const id=++revision;loading.value=true;error.value='';try{const {data}=await getAiToolRounds(props.sessionId,props.messageId);if(active && revision===id)info.value=data.data}catch(e){if(active && revision===id)error.value=e.response?.data?.message || '分析过程读取失败'}finally{if(active && revision===id)loading.value=false}}
/** 只有展开时加载过程，默认关闭不下发大量明细。 */
function toggle(event){if(event.target!==event.currentTarget)return;opened.value=event.target.open;if(opened.value)load()}
/** 已展开且真实事件版本变化时刷新；不建立额外轮询或自动重试。 */
function changed(){if(opened.value)load()}
/** 显式点击后由外层原文弹框读取所属消息，正文仍保持折叠。 */
function original(id,title){emit('original',{id,attachment_name:title+'.json'})}
/** 缺失token保持未知，不把无回执视为零费用。 */
function number(value){return value==null?'未知':Number(value).toLocaleString()}
/** 工具字节只是返回体积，历史估算与实际测量分开，不冒充token。 */
function bytes(value,estimated){return value==null?'数据量未记录':`${estimated?'约 ':''}${(value/1024).toFixed(1)} KB`}
/** 只把真实工具状态翻译为中文，不认定计划校验等于执行成功。 */
function status(value){return {provided:'已返回',validated:'方案校验通过',error:'查询/校验失败',too_large:'结果超限',unavailable:'没有可用资料',disabled:'工具已关闭',pending:'尚无返回',partial:'部分返回'}[value] || value}
/** 失败/缺失醒目区分，成功查询不意味着实际平台修改。 */
function tone(value){return ['provided','validated'].includes(value)?'success':['error','too_large'].includes(value)?'danger':'info'}
/** 销毁后使迟到请求失效，避免切换会话显示旧商品过程。 */
function stop(){active=false;revision++}
watch(()=>props.version,changed);onBeforeUnmount(stop)
</script>

<style scoped>
.tool-rounds{margin-top:15px;border-top:1px solid #dfe7f4;padding-top:12px;color:#42618a;font-size:12px}.tool-rounds>summary{cursor:pointer;font-weight:600;color:#397bc1;line-height:1.8}.tool-rounds>summary span{font-size:10px;font-weight:400;margin-left:10px;color:#8a9db9}.round-list{margin-top:12px;min-height:50px}.round-toolbar{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;color:#8a9db9;line-height:1.7}.round-card{border:1px solid #dde7f3;background:#fff;border-radius:9px;margin-top:12px;padding:14px}.round-card>header{display:flex;justify-content:space-between;gap:8px;align-items:center}.round-card time{font-size:10px;color:#8b9bb2}.round-speech{margin:12px 0;background:#f6f9fd;padding:10px 12px;border-radius:6px}.round-speech p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;margin:5px 0 0}.clamped{display:-webkit-box;-webkit-line-clamp:8;-webkit-box-orient:vertical;overflow:hidden}.round-speech small,.round-tools>small{font-size:10px;color:#8b9bb2}.tool-call{border-left:3px solid #adcaf2;padding:10px 12px;margin-top:9px;background:#fafcff;overflow-wrap:anywhere}.tool-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.tool-call p{line-height:1.8;margin:7px 0}.tool-call>small,.round-card footer>small{color:#899db7;font-size:10px}.tool-result{color:#5b7392}.query-children{padding-left:18px;font-size:11px}.query-children li{margin-top:9px;line-height:1.8}.query-children span{margin:0 7px;color:#8093ae}.query-children p{margin:2px 0}.round-card footer{margin-top:12px;border-top:1px solid #edf1f7;padding-top:9px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.round-card footer .el-button{font-size:10px}.empty{font-size:11px;color:#8b9bb2;line-height:1.8}@media(max-width:650px){.round-card{padding:10px}.round-card>header{align-items:flex-start;flex-direction:column}.round-toolbar{flex-wrap:wrap}.tool-rounds>summary span{display:block;margin-left:14px}.query-children{padding-left:12px}}
</style>
