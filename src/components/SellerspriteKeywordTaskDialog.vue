<template>
  <el-dialog :model-value="modelValue" :title="`${asin} · 采集任务与补救`" width="min(1160px, 96vw)" top="4vh" append-to-body :close-on-click-modal="false" @update:model-value="value=>emit('update:modelValue',value)">
    <div class="sprite-task-help">页面只查看本地记录。加入队列后，由虚拟机每小时执行；上传失败优先补传原文件，空表重新采集。<strong>历史日期重新查询得到的是今天快照，不会伪造历史数据。</strong></div>
    <div class="sprite-worker"><span>补采进程最近联系：{{ spriteTime(data.worker?.last_seen_at) }}（北京时间）</span><el-tag :type="workerTone">{{ workerLabel }}</el-tag><el-button :loading="loading" :disabled="busy" @click="load">刷新记录</el-button></div>
    <el-alert v-if="data.worker?.blocked" type="error" :closable="false" show-icon :title="`网页采集已暂停：${data.worker.message || data.worker.error_code}`"><p>在虚拟机浏览器处理登录、验证码或权限问题后再恢复。暂停期间仍可补传已下载文件。</p><el-button v-if="canRecover" type="danger" plain :loading="busy" @click="resume">已处理，恢复自动补救</el-button></el-alert>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <h3>补救队列 <small>自动最多3次；手动次数不限，每次排一次；等待或执行中不重复入队</small></h3>
    <div v-if="!data.queues?.length" class="sprite-task-empty">暂无补救队列。小时任务会发现最近7天每个启用ASIN的最新失败，也可在下方手动入队。</div>
    <div v-for="queue in data.queues || []" :key="queue.id" class="sprite-queue-item">
      <div><el-tag :type="queueTone(queue.status)">{{ queueLabels[queue.status] || queue.status }}</el-tag><strong>#{{ queue.id }} · {{ queue.mode==='upload'?'补传原文件':'重新采集' }} · {{ queue.record_date }}</strong><span>自动 {{ queue.auto_attempts }} / {{ queue.max_attempts }} 次 · 手动 {{ Math.max(0,queue.attempts-queue.auto_attempts) }} 次</span><el-tag v-if="queue.status==='queued'" size="small" effect="plain">本次{{ queue.request_source==='manual'?'手动':'自动' }}</el-tag></div>
      <p v-if="queue.status==='queued'">最早执行 {{ spriteTime(queue.next_attempt_at) }}（北京时间）；实际由下一次小时任务领取。</p>
      <p v-if="queue.last_error">{{ queue.last_error }}</p><small>来源任务 #{{ queue.source_task_id }} · 入队人 {{ queue.requested_by }}</small><el-button v-if="canRecover && ['queued','blocked','exhausted'].includes(queue.status)" link type="danger" :disabled="busy" @click="cancelQueue(queue)">取消本队列</el-button>
    </div>
    <h3>每日任务历史 <small>展开查看阶段、错误及处理建议；旧记录仅展示已有日志，不猜测缺失原因</small></h3>
    <el-table :data="data.list || []" v-loading="loading" row-key="id" max-height="500">
      <el-table-column type="expand"><template #default="{row}"><div class="sprite-task-detail">
        <strong>{{ row.diagnostic?.stage_label }} · {{ row.diagnostic?.code }}</strong><p>{{ row.diagnostic?.message }}</p>
        <pre v-if="row.error_message">{{ row.error_message }}</pre><p v-if="row.status!=='completed'">建议：{{ row.diagnostic?.suggestion }}</p>
        <p>任务 #{{ row.id }} · 领取 {{ row.attempts }} 次 · {{ row.file_name || '暂无原文件记录' }}<template v-if="row.latest_file_id"> · ERP文件 #{{ row.latest_file_id }}</template></p>
        <p>最近执行 {{ spriteTime(row.started_at) }} · 最近更新 {{ spriteTime(row.updated_at) }}（北京时间）</p>
        <div v-if="row.events?.length" class="sprite-event-list"><div v-for="(event,index) in row.events" :key="index"><small>{{ spriteTime(event.created_at) }} · 第{{ event.attempt }}次 · {{ stageLabels[event.stage] || event.stage }} / {{ event.error_code }}</small><p>{{ event.message }}</p></div></div>
        <span v-else>旧任务没有逐阶段记录；更新采集端后，后续执行会自动留存。</span>
      </div></template></el-table-column>
      <el-table-column label="快照日期" prop="record_date" width="120" />
      <el-table-column label="结果" width="125"><template #default="{row}"><el-tag :type="row.status==='completed'?'success':row.active?'warning':'danger'">{{ spriteStates[row.status] || row.status }}</el-tag></template></el-table-column>
      <el-table-column label="阶段 / 原因" min-width="320"><template #default="{row}"><strong>{{ row.diagnostic?.stage_label }}</strong><p class="sprite-task-summary">{{ row.diagnostic?.message }}</p></template></el-table-column>
      <el-table-column label="关键词" width="90"><template #default="{row}">{{ row.status==='completed'?row.row_count:'—' }}</template></el-table-column>
      <el-table-column v-if="canRecover" label="补救" width="150" fixed="right"><template #default="{row}"><el-tooltip :content="row.active || isQueued(row)?'任务已在等待或执行中，不会重复入队':'手动次数不限，每次只排一次，不占自动3次；可能消耗卖家精灵额度'"><span><el-button v-if="row.status!=='completed'" type="primary" plain size="small" :disabled="busy || row.active || isQueued(row)" @click="recover(row)">{{ isQueued(row)?'已在补救队列':'加入补救队列' }}</el-button></span></el-tooltip></template></el-table-column>
      <template #empty>{{ error?'记录读取失败，请刷新':'该ASIN尚无采集任务' }}</template>
    </el-table>
    <el-pagination v-if="data.total>20" v-model:current-page="page" :page-size="20" :total="data.total" layout="total, prev, pager, next" :disabled="loading || busy" @current-change="load" />
    <p v-if="!canRecover" class="sprite-task-help">当前仅查看；加入补救或恢复账号需要“卖家精灵采集配置”权限。</p>
  </el-dialog>
</template>

<script setup>
// 关键词反查任务历史与失败补救；竞品进度由独立竞品面板显示。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSellerspriteKeywordTasks, recoverSellerspriteKeywordTask, resumeSellerspriteKeywordAccount, cancelSellerspriteKeywordRecovery } from '@/services/api'
import { spriteStates, spriteTime } from '@/utils/sellersprite'
const props=defineProps({modelValue:Boolean,asin:{type:String,default:''},canRecover:Boolean})
const emit=defineEmits(['update:modelValue','changed'])
const data=ref({}),page=ref(1),loading=ref(false),busy=ref(false),error=ref('')
const queueLabels={queued:'等待小时任务',running:'正在补救',completed:'已补救',blocked:'需人工处理',exhausted:'自动次数已耗尽',cancelled:'已结束 / 需重新入队'}
const stageLabels={query:'查询/登录',export:'导出',download:'下载',upload:'上传ERP',parse:'清洗入库',worker:'采集进程',queue:'补救队列'}
let revision=0,disposed=false
const workerTone=computed(()=>data.value.worker?.blocked?'danger':!data.value.worker?.last_seen_at || Date.now()-new Date(data.value.worker.last_seen_at).getTime()>7200000?'warning':'success')
const workerLabel=computed(()=>data.value.worker?.blocked?'需人工恢复':workerTone.value==='warning'?'尚无心跳或超过2小时，请检查虚拟机cron/网络':'小时补采已联系ERP')
// 仅将队列状态映射为颜色，不触发采集或状态变更。
function queueTone(status){return status==='completed'?'success':['blocked','exhausted'].includes(status)?'danger':status==='running'?'warning':'info'}
// 同ASIN同目标日期或来源任务已有等待/执行队列时禁用重复入队，不累计手动额度。
function isQueued(row){return (data.value.queues || []).some(queue=>['queued','running'].includes(queue.status) && (String(queue.source_task_id)===String(row.id) || queue.record_date===row.record_date))}
// 使用请求序号防止切换ASIN/关闭弹框后旧响应覆盖当前记录。
async function load(){const current=++revision;loading.value=true;error.value='';try{const res=await getSellerspriteKeywordTasks(props.asin,{page:page.value},props.canRecover);if(disposed || current!==revision)return;data.value=res.data.data}catch(err){if(!disposed && current===revision)error.value=err.response?.data?.message || '任务记录读取失败'}finally{if(!disposed && current===revision)loading.value=false}}
// 人工明确确认后仅排一次；总次数不限且不占自动预算，重复请求由服务端幂等去重。
async function recover(row){if(busy.value || isQueued(row))return;const asin=props.asin;try{await ElMessageBox.confirm(`将 ${asin} 的任务 #${row.id} 加入一次手动补救。手动总次数不限，不占自动3次；已在等待或执行中不会重复添加。空表重采归今天；有有效原文件时优先补传原日期。登录/验证码/格式问题请先处理，执行可能消耗卖家精灵额度。`,'确认补救',{type:'warning',confirmButtonText:'确认加入队列',cancelButtonText:'取消'});if(asin!==props.asin || !props.modelValue)return;busy.value=true;const res=await recoverSellerspriteKeywordTask(row.id,{confirm:true});ElMessage.success(res.data.data.duplicate?'任务已在队列中，未重复添加':`已排队，目标快照 ${res.data.data.record_date}；等待小时任务`);await load();emit('changed')}catch(err){if(err!=='cancel' && err!=='close')ElMessage.error(err.response?.data?.message || '入队结果待确认，请刷新记录，勿反复点击')}finally{busy.value=false}}
// 仅在用户确认虚拟机账号问题已经处理后解除全局网页采集阻塞。
async function resume(){if(busy.value)return;try{await ElMessageBox.confirm('请确认已在虚拟机浏览器处理登录、验证码或账号权限。恢复后，下一轮小时任务将继续网页采集。','恢复采集账号',{type:'warning'});busy.value=true;await resumeSellerspriteKeywordAccount();ElMessage.success('已恢复，等待下一次小时任务');await load()}catch(err){if(err!=='cancel' && err!=='close')ElMessage.error(err.response?.data?.message || '恢复结果待确认，请刷新')}finally{busy.value=false}}
// 只取消等待/阻塞队列，服务端拒绝取消执行中的任务，避免中断上传事务。
async function cancelQueue(queue){if(busy.value)return;try{await ElMessageBox.confirm('取消本队列后，今天不会自动重新打开；仍可手动重新入队。','取消补救',{type:'warning'});busy.value=true;await cancelSellerspriteKeywordRecovery(queue.id);await load()}catch(err){if(err!=='cancel' && err!=='close')ElMessage.error(err.response?.data?.message || '取消结果待确认，请刷新')}finally{busy.value=false}}
// 打开或切换ASIN重置分页；关闭时使在途查询失效。
watch(()=>[props.modelValue,props.asin],()=>{revision++;if(props.modelValue && props.asin){page.value=1;data.value={};load()}},{immediate:true})
onBeforeUnmount(()=>{disposed=true;revision++})
</script>

<style scoped>
.sprite-task-help{font-size:12px;color:#7d8fa8;line-height:1.9;background:#f4f8ff;padding:12px 16px;border-radius:8px}.sprite-task-help strong{display:block;color:#596f8c}.sprite-worker{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:16px 0;font-size:12px;color:#7d8fa8}.sprite-worker .el-button{margin-left:auto}h3{font-size:15px;color:#304d70;margin:22px 0 12px}h3 small{font-size:12px;font-weight:400;color:#8a9ab0;margin-left:10px}.sprite-task-empty{padding:16px;color:#8a9ab0;background:#fafbfd;font-size:12px}.sprite-queue-item{padding:12px 16px;margin-bottom:8px;border:1px solid #e3ebf6;border-radius:8px;font-size:13px;color:#4e6582}.sprite-queue-item>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.sprite-queue-item p{margin:8px 0;font-size:12px;overflow-wrap:anywhere}.sprite-queue-item small{color:#8a9ab0}.sprite-task-summary{font-size:12px;color:#7c8ea8;line-height:1.6;margin:5px 0}.sprite-task-detail{padding:12px 24px;color:#56708e;font-size:12px;line-height:1.8}.sprite-task-detail pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#fff4f2;color:#ac4a44;padding:12px;border-radius:6px;max-height:200px;overflow:auto}.sprite-event-list{max-height:300px;overflow:auto;margin-top:14px;border-left:2px solid #dce7fa;padding-left:16px}.sprite-event-list>div{margin-bottom:12px}.sprite-event-list small{color:#94a2b8}.sprite-event-list p{margin:4px 0;overflow-wrap:anywhere}.el-pagination{margin-top:14px;justify-content:flex-end}
</style>
