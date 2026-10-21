<template>
  <section class="execution-panel">
    <header><p>查看详情不会重新执行；仅“确定未发送”的广告可手动补执行，成功或未知项不会重发。</p><div><el-tooltip content="只补原方案明确未发送的广告，不调用AI、不重跑Listing；24小时内且没有更新的每日任务才可操作。会重新核对亚马逊前值，变化则不提交。" placement="top"><el-button v-if="retryable.length" type="warning" plain :loading="recovering" :disabled="recovering" @click="retryAds">补执行未发送广告（{{ retryable.length }}）</el-button></el-tooltip><el-button :disabled="!records.length || recovering" @click="download">下载执行记录</el-button></div></header>
    <el-alert v-if="retryError" :title="retryError" type="error" :closable="false" show-icon />
    <el-empty v-if="!records.length" description="本次没有产生需要提交的新改动" />
    <article v-for="record in records" :key="record.id" class="execution-card"><header><strong>{{ record.action.label }}</strong><el-tag :type="record.status==='confirmed'?'success':record.status==='rejected' || record.status==='conflict'?'danger':'info'">{{ statusName(record.status) }}</el-tag></header>
      <p class="execution-note">记录 #{{ record.id }} · {{ record.receipt?.message }}</p>
      <p v-if="record.audit_context" class="execution-note">执行人：<strong>{{ record.audit_context.executor.name }}（AI运营）</strong> · 人工发起人：{{ record.audit_context.initiated_by.name }} · 每日记录 #{{ record.audit_context.run_id }} / {{ record.audit_context.action_id }}</p>
      <p v-else class="execution-note">历史操作人编号：{{ record.actor_id }}（旧记录保留原身份，未回填AI人员）</p>
      <p v-if="record.receipt?.diagnostic" class="execution-error">{{ diagnosticLabel(record.receipt.diagnostic) }}</p>
      <p v-if="record.receipt?.recovery_attempts?.length" class="execution-note">已补执行 {{ record.receipt.recovery_attempts.length }} 次 · 原失败记录保留在下方回执原文<template v-if="record.receipt.recovery_context"> · 本次发起人：{{ record.receipt.recovery_context.initiated_by.name }}</template></p>
      <div v-if="record.verification" class="execution-readback"><strong>独立回读：{{ record.verification.matched?'与目标一致':record.verification.value==null?'尚未读取成功':'尚未确认一致' }}</strong><p>{{ displayValue(record.verification.value) }}</p><small>{{ record.verification.message }}</small><p v-for="warning in record.verification.warnings || []" :key="warning">{{ warning }}</p></div>
      <details class="execution-proof"><summary>执行前值与提交／回读原文</summary><p>执行前值：{{ displayValue(record.baseline.settings.value) }}</p><p>基线报告截至 {{ record.baseline.report_date }} · 观察 {{ record.action.observation.duration_days }} 天</p><pre>{{ JSON.stringify({receipt:record.receipt,verification:record.verification},null,2) }}</pre></details>
    </article>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { retryAiUnsentAds } from '@/services/api.js'
const props=defineProps({plan:{type:Object,required:true},runId:{type:[String,Number],required:true},initialRecords:{type:Array,required:true}})
const emit=defineEmits(['recovered'])
const records=computed(()=>props.initialRecords)
const retryable=computed(()=>records.value.filter(row=>row.can_retry))
const recovering=ref(false),retryError=ref('')
let active=true
onBeforeUnmount(()=>{active=false})

/** 展示脱敏的执行阶段和诊断，不把原SQL或凭证返回页面。 */
function diagnosticLabel(value){return `${({authorize:'权限核对',read_platform:'平台读取',prepare_action:'行动预检',cache_ads:'广告缓存关联',save_baseline:'基线保存',authorize_before_send:'发送前权限核对',submit_platform:'平台提交',verify_platform:'平台回读'})[value.stage] || value.stage}：${value.hint}（${value.exception_type}${value.error_code?` / ${value.error_code}`:''}）`}

/** 明确确认后，仅补当前失败版本的未发送广告；超时后刷新核对，不自动重试。 */
async function retryAds(){
  if(recovering.value || !retryable.value.length)return
  const selected=retryable.value.map(row=>({id:row.id,version:row.retry_version}))
  recovering.value=true;retryError.value=''
  try{
    await ElMessageBox.confirm(`仅补执行这${selected.length}条未发送广告，会真实修改亚马逊广告。不再次调用AI，不重跑已成功Listing；执行前重新核对平台前值，原失败记录保留。`,'补执行原方案广告',{confirmButtonText:'确认补执行广告',cancelButtonText:'取消',type:'warning',closeOnClickModal:false})
  }catch{recovering.value=false;return}
  if(!active){recovering.value=false;return}
  try{await retryAiUnsentAds(props.runId,selected);if(active){ElMessage.success('补执行流程已结束，请核对各项实际回执和回读');emit('recovered')}}
  catch(error){if(active){retryError.value=error.response?.data?.message || '补执行结果未确认，请刷新详情查看；不要重复提交';emit('recovered')}}
  finally{recovering.value=false}
}

/** 显示保存的真实执行阶段，不把提交接受等同于回读确认。 */
function statusName(status){return {preparing:'发送前预检',submitting:'已登记发送 · 待核对',not_sent:'未发送',issues:'平台处理问题',submitted:'已提交 · 待回读',pending:'待回读',unknown:'回执未知',confirmed:'平台回读一致',rejected:'接口拒绝',conflict:'前值冲突',superseded:'已被后续操作替换'}[status] || status}

/** 文案按原顺序展示完整字段，金额和空值不伪造转换。 */
function displayValue(value){return Array.isArray(value)?value.join('；'):value ?? '无数据'}

/** 下载本次保存的执行记录，不触发额外后端读取或正式提交。 */
function download(){
  const url=URL.createObjectURL(new Blob([JSON.stringify({plan_id:props.plan.id,executions:records.value},null,2)],{type:'application/json;charset=utf-8'}))
  const link=document.createElement('a');link.href=url;link.download=`${props.plan.asin}_执行记录_${props.plan.id}.json`;link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
</script>

<style scoped>
.execution-error{font-size:12px;color:#ba4a40;background:#fff3f1;border-radius:5px;padding:9px 12px;line-height:1.7}.execution-panel header>div{display:flex;gap:8px;flex-wrap:wrap}.execution-panel header>div .el-button{margin-left:0}.execution-panel>.el-alert{margin:12px 0}
.execution-panel header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.execution-panel header p,.execution-note{font-size:12px;color:#8b99ac;line-height:1.8}.execution-card{padding:18px;border:1px solid #e0e7f0;border-radius:10px;margin-top:18px;background:#fcfdff}.execution-readback{background:#edf7f3;border-left:3px solid #68ac90;padding:13px;overflow-wrap:anywhere;font-size:13px;white-space:pre-wrap;line-height:1.8}.execution-readback small{color:#819c90}.execution-proof{margin-top:15px;font-size:12px;color:#7d90aa;line-height:1.9;overflow-wrap:anywhere}.execution-proof summary{cursor:pointer}.execution-proof pre{max-height:300px;overflow:auto;white-space:pre-wrap;background:#f3f6fa;padding:14px}@media(max-width:700px){.execution-card{padding:12px}}
</style>
