<template>
  <section class="daily-operation-picker">
    <div class="operation-intro">从本人ERP操作中勾选需要汇报的记录。调整理由选填，留空不影响提交；未勾选的记录不会出现在日报里。</div>
    <section v-for="(label, kind) in kinds" :key="kind" class="operation-category" :data-operation-kind="kind">
      <div class="operation-category-heading"><el-checkbox :model-value="sections.includes(kind)" :disabled="disabled" @change="checked => toggleSection(kind, checked)">{{ label }}</el-checkbox><span v-if="sections.includes(kind)" class="operation-count">已选 {{ chosen(kind).length }} 条</span><el-button v-if="sections.includes(kind)" text size="small" :icon="Refresh" :loading="state[kind].loading" :disabled="disabled" @click="load(kind)">刷新操作列表</el-button></div>
      <div v-if="sections.includes(kind)" class="operation-list">
        <p class="operation-source">{{ workDate }} · 北京时间 · 本人 · {{ kind === 'ads' ? '只含ERP广告操作，不含平台后台操作；广告金额为账户原币' : '只含ERP Listing提交，不含同步数据或未保存的上传草稿' }}</p>
        <el-alert v-if="state[kind].error" :title="state[kind].error" type="warning" :closable="false" show-icon />
        <div class="operation-bulk-selection"><el-checkbox :model-value="pageState(kind).all" :indeterminate="pageState(kind).partial" :disabled="disabled || state[kind].loading || !state[kind].rows.length" :aria-label="`${label}全选本页`" @change="checked => togglePage(kind, checked)">全选本页</el-checkbox><el-button text size="small" :disabled="disabled || !chosen(kind).length" :aria-label="`${label}全不选`" @click="clearKind(kind)">全不选</el-button><span>全不选清空本类所有页，理由暂留</span></div>
        <el-table class="operation-table" :data="state[kind].rows" v-loading="state[kind].loading" row-key="id" size="small" :empty-text="state[kind].error ? '操作列表读取未完成，可刷新重试' : '这个工作日暂无本人ERP操作记录'">
          <el-table-column label="汇报" width="60"><template #default="{row}"><el-checkbox :model-value="!!selected(row)" :disabled="disabled || (!selected(row) && activeCount >= 100)" :aria-label="`汇报${kind}操作${row.id}`" @change="checked => toggleRow(row, checked)" /></template></el-table-column>
          <el-table-column label="实际操作记录" min-width="330"><template #default="{row}"><div class="operation-object">{{ dailyOperationLabel(row, skuRows) }}</div><OperationChangeSummary :operation="row" /><div class="operation-meta"><span>{{ dailyReportTime(row.occurred_at) }}</span><el-tag size="small" effect="plain" :type="['failed','rejected'].includes(row.write_status) ? 'danger' : row.write_status === 'accepted' ? 'info' : 'warning'">{{ row.status_label }}</el-tag></div></template></el-table-column>
          <el-table-column label="调整理由 / 观察计划" min-width="300"><template #default="{row}"><el-input :model-value="selected(row)?.reason || ''" type="textarea" :autosize="{minRows:2,maxRows:5}" maxlength="1000" :disabled="disabled || !selected(row)" :aria-label="`${kind}操作${row.id}的理由`" :placeholder="selected(row) ? '为什么调整？后续观察什么？' : '先勾选左侧“汇报”，再填写理由'" @update:model-value="value => updateReason(row, value)" /></template></el-table-column>
        </el-table>
        <div class="operation-mobile-list" v-loading="state[kind].loading">
          <article v-for="row in state[kind].rows" :key="row.id" class="operation-mobile-item">
            <el-checkbox :model-value="!!selected(row)" :disabled="disabled || (!selected(row) && activeCount >= 100)" :aria-label="`汇报${kind}操作${row.id}`" @change="checked => toggleRow(row, checked)">汇报此操作</el-checkbox>
            <div class="operation-object">{{ dailyOperationLabel(row, skuRows) }}</div><OperationChangeSummary :operation="row" /><div class="operation-meta"><span>{{ dailyReportTime(row.occurred_at) }}</span><el-tag size="small" type="info">{{ row.status_label }}</el-tag></div>
            <el-input :model-value="selected(row)?.reason || ''" type="textarea" :autosize="{minRows:2,maxRows:5}" maxlength="1000" :disabled="disabled || !selected(row)" :aria-label="`${kind}操作${row.id}的理由`" placeholder="勾选汇报后，填写调整理由和观察计划" @update:model-value="value => updateReason(row, value)" />
          </article><p v-if="!state[kind].rows.length && !state[kind].loading" class="operation-source">{{ state[kind].error ? '操作列表读取未完成，可刷新重试' : '这个工作日暂无本人ERP操作记录' }}</p>
        </div>
        <div class="operation-paging"><span>候选 {{ state[kind].total }} 条 · 最多勾选100条</span><el-pagination v-model:current-page="state[kind].page" :page-size="10" :total="state[kind].total" layout="prev, pager, next" small :disabled="disabled" @current-change="load(kind)" /></div>
        <div v-if="offPage(kind).length" class="selected-operations"><strong>已勾选的其他页 / 已存档记录</strong><div v-for="row in offPage(kind)" :key="row.id" class="selected-operation"><div><span>{{ dailyOperationLabel(row, skuRows) }}</span><el-button text size="small" type="danger" :disabled="disabled" @click="toggleRow(row, false)">取消汇报</el-button></div><OperationChangeSummary :operation="row" /><el-input :model-value="selected(row)?.reason || ''" type="textarea" :autosize="{minRows:2,maxRows:5}" maxlength="1000" :disabled="disabled" :aria-label="`${kind}操作${row.id}的理由`" placeholder="为什么调整？后续观察什么？" @update:model-value="value => updateReason(row, value)" /></div></div>
      </div>
    </section>
    <p class="operation-footnote">“已接受提交”不等于平台已生效。取消类别勾选后，该类操作不计入本次日报；已填写理由暂留在当前窗口。</p>
    <p v-if="savedOperations.length" class="operation-footnote">已保存的引用沿用当时操作快照，不会因后续同步悄悄改变。</p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { getDailyReportOperations } from '@/services/api'
import { dailyReportTime } from '@/utils/dailyReportShare'
import OperationChangeSummary from '@/components/OperationChangeSummary.vue'
import { dailyOperationLabel } from '@/utils/dailyOperationLabel'
import { ElMessage } from 'element-plus'
import { pageSelection, selectPage } from '@/utils/dailyBulkSelection'

const props = defineProps({ shopId: { type: [Number,String], required:true }, marketplaceId: { type:String, required:true }, workDate: { type:String,required:true }, modelValue: { type:Array,default:()=>[] }, sections: { type:Array,default:()=>[] }, savedOperations: { type:Array,default:()=>[] }, skuRows: { type:Array,default:()=>[] }, disabled: Boolean })
const emit = defineEmits(['update:modelValue','update:sections','preview-update'])
const kinds = { listing:'Listing修改', ads:'广告调整' }
const state = reactive(Object.fromEntries(Object.keys(kinds).map(kind=>[kind,{rows:[],total:0,page:1,loading:false,error:'',loaded:false,revision:0}])))
const cache = reactive({}), reasonCache = {}
const key = row => `${row.kind}:${row.id}`
const evidence = computed(()=>Object.fromEntries([...Object.values(cache),...props.savedOperations].map(row=>[key(row),row])))
const selected = row => props.modelValue.find(item=>key(item)===key(row))
const activeCount = computed(()=>props.modelValue.filter(item=>props.sections.includes(item.kind)).length)
const chosen = kind => props.modelValue.filter(item=>item.kind===kind)
const offPage = kind => chosen(kind).map(item=>evidence.value[key(item)]).filter(row=>row && !state[kind].rows.some(item=>key(item)===key(row)))
let disposed=false
function toggleSection(kind,checked) { emit('update:sections',checked?[...props.sections.filter(item=>item!==kind),kind]:props.sections.filter(item=>item!==kind)) }
function toggleRow(row,checked) {
  if (props.disabled) return
  if (selected(row)) reasonCache[key(row)] = selected(row).reason || ''
  const next=props.modelValue.filter(item=>key(item)!==key(row))
  if (checked && activeCount.value<100) next.push({kind:row.kind,id:String(row.id),reason:reasonCache[key(row)]||''})
  emit('update:modelValue',next)
}
const pageState = kind => pageSelection(props.modelValue, state[kind].rows, key)
function rememberReasons(kind) { for (const row of chosen(kind)) reasonCache[key(row)] = row.reason || '' }
function togglePage(kind, checked) {
  if (props.disabled || state[kind].loading) return
  rememberReasons(kind)
  const active = props.modelValue.filter(row => props.sections.includes(row.kind))
  const inactive = props.modelValue.filter(row => !props.sections.includes(row.kind))
  const page = state[kind].rows.map(row => ({kind:row.kind, id:String(row.id), reason:reasonCache[key(row)] || ''}))
  try { emit('update:modelValue', [...inactive, ...selectPage(active, page, checked, 100, key)]) }
  catch { ElMessage.warning('Listing修改与广告调整合计最多勾选100条，请先取消部分已选记录') }
}
function clearKind(kind) {
  if (props.disabled) return
  rememberReasons(kind)
  emit('update:modelValue', props.modelValue.filter(row => row.kind !== kind))
}
function updateReason(row,value) { reasonCache[key(row)]=value; emit('update:modelValue',props.modelValue.map(item=>key(item)===key(row)?{...item,reason:value}:item)) }
async function load(kind) {
  const category=state[kind], current=++category.revision
  category.loading=true; category.error=''
  try {
    const response=await getDailyReportOperations({shop_id:props.shopId,marketplace_id:props.marketplaceId,work_date:props.workDate,kind,page:category.page,page_size:10})
    if (disposed || category.revision!==current) return
    category.rows=response.data.data.list.map(row=>props.savedOperations.find(saved=>key(saved)===key(row))||row); category.total=response.data.data.total; category.loaded=true
    for (const row of category.rows) cache[key(row)]=row
  } catch(err) { if (!disposed && category.revision===current) {category.rows=[];category.error=err.response?.data?.message||'读取操作记录失败，请重试'} }
  finally { if (!disposed && category.revision===current) category.loading=false }
}
watch(()=>props.sections,sections=>{for(const kind of sections)if(kinds[kind]&&!state[kind].loaded&&!state[kind].loading)load(kind)},{deep:true,immediate:true})
watch(()=>[props.modelValue,props.sections,evidence.value],()=>{
  const entries=props.modelValue.filter(item=>props.sections.includes(item.kind)).map(item=>{const row=evidence.value[key(item)];return row?{...row,reason:item.reason}:null}).filter(Boolean)
  emit('preview-update',entries)
},{deep:true,immediate:true})
onBeforeUnmount(()=>{disposed=true;for(const category of Object.values(state))category.revision++})
</script>

<style scoped>
.operation-bulk-selection{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}.operation-bulk-selection>span{font-size:11px;color:#8c9bb0}
.operation-mobile-list{display:none}.operation-mobile-item{padding:10px;background:#f8faff;border:1px solid #e5edf8;border-radius:7px}.operation-mobile-item>.el-textarea{margin-top:10px}
@media(max-width:760px){.operation-table{display:none}.operation-mobile-list{display:grid;gap:10px}}
.daily-operation-picker{margin:14px 0 18px}.operation-intro{font-size:12px;color:#8295b0;margin-bottom:12px;line-height:1.7}.operation-category{border:1px solid #e2eaf5;border-radius:8px;margin:10px 0;overflow:hidden}.operation-category-heading{display:flex;align-items:center;gap:12px;background:#f7faff;padding:5px 12px;flex-wrap:wrap}.operation-category-heading .el-checkbox{font-weight:600;color:#4c6c99}.operation-category-heading>.el-button{margin-left:auto}.operation-count,.operation-source,.operation-footnote{font-size:11px;color:#8c9bb0;line-height:1.7}.operation-source{margin:0 0 10px}.operation-list{padding:12px}.operation-object{font-weight:500;color:#4c6383;font-size:12px;overflow-wrap:anywhere}.operation-summary{white-space:pre-wrap;line-height:1.7;font-size:12px;color:#6c7e98;margin:5px 0;overflow-wrap:anywhere;max-height:160px;overflow-y:auto}.operation-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:10px;color:#98a5b7}.operation-meta .el-tag{font-size:10px;height:auto;line-height:1.6;white-space:normal}.operation-paging{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;font-size:11px;color:#98a5b7;flex-wrap:wrap}.selected-operations{margin-top:14px;font-size:12px;color:#7c90ae}.selected-operation{padding:10px;margin-top:8px;background:#f7faff;border:1px solid #e5edf7;border-radius:6px}.selected-operation>div:first-child{display:flex;justify-content:space-between;gap:12px;align-items:center}.selected-operation p{font-size:12px;white-space:pre-wrap;line-height:1.7;max-height:130px;overflow-y:auto}.operation-footnote{margin:8px 0 0}.operation-list>.el-alert{margin-bottom:10px}@media(max-width:650px){.operation-list{padding:8px}.operation-category-heading{gap:8px}.operation-paging{justify-content:flex-end}}
</style>
