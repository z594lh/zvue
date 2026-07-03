<template>
  <CpcLayout active-tab="campaigns" @shop-change="onShopChange">
    <div class="cpc-sub-page">
      <div class="page-header">
        <h3>{{ pageTitle }} - 分日数据</h3>
      </div>
      <div class="filter-panel">
        <el-date-picker v-model="startDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width:140px" @change="fetchData" />
        <el-date-picker v-model="endDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="width:140px" @change="fetchData" />
        <el-button type="primary" class="btn-search" @click="fetchData">
          <el-icon><Search /></el-icon> 查询
        </el-button>
      </div>

      <div class="table-panel" v-loading="loading">
        <table class="cpc-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>曝光</th>
              <th>点击</th>
              <th>花费</th>
              <th>广告订单(7d)</th>
              <th>广告销售额(7d)</th>
              <th>首页首位IS</th>
              <th>CPC</th>
              <th>CTR</th>
              <th>CVR</th>
              <th>CPA</th>
              <th>ACOS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableData" :key="row.report_date">
              <td align="center">{{ row.report_date }}</td>
              <td align="right">{{ fmtInt(row.impressions) }}</td>
              <td align="right">{{ fmtInt(row.clicks) }}</td>
              <td align="right">${{ formatNum(row.cost) }}</td>
              <td align="right">{{ fmtInt(row.purchases_7d) }}</td>
              <td align="right">${{ formatNum(row.sales_7d) }}</td>
              <td align="right">{{ fmtPct(row.top_of_search_impression_share) }}</td>
              <td align="right">${{ formatNum(row.cpc) }}</td>
              <td align="right">{{ fmtPct(row.ctr) }}</td>
              <td align="right">{{ fmtPct(row.cvr) }}</td>
              <td align="right">${{ formatNum(row.cpa) }}</td>
              <td align="right">{{ fmtPct(row.acos) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="summary-row">
          <span class="summary-label">合计</span>
          <span class="summary-item">曝光: {{ fmtInt(summary.impressions) }}</span>
          <span class="summary-item">点击: {{ fmtInt(summary.clicks) }}</span>
          <span class="summary-item">花费: ${{ formatNum(summary.cost) }}</span>
          <span class="summary-item">广告订单: {{ fmtInt(summary.purchases_7d) }}</span>
          <span class="summary-item">广告销售额: ${{ formatNum(summary.sales_7d) }}</span>
        </div>
      </div>
    </div>
  </CpcLayout>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import CpcLayout from '@/components/cpc/CpcLayout.vue'
import { getCpcDailyData } from '@/services/cpc'

const route = useRoute()
const entityType = computed(() => route.params.type)
const entityId = computed(() => route.params.id)
const isSummary = computed(() => route.name === 'CpcDailyDataSummary')
const shopId = ref(null)
const loading = ref(false)
const tableData = ref([])
const startDate = ref('')
const endDate = ref('')

const typeLabelMap = {
  campaign: '广告活动',
  adgroup: '广告组',
  keyword: '关键词',
  target: '投放',
  searchterm: '搜索词',
  placement: '广告位'
}

const pageTitle = computed(() => {
  if (isSummary.value) return '所有广告活动汇总'
  const label = typeLabelMap[entityType.value] || entityType.value
  return `${label} #${entityId.value}`
})

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

const onShopChange = (val) => { shopId.value = val; fetchData() }

const fetchData = async () => {
  if (!shopId.value) return
  if (!isSummary.value && !entityId.value) return
  loading.value = true
  try {
    const params = {
      shop_id: shopId.value,
      start_date: startDate.value || '',
      end_date: endDate.value || ''
    }
    if (!isSummary.value) {
      params.type = entityType.value
      params.id = entityId.value
    }
    const res = await getCpcDailyData(params)
    if (res.data.status === 'success') {
      tableData.value = res.data.data.list || []
    }
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

const formatNum = (val) => val != null ? Number(val).toFixed(2) : '--'
const fmtInt = (val) => val != null ? Number(val).toLocaleString() : '--'
const fmtPct = (val) => val != null ? Number(val).toFixed(2) + '%' : '--'

onMounted(() => { if (shopId.value) fetchData() })
</script>

<style scoped>
.cpc-sub-page { background: #fff; border-radius: 4px; padding: 12px; }
.page-header { margin-bottom: 12px; }
.page-header h3 { margin: 0; font-size: 16px; color: #303133; }
.filter-panel { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.btn-search { background: #009688; border-color: #009688; }
.table-panel { overflow-x: auto; }
.cpc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.cpc-table th { background: #f5f7fa; border: 1px solid #ebeef5; padding: 8px 4px; text-align: center; font-weight: 600; }
.cpc-table td { border: 1px solid #ebeef5; padding: 6px 4px; vertical-align: middle; }
.cpc-table tbody tr:hover { background: #f5f7fa; }
.summary-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-top: none;
  font-size: 12px;
  flex-wrap: wrap;
}
.summary-label { font-weight: 600; }
.summary-item { color: #606266; }
</style>
