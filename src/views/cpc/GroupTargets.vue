<template>
  <div class="group-section">
    <div class="sub-tabs">
      <div class="sub-tab" :class="{ active: activeTab === 'auto' }" @click="activeTab = 'auto'">自动投放</div>
      <div class="sub-tab" :class="{ active: activeTab === 'manual' }" @click="activeTab = 'manual'">手动投放</div>
    </div>

    <div class="toolbar">
      <el-button type="primary" class="btn-create" :disabled="!shopId">
        <el-icon><Plus /></el-icon> {{ activeTab === 'auto' ? '调整自动投放' : '添加投放目标' }}
      </el-button>
      <el-input v-model="filter.search" placeholder="查找投放" clearable style="width:220px" @keyup.enter="fetchData">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-dropdown @command="handleBatchCommand" :disabled="!selectedRows.length || batchLoading">
        <el-button>批量操作 <el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="enable">批量启用</el-dropdown-item>
            <el-dropdown-item command="pause">批量暂停</el-dropdown-item>
            <el-dropdown-item command="delete" divided>批量删除</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <div class="toolbar-right">
        <el-date-picker v-model="filter.dateRange" type="daterange" range-separator="-" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:180px" @change="fetchData" />
        <el-button @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="table-panel" v-loading="loading">
      <table class="cpc-table">
        <thead>
          <tr>
            <th width="40"><el-checkbox v-model="selectAll" @change="toggleSelectAll" /></th>
            <th>{{ activeTab === 'auto' ? '投放类型' : '投放对象' }}</th>
            <th>状态</th>
            <th>建议竞价</th>
            <th>竞价</th>
            <th>曝光</th>
            <th>点击</th>
            <th>花费</th>
            <th>CPC</th>
            <th>CTR</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableData" :key="row.target_id || row.keyword_id">
            <td><el-checkbox v-model="row._selected" /></td>
            <td>
              <div>{{ activeTab === 'auto' ? row.resolved_expression_label : row.resolved_expression }}</div>
              <div v-if="activeTab === 'auto' && row.serving_status" class="sub-text">{{ row.serving_status }}</div>
            </td>
            <td align="center">
              <el-switch :model-value="row.state === 'ENABLED'" inline-prompt :disabled="row._loading" :loading="row._loading" @change="(val) => toggleState(row, val)" />
            </td>
            <td align="right">--</td>
            <td align="right">
              <span v-if="!row._editing" class="editable-cell" @click="startEditBid(row)">${{ formatNum(row.bid) }}</span>
              <el-input-number
                v-else
                v-model="row._editBid"
                :disabled="row._saving"
                :min="0.01" :step="0.01" :precision="2"
                size="small" controls-position="right" style="width:100px"
                @blur="saveBid(row)" @keyup.enter="saveBid(row)"
              />
            </td>
            <td align="right">{{ fmtInt(row.impressions) }}</td>
            <td align="right">{{ fmtInt(row.clicks) }}</td>
            <td align="right">${{ formatNum(row.cost) }}</td>
            <td align="right">${{ formatNum(row.cpc) }}</td>
            <td align="right">{{ fmtPct(row.ctr) }}</td>
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
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCpcTargets, getCpcTargetsAuto, updateCpcTarget } from '@/services/cpc'
import { exportToCSV } from '@/utils/export'

const props = defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true },
  adGroupId: { type: [Number, String], required: true }
})

const activeTab = ref('auto')
const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const selectAll = ref(false)
const batchLoading = ref(false)
const filter = reactive({ search: '', state: '', dateRange: [] })

const expressionMap = {
  'QUERY_HIGH_REL_MATCHES': '紧密匹配',
  'QUERY_BROAD_REL_MATCHES': '宽泛匹配',
  'ASIN_SUBSTITUTE_RELATED': '同类商品',
  'ASIN_ACCESSORY_RELATED': '关联商品'
}
const autoExpressions = Object.keys(expressionMap)

const selectedRows = computed(() => tableData.value.filter(row => row._selected))

const fetchData = async () => {
  if (!props.shopId || !props.campaignId || !props.adGroupId) return
  loading.value = true
  try {
    const api = activeTab.value === 'auto' ? getCpcTargetsAuto : getCpcTargets
    const res = await api({
      campaign_id: props.campaignId,
      ad_group_id: props.adGroupId,
      shop_id: props.shopId,
      page: page.value,
      page_size: pageSize.value,
      start_date: filter.dateRange?.[0] || '',
      end_date: filter.dateRange?.[1] || '',
      search: filter.search,
      state: filter.state
    })
    if (res.data.status === 'success') {
      let list = res.data.data.list || []
      if (activeTab.value === 'auto') {
        list = list.filter(item => autoExpressions.includes(item.resolved_expression))
          .map(item => ({ ...item, resolved_expression_label: expressionMap[item.resolved_expression] || item.resolved_expression }))
      }
      tableData.value = list.map(item => ({ ...item, _editing: false, _editBid: item.bid, _selected: false, _loading: false, _saving: false, state: (item.state || '').toUpperCase() }))
      total.value = activeTab.value === 'auto' ? tableData.value.length : (res.data.data.total || 0)
    }
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

watch(activeTab, () => { page.value = 1; fetchData() })

const toggleState = async (row, val) => {
  row._loading = true
  try {
    await updateCpcTarget(row.target_id, { shop_id: props.shopId, state: val ? 'enabled' : 'paused' })
    row.state = val ? 'ENABLED' : 'PAUSED'
    ElMessage.success('更新成功')
  } catch {
    ElMessage.error('更新失败')
  } finally {
    row._loading = false
  }
}

const startEditBid = (row) => { row._editing = true; row._editBid = row.bid }
const saveBid = async (row) => {
  if (row._editBid === row.bid) {
    row._editing = false
    return
  }
  row._saving = true
  try {
    await updateCpcTarget(row.target_id, { shop_id: props.shopId, bid: row._editBid })
    row.bid = row._editBid
    ElMessage.success('出价更新成功')
    row._editing = false
  } catch {
    ElMessage.error('出价更新失败')
    row._editBid = row.bid
  } finally {
    row._saving = false
  }
}

const handleBatchCommand = async (cmd) => {
  const rows = selectedRows.value
  if (!rows.length) return
  batchLoading.value = true
  try {
    if (cmd === 'delete') {
      await ElMessageBox.confirm(`确定删除选中的 ${rows.length} 个投放吗？`, '确认', { type: 'warning' })
      await Promise.all(rows.map(row => updateCpcTarget(row.target_id, { shop_id: props.shopId, state: 'archived' })))
      ElMessage.success('批量删除成功')
      fetchData()
      return
    }
    const state = cmd === 'enable' ? 'enabled' : 'paused'
    await Promise.all(rows.map(row => updateCpcTarget(row.target_id, { shop_id: props.shopId, state })))
    rows.forEach(row => { row.state = cmd === 'enable' ? 'ENABLED' : 'PAUSED' })
    ElMessage.success('批量更新成功')
  } catch { /* noop */ }
  finally { batchLoading.value = false }
}

const toggleSelectAll = (val) => { tableData.value.forEach(row => { row._selected = val }) }

const handleExport = () => {
  const isAuto = activeTab.value === 'auto'
  const columns = [
    { key: 'target', label: isAuto ? '投放类型' : '投放对象' },
    { key: 'state', label: '状态' },
    { key: 'bid', label: '竞价' },
    { key: 'impressions', label: '曝光' },
    { key: 'clicks', label: '点击' },
    { key: 'cost', label: '花费' },
    { key: 'cpc', label: 'CPC' },
    { key: 'ctr', label: 'CTR' }
  ]
  const ok = exportToCSV(isAuto ? '自动投放列表' : '手动投放列表', columns, tableData.value, (val, col, row) => {
    if (col.key === 'target') return isAuto ? (row.resolved_expression_label || row.resolved_expression) : row.resolved_expression
    if (col.key === 'state') return row.state === 'ENABLED' ? '启用' : (row.state === 'PAUSED' ? '暂停' : '归档')
    if (col.key === 'ctr') return fmtPct(val)
    if (['cost', 'cpc', 'bid'].includes(col.key)) return formatNum(val)
    if (['impressions', 'clicks'].includes(col.key)) return fmtInt(val)
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
.sub-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.sub-tab { padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; color: #606266; background: #f5f7fa; }
.sub-tab:hover { color: #409eff; }
.sub-tab.active { background: #409eff; color: #fff; }
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.toolbar-right { margin-left: auto; display: flex; gap: 12px; }
.btn-create { background: #303133; border-color: #303133; }
.table-panel { overflow-x: auto; }
.cpc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.cpc-table th { background: #f5f7fa; border: 1px solid #ebeef5; padding: 10px 8px; text-align: left; font-weight: 600; color: #606266; }
.cpc-table td { border: 1px solid #ebeef5; padding: 10px 8px; vertical-align: middle; }
.cpc-table tbody tr:hover { background: #f5f7fa; }
.editable-cell { cursor: pointer; color: #409eff; }
.editable-cell:hover { text-decoration: underline; }
.sub-text { color: #909399; font-size: 11px; }
.pagination-wrap { margin-top: 12px; display: flex; justify-content: flex-end; }
</style>
