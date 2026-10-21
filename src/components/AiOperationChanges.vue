<template>
  <section class="operation-changes">
    <p class="plan-summary">{{ plan.result?.summary || plan.message }}</p>
    <el-empty v-if="!actions.length" description="本次没有新增改动，保留AI分析与观察结论" />
    <article v-for="(action,index) in actions" :key="action.action_id" class="action-card">
      <header><h3>改动 {{ index+1 }} · {{ action.label }}</h3><el-tag effect="plain">{{ action.priority }}</el-tag></header>
      <TextChangeDiff v-if="action.kind==='listing_text_update'" :entries="diffEntries(action)" />
      <div v-else class="action-values"><span>修改前 <b>{{ action.before }}</b></span><span>→</span><span>修改后 <b>{{ action.after }}</b></span><small>{{ action.unit==='percent'?'% · 广告位竞价加价比例':action.unit }}</small></div>
      <p class="action-reason">{{ action.reason }}</p>
      <div class="action-observation"><strong>观察 {{ action.observation.duration_days }} 天 · {{ action.observation.metrics.map(metricName).join('、') }}</strong><p>{{ action.observation.hypothesis }}</p><p>复评条件：{{ action.observation.review_when }}</p><p v-if="action.observation.keywords.length">固定关键词：{{ action.observation.keywords.join('；') }}</p></div>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import TextChangeDiff from '@/components/TextChangeDiff.vue'
import { metricName } from '@/utils/aiOperationObservations.js'
const props=defineProps({plan:{type:Object,required:true}})
// 详情只展示当前会话的新增改动，不提供旧手动生成或重复执行入口。
const actions=computed(()=>(props.plan.result?.actions || []).filter(action=>action.mode==='change'))

/** 按字段生成完整文案差异，五点描述逐条对比，其他字段整段对比。 */
function diffEntries(action){
  return Array.from({length:Math.max(action.before.length,action.after.length)},(_,index)=>({
    label:action.subject.field==='bullet_point'?`五点描述 · 第${index+1}条`:action.label,
    before:action.before[index] || '',after:action.after[index] || ''
  }))
}
</script>

<style scoped>
.plan-summary{line-height:1.9;color:#526982;white-space:pre-wrap}.action-card{border:1px solid #e1e8f1;border-radius:10px;padding:20px;margin-top:18px;background:white}.action-card header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}.action-card h3{font-size:15px;margin:0 0 12px;color:#2a4c74}.action-values{display:flex;gap:16px;flex-wrap:wrap;background:#eef4ff;padding:15px;border-radius:7px;font-size:13px}.action-values b{font-size:20px;color:#3274be;margin-left:8px}.action-values small{color:#8c9aab}.action-reason{line-height:1.9;white-space:pre-wrap;color:#3f6c9d}.action-observation{border-left:3px solid #8fb7e6;background:#f6f9fd;padding:13px;font-size:12px;color:#758ba6;line-height:1.8}.action-observation p{margin:6px 0}@media(max-width:700px){.action-card{padding:13px}}
</style>
