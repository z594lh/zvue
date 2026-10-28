<template>
  <el-dialog :model-value="true" :title="`卖家精灵关键词 · ${sku}`" width="min(1480px, 97vw)" top="5vh" append-to-body destroy-on-close @close="emit('close')">
    <section class="sprite-view">
      <div class="sprite-heading"><div><el-tag size="small">美国站 US</el-tag><strong>{{ data.asin || '读取ASIN中…' }}</strong><span>最近30天统计 · 金额 USD</span></div><el-button :icon="Refresh" :loading="loading" @click="load">重读本地数据</el-button></div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <div class="sprite-controls"><el-select v-model="snapshotId" placeholder="选择成功采集快照" aria-label="卖家精灵快照" :disabled="loading || !data.snapshots?.length" @change="search"><el-option v-for="item in data.snapshots || []" :key="item.id" :value="item.id" :label="`${item.record_date} · ${item.row_count}个关键词`" /></el-select><el-button :disabled="loading" @click="latest">最新成功快照</el-button><el-input v-model="query" placeholder="搜索关键词 / 翻译" clearable :disabled="loading" @keyup.enter="search" @clear="search" /><el-button type="primary" :disabled="loading" @click="search">搜索</el-button></div>
      <p class="sprite-note">仅展示已清洗入库的来源快照，不实时访问卖家精灵。采集日不是统计月份，数据不等同于Amazon实时指标；空值以“—”显示。</p>
      <p v-if="data.snapshot" class="sprite-note">采集日：{{ data.snapshot.record_date }} · 入库时间：{{ spriteTime(data.snapshot.completed_at) }}（北京时间） · 快照列表最多展示最近100次成功采集</p>
      <el-alert v-if="data.latest_attempt && data.latest_attempt.status !== 'completed'" :title="`最近一次任务：${spriteStates[data.latest_attempt.status] || data.latest_attempt.status}；${data.snapshot ? '当前保留最近成功快照' : '暂无成功快照，请等待采集任务完成'}`" type="warning" :closable="false" />
      <el-table :data="data.list || []" v-loading="loading" row-key="id" stripe border height="min(55vh, 560px)" empty-text="暂无已清洗关键词，可在系统中配置ASIN并等待采集完成" @sort-change="sortChange">
        <el-table-column type="expand" width="42"><template #default="{row}"><div class="sprite-detail"><el-descriptions :column="detailColumns" border size="small"><el-descriptions-item v-for="column in data.columns || []" :key="column.key" :label="column.label">{{ spriteValue(column,row[column.key]) }}</el-descriptions-item></el-descriptions><div class="sprite-asins"><strong>前十竞品ASIN</strong><el-tag v-for="asin in validAsins(row.top_asins)" :key="asin" size="small">{{ asin }}</el-tag><span v-if="!validAsins(row.top_asins).length">—</span></div></div></template></el-table-column>
        <el-table-column v-for="column in shownColumns" :key="column.key" :prop="column.key" :label="column.label" :fixed="column.key === 'keyword' ? 'left' : false" :min-width="column.key === 'keyword' ? 230 : column.type === 'text' ? 180 : 130" :sortable="column.sortable ? 'custom' : false" :align="column.type === 'text' ? 'left' : 'right'"><template #default="{row}"><span :class="{'sprite-negative': column.key.startsWith('search_growth_') && Number(row[column.key]) < 0}">{{ spriteValue(column,row[column.key]) }}</span></template></el-table-column>
      </el-table>
      <div class="sprite-footer"><span>共 {{ data.total || 0 }} 个关键词 · 展开可查看全部清洗字段</span><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[20,50,100]" :total="data.total || 0" layout="total, sizes, prev, pager, next" :disabled="loading" @current-change="load" @size-change="search" /></div>
      <el-collapse v-if="data.word_frequency?.length"><el-collapse-item title="来源词频（最多100项）" name="words"><div class="sprite-words"><el-tag v-for="(row,index) in data.word_frequency" :key="index" size="small">{{ row.filter(item=>item !== null).join(' · ') }}</el-tag></div></el-collapse-item></el-collapse>
    </section>
  </el-dialog>
</template>
<script setup>
// Listing关键词快照展示，只读已导入数据，不查询竞品商品报告。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { getSellerspriteKeywordListing } from '@/services/api'
import { spriteStates, spriteTime, spriteValue } from '@/utils/sellersprite'
const props=defineProps({shopId:{type:[Number,String],required:true},sku:{type:String,required:true}})
const emit=defineEmits(['close'])
const data=ref({}),loading=ref(false),error=ref(''),snapshotId=ref(''),query=ref(''),page=ref(1),pageSize=ref(20),sort=ref('traffic_share'),direction=ref('desc')
const order=['keyword','translation','traffic_share','monthly_searches','organic_rank','sponsored_rank','organic_share','sponsored_share','ppc','purchase_rate','search_growth_mom']
const shownColumns=computed(()=>order.map(key=>(data.value.columns || []).find(column=>column.key===key)).filter(Boolean))
const detailColumns=ref(window.innerWidth < 760 ? 1 : 3)
function resize(){detailColumns.value=window.innerWidth < 760 ? 1 : 3}
const validAsins=items=>Array.isArray(items)?items.filter(item=>/^[A-Z0-9]{10}$/.test(item)):[]
let disposed=false,revision=0
async function load() {
  const current=++revision;loading.value=true;error.value=''
  try {
    const response=await getSellerspriteKeywordListing(props.sku,{shop_id:props.shopId,task_id:snapshotId.value || undefined,page:page.value,page_size:pageSize.value,search:query.value,sort:sort.value,direction:direction.value})
    if(disposed || revision!==current)return
    data.value=response.data.data;snapshotId.value=data.value.snapshot?.id || ''
  }catch(err){if(!disposed && revision===current){data.value={};error.value=err.response?.data?.message || '读取失败，请重新读取本地数据'}}
  finally{if(!disposed && revision===current)loading.value=false}
}
function search(){page.value=1;load()}
function latest(){snapshotId.value='';search()}
function sortChange({prop,order}){sort.value=order ? prop : 'traffic_share';direction.value=order==='ascending'?'asc':'desc';search()}
onMounted(()=>{window.addEventListener('resize',resize);load()});onBeforeUnmount(()=>{disposed=true;revision++;window.removeEventListener('resize',resize)})
</script>
<style scoped>
.sprite-heading,.sprite-heading>div,.sprite-controls,.sprite-footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.sprite-heading{justify-content:space-between;margin-bottom:14px}.sprite-heading strong{color:#294a71}.sprite-heading span,.sprite-note,.sprite-footer{font-size:12px;color:#8797aa;line-height:1.8}.sprite-controls{margin:14px 0}.sprite-controls .el-select{width:270px}.sprite-controls .el-input{width:260px}.sprite-note{margin:8px 0}.sprite-footer{justify-content:space-between;margin:16px 0}.sprite-detail{padding:14px;overflow-wrap:anywhere}.sprite-asins,.sprite-words{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;font-size:12px}.sprite-negative{color:#c45656}.sprite-view>.el-alert{margin:10px 0}@media(max-width:760px){.sprite-controls .el-select,.sprite-controls .el-input{width:100%}.sprite-detail{padding:6px}.sprite-footer{overflow:auto}}
</style>
