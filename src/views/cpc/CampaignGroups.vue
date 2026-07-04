<template>
  <div class="campaign-section">
    <div class="toolbar">
      <el-button type="primary" class="btn-create" :disabled="!shopId" @click="goCreateGroup">
        <el-icon><Plus /></el-icon> 创建广告组
      </el-button>
      <el-input v-model="filter.search" placeholder="查找广告组" clearable style="width:220px" @keyup.enter="fetchData">
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
            <th>广告组名称</th>
            <th>状态</th>
            <th>预算状态</th>
            <th>默认出价</th>
            <th>曝光量</th>
            <th>点击次数</th>
            <th>花费</th>
            <th>CPC</th>
            <th>点击率</th>
            <th>CVR</th>
            <th>销售额</th>
            <th>ACOS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableData" :key="row.ad_group_id">
            <td><el-checkbox v-model="row._selected" /></td>
            <td>
              <div class="group-name" @click="goToDetail(row)">{{ row.name }}</div>
              <div class="group-id">ID: {{ row.ad_group_id }}</div>
            </td>
            <td align="center">
              <el-switch :model-value="row.state === 'ENABLED'" inline-prompt :disabled="row._loading" :loading="row._loading" @change="(val) => toggleState(row, val)" />
            </td>
            <td align="center">
              <span class="budget-status">{{ row.serving_status || '预算状态暂时无法获取' }}</span>
            </td>
            <td align="right">
              <span v-if="!row._editing" class="editable-cell" @click="startEditBid(row)">${{ formatNum(row.default_bid) }}</span>
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
            <td align="right">{{ formatNum(row.cost) }}</td>
            <td align="right">{{ formatNum(row.cpc) }}</td>
            <td align="right">{{ fmtPct(row.ctr) }}</td>
            <td align="right">{{ fmtPct(row.cvr) }}</td>
            <td align="right">{{ formatNum(row.sales_7d) }}</td>
            <td align="right">{{ fmtPct(row.acos) }}</td>
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
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCpcGroups, updateCpcGroup } from '@/services/cpc'
import { exportToCSV } from '@/utils/export'

const props = defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true }
})

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const selectAll = ref(false)
const batchLoading = ref(false)
const filter = reactive({ search: '', state: '', dateRange: [] })

const selectedRows = computed(() => tableData.value.filter(row => row._selected))

const fetchData = async () => {
  if (!props.shopId || !props.campaignId) return
  loading.value = true
  try {
    const res = await getCpcGroups({
      campaign_id: props.campaignId,
      shop_id: props.shopId,
      page: page.value,
      page_size: pageSize.value,
      start_date: filter.dateRange?.[0] || '',
      end_date: filter.dateRange?.[1] || '',
      search: filter.search,
      state: filter.state
    })
    if (res.data.status === 'success') {
      tableData.value = (res.data.data.list || []).map(item => ({
        ...item,
        _selected: false,
        _editing: false,
        _editBid: Number(item.default_bid) || 0,
        _loading: false,
        _saving: false,
        state: (item.state || '').toUpperCase()
      }))
      total.value = res.data.data.total || 0
    }
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

const goToDetail = (row) => {
  router.push({ name: 'CpcGroupDetail', params: { id: props.campaignId, adGroupId: row.ad_group_id } })
}

const goCreateGroup = () => {
  router.push({ name: 'CpcCreateGroup', params: { id: props.campaignId } })
}

const toggleState = async (row, val) => {
  row._loading = true
  try {
    await updateCpcGroup(row.ad_group_id, { shop_id: props.shopId, state: val ? 'enabled' : 'paused' })
    row.state = val ? 'ENABLED' : 'PAUSED'
    ElMessage.success('更新成功')
  } catch {
    ElMessage.error('更新失败')
  } finally {
    row._loading = false
  }
}

const startEditBid = (row) => {
  row._editBid = Number(row.default_bid) || 0
  row._editing = true
}

const saveBid = async (row) => {
  const newBid = Number(row._editBid)
  if (newBid === Number(row.default_bid)) {
    row._editing = false
    return
  }
  row._saving = true
  try {
    await updateCpcGroup(row.ad_group_id, { shop_id: props.shopId, defaultBid: newBid })
    row.default_bid = newBid
    ElMessage.success('出价更新成功')
    row._editing = false
  } catch {
    ElMessage.error('出价更新失败')
    row._editBid = Number(row.default_bid) || 0
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
      await ElMessageBox.confirm(`确定删除选中的 ${rows.length} 个广告组吗？`, '确认', { type: 'warning' })
      await Promise.all(rows.map(row => updateCpcGroup(row.ad_group_id, { shop_id: props.shopId, state: 'archived' })))
      ElMessage.success('批量删除成功')
      fetchData()
      return
    }
    const state = cmd === 'enable' ? 'enabled' : 'paused'
    await Promise.all(rows.map(row => updateCpcGroup(row.ad_group_id, { shop_id: props.shopId, state })))
    rows.forEach(row => { row.state = cmd === 'enable' ? 'ENABLED' : 'PAUSED' })
    ElMessage.success('批量更新成功')
  } catch { /* noop */ }
  finally { batchLoading.value = false }
}

const toggleSelectAll = (val) => { tableData.value.forEach(row => { row._selected = val }) }

const handleExport = () => {
  const columns = [
    { key: 'name', label: '广告组名称' },
    { key: 'ad_group_id', label: '广告组ID' },
    { key: 'state', label: '状态' },
    { key: 'serving_status', label: '预算状态' },
    { key: 'default_bid', label: '默认出价' },
    { key: 'impressions', label: '曝光量' },
    { key: 'clicks', label: '点击次数' },
    { key: 'cost', label: '花费' },
    { key: 'cpc', label: 'CPC' },
    { key: 'ctr', label: '点击率' },
    { key: 'cvr', label: 'CVR' },
    { key: 'sales_7d', label: '销售额' },
    { key: 'acos', label: 'ACOS' }
  ]
  const ok = exportToCSV('广告组列表', columns, tableData.value, (val, col, row) => {
    if (col.key === 'state') return row.state === 'ENABLED' ? '启用' : (row.state === 'PAUSED' ? '暂停' : '归档')
    if (col.key === 'serving_status') return val || '预算状态暂时无法获取'
    if (['ctr', 'cvr', 'acos'].includes(col.key)) return fmtPct(val)
    if (['default_bid', 'cost', 'cpc', 'sales_7d'].includes(col.key)) return formatNum(val)
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
.campaign-section { background: #fff; }
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.toolbar-right { margin-left: auto; display: flex; gap: 12px; }
.btn-create { background: #303133; border-color: #303133; }
.table-panel { overflow-x: auto; }
.cpc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.cpc-table th { background: #f5f7fa; border: 1px solid #ebeef5; padding: 10px 8px; text-align: left; font-weight: 600; color: #606266; }
.cpc-table td { border: 1px solid #ebeef5; padding: 10px 8px; vertical-align: middle; }
.cpc-table tbody tr:hover { background: #f5f7fa; }
.group-name { font-weight: 500; color: #409eff; cursor: pointer; text-decoration: underline; }
.group-name:hover { color: #66b1ff; }
.group-id { color: #909399; font-size: 11px; margin-top: 2px; }
.editable-cell { cursor: pointer; color: #409eff; }
.editable-cell:hover { text-decoration: underline; }
.budget-status { color: #909399; font-size: 12px; }
.pagination-wrap { margin-top: 12px; display: flex; justify-content: flex-end; }
</style>
