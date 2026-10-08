<template>
  <div class="ownership-workbench performance-page">
    <header class="workbench-heading"><div><div class="workbench-eyebrow">FINANCE · TEAM PERFORMANCE</div><h1>人员绩效</h1><p>直接使用 SKU 日报，按当天历史负责人汇总。</p></div>
      <div class="workbench-header-actions"><el-tag type="info" effect="plain">真实数据 · 经营指标</el-tag></div>
    </header>
    <el-alert :title="notice" type="info" :closable="false" show-icon />
    <section class="workbench-card"><div class="workbench-filters">
      <div class="workbench-field"><label>店铺</label><el-select v-model="shopId" placeholder="选择店铺" style="width:190px" @change="changeShop">
        <el-option v-for="shop in shopList" :key="shop.id" :label="shop.shop_name" :value="shop.id" />
      </el-select></div>
      <div class="workbench-field"><label>业务日期</label><el-date-picker v-model="dates" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" @change="resetResults" /></div>
      <div class="workbench-field"><label>人员筛选</label><el-select v-model="ownerFilter" filterable style="width:180px" :loading="ownersLoading" :disabled="ownersLoading" @change="resetResults">
        <el-option v-if="canAll" label="全部负责人" :value="0" />
        <template v-if="canAll"><el-option v-for="person in ownerList" :key="person.id" :label="person.name" :value="person.id" /></template>
        <el-option v-if="!canAll" :label="ownerList[0]?.name || '我的绩效'" value="me" />
      </el-select></div>
      <el-button type="primary" :icon="Search" :loading="loading" :disabled="ownersLoading" @click="load">查询指标</el-button>
    </div></section>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert v-if="result?.order_count_missing_orders" :title="`当前有 ${result.order_count_missing_orders} 单缺商品明细，无法准确归属订单数；订单数暂显示待核对，销售和利润仍沿用 SKU 日报。`" type="warning" :closable="false" show-icon />
    <div v-if="result" class="workbench-muted" style="margin-top:16px">
      业务时区：{{ result.timezone }} · SKU 日报覆盖 {{ result.data_days }}/{{ result.expected_days }} 天
      <span v-if="result.data_days < result.expected_days"> · 没有 SKU 日报的日期不计入</span>
      · 所选人员实际计入 {{ result.counted_days }} 天；未分配的 SKU / 日期不计入
    </div>
    <section class="workbench-card"><div class="workbench-card-heading"><h2>人员经营表现 <small> · {{ rows.length }} 个负责人 / 币种组合</small></h2><span class="workbench-muted">不同币种单独统计，不直接相加</span></div>
    <el-table class="workbench-table" :data="rows" v-loading="loading" stripe>
      <el-table-column label="负责人" min-width="110" fixed="left"><template #default="{row}"><div class="workbench-owner"><span class="workbench-avatar">{{ (row.owner_name || '?').slice(0,1) }}</span>{{ row.owner_name || (row.owner_user_id ? `用户 ${row.owner_user_id}` : '未分配负责人') }}</div></template></el-table-column>
      <el-table-column label="数据范围" min-width="190"><template #header><el-tooltip content="各SKU有负责人且有日报的日期并集；不是所有SKU都负责整段时间。悬停查看实际日期分段。" placement="top"><span>数据范围 <el-icon><QuestionFilled /></el-icon></span></el-tooltip></template><template #default="{row}">
        <el-tooltip v-if="row.data_day_count" :content="rangeDescription(row)" placement="top"><div class="performance-data-range"><div>{{ row.data_from }} ～ {{ row.data_to }}</div><small class="workbench-muted">实际计入 {{ row.data_day_count }} 天<span v-if="row.data_ranges.length > 1"> · {{ row.data_ranges.length }} 段，有断档</span></small></div></el-tooltip>
        <span v-else class="workbench-muted">期间负责，但无日报数据</span>
      </template></el-table-column>
      <el-table-column prop="currency" label="币种" width="60" />
      <el-table-column prop="current_listing_count" label="当前负责" width="75" />
      <el-table-column prop="period_listing_count" label="期间负责" width="75" />
      <el-table-column label="订单数" width="80"><template #header><el-tooltip content="按SKU日报相同日期统计已发货订单并去重；同单跨SKU/人员不能相加。" placement="top"><span>订单数 <el-icon><QuestionFilled /></el-icon></span></el-tooltip></template><template #default="{row}">{{ row.order_count ?? '待核对' }}</template></el-table-column>
      <el-table-column label="销量" width="60"><template #default="{row}">{{ row.sales_qty ?? '—' }}</template></el-table-column>
      <el-table-column label="销售额" width="105"><template #default="{row}">{{ money(row.sales_amount) }}</template></el-table-column>
      <el-table-column label="广告费" width="95"><template #default="{row}">{{ money(row.ad_cost) }}</template></el-table-column>
      <el-table-column :label="refundLabel" width="110"><template #default="{row}">{{ money(row.refund_loss) }}</template></el-table-column>
      <el-table-column :label="profitLabel" width="120"><template #default="{row}">{{ money(row[profitKey]) }}</template></el-table-column>
      <el-table-column label="TACOS / ACOS" width="130"><template #default="{row}"><div class="performance-ratios"><div><small>TACOS</small> {{ percent(row.tacos) }}</div><div><small>ACOS</small> {{ percent(row.acos) }}</div></div></template></el-table-column>
      <el-table-column label="明细" width="200" class-name="performance-action-cell"><template #default="{row}"><div class="performance-actions"><el-button size="small" plain :icon="TrendCharts" :disabled="loading || !loadedParams" @click="openOwnerTrend(row)">趋势</el-button><el-button size="small" plain :icon="Document" @click="openSkus(row)">SKU 明细</el-button></div></template></el-table-column>
    </el-table>
    <el-empty v-if="result && !rows.length" description="所选人员在此期间没有已归属的 SKU 日报数据" />
    <el-empty v-if="!result && !loading" description="选择店铺和业务日期查询" :image-size="80" />
    </section>
    <section v-if="chartDays.length" class="workbench-card"><div class="workbench-card-heading"><h2>每日经营走势</h2><el-select v-model="chartCurrency" style="width:110px"><el-option v-for="currency in chartCurrencies" :key="currency" :value="currency" :label="currency" /></el-select></div>
      <p class="workbench-muted">与上方人员筛选一致，仅统计实际归属的数据；无日报或未分配的日期保留空值。</p>
      <div class="workbench-chart"><PerformanceTrendChart :rows="chartDays" :metrics="homeMetrics" :currency="chartCurrency" /></div>
    </section>
    <el-dialog v-model="ownerTrendVisible" :title="`${ownerTrendMeta.name || ''} · 每日经营趋势`" width="min(1240px, 96vw)" class="ownership-dialog" @close="closeOwnerTrend">
      <p class="workbench-muted">{{ ownerTrendMeta.dateFrom }} 至 {{ ownerTrendMeta.dateTo }} · {{ ownerTrendMeta.currency }} · {{ ownerTrendMeta.timezone }} · {{ ownerTrendMeta.profitLabel }}。按本次查询的 SKU 日报展示。</p>
      <el-alert v-if="ownerTrendMeta.dataDays < ownerTrendMeta.expectedDays" title="仅统计该人员实际负责且有日报的日期；无日报或无该人员记录的日期保留空值。" type="warning" :closable="false" show-icon />
      <PerformanceTrendChart v-if="ownerTrendVisible" :rows="ownerTrendRows" :metrics="ownerTrendMetrics" :currency="ownerTrendMeta.currency || ''" :height="400" />
      <p class="workbench-muted">横坐标为业务日期（天）；销量按件，销售额、广告费和利润按币种分轴。点击图例可隐藏指标，悬停查看当天数值。</p>
      <template #footer><el-button @click="closeOwnerTrend">关闭</el-button></template>
    </el-dialog>
    <PerformanceSkuDetails ref="skuDetails" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Document, TrendCharts, QuestionFilled } from '@element-plus/icons-vue'
import PerformanceSkuDetails from '@/components/PerformanceSkuDetails.vue'
import PerformanceTrendChart from '@/components/PerformanceTrendChart.vue'
import { aggregatePerformanceDays, ownerPerformanceDays } from '@/services/performanceCharts.js'
import { recentPerformanceDates } from '@/services/performanceDates.js'
import { getUserPermissions, getMyPerformance, getUsersPerformance, getListingPerformanceConfig, getPerformanceOwners } from '@/services/api.js'

const codes = getUserPermissions()
const canAll = codes.includes('performance:view_all')
const chartCurrency=ref(null), route=useRoute()
const shopList = ref([])
const shopId = ref(null), dates = ref([]), ownerFilter = ref(canAll ? 0 : 'me')
const ownerList = ref([]), ownersLoading = ref(false)
const loading = ref(false), error = ref(''), result = ref(null)
const skuDetails=ref(null), loadedParams=ref(null)
const ownerTrendVisible=ref(false), ownerTrendRows=ref([]), ownerTrendMeta=ref({}), ownerTrendMetrics=ref([])
const closeOwnerTrend=()=>{ownerTrendVisible.value=false;ownerTrendRows.value=[];ownerTrendMeta.value={};ownerTrendMetrics.value=[]}
const rows = computed(() => result.value?.list || [])
const profitKey = computed(() => 'sku_report_profit')
const profitLabel = computed(() => 'SKU 报表利润')
const refundLabel = computed(() => 'SKU 报表退款')
const chartCurrencies=computed(()=>[...new Set((result.value?.trend || []).map(row=>row.currency))])
const chartDays=computed(()=>result.value && loadedParams.value && chartCurrency.value ? aggregatePerformanceDays(result.value.trend || [],chartCurrency.value,profitKey.value,loadedParams.value.date_from,loadedParams.value.date_to) : [])
const homeMetrics=[{key:'sales_amount',label:'销售额',axis:'amount',color:'#527eea'}, {key:'profit',label:'利润',axis:'amount',color:'#34b7a5'}]
const notice = '按每个 SKU、每天的历史负责人汇总；没有负责人或没有日报的日期不计入个人绩效。销售额、广告费、退款和利润沿用 SKU 报表，不重新计算、不重复扣退款。'
// 数据范围展示实际计入日期的并集，分段说明保留中间断档，避免误解为全区间负责。
const rangeDescription = row => (row.data_ranges || []).map(range=>`${range.date_from} ～ ${range.date_to}（${range.days}天）`).join('；')
const money = value => value === null || value === undefined ? '—' : Number(value).toLocaleString('zh-CN', { minimumFractionDigits:2, maximumFractionDigits:2 })
const percent = value => value === null || value === undefined ? '—' : `${(Number(value)*100).toFixed(2)}%`
const errorMessage = err => err.response?.data?.message || err.message
const resetResults = () => { requestVersion++; loading.value = false; result.value = null; loadedParams.value=null; error.value = ''; skuDetails.value?.close();closeOwnerTrend() }
const params = () => {
  if (!shopId.value || dates.value?.length !== 2) throw new Error('请选择店铺和日期范围')
  const shop = shopList.value.find(s => s.id === shopId.value)
  return { shop_id:shopId.value, marketplace_id:shop?.marketplace_id, date_from:dates.value[0], date_to:dates.value[1] }
}
let requestVersion = 0
let ownerRequestVersion = 0
// 选项接口由服务端限定本人/全员权限；切店时旧请求不得覆盖新店的人员列表。
const loadOwnerOptions = async () => {
  const version = ++ownerRequestVersion
  ownerList.value=[]; ownersLoading.value=true
  try {
    const shop = shopList.value.find(item=>item.id===shopId.value)
    if (!shop) return
    const response=await getPerformanceOwners({shop_id:shop.id,marketplace_id:shop.marketplace_id})
    if(version===ownerRequestVersion) ownerList.value=response.data.data.list
  } catch(err) { if(version===ownerRequestVersion) error.value=errorMessage(err) }
  finally { if(version===ownerRequestVersion) ownersLoading.value=false }
}
const changeShop = async () => {
  resetResults(); ownerFilter.value=canAll ? 0 : 'me'
  await loadOwnerOptions()
}
const load = async () => {
  const version = ++requestVersion
  closeOwnerTrend()
  loading.value = true; error.value = ''
  try {
    const method = canAll ? getUsersPerformance : getMyPerformance
    const query=params()
    if(canAll && ownerFilter.value) query.user_id=ownerFilter.value
    const response = await method(query)
    if (version===requestVersion) { result.value = response.data.data; loadedParams.value={...query}; chartCurrency.value=result.value.trend[0]?.currency || null }
  } catch (err) { if (version===requestVersion) { error.value = errorMessage(err); result.value = null } }
  finally { if (version===requestVersion) loading.value = false }
}
const openSkus=row=>{if(loadedParams.value)skuDetails.value?.open(row,{...loadedParams.value})}
const openOwnerTrend=row=>{
  if(!loadedParams.value || loading.value)return
  const query=loadedParams.value
  ownerTrendMeta.value={name:row.owner_name || (row.owner_user_id ? `用户 ${row.owner_user_id}` : '未分配负责人'),
    currency:row.currency,timezone:result.value.timezone,dateFrom:query.date_from,dateTo:query.date_to,
    profitLabel:profitLabel.value,dataDays:row.data_day_count,expectedDays:result.value.expected_days}
  ownerTrendRows.value=ownerPerformanceDays(result.value.trend || [],row.owner_user_id,row.currency,profitKey.value,query.date_from,query.date_to)
  ownerTrendMetrics.value=[{key:'sales_qty',label:'销量',axis:'quantity',color:'#527eea'},
    {key:'sales_amount',label:'销售额',axis:'amount',color:'#34b7a5'},
    {key:'ad_cost',label:'广告费',axis:'amount',color:'#e9a23b'},
    {key:'profit',label:profitLabel.value,axis:'amount',color:'#9a77dc'}]
  ownerTrendVisible.value=true
}
onMounted(async () => {
  try {
    const response = await getListingPerformanceConfig()
    shopList.value = response.data.data.shops
    shopId.value = shopList.value[0]?.id || null
    dates.value=recentPerformanceDates(shopList.value[0]?.sku_report_date_to,response.data.data.markets[shopList.value[0]?.marketplace_id]?.timezone)
    if(/^\d{4}-\d{2}-\d{2}$/.test(route.query.date_from || '') && /^\d{4}-\d{2}-\d{2}$/.test(route.query.date_to || '')) dates.value=[route.query.date_from,route.query.date_to]
    await loadOwnerOptions()
    await load()
  } catch (err) { error.value = errorMessage(err) }
})
</script>

<style src="../styles/ownership-workbench.css"></style>
