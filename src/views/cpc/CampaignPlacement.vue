<template>
  <div class="campaign-section">
    <div class="sub-tabs">
      <div class="sub-tab active">所有广告位</div>
    </div>
    <p class="section-tip">提高特定广告位的竞价。</p>

    <div class="toolbar">
      <div class="toolbar-right">
        <el-date-picker v-model="filter.dateRange" type="daterange" range-separator="-" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:180px" @change="fetchData" />
        <el-button @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="table-panel" v-loading="loading">
      <table class="cpc-table">
        <thead>
          <tr>
            <th>广告位名称</th>
            <th>广告活动竞价方案</th>
            <th>竞价调整</th>
            <th>展示量</th>
            <th>点击量</th>
            <th>点击率</th>
            <th>总成本</th>
            <th>CPC</th>
            <th>购买量</th>
            <th>销售额</th>
            <th>ACOS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableData" :key="row.placement">
            <td>{{ placementLabel(row.placement) }}</td>
            <td>{{ campaignBiddingLabel }}</td>
            <td align="right">
              <span class="editable-cell" @click="editPlacement(row)">{{ row.percentage != null ? row.percentage + '%' : '--' }}</span>
            </td>
            <td align="right">{{ fmtInt(row.impressions) }}</td>
            <td align="right">{{ fmtInt(row.clicks) }}</td>
            <td align="right">{{ fmtPct(row.ctr) }}</td>
            <td align="right">${{ formatNum(row.cost) }}</td>
            <td align="right">${{ formatNum(row.cpc) }}</td>
            <td align="right">{{ fmtInt(row.purchases_7d) }}</td>
            <td align="right">${{ formatNum(row.sales_7d) }}</td>
            <td align="right">{{ fmtPct(row.acos) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="table-note">竞价调整数据是最新的，但其他广告位数据最多可能有 12 小时的延迟。</p>
    </div>

    <el-dialog v-model="bidVisible" title="调整广告位出价" width="400px" destroy-on-close>
      <el-form :model="bidForm" label-width="120px">
        <el-form-item label="广告位"><span>{{ placementLabel(bidForm.placement) }}</span></el-form-item>
        <el-form-item label="出价调整(%)">
          <el-input-number v-model="bidForm.percentage" :min="0" :max="900" :step="1" controls-position="right" />
          <div style="color:#909399;font-size:12px;margin-top:4px">0-900%，设为0表示不调整</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bidVisible=false">取消</el-button>
        <el-button type="primary" :loading="bidSaving" @click="saveBid">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getCpcPlacements, updateCpcPlacement, getCpcCampaign } from '@/services/cpc'
import { exportToCSV } from '@/utils/export'

const props = defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true }
})

const loading = ref(false)
const tableData = ref([])
const campaignBiddingLabel = ref('--')
const bidVisible = ref(false)
const bidSaving = ref(false)
const bidForm = ref({ placement: '', percentage: 0 })
const filter = reactive({ dateRange: [] })

const placementMap = {
  'Top of Search on-Amazon': '搜索结果顶部（首页）',
  'PLACEMENT_TOP': '搜索结果顶部（首页）',
  'Other on-Amazon': '搜索结果的其余位置',
  'PLACEMENT_REST_OF_SEARCH': '搜索结果的其余位置',
  'Detail Page on-Amazon': '商品页面',
  'PLACEMENT_PRODUCT_PAGE': '商品页面',
  'Off Amazon': '站外',
  'PLACEMENT_OFF_AMAZON': '站外'
}
const placementCodeMap = {
  'Top of Search on-Amazon': 'PLACEMENT_TOP',
  'Other on-Amazon': 'PLACEMENT_REST_OF_SEARCH',
  'Detail Page on-Amazon': 'PLACEMENT_PRODUCT_PAGE',
  'Off Amazon': 'PLACEMENT_OFF_AMAZON'
}

const placementLabel = (val) => placementMap[val] || val || '--'

const fetchData = async () => {
  if (!props.shopId || !props.campaignId) return
  loading.value = true
  try {
    const [placeRes, campRes] = await Promise.all([
      getCpcPlacements({
        campaign_id: props.campaignId,
        shop_id: props.shopId,
        start_date: filter.dateRange?.[0] || '',
        end_date: filter.dateRange?.[1] || ''
      }),
      getCpcCampaign(props.campaignId, { shop_id: props.shopId })
    ])
    if (placeRes.data.status === 'success') {
      const data = placeRes.data.data
      tableData.value = Array.isArray(data) ? data : (data?.list || [])
    }
    if (campRes.data.status === 'success') {
      campaignBiddingLabel.value = campRes.data.data.bidding_strategy_label || campRes.data.data.bidding_strategy || '--'
    }
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

const editPlacement = (row) => {
  bidForm.value = { placement: row.placement, percentage: row.percentage ?? 0 }
  bidVisible.value = true
}

const saveBid = async () => {
  const code = placementCodeMap[bidForm.value.placement]
  if (!code) { ElMessage.error('未知广告位类型'); return }
  bidSaving.value = true
  try {
    await updateCpcPlacement(props.campaignId, {
      shop_id: props.shopId,
      placement: code,
      percentage: bidForm.value.percentage
    })
    ElMessage.success('更新成功')
    bidVisible.value = false
    fetchData()
  } catch { ElMessage.error('更新失败') }
  finally { bidSaving.value = false }
}

const handleExport = () => {
  const columns = [
    { key: 'placement', label: '广告位名称' },
    { key: 'bidding', label: '广告活动竞价方案' },
    { key: 'percentage', label: '竞价调整(%)' },
    { key: 'impressions', label: '展示量' },
    { key: 'clicks', label: '点击量' },
    { key: 'ctr', label: '点击率' },
    { key: 'cost', label: '总成本' },
    { key: 'cpc', label: 'CPC' },
    { key: 'purchases_7d', label: '购买量' },
    { key: 'sales_7d', label: '销售额' },
    { key: 'acos', label: 'ACOS' }
  ]
  const ok = exportToCSV('广告位数据', columns, tableData.value, (val, col) => {
    if (col.key === 'placement') return placementLabel(val)
    if (col.key === 'bidding') return campaignBiddingLabel.value
    if (col.key === 'percentage') return val != null ? val + '%' : '--'
    if (col.key === 'ctr' || col.key === 'acos') return fmtPct(val)
    if (['cost', 'cpc', 'sales_7d'].includes(col.key)) return formatNum(val)
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
.campaign-section { background: #fff; }
.sub-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.sub-tab { padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; color: #606266; background: #f5f7fa; }
.sub-tab.active { background: #409eff; color: #fff; }
.section-tip { color: #909399; font-size: 13px; margin-bottom: 16px; }
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.toolbar-right { margin-left: auto; display: flex; gap: 12px; }
.table-panel { overflow-x: auto; }
.cpc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.cpc-table th { background: #f5f7fa; border: 1px solid #ebeef5; padding: 10px 8px; text-align: left; font-weight: 600; color: #606266; }
.cpc-table td { border: 1px solid #ebeef5; padding: 10px 8px; vertical-align: middle; }
.cpc-table tbody tr:hover { background: #f5f7fa; }
.editable-cell { cursor: pointer; color: #409eff; }
.editable-cell:hover { text-decoration: underline; }
.table-note { color: #909399; font-size: 12px; margin-top: 12px; }
</style>
