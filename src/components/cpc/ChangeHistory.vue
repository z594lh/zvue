<template>
  <div class="change-history">
    <div class="history-toolbar">
      <span class="filter-label">历史日期</span>
      <el-date-picker v-model="dates" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" :clearable="false" :disabled="loading" :disabled-date="disabledDate" :shortcuts="shortcuts" @change="search" />
      <el-select v-model="timeZone" aria-label="历史时区" :disabled="loading" @change="changeTimezone">
        <el-option v-for="item in historyTimezones" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="category" placeholder="全部历史类别" aria-label="历史类别" :disabled="loading" @change="search">
        <el-option label="全部历史类别" value="" />
        <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="changeType" placeholder="全部更改类型" aria-label="更改类型" :disabled="loading" @change="search">
        <el-option label="全部更改类型" value="" />
        <el-option v-for="item in filterOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-if="scope === 'campaign'" v-model="view" aria-label="历史范围" :disabled="loading" @change="changeView">
        <el-option label="活动历史（默认）" value="console" /><el-option label="含所有广告组（扩展）" value="all" />
      </el-select>
      <el-select v-model="source" aria-label="操作来源" placeholder="全部操作来源" clearable :disabled="loading" @change="search">
        <el-option label="ERP" value="ERP" /><el-option label="平台记录（来源未确认）" value="PLATFORM" />
      </el-select>
      <el-select v-model="syncStatus" aria-label="同步状态" placeholder="全部同步状态" clearable :disabled="loading" @change="search">
        <el-option label="待同步" value="pending" /><el-option label="已同步" value="synced" /><el-option label="同步失败" value="failed" />
      </el-select>
      <el-tooltip content="只读取已保存记录，历史由计划任务同步" placement="top">
        <el-button :icon="Refresh" :loading="loading" :disabled="!shopId" @click="search">重读本地</el-button>
      </el-tooltip>
    </div>
    <div class="history-note">
      {{ scope === 'group' ? '本广告组：组设置、投放方案、否定投放及广告。' : view === 'all' ? '扩展范围：本活动及所有广告组的历史，不等于后台活动历史条数。' : '本活动：活动设置及活动级否定投放，不混入广告组内历史。' }}只读本地，筛选与翻页不会请求Amazon。
    </div>
    <div class="history-note">历史日期独立于顶部报表日期，按所选时区筛选和展示；对照美国后台可选美国太平洋时间（自动处理夏令时）。请确保日期、时区及范围相同；金额按账户原币。</div>
    <div class="history-note">历史由计划任务同步；最近完整采集：{{ lastSuccess ? historyTime(lastSuccess, timeZone) : '尚未完成，请等待计划任务采集' }} · {{ stateLabel }}</div>
    <div class="history-note">“平台记录”不一定来自亚马逊后台，也可能来自其他工具或尚未关联的ERP操作；规则关联不是平台确认操作人。亚马逊暂未返回对应事件时仍为待同步，不会重新执行广告操作。</div>
    <el-alert v-if="syncError" :title="syncError" type="warning" :closable="false" show-icon />
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon />
    <el-table :data="rows" v-loading="loading" stripe border row-key="id" class="history-table" :empty-text="loadError ? '读取失败，请重试' : !shopId ? '请先选择店铺' : lastSuccess ? '本地在此筛选范围内无更改记录' : '尚未完成历史采集，不代表没有历史'">
      <el-table-column label="更改类型" min-width="350">
        <template #default="{ row }">
          <span class="history-title" :title="historyChange(row)">{{ historyChange(row) }}</span>
          <el-tooltip v-if="row.changeType === 'IN_BUDGET'" content="Amazon 自动记录预算耗尽或恢复可用，并非人工修改预算金额。" placement="top">
            <el-icon class="history-help"><QuestionFilled /></el-icon>
          </el-tooltip>
          <div v-if="historyDetail(row)" class="history-detail" :title="historyDetail(row)">{{ historyDetail(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="从" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ historyValue(row, 'previousValue', timeZone) }}</template>
      </el-table-column>
      <el-table-column label="到" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ historyValue(row, 'newValue', timeZone) }}</template>
      </el-table-column>
      <el-table-column :label="`日期和时间（${timezoneLabel}）`" width="240">
        <template #default="{ row }">{{ historyTime(row.timestamp, timeZone) }}</template>
      </el-table-column>
      <el-table-column label="操作来源" width="170">
        <template #default="{ row }">
          <el-tooltip :content="sourceTip(row)" placement="top">
            <span>{{ row.source === 'ERP' ? 'ERP' : '平台（来源未确认）' }}{{ row.match_method === 'rule_unique' ? ' · 规则关联' : '' }}</span>
          </el-tooltip>
          <div v-if="row.operator_name" class="history-detail">{{ row.operator_name }}</div>
          <el-tag v-if="row.audit_context?.source==='AI'" size="small" effect="plain">AI托管 · #{{ row.audit_context.run_id }}</el-tag>
          <div v-if="row.audit_context" class="history-detail">发起：{{ row.audit_context.initiated_by.name }}</div>
        </template>
      </el-table-column>
      <el-table-column label="同步状态" width="130">
        <template #default="{ row }">
          <el-tooltip :content="statusTip(row)" placement="top">
            <el-tag size="small" :type="row.sync_status === 'synced' ? 'success' : row.sync_status === 'failed' ? 'danger' : 'warning'">{{ ({ pending: '待同步', synced: '已同步', failed: '同步失败' })[row.sync_status] || row.sync_status }}</el-tag>
          </el-tooltip>
          <div v-if="row.write_status && row.write_status !== 'accepted'" class="history-detail">{{ ({ requesting:'写入结果待核实', unknown:'写入结果待核实', failed:'广告写入失败' })[row.write_status] }}</div>
        </template>
      </el-table-column>
    </el-table>
    <div class="history-footer">
      <span class="history-note">本地统一历史 · 平台补全保留ERP来源及原始证据 · 按时间从新到旧</span>
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[50,100,200]" :disabled="loading" layout="total, sizes, prev, pager, next" @change="fetchData()" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Refresh, QuestionFilled } from '@element-plus/icons-vue'
import { getCpcChangeHistory } from '@/services/cpc'
import { useCpcEntityRefresh } from '@/composables/useCpcEntityRefresh'
import { historyChange, historyDetail, historyValue, historyTime, historyDates, historyFilters, historyCategories, historyTimezones } from '@/utils/cpcHistory'

const props = defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true },
  adGroupId: { type: [Number, String], default: null },
  scope: { type: String, default: 'campaign' }
})
const dates = ref(historyDates()), changeType = ref('')
const timeZone = ref('Asia/Shanghai')
const timezoneLabel = computed(() => historyTimezones.find(item => item.value === timeZone.value)?.label || timeZone.value)
const source = ref(''), syncStatus = ref(''), view = ref('console'), category = ref('')
const rows = ref([]), loading = ref(false), loadError = ref('')
const page = ref(1), pageSize = ref(50), total = ref(0)
const lastSuccess = ref(null), syncState = ref('never'), syncError = ref('')
const stateLabel = computed(() => ({ never:'尚未采集', pending:'待补采', running:'采集中', success:'采集完成', partial:'部分完成，待续采', failed:'采集失败，原历史保留' })[syncState.value] || syncState.value)
const filterOptions = computed(() => historyFilters(props.scope))
const categoryOptions = computed(() => historyCategories(props.scope, view.value))
const shortcuts = [7, 30, 90].map(days => ({ text: `近${days}天`, value: () => historyDates(days, timeZone.value).map(day => new Date(`${day}T12:00:00`)) }))
let requestVersion = 0
onBeforeUnmount(() => { requestVersion++ })

function disabledDate(date) {
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  const [, last] = historyDates(90, timeZone.value)
  return day > last
}

async function fetchData() {
  const version = ++requestVersion
  rows.value = []; loadError.value = ''
  if (!props.shopId || !props.campaignId || (props.scope === 'group' && !props.adGroupId)) { total.value = 0; loading.value = false; return false }
  if (!Array.isArray(dates.value) || dates.value.length !== 2) { loadError.value = '请选择有效历史日期'; loading.value = false; return false }
  loading.value = true
  try {
    const response = await getCpcChangeHistory({
      shop_id: props.shopId, campaign_id: String(props.campaignId), scope: props.scope,
      ...(props.scope === 'group' ? { ad_group_id: String(props.adGroupId) } : {}),
      start_date: dates.value[0], end_date: dates.value[1], change_type: changeType.value,
      source: source.value, sync_status: syncStatus.value, view: view.value, category: category.value,
      timezone: timeZone.value,
      page: page.value, page_size: pageSize.value
    })
    if (version !== requestVersion) return false
    const data = response.data.data
    if (response.data.status !== 'success' || !Array.isArray(data?.list)) throw new Error('历史记录响应异常')
    rows.value = data.list; total.value = data.total
    lastSuccess.value = data.last_success_ms; syncState.value = data.sync_state; syncError.value = data.sync_error || ''
    return true
  } catch (error) {
    if (version === requestVersion) { total.value = 0; loadError.value = error.response?.data?.message || '读取 Amazon 更改历史失败，请稍后重试' }
    return false
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

function sourceTip(row) {
  if (row.source !== 'ERP') return 'Amazon返回的记录，接口不提供操作人或操作渠道；未与ERP唯一关联，不代表一定在后台操作。'
  return row.match_method === 'rule_unique'
    ? `ERP操作与平台事件按规则唯一关联，非平台确认归因；原始提交 ${historyTime(row.local_started_ms, timeZone.value)}（${timezoneLabel.value}），原始前值 ${JSON.stringify(row.local_before)}，提交值 ${JSON.stringify(row.local_after)}。`
    : 'ERP本地留痕，保留后端认证操作人；未获平台历史补全前，显示的是本地已观察前值和实际提交值。'
}
function statusTip(row) {
  return row.error_message || (row.sync_status === 'synced' ? '已保存平台历史证据；不表示平台确认了ERP操作人。' : '等待平台事件及后续合批采集。不是再次执行广告操作；未匹配可能因为延迟、无变化、信息不一致或关联歧义。')
}
function search() { page.value = 1; return fetchData() }
function changeTimezone() {
  const [, today] = historyDates(90, timeZone.value)
  if (dates.value?.[1] > today) dates.value = [dates.value[0] > today ? today : dates.value[0], today]
  return search()
}
function changeView() { category.value = ''; return search() }
watch(() => [props.shopId, props.campaignId, props.adGroupId, props.scope], () => {
  changeType.value = ''; category.value = ''; view.value = 'console'; page.value = 1; lastSuccess.value = null; syncState.value = 'never'; syncError.value = ''; fetchData()
}, { immediate: true })
// 公共栏同步成功后仅重读当前表，保留历史日期、筛选和分页。
useCpcEntityRefresh(fetchData)
</script>

<style scoped>
.change-history { background: #fff; min-width: 0; }
.history-toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.filter-label { color: #606266; font-size: 13px; }
.history-toolbar :deep(.el-date-editor) { flex: 0 1 290px; width: 290px; }
.history-toolbar :deep(.el-select) { width: 180px; }
.history-note { color: #8492a6; font-size: 12px; line-height: 1.8; }
.history-table { margin-top: 12px; font-variant-numeric: tabular-nums; }
.history-title { white-space: normal; overflow-wrap: anywhere; line-height: 1.6; }
.history-detail { font-size: 12px; color: #8492a6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.history-help { color: #8492a6; margin-left: 5px; vertical-align: middle; }
.history-footer { display: flex; gap: 12px; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-top: 16px; }
@media (max-width: 700px) { .history-footer { overflow-x: auto; } }
</style>
