<template>
  <el-dialog v-model="visible" :title="`${meta.name || ''} · 每日数据`" width="min(1420px, 96vw)" class="ownership-dialog owner-daily-dialog" append-to-body @close="clear">
    <p class="workbench-muted">{{ meta.dateFrom }} 至 {{ meta.dateTo }} · {{ meta.currency }} · {{ meta.timezone }} · 实际计入 {{ countedDays }} 天</p>
    <p class="workbench-muted">每行汇总该人员当天所有已归属且有日报的 SKU；金额、利润及 ACOS/TACOS 沿用本次查询，不重新计算。无已归属日报的日期不补0。</p>
    <div class="owner-daily-tools">
      <el-switch v-model="showMissing" active-text="显示完整查询区间" @change="page = 1" />
      <el-tooltip :content="performanceColorGuide" placement="top" popper-class="performance-color-tooltip"><span class="performance-color-guide" tabindex="0">颜色参考 <i class="is-green" />正常 <i class="is-yellow" />关注 <i class="is-red" />重点关注</span></el-tooltip>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-table :key="tableKey" :data="pageRows" stripe max-height="520" :default-sort="{ prop: 'business_date', order: 'descending' }" @sort-change="sortChanged">
      <el-table-column prop="business_date" label="日期" width="120" fixed="left" sortable="custom" />
      <el-table-column label="计入情况" width="110"><template #default="{row}"><span class="workbench-muted">{{ row.source_state === 'available' ? '已计入' : '无已归属日报' }}</span></template></el-table-column>
      <el-table-column label="计入 SKU 数" width="95" align="right"><template #default="{row}">{{ row.selling_listing_count ?? '—' }}</template></el-table-column>
      <el-table-column label="订单数" width="80" align="right"><template #default="{row}"><span title="按当日已发货订单去重；同单跨SKU或人员不能直接相加">{{ row.order_count ?? (row.source_state === 'available' ? '待核对' : '—') }}</span></template></el-table-column>
      <el-table-column label="销量" width="80" align="right"><template #default="{row}"><span v-bind="performanceMetricAttrs('sales_qty',row,row.selling_listing_count)">{{ row.sales_qty ?? '—' }}</span></template></el-table-column>
      <el-table-column label="销售额" width="105" align="right"><template #default="{row}">{{ money(row.sales_amount) }}</template></el-table-column>
      <el-table-column label="广告销售额" width="105" align="right"><template #default="{row}">{{ money(row.ad_sales) }}</template></el-table-column>
      <el-table-column label="广告费" width="95" align="right"><template #default="{row}"><span v-bind="performanceMetricAttrs('ad_cost',row)">{{ money(row.ad_cost) }}</span></template></el-table-column>
      <el-table-column label="SKU 报表退款" width="110" align="right"><template #default="{row}">{{ money(row.refund_loss) }}</template></el-table-column>
      <el-table-column label="利润" width="105" align="right"><template #default="{row}"><span v-bind="performanceMetricAttrs('sku_report_profit',row)">{{ money(row.sku_report_profit) }}</span></template></el-table-column>
      <el-table-column label="利润率" width="100" align="right"><template #default="{row}"><span v-bind="performanceMetricAttrs('profit_margin',row)">{{ percent(row.profit_margin) }}</span></template></el-table-column>
      <el-table-column label="ACOS" width="95" align="right"><template #default="{row}"><span v-bind="performanceMetricAttrs('acos',row)">{{ percent(row.acos) }}</span></template></el-table-column>
      <el-table-column label="TACOS" width="95" align="right"><template #default="{row}"><span v-bind="performanceMetricAttrs('tacos',row)">{{ percent(row.tacos) }}</span></template></el-table-column>
    </el-table>
    <div class="workbench-pagination"><span class="workbench-muted">默认最新日期在前 · 共 {{ displayedRows.length }} 行</span><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10,20,50,100]" :total="displayedRows.length" layout="total,sizes,prev,pager,next" @size-change="page = 1" /></div>
    <section v-if="visible && !error && countedDays" class="owner-daily-trend">
      <h3>每日经营趋势</h3>
      <p class="workbench-muted">展示完整查询区间，不受上方分页影响；无已归属日报的日期保留空值。点击图例可隐藏指标，悬停查看当天数值。</p>
      <PerformanceTrendChart :rows="trendRows" :metrics="trendMetrics" :currency="meta.currency || ''" :height="400" />
    </section>
    <template #footer><el-button @click="close">关闭</el-button></template>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onDeactivated, ref } from 'vue'
import PerformanceTrendChart from '@/components/PerformanceTrendChart.vue'
import { ownerPerformanceDailyRows } from '@/services/performanceCharts.js'
import { performanceColorGuide, performanceMetricAttrs } from '@/utils/performanceMetricTone.js'

const visible = ref(false), fullRows = ref([]), meta = ref({}), error = ref('')
const showMissing = ref(false), page = ref(1), pageSize = ref(20), order = ref('desc'), tableKey = ref(0)
const countedDays = computed(() => fullRows.value.filter(row => row.source_state === 'available').length)
// 趋势使用同一份完整快照，缺日期保留断点，不受列表排序、分页或开关影响。
const trendRows = computed(() => fullRows.value.map(row => ({ ...row, profit: row.sku_report_profit ?? null })))
const trendMetrics = [{key:'sales_qty',label:'销量',axis:'quantity',color:'#527eea'},
  {key:'sales_amount',label:'销售额',axis:'amount',color:'#34b7a5'},
  {key:'ad_cost',label:'广告费',axis:'amount',color:'#e9a23b'},
  {key:'profit',label:'利润',axis:'amount',color:'#9a77dc'}]
const displayedRows = computed(() => fullRows.value.filter(row => showMissing.value || row.source_state === 'available')
  .sort((a,b) => order.value === 'asc' ? a.business_date.localeCompare(b.business_date) : b.business_date.localeCompare(a.business_date)))
const pageRows = computed(() => displayedRows.value.slice((page.value-1)*pageSize.value,page.value*pageSize.value))
const money = value => value == null ? '—' : Number(value).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})
const percent = value => value == null ? '—' : `${(Number(value)*100).toFixed(2)}%`
const clear = () => { fullRows.value=[];meta.value={};error.value='' }
const close = () => { visible.value=false;clear() }
const sortChanged = ({order:direction}) => { order.value=direction==='ascending'?'asc':'desc';page.value=1 }
const open = (row, query, result) => {
  meta.value={name:row.owner_name || (row.owner_user_id ? `用户 ${row.owner_user_id}` : '未分配负责人'),currency:row.currency,timezone:result.timezone,dateFrom:query.date_from,dateTo:query.date_to}
  showMissing.value=false;page.value=1;pageSize.value=20;order.value='desc';tableKey.value++;error.value='';fullRows.value=[]
  try { fullRows.value=ownerPerformanceDailyRows(result.trend,row.owner_user_id,row.currency,query.date_from,query.date_to) }
  catch(err) { error.value=err.message }
  visible.value=true
}
onDeactivated(close)
onBeforeUnmount(close)
defineExpose({open,close})
</script>

<style scoped>
.owner-daily-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:14px 0}
.owner-daily-trend{margin-top:20px;padding-top:18px;border-top:1px solid #eef2f7}
.owner-daily-trend h3{margin:0 0 8px;color:#2b4b72;font-size:16px}
@media(max-width:768px){.workbench-pagination{flex-wrap:wrap;overflow-x:auto;justify-content:flex-start;gap:10px}}
</style>

<style>
.owner-daily-dialog{display:flex;flex-direction:column;max-height:90vh;margin-top:5vh !important}
.owner-daily-dialog .el-dialog__body{min-height:0;overflow-y:auto}
.owner-daily-dialog .el-dialog__header,.owner-daily-dialog .el-dialog__footer{flex-shrink:0}
</style>
