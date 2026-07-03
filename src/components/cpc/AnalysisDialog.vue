<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="1400px"
    :close-on-click-modal="true"
    destroy-on-close
    class="cpc-analysis-dialog"
  >
    <div class="analysis-filter">
      <el-date-picker v-model="startDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="width:140px" @change="fetchData" />
      <el-date-picker v-model="endDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="width:140px" @change="fetchData" />
      <el-button type="primary" class="btn-search" @click="fetchData">搜索</el-button>
    </div>

    <el-table v-loading="loading" :data="tableData" stripe border size="small" style="width:100%" show-summary :summary-method="getSummaries">
      <el-table-column prop="report_date" label="日期" width="110" align="center" fixed />
      <el-table-column prop="impressions" label="曝光量" width="90" align="right">
        <template #default="{ row }">{{ fmtInt(row.impressions) }}</template>
      </el-table-column>
      <el-table-column prop="clicks" label="点击次数" width="90" align="right">
        <template #default="{ row }">{{ fmtInt(row.clicks) }}</template>
      </el-table-column>
      <el-table-column prop="cost" label="花费" width="80" align="right">
        <template #default="{ row }">{{ formatNum(row.cost) }}</template>
      </el-table-column>
      <el-table-column prop="purchases_7d" label="广告订单(7d)" width="110" align="right">
        <template #default="{ row }">{{ fmtInt(row.purchases_7d) }}</template>
      </el-table-column>
      <el-table-column prop="total_orders" label="实际订单" width="90" align="right">
        <template #default="{ row }">{{ fmtInt(row.total_orders) }}</template>
      </el-table-column>
      <el-table-column prop="sales_7d" label="广告销售额(7d)" width="120" align="right">
        <template #default="{ row }">{{ formatNum(row.sales_7d) }}</template>
      </el-table-column>
      <el-table-column prop="total_sales" label="实际销售额" width="100" align="right">
        <template #default="{ row }">{{ formatNum(row.total_sales) }}</template>
      </el-table-column>
      <el-table-column prop="top_of_search_impression_share" label="搜索结果首页首位IS" width="150" align="right">
        <template #default="{ row }">{{ fmtPct(row.top_of_search_impression_share) }}</template>
      </el-table-column>
      <el-table-column prop="cpc" label="CPC" width="70" align="right">
        <template #default="{ row }">{{ formatNum(row.cpc) }}</template>
      </el-table-column>
      <el-table-column prop="ctr" label="点击率" width="80" align="right">
        <template #default="{ row }">{{ fmtPct(row.ctr) }}</template>
      </el-table-column>
      <el-table-column prop="cvr" label="CVR" width="70" align="right">
        <template #default="{ row }">{{ fmtPct(row.cvr) }}</template>
      </el-table-column>
      <el-table-column prop="cpa" label="CPA" width="70" align="right">
        <template #default="{ row }">{{ formatNum(row.cpa) }}</template>
      </el-table-column>
      <el-table-column prop="acos" label="ACOS" width="80" align="right">
        <template #default="{ row }">{{ fmtPct(row.acos) }}</template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getCpcDailyData } from '@/services/cpc'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '广告活动详情' },
  shopId: { type: [String, Number], default: null },
  campaignId: { type: [String, Number], default: null }
})

const emit = defineEmits(['update:modelValue'])

const visible = ref(false)
const loading = ref(false)
const tableData = ref([])
const startDate = ref('')
const endDate = ref('')

const isSummary = computed(() => !props.campaignId)
const dialogTitle = computed(() => isSummary.value ? '所有广告活动汇总' : `广告活动详情:${props.title}`)

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) fetchData()
})
watch(visible, (val) => { emit('update:modelValue', val) })

const fetchData = async () => {
  if (!props.shopId) return
  loading.value = true
  try {
    const params = {
      shop_id: props.shopId,
      start_date: startDate.value || '',
      end_date: endDate.value || ''
    }
    if (!isSummary.value) {
      params.type = 'campaign'
      params.id = props.campaignId
    }
    const res = await getCpcDailyData(params)
    if (res.data.status === 'success') {
      tableData.value = res.data.data.list || []
    }
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

const formatNum = (val) => val != null ? Number(val).toFixed(2) : '-'
const fmtInt = (val) => val != null ? Number(val).toLocaleString() : '-'
const fmtPct = (val) => val != null ? Number(val).toFixed(2) + '%' : '-'

const getSummaries = (param) => {
  const { columns, data } = param
  const sums = []
  columns.forEach((col, index) => {
    if (index === 0) { sums[index] = '合计'; return }
    if (!['impressions', 'clicks', 'cost', 'purchases_7d', 'sales_7d', 'total_orders', 'total_sales'].includes(col.property)) {
      sums[index] = ''
      return
    }
    const vals = data.map(item => Number(item[col.property]))
    const sum = vals.filter(v => !isNaN(v)).reduce((a, b) => a + b, 0)
    if (['impressions', 'clicks', 'purchases_7d'].includes(col.property)) {
      sums[index] = sum.toLocaleString()
    } else {
      sums[index] = sum.toFixed(2)
    }
  })
  return sums
}

const open = () => { visible.value = true }
const close = () => { visible.value = false }

defineExpose({ open, close })
</script>

<style scoped>
.analysis-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.btn-search {
  background: #009688;
  border-color: #009688;
}
</style>
