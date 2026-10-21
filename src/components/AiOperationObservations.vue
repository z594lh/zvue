<template>
  <div class="observation-list">
    <p class="observation-note">以下为本次任务保存时的进展（任务日 {{ detail.run.run_date }}，报表截至 {{ detail.run.report_date }}），不是今天实时重新计算的结果。</p>
    <p class="source-note">改动以平台真实回读为准；报表与关键词沿用实际采集数据，变化不直接代表单次改动的因果效果。</p>
    <el-empty v-if="!observations.length" description="暂无已确认修改进入观察周期" />
    <article v-for="item in observations" :key="item.execution_id" class="memory-observation">
      <header class="observation-heading"><div><span class="change-date">{{ item.changed_on || '日期待核对' }}</span><strong>{{ item.label }}</strong></div></header>
      <div class="observation-status"><el-tag class="phase-tag" :type="item.phase==='ready_review'?'success':item.phase==='observing' && item.remaining_days>0?'primary':'warning'" effect="dark">{{ phaseName(item) }}</el-tag><el-tag v-if="item.newly_confirmed" type="info" effect="plain">本次新增</el-tag></div>
      <TextChangeDiff v-if="item.unit==='text_list'" :entries="diffEntries(item)" />
      <div v-else class="change-values"><span>修改前 <b>{{ item.before ?? '无数据' }}{{ item.unit==='percent'?'%':'' }}</b></span><span>→</span><span>修改后 <b>{{ item.after ?? '无数据' }}{{ item.unit==='percent'?'%':'' }}</b></span><small>{{ item.unit==='percent'?'广告位竞价加价比例':item.unit }}</small></div>
      <div class="observe-goal"><strong>观察 {{ item.duration_days }} 日 · {{ (item.observation_plan?.metrics || []).map(metricName).join('、') || '按原计划复评' }}</strong><p>{{ item.observation_plan?.hypothesis }}</p></div>
      <div class="observe-progress"><span>已过 {{ item.elapsed_days }} 天 / 剩余 {{ item.remaining_days }} 天</span><span>观察窗口 {{ item.started_on }} ～ {{ item.due_on }}</span></div>
      <el-progress :percentage="Math.min(100,Math.round(item.elapsed_days/Math.max(1,item.duration_days)*100))" :show-text="false" :stroke-width="6" />
      <p class="progress-conclusion">{{ item.progress_note }}</p>
      <p v-if="item.current_assessment" class="progress-conclusion"><strong>本次AI观察结论：</strong>{{ item.current_assessment }}</p>
      <p v-if="item.post_evidence?.observed_days!=null" class="observation-note">新报告已覆盖 {{ item.post_evidence.observed_days }} / {{ item.duration_days }} 天；当前值为已覆盖天数的小计，不是完整周期效果。</p>
      <div v-if="observationMetrics(item).length" class="metric-grid"><div v-for="metric in observationMetrics(item)" :key="metric.key" class="metric-item"><strong>{{ metricName(metric.key) }}</strong><span>改前近 {{ item.duration_days }} 日：{{ metricValue(metric.key,metric.before) }}</span><b>改后已报数据：{{ metricValue(metric.key,metric.after) }}</b></div></div>
      <p v-if="item.observation_plan?.metrics?.includes('net_profit') && item.post_evidence?.business_metrics?.net_profit==null && item.post_evidence?.metrics?.net_profit==null" class="observation-note">净利润尚无本项对应的改后区间值，不用滚动近7日利润代替完整观察结果。</p>
      <p v-if="item.post_evidence?.business?.sku" class="observation-note">经营观察：{{ item.post_evidence.business.sku }} · 改后报告覆盖 {{ item.post_evidence.business.observed_days }} / {{ item.duration_days }} 天 · {{ item.post_evidence.business.scope }}</p>
      <div v-if="observationKeywords(item).length" class="keyword-observation"><div class="observation-heading"><strong>关键词表现</strong><small>原版本 {{ item.baseline_snapshot?.keyword_snapshot?.record_date || '未知' }} · 当前版本 {{ item.post_evidence?.snapshot?.record_date || '待采集' }}</small></div><article v-for="word in observationKeywords(item)" :key="word.keyword"><strong>{{ word.keyword }}</strong><span>自然排名 {{ rank(word.before?.organic_rank) }} → {{ rank(word.after?.organic_rank) }}</span><span>流量占比 {{ metricValue('traffic_share',word.before?.traffic_share) }} → {{ metricValue('traffic_share',word.after?.traffic_share) }}</span></article></div>
      <p v-if="item.post_evidence?.note" class="observation-note">{{ item.post_evidence.note }}</p>
      <p v-if="item.observation_plan?.review_when" class="observation-note">重新评估条件：{{ item.observation_plan.review_when }}</p>
      <details><summary>查看调整理由、原始快照与观察计划 · 执行 #{{ item.execution_id }}</summary><p>{{ item.reason }}</p><pre>{{ JSON.stringify({before:item.before,after:item.after,observation:item.observation_plan,baseline:item.baseline_snapshot,after_period:item.post_evidence},null,2) }}</pre></details>
    </article>
    <details v-if="detail.context.recent_runs?.length" class="prior-conclusions"><summary>查看先前AI结论（{{ detail.context.recent_runs.length }} 份）</summary><article v-for="past in detail.context.recent_runs" :key="past.plan_id"><strong>{{ past.run_date }} · 方案 #{{ past.plan_id }} · 报表截至 {{ past.report_date }}</strong><p>{{ past.summary }}</p></article></details>
    <p v-if="detail.context.pending_executions?.length" class="observation-note">另有 {{ detail.context.pending_executions.length }} 项历史提交待核实，尚未计入已确认改动的观察周期。</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TextChangeDiff from '@/components/TextChangeDiff.vue'
import { buildObservations, metricName, metricValue, observationMetrics, observationKeywords } from '@/utils/aiOperationObservations.js'
const props=defineProps({detail:{type:Object,required:true}})
const observations=computed(()=>buildObservations(props.detail))
/** 根据保存的周期阶段解释观察状态，不使用今天的时钟推算。 */
function phaseName(item){return {observing:item.remaining_days>0?'还在观察期':'观察到期 · 等待新数据',waiting_data:'观察到期 · 等待新数据',ready_review:'观察到期 · 可复评'}[item.phase] || item.phase}
/** 区分未提供排名与实际前3页无排名，不把缺值写成0。 */
function rank(value){return value==null?'暂无数据':Number(value)>0?String(value):'前3页无排名'}
/** 将保存的完整文案改动转换为逐项差异。 */
function diffEntries(item){return Array.from({length:Math.max(item.before.length,item.after.length)},(_,index)=>({label:item.label,before:item.before[index] || '',after:item.after[index] || ''}))}
</script>

<style scoped>
.observation-status{display:flex;align-items:center;justify-content:flex-start;gap:10px;flex-wrap:wrap;margin:12px 0 16px}.observation-status .phase-tag{font-size:14px;font-weight:700;min-height:32px;height:auto;padding:6px 14px;line-height:20px;white-space:normal}
.memory-observation{border:1px solid #dce7f4;border-radius:10px;padding:20px;margin:18px 0;background:#fcfdff;overflow-wrap:anywhere}.observation-heading,.observation-heading>div,.change-values,.observe-progress{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.observation-heading>div{justify-content:flex-start}.observation-heading strong{font-size:15px}.change-date{color:#3675bd;font-weight:650;font-size:15px}.change-values{justify-content:flex-start;padding:14px;background:#eff5ff;border-radius:8px;margin:16px 0;font-size:13px}.change-values b{font-size:20px;color:#286fb6;margin-left:6px}.change-values small{color:#7c8eaa}.observe-goal{background:#f0f6fd;border-left:3px solid #5d9bdd;padding:12px 16px;margin:16px 0;font-size:14px}.observe-goal p{font-size:13px;line-height:1.8;color:#68829f;margin:6px 0 0}.observe-progress{font-size:12px;color:#7890ab;margin:12px 0}.progress-conclusion{color:#376690;font-size:13px;line-height:1.8}.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:10px;margin:14px 0}.metric-item{display:flex;flex-direction:column;gap:9px;background:#f3f7fc;border-radius:8px;padding:13px;font-size:12px;color:#73859b}.metric-item strong{color:#435c7c}.metric-item b{font-weight:500;color:#2c6eab}.observation-note,.source-note{font-size:12px;line-height:1.8;color:#8292a8}.source-note{color:#a2855f}.keyword-observation{margin:14px 0;background:#f5f8fc;padding:14px;border-radius:8px;font-size:12px}.keyword-observation article{display:flex;flex-wrap:wrap;gap:10px 20px;padding:12px 0;border-bottom:1px solid #e4ebf4}.keyword-observation article strong{flex-basis:100%}.keyword-observation small{color:#8193ab}details{font-size:12px;line-height:1.8;color:#7188a4;margin-top:14px}summary{cursor:pointer;color:#4274a8}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto;background:#eef3fb;padding:12px}.prior-conclusions article{padding:12px;border-bottom:1px solid #e5edf5}@media(max-width:700px){.memory-observation{padding:12px}.metric-grid{grid-template-columns:1fr}.observation-heading{align-items:flex-start}}
</style>
