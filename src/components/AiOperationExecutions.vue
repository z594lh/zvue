<template>
  <section class="execution-panel">
    <header><p>只读查看已保存的正式提交和独立回读，不会重新执行。</p><el-button :disabled="!records.length" @click="download">下载执行记录</el-button></header>
    <el-empty v-if="!records.length" description="本次没有产生需要提交的新改动" />
    <article v-for="record in records" :key="record.id" class="execution-card"><header><strong>{{ record.action.label }}</strong><el-tag :type="record.status==='confirmed'?'success':record.status==='rejected' || record.status==='conflict'?'danger':'info'">{{ statusName(record.status) }}</el-tag></header>
      <p class="execution-note">记录 #{{ record.id }} · {{ record.receipt?.message }}</p>
      <p v-if="record.audit_context" class="execution-note">执行人：<strong>{{ record.audit_context.executor.name }}（AI运营）</strong> · 人工发起人：{{ record.audit_context.initiated_by.name }} · 每日记录 #{{ record.audit_context.run_id }} / {{ record.audit_context.action_id }}</p>
      <p v-else class="execution-note">历史操作人编号：{{ record.actor_id }}（旧记录保留原身份，未回填AI人员）</p>
      <div v-if="record.verification" class="execution-readback"><strong>独立回读：{{ record.verification.matched?'与目标一致':record.verification.value==null?'尚未读取成功':'尚未确认一致' }}</strong><p>{{ displayValue(record.verification.value) }}</p><small>{{ record.verification.message }}</small><p v-for="warning in record.verification.warnings || []" :key="warning">{{ warning }}</p></div>
      <details class="execution-proof"><summary>执行前值与提交／回读原文</summary><p>执行前值：{{ displayValue(record.baseline.settings.value) }}</p><p>基线报告截至 {{ record.baseline.report_date }} · 观察 {{ record.action.observation.duration_days }} 天</p><pre>{{ JSON.stringify({receipt:record.receipt,verification:record.verification},null,2) }}</pre></details>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'
const props=defineProps({plan:{type:Object,required:true},initialRecords:{type:Array,required:true}})
const records=computed(()=>props.initialRecords)

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
.execution-panel header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.execution-panel header p,.execution-note{font-size:12px;color:#8b99ac;line-height:1.8}.execution-card{padding:18px;border:1px solid #e0e7f0;border-radius:10px;margin-top:18px;background:#fcfdff}.execution-readback{background:#edf7f3;border-left:3px solid #68ac90;padding:13px;overflow-wrap:anywhere;font-size:13px;white-space:pre-wrap;line-height:1.8}.execution-readback small{color:#819c90}.execution-proof{margin-top:15px;font-size:12px;color:#7d90aa;line-height:1.9;overflow-wrap:anywhere}.execution-proof summary{cursor:pointer}.execution-proof pre{max-height:300px;overflow:auto;white-space:pre-wrap;background:#f3f6fa;padding:14px}@media(max-width:700px){.execution-card{padding:12px}}
</style>
