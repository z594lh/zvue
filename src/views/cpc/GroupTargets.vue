<template>
  <div class="group-section">
    <!-- 自动广告：自动投放设置 -->
    <template v-if="isAuto">
      <div class="toolbar">
        <el-button type="primary" class="btn-create" :disabled="!shopId" @click="openAutoTargetEdit">
          <el-icon><Edit /></el-icon> 调整自动投放
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
              <th>投放类型</th>
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
            <tr v-for="row in tableData" :key="row.target_id">
              <td><el-checkbox v-model="row._selected" /></td>
              <td>
                <div>{{ row.resolved_expression_label }}</div>
                <div v-if="row.serving_status" class="sub-text">{{ row.serving_status }}</div>
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
      </div>
    </template>

    <!-- 手动广告：关键词管理 -->
    <template v-else>
      <div class="toolbar">
        <el-button type="primary" class="btn-create" :disabled="!shopId" @click="openAddKeywordModal">
          <el-icon><Plus /></el-icon> 添加关键词
        </el-button>
        <el-input v-model="filter.search" placeholder="找到目标" clearable style="width:220px" @keyup.enter="fetchData">
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
              <th width="70">进行中</th>
              <th>关键词</th>
              <th width="90">投放匹配类型</th>
              <th width="80">状态</th>
              <th width="110">建议竞价</th>
              <th width="100">竞价</th>
              <th width="80">展示量</th>
              <th width="120">搜索结果首页首位展示份额</th>
              <th width="80">总成本</th>
              <th width="80">购买量</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableData" :key="row.keyword_id">
              <td><el-checkbox v-model="row._selected" /></td>
              <td align="center">
                <el-switch :model-value="row.state === 'ENABLED'" inline-prompt :disabled="row._loading" :loading="row._loading" @change="(val) => toggleState(row, val)" />
              </td>
              <td>
                <div class="keyword-cell">
                  <div class="keyword-text">{{ row.keyword_text }}</div>
                  <div v-if="row.keyword_text_cn" class="keyword-sub">{{ row.keyword_text_cn }}</div>
                </div>
              </td>
              <td align="center">{{ matchTypeLabel(row.match_type) }}</td>
              <td align="center">{{ stateLabel(row.state) }}</td>
              <td align="right">
                <div v-if="row.suggested_bid != null">${{ formatNum(row.suggested_bid) }}</div>
                <div v-else>--</div>
                <div v-if="row.suggested_bid_range" class="sub-text">${{ formatNum(row.suggested_bid_range.low) }}-${{ formatNum(row.suggested_bid_range.high) }}</div>
              </td>
              <td align="right">
                <span v-if="!row._editing" class="editable-cell" @click="startEditBid(row)">${{ formatNum(row.bid) }}</span>
                <el-input-number
                  v-else
                  v-model="row._editBid"
                  :disabled="row._saving"
                  :min="0.01" :step="0.01" :precision="2"
                  size="small" controls-position="right" style="width:90px"
                  @blur="saveBid(row)" @keyup.enter="saveBid(row)"
                />
              </td>
              <td align="right">{{ fmtInt(row.impressions) }}</td>
              <td align="right">{{ fmtPct(row.top_of_search_impression_share) }}</td>
              <td align="right">${{ formatNum(row.cost) }}</td>
              <td align="right">{{ fmtInt(row.purchases_7d) }}</td>
            </tr>
          </tbody>
        </table>
        <el-empty v-if="!loading && !tableData.length" description="无可用数据" />
        <div class="pagination-wrap">
          <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20,50,100]" layout="total, sizes, prev, pager, next, jumper" @change="fetchData" />
        </div>
      </div>
    </template>

    <!-- 手动广告：添加关键词弹窗 -->
    <el-dialog v-model="addKeywordVisible" title="添加关键词" width="900px" destroy-on-close @closed="resetAddKeyword">
      <div class="add-keyword-body">
        <!-- 左侧输入区 -->
        <div class="add-keyword-left">
          <el-tabs v-model="addActiveTab">
            <el-tab-pane label="优选广告商品" name="suggested">
              <div class="tab-placeholder">暂无推荐商品关键词</div>
            </el-tab-pane>
            <el-tab-pane label="输入列表" name="input">
              <div class="add-keyword-form">
                <div class="form-row">
                  <span class="label">竞价</span>
                  <el-select v-model="addForm.bidStrategy" style="width:140px">
                    <el-option label="建议竞价" value="suggested" />
                    <el-option label="自定义" value="custom" />
                  </el-select>
                  <el-input-number
                    v-if="addForm.bidStrategy === 'custom'"
                    v-model="addForm.customBid"
                    :min="0.01" :step="0.01" :precision="2"
                    controls-position="right"
                    style="width:120px;margin-left:8px"
                  />
                </div>
                <div class="form-row">
                  <span class="label">匹配类型</span>
                  <el-checkbox-group v-model="addForm.matchTypes">
                    <el-checkbox label="BROAD">广泛</el-checkbox>
                    <el-checkbox label="PHRASE">词组</el-checkbox>
                    <el-checkbox label="EXACT">精准</el-checkbox>
                  </el-checkbox-group>
                </div>
                <div class="form-row textarea-row">
                  <el-input
                    v-model="addForm.keywordsText"
                    type="textarea"
                    :rows="10"
                    placeholder="输入关键词，以换行符分隔。"
                    resize="none"
                  />
                </div>
                <div class="form-row actions-row">
                  <el-button @click="translateAndAdd">翻译为英语并添加</el-button>
                  <el-button type="primary" :disabled="!addForm.keywordsText.trim()" @click="addToPreview()">添加关键词</el-button>
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane label="上传文件" name="upload">
              <div class="upload-panel">
                <div class="upload-tip">
                  <p>支持 CSV (.csv) 或 Excel (.xlsx/.xls) 文件</p>
                  <p>列格式：A列 keywordText（关键词），B列 matchType（BROAD/PHRASE/EXACT），C列 bid（必填）</p>
                </div>
                <el-upload
                  ref="uploadRef"
                  v-model:file-list="uploadFileList"
                  action="#"
                  :auto-upload="false"
                  :limit="1"
                  :on-change="handleUploadChange"
                  :on-exceed="handleUploadExceed"
                  accept=".csv,.xlsx,.xls"
                  drag
                >
                  <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                  <div class="el-upload__text">
                    拖拽文件到此处或 <em>点击上传</em>
                  </div>
                  <template #tip>
                    <div class="el-upload__tip">只能上传 CSV/Excel 文件</div>
                  </template>
                </el-upload>
                <div class="upload-actions">
                  <el-button type="primary" :loading="uploading" :disabled="!uploadFileList.length" @click="submitUpload">
                    开始上传
                  </el-button>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- 右侧预览区 -->
        <div class="add-keyword-right">
          <div class="preview-header">
            <span>已添加 {{ previewList.length }} 个</span>
            <el-button link type="danger" :disabled="!previewList.length" @click="previewList = []">删除所有</el-button>
          </div>
          <div class="preview-table-wrap">
            <table class="cpc-table preview-table">
              <thead>
                <tr>
                  <th>关键词</th>
                  <th width="70">匹配类型</th>
                  <th width="80">建议竞价</th>
                  <th width="70">竞价</th>
                  <th width="40"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in previewList" :key="`${item.keywordText}_${item.matchType}_${idx}`">
                  <td>
                    <div>{{ item.keywordText }}</div>
                    <div v-if="item.keywordTextCn" class="sub-text">{{ item.keywordTextCn }}</div>
                  </td>
                  <td align="center">{{ matchTypeLabel(item.matchType) }}</td>
                  <td align="right">{{ item.suggestedBid != null ? '$' + formatNum(item.suggestedBid) : '--' }}</td>
                  <td align="right">{{ item.bid != null ? '$' + formatNum(item.bid) : '应用全部' }}</td>
                  <td align="center">
                    <el-button link type="danger" size="small" @click="removePreview(idx)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </td>
                </tr>
              </tbody>
            </table>
            <el-empty v-if="!previewList.length" description="暂无数据" :image-size="80" />
          </div>
        </div>
      </div>

      <div v-if="suggestedBidMissing" class="add-keyword-warning">
        <el-icon><Warning /></el-icon>
        <span>当前账号暂无法获取 Amazon 建议竞价，请切换到「自定义」竞价后填写具体金额。</span>
      </div>

      <div class="add-keyword-tip">
        <el-icon><InfoFilled /></el-icon>
        <span>某些关键词不符合投放条件，因此不会投放广告。</span>
        <el-button link type="primary">了解更多信息</el-button>
      </div>

      <template #footer>
        <el-button @click="addKeywordVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingKeywords" :disabled="!previewList.length" @click="saveKeywords">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, ArrowDown, Edit, Delete, InfoFilled, UploadFilled, Warning } from '@element-plus/icons-vue'
import {
  getCpcTargetsAuto,
  updateCpcTarget,
  getCpcKeywords,
  updateCpcKeyword,
  batchCreateCpcKeywords,
  uploadCpcKeywords,
  getCpcBidRecommendationsKeywords
} from '@/services/cpc'
import { exportToCSV } from '@/utils/export'

const props = defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true },
  adGroupId: { type: [Number, String], required: true },
  targetingType: { type: String, default: '' }
})

const isAuto = computed(() => props.targetingType === 'AUTO')

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

const matchTypeMap = {
  'BROAD': '广泛',
  'PHRASE': '词组',
  'EXACT': '精准'
}
const matchTypeLabel = (val) => matchTypeMap[(val || '').toUpperCase()] || val || '--'
const stateLabel = (val) => {
  const s = (val || '').toUpperCase()
  if (s === 'ENABLED') return '进行中'
  if (s === 'PAUSED') return '已暂停'
  if (s === 'ARCHIVED') return '已归档'
  return '--'
}

const selectedRows = computed(() => tableData.value.filter(row => row._selected))

const fetchData = async () => {
  if (!props.shopId || !props.campaignId || !props.adGroupId) return
  loading.value = true
  try {
    if (isAuto.value) {
      const res = await getCpcTargetsAuto({
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
        list = list.filter(item => autoExpressions.includes(item.resolved_expression))
          .map(item => ({ ...item, resolved_expression_label: expressionMap[item.resolved_expression] || item.resolved_expression }))
        tableData.value = list.map(item => ({ ...item, _editing: false, _editBid: item.bid, _selected: false, _loading: false, _saving: false, state: (item.state || '').toUpperCase() }))
        total.value = tableData.value.length
      }
    } else {
      const res = await getCpcKeywords({
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
        tableData.value = (res.data.data.list || []).map(item => ({
          ...item,
          _editing: false,
          _editBid: item.bid,
          _selected: false,
          _loading: false,
          _saving: false,
          state: (item.state || '').toUpperCase()
        }))
        total.value = res.data.data.total || 0
      }
    }
  } catch { ElMessage.error('请求失败') }
  finally { loading.value = false }
}

watch(() => props.targetingType, () => {
  page.value = 1
  filter.search = ''
  filter.state = ''
  filter.dateRange = []
  fetchData()
})

const toggleState = async (row, val) => {
  row._loading = true
  try {
    if (isAuto.value) {
      await updateCpcTarget(row.target_id, { shop_id: props.shopId, state: val ? 'enabled' : 'paused' })
    } else {
      await updateCpcKeyword(row.keyword_id, { shop_id: props.shopId, state: val ? 'enabled' : 'paused' })
    }
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
    if (isAuto.value) {
      await updateCpcTarget(row.target_id, { shop_id: props.shopId, bid: row._editBid })
    } else {
      await updateCpcKeyword(row.keyword_id, { shop_id: props.shopId, bid: row._editBid })
    }
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
      await ElMessageBox.confirm(`确定删除选中的 ${rows.length} 个${isAuto.value ? '投放' : '关键词'}吗？`, '确认', { type: 'warning' })
      if (isAuto.value) {
        await Promise.all(rows.map(row => updateCpcTarget(row.target_id, { shop_id: props.shopId, state: 'archived' })))
      } else {
        await Promise.all(rows.map(row => updateCpcKeyword(row.keyword_id, { shop_id: props.shopId, state: 'archived' })))
      }
      ElMessage.success('批量删除成功')
      fetchData()
      return
    }
    const state = cmd === 'enable' ? 'enabled' : 'paused'
    if (isAuto.value) {
      await Promise.all(rows.map(row => updateCpcTarget(row.target_id, { shop_id: props.shopId, state })))
    } else {
      await Promise.all(rows.map(row => updateCpcKeyword(row.keyword_id, { shop_id: props.shopId, state })))
    }
    rows.forEach(row => { row.state = cmd === 'enable' ? 'ENABLED' : 'PAUSED' })
    ElMessage.success('批量更新成功')
  } catch { /* noop */ }
  finally { batchLoading.value = false }
}

const toggleSelectAll = (val) => { tableData.value.forEach(row => { row._selected = val }) }

const handleExport = () => {
  if (isAuto.value) {
    const columns = [
      { key: 'target', label: '投放类型' },
      { key: 'state', label: '状态' },
      { key: 'bid', label: '竞价' },
      { key: 'impressions', label: '曝光' },
      { key: 'clicks', label: '点击' },
      { key: 'cost', label: '花费' },
      { key: 'cpc', label: 'CPC' },
      { key: 'ctr', label: 'CTR' }
    ]
    const ok = exportToCSV('自动投放列表', columns, tableData.value, (val, col, row) => {
      if (col.key === 'target') return row.resolved_expression_label || row.resolved_expression
      if (col.key === 'state') return row.state === 'ENABLED' ? '启用' : (row.state === 'PAUSED' ? '暂停' : '归档')
      if (col.key === 'ctr') return fmtPct(val)
      if (['cost', 'cpc', 'bid'].includes(col.key)) return formatNum(val)
      if (['impressions', 'clicks'].includes(col.key)) return fmtInt(val)
      return val
    })
    if (!ok) ElMessage.warning('暂无数据可导出')
  } else {
    const columns = [
      { key: 'keyword_text', label: '关键词' },
      { key: 'match_type', label: '投放匹配类型' },
      { key: 'state', label: '状态' },
      { key: 'bid', label: '竞价' },
      { key: 'impressions', label: '展示量' },
      { key: 'top_of_search_impression_share', label: '搜索结果首页首位展示份额' },
      { key: 'cost', label: '总成本' },
      { key: 'purchases_7d', label: '购买量' }
    ]
    const ok = exportToCSV('关键词列表', columns, tableData.value, (val, col) => {
      if (col.key === 'state') return stateLabel(val)
      if (col.key === 'match_type') return matchTypeLabel(val)
      if (['top_of_search_impression_share'].includes(col.key)) return fmtPct(val)
      if (['bid', 'cost'].includes(col.key)) return formatNum(val)
      if (['impressions', 'purchases_7d'].includes(col.key)) return fmtInt(val)
      return val
    })
    if (!ok) ElMessage.warning('暂无数据可导出')
  }
}

/* ===== 手动广告：添加关键词 ===== */
const addKeywordVisible = ref(false)
const addActiveTab = ref('input')
const addForm = reactive({
  bidStrategy: 'custom',
  customBid: 0.5,
  matchTypes: ['BROAD', 'PHRASE', 'EXACT'],
  keywordsText: ''
})
const previewList = ref([])
const savingKeywords = ref(false)

const openAddKeywordModal = () => {
  addActiveTab.value = 'input'
  addForm.bidStrategy = 'custom'
  addForm.customBid = 0.5
  addForm.matchTypes = ['BROAD', 'PHRASE', 'EXACT']
  addForm.keywordsText = ''
  previewList.value = []
  addKeywordVisible.value = true
}

const resetAddKeyword = () => {
  addForm.bidStrategy = 'custom'
  addForm.customBid = 0.5
  addForm.matchTypes = ['BROAD', 'PHRASE', 'EXACT']
  addForm.keywordsText = ''
  previewList.value = []
}

const resolveBid = () => {
  if (addForm.bidStrategy === 'custom') return Number(addForm.customBid)
  return null // 建议竞价由后端计算
}

const addToPreview = async (textList = null, translated = false) => {
  const lines = textList || addForm.keywordsText.split(/\n|\r/).map(s => s.trim()).filter(Boolean)
  if (!lines.length) { ElMessage.warning('请输入关键词'); return }
  if (!addForm.matchTypes.length) { ElMessage.warning('请选择至少一种匹配类型'); return }

  const existing = new Set(previewList.value.map(p => `${p.keywordText}_${p.matchType}`))
  const bid = resolveBid()
  let added = 0
  lines.forEach(text => {
    addForm.matchTypes.forEach(mt => {
      const key = `${text}_${mt}`
      if (!existing.has(key)) {
        previewList.value.push({
          keywordText: text,
          keywordTextCn: translated ? '' : undefined,
          matchType: mt,
          bid,
          suggestedBid: null
        })
        existing.add(key)
        added++
      }
    })
  })
  if (!textList) addForm.keywordsText = ''
  if (added) {
    ElMessage.success(`已添加 ${added} 个关键词`)
    if (addForm.bidStrategy === 'suggested') {
      await fetchBidRecommendations()
    }
  }
}

const translateAndAdd = async () => {
  const lines = addForm.keywordsText.split(/\n|\r/).map(s => s.trim()).filter(Boolean)
  if (!lines.length) { ElMessage.warning('请输入关键词'); return }
  // 前端暂无翻译服务，直接原样加入；后端可在此接口补充翻译
  addToPreview(lines, true)
}

const removePreview = (idx) => { previewList.value.splice(idx, 1) }

const extractSuggestedBid = (rec) => {
  if (rec == null) return null
  if (typeof rec.suggestedBid === 'number') return rec.suggestedBid
  if (rec.suggestedBid && typeof rec.suggestedBid.suggested === 'number') return rec.suggestedBid.suggested
  return null
}

const fetchBidRecommendations = async () => {
  if (!previewList.value.length) return
  try {
    const res = await getCpcBidRecommendationsKeywords({
      shop_id: props.shopId,
      campaign_id: props.campaignId,
      ad_group_id: props.adGroupId,
      keywords: previewList.value.map(item => ({
        keywordText: item.keywordText,
        matchType: item.matchType
      }))
    })
    if (res.data.status === 'success') {
      const recMap = new Map((res.data.data || []).map(r => [`${r.keywordText}_${r.matchType}`.toLowerCase(), r]))
      previewList.value.forEach(item => {
        const rec = recMap.get(`${item.keywordText}_${item.matchType}`.toLowerCase())
        const suggestedBid = extractSuggestedBid(rec)
        item.suggestedBid = suggestedBid
        if (addForm.bidStrategy === 'suggested' && suggestedBid != null) {
          item.bid = Number(suggestedBid)
        }
      })
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || '获取建议竞价失败'
    ElMessage.warning(msg)
  }
}

const saveKeywords = async () => {
  if (!previewList.value.length) return
  savingKeywords.value = true
  try {
    if (addForm.bidStrategy === 'suggested') {
      await fetchBidRecommendations()
      const missing = previewList.value.filter(item => item.bid == null)
      if (missing.length) {
        ElMessage.warning(`以下关键词无法获取建议竞价，请切换到自定义竞价后填写: ${missing.map(i => i.keywordText).join(', ')}`)
        savingKeywords.value = false
        return
      }
    }

    const payload = {
      shop_id: props.shopId,
      campaign_id: props.campaignId,
      ad_group_id: props.adGroupId,
      keywords: previewList.value.map(item => ({
        keywordText: item.keywordText,
        matchType: item.matchType,
        bid: item.bid
      }))
    }
    await batchCreateCpcKeywords(payload)
    ElMessage.success(`成功添加 ${payload.keywords.length} 个关键词`)
    addKeywordVisible.value = false
    fetchData()
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || '保存关键词失败'
    ElMessage.error(msg)
  } finally {
    savingKeywords.value = false
  }
}

/* ===== 手动广告：上传文件批量添加关键词 ===== */
const uploadRef = ref(null)
const uploadFileList = ref([])
const uploading = ref(false)

const handleUploadChange = (file, files) => {
  const isValidType = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.raw?.type) ||
    /\.(csv|xlsx|xls)$/i.test(file.name)
  if (!isValidType) {
    ElMessage.error('只能上传 CSV/Excel 文件')
    uploadFileList.value = files.filter(f => f.uid !== file.uid)
    return
  }
  uploadFileList.value = files.slice(-1)
}

const handleUploadExceed = () => {
  ElMessage.warning('每次只能上传一个文件')
}

const submitUpload = async () => {
  if (!uploadFileList.value.length || !props.shopId) return
  const file = uploadFileList.value[0].raw
  if (!file) return

  const formData = new FormData()
  formData.append('shop_id', props.shopId)
  formData.append('campaign_id', props.campaignId)
  formData.append('ad_group_id', props.adGroupId)
  formData.append('file', file)

  uploading.value = true
  try {
    await uploadCpcKeywords(formData)
    ElMessage.success('文件上传成功')
    addKeywordVisible.value = false
    uploadFileList.value = []
    fetchData()
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || '文件上传失败'
    ElMessage.error(msg)
  } finally {
    uploading.value = false
  }
}

/* ===== 自动广告：调整自动投放 ===== */
const openAutoTargetEdit = () => {
  ElMessage.info('自动投放调整功能请通过批量操作或编辑竞价完成')
}

const suggestedBidMissing = computed(() => {
  return addForm.bidStrategy === 'suggested' && previewList.value.length > 0 && previewList.value.some(item => item.bid == null)
})

watch(() => addForm.bidStrategy, async (val) => {
  if (val === 'suggested') {
    previewList.value.forEach(item => { item.bid = null; item.suggestedBid = null })
    await fetchBidRecommendations()
  } else {
    previewList.value.forEach(item => { item.bid = Number(addForm.customBid) })
  }
})

const formatNum = (val) => val != null && Number(val) !== 0 ? Number(val).toFixed(2) : '--'
const fmtInt = (val) => val != null && Number(val) !== 0 ? Number(val).toLocaleString() : '--'
const fmtPct = (val) => val != null && Number(val) !== 0 ? Number(val).toFixed(2) + '%' : '--'

watch(() => props.shopId, (val) => { if (val) fetchData() }, { immediate: true })
</script>

<style scoped>
.group-section { background: #fff; }
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

.keyword-cell { line-height: 1.4; }
.keyword-text { color: #303133; font-weight: 500; }
.keyword-sub { color: #909399; font-size: 11px; }

.add-keyword-body { display: flex; gap: 16px; min-height: 400px; }
.add-keyword-left { flex: 1; min-width: 0; }
.add-keyword-right { width: 420px; border-left: 1px solid #ebeef5; padding-left: 16px; display: flex; flex-direction: column; }

.add-keyword-form { padding: 8px 4px; }
.form-row { display: flex; align-items: center; margin-bottom: 12px; }
.form-row .label { width: 70px; flex-shrink: 0; font-size: 13px; color: #606266; }
.textarea-row { display: block; }
.actions-row { justify-content: flex-end; gap: 8px; }

.tab-placeholder { padding: 40px 20px; text-align: center; color: #909399; font-size: 13px; }

.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; color: #303133; }
.preview-table-wrap { flex: 1; overflow-y: auto; max-height: 380px; }
.preview-table { font-size: 12px; }
.preview-table th { padding: 6px 4px; }
.preview-table td { padding: 6px 4px; }

.add-keyword-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
}

.add-keyword-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 12px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 4px;
  font-size: 12px;
  color: #e6a23c;
}

.upload-panel { padding: 12px 4px; }
.upload-tip { margin-bottom: 16px; font-size: 12px; color: #606266; line-height: 1.6; }
.upload-tip p { margin: 0 0 4px 0; }
.upload-actions { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
