<template>
  <section class="business-table">
    <div class="table-toolbar"><span>本次返回 {{ rows.length }} 条 · 每页10条</span><el-input v-model="search" placeholder="搜索本次返回的记录" clearable size="small" aria-label="搜索本次返回的记录"/></div>
    <el-table :data="pageRows" stripe border class="readable-table" empty-text="当前回包没有这些记录；不代表平台没有业务" :max-height="560">
      <el-table-column type="index" label="#" width="50" :index="i=>(page-1)*10+i+1"/>
      <el-table-column v-for="col in columns" :key="col" :label="fieldLabel(col)" :min-width="wide.includes(col)?260:125">
        <template #header><el-tooltip :content="dictionaryEntry('data.field',col)?.description || `原字段：${col}`"><span>{{ fieldLabel(col) }}</span></el-tooltip></template>
        <template #default="{row}"><span class="table-cell" :title="typeof row.view[col]==='object'?undefined:String(row.view[col] ?? '')">{{ cellValue(row,col) }}</span></template>
      </el-table-column>
      <el-table-column label="详情" width="105" fixed="right"><template #default="{row}"><el-button link type="primary" @click="show(row.original)">完整记录</el-button></template></el-table-column>
    </el-table>
    <div class="table-bottom"><small>搜索只筛选已返回记录，翻页不会重新取数。</small><el-pagination v-model:current-page="page" :page-size="10" :total="filtered.length" layout="prev, pager, next, total" small/></div>
    <el-dialog v-model="visible" title="业务记录详情" width="min(1120px, calc(100% - 28px))" append-to-body destroy-on-close class="ai-tool-record-dialog"><p class="record-note">下列内容来自同一条返回记录；未提供的字段不补查、不补0。</p><AiToolValue :value="detail" :currency="rowCurrency(detail,currency)"/><details><summary>这条记录的原始 JSON</summary><pre>{{ pretty(detail) }}</pre></details></el-dialog>
  </section>
</template>
<script setup>
import { computed,ref,watch } from 'vue'
import { dictionaryEntry,dictionaryLabel } from '@/utils/businessDictionary'
import { fieldLabel,formatValue,pretty,reportKind,rowCurrency,tableRow } from '@/utils/aiToolData'
import AiToolValue from './AiToolValue.vue'
const props=defineProps({rows:{type:Array,default:()=>[]},columns:{type:Array,default:()=>[]},window:{type:String,default:''},currency:{type:String,default:''}})
const page=ref(1),search=ref(''),visible=ref(false),detail=ref(null)
const wide=['label','keyword','customer_search_term','campaign_name','keyword_text','note','question','summary','product_name']
const filtered=computed(()=>props.rows.filter(row=>!search.value || pretty(row).toLowerCase().includes(search.value.toLowerCase())))
const pageRows=computed(()=>filtered.value.slice((page.value-1)*10,page.value*10).map(row=>({original:row,view:tableRow(row,props.window)})))
/** 详情展示同条记录的完整内容，不能追加当前库中的其他信息。 */
function show(row){detail.value=row;visible.value=true}
/** 快照列显示原快照日期；其余复杂对象交由完整记录阅读，不把JSON铺在主表。 */
function cellValue(row,key){const value=row.view[key];if(key==='snapshot' && value && typeof value==='object')return value.record_date ?? '采集日期未提供';if(value && typeof value==='object')return '结构化资料 · 查看完整记录';if(key==='label' && reportKind(row.original)==='spTargeting')return dictionaryLabel('ads.auto_target',value,value);return formatValue(key,value,rowCurrency(row.original,props.currency))}
watch([()=>props.rows,()=>props.window,search],()=>{page.value=1})
</script>
<style scoped>
.business-table{min-width:0}.table-toolbar,.table-bottom{display:flex;gap:16px;align-items:center;justify-content:space-between;margin:14px 0;font-size:12px;color:#7c8fa7}.table-toolbar .el-input{width:255px}.table-cell{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}.readable-table{--el-table-header-bg-color:#f3f6fb;--el-table-header-text-color:#526c8b;font-size:13px}.record-note{font-size:12px;color:#8192aa}details{margin-top:20px;color:#7086a3;font-size:12px}summary{cursor:pointer}pre{background:#f5f7fb;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:45vh;overflow:auto}@media(max-width:650px){.table-toolbar,.table-bottom{align-items:flex-start;flex-direction:column}.table-toolbar .el-input{width:100%}}
</style>
<style>
/* 明细弹框随阅读组件加载，直接进入预览路由也有独立滚动，不依赖管理页样式。 */
.ai-tool-record-dialog{max-height:90vh;display:flex;flex-direction:column}.ai-tool-record-dialog>.el-dialog__body{min-height:0;overflow:auto}
</style>
