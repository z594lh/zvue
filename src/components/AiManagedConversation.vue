<template>
  <section class="managed-chat" v-loading="loading">
    <header class="chat-top">
      <div><strong>{{ product.product_name || '托管商品' }} · {{ product.asin }}</strong><small>{{ product.shop_name || '' }} · 所有获授AI托管权限的运营人员共享此对话</small></div>
      <div><el-button :disabled="loading || creating" @click="refresh">刷新</el-button><el-button type="primary" :loading="creating" :disabled="loading || sending || pendingTasks.length>0" @click="createNew">＋ 新对话</el-button></div>
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="chat-layout">
      <aside class="chat-sessions">
        <span class="section-caption">历史对话</span>
        <button v-for="item in sessions" :key="item.id" class="session-item" :class="{selected:item.id===selectedId}" @click="select(item.id)">
          <strong>{{ item.title || `运营会话 ${item.generation}` }}</strong><el-tag size="small" :type="item.state==='active'?'success':'info'">{{ item.state==='active'?'当前':'已归档' }}</el-tag>
          <small>创建 {{ time(item.created_at) }}</small><small>最近 {{ time(item.last_message_at || item.updated_at) }}</small>
        </button>
        <el-button v-if="moreSessions" link :disabled="loading" @click="loadSessions(true)">更早的会话</el-button>
      </aside>
      <main class="chat-main">
        <div class="chat-context" v-if="session"><strong>{{ session.title || `运营会话 ${session.generation}` }}</strong><span>记忆 v{{ session.revision }} · {{ session.state==='archived'?'只读归档':'当前共享对话' }}</span><el-tag v-if="session.daily_baseline_pending" type="warning" size="small">下次例行将重新初始化完整基础资料</el-tag></div>
        <div ref="scroller" class="chat-scroll">
          <el-button v-if="moreMessages" link :loading="messagesLoading" @click="loadMessages(true)">加载更早消息</el-button>
          <el-empty v-if="!items.length && !messagesLoading" :description="session?'新会话尚无消息；下次每日例行将在这里留下记录':'暂无会话，可新建或等待下一次每日例行'" />
          <template v-for="(item,index) in timeline" :key="item.id">
            <div v-if="!index || day(item.created_at)!==day(timeline[index-1].created_at)" class="chat-day">{{ day(item.created_at) }} · 北京时间</div>
            <article class="shared-message" :class="[item.role,{'technical-message':item.auxiliary}]" :data-message-id="item.id">
              <span v-if="!item.auxiliary" class="shared-avatar">{{ item.role==='assistant'?'DS':item.role==='user'?'人':'ERP' }}</span>
              <div class="shared-content"><div v-if="!item.auxiliary" class="message-meta"><strong>{{ item.title }}</strong><el-tag v-if="item.task?.chat_mode && item.role==='user'" size="small" :type="item.task.chat_mode==='discussion'?'info':'warning'">{{ item.task.chat_mode==='discussion'?'讨论':'优化方案' }}</el-tag><time>{{ time(item.created_at) }} 北京时间</time><small v-if="item.actor && item.role==='erp'">授权/发起人：{{ item.actor }}</small></div>
                <div class="shared-bubble"><div v-if="item.text" class="message-body" :class="{collapsed:!expanded[item.id]}">{{ item.text }}</div><el-button v-if="item.text.length>500" link type="primary" @click="expanded[item.id]=!expanded[item.id]">{{ expanded[item.id]?'收起':'… 展开完整内容' }}</el-button>
                  <small v-if="item.questionPreview" class="attachment-note">以上为实际提问的自然语言摘要，完整提问与约束可在下方展开。</small>
                  <p v-if="item.error_note" class="reply-warning">{{ item.error_note }}</p>
                  <div v-if="item.task && item.role==='user' && item.task.status!=='completed'" class="human-task-state"><el-tag size="small" :type="taskType(item.task.status)">{{ taskName(item.task) }}</el-tag><span>{{ item.task.message }}</span><el-button v-if="!terminal(item.task.status)" link type="warning" @click="cancelTask(item.task)">{{ item.task.status==='queued'?'取消排队':'停止后续分析' }}</el-button></div>
                  <el-button v-if="item.role==='user' && item.event_type==='user_message' && item.task?.status==='failed' && item.task.error_code==='invalid_output' && item.task.chat_mode!=='discussion'" link type="primary" :disabled="!canCompose || !worker.online || sending || !!retryToken" @click="regenerate(item)">重新生成方案（新请求，可能计费）</el-button>
                  <AiActionConfirmation v-if="item.task?.status==='completed' && item.task.result?.type==='propose_plan' && item.task.result.response_message_id===item.id" :task="item.task" :viewer-id="viewerId" :current="session?.state==='active' && selectedId===currentId" :enabled="!!product.enabled" :worker-online="!!worker.online" @updated="poll" />
                  <details v-if="item.documentSources.length" class="bound-documents"><summary>资料与规则附件（{{ item.documentCounts.included }} 份组入请求 / {{ item.documentCounts.archived }} 份仅归档）</summary><section v-for="source in item.documentSources" :key="source.id" class="document-source"><small>{{ source.title }} · 第 {{ source.round }} 轮 · {{ time(source.created_at) }}</small><button v-for="doc in source.documents" :key="doc.id" class="message-file" @click="readDocument(source,doc)"><span>{{ doc.kind==='rule'?'规则':doc.kind==='history'?'历史':'资料' }}</span><strong>{{ doc.name }}</strong><small>{{ doc.delivery==='archived'?'仅归档 · 未发送':'本轮组入请求' }} · {{ (doc.byte_count/1024).toFixed(1) }} KB ↗</small></button></section></details>
                  <details class="message-inspector"><summary>{{ item.auxiliary?'本轮资料与分析过程':'上下文与原始 JSON' }}<small>（{{ item.records.length }} 条原始记录）</small></summary><section v-for="record in item.records" :key="record.id" class="audit-record"><header><strong>{{ record.title }}</strong><time>{{ time(record.created_at) }} 北京时间</time></header><details v-if="record.text" class="record-content"><summary>展开完整提问／记录正文</summary><div class="technical-content">{{ record.text }}</div></details><p v-if="record.interaction" class="attachment-note">配置 {{ record.interaction.version_id?'#'+record.interaction.version_id:'系统初始版' }} · {{ record.delivery_note }}</p><small v-if="record.usage" class="message-usage">输入 {{ record.usage.prompt_tokens ?? '未知' }} / 输出 {{ record.usage.completion_tokens ?? '未知' }} token<template v-if="record.usage.prompt_cache_hit_tokens!=null"> · 缓存命中 {{ record.usage.prompt_cache_hit_tokens }}</template></small><button class="message-file" @click="readOriginal(record)"><span>JSON</span><strong>{{ record.attachment_name }}</strong><small>查看完整请求、上下文与原始记录 ↗</small></button></section></details>
                </div>
              </div>
            </article>
          </template>
        </div>
        <button v-if="newMessages" class="new-messages" @click="scrollBottom">有新消息 · 点击查看</button>
        <footer class="chat-composer">
          <div class="worker-status"><span :class="{online:worker.online}">{{ worker.online?'● AI后台在线':'○ AI后台未在线' }}</span><small v-if="!worker.online">{{ worker.message || '请管理员部署独立AI会话消费者' }}</small><small v-if="worker.last_heartbeat_at">最近心跳 {{ time(worker.last_heartbeat_at) }}</small><small v-if="pendingTasks.length">{{ pendingTasks.length }} 个作业排队 / 处理中，关闭页面后继续</small></div>
          <div v-if="pendingTasks.length" class="shared-queue"><div v-for="task in pendingTasks" :key="task.id"><span>{{ task.task_type==='daily'?'每日优化':task.task_type==='execute'?'确认执行':task.chat_mode==='discussion'?'人工讨论':'生成方案' }} #{{ task.id }} · {{ taskName(task) }}</span><el-button link type="warning" @click="cancelTask(task)">{{ task.status==='queued'?'取消排队':'停止后续步骤' }}</el-button></div></div>
          <div class="chat-mode"><el-radio-group v-model="mode" size="small" :disabled="!canCompose || sending || !!retryToken" @change="persistDraft"><el-radio-button label="discussion">讨论</el-radio-button><el-radio-button label="proposal">生成优化方案</el-radio-button></el-radio-group><el-tooltip :content="mode==='discussion'?'默认模式：一次自然语言回答，带共享记忆和轻量资料；不携带整套执行规范，不生成执行卡片。':'携带运营规则、Listing规范和完整方案协议，最多3轮补查或纠错；允许只观察，修改仍须选择并明确确认。'" placement="top"><span class="mode-help" tabindex="0">?</span></el-tooltip><small>{{ mode==='discussion'?'接着聊，不生成执行方案':'形成行动清单，确认后才执行' }}</small></div>
          <el-input v-model="draft" type="textarea" :rows="2" :maxlength="4000" :disabled="!canCompose || sending" :placeholder="session?.state==='archived'?'旧对话只读，请切换当前对话':'输入问题，例如：昨天的标题为什么这样修改？Enter发送，Shift+Enter换行'" @input="persistDraft" @keydown="onKeydown" />
          <div class="composer-actions"><small>{{ session?.state==='archived'?'已归档，只能查看':mode==='discussion'?'讨论为1次AI调用，可能计费；共享历史，平台不会修改。':product.enabled===false?'托管已暂停：可分析，但建议不能执行':'方案最多3轮AI调用，可能计费；须选择并明确确认才执行。' }}</small><el-button type="primary" :loading="sending" :disabled="!canSend" @click="send">{{ mode==='discussion'?'发送':'生成方案' }}</el-button></div>
          <el-button v-if="retryToken" link type="warning" :disabled="sending" @click="retrySend">上次发送结果未知 · 用原标识核对（不重复登记）</el-button>
        </footer>
      </main>
    </div>
    <el-dialog v-model="originalVisible" :title="originalTitle" width="min(1050px, calc(100% - 24px))" top="5vh" append-to-body destroy-on-close :close-on-click-modal="false"><pre v-loading="originalLoading" class="original-content">{{ originalText }}</pre><template #footer><el-button :disabled="originalLoading || !originalText" @click="download">下载原文</el-button><el-button type="primary" @click="originalVisible=false">关闭</el-button></template></el-dialog>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { getAiConversations, getAiConversationMessages, getAiConversationOriginal, createAiConversation, getAiConversationDocument, sendAiConversationMessage, getAiChatTask, cancelAiChatTask } from '@/services/api'
import { conversationTime } from '@/utils/aiOperationConversation'
import AiActionConfirmation from '@/components/AiActionConfirmation.vue'
import { buildChatTimeline } from '@/utils/aiChatPresentation'
const props=defineProps({product:{type:Object,required:true},initialSessionId:{type:String,default:''},initialPlanId:{type:String,default:''}})
const loading=ref(false),creating=ref(false),messagesLoading=ref(false),error=ref(''),sessions=ref([]),selectedId=ref(''),currentId=ref(null),items=ref([]),moreSessions=ref(false),moreMessages=ref(false),expanded=ref({}),scroller=ref(null)
const originalVisible=ref(false),originalLoading=ref(false),originalTitle=ref(''),originalText=ref('')
const downloadName=ref('原始消息.json')
const session=computed(()=>sessions.value.find(r=>r.id===selectedId.value))
const timeline=computed(()=>buildChatTimeline(items.value))
const worker=ref({online:false}),capabilities=ref({human_chat:false}),draft=ref(''),sending=ref(false),pendingTasks=ref([]),newMessages=ref(false),retryToken=ref(null)
const viewerId=ref('')
const mode=ref('discussion')
const canCompose=computed(()=>capabilities.value.human_chat && session.value?.state==='active' && selectedId.value===currentId.value)
const canSend=computed(()=>canCompose.value && worker.value.online && draft.value.trim() && !sending.value && !retryToken.value)
let active=true,messageRevision=0,originalRevision=0
let timer=null,polling=false
const time=conversationTime
/** 统一按北京时间分组，不用服务器日期或浏览器本地时区。 */
function day(value){return time(value).split(' ')[0]}
/** 提取业务错误文本，不在页面输出完整异常对象或凭证。 */
function failure(e){return e.response?.data?.message || '会话读取失败，请稍后刷新'}
/** 分页列出已保存会话；打开弹框本身不创建会话或调用AI。 */
async function loadSessions(older=false){
  const {data}=await getAiConversations(props.product.id,older?{before_id:sessions.value.at(-1)?.id}:{})
  if(!active)return
  sessions.value=older?[...sessions.value,...data.data.list]:data.data.list;moreSessions.value=data.data.has_more;currentId.value=data.data.current_id
  persistDraft();viewerId.value=data.data.viewer_id || '';worker.value=data.data.worker || {online:false};capabilities.value=data.data.capabilities || {};restoreDraft()
}
/** 选择不同会话时使上一会话未返回的读取失效。 */
async function select(id){persistDraft();selectedId.value=id;items.value=[];expanded.value={};pendingTasks.value=[];newMessages.value=false;retryToken.value=null;restoreDraft();await loadMessages()}
/** 分页读取消息，并在向上加载时保留用户原来的阅读位置。 */
async function loadMessages(older=false){
  if(!selectedId.value)return
  const revision=++messageRevision;messagesLoading.value=true;error.value=''
  const previous=scroller.value?.scrollHeight || 0,scrollTop=scroller.value?.scrollTop || 0
  try{
    const {data}=await getAiConversationMessages(selectedId.value,older?{before_id:items.value[0]?.id}:{})
    if(!active || revision!==messageRevision)return
    items.value=older?[...data.data.list,...items.value]:data.data.list;moreMessages.value=data.data.has_more
    pendingTasks.value=data.data.pending_tasks || []
    await nextTick()
    if(scroller.value)scroller.value.scrollTop=older?scrollTop+scroller.value.scrollHeight-previous:scroller.value.scrollHeight
    return true
  }catch(e){if(active && revision===messageRevision)error.value=failure(e);return false}
  finally{if(active && revision===messageRevision)messagesLoading.value=false}
}
/** 刷新仅做只读查询，历史链接可指定会话及关联方案。 */
async function refresh(){
  if(loading.value)return
  loading.value=true;error.value=''
  try{
    await loadSessions()
    while(active && props.initialSessionId && !sessions.value.some(s=>s.id===props.initialSessionId) && moreSessions.value)await loadSessions(true)
    if(!active)return
    const wanted=selectedId.value || props.initialSessionId || currentId.value || sessions.value[0]?.id
    if(wanted && sessions.value.some(s=>s.id===wanted))await select(wanted)
    if(props.initialPlanId){
      while(active && moreMessages.value && !items.value.some(m=>m.plan_id===props.initialPlanId)){if(!await loadMessages(true))break}
      await nextTick()
      const target=items.value.find(m=>m.plan_id===props.initialPlanId)
      if(target)scroller.value?.querySelector(`[data-message-id="${target.id}"]`)?.scrollIntoView({block:'start'})
    }
  }catch(e){if(active)error.value=failure(e)}
  finally{if(active)loading.value=false}
}
/** 用户明确确认后切换共享代次，保留原记录和观察，不重新运行今天。 */
async function createNew(){
  try{await ElMessageBox.confirm('将为该ASIN的所有授权用户和ERP切换新对话。旧问答只读保留，真实操作及待观察事项不删除；下一次每日例行重新提供完整基础资料，不会重复运行今天。','新建共享对话',{confirmButtonText:'确认新建',cancelButtonText:'取消',type:'warning',closeOnClickModal:false})}catch{return}
  creating.value=true;error.value=''
  try{const {data}=await createAiConversation(props.product.id,{expected_current_id:currentId.value,confirm_new:true});if(active){selectedId.value=data.data.id;items.value=[];await refresh()}}
  catch(e){if(active)error.value=failure(e)}
  finally{if(active)creating.value=false}
}
/** 点击附件才读取真实原文；会话切换/关闭不会将迟到内容显示成另一条消息。 */
async function readOriginal(item){
  downloadName.value='原始消息.json'
  const revision=++originalRevision;originalVisible.value=true;originalLoading.value=true;originalTitle.value=item.attachment_name;originalText.value=''
  try{const {data}=await getAiConversationOriginal(selectedId.value,item.id);if(active && revision===originalRevision)originalText.value=JSON.stringify(data.data,null,2)}
  catch(e){if(active && revision===originalRevision)originalText.value=failure(e)}
  finally{if(active && revision===originalRevision)originalLoading.value=false}
}
/** 附件按会话、消息和绑定编号读取，不实时生成当前数据冒充原附件。 */
async function readDocument(item,doc){
  const revision=++originalRevision;originalVisible.value=true;originalLoading.value=true;originalTitle.value=doc.name;originalText.value='';downloadName.value=doc.name
  try{const {data}=await getAiConversationDocument(selectedId.value,item.id,doc.id);if(active && revision===originalRevision){originalText.value=data.data.text;originalTitle.value=doc.name+' · '+(doc.delivery==='archived'?'仅归档未发送':'组入本轮请求')+' · SHA256 '+data.data.hash}}
  catch(e){if(active && revision===originalRevision)originalText.value=failure(e)}
  finally{if(active && revision===originalRevision)originalLoading.value=false}
}
/** 原文下载只在浏览器生成文件，不触发上传或模型请求。 */
function download(){const url=URL.createObjectURL(new Blob([originalText.value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=downloadName.value;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
/** 按登录人、店铺、ASIN和会话隔离草稿；未知用户时只保留内存，不共用本地缓存。 */
function draftKey(){return viewerId.value && selectedId.value?`ai-chat-draft:${viewerId.value}:${props.product.shop_id}:${props.product.asin}:${selectedId.value}`:null}
/** 只保存文字草稿及尚待核对的原发送标识，刷新不自动发请求。 */
function persistDraft(){try{const key=draftKey();if(key)localStorage.setItem(key,JSON.stringify({text:draft.value,mode:mode.value,retry:retryToken.value}))}catch{/* 浏览器不允许本地缓存时不影响服务端消息 */}}
/** 恢复当前范围草稿，不把另一个用户或会话的文字带进来。 */
function restoreDraft(){try{const key=draftKey();const value=key?JSON.parse(localStorage.getItem(key) || 'null'):null;draft.value=value?.text || '';retryToken.value=value?.retry || null;mode.value=(retryToken.value?.mode || value?.mode)==='proposal'?'proposal':'discussion'}catch{draft.value='';retryToken.value=null;mode.value='discussion'}}
/** 区分中文输入法确认与真正Enter，Shift+Enter保持换行。 */
function onKeydown(event){if(event.key==='Enter' && !event.shiftKey && !event.isComposing && event.keyCode!==229){event.preventDefault();send()}}
/** 新问题先由用户确认可能计费，不接受聊天文字代替平台修改授权。 */
async function send(){
  if(!canSend.value)return
  const selection={mode:mode.value,text:draft.value,sessionId:selectedId.value}
  try{await ElMessageBox.confirm(selection.mode==='discussion'?'将带共享记忆和轻量本地资料，进行1次自然语言讨论，可能计费。不生成可执行方案，也不会修改Listing或广告。':'将带运营规则、Listing规范和资料，最多3轮生成方案，可能计费。允许只观察，具体改动仍须你选择并明确确认；不会自动修改平台。',selection.mode==='discussion'?'发送讨论':'生成优化方案',{confirmButtonText:'确认发送（可能计费）',cancelButtonText:'取消',type:'info',closeOnClickModal:false})}catch{return}
  if(!canSend.value || selection.sessionId!==selectedId.value || selection.mode!==mode.value || selection.text!==draft.value)return
  const token=crypto.randomUUID().replaceAll('-','');retryToken.value={token,...selection};persistDraft();await submitPending()
}
/** 只有已明确格式失败的方案才能主动新建请求；不重放原任务，不用于超时/未知状态。 */
async function regenerate(item){
  if(draft.value.trim()){try{await ElMessageBox.confirm('将用这条原问题替换当前输入框草稿，原失败记录保持不变。','准备重新生成',{confirmButtonText:'替换草稿',cancelButtonText:'取消'})}catch{return}}
  mode.value='proposal';draft.value=item.text;persistDraft();await send()
}
/** 使用原token核对超时发送，服务端同一原话只登记一次；不会自动重发收费任务。 */
async function retrySend(){if(retryToken.value)await submitPending()}
/** 登记任务后清草稿；HTTP超时保留原标识与原话，切会话的迟到响应不污染当前输入。 */
async function submitPending(){
  const request=retryToken.value;if(!request || sending.value)return
  sending.value=true;error.value=''
  try{const {data}=await sendAiConversationMessage(request.sessionId,{text:request.text,request_token:request.token,confirm_ai:true,...(request.mode?{mode:request.mode}:{})});if(!active || selectedId.value!==request.sessionId)return;retryToken.value=null;draft.value='';persistDraft();pendingTasks.value=[...pendingTasks.value.filter(t=>t.id!==data.data.id),data.data];await poll()}
  catch(e){if(active && selectedId.value===request.sessionId){error.value=failure(e);if(e.response && [400,401,404,409,422].includes(e.response.status)){retryToken.value=null;persistDraft()}}}
  finally{if(active)sending.value=false}
}
/** 只读轮询新增消息与任务终态；看旧消息时提示更新而不抢滚动位置。 */
async function poll(){
  if(polling || loading.value || messagesLoading.value || !selectedId.value || !active)return
  polling=true;const id=selectedId.value,revision=messageRevision
  try{
    const nearBottom=!scroller.value || scroller.value.scrollHeight-scroller.value.scrollTop-scroller.value.clientHeight<90
    const {data}=await getAiConversationMessages(id,items.value.length?{after_id:items.value.at(-1).id}:{})
    if(!active || id!==selectedId.value || revision!==messageRevision)return
    const existing=new Set(items.value.map(item=>item.id));const extra=data.data.list.filter(item=>!existing.has(item.id));items.value.push(...extra);pendingTasks.value=data.data.pending_tasks || []
    const tracked=new Map([...items.value.filter(item=>item.task && !terminal(item.task.status)).map(item=>[item.task.id,item.task]),...pendingTasks.value.map(task=>[task.id,task])])
    for(const task of tracked.values()){const response=await getAiChatTask(task.id);if(!active || id!==selectedId.value || revision!==messageRevision)return;for(const item of items.value)if(item.task_id===task.id)item.task=response.data.data}
    const directory=await getAiConversations(props.product.id,{})
    if(!active || id!==selectedId.value || revision!==messageRevision)return
    worker.value=directory.data.data.worker || {online:false};currentId.value=directory.data.data.current_id
    for(const updated of directory.data.data.list){const index=sessions.value.findIndex(s=>s.id===updated.id);if(index>=0)sessions.value[index]=updated;else sessions.value.unshift(updated)}
    if(extra.length){if(nearBottom)await scrollBottom();else newMessages.value=true}
  }catch(e){if(active && id===selectedId.value)error.value=failure(e)}finally{polling=false}
}
/** 只有用户主动查看或本来就在底部时滚动到最新消息。 */
async function scrollBottom(){newMessages.value=false;await nextTick();if(scroller.value)scroller.value.scrollTop=scroller.value.scrollHeight}
/** 取消尚未开始的问题，或明确请求停止后续轮次；已发请求可能仍计费。 */
async function cancelTask(task){try{await ElMessageBox.confirm(task.status==='queued'?'取消尚未开始的作业？每日任务取消后当天不会自动重跑，已确认行动取消后也不会自动重发。':'只能停止后续步骤；正在进行的AI请求可能已计费，Amazon已提交修改不会撤回，是否继续？','停止AI作业',{confirmButtonText:'确认停止',cancelButtonText:'返回',type:'warning'})}catch{return}try{await cancelAiChatTask(task.id);await poll()}catch(e){error.value=failure(e)}}
/** 用真实状态显示任务结果，不把AI建议标成已执行。 */
function terminal(status){return ['completed','failed','unknown','cancelled'].includes(status)}
/** 将技术阶段转成可阅读进度。 */
function taskName(task){return {queued:'排队中',preparing:'准备资料',analyzing:'AI分析中',executing:'执行及回读中',supplementing:'补资料中',processing_reply:'校验回答',correcting:'纠错中',completed:'已完成',failed:'失败',unknown:'结果待核实',cancelled:'已停止'}[task.phase] || task.status}
/** 错误和未知保持醒目，不用绿色掩盖不确定调用。 */
function taskType(status){return status==='completed'?'success':['failed','unknown'].includes(status)?'danger':'info'}
/** 销毁弹框时清理异步读取及原文弹框，防止跨ASIN残留。 */
function stop(){persistDraft();active=false;messageRevision++;originalRevision++;originalVisible.value=false;if(timer)clearInterval(timer)}
onMounted(async()=>{await refresh();if(active)timer=setInterval(poll,4000)});onBeforeUnmount(stop)
</script>

<style scoped>
.managed-chat{height:78vh;display:flex;flex-direction:column;color:#334d68;min-height:380px}.chat-top{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:0 0 18px;border-bottom:1px solid #e8edf4}.chat-top strong{font-size:16px}.chat-top small{display:block;font-size:11px;color:#8797ab;margin-top:8px}.chat-top>div:last-child{display:flex;flex-shrink:0}.chat-layout{display:flex;min-height:0;flex:1;padding-top:14px;gap:20px}.chat-sessions{width:210px;flex-shrink:0;overflow:auto;border-right:1px solid #e8edf4;padding-right:15px}.section-caption{font-size:11px;color:#8b9db4}.session-item{display:block;text-align:left;width:100%;border:1px solid transparent;background:white;border-radius:9px;padding:12px;margin:8px 0;cursor:pointer;color:#4c6079}.session-item.selected{border-color:#cbdcf7;background:#f0f5ff}.session-item strong{font-size:13px;margin-right:7px}.session-item small{display:block;font-size:10px;color:#8495ae;margin-top:8px}.chat-main{display:flex;flex-direction:column;flex:1;min-width:0}.chat-context{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;padding:0 0 10px}.chat-context>span{color:#8696aa}.chat-scroll{flex:1;overflow-y:auto;overflow-x:hidden;min-height:0;padding:8px 8px 25px}.chat-day{text-align:center;color:#98a4b4;font-size:11px;margin:12px 0 22px}.shared-message{display:flex;gap:12px;margin-bottom:24px;max-width:94%;min-width:0}.shared-message.erp{margin-left:auto;flex-direction:row-reverse}.shared-avatar{flex-shrink:0;width:34px;height:34px;border-radius:10px;background:#147d75;color:white;display:flex;align-items:center;justify-content:center;font-size:11px}.erp .shared-avatar{background:#4279d8}.shared-content{min-width:0;flex:1}.message-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:11px;margin-bottom:8px;color:#8b9aad}.message-meta strong{color:#465d7a}.erp .message-meta{justify-content:flex-end}.shared-bubble{border:1px solid #e5ebf4;border-radius:4px 13px 13px;padding:16px 18px;background:white}.erp .shared-bubble{background:#edf4ff;border-color:#dce8fb;border-radius:13px 4px 13px 13px}.message-body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;font-size:13px}.message-body.collapsed{display:-webkit-box;-webkit-line-clamp:9;-webkit-box-orient:vertical;overflow:hidden}.message-file{display:flex;align-items:center;gap:10px;flex-wrap:wrap;text-align:left;background:#ffffffb0;border:1px solid #dfe7f2;border-radius:8px;padding:12px;margin-top:14px;cursor:pointer;max-width:100%;color:#527292}.message-file>span{font-size:10px;background:#eaf1fd;padding:6px}.message-file strong{font-size:12px}.message-file small{font-size:10px;color:#91a3ba}.message-usage{display:block;font-size:10px;color:#91a3ba;margin-top:6px}.chat-composer{padding-top:12px;border-top:1px solid #e8edf4}.chat-composer>div:last-child{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:7px}.chat-composer small{font-size:11px;color:#8f9bae}.original-content{white-space:pre-wrap;overflow-wrap:anywhere;max-height:65vh;overflow:auto;font-size:12px;line-height:1.8;padding:12px;background:#f5f7fb}@media(max-width:700px){.managed-chat{height:calc(100dvh - 105px);min-height:0}.chat-top{flex-wrap:wrap;padding-bottom:10px}.chat-top strong{font-size:13px}.chat-layout{flex-direction:column;gap:10px}.chat-sessions{width:100%;max-height:110px;border-right:0;display:flex;gap:6px;overflow:auto;padding:0;flex-shrink:0}.section-caption{display:none}.session-item{min-width:170px;width:170px;margin:0}.session-item small{font-size:9px}.chat-context{gap:6px;font-size:10px}.shared-message{max-width:100%;gap:7px}.shared-avatar{width:27px;height:27px;font-size:9px}.shared-bubble{padding:11px}.message-meta{gap:4px}.message-body{font-size:12px}.message-file{padding:8px}.chat-composer small{font-size:10px}}
.chat-main{min-height:0}.chat-composer{flex-shrink:0}
.chat-mode{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.mode-help{border:1px solid #c4d4e9;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#6d87a9;cursor:help}.composer-actions{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:7px}.reply-warning{font-size:12px;line-height:1.8;padding:8px 10px;background:#fff6e9;color:#a8732a;border-radius:6px}
.shared-message.user{width:fit-content;min-width:min(260px,94%)}.shared-message.user .shared-content{flex:initial;width:100%}.message-inspector{margin-top:12px}.message-inspector>summary,.record-content>summary{font-size:11px;color:#7b92ae;cursor:pointer;line-height:1.9}.message-inspector>summary small{font-size:10px;color:#9aa8b9}.audit-record{margin-top:10px;padding:10px;background:#ffffffa8;border:1px solid #e1e9f3;border-radius:7px}.audit-record>header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:11px;color:#617c9c;margin-bottom:8px}.audit-record time{font-size:10px;color:#91a0b5}.technical-content{font-size:12px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:8px;max-height:320px;overflow:auto}.document-source{margin-top:10px}.document-source>small{font-size:10px;color:#8a9cb6}.technical-message{margin:0 0 16px auto;max-width:90%;width:fit-content}.technical-message .shared-bubble{background:#f7f9fc;border:1px dashed #dfe6ef;padding:7px 12px}.technical-message .message-inspector{margin:0}
.shared-queue{max-height:92px;overflow:auto;font-size:11px;background:#f5f8fc;padding:4px 8px;margin-bottom:8px;border-radius:6px}.shared-queue>div{display:flex;justify-content:space-between;align-items:center;gap:8px}
.bound-documents{margin-top:12px}.bound-documents summary{font-size:12px;cursor:pointer;color:#527eb4}.bound-documents .message-file{width:100%;margin-top:6px;padding:8px 10px}.attachment-note{font-size:10px;color:#8a9cb6;line-height:1.8}
.shared-message.user{margin-left:auto;flex-direction:row-reverse}.user .shared-avatar{background:#8471c1}.user .shared-bubble{background:#f5f1ff;border-color:#e8def7}.user .message-meta{justify-content:flex-end}.worker-status{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:10px;color:#c58651;margin-bottom:8px}.worker-status .online{color:#459b75}.worker-status small{font-size:10px}.human-task-state{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px;font-size:11px;color:#8796ad}.human-proposal{background:#fffaf1;border:1px solid #f1ddb9;border-radius:8px;padding:14px;margin-top:14px}.human-proposal header{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.human-proposal>header>strong{font-size:13px;color:#916b36}.human-proposal article{padding:12px 0;border-bottom:1px solid #eee3d3}.human-proposal article strong{font-size:12px;color:#4a6588}.human-proposal p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.8}.human-proposal small{display:block;font-size:11px;line-height:1.8;color:#8c94a1}.human-proposal>p{font-size:10px;color:#b38a56}.new-messages{flex-shrink:0;align-self:center;border:1px solid #cee0fa;border-radius:15px;padding:6px 15px;font-size:11px;color:#4080d4;background:#f2f7ff;cursor:pointer;margin-bottom:8px}@media(max-width:700px){.worker-status{gap:3px;margin-bottom:5px}.worker-status small{font-size:9px}.chat-composer>div:last-child{align-items:flex-start}.human-proposal{padding:9px}}
</style>

<style>
/* 覆盖全站通用弹框的移动端宽度限制，聊天只有主消息区滚动。 */
.ai-shared-chat-dialog.is-fullscreen{width:100vw!important;max-width:none!important;height:100dvh!important;margin:0!important;border-radius:0;display:flex;flex-direction:column}.ai-shared-chat-dialog .el-dialog__body{overflow:hidden}.ai-shared-chat-dialog.is-fullscreen .el-dialog__body{padding:12px!important;max-height:none!important;flex:1;min-height:0}.ai-shared-chat-dialog.is-fullscreen .managed-chat{height:100%}
</style>
