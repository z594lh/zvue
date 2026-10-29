<template>
  <main class="sprite-config">
    <header class="sprite-config-header">
      <div class="sprite-config-title"><div class="sprite-config-mark"><el-icon><DataAnalysis /></el-icon></div><div><h1>卖家精灵采集配置</h1><p>管理待抓ASIN，自动关联本地商品与店铺资料</p></div></div>
      <el-button v-if="collectionKind==='keywords'" type="primary" :icon="Plus" :disabled="loading || saving" @click="openAdd">批量添加ASIN</el-button>
    </header>
    <el-tabs v-model="collectionKind" :before-leave="() => !saving && !competitorBusy"><el-tab-pane label="关键词反查" name="keywords" /><el-tab-pane name="competitors"><template #label><FeatureGuide feature-key="sellersprite-competitor-reports-v1" title="新增查竞品报告" description="在这里添加竞品 ASIN，采集销量、价格、排名等商品数据，与关键词反查分开管理。" :enabled="collectionKind === 'keywords' && !visible && !tasksVisible"><span>查竞品报告</span></FeatureGuide></template></el-tab-pane></el-tabs>
    <SellerspriteCompetitorPanel v-if="collectionKind==='competitors'" @busy="competitorBusy=$event" />
    <template v-else>
    <div class="sprite-config-hint"><el-tag size="small" effect="plain">美国站 US</el-tag><span>仅采集启用的ASIN · 保存后下一轮生效 · 停用保留历史和已领取任务的补传</span></div>
    <section class="sprite-config-panel">
      <div class="sprite-config-tools">
        <el-input v-model="search" placeholder="搜索 ASIN / 中文名 / SKU / 店铺 / 备注" :prefix-icon="Search" clearable :disabled="saving" @keyup.enter="filter" @clear="filter" />
        <el-select v-model="ownership" placeholder="全部商品归属" aria-label="商品归属筛选" clearable :disabled="saving" @change="filter"><el-option label="本店商品" value="owned" /><el-option label="系统商品（未关联店铺）" value="catalog" /><el-option label="竞品 / 未关联本店" value="external" /></el-select>
        <el-select v-model="enabled" class="sprite-enabled-filter" placeholder="全部采集状态" aria-label="采集状态筛选" clearable :disabled="saving" @change="filter"><el-option label="已启用" value="1" /><el-option label="已停用" value="0" /></el-select>
        <el-button type="primary" :disabled="loading || saving" @click="filter">搜索</el-button><el-button :icon="Refresh" :loading="loading" :disabled="saving" @click="load">刷新</el-button>
      </div>
      <div class="sprite-config-caption"><strong>采集清单 <span>{{ total }} 项</span></strong><span>归属按本地美国站资料识别；未匹配不代表一定是竞品</span></div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-table :data="rows" v-loading="loading" row-key="id" class="sprite-config-table" :row-class-name="({row})=>row.enabled ? '' : 'sprite-paused-row'">
        <el-table-column label="商品信息" min-width="350">
          <template #default="{row}">
            <div class="sprite-product">
              <el-image v-if="safeImage(row.image_url)" :src="safeImage(row.image_url)" :preview-src-list="[safeImage(row.image_url)]" preview-teleported fit="contain" loading="lazy" class="sprite-product-image"><template #error><div class="sprite-image-empty"><el-icon><Picture /></el-icon><span>图片不可用</span></div></template></el-image>
              <div v-else class="sprite-product-image sprite-image-empty"><el-icon><Picture /></el-icon><span>暂无图片</span></div>
              <div class="sprite-product-text">
                <strong :title="row.product_name || ''">{{ row.product_name || (row.ownership === 'external' || !row.ownership ? (row.remark || '未关联商品资料') : '中文名称未维护') }}</strong>
                <div class="sprite-product-asin"><span>{{ row.asin }}</span><el-tooltip content="复制ASIN" placement="top"><el-button link :icon="CopyDocument" :aria-label="`复制ASIN ${row.asin}`" @click="copyAsin(row.asin)" /></el-tooltip><small>US</small></div>
                <p v-if="row.item_name" :title="row.item_name">{{ row.item_name }}</p>
                <p v-else class="sprite-product-missing">{{ row.ownership === 'external' || !row.ownership ? '可用备注为竞品添加易识别的名称' : '商品名称来自系统商品资料' }}</p>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="商品归属" width="155"><template #default="{row}"><div class="sprite-ownership"><el-tag :type="row.ownership === 'owned' ? 'success' : row.ownership === 'catalog' ? 'warning' : 'info'" effect="light">{{ ownershipLabel(row) }}</el-tag><small>{{ row.ownership === 'owned' ? '已匹配本店Listing' : row.ownership === 'catalog' ? '已匹配系统商品资料' : '未匹配本店Listing' }}</small></div></template></el-table-column>
        <el-table-column label="关联店铺 / SKU" min-width="225">
          <template #default="{row}">
            <div v-for="(item,index) in (row.related_products || []).slice(0,2)" :key="`${item.shop_id}:${item.sku}:${index}`" class="sprite-owner">
              <div><strong>{{ item.shop_name || '未关联店铺' }}</strong><el-tag v-if="item.shop_id && !item.shop_enabled" type="info" size="small">店铺停用</el-tag></div><span>{{ item.sku || 'SKU未维护' }}</span>
            </div>
            <el-popover v-if="row.related_products?.length > 2" placement="bottom" :width="350" trigger="click"><template #reference><el-button link type="primary">查看全部 {{ row.related_products.length }} 个关联</el-button></template><div class="sprite-owner-popover"><div v-for="(item,index) in row.related_products" :key="index" class="sprite-owner"><div><strong>{{ item.shop_name || '未关联店铺' }}</strong><span v-if="item.shop_id && !item.shop_enabled">（店铺停用）</span></div><span>{{ item.sku }} · {{ item.product_name || '中文名称未维护' }}</span></div></div></el-popover>
            <span v-if="!row.related_products?.length" class="sprite-no-owner">暂无店铺关联</span>
          </template>
        </el-table-column>
        <el-table-column label="采集开关" width="100" align="center"><template #default="{row}"><el-switch :model-value="!!row.enabled" :disabled="saving || loading" :loading="busyId===row.id" :aria-label="`启用${row.asin}`" @change="value=>toggle(row,value)" /><div class="sprite-switch-note">{{ row.enabled ? '已启用' : '已停用' }}</div></template></el-table-column>
        <el-table-column prop="priority" label="优先级" width="80" align="center" />
        <el-table-column label="最近任务 / 诊断" min-width="230"><template #default="{row}"><el-tag :type="taskTone(row.latest_status)" size="small" effect="light">{{ spriteStates[row.latest_status] || row.latest_status || '尚无任务' }}</el-tag><small class="sprite-task-date">{{ row.latest_date || '' }}</small><p v-if="row.latest_status && row.latest_status!=='completed'" class="sprite-task-reason">{{ row.diagnostic?.stage_label }}：{{ row.diagnostic?.message }}</p><el-button link type="primary" @click="openTasks(row)">任务与补救</el-button></template></el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip><template #default="{row}"><span :class="{'sprite-no-owner': !row.remark}">{{ row.remark || '未填写' }}</span></template></el-table-column>
        <el-table-column label="最近修改" width="165"><template #default="{row}"><div class="sprite-updated"><span>{{ row.updated_by_name || '—' }}</span><small>{{ spriteTime(row.updated_at) }}</small><small>北京时间</small></div></template></el-table-column>
        <el-table-column label="操作" width="78" fixed="right"><template #default="{row}"><el-button link type="primary" :disabled="saving || loading" @click="openEdit(row)">编辑</el-button></template></el-table-column>
        <template #empty><div class="sprite-config-empty"><el-icon><DataAnalysis /></el-icon><strong>{{ error ? '配置读取未完成，请刷新重试' : search || ownership || enabled ? '没有符合条件的ASIN，请调整筛选' : '尚未配置ASIN，不会产生新的待抓任务' }}</strong><span v-if="!error">添加自有商品或竞品ASIN，启用后进入下一轮采集</span></div></template>
      </el-table>
      <el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="total, prev, pager, next" :disabled="loading || saving" @current-change="load" />
    </section>
    <SellerspriteKeywordTaskDialog v-model="tasksVisible" :asin="tasksAsin" can-recover @changed="load" />
    <el-dialog v-model="visible" :title="editing ? '编辑ASIN配置' : '批量添加ASIN'" width="min(580px, 94vw)" append-to-body :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <el-form label-position="top" :disabled="saving"><el-form-item v-if="!editing" label="ASIN（每行一个，最多200个；重复项保持原设置）"><el-input v-model="form.asins" type="textarea" :rows="6" maxlength="3000" placeholder="B0XXXXXXXX&#10;B0YYYYYYYY" aria-label="待抓取ASIN列表" /></el-form-item><el-form-item v-else label="ASIN / 站点"><strong>{{ form.asin }} · US</strong></el-form-item><el-form-item label="启用采集"><el-switch v-model="form.enabled" /></el-form-item><el-form-item label="优先级（越大越先采集）"><el-input-number v-model="form.priority" :min="0" :max="9999" :precision="0" /></el-form-item><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit /></el-form-item></el-form>
      <template #footer><el-button :disabled="saving" @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存配置</el-button></template>
    </el-dialog>
    </template>
  </main>
</template>
<script>export default {name:'SellerspriteConfigView'}</script>
<script setup>
// 两类采集的配置容器：关键词与竞品独立页签，分别调用各自API。
import { onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Search, Refresh, DataAnalysis, Picture, CopyDocument } from '@element-plus/icons-vue'
import { addSellerspriteKeywordAsins, getSellerspriteKeywordAsins, updateSellerspriteKeywordAsin } from '@/services/api'
import { spriteStates, spriteTime } from '@/utils/sellersprite'
import SellerspriteKeywordTaskDialog from '@/components/SellerspriteKeywordTaskDialog.vue'
import SellerspriteCompetitorPanel from '@/components/SellerspriteCompetitorPanel.vue'
import FeatureGuide from '@/components/FeatureGuide.vue'
// 支持从绑定弹框直达竞品配置；未知参数仍落到原关键词页签。
const route=useRoute()
const collectionKind=ref(route.query.tab==='competitors'?'competitors':'keywords'),competitorBusy=ref(false)
const tasksVisible=ref(false),tasksAsin=ref('')
// 在独立弹框查看该ASIN的任务、失败原因和补救队列，不触发网页采集。
function openTasks(row){tasksAsin.value=row.asin;tasksVisible.value=true}
const rows=ref([]),total=ref(0),page=ref(1),search=ref(''),enabled=ref(''),ownership=ref(''),loading=ref(false),saving=ref(false),error=ref(''),visible=ref(false),editing=ref(null),busyId=ref(null),form=ref({})
let disposed=false,revision=0
const message=err=>err.response?.data?.message || '保存结果待确认，请刷新查看，勿反复提交'
const ownershipLabel=row=>row.ownership==='owned'?'本店商品':row.ownership==='catalog'?'系统商品':'竞品 / 未关联本店'
const taskTone=status=>status==='completed'?'success':['failed','parse_failed','action_required'].includes(status)?'danger':['running','downloaded'].includes(status)?'warning':'info'
function safeImage(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}}
async function copyAsin(asin){try{await navigator.clipboard.writeText(asin);ElMessage.success('ASIN已复制')}catch{ElMessage.warning('复制失败，请手动复制ASIN')}}
async function load(){const current=++revision;loading.value=true;error.value='';try{const res=await getSellerspriteKeywordAsins({page:page.value,page_size:20,search:search.value,enabled:enabled.value,ownership:ownership.value});if(disposed || current!==revision)return;rows.value=res.data.data.list;total.value=res.data.data.total}catch(err){if(!disposed && current===revision){error.value=err.response?.data?.message || '读取配置失败，请重试';rows.value=[];total.value=0}}finally{if(!disposed && current===revision)loading.value=false}}
function filter(){page.value=1;load()}
function openAdd(){editing.value=null;form.value={asins:'',enabled:true,priority:0,remark:''};visible.value=true}
function openEdit(row){editing.value=row.id;form.value={...row,enabled:!!row.enabled};visible.value=true}
function body(value){return {enabled:value.enabled?1:0,priority:value.priority,remark:value.remark,version:value.version,marketplace:'US'}}
async function save(){if(saving.value)return;saving.value=true;try{if(editing.value){await updateSellerspriteKeywordAsin(editing.value,body(form.value));ElMessage.success('配置已保存')}else{const res=await addSellerspriteKeywordAsins({...body(form.value),asins:form.value.asins});ElMessage.success(`新增${res.data.data.created}条，已有${res.data.data.existing}条保持原设置`)}visible.value=false;await load()}catch(err){ElMessage.error(message(err))}finally{saving.value=false}}
async function toggle(row,value){if(saving.value)return;saving.value=true;busyId.value=row.id;try{await updateSellerspriteKeywordAsin(row.id,{...body(row),enabled:value?1:0});ElMessage.success(value?'已启用下一轮采集':'已停用新采集，历史数据保留');await load()}catch(err){error.value=message(err);ElMessage.error(error.value)}finally{saving.value=false;busyId.value=null}}
onMounted(load);onDeactivated(()=>{visible.value=false;tasksVisible.value=false});onBeforeUnmount(()=>{disposed=true;revision++})
</script>
<style scoped>
.sprite-task-date{margin-left:8px;font-size:11px;color:#8b9ab0}.sprite-task-reason{font-size:12px;line-height:1.7;color:#ae6454;margin:7px 0;overflow-wrap:anywhere}
.sprite-config{max-width:1640px;margin:0 auto;padding:28px 24px;color:#334a64}
.sprite-config-header,.sprite-config-title{display:flex;align-items:center;gap:14px}.sprite-config-header{justify-content:space-between;flex-wrap:wrap;margin-bottom:18px}.sprite-config-mark{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:#e8f0ff;color:#4776d9;font-size:25px}.sprite-config h1{margin:0 0 6px;font-size:24px;color:#223c5b}.sprite-config-title p{margin:0;font-size:13px;color:#8695a9}.sprite-config-hint{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px;font-size:12px;color:#8796ab;line-height:1.8}
.sprite-config-panel{background:#fff;border:1px solid #e8edf5;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px #28486c05}.sprite-config-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:20px}.sprite-config-tools .el-input{width:340px}.sprite-config-tools .el-select{width:190px}.sprite-config-tools .sprite-enabled-filter{width:150px}.sprite-config-caption{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:0 20px 16px;font-size:12px;color:#96a2b3}.sprite-config-caption strong{color:#3f5570;font-size:14px}.sprite-config-caption strong span{font-weight:400;color:#8295b2;font-size:12px;margin-left:8px}.sprite-config-panel>.el-alert{width:auto;margin:0 20px 16px}.sprite-config-panel>.el-pagination{justify-content:flex-end;padding:18px 20px;overflow:auto}
.sprite-config-table :deep(th.el-table__cell){background:#f7f9fc;color:#6d7f96;font-weight:500}.sprite-config-table :deep(td.el-table__cell){padding:18px 0}.sprite-config-table :deep(.sprite-paused-row){--el-table-tr-bg-color:#fbfcfe}.sprite-product{display:flex;align-items:center;gap:14px;min-height:76px}.sprite-product-image{width:68px;height:68px;flex-shrink:0;border:1px solid #edf0f6;border-radius:10px;background:#fff;overflow:hidden}.sprite-image-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;height:100%;color:#abb7c8;font-size:10px;background:#f6f8fc}.sprite-image-empty.sprite-product-image{height:68px}.sprite-image-empty .el-icon{font-size:23px}.sprite-product-text{min-width:0;flex:1}.sprite-product-text>strong{display:block;font-size:14px;color:#2d4665;line-height:1.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sprite-product-asin{display:flex;align-items:center;gap:6px;margin-top:3px;color:#56759b;font-size:12px}.sprite-product-asin>span{font-family:Consolas,monospace;letter-spacing:.2px}.sprite-product-asin small{border-radius:4px;background:#f0f4fa;color:#8a9db8;font-size:10px;padding:0 5px;margin-left:2px}.sprite-product-text p{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:2px 0 0;font-size:11px;line-height:1.8;color:#96a2b3}.sprite-product-text .sprite-product-missing{color:#aab4c1}.sprite-ownership{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.sprite-ownership small{font-size:11px;color:#98a6b8}.sprite-owner{margin:5px 0 9px;line-height:1.6;font-size:12px;overflow-wrap:anywhere}.sprite-owner>div{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.sprite-owner strong{font-weight:500;color:#466380}.sprite-owner>span{font-family:Consolas,monospace;color:#899bb2;font-size:11px}.sprite-owner-popover{max-height:350px;overflow:auto}.sprite-no-owner{color:#a4afbf;font-size:12px}.sprite-switch-note{font-size:11px;color:#9ba9bd;line-height:1.4}.sprite-updated{display:flex;flex-direction:column;gap:2px;font-size:12px}.sprite-updated small{font-size:11px;color:#9aa8ba}.sprite-config-empty{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#a0acc0}.sprite-config-empty .el-icon{font-size:35px;color:#a8bddb}.sprite-config-empty strong{font-size:14px;font-weight:500;color:#758ba8}.sprite-config-empty span{font-size:12px}
@media(max-width:760px){.sprite-config{padding:18px 12px}.sprite-config h1{font-size:20px}.sprite-config-mark{width:40px;height:40px}.sprite-config-tools{padding:16px}.sprite-config-tools .el-input{width:100%}.sprite-config-tools .el-select{flex:1;min-width:150px}.sprite-config-caption{padding:0 16px 14px}.sprite-config-caption>span{line-height:1.6}.sprite-product{gap:10px}}
</style>
