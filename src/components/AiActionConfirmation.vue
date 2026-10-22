<template>
  <section class="action-confirmation" v-loading="loading">
    <header><strong>AI建议清单</strong><el-tag size="small" type="warning">需明确确认才执行</el-tag><el-button link @click="load">刷新状态</el-button></header>
    <small>方案 #{{ task.plan_id }} · 有效至 {{ time(snapshot?.expires_at) }} 北京时间。勾选后只执行原方案，不重新调用AI；实时前值变化会阻止提交。</small>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <article v-for="action in task.result.plan.actions" :key="action.action_id">
      <div class="action-line"><el-checkbox v-if="action.mode==='change'" v-model="selected" :value="action.action_id" :disabled="!allowed(action.action_id) || busy || !!retry"><strong>{{ action.label }}</strong></el-checkbox><strong v-else>{{ action.label }}</strong><el-tag size="small" :type="state(action.action_id).status==='confirmed'?'success':'info'">{{ name(state(action.action_id).status) }}</el-tag></div>
      <p v-if="action.mode==='change'">{{ showValue(action.before,action.unit) }} → {{ showValue(action.after,action.unit) }}</p><p v-else>仅观察，不提交平台</p>
      <small>{{ action.reason }}</small><small>观察 {{ action.observation.duration_days }} 天 · {{ action.observation.hypothesis }}</small>
      <small class="action-reason">{{ state(action.action_id).reason }}<template v-if="state(action.action_id).execution_id"> · 执行 #{{ state(action.action_id).execution_id }}</template></small>
      <small v-if="state(action.action_id).decided_by">决策人：{{ state(action.action_id).decided_by.name }} · {{ time(state(action.action_id).decided_at) }} 北京时间</small>
    </article>
    <footer><span>已选 {{ selected.length }} 项；未选项不会随本批执行。拒绝也会留痕。</span><div><el-button :disabled="!canDecide" :loading="busy" @click="decide('reject')">拒绝所选</el-button><el-button type="primary" :disabled="!canDecide || !workerOnline || !enabled" :loading="busy" @click="decide('execute')">确认执行所选</el-button></div></footer>
    <el-button v-if="retry" link type="warning" :disabled="busy" @click="submit">上次确认结果未知 · 用原标识核对</el-button>
    <el-button v-if="snapshot?.actions.some(a=>a.execution_id)" link type="primary" @click="readExecutions">查看执行与回读详情 ↗</el-button>
    <el-dialog v-model="executionVisible" title="人工确认 · 执行与回读" width="min(1120px, calc(100% - 24px))" top="5vh" append-to-body destroy-on-close><div v-loading="executionLoading" style="max-height:70vh;overflow:auto"><AiOperationExecutions v-if="executionData" :plan="executionData.plan" :initial-records="executionData.list" /></div></el-dialog>
  </section>
</template>

<script setup>
import { computed,onBeforeUnmount,onMounted,ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { getAiPlanConfirmation,decideAiPlanActions,getAiConfirmedExecutions } from '@/services/api'
import { conversationTime } from '@/utils/aiOperationConversation'
import AiOperationExecutions from '@/components/AiOperationExecutions.vue'
const props=defineProps({task:{type:Object,required:true},viewerId:{type:String,default:''},current:{type:Boolean,default:false},enabled:{type:Boolean,default:false},workerOnline:{type:Boolean,default:false}})
const emit=defineEmits(['updated'])
const snapshot=ref(null),selected=ref([]),loading=ref(false),busy=ref(false),error=ref(''),retry=ref(null)
const executionVisible=ref(false),executionLoading=ref(false),executionData=ref(null)
let active=true,timer=null
const time=conversationTime
const canDecide=computed(()=>props.current && !!snapshot.value && selected.value.length>0 && !busy.value && !retry.value && selected.value.every(id=>allowed(id)))
/** 为每个行动读取真实状态，不把已入队等同于平台修改成功。 */
function state(id){return snapshot.value?.actions?.find(a=>a.action_id===id) || {status:'loading',reason:'正在读取确认状态'}}
/** 只有当前仍有效、未处理行动能选择，归档/过期建议保持只读。 */
function allowed(id){return props.current && !!state(id).can_confirm}
/** 统一将技术状态转换为清晰中文，失败与未知不伪装成成功。 */
function name(status){return {pending:'待确认',queued:'已确认·排队',running:'执行中',completed:'处理完成',failed:'执行未完成',unknown:'结果待核对',cancelled:'已停止',invalid:'不可执行',rejected:'已拒绝',confirmed:'回读一致',not_sent:'未发送',conflict:'冲突·未发送',submitted:'已提交待回读',pending_confirmation:'待确认',preparing:'平台预检',submitting:'发送阶段',issues:'平台有问题'}[status] || status}
/** 原值和目标值完整展示，不截断标题或五点文案。 */
function showValue(value,unit){if(Array.isArray(value))return value.join('\n');if(['USD','USD/day'].includes(unit))return '$'+Number(value).toFixed(2)+(unit==='USD/day'?'/日':'');return String(value??'未知')+(['percent','%'].includes(unit)?'%':'')}
/** 错误只展示业务提示，不输出请求对象或接口凭证。 */
function failure(e){return e.response?.data?.message || '确认状态暂不可用，请刷新核对，勿重复提交'}
/** 原确认标识按实际登录人和原方案隔离，刷新页面不自动重发。 */
function key(){return props.viewerId?`ai-confirm:${props.viewerId}:${props.task.plan_id}`:null}
/** 保存尚待核对的确认请求；浏览器禁用缓存时仍保留本组件内存。 */
function persist(){try{if(key()){if(retry.value)localStorage.setItem(key(),JSON.stringify(retry.value));else localStorage.removeItem(key())}}catch{/* 不影响服务端幂等 */}}
/** 只读刷新逐项状态，已失效选择及时移除；不自动确认任何行动。 */
async function load(){if(loading.value || !active)return;loading.value=true;try{const {data}=await getAiPlanConfirmation(props.task.plan_id);if(active){snapshot.value=data.data;selected.value=selected.value.filter(id=>allowed(id));error.value=''}}catch(e){if(active)error.value=failure(e)}finally{if(active)loading.value=false}}
/** 确认弹框列出精确子集和原新值；授权与普通聊天发送明确区分。 */
async function decide(decision){
  if(!canDecide.value)return
  const detail=props.task.result.plan.actions.filter(a=>selected.value.includes(a.action_id)).map(a=>`${a.label}\n${showValue(a.before,a.unit)} → ${showValue(a.after,a.unit)}`).join('\n\n')
  try{await ElMessageBox.confirm((decision==='execute'?'将真实修改Amazon以下行动，操作记为AI，您是确认人。关闭页面不取消队列。':'将明确拒绝以下建议，不修改平台。')+'\n\n'+detail,decision==='execute'?'确认执行所选行动':'拒绝所选行动',{confirmButtonText:decision==='execute'?'确认真实执行':'确认拒绝',cancelButtonText:'返回',type:'warning',closeOnClickModal:false})}catch{return}
  if(!canDecide.value)return
  retry.value={plan_hash:snapshot.value.plan_hash,action_ids:[...selected.value],decision,request_token:crypto.randomUUID().replaceAll('-',''),confirm:true};persist();await submit()
}
/** 同token重试只核对第一次决策，不替换目标参数；超时保留原标识供用户恢复。 */
async function submit(){
  if(!retry.value || busy.value)return
  busy.value=true;error.value=''
  try{await decideAiPlanActions(props.task.plan_id,retry.value);if(active){retry.value=null;persist();selected.value=[];await load();emit('updated')}}
  catch(e){if(active){error.value=failure(e);if([400,409,422].includes(e.response?.status)){retry.value=null;persist();await load()}}}
  finally{if(active)busy.value=false}
}
/** 自动只读检查排队状态和24小时有效期，销毁后不留下轮询。 */
async function tick(){await load();if(active)timer=setTimeout(tick,10000)}
/** 用户点击才读取原完整回执，不因刷新卡片就回读平台或重复执行。 */
async function readExecutions(){executionVisible.value=true;executionLoading.value=true;executionData.value=null;try{const {data}=await getAiConfirmedExecutions(props.task.plan_id);if(active)executionData.value=data.data}catch(e){if(active)error.value=failure(e)}finally{if(active)executionLoading.value=false}}
onMounted(()=>{try{if(key())retry.value=JSON.parse(localStorage.getItem(key()) || 'null')}catch{/* 原确认记录始终可由服务端查阅 */}tick()})
onBeforeUnmount(()=>{active=false;if(timer)clearTimeout(timer)})
</script>

<style scoped>
.action-confirmation{background:#fffaf1;border:1px solid #f1ddb9;border-radius:8px;padding:14px;margin-top:14px}.action-confirmation header,.action-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.action-confirmation strong{font-size:13px;color:#4a6588}.action-confirmation>small,.action-confirmation article small{display:block;font-size:11px;line-height:1.8;color:#8390a2}.action-confirmation article{padding:12px 0;border-bottom:1px solid #eee3d3}.action-confirmation p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.8}.action-confirmation .action-reason{color:#ae7b3c;margin-top:6px}.action-line :deep(.el-checkbox){height:auto;white-space:normal;max-width:100%}.action-line :deep(.el-checkbox__label){white-space:normal}.action-confirmation footer{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:14px;flex-wrap:wrap}.action-confirmation footer span{font-size:10px;color:#9b815d}@media(max-width:700px){.action-confirmation{padding:9px}.action-confirmation footer>div{display:flex;flex-wrap:wrap;gap:6px}.action-confirmation footer :deep(.el-button){margin:0}}
</style>
