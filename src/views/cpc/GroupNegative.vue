<template>
  <div class="group-section">
    <div class="sub-tabs">
      <div class="sub-tab" :class="{ active: activeTab === 'keywords' }" @click="activeTab = 'keywords'">否定关键词</div>
      <div class="sub-tab" :class="{ active: activeTab === 'targets' }" @click="activeTab = 'targets'">否定商品</div>
    </div>

    <div class="toolbar">
      <el-button type="primary" class="btn-create" @click="openAddDialog" :disabled="!shopId">
        <el-icon><Plus /></el-icon> {{ activeTab === 'keywords' ? '添加否定关键词' : '添加否定商品' }}
      </el-button>
      <el-input v-model="filter.search" :placeholder="activeTab === 'keywords' ? '查找否定关键词' : '查找否定商品'" clearable style="width:220px" @keyup.enter="fetchData">
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
    </div>

    <div class="table-panel" v-loading="loading">
      <table class="cpc-table">
        <thead>
          <tr>
            <th width="40"><el-checkbox v-model="selectAll" @change="toggleSelectAll" /></th>
            <th>{{ activeTab === 'keywords' ? '关键词' : '商品' }}</th>
            <th width="160">投放匹配类型</th>
            <th width="80">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableData" :key="row.keyword_id || row.target_id">
            <td><el-checkbox v-model="row._selected" /></td>
            <td>{{ row.keyword_text || row.resolved_expression }}</td>
            <td align="center">{{ matchTypeLabel(row.match_type || row.expression_type) }}</td>
            <td align="center">
              <el-button link type="danger" size="small" :loading="deletingId === (row.keyword_id || row.target_id)" :disabled="deletingId === (row.keyword_id || row.target_id) || batchLoading" @click="removeItem(row)">删除</el-button>
            </td>
          </tr>
        </tbody>
      </table>
      <el-empty v-if="!loading && !tableData.length" description="无可用数据" />
      <div class="pagination-wrap">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20,50,100]" layout="total, sizes, prev, pager, next, jumper" @change="fetchData" />
      </div>
    </div>

    <!-- 添加否定关键词弹窗-->
    <el-dialog v-model="keywordAddVisible" title="添加否定关键词" width="700px" destroy-on-close>
      <div class="add-dialog-body">
        <div class="add-left">
          <div class="match-type-row">
            <span class="label">匹配类型</span>
            <el-radio-group v-model="addForm.matchType">
              <el-radio label="NEGATIVE_EXACT">否定精准</el-radio>
              <el-radio label="NEGATIVE_PHRASE">否定词组</el-radio>
            </el-radio-group>
          </div>
          <el-input v-model="addForm.keywordsText" type="textarea" :rows="12" placeholder="输入关键词，以换行符分隔" resize="none" />
          <div class="add-actions">
            <el-button type="primary" @click="translateAndAdd">翻译为英语并添加</el-button>
            <el-button @click="addToPreview">添加关键词</el-button>
          </div>
        </div>
        <div class="add-right">
          <div class="preview-header">
            <span>已添加 {{ previewList.length }} 个</span>
            <el-button link type="danger" size="small" @click="previewList = []">删除所有</el-button>
          </div>
          <table class="preview-table">
            <thead>
              <tr><th>关键词</th><th width="90">匹配类型</th><th width="50"></th></tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in previewList" :key="idx">
                <td>{{ item.keywordText }}</td>
                <td>{{ matchTypeLabel(item.matchType) }}</td>
                <td align="center"><el-icon class="icon-delete" @click="removePreview(idx)"><Close /></el-icon></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <template #footer>
        <el-button @click="keywordAddVisible = false">取消</el-button>
        <el-button type="primary" :loading="addSaving" @click="saveKeywords">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加否定商品弹窗 -->
    <el-dialog v-model="targetAddVisible" title="添加否定商品" width="500px" destroy-on-close>
      <el-form :model="targetForm" label-width="100px">
        <el-form-item label="类型">
          <el-select v-model="targetForm.targetType" style="width:100%">
            <el-option label="ASIN" value="ASIN" />
            <el-option label="品牌" value="BRAND" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标值">
          <el-input v-model="targetForm.targetValue" type="textarea" :rows="4" placeholder="每行一个目标（ASIN或品牌名称）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="targetAddVisible=false">取消</el-button>
        <el-button type="primary" :loading="addSaving" @click="saveTargets">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCpcNegativeKeywords, createCpcNegativeKeyword, updateCpcNegativeKeyword, getCpcNegativeTargets, createCpcNegativeTarget, updateCpcNegativeTarget } from '@/services/cpc'

const props = defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true },
  adGroupId: { type: [Number, String], required: true }
})

const activeTab = ref('keywords')
const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const selectAll = ref(false)
const filter = reactive({ search: '', state: '' })

const keywordAddVisible = ref(false)
const targetAddVisible = ref(false)
const addSaving = ref(false)
const deletingId = ref(null)
const batchLoading = ref(false)
const addForm = reactive({ keywordsText: '', matchType: 'NEGATIVE_EXACT' })
const targetForm = reactive({ targetType: 'ASIN', targetValue: '' })
const previewList = ref([])

const selectedRows = computed(() => tableData.value.filter(row => row._selected))

const fetchData = async () => {
  if (!props.shopId || !props.campaignId || !props.adGroupId) return
  loading.value = true
  try {
    const api = activeTab.value === 'keywords' ? getCpcNegativeKeywords : getCpcNegativeTargets
    const res = await api({
      campaign_id: props.campaignId,
      ad_group_id: props.adGroupId,
      shop_id: props.shopId,
      page: page.value,
      page_size: pageSize.value,
      search: filter.search,
      state: filter.state || 'unarchived'
    })
    if (res.data.status === 'success') {
      tableData.value = (res.data.data.list || []).map(item => ({ ...item, _selected: false, state: (item.state || '').toUpperCase() }))
      total.value = res.data.data.total || 0
    }
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

watch(activeTab, () => { page.value = 1; fetchData() })

const matchTypeLabel = (val) => {
  const map = {
    'NEGATIVE_EXACT': '否定精准',
    'NEGATIVE_PHRASE': '否定词组',
    'EXACT': '否定精准',
    'PHRASE': '否定词组',
    'ASIN': 'ASIN',
    'BRAND': '品牌'
  }
  return map[val] || val || '--'
}

const openAddDialog = () => {
  if (activeTab.value === 'keywords') {
    addForm.keywordsText = ''
    addForm.matchType = 'NEGATIVE_EXACT'
    previewList.value = []
    keywordAddVisible.value = true
  } else {
    targetForm.targetType = 'ASIN'
    targetForm.targetValue = ''
    targetAddVisible.value = true
  }
}

const addToPreview = () => {
  const lines = addForm.keywordsText.split(/\n|\r/).map(s => s.trim()).filter(Boolean)
  if (!lines.length) { ElMessage.warning('请输入关键词'); return }
  const existing = new Set(previewList.value.map(p => `${p.keywordText}_${p.matchType}`))
  let added = 0
  lines.forEach(text => {
    const key = `${text}_${addForm.matchType}`
    if (!existing.has(key)) {
      previewList.value.push({ keywordText: text, matchType: addForm.matchType })
      existing.add(key)
      added++
    }
  })
  addForm.keywordsText = ''
  if (added) ElMessage.success(`已添加${added} 个关键词`)
}

const translateAndAdd = async () => {
  // TODO: 接入翻译接口
  addToPreview()
}

const removePreview = (idx) => { previewList.value.splice(idx, 1) }

const saveKeywords = async () => {
  if (!previewList.value.length) { ElMessage.warning('请先在左侧添加关键词'); return }
  addSaving.value = true
  try {
    const keywords = previewList.value.map(item => ({
      campaignId: Number(props.campaignId),
      adGroupId: Number(props.adGroupId),
      keywordText: item.keywordText,
      matchType: item.matchType,
      state: 'enabled'
    }))
    await createCpcNegativeKeyword({ shop_id: props.shopId, keywords })
    ElMessage.success(`成功添加 ${keywords.length} 个否定关键词`)
    keywordAddVisible.value = false
    previewList.value = []
    fetchData()
  } catch { ElMessage.error('添加失败') }
  finally { addSaving.value = false }
}

const saveTargets = async () => {
  const lines = targetForm.targetValue.split(/\n|\r/).map(s => s.trim()).filter(Boolean)
  if (!lines.length) { ElMessage.warning('请输入目标'); return }
  addSaving.value = true
  try {
    const targets = lines.map(val => ({
      campaignId: Number(props.campaignId),
      adGroupId: Number(props.adGroupId),
      expressionType: targetForm.targetType,
      expression: val,
      state: 'enabled'
    }))
    await createCpcNegativeTarget({ shop_id: props.shopId, targets })
    ElMessage.success('添加成功')
    targetAddVisible.value = false
    targetForm.targetValue = ''
    fetchData()
  } catch { ElMessage.error('添加失败') }
  finally { addSaving.value = false }
}

const removeItem = async (row) => {
  const id = activeTab.value === 'keywords' ? row.keyword_id : row.target_id
  try {
    const name = activeTab.value === 'keywords' ? '否定关键词' : '否定商品'
    await ElMessageBox.confirm(`确定要删除该${name}吗？`, '确认', { type: 'warning' })
    deletingId.value = id
    if (activeTab.value === 'keywords') {
      await updateCpcNegativeKeyword(row.keyword_id, { shop_id: props.shopId, state: 'archived' })
    } else {
      await updateCpcNegativeTarget(row.target_id, { shop_id: props.shopId, state: 'archived' })
    }
    ElMessage.success('删除成功')
    fetchData()
  } catch { /* noop */ }
  finally { deletingId.value = null }
}

const handleBatchCommand = async (cmd) => {
  const rows = selectedRows.value
  if (!rows.length) return
  batchLoading.value = true
  try {
    if (cmd === 'delete') {
      const name = activeTab.value === 'keywords' ? '否定关键词' : '否定商品'
      await ElMessageBox.confirm(`确定删除选中的 ${rows.length} 个${name}吗？`, '确认', { type: 'warning' })
      if (activeTab.value === 'keywords') {
        await Promise.all(rows.map(row => updateCpcNegativeKeyword(row.keyword_id, { shop_id: props.shopId, state: 'archived' })))
      } else {
        await Promise.all(rows.map(row => updateCpcNegativeTarget(row.target_id, { shop_id: props.shopId, state: 'archived' })))
      }
      ElMessage.success('批量删除成功')
      fetchData()
      return
    }
    const state = cmd === 'enable' ? 'enabled' : 'paused'
    if (activeTab.value === 'keywords') {
      await Promise.all(rows.map(row => updateCpcNegativeKeyword(row.keyword_id, { shop_id: props.shopId, state })))
    } else {
      await Promise.all(rows.map(row => updateCpcNegativeTarget(row.target_id, { shop_id: props.shopId, state })))
    }
    rows.forEach(row => { row.state = cmd === 'enable' ? 'ENABLED' : 'PAUSED' })
    ElMessage.success('批量更新成功')
  } catch { /* noop */ }
  finally { batchLoading.value = false }
}

const toggleSelectAll = (val) => { tableData.value.forEach(row => { row._selected = val }) }

watch(() => props.shopId, (val) => { if (val) fetchData() }, { immediate: true })
</script>

<style scoped>
.group-section { background: #fff; }
.sub-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.sub-tab { padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; color: #606266; background: #f5f7fa; }
.sub-tab:hover { color: #409eff; }
.sub-tab.active { background: #409eff; color: #fff; }
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.btn-create { background: #303133; border-color: #303133; }
.table-panel { overflow-x: auto; }
.cpc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.cpc-table th { background: #f5f7fa; border: 1px solid #ebeef5; padding: 10px 8px; text-align: left; font-weight: 600; color: #606266; }
.cpc-table td { border: 1px solid #ebeef5; padding: 10px 8px; vertical-align: middle; }
.cpc-table tbody tr:hover { background: #f5f7fa; }
.pagination-wrap { margin-top: 12px; display: flex; justify-content: flex-end; }

.add-dialog-body { display: flex; gap: 16px; height: 360px; }
.add-left { flex: 1; display: flex; flex-direction: column; gap: 12px; }
.add-right { flex: 1; border-left: 1px solid #ebeef5; padding-left: 16px; display: flex; flex-direction: column; }
.match-type-row { display: flex; align-items: center; gap: 12px; }
.match-type-row .label { font-size: 13px; color: #606266; font-weight: 600; }
.add-actions { display: flex; justify-content: flex-end; gap: 8px; }
.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; color: #303133; }
.preview-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.preview-table th { background: #f5f7fa; border: 1px solid #ebeef5; padding: 8px; text-align: left; font-weight: 600; }
.preview-table td { border: 1px solid #ebeef5; padding: 8px; }
.icon-delete { cursor: pointer; color: #f56c6c; font-size: 14px; }
.icon-delete:hover { color: #c62828; }
</style>
