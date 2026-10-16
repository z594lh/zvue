<template>
  <div class="negative-section">
    <div class="scope-note">
      <el-tag size="small" :type="scope === 'campaign' ? 'warning' : 'info'">{{ scopeLabel }}否定</el-tag>
      <span>{{ scope === 'campaign' ? '作用于本活动下所有广告组；不混入各组单独设置的规则。' : '仅作用于当前广告组；活动级规则请到广告活动的否定投放查看。' }}</span>
    </div>
    <div class="sub-tabs">
      <el-button :type="activeTab === 'keywords' ? 'primary' : ''" :disabled="busy" @click="activeTab = 'keywords'">否定关键词</el-button>
      <el-button :type="activeTab === 'targets' ? 'primary' : ''" :disabled="busy" @click="activeTab = 'targets'">否定商品</el-button>
    </div>
    <el-alert v-if="unsupportedTargets" title="Amazon 活动级否定商品仅支持自动投放活动；手动投放请进入广告组设置。" type="info" :closable="false" show-icon />
    <div class="toolbar">
      <el-button type="primary" :disabled="!ready || busy || unsupportedTargets" @click="openAdd">添加{{ kindLabel }}</el-button>
      <el-input v-model="filter.search" :placeholder="`查找${kindLabel}`" clearable style="width:220px" :disabled="busy" @keyup.enter="search" @clear="search" />
      <el-select v-model="filter.state" style="width:120px" :disabled="busy" @change="search">
        <el-option label="未归档" value="unarchived" /><el-option label="已启用" value="ENABLED" />
        <el-option label="已暂停" value="PAUSED" /><el-option label="已归档" value="ARCHIVED" />
      </el-select>
      <el-dropdown :disabled="!selectedRows.length || busy" @command="batchUpdate">
        <el-button :disabled="!selectedRows.length || busy">批量操作 ▾</el-button>
        <template #dropdown><el-dropdown-menu>
          <el-dropdown-item command="ENABLED">批量启用</el-dropdown-item>
          <el-dropdown-item command="PAUSED">批量暂停</el-dropdown-item>
          <el-dropdown-item command="ARCHIVED" divided>批量归档</el-dropdown-item>
        </el-dropdown-menu></template>
      </el-dropdown>
      <el-button :loading="refreshing" :disabled="!ready || busy" @click="refreshCurrent">同步当前层级</el-button>
    </div>
    <div class="data-note">以下为已同步记录。同步仅拉取数据，不更改广告；归档会在 Amazon 生效，且不能恢复原规则。</div>
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon />
    <el-table :data="tableData" v-loading="loading" row-key="entity_key" border stripe @selection-change="selectedRows = $event">
      <el-table-column type="selection" width="40" :selectable="row => row.state !== 'ARCHIVED' && !busy" />
      <el-table-column :label="activeTab === 'keywords' ? '关键词' : 'ASIN / 品牌 ID'" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">{{ row.keyword_text || row.target_value || row.resolved_expression }}</template>
      </el-table-column>
      <el-table-column label="匹配类型" width="125">
        <template #default="{ row }">{{ matchLabel(row.match_type || row.expression_type) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }"><el-tag size="small" :type="row.state === 'ENABLED' ? 'success' : 'info'">{{ stateLabel(row.state) }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button v-if="row.state !== 'ARCHIVED'" link type="primary" :disabled="busy" @click="changeOne(row, row.state === 'ENABLED' ? 'PAUSED' : 'ENABLED')">{{ row.state === 'ENABLED' ? '暂停' : '启用' }}</el-button>
          <el-button v-if="row.state !== 'ARCHIVED'" link type="danger" :disabled="busy" @click="changeOne(row, 'ARCHIVED')">归档</el-button>
          <span v-else class="data-note">不可恢复</span>
        </template>
      </el-table-column>
    </el-table>
    <div class="pagination-wrap"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20,50,100]" :disabled="busy" layout="total, sizes, prev, pager, next" @change="fetchData" /></div>

    <el-dialog v-model="addVisible" :title="`${scopeLabel} · 添加${kindLabel}`" width="min(680px, 94vw)" destroy-on-close :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving">
      <template v-if="activeTab === 'keywords'">
        <el-radio-group v-model="matchType" :disabled="saving">
          <el-radio value="NEGATIVE_EXACT" label="NEGATIVE_EXACT">否定精准</el-radio>
          <el-radio value="NEGATIVE_PHRASE" label="NEGATIVE_PHRASE">否定词组</el-radio>
        </el-radio-group>
        <p class="data-note">每行一个关键词；精准最多 10 个单词，词组最多 4 个单词，每条最多 80 字符。请填写站点使用的语言。</p>
      </template>
      <template v-else>
        <el-radio-group v-model="targetType" :disabled="saving">
          <el-radio value="ASIN_SAME_AS" label="ASIN_SAME_AS">ASIN</el-radio>
          <el-radio value="ASIN_BRAND_SAME_AS" label="ASIN_BRAND_SAME_AS">品牌 ID</el-radio>
        </el-radio-group>
        <p class="data-note">{{ targetType === 'ASIN_SAME_AS' ? '每行一个 10 位 ASIN，例如 B0HJCWFGXC。' : '每行一个 Amazon 数字品牌 ID，不能填品牌名称。否定品牌会排除该品牌下商品，请谨慎确认。' }}</p>
      </template>
      <el-input v-model="inputText" type="textarea" :rows="9" :disabled="saving" placeholder="每行一项，最多 100 项；本批次重复项会自动去重" />
      <el-alert v-if="submitError" :title="submitError" type="error" :closable="false" show-icon class="submit-note" />
      <div v-for="(item, index) in itemErrors" :key="index" class="item-error">{{ item }}</div>
      <template #footer>
        <el-button :disabled="saving" @click="addVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCpcNegativeKeywords, createCpcNegativeKeyword, updateCpcNegativeKeyword, getCpcNegativeTargets, createCpcNegativeTarget, updateCpcNegativeTarget, refreshCpcNegatives } from '@/services/cpc'
import { negativeContext, negativePayload, negativeResponse, negativeError } from '@/utils/cpcNegatives'
import { useCpcEntityRefresh } from '@/composables/useCpcEntityRefresh'

const props = defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true },
  adGroupId: { type: [Number, String], default: null },
  scope: { type: String, default: 'group' },
  targetingType: { type: String, default: '' }
})
const activeTab = ref('keywords')
const scopeLabel = computed(() => props.scope === 'campaign' ? '广告活动级' : '广告组级')
const kindLabel = computed(() => activeTab.value === 'keywords' ? '否定关键词' : '否定商品')
const unsupportedTargets = computed(() => props.scope === 'campaign' && activeTab.value === 'targets' && props.targetingType !== 'AUTO')
const ready = computed(() => !!props.shopId && !!props.campaignId && (props.scope === 'campaign' || !!props.adGroupId))
const identity = computed(() => JSON.stringify(negativeContext(props)) + activeTab.value)
const loading = ref(false), saving = ref(false), refreshing = ref(false), updating = ref(false)
const busy = computed(() => saving.value || refreshing.value || updating.value)
const tableData = ref([]), selectedRows = ref([]), total = ref(0), page = ref(1), pageSize = ref(20)
const filter = reactive({ search: '', state: 'unarchived' })
const loadError = ref(''), submitError = ref(''), itemErrors = ref([])
const addVisible = ref(false), inputText = ref(''), matchType = ref('NEGATIVE_EXACT'), targetType = ref('ASIN_SAME_AS')
let generation = 0, disposed = false

const matchLabel = value => ({ NEGATIVE_EXACT: '否定精准', NEGATIVE_PHRASE: '否定词组', ASIN_SAME_AS: 'ASIN', ASIN_BRAND_SAME_AS: '品牌' }[value] || value || '—')
const stateLabel = value => ({ ENABLED: '已启用', PAUSED: '已暂停', ARCHIVED: '已归档' }[value] || value || '—')

async function fetchData() {
  const version = ++generation
  selectedRows.value = []
  if (!ready.value) { tableData.value = []; total.value = 0; loading.value = false; return }
  loading.value = true
  loadError.value = ''
  try {
    const api = activeTab.value === 'keywords' ? getCpcNegativeKeywords : getCpcNegativeTargets
    const data = negativeResponse(await api({ ...negativeContext(props), ...filter, page: page.value, page_size: pageSize.value }))
    if (version !== generation || disposed) return
    tableData.value = (data.list || []).map(row => ({ ...row, entity_key: row.keyword_id || row.target_id }))
    total.value = data.total || 0
    if (!tableData.value.length && page.value > 1 && total.value) {
      page.value = Math.max(1, Math.ceil(total.value / pageSize.value))
      return fetchData()
    }
    return true
  } catch (error) {
    if (version !== generation || disposed) return
    tableData.value = []; total.value = 0; loadError.value = negativeError(error)
    return false
  } finally { if (version === generation) loading.value = false }
}
function search() { page.value = 1; fetchData() }
function openAdd() {
  inputText.value = ''; submitError.value = ''; itemErrors.value = []
  matchType.value = 'NEGATIVE_EXACT'; targetType.value = 'ASIN_SAME_AS'; addVisible.value = true
}
async function refreshCurrent() {
  if (busy.value || !ready.value) return
  const current = identity.value
  refreshing.value = true
  try {
    const data = negativeResponse(await refreshCpcNegatives(activeTab.value, negativeContext(props)))
    if (current !== identity.value || disposed) return
    ElMessage.success(`已同步${scopeLabel.value} ${data.synced} 条记录`)
    await fetchData()
  } catch (error) { if (current === identity.value && !disposed) ElMessage.error(negativeError(error)) }
  finally { refreshing.value = false }
}
async function save() {
  if (busy.value || !ready.value || unsupportedTargets.value) return
  const current = identity.value, ctx = negativeContext(props), kind = activeTab.value
  let lines = inputText.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  if (kind === 'targets' && targetType.value === 'ASIN_SAME_AS') lines = lines.map(s => s.toUpperCase())
  lines = [...new Map(lines.map(s => [s.toLowerCase(), s])).values()]
  if (!lines.length || lines.length > 100) { ElMessage.warning('请输入 1～100 项'); return }
  if (kind === 'targets' && lines.some(s => targetType.value === 'ASIN_SAME_AS' ? !/^[A-Z0-9]{10}$/.test(s) : !/^[1-9]\d*$/.test(s))) {
    ElMessage.warning(targetType.value === 'ASIN_SAME_AS' ? 'ASIN 必须为 10 位字母或数字' : '请输入真实的数字品牌 ID，而不是名称'); return
  }
  saving.value = true; submitError.value = ''; itemErrors.value = []
  try {
    const items = lines.map(text => negativePayload(ctx, kind === 'keywords' ? { keywordText: text, matchType: matchType.value } : { expression: [{ type: targetType.value, value: text }] }))
    const api = kind === 'keywords' ? createCpcNegativeKeyword : createCpcNegativeTarget
    const data = negativeResponse(await api({ ...ctx, [kind]: items }))
    if (current !== identity.value || disposed) return
    if (data.error_count) {
      submitError.value = `成功 ${data.success_count} 项，失败 ${data.error_count} 项。已移除成功项，仅保留失败项。`
      itemErrors.value = data.errors.map(e => `${lines[e.index] || '未知项'}：${e.message}`)
      inputText.value = data.errors.map(e => lines[e.index]).filter(Boolean).join('\n')
    } else {
      ElMessage.success(`成功添加 ${data.success_count} 项`); addVisible.value = false
    }
    if (data.audit_warning) ElMessage.warning(data.audit_warning)
    await fetchData()
  } catch (error) {
    if (current === identity.value && !disposed) {
      submitError.value = negativeError(error)
      const errors = error?.response?.data?.data?.errors || []
      itemErrors.value = errors.map(e => `${lines[e.index] || '未知项'}：${e.message}`)
    }
  } finally { saving.value = false }
}
async function performUpdate(rows, state) {
  if (busy.value || !ready.value) return
  const current = identity.value, ctx = negativeContext(props), kind = activeTab.value
  const label = { ENABLED: '启用', PAUSED: '暂停', ARCHIVED: '归档' }[state]
  updating.value = true
  try {
    await ElMessageBox.confirm(`确认${label} ${rows.length} 条${scopeLabel.value}规则？${state === 'ARCHIVED' ? '将同步归档 Amazon 规则，无法恢复。' : '此操作将在 Amazon 生效。'}`, '确认操作', { type: 'warning' })
    if (current !== identity.value || disposed) return
    const api = kind === 'keywords' ? updateCpcNegativeKeyword : updateCpcNegativeTarget
    let ok = 0
    const errors = []
    // 单项确认结果，不在失败后显示“全部成功”；不自动重试写请求。
    for (const row of rows) {
      if (current !== identity.value || disposed) break
      try {
        const data = negativeResponse(await api(row.entity_key, { ...ctx, state }))
        ok++
        if (data.audit_warning) errors.push(data.audit_warning)
      } catch (error) { errors.push(`${row.keyword_text || row.target_value || row.entity_key}：${negativeError(error)}`) }
    }
    if (current !== identity.value || disposed) return
    let errorText = ''
    if (errors.length) { errorText = `${label}成功 ${ok} 项；${errors.join('；')}`; ElMessage.warning('部分操作未成功，请查看提示') }
    else ElMessage.success(`${label}成功 ${ok} 项`)
    await fetchData()
    if (errors.length) loadError.value = errorText
  } catch (error) {
    if (!['cancel', 'close'].includes(error) && current === identity.value && !disposed) ElMessage.error(negativeError(error))
  } finally { updating.value = false }
}
const changeOne = (row, state) => performUpdate([row], state)
const batchUpdate = state => performUpdate([...selectedRows.value], state)

watch(identity, () => {
  ++generation; page.value = 1; tableData.value = []; total.value = 0; selectedRows.value = []
  addVisible.value = false; inputText.value = ''; loadError.value = ''; submitError.value = ''; itemErrors.value = []
  fetchData()
}, { immediate: true })
onBeforeUnmount(() => { disposed = true; ++generation })
useCpcEntityRefresh(() => busy.value ? false : fetchData())
</script>

<style scoped>
.negative-section { background: #fff; }
.scope-note { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; color: #606266; font-size: 12px; }
.sub-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.sub-tabs .el-button + .el-button { margin-left: 0; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 14px 0 8px; }
.toolbar .el-button + .el-button { margin-left: 0; }
.data-note { color: #909399; font-size: 12px; line-height: 1.7; margin-bottom: 10px; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 14px; overflow-x: auto; }
.submit-note { margin-top: 12px; }
.item-error { margin-top: 8px; font-size: 12px; color: #c45656; overflow-wrap: anywhere; }
</style>
