<template>
  <section class="tool-result">
    <div v-if="toolName==='get_operation_overview'" class="overview-guide"><strong>综合概览是摘要，不是全部资料</strong><p>按左侧业务模块核对本次真实返回。部分文案、关键词或广告对象可能只给了摘要；未返回的内容不会自动补全。</p></div>
    <div v-if="modules.length" class="result-workspace" :class="{single:modules.length===1}">
      <nav class="business-nav" aria-label="返回数据业务模块"><span class="nav-caption">本次返回的业务内容</span><button v-for="m in modules" :key="m.key" :class="{selected:selected===m.key}" @click="selected=m.key"><strong>{{ m.title }}</strong><small>{{ moduleState(m.data) }}{{ m.query?.window?' · '+fieldLabel(m.query.window):'' }}</small></button></nav>
      <div class="business-content"><AiToolBusinessSection v-if="current" :key="current.key" :module="current" :currency="result.identity?.currency || result.currency || ''" :time="result.time || {}" :mode="mode"/></div>
    </div>
    <el-empty v-else description="此次返回没有可阅读的业务模块，请核对状态与完整原文。"/>
    <p v-if="result.note && modules.length>1" class="result-note">{{ readableNote(result.note) }}</p>
    <p v-if="result.detail_tools?.length" class="supplementary">AI还可继续补查（不是本次已提供的明细）：{{ result.detail_tools.map(toolLabel).join('、') }}。</p>
    <details class="result-json"><summary>{{ mode==='actual'?'AI收到的完整工具返回':'本次试查完整返回' }} · 原始 JSON（含技术字段 / 未适配字段）</summary><pre>{{ pretty(result) }}</pre></details>
  </section>
</template>
<script setup>
import { computed,ref,watch } from 'vue'
import { businessModules,fieldLabel,moduleState,pretty,readableNote,toolLabel } from '@/utils/aiToolData'
import AiToolBusinessSection from './AiToolBusinessSection.vue'
const props=defineProps({result:{type:[Object,Array],default:()=>({})},toolName:{type:String,required:true},mode:{type:String,default:''}})
const selected=ref(''),modules=computed(()=>businessModules(props.toolName,props.result)),current=computed(()=>modules.value.find(m=>m.key===selected.value))
/** 新回包重置业务导航，不让旧记录残留到其他商品或查询。 */
function reset(){selected.value=modules.value[0]?.key || ''}
watch([()=>props.result,()=>props.toolName],reset,{immediate:true})
</script>
<style scoped>
.result-workspace.single{grid-template-columns:minmax(0,1fr)}.single>.business-nav{display:none}
.tool-result{min-width:0}.overview-guide{border:1px solid #dce8f9;background:#f2f7ff;padding:16px 20px;border-radius:10px;margin:18px 0;color:#3e648e;font-size:13px}.overview-guide p{font-size:12px;margin:6px 0 0;line-height:1.8;color:#6c85a5}.result-workspace{display:grid;grid-template-columns:205px minmax(0,1fr);gap:28px;margin:24px 0;min-height:500px}.business-nav{border-right:1px solid #e5ecf5;padding-right:18px}.nav-caption{display:block;font-size:11px;color:#8b9bb0;margin:0 12px 14px}.business-nav button{display:block;text-align:left;border:1px solid transparent;border-radius:8px;background:none;padding:13px 14px;width:100%;margin-bottom:6px;color:#536f91;cursor:pointer}.business-nav button:hover{background:#f5f8fd}.business-nav .selected{background:#edf4ff;border-color:#d4e4ff;color:#2c73c3}.business-nav strong{font-size:13px;font-weight:600;display:block}.business-nav small{font-size:11px;display:block;margin-top:6px;color:#8a9cb5}.business-content{min-width:0}.result-note,.supplementary{font-size:12px;line-height:1.9;color:#8092ac}.supplementary{background:#f5f8fc;padding:14px 18px;border-radius:8px}.result-json{border-top:1px solid #e5ecf5;padding:18px 0;font-size:12px;color:#6b88ad}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:55vh;overflow:auto;padding:16px;background:#f6f8fc;line-height:1.8}@media(max-width:850px){.result-workspace{grid-template-columns:1fr;gap:16px}.business-nav{border-right:0;border-bottom:1px solid #e5ecf5;padding:0 0 8px;display:flex;flex-wrap:wrap;gap:6px}.nav-caption{width:100%;margin:0 0 6px}.business-nav button{width:auto;flex:1 0 145px;margin:0;padding:10px}}
</style>
