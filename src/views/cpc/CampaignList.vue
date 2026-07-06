<template>
  <CpcLayout active-tab="campaigns" @shop-change="onShopChange">
    <template #tab-extra>
      <el-button type="primary" :loading="syncing" :disabled="syncing" @click="handleSync">
        <el-icon><Refresh /></el-icon> 同步最新实体信息
      </el-button>
    </template>
    <div class="cpc-campaign-page">
      <!-- 筛选栏 -->
      <div class="filter-panel">
        <el-input v-model="filter.search" placeholder="活动名称 / ID" clearable style="width:160px" @keyup.enter="fetchData">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filter.state" placeholder="状态" clearable style="width:100px" @change="fetchData">
          <el-option label="启用" value="enabled" />
          <el-option label="暂停" value="paused" />
          <el-option label="归档" value="archived" />
        </el-select>
          <el-select v-model="filter.targetingType" placeholder="类型" clearable style="width:100px" @change="fetchData">
          <el-option label="自动" value="AUTO" />
          <el-option label="手动" value="MANUAL" />
        </el-select>
        <div class="date-range-pickers">
          <el-date-picker v-model="filter.startDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" class="date-start-picker" @change="onStartDateChange" />
          <span class="date-separator">~</span>
          <el-date-picker v-model="filter.endDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" class="date-end-picker" @change="onEndDateChange" />
        </div>
        <el-button type="primary" class="btn-search" @click="fetchData">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
        <el-button @click="resetFilter">重置</el-button>
        <el-button type="warning" class="btn-export" @click="handleExport">导出</el-button>
      </div>

      <div class="advanced-panel">
        <div v-for="item in metricFilters" :key="item.field" class="metric-filter">
          <span class="metric-label">{{ item.label }}</span>
          <el-input-number
            v-model="filter[`${item.field}_gte`]"
            :precision="item.precision"
            :step="item.step"
            :min="0"
            placeholder="≥"
            controls-position="right"
            style="width:90px"
            @change="fetchData"
          />
          <span class="metric-sep">-</span>
          <el-input-number
            v-model="filter[`${item.field}_lte`]"
            :precision="item.precision"
            :step="item.step"
            :min="0"
            placeholder="≤"
            controls-position="right"
            style="width:90px"
            @change="fetchData"
          />
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-panel">
        <el-button type="primary" class="btn-create" @click="goCreate">
          <el-icon><Plus /></el-icon> 广告创建
        </el-button>
        <el-button type="success" class="btn-daily" @click="goToDailySummary">
          汇总每日数据
        </el-button>
      </div>

      <!-- 数据表格 -->
      <div class="table-panel" v-loading="loading">
        <table class="cpc-table">
          <thead>
            <tr>
              <th width="40"><el-checkbox v-model="selectAll" @change="toggleSelectAll" /></th>
              <th width="220">广告活动</th>
              <th width="60">有效</th>
              <th width="60">类型</th>
              <th width="120">竞价策略</th>
              <th width="70">预算</th>
              <th width="80">曝光量 <span class="sort-arrows" @click="sortBy('impressions')">↕</span></th>
              <th width="80">点击次数 <span class="sort-arrows" @click="sortBy('clicks')">↕</span></th>
              <th width="80">点击率 <span class="sort-arrows" @click="sortBy('ctr')">↕</span></th>
              <th width="70">花费 <span class="sort-arrows" @click="sortBy('cost')">↕</span></th>
              <th width="60">CPC <span class="sort-arrows" @click="sortBy('cpc')">↕</span></th>
              <th width="60">订单 <span class="sort-arrows" @click="sortBy('purchases_7d')">↕</span></th>
              <th width="70">CVR <span class="sort-arrows" @click="sortBy('cvr')">↕</span></th>
              <th width="60">CPA <span class="sort-arrows" @click="sortBy('cpa')">↕</span></th>
              <th width="80">销售额 <span class="sort-arrows" @click="sortBy('sales_7d')">↕</span></th>
              <th width="80">ACOS <span class="sort-arrows" @click="sortBy('acos')">↕</span></th>
              <th width="100">开始日期</th>
              <th width="100">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableData" :key="row.campaign_id" :class="{ archived: row.state === 'ARCHIVED' }">
              <td><el-checkbox v-model="row._selected" /></td>
              <td>
                <div class="cell-campaign">
                  <a class="link-campaign" @click="goToCampaignDetail(row)">{{ row.name }}</a>
                  <div class="campaign-asins">
                    <a v-for="(asin, idx) in row.campaigns_asin || []" :key="idx" class="link-asin" @click.stop>{{ asin }}</a>
                  </div>
                </div>
              </td>
              <td align="center">
                <el-switch
                  :model-value="row.state === 'ENABLED'"
                  inline-prompt
                  :disabled="!shopId || row._loading"
                  :loading="row._loading"
                  @change="(val) => toggleState(row, val)"
                />
              </td>
              <td align="center">{{ row.targeting_type === 'AUTO' ? '自动' : '手动' }}</td>
              <td align="center">{{ row.bidding_strategy_label || row.bidding_strategy || '--' }}</td>
              <td align="right">
                <span v-if="!row._editingBudget" class="editable-cell" @click="startEditBudget(row)">{{ formatNum(row.daily_budget) }}</span>
                <el-input-number
                  v-else
                  v-model="row._editBudget"
                  :disabled="row._budgetSaving"
                  :min="0.01" :step="0.01" :precision="2"
                  size="small" controls-position="right" style="width:90px"
                  @blur="saveBudget(row)" @keyup.enter="saveBudget(row)"
                />
              </td>
              <td align="right">{{ fmtInt(row.impressions) }}</td>
              <td align="right">{{ fmtInt(row.clicks) }}</td>
              <td align="right">{{ fmtPct(row.ctr) }}</td>
              <td align="right">{{ formatNum(row.cost) }}</td>
              <td align="right">{{ formatNum(row.cpc) }}</td>
              <td align="right">{{ fmtInt(row.purchases_7d) }}</td>
              <td align="right">{{ fmtPct(row.cvr) }}</td>
              <td align="right">{{ formatNum(row.cpa) }}</td>
              <td align="right">{{ formatNum(row.sales_7d) }}</td>
              <td align="right">{{ fmtPct(row.acos) }}</td>
              <td align="center">{{ row.start_date || '-' }}</td>
              <td align="center">
                <el-button size="small" type="primary" @click="openAnalysis(row)">查看每日数据</el-button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 合计行 -->
        <div class="summary-row">
          <span class="summary-label">合计</span>
          <span class="summary-item">曝光量: {{ fmtInt(summary.impressions) }}</span>
          <span class="summary-item">点击次数: {{ fmtInt(summary.clicks) }}</span>
          <span class="summary-item">花费: {{ formatNum(summary.cost) }}</span>
          <span class="summary-item">订单: {{ fmtInt(summary.purchases_7d) }}</span>
          <span class="summary-item">销售额: {{ formatNum(summary.sales_7d) }}</span>
        </div>

        <!-- 分页 -->
        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, prev, pager, next, jumper, sizes"
            @change="fetchData"
          />
        </div>
      </div>
    </div>

    <!-- 分析弹窗 -->
    <AnalysisDialog v-model="analysisVisible" :title="analysisTitle" :shop-id="shopId" :campaign-id="analysisCampaignId" />
  </CpcLayout>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import CpcLayout from '@/components/cpc/CpcLayout.vue'
import AnalysisDialog from '@/components/cpc/AnalysisDialog.vue'
import { getCpcCampaigns, updateCpcCampaign, syncCpcEntities, syncAllCpcEntities } from '@/services/cpc'
import { exportToCSV } from '@/utils/export'

const router = useRouter()
const shopId = ref(null)
const loading = ref(false)
const syncing = ref(false)
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const selectAll = ref(false)
const analysisVisible = ref(false)
const analysisTitle = ref('')
const analysisCampaignId = ref(null)

const getLast30Days = () => {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  const fmt = (d) => d.toISOString().split('T')[0]
  return { startDate: fmt(start), endDate: fmt(end) }
}

const defaultDateRange = getLast30Days()

const filter = reactive({
  search: '',
  state: 'enabled',
  targetingType: '',
  startDate: defaultDateRange.startDate,
  endDate: defaultDateRange.endDate,
  impressions_gte: undefined,
  impressions_lte: undefined,
  clicks_gte: undefined,
  clicks_lte: undefined,
  ctr_gte: undefined,
  ctr_lte: undefined,
  cost_gte: undefined,
  cost_lte: undefined,
  cpc_gte: undefined,
  cpc_lte: undefined,
  purchases_7d_gte: undefined,
  purchases_7d_lte: undefined,
  cvr_gte: undefined,
  cvr_lte: undefined,
  cpa_gte: undefined,
  cpa_lte: undefined,
  sales_7d_gte: undefined,
  sales_7d_lte: undefined,
  acos_gte: undefined,
  acos_lte: undefined,
  daily_budget_gte: undefined,
  daily_budget_lte: undefined
})

const sort = reactive({ by: 'cost', dir: 'desc' })

const metricFilters = [
  { field: 'impressions', label: '曝光量', precision: 0, step: 1 },
  { field: 'clicks', label: '点击次数', precision: 0, step: 1 },
  { field: 'ctr', label: '点击率(%)', precision: 2, step: 0.01 },
  { field: 'cost', label: '花费', precision: 2, step: 0.01 },
  { field: 'cpc', label: 'CPC', precision: 2, step: 0.01 },
  { field: 'purchases_7d', label: '订单', precision: 0, step: 1 },
  { field: 'cvr', label: 'CVR(%)', precision: 2, step: 0.01 },
  { field: 'cpa', label: 'CPA', precision: 2, step: 0.01 },
  { field: 'sales_7d', label: '销售额', precision: 2, step: 0.01 },
  { field: 'acos', label: 'ACOS(%)', precision: 2, step: 0.01 },
  { field: 'daily_budget', label: '日预算', precision: 2, step: 0.01 }
]

const buildFilterParams = () => {
  const params = {
    shop_id: shopId.value,
    page: page.value,
    page_size: pageSize.value,
    sort_by: sort.by,
    sort_dir: sort.dir,
    search: filter.search,
    state: filter.state,
    targeting_type: filter.targetingType,
    start_date: filter.startDate || '',
    end_date: filter.endDate || ''
  }
  metricFilters.forEach(item => {
    const gte = filter[`${item.field}_gte`]
    const lte = filter[`${item.field}_lte`]
    if (gte !== undefined && gte !== null && gte !== '') params[`${item.field}_gte`] = gte
    if (lte !== undefined && lte !== null && lte !== '') params[`${item.field}_lte`] = lte
  })
  return params
}

const onStartDateChange = (val) => {
  if (val && filter.endDate && val > filter.endDate) {
    filter.endDate = val
  }
  page.value = 1
  fetchData()
}

const onEndDateChange = (val) => {
  if (val && filter.startDate && val < filter.startDate) {
    filter.startDate = val
  }
  page.value = 1
  fetchData()
}

const resetFilter = () => {
  Object.assign(filter, {
    search: '',
    state: 'enabled',
    targetingType: '',
    ...getLast30Days(),
    impressions_gte: undefined,
    impressions_lte: undefined,
    clicks_gte: undefined,
    clicks_lte: undefined,
    ctr_gte: undefined,
    ctr_lte: undefined,
    cost_gte: undefined,
    cost_lte: undefined,
    cpc_gte: undefined,
    cpc_lte: undefined,
    purchases_7d_gte: undefined,
    purchases_7d_lte: undefined,
    cvr_gte: undefined,
    cvr_lte: undefined,
    cpa_gte: undefined,
    cpa_lte: undefined,
    sales_7d_gte: undefined,
    sales_7d_lte: undefined,
    acos_gte: undefined,
    acos_lte: undefined,
    daily_budget_gte: undefined,
    daily_budget_lte: undefined
  })
  sort.by = 'cost'
  sort.dir = 'desc'
  page.value = 1
  fetchData()
}

const summary = computed(() => {
  return tableData.value.reduce((acc, row) => {
    acc.impressions += Number(row.impressions) || 0
    acc.clicks += Number(row.clicks) || 0
    acc.cost += Number(row.cost) || 0
    acc.purchases_7d += Number(row.purchases_7d) || 0
    acc.sales_7d += Number(row.sales_7d) || 0
    return acc
  }, { impressions: 0, clicks: 0, cost: 0, purchases_7d: 0, sales_7d: 0 })
})

const onShopChange = (val) => {
  shopId.value = val
  page.value = 1
  fetchData()
}

const fetchData = async () => {
  if (!shopId.value) {
    tableData.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const res = await getCpcCampaigns(buildFilterParams())
    if (res.data.status === 'success') {
      tableData.value = (res.data.data.list || []).map(item => ({
        ...item,
        _selected: false,
        _loading: false,
        _editingBudget: false,
        _editBudget: Number(item.daily_budget) || 0,
        _budgetSaving: false,
        state: (item.state || '').toUpperCase()
      }))
      total.value = res.data.data.total || 0
    }
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

const sortBy = (field) => {
  if (sort.by === field) {
    sort.dir = sort.dir === 'desc' ? 'asc' : 'desc'
  } else {
    sort.by = field
    sort.dir = 'desc'
  }
  fetchData()
}

const toggleState = async (row, val) => {
  row._loading = true
  try {
    await updateCpcCampaign(row.campaign_id, { shop_id: shopId.value, state: val ? 'enabled' : 'paused' })
    row.state = val ? 'ENABLED' : 'PAUSED'
    ElMessage.success('更新成功')
  } catch {
    ElMessage.error('更新失败')
  } finally {
    row._loading = false
  }
}

const toggleSelectAll = (val) => {
  tableData.value.forEach(row => { row._selected = val })
}

const goToCampaignDetail = (row) => {
  router.push({ name: 'CpcCampaignDetail', params: { id: row.campaign_id } })
}

const openAnalysis = (row) => {
  analysisTitle.value = row.name
  analysisCampaignId.value = row.campaign_id
  analysisVisible.value = true
}

const startEditBudget = (row) => {
  row._editBudget = Number(row.daily_budget) || 0
  row._editingBudget = true
}

const saveBudget = async (row) => {
  const newBudget = Number(row._editBudget)
  if (newBudget === Number(row.daily_budget)) {
    row._editingBudget = false
    return
  }
  row._budgetSaving = true
  try {
    await updateCpcCampaign(row.campaign_id, {
      shop_id: shopId.value,
      dailyBudget: newBudget
    })
    row.daily_budget = newBudget
    ElMessage.success('预算更新成功')
    row._editingBudget = false
  } catch {
    ElMessage.error('预算更新失败')
    row._editBudget = Number(row.daily_budget) || 0
  } finally {
    row._budgetSaving = false
  }
}

const goCreate = () => {
  router.push({ name: 'CpcCreateCampaign' })
}

const goToDailySummary = () => {
  analysisTitle.value = '所有广告活动汇总'
  analysisCampaignId.value = null
  analysisVisible.value = true
}

const handleExport = () => {
  const columns = [
    { key: 'name', label: '广告活动' },
    { key: 'state', label: '状态' },
    { key: 'targeting_type', label: '类型' },
    { key: 'bidding_strategy_label', label: '竞价策略' },
    { key: 'daily_budget', label: '预算' },
    { key: 'impressions', label: '曝光量' },
    { key: 'clicks', label: '点击次数' },
    { key: 'ctr', label: '点击率' },
    { key: 'cost', label: '花费' },
    { key: 'cpc', label: 'CPC' },
    { key: 'purchases_7d', label: '订单' },
    { key: 'cvr', label: 'CVR' },
    { key: 'cpa', label: 'CPA' },
    { key: 'sales_7d', label: '销售额' },
    { key: 'acos', label: 'ACOS' },
    { key: 'start_date', label: '开始日期' }
  ]
  const ok = exportToCSV('广告活动列表', columns, tableData.value, (val, col, row) => {
    if (col.key === 'state') return row.state === 'ENABLED' ? '启用' : (row.state === 'PAUSED' ? '暂停' : '归档')
    if (col.key === 'targeting_type') return val === 'AUTO' ? '自动' : '手动'
    if (['ctr', 'cvr', 'acos'].includes(col.key)) return val != null ? Number(val).toFixed(2) + '%' : '--'
    if (['daily_budget', 'cost', 'cpc', 'cpa', 'sales_7d'].includes(col.key)) return val != null ? Number(val).toFixed(2) : '--'
    if (['impressions', 'clicks', 'purchases_7d'].includes(col.key)) return val != null ? Number(val).toLocaleString() : '--'
    return val
  })
  if (!ok) ElMessage.warning('暂无数据可导出')
}

const handleSync = async () => {
  if (syncing.value) return
  syncing.value = true
  try {
    const api = shopId.value ? syncCpcEntities : syncAllCpcEntities
    const payload = shopId.value ? { shop_id: shopId.value } : undefined
    const res = await api(payload)
    if (res.data.status === 'success') {
      const data = res.data.data || {}
      const total = data.total || 0
      ElMessage.success(`同步完成，共同步 ${total} 条实体数据`)
      fetchData()
    } else {
      ElMessage.error(res.data.message || '同步失败')
    }
  } catch { ElMessage.error('同步请求失败') }
  finally { syncing.value = false }
}

const isEmptyVal = (val) => val == null || val === '' || Number(val) === 0 || Number.isNaN(Number(val))
const formatNum = (val) => !isEmptyVal(val) ? Number(val).toFixed(2) : '--'
const fmtInt = (val) => !isEmptyVal(val) ? Number(val).toLocaleString() : '--'
const fmtPct = (val) => !isEmptyVal(val) ? Number(val).toFixed(2) + '%' : '--'

onMounted(() => {
  if (shopId.value) fetchData()
})
</script>

<style scoped>
.cpc-campaign-page {
  background: #fff;
  border-radius: 4px;
  padding: 12px;
}
.filter-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.date-range-pickers {
  display: flex;
  align-items: center;
  gap: 8px;
}
.date-separator {
  color: #909399;
  font-size: 14px;
}
.date-start-picker,
.date-end-picker {
  width: 150px;
}
.advanced-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 12px;
}
.metric-filter {
  display: flex;
  align-items: center;
  gap: 4px;
}
.metric-label {
  font-size: 12px;
  color: #606266;
  min-width: 64px;
  text-align: right;
}
.metric-sep {
  color: #c0c4cc;
}
.action-panel {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.btn-search {
  background: #009688;
  border-color: #009688;
}
.btn-export {
  background: #ff9800;
  border-color: #ff9800;
  color: #fff;
}
.btn-create {
  background: #009688;
  border-color: #009688;
}
.btn-daily {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
.table-panel {
  overflow-x: auto;
}
.cpc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.cpc-table th {
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  padding: 8px 4px;
  text-align: center;
  font-weight: 600;
  color: #606266;
}
.cpc-table td {
  border: 1px solid #ebeef5;
  padding: 6px 4px;
  vertical-align: middle;
}
.cpc-table tbody tr:hover {
  background: #f5f7fa;
}
.cpc-table tbody tr.archived {
  background: #f0f0f0;
  color: #999;
}
.sort-arrows {
  cursor: pointer;
  color: #909399;
  font-size: 10px;
}
.sort-arrows:hover {
  color: #009688;
}
.editable-cell { cursor: pointer; color: #409eff; }
.editable-cell:hover { text-decoration: underline; }
.cell-campaign { display: flex; flex-direction: column; gap: 4px; }
.link-campaign {
  color: #0000ee;
  text-decoration: underline;
  cursor: pointer;
}
.campaign-asins {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.link-asin {
  color: #ff0000;
  text-decoration: underline;
  cursor: pointer;
  font-size: 11px;
}
.status-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}
.status-badge.success { background: #e8f5e9; color: #2e7d32; }
.status-badge.warning { background: #fff3e0; color: #ef6c00; }
.status-badge.danger { background: #ffebee; color: #c62828; }
.status-badge.info { background: #e3f2fd; color: #1565c0; }
.status-badge.gray { background: #f5f5f5; color: #757575; }
.action-icons {
  display: flex;
  justify-content: center;
  gap: 8px;
}
.icon-chart, .icon-info {
  cursor: pointer;
  font-size: 16px;
  color: #409eff;
}
.icon-chart:hover, .icon-info:hover {
  color: #009688;
}
.summary-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-top: none;
  font-size: 12px;
}
.summary-label {
  font-weight: 600;
}
.summary-item {
  color: #606266;
}
.pagination-wrap {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
