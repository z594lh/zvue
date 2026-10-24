<template>
  <section class="tool-browser">
    <details class="query-configuration" :open="!output"><summary>商品、数据来源与查询条件{{ output?'（点击更换）':'' }}</summary>
    <p class="readonly-note">只读核对工具返回 · 不调用DeepSeek、不生成方案、不修改Amazon，不写入会话记忆。</p>
    <div class="browser-field"><label>选择托管商品 <small>店铺、账户、站点随商品绑定</small></label><el-select v-model="managedId" filterable remote :remote-method="searchManaged" :loading="managedLoading" placeholder="输入ASIN、SKU或中文名搜索" @change="loadSources"><el-option v-for="item in managed" :key="item.id" :value="item.id" :label="`${item.product_name || item.asin} · ${item.asin} · ${item.shop_name}`"/></el-select><small>每次显示前20个匹配项；未找到时请输入完整ASIN搜索。</small></div>
    <el-radio-group v-model="mode" class="source-modes" @change="clearResult"><el-radio-button value="actual">AI实际收到的数据</el-radio-button><el-radio-button value="snapshot">用原任务资料试查</el-radio-button><el-radio-button value="current">用当前ERP资料试查</el-radio-button></el-radio-group>
    <div v-loading="sourceLoading" class="source-panel">
      <template v-if="mode==='snapshot'"><label>选择原任务资料 <small>固定同一次数据，翻页不会漂移</small></label><el-select v-model="archiveKey" placeholder="请选择冻结资料" :disabled="!managedId" @change="clearResult"><el-option v-for="row in sources.archives" :key="`${row.kind}:${row.id}`" :value="`${row.kind}:${row.id}`" :label="`${row.kind==='plan'?'方案':'问答任务'} #${row.id} · 截止 ${row.report_date} · ${time(row.created_at)}`"/></el-select><p v-if="managedId && !sourceLoading && !sources.archives.length" class="browser-hint">尚无可用冻结资料。可以切换“当前本地资料试查”，无需先付费调用AI。</p></template>
      <template v-else-if="mode==='actual'"><label>选择该工具的实际调用 <small>默认最近一次；只显示原始返回，不用今天数据补写</small></label><el-select v-model="callKey" :disabled="!managedId" placeholder="请选择实际调用" @change="clearResult"><el-option v-for="row in sources.calls" :key="`${row.message_id}:${row.call_id}`" :value="`${row.message_id}:${row.call_id}`" :label="`${time(row.created_at)} · 第${row.round}轮 · 消息 #${row.message_id}`"/></el-select><p v-if="managedId && !sourceLoading && !sources.calls.length" class="browser-hint">此ASIN近期没有该工具的实际回包。如需核对当前资料，请自行切换只读试查；不会替换成今天的数据。</p></template>
      <template v-else><label>报表截止日 <small>只读ERP本地库，不向Amazon重抓</small></label><el-date-picker v-model="reportDate" type="date" value-format="YYYY-MM-DD" :clearable="false" @change="clearResult"/><p class="browser-hint">重新读取当前本地资料，不创建持久快照。要复查AI当时收到什么，请使用“AI实际收到的返回”。</p></template>
    </div>
    <section v-if="mode!=='actual'" class="parameter-editor">
      <template v-if="paged"><div class="query-fields"><div><label>查询对象（可留空）</label><el-input v-model="query.ref" :placeholder="tool.name==='read_chat_history'?'检索历史问答中的文字':'精确SKU / 对象引用 / 完整关键词'" @input="clearResult"/></div><div><label>统计时间范围</label><el-select v-model="query.window" @change="clearResult"><el-option v-for="w in windowOptions" :key="w.value" :value="w.value" :label="w.label"/></el-select></div><div><label>从第几条开始（跳过）</label><el-input-number v-model="query.offset" :min="0" :max="10000" controls-position="right" @change="clearResult"/></div><div><label>工具本次最多取几条</label><el-input-number v-model="query.limit" :min="1" :max="1000" controls-position="right" @change="clearResult"/></div></div><p class="browser-hint">{{ refHelp }} 页面表格每页10条，不会把AI默认查询条数改成10。</p></template>
      <template v-else-if="tool.name==='simulate_price'"><div class="query-fields"><div v-for="field in priceFields" :key="field.key"><label>{{ field.label }}</label><el-input v-model="price[field.key]" :placeholder="field.example" @input="clearResult"/></div></div><p class="browser-hint">费率填小数，如0.15表示15%；不会修改售价。</p></template>
      <template v-else-if="tool.name==='read_data_bundle'"><label>组合查询 <small>一次1～4项，每项独立返回；结果不会跨报告累加。</small></label><div v-for="(item,i) in bundleRows" :key="i" class="bundle-query"><strong>查询 {{ i+1 }}</strong><el-select v-model="item.tool" aria-label="组合查询工具" @change="clearResult"><el-option v-for="name in bundleTools" :key="name" :value="name" :label="toolLabel(name)"/></el-select><el-input v-model="item.ref" placeholder="对象引用 / SKU（可留空）" @input="clearResult"/><el-select v-model="item.window" aria-label="组合查询统计窗口" @change="clearResult"><el-option v-for="w in bundleWindows" :key="w" :value="w" :label="dictionaryLabel('data.window',w,w)"/></el-select><el-input-number v-model="item.limit" :min="1" :max="1000" aria-label="组合查询条数上限" @change="clearResult"/><el-input-number v-model="item.offset" :min="0" :max="10000" aria-label="组合查询跳过条数" @change="clearResult"/><el-button :disabled="bundleRows.length===1" @click="removeQuery(i)">移除</el-button></div><p class="browser-hint">条数上限默认1000；最后一项数字是已跳过条数，默认0。页面每页10条，与查询上限独立。</p><el-button :disabled="bundleRows.length>=4" @click="addQuery">增加查询</el-button></template>
      <p v-else class="browser-hint">此工具无参数，自动使用所选ASIN与资料时间；运营综合概览是精简摘要，并非所有明细。</p>
    </section>
    <div class="browser-actions"><el-button type="primary" :disabled="!canRead" :loading="reading" @click="read">{{ mode==='actual'?'查看实际返回':'只读查询预览' }}</el-button><small>{{ tool.guide?.pagination }}</small></div>
    </details>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <section v-if="output" class="preview-output"><div class="preview-heading"><el-tag :type="output.mode==='actual'?'success':'info'">{{ output.mode==='actual'?'实际交给AI的返回':'只读预览 · 未发送AI' }}</el-tag><span>返回时间 {{ time(output.created_at) || '未记录' }}</span><span>报表截至 {{ output.result?.time?.report_end || output.result?.report_end || output.report_end || '原返回未记录' }}</span><span>{{ Math.ceil(output.result_bytes/1024) }} KB</span></div><AiToolResult :result="output.result" :tool-name="tool.name" :mode="output.mode"/><el-button v-if="canContinue" @click="nextArchivePage">另作只读试查：继续查询未返回的数据</el-button><details class="query-raw"><summary>{{ output.mode==='actual'?'AI当时使用的查询参数与来源编号':'本次试查参数与来源编号' }}（原始JSON）</summary><p>所选范围仅用于查询定位，不意味着工具回包包含全部商品资料。{{ output.note }}</p><pre>{{ pretty({arguments:output.arguments,message_id:output.message_id,round:output.round,payload_hash:output.payload_hash,identity:output.identity}) }}</pre></details></section>
  </section>
</template>
<script setup>
import { computed,onBeforeUnmount,onMounted,ref,watch } from 'vue'
import { getAiManagedAsins,getAiToolSources,previewAiTool } from '@/services/api'
import { pretty } from '@/utils/aiToolData'
import { conversationTime } from '@/utils/aiOperationConversation'
import { dictionaryLabel } from '@/utils/businessDictionary'
import { toolLabel } from '@/utils/aiToolData'
import AiToolResult from './AiToolResult.vue'
const props=defineProps({tool:{type:Object,required:true}})
const emit=defineEmits(['context-change'])
const managed=ref([]),managedId=ref(''),managedLoading=ref(false),sourceLoading=ref(false),sources=ref({archives:[],calls:[]}),archiveKey=ref(''),callKey=ref(''),mode=ref('actual'),reading=ref(false),error=ref(''),output=ref(null)
const selectedManaged=ref(null)
const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1)
const reportDate=ref(`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`)
const query=ref({ref:'',window:'all',offset:0,limit:1000}),price=ref({sku:'',selling_price:'11.99',ad_rate:'0.15',refund_rate:'0.03'})
const bundleTools=props.tool.parameters?.properties?.queries?.items?.properties?.tool?.enum || []
const bundleWindows=['all','daily','d1','d3','d7','p7','d14','p14','d30','p30']
const bundleRows=ref([{tool:bundleTools[0] || 'read_business',ref:'',window:'all',limit:1000,offset:0}])
const paged=computed(()=>Object.prototype.hasOwnProperty.call(props.tool.parameters?.properties || {},'limit'))
const windowOptions=computed(()=>props.tool.guide?.parameters.find(p=>p.key==='window')?.choices || [])
const refHelp=computed(()=>props.tool.guide?.parameters.find(p=>p.key==='ref')?.help || '')
const priceFields=[{key:'sku',label:'当前ASIN的SKU',example:'精确SKU'},{key:'selling_price',label:'假设售价（币种由工具返回）',example:'11.99'},{key:'ad_rate',label:'广告费率',example:'0.15 = 15%'},{key:'refund_rate',label:'退款费率',example:'0.03 = 3%'}]
const canRead=computed(()=>managedId.value && !sourceLoading.value && !reading.value && (mode.value==='snapshot'?archiveKey.value:mode.value==='actual'?callKey.value:reportDate.value))
const canContinue=computed(()=>paged.value && mode.value!=='actual' && output.value?.result?.next_offset!=null && output.value.result.next_offset<=10000)
let active=true,sourceVersion=0,managedVersion=0,readVersion=0
/** 统一显示北京时间；历史API未写Z的时间仍由项目统一格式化。 */
function time(value){return conversationTime(value)}
/** 增减白名单内的组合查询项；不接受执行工具或递归批量调用。 */
function addQuery(){if(bundleRows.value.length<4){bundleRows.value.push({tool:bundleTools[0],ref:'',window:'all',limit:1000,offset:0});clearResult()}}
/** 至少保留一项，删除只改变本地试查条件。 */
function removeQuery(index){if(bundleRows.value.length>1){bundleRows.value.splice(index,1);clearResult()}}
/** 换来源或参数后立即清除旧结果，迟到响应不能显示到新商品。 */
function clearResult(){readVersion++;output.value=null;error.value='';reading.value=false}
/** 按关键词查询前20个托管项，不默认静默漏掉后续商品。 */
async function searchManaged(keyword=''){const v=++managedVersion;managedLoading.value=true;try{const {data}=await getAiManagedAsins({keyword,page:1});if(active && v===managedVersion)managed.value=data.data.list}catch(e){if(active && v===managedVersion)error.value=e.response?.data?.message || '托管商品读取失败'}finally{if(active && v===managedVersion)managedLoading.value=false}}
/** 商品变化后核对可用冻结资料和真实调用；只获取目录，不自动试查。 */
async function loadSources(){
  selectedManaged.value=managed.value.find(m=>m.id===managedId.value) || null
  clearResult();const v=++sourceVersion
  sources.value={archives:[],calls:[]};archiveKey.value='';callKey.value=''
  if(!managedId.value)return
  sourceLoading.value=true
  try{
    const {data}=await getAiToolSources(props.tool.name,{managed_id:managedId.value})
    if(!active || v!==sourceVersion)return
    sources.value=data.data
    if(data.data.suggested_report_end)reportDate.value=data.data.suggested_report_end
    const a=sources.value.archives[0],c=sources.value.calls[0]
    archiveKey.value=a?`${a.kind}:${a.id}`:'';callKey.value=c?`${c.message_id}:${c.call_id}`:''
  }catch(e){if(active && v===sourceVersion)error.value=e.response?.data?.message || '资料目录读取失败'}
  finally{if(active && v===sourceVersion)sourceLoading.value=false}
}
/** 仅显式点击执行只读查询；计划提交不渲染此组件，后端也强制拒绝。 */
async function read(){
  if(!canRead.value)return
  const v=++readVersion;reading.value=true;error.value='';output.value=null
  try{
    let body={managed_id:managedId.value,mode:mode.value}
    if(mode.value==='actual'){
      const c=sources.value.calls.find(c=>`${c.message_id}:${c.call_id}`===callKey.value)
      body={...body,message_id:c.message_id,call_id:c.call_id}
    }else{
      body.arguments=paged.value?{...query.value}:props.tool.name==='simulate_price'?{...price.value}:props.tool.name==='read_data_bundle'?{queries:bundleRows.value.map(row=>({...row}))}:{}
      if(mode.value==='snapshot'){
        const [kind,id]=archiveKey.value.split(':');Object.assign(body,{archive_kind:kind,archive_id:id})
      }else body.report_date=reportDate.value
    }
    const {data}=await previewAiTool(props.tool.name,body)
    if(active && v===readVersion)output.value=data.data
  }catch(e){if(active && v===readVersion)error.value=e instanceof SyntaxError?'组合查询JSON无效，请核对逗号、引号和括号':e.response?.data?.message || '只读查询未完成；没有调用AI或修改Amazon'}
  finally{if(active && v===readVersion)reading.value=false}
}
/** 按工具明确返回的游标续查，不推测完整对象数量或跳过未返回记录。 */
function nextArchivePage(){const next=output.value?.result?.next_offset;if(next==null)return;query.value.offset=next;clearResult();read()}
/** 组件销毁后不显示迟到查询，关闭页面不会创建后台作业。 */
function stop(){active=false;sourceVersion++;managedVersion++;readVersion++}
/** 固定标题栏仅同步查询范围与该回包来源，不为实际返回补充业务字段。 */
function emitContext(){const target=selectedManaged.value;const source=output.value?(output.value.mode==='actual'?'AI实际收到':'只读试查 · 未发送AI'):'尚未读取工具返回';emit('context-change',target?`查询范围：${target.product_name || ''} · ${target.asin} · ${target.shop_name || '店铺未记录'} ｜ ${source}`:'请选择商品，并核对实际返回或显式只读试查。')}
watch([selectedManaged,output],emitContext,{immediate:true})
onMounted(()=>searchManaged());onBeforeUnmount(stop)
</script>
<style scoped>
.readonly-note{font-size:12px;color:#7790ad;margin:0 0 16px}.query-configuration{padding:14px 18px;background:#f8fafd;border:1px solid #e1e9f3;border-radius:10px}.query-configuration>summary{font-weight:600;color:#426b9c}.preview-output .selected-scope{font-size:12px;color:#6383a8;background:#f5f8fd;padding:12px 16px;border-radius:8px}.bundle-query{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0;padding:14px;background:#f4f7fc;border-radius:8px}.bundle-query>.el-select{width:190px}.bundle-query>.el-input{width:225px}.bundle-query strong{font-size:12px;color:#5e7b9e}.query-raw{margin:20px 0}
.tool-browser{min-width:0}.browser-field{margin:20px 0}.browser-field>.el-select,.source-panel>.el-select{width:100%}label{display:block;font-size:13px;color:#3c5575;margin:0 0 9px;font-weight:600}small{font-size:11px;font-weight:normal;color:#8093ad;line-height:1.8}label small{display:block;margin-top:3px}.browser-field>small{display:block}.source-modes{margin-bottom:16px;max-width:100%;display:flex;flex-wrap:wrap;gap:2px}.source-panel{background:#f6f9fe;padding:16px;border-radius:10px;margin-bottom:18px}.browser-hint{font-size:12px;line-height:1.8;color:#7e91ab}.query-fields{display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr;gap:12px}.query-fields .el-input-number{width:100%}.browser-actions{display:flex;align-items:center;gap:16px;margin:20px 0}.browser-actions small{max-width:620px}.preview-output{border-top:1px solid #e2eaf5;padding-top:20px}.preview-heading{display:flex;align-items:center;gap:14px;font-size:12px;color:#8798ae}.preview-output>p{font-size:12px;line-height:1.8;color:#7187a3}summary{font-size:12px;color:#527eb5;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:30vh;overflow:auto;background:#f6f8fc;padding:12px;font-size:12px}@media(max-width:700px){.query-fields{grid-template-columns:1fr 1fr}.browser-actions{align-items:flex-start;flex-direction:column}.preview-heading{align-items:flex-start;flex-direction:column}}@media(max-width:420px){.query-fields{grid-template-columns:1fr}.source-modes :deep(.el-radio-button__inner){font-size:11px;padding:8px}}
</style>
