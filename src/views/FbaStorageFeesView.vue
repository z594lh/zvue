<template>
  <div class="storage-fees-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><Box /></el-icon>
          FBA 月度仓储费报表
        </h1>
        <p class="page-subtitle">按 SKU 维度查看最近半年各月净仓储费</p>
      </div>
      <div class="header-actions">
        <el-select v-model="selectedShop" placeholder="请选择店铺" clearable style="width:180px" @change="handleShopChange">
          <el-option v-for="shop in shopList" :key="shop.id" :label="shop.shop_name" :value="shop.id" />
        </el-select>
        <el-button type="primary" :loading="syncing" :disabled="!selectedShop" @click="handleSync">
          <el-icon><Refresh /></el-icon> 同步数据
        </el-button>
      </div>
    </div>

    <!-- 筛选栏（一行） -->
    <div class="filter-bar">
      <el-select v-model="filter.months" multiple placeholder="计费月" clearable style="width:300px" @change="fetchData">
        <el-option v-for="m in options.months" :key="m" :label="m" :value="m" />
      </el-select>
      <el-input v-model="filter.search" placeholder="SKU / ASIN / 名称" clearable style="width:160px" @keyup.enter="fetchData">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="filter.country_code" placeholder="国家/站点" clearable style="width:110px" @change="fetchData">
        <el-option v-for="c in options.country_codes" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="filter.fulfillment_center" filterable placeholder="仓库" clearable style="width:100px" @change="fetchData">
        <el-option v-for="fc in options.fulfillment_centers" :key="fc" :label="fc" :value="fc" />
      </el-select>
      <el-select v-model="filter.product_size_tier" placeholder="尺寸段" clearable style="width:110px" @change="fetchData">
        <el-option v-for="t in options.product_size_tiers" :key="t" :label="t" :value="t" />
      </el-select>
      <el-button type="primary" @click="fetchData"><el-icon><Search /></el-icon></el-button>
      <el-button plain @click="resetFilter"><el-icon><RefreshLeft /></el-icon></el-button>
      <el-button plain :loading="exporting" @click="handleExport"><el-icon><Download /></el-icon></el-button>
    </div>

    <!-- 汇总卡片 -->
    <div class="summary-cards">
      <div class="summary-card card-fee">
        <div class="card-icon"><el-icon size="24"><Money /></el-icon></div>
        <div class="card-body">
          <div class="card-label">仓储费总额</div>
          <div class="card-value">{{ formatMoney(summary.total_storage_fee) }}</div>
        </div>
      </div>
      <div class="summary-card card-incentive">
        <div class="card-icon"><el-icon size="24"><Discount /></el-icon></div>
        <div class="card-body">
          <div class="card-label">激励抵扣总额</div>
          <div class="card-value text-success">{{ formatMoney(summary.total_incentive_fee) }}</div>
        </div>
      </div>
      <div class="summary-card card-net">
        <div class="card-icon"><el-icon size="24"><Wallet /></el-icon></div>
        <div class="card-body">
          <div class="card-label">净仓储费总额</div>
          <div class="card-value text-warning">{{ formatMoney(summary.total_net_fee) }}</div>
        </div>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-panel" v-loading="loading">
      <table class="data-table">
        <thead>
          <tr>
            <th width="130">卖家 SKU</th>
            <th>商品名称</th>
            <th width="70">币种</th>
            <th v-for="m in months" :key="m" width="110" align="right" class="sortable-th" @click="sortBy('month_' + m)">
              {{ m }} 净仓储费
              <span class="sort-arrows">{{ sortArrow('month_' + m) }}</span>
            </th>
            <th width="110" align="right" class="sortable-th" @click="sortBy('total_net_fee')">
              合计净仓储费
              <span class="sort-arrows">{{ sortArrow('total_net_fee') }}</span>
            </th>
            <th width="80" align="center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in sortedTableData" :key="row.seller_sku">
            <td><span class="cell-code">{{ row.seller_sku || '--' }}</span></td>
            <td>
              <el-tooltip :content="row.product_name || '--'" placement="top" :disabled="!row.product_name || row.product_name.length < 30">
                <span class="cell-name">{{ row.product_name || '--' }}</span>
              </el-tooltip>
              <div v-if="row.asin || row.fnsku" class="cell-sub">
                <span v-if="row.asin">ASIN: {{ row.asin }}</span>
                <span v-if="row.fnsku">FNSKU: {{ row.fnsku }}</span>
              </div>
            </td>
            <td align="center">{{ row.currency || 'USD' }}</td>
            <td v-for="m in months" :key="m" align="right">
              <span :class="{ 'text-zero': getMonthFee(row, m) === 0 }">
                {{ formatMoney(getMonthFee(row, m)) }}
              </span>
            </td>
            <td align="right"><strong>{{ formatMoney(row.total_net_fee) }}</strong></td>
            <td align="center">
              <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
            </td>
          </tr>
        </tbody>
      </table>
      <el-empty v-if="!loading && !tableData.length" description="暂无数据" />
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @change="fetchData"
        />
      </div>
    </div>

    <!-- SKU 详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="`${currentSku} 仓储费详情`" size="900px" destroy-on-close>
      <div v-loading="detailLoading" class="detail-panel">
        <div class="detail-filter-bar">
          <el-select v-model="detailFilter.months" multiple placeholder="计费月" clearable style="width:200px" @change="onDetailFilterChange">
            <el-option v-for="m in detailOptions.months" :key="m" :label="m" :value="m" />
          </el-select>
          <el-select v-model="detailFilter.fulfillment_center" filterable placeholder="仓库" clearable style="width:140px" @change="onDetailFilterChange">
            <el-option label="全部仓库" value="" />
            <el-option v-for="fc in detailOptions.fulfillment_centers" :key="fc" :label="fc" :value="fc" />
          </el-select>
          <el-button plain size="small" @click="resetDetailFilter"><el-icon><RefreshLeft /></el-icon> 重置</el-button>
        </div>
        <div class="detail-summary">
          <span>仓储费：{{ formatMoney(displayDetailSummary.total_storage_fee) }}</span>
          <span>激励抵扣：{{ formatMoney(displayDetailSummary.total_incentive_fee) }}</span>
          <span>净仓储费：<strong>{{ formatMoney(displayDetailSummary.total_net_fee) }}</strong></span>
        </div>
        <table class="data-table detail-table">
          <thead>
            <tr>
              <th width="90">ASIN</th>
              <th width="100">FNSKU</th>
              <th width="70">仓库</th>
              <th width="60">站点</th>
              <th width="80">计费月</th>
              <th width="90">尺寸段</th>
              <th width="80" align="right">月均库存</th>
              <th width="90" align="right">月均体积</th>
              <th width="80" align="right">仓储费</th>
              <th width="80" align="right">激励抵扣</th>
              <th width="80" align="right">净仓储费</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in pagedDetailList" :key="item.id">
              <td><span class="cell-code">{{ item.asin || '--' }}</span></td>
              <td><span class="cell-code">{{ item.fnsku || '--' }}</span></td>
              <td align="center">{{ item.fulfillment_center || '--' }}</td>
              <td align="center">{{ item.country_code || '--' }}</td>
              <td align="center">{{ item.month_of_charge || '--' }}</td>
              <td align="center">{{ item.product_size_tier || '--' }}</td>
              <td align="right">{{ formatInt(item.average_quantity_on_hand) }}</td>
              <td align="right">{{ formatNumber(item.estimated_total_item_volume, 4) }}</td>
              <td align="right">{{ formatMoney(item.estimated_monthly_storage_fee) }}</td>
              <td align="right"><span class="text-success">{{ formatMoney(item.total_incentive_fee_amount) }}</span></td>
              <td align="right"><strong>{{ formatMoney(Number(item.estimated_monthly_storage_fee || 0) - Number(item.total_incentive_fee_amount || 0)) }}</strong></td>
            </tr>
          </tbody>
        </table>
        <el-empty v-if="!detailLoading && !pagedDetailList.length" description="暂无明细数据" />
        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="detailPage"
            v-model:page-size="detailPageSize"
            :total="filteredDetailTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next, jumper"
            @change="() => {}"
          />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Box, Money, Discount, Wallet, Search, Refresh, RefreshLeft, Download } from '@element-plus/icons-vue'
import { useShopCache } from '@/composables/useShopCache'
import {
  getFbaStorageFeeFilters,
  getFbaStorageFeesBySku,
  getFbaStorageFeeSkuDetail,
  exportFbaStorageFeesBySku,
  syncFbaStorageFees
} from '@/services/api.js'

const { shopList, fetchShopList, defaultShopId } = useShopCache()

const selectedShop = ref(null)
const loading = ref(false)
const syncing = ref(false)
const exporting = ref(false)
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const months = ref([])

const defaultFilter = () => ({
  months: [],
  search: '',
  country_code: '',
  fulfillment_center: '',
  product_size_tier: ''
})
const filter = reactive(defaultFilter())

const options = reactive({
  months: [],
  country_codes: [],
  fulfillment_centers: [],
  product_size_tiers: []
})

const summary = reactive({
  total_storage_fee: 0,
  total_incentive_fee: 0,
  total_net_fee: 0
})

const sort = reactive({ field: '', order: 'desc' })

const sortedTableData = computed(() => {
  const list = [...tableData.value]
  if (!sort.field) return list
  list.sort((a, b) => {
    let va, vb
    if (sort.field.startsWith('month_')) {
      const month = sort.field.replace('month_', '')
      va = getMonthFee(a, month)
      vb = getMonthFee(b, month)
    } else if (sort.field === 'total_net_fee') {
      va = Number(a.total_net_fee || 0)
      vb = Number(b.total_net_fee || 0)
    } else {
      return 0
    }
    return sort.order === 'asc' ? va - vb : vb - va
  })
  return list
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const currentSku = ref('')
const detailList = ref([])
const detailSummary = reactive({
  total_storage_fee: 0,
  total_incentive_fee: 0,
  total_net_fee: 0
})
const detailOptions = reactive({
  months: [],
  fulfillment_centers: []
})
const defaultDetailFilter = () => ({
  months: [],
  fulfillment_center: ''
})
const detailFilter = reactive(defaultDetailFilter())
const detailPage = ref(1)
const detailPageSize = ref(20)

const filteredDetailList = computed(() => {
  return detailList.value.filter(item => {
    if (detailFilter.months.length && !detailFilter.months.includes(item.month_of_charge)) return false
    if (detailFilter.fulfillment_center && item.fulfillment_center !== detailFilter.fulfillment_center) return false
    return true
  })
})

const filteredDetailTotal = computed(() => filteredDetailList.value.length)

const pagedDetailList = computed(() => {
  const start = (detailPage.value - 1) * detailPageSize.value
  return filteredDetailList.value.slice(start, start + detailPageSize.value)
})

const displayDetailSummary = computed(() => {
  return filteredDetailList.value.reduce((acc, item) => {
    acc.total_storage_fee += Number(item.estimated_monthly_storage_fee || 0)
    acc.total_incentive_fee += Number(item.total_incentive_fee_amount || 0)
    acc.total_net_fee += Number(item.estimated_monthly_storage_fee || 0) - Number(item.total_incentive_fee_amount || 0)
    return acc
  }, { total_storage_fee: 0, total_incentive_fee: 0, total_net_fee: 0 })
})

const buildParams = (withPagination = true) => {
  const params = {
    shop_id: selectedShop.value,
    months: filter.months.join(','),
    search: filter.search,
    country_code: filter.country_code,
    fulfillment_center: filter.fulfillment_center,
    product_size_tier: filter.product_size_tier
  }
  if (withPagination) {
    params.page = page.value
    params.page_size = pageSize.value
  }
  return params
}

const getMonthFee = (row, month) => {
  return Number(row.month_fees?.[month]?.net_fee || 0)
}

const sortBy = (field) => {
  if (sort.field === field) {
    sort.order = sort.order === 'desc' ? 'asc' : 'desc'
  } else {
    sort.field = field
    sort.order = 'desc'
  }
}

const sortArrow = (field) => {
  if (sort.field !== field) return '↕'
  return sort.order === 'desc' ? '↓' : '↑'
}

const fetchFilters = async () => {
  if (!selectedShop.value) return
  try {
    const res = await getFbaStorageFeeFilters({ shop_id: selectedShop.value })
    if (res.data.status === 'success') {
      const data = res.data.data || {}
      options.months = data.months || []
      options.country_codes = data.country_codes || []
      options.fulfillment_centers = data.fulfillment_centers || []
      options.product_size_tiers = data.product_size_tiers || []
    }
  } catch { ElMessage.error('获取筛选选项失败') }
}

const fetchData = async () => {
  if (!selectedShop.value) {
    tableData.value = []
    total.value = 0
    months.value = []
    return
  }
  loading.value = true
  try {
    const res = await getFbaStorageFeesBySku(buildParams())
    if (res.data.status === 'success') {
      const data = res.data.data || {}
      tableData.value = data.list || []
      total.value = data.total || 0
      months.value = data.months || []
      const s = data.summary || {}
      summary.total_storage_fee = Number(s.total_storage_fee || 0)
      summary.total_incentive_fee = Number(s.total_incentive_fee || 0)
      summary.total_net_fee = Number(s.total_net_fee || 0)
    } else {
      ElMessage.warning(res.data.message || '请求失败')
    }
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

const handleShopChange = async () => {
  Object.assign(filter, defaultFilter())
  page.value = 1
  await fetchFilters()
  await fetchData()
}

const resetFilter = () => {
  Object.assign(filter, defaultFilter())
  page.value = 1
  fetchData()
}

const handleSync = async () => {
  if (!selectedShop.value) return
  syncing.value = true
  try {
    const res = await syncFbaStorageFees({ shop_id: selectedShop.value })
    if (res.data.status === 'success') {
      const result=res.data.data || {}
      const months=result.months?.join('、')
      ElMessage.success(months ? `同步完成：${months}，处理 ${result.saved} 条；这是计费月份，不是报告创建月份` : (res.data.message || '同步完成（无可用月报数据）'))
      await fetchFilters()
      await fetchData()
    } else {
      ElMessage.warning(res.data.message || '同步失败')
    }
  } catch (error) { ElMessage.error(error.response?.data?.message || '同步失败，请检查后端仓储费日志') }
  finally { syncing.value = false }
}

const handleExport = async () => {
  if (!selectedShop.value) {
    ElMessage.warning('请先选择店铺')
    return
  }
  exporting.value = true
  try {
    const res = await exportFbaStorageFeesBySku(buildParams(false))
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const filename = `FBA仓储费SKU报表_${selectedShop.value}_${new Date().toISOString().split('T')[0]}.csv`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
    ElMessage.success('导出成功')
  } catch { ElMessage.error('导出失败') }
  finally { exporting.value = false }
}

const openDetail = async (row) => {
  currentSku.value = row.seller_sku || row.asin || 'SKU'
  detailVisible.value = true
  detailLoading.value = true
  detailList.value = []
  detailPage.value = 1
  Object.assign(detailFilter, defaultDetailFilter())
  try {
    const res = await getFbaStorageFeeSkuDetail({
      shop_id: selectedShop.value,
      seller_sku: row.seller_sku,
      months: filter.months.join(',')
    })
    if (res.data.status === 'success') {
      const data = res.data.data || {}
      detailList.value = data.list || []
      const s = data.summary || {}
      detailSummary.total_storage_fee = Number(s.total_storage_fee || 0)
      detailSummary.total_incentive_fee = Number(s.total_incentive_fee || 0)
      detailSummary.total_net_fee = Number(s.total_net_fee || 0)

      const monthsSet = new Set()
      const fcSet = new Set()
      detailList.value.forEach(item => {
        if (item.month_of_charge) monthsSet.add(item.month_of_charge)
        if (item.fulfillment_center) fcSet.add(item.fulfillment_center)
      })
      detailOptions.months = Array.from(monthsSet).sort().reverse()
      detailOptions.fulfillment_centers = Array.from(fcSet).sort()
      Object.assign(detailFilter, {
        months: [...detailOptions.months],
        fulfillment_center: ''
      })
    } else {
      ElMessage.warning(res.data.message || '获取详情失败')
    }
  } catch { ElMessage.error('获取详情失败') }
  finally { detailLoading.value = false }
}

const onDetailFilterChange = () => {
  detailPage.value = 1
}

const resetDetailFilter = () => {
  Object.assign(detailFilter, {
    months: [...detailOptions.months],
    fulfillment_center: ''
  })
  detailPage.value = 1
}

const formatMoney = (val) => {
  const num = Number(val)
  if (num === 0 || isNaN(num)) return '$0.00'
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

const formatInt = (val) => {
  const num = Number(val)
  if (num === 0 || isNaN(num)) return '0'
  return num.toLocaleString('en-US')
}

const formatNumber = (val, digits = 2) => {
  const num = Number(val)
  if (isNaN(num)) return '--'
  return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

onMounted(async () => {
  await fetchShopList()
  const defId = defaultShopId()
  if (defId && shopList.value.find(s => s.id === defId)) {
    selectedShop.value = defId
    await fetchFilters()
    await fetchData()
    if (filter.months.length === 0 && months.value.length > 0) {
      filter.months = [...months.value]
    }
  }
})
</script>

<style scoped>
.storage-fees-page { padding: 16px; background: #f5f7fa; min-height: calc(100vh - 60px); }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-radius: 8px;
  padding: 18px 24px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.page-title { margin: 0; font-size: 22px; color: #303133; font-weight: 600; }
.page-subtitle { margin: 6px 0 0; font-size: 13px; color: #909399; }
.header-actions { display: flex; align-items: center; gap: 12px; }

.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  flex-wrap: nowrap;
}
.filter-bar :deep(.el-select) { flex-shrink: 0; }

.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}
.summary-card {
  background: #fff;
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.card-icon {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.card-fee .card-icon { background: #667eea; }
.card-incentive .card-icon { background: #10b981; }
.card-net .card-icon { background: #f59e0b; }
.card-label { font-size: 13px; color: #606266; margin-bottom: 4px; }
.card-value { font-size: 20px; font-weight: 600; color: #303133; }
.text-success { color: #10b981; }
.text-warning { color: #f59e0b; }
.text-zero { color: #c0c4cc; }

.table-panel {
  background: #fff;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.data-table th {
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  padding: 10px 8px;
  text-align: left;
  font-weight: 600;
  color: #606266;
  white-space: nowrap;
}
.data-table td {
  border: 1px solid #ebeef5;
  padding: 10px 8px;
  vertical-align: middle;
  color: #303133;
}
.data-table tbody tr:hover { background: #f5f7fa; }
.sortable-th { cursor: pointer; user-select: none; }
.sortable-th:hover { background: #ebeef5; }
.sort-arrows { color: #909399; font-size: 12px; margin-left: 4px; }
.sortable-th:hover .sort-arrows { color: #409eff; }
.cell-code { font-family: 'Courier New', monospace; color: #303133; }
.cell-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  max-width: 260px;
}
.cell-sub { color: #909399; font-size: 11px; margin-top: 4px; }
.cell-sub span + span { margin-left: 10px; }
.pagination-wrap { margin-top: 12px; display: flex; justify-content: flex-end; }

.detail-panel { padding: 0 4px; }
.detail-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.detail-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
}
.detail-summary strong { color: #f59e0b; }
.detail-table { margin-bottom: 12px; }

@media (max-width: 1200px) {
  .filter-bar { flex-wrap: wrap; }
}
@media (max-width: 768px) {
  .summary-cards { grid-template-columns: 1fr; }
  .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
}
</style>
