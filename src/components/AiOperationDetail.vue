<template>
  <section v-loading="loading" class="operation-detail">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-empty v-if="detail?.legacy" description="旧数据，无法查看；请使用当前版本重新分析" />
    <template v-if="detail && !detail.legacy">
      <header class="detail-summary"><div><strong>{{ detail.managed.asin }} · {{ detail.run.run_date }}</strong><p>{{ source==='human'?'人工生成方案 · 确认后执行':'每日自动优化执行' }} · 北京时间任务日 · 报告截至 {{ detail.run.report_date }} · 记录 #{{ detail.run.id }}</p></div><el-button :loading="loading" @click="loadDetail">刷新详情</el-button></header>
      <el-alert v-if="detail.run.audit_context" :title="`执行人：${detail.run.audit_context.executor.name}（AI运营） · ${detail.run.trigger_source==='scheduled'?'授权启用人':'人工发起人'}：${detail.run.audit_context.initiated_by.name}`" type="info" :closable="false" style="margin-bottom:16px" />
      <el-alert v-if="detail.plan?.status!=='ready'" :title="detail.run.message" type="warning" :closable="false" />
      <el-tabs v-model="tab" class="detail-tabs">
        <el-tab-pane :label="`本次改动（${detail.run.summary.change_count || 0}）`" name="changes" lazy><AiOperationChanges v-if="detail.plan" :plan="detail.plan" /></el-tab-pane>
        <el-tab-pane label="往期改动待观察" name="observations" lazy><AiOperationObservations :detail="detail" /></el-tab-pane>
        <el-tab-pane label="执行与回读" name="executions" lazy><AiOperationExecutions v-if="detail.plan" :plan="detail.plan" :run-id="source==='daily'?detail.run.id:null" :initial-records="detail.executions" @recovered="loadDetail" /></el-tab-pane>
        <el-tab-pane label="资料快照" name="facts" lazy><AiOperationFacts v-if="detail.plan" :result="detail.plan.facts" /></el-tab-pane>
      </el-tabs>
      <el-button v-if="detail.plan?.ai_call?.prompt?.conversation" link type="primary" @click="openConversation">查看关联AI对话与本次原始问答 ↗</el-button>
    </template>
  </section>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { getAiOptimizationDetail } from '@/services/api.js'
import AiOperationChanges from '@/components/AiOperationChanges.vue'
import AiOperationFacts from '@/components/AiOperationFacts.vue'
import AiOperationExecutions from '@/components/AiOperationExecutions.vue'
import AiOperationObservations from '@/components/AiOperationObservations.vue'
const props=defineProps({runId:{type:[String,Number],required:true},source:{type:String,default:'daily'}})
const emit=defineEmits(['open-chat'])
const detail=ref(null),loading=ref(false),error=ref(''),tab=ref('changes')
let revision=0,active=true

/** 只读取选中优化记录，版本号阻止关闭或切记录后迟到响应覆盖弹框。 */
async function loadDetail(){
  const current=++revision;loading.value=true;error.value=''
  try{const {data}=await getAiOptimizationDetail(props.source,props.runId);if(active && current===revision)detail.value=data.data}
  catch(e){if(active && current===revision)error.value=e.response?.data?.message || '优化详情读取失败'}
  finally{if(current===revision)loading.value=false}
}

/** 更换记录时清空上一份内容并默认打开真实问答，不沿用旧记录标签。 */
function selectRecord(){detail.value=null;tab.value='changes';loadDetail()}

/** 把原会话/方案定位交给托管页，详情本身不嵌套另一套聊天。 */
function openConversation(){emit('open-chat',{managed_id:detail.value.managed.id,conversation_id:detail.value.plan.ai_call.prompt.conversation.id,plan_id:detail.value.plan.id})}

/** 组件销毁后丢弃未完成读取，避免嵌套弹框关闭后出现旧数据。 */
function stop(){active=false;revision++}
watch(()=>[props.source,props.runId],selectRecord,{immediate:true})
onBeforeUnmount(stop)
</script>

<style scoped>
.operation-detail{min-height:180px;color:#344a64}.detail-summary{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap}.detail-summary strong{font-size:16px;color:#304a6b}.detail-summary p{font-size:12px;color:#8d9aab}.detail-tabs :deep(.el-tabs__header){position:sticky;top:0;background:white;z-index:2;margin-bottom:22px}.operation-detail :deep(.ai-facts-panel){padding:0;background:white}.operation-detail :deep(.execution-panel){padding-top:0;border:0;margin-top:0}
</style>
