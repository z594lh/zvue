<template>
  <section class="competitor-panel">
    <el-alert title="查竞品独立清单 · 美国站最近30天 · 多ASIN合并普通导出，核验整份报告后按商品入库，不导出明细" type="info" :closable="false" show-icon />
    <div class="tools">
      <el-input v-model="search" placeholder="搜索ASIN / 备注" clearable @keyup.enter="filter" @clear="filter" :disabled="saving" />
      <el-select v-model="enabled" placeholder="全部状态" clearable @change="filter" :disabled="saving"><el-option label="已启用" value="1" /><el-option label="已停用" value="0" /></el-select>
      <el-button @click="filter" :disabled="saving" :loading="loading">刷新 / 搜索</el-button>
      <el-button type="primary" @click="openAdd" :disabled="saving">批量添加ASIN</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table :data="rows" v-loading="loading" row-key="id">
      <el-table-column label="商品 / 查询ASIN" min-width="250"><template #default="{row}"><strong>{{ row.product_name || row.remark || '未关联商品资料' }}</strong><p>{{ row.asin }} · US</p><small>{{ row.related_products?.map(p=>p.sku).filter(Boolean).join(' / ') || '竞品 / 未关联店铺' }}</small></template></el-table-column>
      <el-table-column label="启用" width="85"><template #default="{row}"><el-switch :model-value="!!row.enabled" :disabled="saving" @change="value=>toggle(row,value)" /></template></el-table-column>
      <el-table-column prop="priority" label="优先级" width="85" />
      <el-table-column label="最近任务" min-width="240"><template #default="{row}"><el-tag :type="row.latest_status==='completed'?'success':['failed','parse_failed','action_required'].includes(row.latest_status)?'danger':'info'">{{ states[row.latest_status] || '尚未采集' }}</el-tag><small class="date">{{ row.latest_date || '' }}</small><p class="error" v-if="row.latest_error">{{ row.latest_error }}</p></template></el-table-column>
      <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      <el-table-column label="操作" width="160" fixed="right"><template #default="{row}"><el-button link type="primary" @click="openEdit(row)" :disabled="saving">编辑</el-button><el-button link type="primary" @click="showTasks(row.asin)">进度 / 报告</el-button></template></el-table-column>
      <template #empty>尚无配置或没有匹配项；添加并启用后，下轮虚拟机任务生效</template>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="total, prev, pager, next" @current-change="load" :disabled="loading || saving" />
    <el-dialog v-model="editingVisible" :title="form.id?'编辑查竞品配置':'批量添加查竞品ASIN'" width="min(560px,94vw)" append-to-body :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <el-form label-position="top" :disabled="saving">
        <el-form-item v-if="!form.id" label="ASIN（每行一个，最多200条；重复项保留原设置）"><el-input v-model="form.asins" type="textarea" :rows="5" maxlength="3000" /></el-form-item>
        <el-form-item v-else label="查询ASIN">{{ form.asin }}</el-form-item>
        <el-form-item label="启用采集"><el-switch v-model="form.enabled" /></el-form-item>
        <el-form-item label="优先级"><el-input-number v-model="form.priority" :min="0" :max="9999" :precision="0" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" maxlength="500" type="textarea" show-word-limit /></el-form-item>
      </el-form>
      <template #footer><el-button @click="editingVisible=false" :disabled="saving">取消</el-button><el-button type="primary" @click="save" :loading="saving">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="tasksVisible" :title="`查竞品进度 · ${tasksAsin}`" width="min(1150px,96vw)" append-to-body>
      <el-alert title="批量报告按ASIN分别记录进度和商品行，同批共享原报告编号。单项历史可能选中另一变体；只有清洗入库成功才显示完成。" type="info" :closable="false" />
      <el-alert v-if="taskError" :title="taskError" type="error" :closable="false" />
      <el-button @click="loadTasks" :loading="taskLoading">刷新进度</el-button>
      <el-table :data="tasks" v-loading="taskLoading">
        <el-table-column prop="record_date" label="采集日期" width="115" />
        <el-table-column label="状态" width="110"><template #default="{row}">{{ states[row.status] || row.status }}</template></el-table-column>
        <el-table-column prop="selected_asin" label="实际选中ASIN" width="145" />
        <el-table-column label="报告与VM路径" min-width="260"><template #default="{row}"><div>{{ row.file_name || '尚未下载' }}</div><small>报告编号：{{ row.report_id || '—' }}</small><br><small>VM：{{ row.local_path || '—' }}</small><div class="error">{{ row.error_message }}</div></template></el-table-column>
        <el-table-column label="商品快照" min-width="160"><template #default="{row}"><div>销量 {{ row.monthly_sales ?? '—' }} / 价格 {{ row.price ?? '—' }}</div><div>评分 {{ row.rating ?? '—' }} / BSR {{ row.bsr ?? '—' }}</div></template></el-table-column>
        <el-table-column label="操作" width="145"><template #default="{row}"><el-button v-if="row.status==='completed'" link type="primary" @click="details(row)" :disabled="detailLoading">全部字段</el-button></template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="taskPage" :total="taskTotal" :page-size="20" layout="total, prev, pager, next" @current-change="loadTasks" />
    </el-dialog>
    <el-dialog v-model="detailVisible" title="原报告全部字段（按来源名称展示，金额USD，重量尺寸保留单位）" width="min(950px,96vw)" append-to-body>
      <el-table :data="detailRows"><el-table-column prop="name" label="字段" min-width="220" /><el-table-column prop="value" label="来源值" min-width="380" /></el-table>
    </el-dialog>
  </section>
</template>
<script setup>
// 查竞品独立配置、报告进度和商品快照，不读取关键词任务。
// 查竞品独立页面：仅操作ERP配置和读取快照，不在浏览器触发网站采集。
import { ref,onMounted,onBeforeUnmount,onDeactivated,watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getSellerspriteCompetitorAsins,addSellerspriteCompetitorAsins,updateSellerspriteCompetitorAsin,getSellerspriteCompetitorTasks,getSellerspriteCompetitorSnapshot } from '@/services/api'
const emit=defineEmits(['busy'])
const rows=ref([]),total=ref(0),page=ref(1),search=ref(''),enabled=ref(''),loading=ref(false),saving=ref(false),error=ref('')
const form=ref({}),editingVisible=ref(false),tasksVisible=ref(false),tasksAsin=ref(''),tasks=ref([]),taskPage=ref(1),taskTotal=ref(0),taskLoading=ref(false),taskError=ref(''),detailLoading=ref(false),detailVisible=ref(false),detailRows=ref([])
const states={pending:'待采集',running:'查询 / 生成报告中',downloaded:'已下载待上传',completed:'已清洗入库',failed:'采集失败',action_required:'需人工处理',parse_failed:'清洗失败'}
let disposed=false,revision=0,taskRevision=0
watch(saving,value=>emit('busy',value))
const message=e=>e.response?.data?.message || '请求失败，请刷新确认结果'
async function load(){const n=++revision;loading.value=true;error.value='';try{const r=await getSellerspriteCompetitorAsins({page:page.value,search:search.value,enabled:enabled.value});if(disposed||n!==revision)return;rows.value=r.data.data.list;total.value=r.data.data.total}catch(e){if(!disposed&&n===revision){error.value=message(e);rows.value=[];total.value=0}}finally{if(!disposed&&n===revision)loading.value=false}}
function filter(){page.value=1;load()}
function openAdd(){form.value={asins:'',enabled:true,priority:0,remark:''};editingVisible.value=true}
function openEdit(row){form.value={...row,enabled:!!row.enabled};editingVisible.value=true}
function body(row){return {marketplace:'US',enabled:row.enabled?1:0,priority:row.priority,remark:row.remark,version:row.version}}
async function save(){if(saving.value)return;saving.value=true;try{if(form.value.id)await updateSellerspriteCompetitorAsin(form.value.id,body(form.value));else await addSellerspriteCompetitorAsins({...body(form.value),asins:form.value.asins});editingVisible.value=false;ElMessage.success('查竞品配置已保存，下一轮生效');await load()}catch(e){ElMessage.error(message(e))}finally{saving.value=false}}
async function toggle(row,value){if(saving.value)return;saving.value=true;try{await updateSellerspriteCompetitorAsin(row.id,{...body(row),enabled:value?1:0});await load()}catch(e){ElMessage.error(message(e))}finally{saving.value=false}}
function showTasks(asin){tasksAsin.value=asin;taskPage.value=1;tasksVisible.value=true;loadTasks()}
async function loadTasks(){const n=++taskRevision;taskLoading.value=true;taskError.value='';try{const r=await getSellerspriteCompetitorTasks(tasksAsin.value,{page:taskPage.value});if(disposed||n!==taskRevision)return;tasks.value=r.data.data.list;taskTotal.value=r.data.data.total}catch(e){if(!disposed&&n===taskRevision){taskError.value=message(e);tasks.value=[]}}finally{if(!disposed&&n===taskRevision)taskLoading.value=false}}
async function details(row){detailLoading.value=true;try{const r=await getSellerspriteCompetitorSnapshot(row.id);detailRows.value=Object.entries(JSON.parse(r.data.data.raw_row_json)).map(([name,value])=>({name,value:value??'未提供'}));detailVisible.value=true}catch(e){ElMessage.error(message(e))}finally{detailLoading.value=false}}
onMounted(load);onDeactivated(()=>{editingVisible.value=false;tasksVisible.value=false;detailVisible.value=false;taskRevision++});onBeforeUnmount(()=>{disposed=true;revision++;taskRevision++;emit('busy',false)})
</script>
<style scoped>
.competitor-panel{background:white;border:1px solid #e8edf5;border-radius:12px;padding:20px}.tools{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.tools .el-input{width:300px}.tools .el-select{width:150px}p{margin:5px 0}.date{margin-left:8px}small{color:#8492a6;overflow-wrap:anywhere}.error{font-size:12px;color:#c45656;overflow-wrap:anywhere}.el-pagination{margin-top:18px;justify-content:flex-end}.el-alert{margin-bottom:12px}@media(max-width:600px){.competitor-panel{padding:12px}.tools .el-input{width:100%}}
</style>
