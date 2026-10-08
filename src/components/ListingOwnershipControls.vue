<template>
  <el-alert v-if="initializationError" :title="initializationError" type="error" :closable="false" />
  <div v-if="ready" class="ownership-controls">
    <el-select v-model="filter" style="width:180px" @change="changeFilter">
      <el-option label="全部负责人" value="all" />
      <el-option label="我负责的" value="mine" />
      <el-option v-if="showUnassignedFilter" label="尚未分配" value="unassigned" />
      <el-option v-for="user in owners" :key="user.id" :label="user.nickname || user.username" :value="String(user.id)" />
    </el-select>
    <el-button v-if="canAssign" type="primary" :icon="UserFilled" :disabled="!selection.length" @click="openAssignment()">
      分配选中 Listing（{{ selection.length }}）
    </el-button>

    <el-dialog v-model="visible" title="分配 Listing 负责人" width="min(820px, 94vw)" class="ownership-dialog" destroy-on-close :close-on-click-modal="!busy" :close-on-press-escape="!busy" :show-close="!busy">
      <el-alert title="交接从站点指定日期零点生效；此前订单仍归原负责人。父体将展开为当前子 SKU。" type="info" :closable="false" />
      <el-form label-width="100px" style="margin-top:20px" :disabled="busy">
        <el-form-item label="操作">
          <el-radio-group v-model="action">
            <el-radio value="assign">分配 / 交接 / 解除</el-radio>
            <el-radio value="cancel">取消未来交接</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="action === 'assign'">
          <el-form-item label="负责人">
            <el-select v-model="ownerId" placeholder="请选择负责人">
              <el-option label="解除分配（未分配）" :value="0" />
              <el-option v-for="user in owners" :key="user.id" :label="user.nickname || user.username" :value="user.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="生效日期">
            <el-date-picker v-model="effectiveDate" value-format="YYYY-MM-DD" type="date" placeholder="默认站点第二天" />
          </el-form-item>
        </template>
        <el-form-item label="变更理由">
          <el-input v-model="reason" maxlength="500" show-word-limit placeholder="选填" />
        </el-form-item>
      </el-form>
      <el-alert v-if="error" :title="error" type="error" :closable="false" style="margin-bottom:12px" />
      <div class="preview-heading"><span><el-icon><List /></el-icon> 影响范围</span><el-tag size="small" effect="plain">{{ preview?.items?.length || 0 }} 个子 SKU</el-tag></div>
      <div v-if="previewLoading" style="margin:12px 0">正在加载影响范围…</div>
      <el-table v-if="preview" :data="preview.items" max-height="280">
        <el-table-column prop="seller_sku" label="实际变更子 SKU" min-width="180" />
        <el-table-column label="原负责人" width="120"><template #default="{row}">{{ row.current?.owner_name || '未分配' }}</template></el-table-column>
        <el-table-column prop="timezone" label="业务时区" min-width="160" />
        <el-table-column prop="effective_from_utc" label="生效时间（UTC）" min-width="195" />
      </el-table>
      <template #footer>
        <el-button @click="visible=false" :disabled="busy">关闭</el-button>
        <el-button :icon="Refresh" @click="makePreview" :loading="previewLoading" :disabled="busy || (action==='assign' && !effectiveDate)">刷新范围</el-button>
        <el-button type="primary" :icon="Check" @click="submit" :loading="busy" :disabled="!preview || previewLoading || (action==='assign' && ownerId===null)">确认变更</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyVisible" :title="`负责历史 · ${historySku}`" width="min(680px, 94vw)" class="ownership-dialog">
      <div v-loading="historyBusy" class="history-content">
        <el-empty v-if="!historyBusy && !historyRows.length" description="还没有负责记录" :image-size="70" />
        <el-timeline>
          <el-timeline-item v-for="row in historyRows" :key="row.id" :timestamp="formatTime(row.effective_from_utc) + ' UTC'" placement="top" :type="row.voided_at ? 'info' : 'primary'" hollow>
            <div class="history-card"><div class="history-card-title"><el-icon><UserFilled /></el-icon><strong>{{ row.owner_name || '未分配' }}</strong><el-tag size="small" :type="row.voided_at ? 'info' : 'success'">{{ row.voided_at ? '已取消' : '有效区间' }}</el-tag></div>
              <p>结束：{{ row.effective_to_utc ? formatTime(row.effective_to_utc) + ' UTC' : '持续负责 / 待生效' }}</p><p v-if="row.reason">{{ row.reason }}</p></div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-dialog>

    <el-dialog v-model="operationsVisible" :title="`操作历史 · ${operationsRow?.sku || ''}`" width="min(740px, 94vw)" class="ownership-dialog">
      <div v-loading="operationsBusy" class="history-content">
        <el-empty v-if="!operationsBusy && !operationsRows.length" description="还没有变更操作" :image-size="70" />
        <el-timeline><el-timeline-item v-for="row in operationsRows" :key="row.id" :timestamp="formatTime(row.created_at) + ' UTC'" placement="top" type="primary" hollow>
          <div class="history-card"><div class="history-card-title"><el-icon><User /></el-icon><strong>{{ row.actor_name || `用户 ${row.actor_user_id}` }}</strong><el-tag size="small" effect="plain">{{ row.action==='cancel' ? '取消交接' : '分配变更' }}</el-tag></div>
            <div class="history-change"><span>{{ row.previous_owner_name || '未分配' }}</span><el-icon><Right /></el-icon><strong>{{ row.target_owner_name || '未分配' }}</strong></div>
            <p v-if="row.action==='cancel'">取消原计划：{{ row.cancelled_owner_name || '解除分配' }}</p>
            <p>交接时间：{{ formatTime(row.effective_from_utc) }} UTC</p><p v-if="row.reason">{{ row.reason }}</p></div>
        </el-timeline-item></el-timeline>
      </div>
      <el-pagination v-model:current-page="operationsPage" :page-size="20" :total="operationsTotal" layout="total, prev, pager, next" @current-change="loadOperations" />
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { UserFilled, User, List, Refresh, Check, Right } from '@element-plus/icons-vue'
import { getUserPermissions, getListingPerformanceConfig, getListingOwners, previewListingAssignments,
  applyListingAssignments, cancelListingAssignments, getListingAssignmentHistory, getListingOperationHistory } from '@/services/api.js'

const props = defineProps({ selection: { type: Array, default: () => [] }, shopId: { type: Number, default: null }, showUnassignedFilter:{type:Boolean,default:true} })
const emit = defineEmits(['ready', 'filter', 'changed'])
const permissions = getUserPermissions()
const canAssign = permissions.includes('amazon_listings:assign')
const initializationError = ref('')
const ready = ref(false), owners = ref([]), filter = ref('all')
const markets = ref({}), previewLoading = ref(false)
const visible = ref(false), busy = ref(false), action = ref('assign'), ownerId = ref(null)
const effectiveDate = ref(''), reason = ref(''), preview = ref(null), error = ref('')
const historyVisible = ref(false), historyBusy = ref(false), historyRows = ref([]), historySku = ref('')
const frozenItems = ref([])
const operationsVisible = ref(false), operationsBusy = ref(false), operationsRows = ref([])
const operationsRow = ref(null), operationsPage = ref(1), operationsTotal = ref(0)
let requestId = ''
let previewVersion = 0, previewTimer = null, historyVersion = 0, operationsVersion = 0
const key = computed(() => `${props.shopId}:${props.selection.map(r => `${r.marketplace_id}:${r.sku}`).join('|')}`)
const invalidate = () => {
  ++previewVersion; clearTimeout(previewTimer); previewTimer = null
  preview.value = null; requestId = ''; previewLoading.value = false
}
watch(key, () => { invalidate(); visible.value = false })
watch(visible, value => { if (!value) invalidate() })
watch([ownerId,effectiveDate,reason,action], () => {
  if (!visible.value || busy.value) return
  invalidate()
  previewTimer = setTimeout(() => makePreview(),250)
}, { flush:'sync' })
onUnmounted(() => { invalidate(); ++historyVersion; ++operationsVersion })
const message = error => error.response?.data?.message || error.message || '操作失败'
const formatTime = value => value ? String(value).replace('T',' ').replace(/\.\d+Z?$/,'').replace(/Z$/,'') : '—'
const changeFilter = () => {
  emit('filter', filter.value==='mine' ? { only_mine:'1' } : filter.value==='unassigned' ? { unassigned:'1' } : filter.value==='all' ? {} : { owner_user_id:filter.value })
}
const openAssignment = (selected = props.selection) => {
  visible.value = false
  if (!ready.value || !selected.length) return
  frozenItems.value = selected.map(r => ({ shop_id:r.shop_id, marketplace_id:r.marketplace_id, seller_sku:r.sku }))
  ownerId.value = null; reason.value = ''; action.value = 'assign'
  try {
    const timezone = markets.value[frozenItems.value[0]?.marketplace_id]?.timezone
    if (!timezone) throw new Error('该站点尚未配置业务时区')
    effectiveDate.value = tomorrow(timezone)
  } catch (err) { ElMessage.error(message(err)); return }
  error.value = ''; invalidate(); visible.value = true
  makePreview()
}
const tomorrow = (timezone, now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
  const value = type => Number(parts.find(part => part.type===type).value)
  return new Date(Date.UTC(value('year'),value('month')-1,value('day')+1)).toISOString().slice(0,10)
}
const makePreview = async () => {
  invalidate()
  if (!visible.value || busy.value || (action.value==='assign' && !effectiveDate.value)) return
  const version = previewVersion
  previewLoading.value = true; error.value = ''
  try {
    const response = await previewListingAssignments({ action:action.value, items:frozenItems.value,
      owner_user_id:ownerId.value || null, effective_date:effectiveDate.value, reason:reason.value, expand_parents:true })
    if (version !== previewVersion || !visible.value) return
    preview.value = response.data.data
    requestId = window.crypto?.randomUUID?.() || `ownership-${Date.now()}-${Math.random().toString(36).slice(2)}`
  } catch (err) { if (version === previewVersion) error.value = message(err) }
  finally { if (version === previewVersion) previewLoading.value = false }
}
const submit = async () => {
  if (!preview.value || previewLoading.value || (action.value==='assign' && ownerId.value===null)) return
  busy.value = true; error.value = ''
  try {
    const method = action.value==='cancel' ? cancelListingAssignments : applyListingAssignments
    const response = await method({ preview_id:preview.value.preview_id, request_id:requestId })
    ElMessage.success(`已更新 ${response.data.data.affected} 条 Listing 的归属`)
    visible.value = false; invalidate(); emit('changed')
  } catch (err) {
    error.value = message(err)
    if ([400,403,409].includes(err.response?.status)) invalidate()
    // 网络失败保留请求ID和签名，重试仍保持幂等。
  } finally { busy.value = false }
}
const showHistory = async row => {
  const version = ++historyVersion
  historySku.value = row.sku; historyRows.value = []; historyVisible.value = true; historyBusy.value = true
  try {
    const response = await getListingAssignmentHistory({ shop_id:row.shop_id, marketplace_id:row.marketplace_id, seller_sku:row.sku })
    if (version === historyVersion) historyRows.value = response.data.data
  } catch (err) { if (version === historyVersion) ElMessage.error(message(err)) }
  finally { if (version === historyVersion) historyBusy.value = false }
}
const loadOperations = async () => {
  const row = operationsRow.value
  if (!row) return
  const version = ++operationsVersion
  operationsBusy.value = true; operationsRows.value = []
  try {
    const response = await getListingOperationHistory({ shop_id:row.shop_id, marketplace_id:row.marketplace_id,
      seller_sku:row.sku, page:operationsPage.value, page_size:20 })
    if (version !== operationsVersion) return
    operationsRows.value = response.data.data.list; operationsTotal.value = response.data.data.total
  } catch (err) { if (version === operationsVersion) ElMessage.error(message(err)) }
  finally { if (version === operationsVersion) operationsBusy.value = false }
}
const showOperations = row => {
  operationsRow.value = row; operationsPage.value = 1; operationsTotal.value = 0
  operationsVisible.value = true; loadOperations()
}
defineExpose({ openAssignment, showHistory, showOperations, resetFilter: () => { filter.value='all' } })
onMounted(async () => {
  try {
    markets.value = (await getListingPerformanceConfig()).data.data.markets
    ready.value = true; emit('ready',true)
    if (canAssign) owners.value = (await getListingOwners()).data.data
  } catch (err) {
    initializationError.value = message(err)
  }
})
</script>

<style scoped>
.ownership-controls { display:flex; align-items:center; flex-wrap:wrap; gap:12px; }
.preview-heading { display:flex; align-items:center; justify-content:space-between; margin:20px 0 12px; color:#5c6b80; font-size:13px; }
.preview-heading > span { display:flex; align-items:center; gap:8px; }
.history-content { min-height:120px; padding:8px 4px; }
.history-card { background:#f7f9fc; border:1px solid #eaf0f6; padding:16px 18px; border-radius:11px; }
.history-card-title { display:flex; gap:9px; align-items:center; color:#415670; }
.history-card-title .el-tag { margin-left:auto; }
.history-card p { margin-top:9px; color:#8b97a8; font-size:12px; line-height:1.6; }
.history-change { display:flex; gap:14px; align-items:center; margin-top:14px; color:#75859a; font-size:13px; }
</style>
