<template>
  <el-dialog v-model="visible" :title="`${ownerName} · SKU 经营明细`" width="min(1800px, 98vw)" class="ownership-dialog performance-sku-dialog" @close="invalidate">
    <div class="workbench-filters" style="margin-bottom:16px">
      <div class="workbench-field"><label>查询日期（默认继承绩效页）</label><el-date-picker v-model="dates" type="daterange" value-format="YYYY-MM-DD" :clearable="false" start-placeholder="开始日期" end-placeholder="结束日期" @change="changeDates" /></div>
      <el-button type="primary" :icon="Search" :loading="loading" @click="reload">查询 SKU</el-button>
    </div>
    <p class="workbench-muted">仅统计该人员历史归属下的数据，包含期间负责但没有来源记录的 SKU。广告占比＝广告销售额÷销售额；ACOS＝广告费÷广告销售额；TACOS＝广告费÷销售额。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-alert v-if="datesChanged" :title="`查询日期已与绩效首页不同（首页 ${originalDates[0]} ～ ${originalDates[1]}），当前结果不能直接与首页金额对比。`" type="info" :closable="false" show-icon />
    <el-alert v-if="coverage?.missing_report_sku_days" :title="`所选人员负责期间缺少 ${coverage.missing_report_sku_days} 个 SKU / 日的日报；合计仅包含已有日报，缺值不当作零业绩。`" type="warning" :closable="false" show-icon />
    <el-alert v-if="coverage?.order_count_missing_orders" :title="`有 ${coverage.order_count_missing_orders} 单缺商品明细，订单数需核对；销售额与利润仍使用 SKU 日报。`" type="warning" :closable="false" show-icon />
    <el-table :key="tableKey" :data="rows" v-loading="loading" stripe class="workbench-table" max-height="520" style="margin-top:14px" :default-sort="{prop:'seller_sku',order:'ascending'}" @sort-change="changeSort">
      <el-table-column prop="seller_sku" label="SKU" min-width="140" fixed="left" sortable="custom" show-overflow-tooltip />
      <el-table-column prop="product_name" label="产品中文名称" min-width="140" sortable="custom" show-overflow-tooltip><template #default="{row}">{{ row.product_name || '—' }}</template></el-table-column>
      <el-table-column label="统计范围" width="215"><template #header><el-tooltip content="负责区间限制在本次查询内；实际计入只包含归属该人员且已有日报的日期。悬停查看负责/计入/缺日报分段。"><span>统计范围 <el-icon><QuestionFilled /></el-icon></span></el-tooltip></template><template #default="{row}">
        <el-tooltip :content="rangeDescription(row)" placement="top" popper-class="performance-range-tooltip"><div class="performance-sku-range">
          <div>负责：{{ compactRange(row.responsibility_from,row.responsibility_to) }}<span v-if="row.responsibility_ranges?.length > 1">（{{ row.responsibility_ranges.length }}段）</span></div>
          <small :class="row.missing_report_days ? 'performance-missing' : 'workbench-muted'">实际计入 {{ row.data_day_count || 0 }} / {{ row.responsibility_days || 0 }} 天<span v-if="row.missing_report_days"> · 缺 {{ row.missing_report_days }} 天</span></small>
        </div></el-tooltip>
      </template></el-table-column>
      <el-table-column prop="currency" label="币种" width="65" sortable="custom" />
      <el-table-column prop="sales_qty" label="销量" width="80" align="right" sortable="custom"><template #default="{row}">{{ row.sales_qty ?? '—' }}</template></el-table-column>
      <el-table-column prop="ad_share" label="广告占比" width="105" align="right" sortable="custom"><template #default="{row}">{{ percent(row.ad_share) }}</template></el-table-column>
      <el-table-column prop="sales_amount" label="销售额" width="105" align="right" sortable="custom"><template #default="{row}">{{ money(row.sales_amount) }}</template></el-table-column>
      <el-table-column prop="ad_cost" label="广告费" width="105" align="right" sortable="custom"><template #default="{row}">{{ money(row.ad_cost) }}</template></el-table-column>
      <el-table-column prop="refund_loss" label="报表退款" width="110" align="right" sortable="custom"><template #default="{row}">{{ money(row.refund_loss) }}</template></el-table-column>
      <el-table-column prop="profit" label="利润" width="105" align="right" sortable="custom"><template #default="{row}"><span :style="{color:row.profit < 0 ? '#e05252' : '#219787'}">{{ money(row.profit) }}</span></template></el-table-column>
      <el-table-column prop="acos" label="ACOS" width="100" align="right" sortable="custom"><template #default="{row}">{{ percent(row.acos) }}</template></el-table-column>
      <el-table-column prop="tacos" label="TACOS" width="100" align="right" sortable="custom"><template #default="{row}">{{ percent(row.tacos) }}</template></el-table-column>
      <el-table-column label="详情" width="190" class-name="performance-action-cell"><template #default="{row}"><div class="performance-actions"><el-button size="small" plain :icon="TrendCharts" :disabled="loading || !row.seller_sku" @click="openTrend(row)">趋势</el-button><el-button size="small" plain :icon="Calendar" :disabled="loading || !row.seller_sku" @click="openDaily(row)">每日数据</el-button></div></template></el-table-column>
    </el-table>
    <div v-if="coverage" class="performance-summary">
      <div class="workbench-muted">全量合计 · {{ total }} 个 SKU / 币种组合（不是当前页）· {{ coverage.date_from }} ～ {{ coverage.date_to }} · 退款已包含在利润中，不再另扣</div>
      <div v-for="summary in coverage.summary" :key="`${summary.owner_user_id}-${summary.currency}`" class="performance-summary-values">
        <strong>{{ summary.currency }}</strong><span>销量 <b>{{ summary.sales_qty }}</b></span><span>销售额 <b>{{ money(summary.sales_amount) }}</b></span><span>广告费 <b>{{ money(summary.ad_cost) }}</b></span><span>报表退款 <b>{{ money(summary.refund_loss) }}</b></span><span>利润 <b>{{ money(summary.profit) }}</b></span><span>ACOS <b>{{ percent(summary.acos) }}</b></span><span>TACOS <b>{{ percent(summary.tacos) }}</b></span>
      </div>
      <div v-if="!coverage.summary?.length" class="workbench-muted">没有可汇总的已归属日报数据，金额未知，不计为零。</div>
    </div>
    <div class="workbench-pagination"><span class="workbench-muted">共 {{ total }} 个 SKU / 币种组合 · 点击列名旁箭头全量排序 · 缺值排在最后</span>
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[20,50,100]" :total="total" layout="total,sizes,prev,pager,next" @current-change="load" @size-change="reload" />
    </div>
    <el-dialog v-model="dailyVisible" :title="`${dailySku?.product_name || dailySku?.seller_sku || ''} · 每日经营数据`" width="min(1240px, 96vw)" class="ownership-dialog" append-to-body @close="invalidateDaily">
      <div class="workbench-muted" style="margin-bottom:14px">{{ ownerName }} · {{ dailySku?.seller_sku }} · {{ dailyDates[0] }} 至 {{ dailyDates[1] }} · {{ dailySku?.currency }}。只计该人员归属下的数据。</div>
      <div class="performance-daily-filter"><el-switch v-model="showAllDaily" active-text="显示完整查询区间" @change="resizeDaily" /><span class="workbench-muted">默认只列负责日期；缺日报显示空值，已有日报的真实零值正常显示0。</span></div>
      <el-alert v-if="dailyError" :title="dailyError" type="error" :closable="false" show-icon />
      <el-table :data="dailyRows" v-loading="dailyLoading" stripe max-height="520">
        <el-table-column prop="business_date" label="日期" width="125" fixed="left" />
        <el-table-column label="日报情况" width="135"><template #default="{row}"><span :class="row.source_state==='missing_report' ? 'performance-missing' : 'workbench-muted'">{{ sourceLabels[row.source_state] || '—' }}</span></template></el-table-column>
        <el-table-column label="销量" width="80" align="right"><template #default="{row}">{{ row.sales_qty ?? '—' }}</template></el-table-column>
        <el-table-column label="广告占比" width="110" align="right"><template #default="{row}">{{ percent(row.ad_share) }}</template></el-table-column>
        <el-table-column label="销售额" width="125" align="right"><template #default="{row}">{{ money(row.sales_amount) }}</template></el-table-column>
        <el-table-column label="广告费" width="115" align="right"><template #default="{row}">{{ money(row.ad_cost) }}</template></el-table-column>
        <el-table-column label="利润" width="120" align="right"><template #default="{row}">{{ money(row.profit) }}</template></el-table-column>
        <el-table-column label="ACOS" width="105" align="right"><template #default="{row}">{{ percent(row.acos) }}</template></el-table-column>
        <el-table-column label="TACOS" width="105" align="right"><template #default="{row}">{{ percent(row.tacos) }}</template></el-table-column>
      </el-table>
      <div class="workbench-pagination"><span class="workbench-muted">最新日期在前 · 共 {{ dailyTotal }} 行</span><el-pagination v-model:current-page="dailyPage" v-model:page-size="dailyPageSize" :page-sizes="[10,20,50,100]" :total="dailyTotal" layout="total,sizes,prev,pager,next,jumper" @current-change="loadDaily" @size-change="resizeDaily" /></div>
      <template #footer><el-button @click="dailyVisible=false">返回 SKU 列表</el-button></template>
    </el-dialog>
    <el-dialog v-model="trendVisible" :title="`${trendSku?.product_name || trendSku?.seller_sku || ''} · SKU 经营趋势`" width="min(1240px, 96vw)" class="ownership-dialog" append-to-body @close="invalidateTrend">
      <p class="workbench-muted">{{ ownerName }} · {{ trendSku?.seller_sku }} · {{ trendDates[0] }} 至 {{ trendDates[1] }} · {{ trendSku?.currency }}。展示完整筛选期间；点击图例可隐藏指标，悬停查看当天数值。</p>
      <p class="workbench-muted">{{ rangeDescription(trendSku || {}) }}</p>
      <el-alert v-if="trendError" :title="trendError" type="error" :closable="false" show-icon />
      <div v-loading="trendLoading"><PerformanceTrendChart v-if="trendVisible" :rows="trendRows" :metrics="skuMetrics" :currency="trendSku?.currency || ''" :height="400" /></div>
      <p class="workbench-muted">销量按件、广告费和利润按币种、ACOS 按百分比分别使用刻度；缺数据保留断点，不当作零。</p>
      <template #footer><el-button @click="trendVisible=false">返回 SKU 列表</el-button></template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { Search, Calendar, TrendCharts, QuestionFilled } from '@element-plus/icons-vue'
import PerformanceTrendChart from '@/components/PerformanceTrendChart.vue'
import { getPerformanceSkus, getPerformanceSkuDaily } from '@/services/api.js'

const visible=ref(false), ownerName=ref(''), base=ref({}), dates=ref([])
const originalDates=ref([])
const datesChanged=computed(()=>dates.value[0]!==originalDates.value[0] || dates.value[1]!==originalDates.value[1])
const loading=ref(false), error=ref(''), rows=ref([]), coverage=ref(null)
const page=ref(1), pageSize=ref(20), total=ref(0)
const sortBy=ref('seller_sku'), sortOrder=ref('asc'), tableKey=ref(0)
const dailyVisible=ref(false), dailyLoading=ref(false), dailyError=ref(''), dailyRows=ref([]), dailySku=ref(null), dailyDates=ref([])
const dailyPage=ref(1), dailyPageSize=ref(10), dailyTotal=ref(0), dailyQuery=ref({})
const showAllDaily=ref(false)
const sourceLabels={available:'已有日报',missing_report:'负责，但缺日报',not_responsible:'不在负责范围'}
const trendVisible=ref(false), trendLoading=ref(false), trendError=ref(''), trendRows=ref([]), trendSku=ref(null), trendDates=ref([])
const skuMetrics=[{key:'sales_qty',label:'销量',axis:'quantity',color:'#527eea'}, {key:'ad_cost',label:'广告费',axis:'amount',color:'#e9a23b'}, {key:'acos',label:'ACOS',axis:'percent',color:'#9a77dc'}, {key:'profit',label:'利润',axis:'amount',color:'#34b7a5'}]
let version=0, dailyVersion=0, trendVersion=0
const money=value=>value===null || value===undefined ? '—' : Number(value).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})
const percent=value=>value===null || value===undefined ? '—' : `${(Number(value)*100).toFixed(2)}%`
const message=err=>err.response?.data?.message || err.message
const compactRange=(first,last)=>first && last ? `${first.slice(5)} ～ ${last.slice(5)}` : '无负责日期'
const rangesText=ranges=>(ranges || []).map(range=>`${range.date_from} ～ ${range.date_to}（${range.days}天）`).join('；') || '无'
// 负责日期与实际计入日期分别说明，多次交接和缺日报均保留分段，不能用查询日期代替。
const rangeDescription=row=>`负责：${rangesText(row.responsibility_ranges)}。实际计入：${rangesText(row.data_ranges)}。缺日报：${rangesText(row.missing_report_ranges)}。负责${row.responsibility_days || 0}天，计入${row.data_day_count || 0}天，缺日报${row.missing_report_days || 0}天。`
const invalidateDaily=()=>{dailyVersion++;dailyLoading.value=false}
const invalidateTrend=()=>{trendVersion++;trendLoading.value=false}
const closeChildren=()=>{dailyVisible.value=false;trendVisible.value=false;invalidateDaily();invalidateTrend()}
const invalidate=()=>{version++;loading.value=false;closeChildren()}
const params=()=>{
  if(dates.value?.length!==2)throw new Error('请选择统计日期')
  return {...base.value,date_from:dates.value[0],date_to:dates.value[1]}
}
const load=async()=>{
  const current=++version
  loading.value=true;error.value='';rows.value=[];coverage.value=null
  try{
    const response=await getPerformanceSkus({...params(),page:page.value,page_size:pageSize.value,sort_by:sortBy.value,sort_order:sortOrder.value})
    if(current!==version || !visible.value)return
    coverage.value=response.data.data;rows.value=coverage.value.list;total.value=coverage.value.total
  }catch(err){if(current===version){error.value=message(err);total.value=0}}finally{if(current===version)loading.value=false}
}
const reload=()=>{closeChildren();page.value=1;load()}
const changeSort=({prop,order})=>{sortBy.value=order ? prop : 'seller_sku';sortOrder.value=order==='descending' ? 'desc' : 'asc';reload()}
const changeDates=()=>{invalidate();reload()}
const open=(row,query)=>{
  invalidate();base.value={...query,currency:row.currency};ownerName.value=row.owner_name || '未分配负责人'
  if(row.owner_user_id!==null && row.owner_user_id!==undefined)base.value.user_id=row.owner_user_id
  else base.value.unassigned='1'
  originalDates.value=[query.date_from,query.date_to];dates.value=[...originalDates.value];page.value=1;total.value=0;sortBy.value='seller_sku';sortOrder.value='asc';tableKey.value++;visible.value=true;load()
}
const loadDaily=async()=>{
  const current=++dailyVersion
  dailyRows.value=[];dailyError.value='';dailyLoading.value=true
  try{
    const response=await getPerformanceSkuDaily({...dailyQuery.value,daily_scope:showAllDaily.value ? 'all' : 'owned',page:dailyPage.value,page_size:dailyPageSize.value,sort_by:'business_date',sort_order:'desc'})
    if(current===dailyVersion && dailyVisible.value){dailyRows.value=response.data.data.list;dailyTotal.value=response.data.data.total}
  }catch(err){if(current===dailyVersion){dailyError.value=message(err);dailyTotal.value=0}}finally{if(current===dailyVersion)dailyLoading.value=false}
}
const resizeDaily=()=>{dailyPage.value=1;loadDaily()}
const openDaily=row=>{
  invalidateDaily();dailySku.value=row;dailyDates.value=[...dates.value];dailyQuery.value={...params(),seller_sku:row.seller_sku,currency:row.currency}
  showAllDaily.value=false;dailyPage.value=1;dailyTotal.value=0;dailyVisible.value=true;loadDaily()
}
const openTrend=async row=>{
  const current=++trendVersion
  trendSku.value=row;trendDates.value=[...dates.value];trendRows.value=[];trendError.value='';trendVisible.value=true;trendLoading.value=true
  try{
    // 接口最多93天；趋势显式取完整查询区间而非当前页，未负责和缺日报日保留断点。
    const response=await getPerformanceSkuDaily({...params(),seller_sku:row.seller_sku,currency:row.currency,daily_scope:'all',page:1,page_size:200,sort_by:'business_date',sort_order:'asc'})
    if(current!==trendVersion || !trendVisible.value)return
    if(response.data.data.total>response.data.data.list.length)throw new Error('趋势数据未完整返回，请缩小日期范围')
    trendRows.value=response.data.data.list
  }catch(err){if(current===trendVersion)trendError.value=message(err)}finally{if(current===trendVersion)trendLoading.value=false}
}
onUnmounted(invalidate)
defineExpose({open,close:()=>{visible.value=false;invalidate()}})
</script>
