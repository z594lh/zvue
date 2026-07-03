<template>
  <div class="group-section">
    <div class="filter-panel">
      <el-input v-model="filter.search" placeholder="搜索词 / ASIN" clearable style="width:160px" @keyup.enter="fetchData">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="filter.targetingType" placeholder="投放类型" clearable style="width:100px" @change="fetchData">
        <el-option label="紧密匹配" value="紧密匹配" />
        <el-option label="宽泛匹配" value="宽泛匹配" />
        <el-option label="同类商品" value="同类商品" />
        <el-option label="关联商品" value="关联商品" />
      </el-select>
      <el-date-picker v-model="filter.startDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width:120px" @change="fetchData" />
      <el-date-picker v-model="filter.endDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="width:120px" @change="fetchData" />
      <el-button type="primary" @click="fetchData">
        <el-icon><Search /></el-icon> 搜索
      </el-button>
      <el-button @click="resetFilter">重置</el-button>
      <el-button @click="handleExport">导出</el-button>
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

    <div class="table-panel" v-loading="loading">
      <table class="cpc-table">
        <thead>
          <tr>
            <th width="200">顾客搜索词</th>
            <th width="80">投放类型</th>
            <th width="70">曝光量</th>
            <th width="60">点击</th>
            <th width="70">点击率</th>
            <th width="70">花费</th>
            <th width="60">CPC</th>
            <th width="60">购买量</th>
            <th width="70">销售额</th>
            <th width="70">ACOS</th>
            <th width="60">ROAS</th>
            <th width="60">CPA</th>
            <th width="60">CVR</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableData" :key="row.id || row.customer_search_term + row.keyword_text">
            <td>
              <a
                v-if="isAsinRow(row)"
                class="link-asin"
                :href="`https://www.amazon.com/dp/${row.customer_search_term.toUpperCase()}`"
                target="_blank"
                @click.stop
              >
                {{ row.customer_search_term.toUpperCase() }}
              </a>
              <span v-else class="search-term">{{ row.customer_search_term }}</span>
            </td>
            <td align="center">{{ row.targeting_type_label || '--' }}</td>
            <td align="right">{{ fmtInt(row.impressions) }}</td>
            <td align="right">{{ fmtInt(row.clicks) }}</td>
            <td align="right">{{ fmtPct(row.ctr) }}</td>
            <td align="right">${{ formatNum(row.cost) }}</td>
            <td align="right">${{ formatNum(row.cpc) }}</td>
            <td align="right">{{ fmtInt(row.purchases_7d) }}</td>
            <td align="right">${{ formatNum(row.sales_7d) }}</td>
            <td align="right">{{ fmtPct(row.acos) }}</td>
            <td align="right">{{ formatNum(row.sales_7d / Math.max(row.cost, 0.01)) }}</td>
            <td align="right">${{ formatNum(row.cpa) }}</td>
            <td align="right">{{ fmtPct(row.cvr) }}</td>
          </tr>
        </tbody>
      </table>
      <el-empty v-if="!loading && !tableData.length" description="无可用数据" />
      <div class="pagination-wrap">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20,50,100]" layout="total, sizes, prev, pager, next, jumper" @change="fetchData" />
      </div>
    </div>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getCpcSearchTerms } from '@/services/cpc'
import { exportToCSV } from '@/utils/export'

const props = defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true },
  adGroupId: { type: [Number, String], required: true }
})

const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const metricFilters = [
  { field: 'impressions', label: '曝光量', precision: 0, step: 1 },
  { field: 'clicks', label: '点击', precision: 0, step: 1 },
  { field: 'ctr', label: '点击率', precision: 2, step: 0.01 },
  { field: 'cost', label: '花费', precision: 2, step: 0.01 },
  { field: 'cpc', label: 'CPC', precision: 2, step: 0.01 },
  { field: 'purchases_7d', label: '购买量', precision: 0, step: 1 },
  { field: 'sales_7d', label: '销售额', precision: 2, step: 0.01 },
  { field: 'acos', label: 'ACOS', precision: 2, step: 0.01 },
  { field: 'roas', label: 'ROAS', precision: 2, step: 0.01 },
  { field: 'cpa', label: 'CPA', precision: 2, step: 0.01 },
  { field: 'cvr', label: 'CVR', precision: 2, step: 0.01 }
]

const buildFilter = () => {
  const base = {
    search: filter.search,
    targeting_type_label: filter.targetingType,
    start_date: filter.startDate || '',
    end_date: filter.endDate || ''
  }
  metricFilters.forEach(item => {
    const gte = filter[`${item.field}_gte`]
    const lte = filter[`${item.field}_lte`]
    if (gte != null && gte !== '') base[`${item.field}_gte`] = gte
    if (lte != null && lte !== '') base[`${item.field}_lte`] = lte
  })
  return base
}

const getDefaultFilter = () => ({
  search: '',
  targetingType: '',
  startDate: '',
  endDate: '',
  ...metricFilters.reduce((acc, item) => {
    acc[`${item.field}_gte`] = undefined
    acc[`${item.field}_lte`] = undefined
    return acc
  }, {})
})

const filter = reactive(getDefaultFilter())

const resetFilter = () => {
  Object.assign(filter, getDefaultFilter())
  page.value = 1
  fetchData()
}

const fetchData = async () => {
  if (!props.shopId || !props.campaignId || !props.adGroupId) return
  loading.value = true
  try {
    const res = await getCpcSearchTerms({
      campaign_id: props.campaignId,
      ad_group_id: props.adGroupId,
      shop_id: props.shopId,
      page: page.value,
      page_size: pageSize.value,
      ...buildFilter()
    })
    if (res.data.status === 'success') {
      tableData.value = (res.data.data.list || []).map(item => ({ ...item, _selected: false, state: (item.state || '').toUpperCase() }))
      total.value = res.data.data.total || 0
    }
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

const isAsinRow = (row) => {
  const type = row.targeting_type_label
  return (type === '关联商品' || type === '同类商品') && row.customer_search_term
}

const handleExport = () => {
  const columns = [
    { key: 'customer_search_term', label: '顾客搜索词' },
    { key: 'targeting_type_label', label: '投放类型' },
    { key: 'keyword_text', label: '关键词' },
    { key: 'impressions', label: '曝光量' },
    { key: 'clicks', label: '点击' },
    { key: 'ctr', label: '点击率' },
    { key: 'cost', label: '花费' },
    { key: 'cpc', label: 'CPC' },
    { key: 'purchases_7d', label: '购买量' },
    { key: 'sales_7d', label: '销售额' },
    { key: 'acos', label: 'ACOS' },
    { key: 'roas', label: 'ROAS' },
    { key: 'cpa', label: 'CPA' },
    { key: 'cvr', label: 'CVR' }
  ]
  const ok = exportToCSV('搜索词报告', columns, tableData.value, (val, col, row) => {
    if (col.key === 'roas') return formatNum(row.sales_7d / Math.max(row.cost, 0.01))
    if (['ctr', 'acos', 'cvr'].includes(col.key)) return fmtPct(val)
    if (['cost', 'cpc', 'sales_7d', 'cpa'].includes(col.key)) return formatNum(val)
    if (['impressions', 'clicks', 'purchases_7d'].includes(col.key)) return fmtInt(val)
    return val
  })
  if (!ok) ElMessage.warning('暂无数据可导出')
}

const formatNum = (val) => val != null && Number(val) !== 0 ? Number(val).toFixed(2) : '--'
const fmtInt = (val) => val != null && Number(val) !== 0 ? Number(val).toLocaleString() : '--'
const fmtPct = (val) => val != null && Number(val) !== 0 ? Number(val).toFixed(2) + '%' : '--'

watch(() => props.shopId, (val) => { if (val) fetchData() }, { immediate: true })
</script>

<style scoped>
.group-section { background: #fff; }
.filter-panel { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.advanced-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  padding: 10px 12px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin-bottom: 10px;
}
.metric-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 260px;
}
.metric-label {
  width: 56px;
  font-size: 12px;
  color: #606266;
  text-align: right;
}
.metric-sep {
  color: #909399;
  font-size: 12px;
}
.table-panel { overflow-x: auto; }
.cpc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.cpc-table th { background: #f5f7fa; border: 1px solid #ebeef5; padding: 6px 6px; text-align: left; font-weight: 600; color: #606266; }
.cpc-table td { border: 1px solid #ebeef5; padding: 6px 6px; vertical-align: middle; }
.cpc-table tbody tr:hover { background: #f5f7fa; }
.search-term { color: #303133; }
.link-asin {
  color: #ff0000;
  text-decoration: underline;
  cursor: pointer;
  word-break: break-all;
}
.link-asin:hover {
  color: #c62828;
}
.pagination-wrap { margin-top: 8px; display: flex; justify-content: flex-end; }
</style>
