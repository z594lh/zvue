<template>
  <main class="sprite-config"><header><div><h1>卖家精灵待抓取ASIN配置</h1><p>只采集这里启用的美国站ASIN，不再按库存或销量自动筛选。</p></div><el-button type="primary" :icon="Plus" :disabled="loading || saving" @click="openAdd">批量添加ASIN</el-button></header>
    <el-alert title="保存只更新下一轮待抓范围，不会立即采集。停用不删除历史数据，也不取消已领取任务的补传。" type="info" show-icon :closable="false" />
    <div class="sprite-config-tools"><el-input v-model="search" placeholder="搜索 ASIN / 备注" clearable @keyup.enter="filter" @clear="filter" /><el-select v-model="enabled" placeholder="全部状态" clearable @change="filter"><el-option label="已启用" value="1" /><el-option label="已停用" value="0" /></el-select><el-button :icon="Search" :disabled="loading || saving" @click="filter">搜索</el-button><el-button :icon="Refresh" :loading="loading" :disabled="saving" @click="load">刷新</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-table :data="rows" v-loading="loading" row-key="id" stripe><el-table-column prop="asin" label="ASIN" min-width="135" /><el-table-column prop="marketplace" label="站点" width="70" /><el-table-column label="启用采集" width="100"><template #default="{row}"><el-switch :model-value="!!row.enabled" :disabled="saving || loading" :loading="busyId===row.id" :aria-label="`启用${row.asin}`" @change="value=>toggle(row,value)" /></template></el-table-column><el-table-column prop="priority" label="优先级" width="90" /><el-table-column prop="remark" label="备注" min-width="210" show-overflow-tooltip /><el-table-column label="最近任务" width="130"><template #default="{row}">{{ spriteStates[row.latest_status] || row.latest_status || '尚无任务' }}</template></el-table-column><el-table-column prop="updated_by_name" label="修改人" min-width="100" /><el-table-column label="修改时间（北京）" width="170"><template #default="{row}">{{ spriteTime(row.updated_at) }}</template></el-table-column><el-table-column label="操作" width="85" fixed="right"><template #default="{row}"><el-button link type="primary" :disabled="saving" @click="openEdit(row)">编辑</el-button></template></el-table-column><template #empty>{{ error ? '配置读取未完成，请刷新重试' : '尚未配置ASIN，不会产生新的待抓任务' }}</template></el-table>
    <el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="total, prev, pager, next" :disabled="loading || saving" @current-change="load" />
    <el-dialog v-model="visible" :title="editing ? '编辑ASIN配置' : '批量添加ASIN'" width="min(580px, 94vw)" append-to-body :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <el-form label-position="top" :disabled="saving"><el-form-item v-if="!editing" label="ASIN（每行一个，最多200个；重复项保持原设置）"><el-input v-model="form.asins" type="textarea" :rows="6" maxlength="3000" placeholder="B0XXXXXXXX&#10;B0YYYYYYYY" aria-label="待抓取ASIN列表" /></el-form-item><el-form-item v-else label="ASIN / 站点"><strong>{{ form.asin }} · US</strong></el-form-item><el-form-item label="启用采集"><el-switch v-model="form.enabled" /></el-form-item><el-form-item label="优先级（越大越先采集）"><el-input-number v-model="form.priority" :min="0" :max="9999" :precision="0" /></el-form-item><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item></el-form>
      <template #footer><el-button :disabled="saving" @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存配置</el-button></template>
    </el-dialog>
  </main>
</template>
<script>export default {name:'SellerspriteConfigView'}</script>
<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import { addSellerspriteAsins, getSellerspriteAsins, updateSellerspriteAsin } from '@/services/api'
import { spriteStates, spriteTime } from '@/utils/sellersprite'
const rows=ref([]),total=ref(0),page=ref(1),search=ref(''),enabled=ref(''),loading=ref(false),saving=ref(false),error=ref(''),visible=ref(false),editing=ref(null),busyId=ref(null),form=ref({})
let disposed=false,revision=0
const message=err=>err.response?.data?.message || '保存结果待确认，请刷新查看，勿反复提交'
async function load(){const current=++revision;loading.value=true;error.value='';try{const res=await getSellerspriteAsins({page:page.value,page_size:20,search:search.value,enabled:enabled.value});if(disposed || current!==revision)return;rows.value=res.data.data.list;total.value=res.data.data.total}catch(err){if(!disposed && current===revision){error.value=err.response?.data?.message || '读取配置失败，请重试';rows.value=[]}}finally{if(!disposed && current===revision)loading.value=false}}
function filter(){page.value=1;load()}
function openAdd(){editing.value=null;form.value={asins:'',enabled:true,priority:0,remark:''};visible.value=true}
function openEdit(row){editing.value=row.id;form.value={...row,enabled:!!row.enabled};visible.value=true}
function body(value){return {enabled:value.enabled?1:0,priority:value.priority,remark:value.remark,version:value.version,marketplace:'US'}}
async function save(){if(saving.value)return;saving.value=true;try{if(editing.value){await updateSellerspriteAsin(editing.value,body(form.value));ElMessage.success('配置已保存')}else{const res=await addSellerspriteAsins({...body(form.value),asins:form.value.asins});ElMessage.success(`新增${res.data.data.created}条，已有${res.data.data.existing}条保持原设置`)}visible.value=false;await load()}catch(err){ElMessage.error(message(err))}finally{saving.value=false}}
async function toggle(row,value){if(saving.value)return;saving.value=true;busyId.value=row.id;try{await updateSellerspriteAsin(row.id,{...body(row),enabled:value?1:0});ElMessage.success(value?'已启用下一轮采集':'已停用新采集，历史数据保留');await load()}catch(err){error.value=message(err);ElMessage.error(error.value)}finally{saving.value=false;busyId.value=null}}
onMounted(load);onBeforeUnmount(()=>{disposed=true;revision++})
</script>
<style scoped>
.sprite-config{max-width:1420px;margin:0 auto;padding:24px}.sprite-config header{display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:18px}.sprite-config h1{font-size:24px;color:#254466}.sprite-config p{font-size:13px;color:#8293aa}.sprite-config-tools{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.sprite-config-tools .el-input{width:260px}.sprite-config-tools .el-select{width:150px}.sprite-config>.el-pagination{justify-content:flex-end;margin-top:18px}.sprite-config>.el-alert{margin:14px 0}@media(max-width:700px){.sprite-config{padding:12px}.sprite-config-tools .el-input{width:100%}}
</style>
