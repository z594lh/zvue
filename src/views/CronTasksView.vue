<template>
  <div class="cron-page">
    <div class="cron-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">
            <el-icon size="24" class="title-icon"><Timer /></el-icon>
            计划任务
          </h1>
          <p class="page-desc">查看定时计划，安全触发任务并追踪执行记录 · 手动执行不改变原定时计划</p>
        </div>
      </div>

      <el-alert v-if="capabilities.message" :title="capabilities.message" :type="capabilities.supported ? 'warning' : 'info'" :closable="false" show-icon class="environment-note" />
      <div class="stats-row" v-if="stats.total > 0">
        <div class="stat-item">
          <div class="stat-num">{{ stats.total }}</div>
          <div class="stat-name">任务总数</div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <div class="stat-num" style="color: #f59e0b">{{ stats.upcoming }}</div>
          <div class="stat-name">未来 1 小时内执行</div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <div class="stat-num" style="color: #10b981">{{ stats.running }}</div>
          <div class="stat-name">正在执行</div>
        </div>
      </div>

      <div class="toolbar">
        <el-input
          v-model="keyword"
          placeholder="搜索任务名称或描述"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" :loading="loading" @click="handleSearch">
          <el-icon><Search /></el-icon>搜索
        </el-button>
        <el-button :loading="loading" @click="fetchTasks">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
        <span class="page-desc">执行中优先 · 下次执行由近到远</span>
      </div>

      <div class="main-card" v-loading="loading" element-loading-text="加载中...">
        <el-table
          v-if="tasks.length > 0"
          :data="tasks"
          style="width: 100%"
          :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: '13px' }"
          :cell-style="{ padding: '16px', fontSize: '13px' }"
          row-class-name="task-row"
        >
          <el-table-column label="任务名称" min-width="155">
            <template #default="{ row }">
              <el-tooltip :content="row.scope" placement="top"><span class="name-tag">{{ row.task_name }}</span></el-tooltip>
            </template>
          </el-table-column>

          <el-table-column label="当前状态" width="132" align="center">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">{{ row.status_label }}</el-tag>
              <div v-if="row.active_run?.duration_seconds != null" class="time-sub">已运行 {{ duration(row.active_run.duration_seconds) }}</div>
            </template>
          </el-table-column>

          <el-table-column label="执行周期" min-width="190">
            <template #default="{ row }">
              <div class="cron-box">
                <code class="cron-expr">{{ row.schedule }}</code>
                <div class="cron-detail">
                  <span v-for="(part, idx) in explainCron(row.schedule)" :key="idx" class="cron-part">
                    {{ part }}
                  </span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="下次执行" width="170">
            <template #default="{ row }">
              <div class="time-cell">
                <div class="time-main">{{ formatTime(row.next_run) }}</div>
                <div class="time-sub">{{ fromNow(row.next_run) }}</div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="最近触发 / 结果" width="180">
            <template #default="{ row }">
              <div v-if="row.last_result" class="time-cell">
                <div class="time-main">{{ formatTime(row.last_result.created_at) }}</div>
                <el-tooltip :content="row.last_result.summary"><el-tag :type="statusType(row.last_result.status)" size="small">{{ row.last_result.status_label }}</el-tag></el-tooltip>
              </div>
              <span v-else class="time-empty">—</span>
            </template>
          </el-table-column>

          <el-table-column label="描述" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="desc-text">{{ row.description }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="175" fixed="right">
            <template #default="{ row }">
              <div class="task-actions">
                <el-tooltip :content="row.disabled_reason || '按默认范围执行一次，不更改原定时计划'">
                  <span><el-button type="primary" plain size="small" :loading="executing === row.task_id" :disabled="!row.can_execute || !!executing" @click="handleExecute(row)">立即执行</el-button></span>
                </el-tooltip>
                <el-button size="small" :disabled="!row.task_id" @click="openHistory(row)">记录</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div v-else-if="!loading" class="empty-state">
          <el-empty :description="capabilities.supported === false ? '本地Windows不提供Linux计划任务' : '暂无计划任务'">
            <template #image>
              <el-icon size="64" class="empty-icon"><Timer /></el-icon>
            </template>
          </el-empty>
        </div>
      </div>

      <div v-if="pagination.total > 0" class="pagination-bar">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.per_page"
          :total="pagination.total"
          :page-sizes="[5, 10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @change="handlePageChange"
        />
      </div>

      <div class="mobile-cards" v-if="tasks.length > 0 && !loading">
        <div v-for="task in tasks" :key="task.task_name" class="m-card">
          <div class="m-header">
            <span class="m-name">{{ task.task_name }}</span>
            <el-tag :type="statusType(task.status)" size="small">{{ task.status_label }}</el-tag>
          </div>
          <div class="m-section">
            <div class="m-label">执行周期</div>
            <code class="m-cron-expr">{{ task.schedule }}</code>
            <div class="m-cron-desc">
              <span v-for="(part, idx) in explainCron(task.schedule)" :key="idx">{{ part }}</span>
            </div>
          </div>
          <div class="m-grid">
            <div class="m-grid-item">
              <div class="m-grid-label">下次执行</div>
              <div class="m-grid-value">{{ formatTime(task.next_run) }}</div>
              <div class="m-grid-sub">{{ fromNow(task.next_run) }}</div>
            </div>
            <div class="m-grid-item">
              <div class="m-grid-label">最近触发 / 结果</div>
              <div v-if="task.last_result" class="m-grid-value">{{ formatTime(task.last_result.created_at) }}</div>
              <div v-if="task.last_result" class="m-grid-sub">{{ task.last_result.status_label }}</div>
              <div v-else class="m-grid-value" style="color: #94a3b8">—</div>
            </div>
          </div>
          <div v-if="task.description" class="m-desc">{{ task.description }}</div>
          <div class="m-task-actions">
            <el-tooltip :content="task.disabled_reason || task.scope"><span><el-button size="small" type="primary" plain :disabled="!task.can_execute || !!executing" :loading="executing === task.task_id" @click="handleExecute(task)">立即执行</el-button></span></el-tooltip>
            <el-button size="small" :disabled="!task.task_id" @click="openHistory(task)">执行记录</el-button>
          </div>
        </div>
      </div>

      <div v-if="pagination.total > 0" class="mobile-pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.per_page"
          :total="pagination.total"
          :page-sizes="[5, 10, 20, 50]"
          layout="prev, pager, next"
          background
          small
          @change="handlePageChange"
        />
      </div>
      <p v-if="tasks.length" class="page-desc execution-help">时间按当前设备时区显示。执行结束不等于所有业务同步成功；点击记录核对日志。撞锁不重复启动，不自动重试。</p>
      <el-dialog v-model="historyVisible" :title="`${historyTask?.task_name || ''} · 执行记录`" width="min(960px, 94vw)" append-to-body>
        <p class="page-desc" style="margin-bottom:12px">已结束的执行记录及日志保留最近7天，系统自动清理；等待执行、执行中或状态待核实的记录不会清理。</p>
        <el-table v-loading="historyLoading" :data="records" @row-click="openDetail" class="history-table">
          <el-table-column prop="id" label="记录" width="75" />
          <el-table-column label="触发时间" width="172"><template #default="{ row }">{{ formatTime(row.created_at) }}</template></el-table-column>
          <el-table-column label="来源 / 操作人" min-width="135"><template #default="{ row }">{{ row.source === 'manual' ? (row.actor_name || '手动执行') : '定时执行' }}</template></el-table-column>
          <el-table-column label="结果" width="125"><template #default="{ row }"><el-tag size="small" :type="statusType(row.status)">{{ row.status_label }}</el-tag></template></el-table-column>
          <el-table-column label="耗时" width="90"><template #default="{ row }">{{ duration(row.duration_seconds) }}</template></el-table-column>
          <el-table-column prop="summary" label="摘要（点击查看日志）" min-width="200" show-overflow-tooltip />
        </el-table>
        <div class="pagination-bar"><el-pagination v-model:current-page="historyPage" :page-size="10" :total="historyTotal" layout="total, prev, pager, next" @current-change="loadHistory" /></div>
        <template #footer><el-button @click="loadHistory">刷新记录</el-button><el-button @click="historyVisible = false">关闭</el-button></template>
      </el-dialog>
      <el-dialog v-model="detailVisible" :title="`执行记录 #${detailRecord?.id || ''}`" width="min(900px, 94vw)" append-to-body>
        <div v-loading="detailLoading">
          <p>{{ detailRecord?.summary }}</p>
          <p class="page-desc">开始 {{ formatTime(detailRecord?.started_at) }} · 结束 {{ formatTime(detailRecord?.finished_at) }} · 耗时 {{ duration(detailRecord?.duration_seconds) }}</p>
          <pre class="run-log">{{ detailLog }}</pre>
        </div>
        <template #footer><el-button :disabled="!detailRecord || detailLoading" @click="openDetail(detailRecord)">刷新日志</el-button><el-button @click="detailVisible = false">关闭</el-button></template>
      </el-dialog>
    </div>
  </div>
</template>

<script>
export default { name: 'CronTasksView' }
</script>
<script setup>
import { ref, onMounted, onActivated, onDeactivated, onBeforeUnmount } from 'vue'
import { Timer, Refresh, Search } from '@element-plus/icons-vue'
import { getCronTasks, executeCronTask, getCronTaskRuns, getCronTaskRun } from '@/services/api.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const tasks = ref([])
const loading = ref(false)
const keyword = ref('')
const capabilities = ref({ supported: null, ready: false, message: '' })
const stats = ref({ total: 0, running: 0, upcoming: 0 })
const executing = ref('')
const historyVisible = ref(false)
const historyTask = ref(null)
const records = ref([])
const historyLoading = ref(false)
const historyPage = ref(1)
const historyTotal = ref(0)
const detailVisible = ref(false)
const detailRecord = ref(null)
const detailLog = ref('')
const detailLoading = ref(false)
const requestIds = new Map()
let active = false
let timer = null
let sequence = 0
let historySequence = 0
let detailSequence = 0
let confirming = false

const pagination = ref({
  page: 1,
  per_page: 10,
  total: 0,
  total_pages: 0
})

const statusType = status => ({ running: 'primary', pending: 'primary', external: 'primary', blocked: 'warning', idle: 'success', finished: 'warning', skipped: 'info', expired: 'info', failed: 'danger', interrupted: 'danger', unknown: 'danger', unmanaged: 'info' }[status] || 'info')
const formatTime = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
const duration = seconds => seconds == null ? '—' : seconds < 60 ? `${seconds}秒` : `${Math.floor(seconds / 60)}分${seconds % 60}秒`
const errorMessage = error => error?.response?.data?.message || '暂时无法连接服务器，请刷新核对状态，不会自动重试执行任务'

const fromNow = (ts) => {
  if (!ts) return ''
  const diff = new Date(ts).getTime() - Date.now()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '即将执行'
  if (min < 60) return min + ' 分钟后'
  const hr = Math.floor(min / 60)
  if (hr < 24) return hr + ' 小时后'
  const day = Math.floor(hr / 24)
  return day + ' 天后'
}

const explainCron = (schedule) => {
  const parts = schedule.trim().split(' ').filter(s => s)
  if (parts.length !== 5) return [schedule]
  const [mi, ho, dom, mo, dow] = parts

  const labels = []
  if (mi === '*') labels.push('每分钟')
  else if (mi.startsWith('*/')) labels.push('每 ' + mi.slice(2) + ' 分钟')
  else if (mi.indexOf(',') > -1) labels.push(mi + ' 分')
  else if (mi === '0') labels.push('整点')
  else labels.push(mi + ' 分')

  if (ho === '*') labels.push('每小时')
  else if (ho.startsWith('*/')) labels.push('每 ' + ho.slice(2) + ' 小时')
  else labels.push(ho + ' 点')

  if (dom === '*') labels.push('每日')
  else if (dom === '1') labels.push('每月 1 日')
  else labels.push('每月 ' + dom + ' 日')

  if (mo === '*') labels.push('每月')
  else labels.push(mo + ' 月')

  const dowMap = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' }
  if (dow === '*') labels.push('不限星期')
  else {
    const days = dow.split(',').map(d => dowMap[d] || d).filter(Boolean)
    labels.push(days.join('、'))
  }

  const sentence = humanize(schedule)
  return sentence ? [sentence] : labels
}

const humanize = (schedule) => {
  const map = {
    '0 * * * *': '每小时整点执行',
    '* * * * *': '每分钟执行',
    '*/5 * * * *': '每 5 分钟执行',
    '*/10 * * * *': '每 10 分钟执行',
    '*/15 * * * *': '每 15 分钟执行',
    '*/30 * * * *': '每 30 分钟执行',
    '0 0 * * *': '每天零点执行',
    '0 6 * * *': '每天上午 6:00 执行',
    '0 12 * * *': '每天中午 12:00 执行',
    '0 18 * * *': '每天晚上 18:00 执行',
    '0 0 * * 0': '每周日零点执行',
    '0 0 1 * *': '每月 1 日零点执行',
    '0,15,30,45 * * * *': '每 15 分钟执行',
    '0,30 * * * *': '每 30 分钟执行'
  }
  if (map[schedule]) return map[schedule]

  if (/^0 \d{1,2} \* \* \*$/.test(schedule)) {
    const h = schedule.split(' ')[1]
    return '每天 ' + h + ':00 执行'
  }
  if (schedule.startsWith('*/') && schedule.endsWith(' * * * *')) {
    const step = schedule.slice(2).split(' ')[0]
    return '每 ' + step + ' 分钟执行'
  }
  if (schedule.startsWith('0,')) {
    const mins = schedule.split(' ')[0]
    return '每 ' + mins.split(',').pop() + ' 分钟执行'
  }
  return null
}

const fetchTasks = async (quiet = false) => {
  quiet = quiet === true
  if (!active || (quiet && loading.value)) return
  const ticket = ++sequence
  if (!quiet) loading.value = true
  try {
    const res = await getCronTasks({
      keyword: keyword.value || undefined,
      page: pagination.value.page,
      per_page: pagination.value.per_page
    })
    if (!active || ticket !== sequence) return
    if (res.data?.success) {
      tasks.value = res.data.tasks || res.data.data || []
      capabilities.value = res.data.capabilities || { supported: true, message: '' }
      stats.value = res.data.stats || { total: 0, running: 0, upcoming: 0 }
      if (res.data.pagination) {
        pagination.value = { ...pagination.value, ...res.data.pagination }
      }
    } else {
      throw new Error(res.data?.message || '获取任务列表失败')
    }
  } catch (err) {
    if (active && ticket === sequence) {
      tasks.value = tasks.value.map(row => ({ ...row, can_execute: false, disabled_reason: '请刷新核对服务器状态' }))
      capabilities.value.message = errorMessage(err)
      if (!quiet) ElMessage.error(errorMessage(err))
    }
  } finally {
    if (ticket === sequence) loading.value = false
  }
}

const handleSearch = () => {
  pagination.value.page = 1
  fetchTasks()
}

const handlePageChange = () => {
  fetchTasks()
}

const loadHistory = async () => {
  if (!active || !historyVisible.value || !historyTask.value) return
  const ticket = ++historySequence
  historyLoading.value = true
  try {
    const { data } = await getCronTaskRuns(historyTask.value.task_id, { page: historyPage.value, per_page: 10 })
    if (!active || !historyVisible.value || ticket !== historySequence) return
    records.value = data.records || []
    historyTotal.value = data.pagination?.total || 0
  } catch (error) {
    if (active && historyVisible.value && ticket === historySequence) ElMessage.error(errorMessage(error))
  } finally {
    if (ticket === historySequence) historyLoading.value = false
  }
}
const openHistory = row => {
  historyTask.value = row
  records.value = []
  historyPage.value = 1
  historyTotal.value = 0
  historyVisible.value = true
  loadHistory()
}
const openDetail = async row => {
  if (!active) return
  const ticket = ++detailSequence
  detailRecord.value = row
  detailLog.value = ''
  detailVisible.value = true
  detailLoading.value = true
  try {
    const { data } = await getCronTaskRun(row.id)
    if (!active || !detailVisible.value || ticket !== detailSequence) return
    detailRecord.value = data.record
    detailLog.value = data.log
  } catch (error) {
    if (active && detailVisible.value && ticket === detailSequence) ElMessage.error(errorMessage(error))
  } finally {
    if (ticket === detailSequence) detailLoading.value = false
  }
}
const newRequestId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // HTTP内网可能没有randomUUID，仍使用安全随机数生成标准UUID，不使用Math.random。
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
const handleExecute = async row => {
  if (!active || !row.can_execute || executing.value) return
  executing.value = row.task_id
  confirming = true
  try {
    await ElMessageBox.confirm(`立即执行「${row.task_name}」？范围：${row.scope}。不改变原定时计划；同一任务正在运行时不会重复启动，不影响其他任务。`, '立即执行计划任务', { confirmButtonText: '确认执行', cancelButtonText: '取消', type: 'info' })
  } catch {
    executing.value = ''
    return
  } finally {
    confirming = false
  }
  if (!active) { executing.value = ''; return }
  try {
    // 响应丢失时保留编号，下次确认仍查询原请求，不生成第二份任务。
    if (!requestIds.has(row.task_id)) requestIds.set(row.task_id, newRequestId())
    const { data } = await executeCronTask(row.task_id, { request_id: requestIds.get(row.task_id), confirm: true })
    requestIds.delete(row.task_id)
    if (!active) return
    ElMessage.success(data.message || '请求已接收')
    await fetchTasks(true)
  } catch (error) {
    if (error?.response?.status >= 400 && error.response.status < 500) requestIds.delete(row.task_id)
    if (active) { ElMessage.error(errorMessage(error)); await fetchTasks(true) }
  } finally {
    executing.value = ''
  }
}
const start = () => {
  if (active) return
  active = true
  fetchTasks()
  timer = setInterval(() => {
    if (!document.hidden && capabilities.value.supported) fetchTasks(true)
  }, 5000)
}
const stop = () => {
  active = false
  sequence++; historySequence++; detailSequence++
  loading.value = historyLoading.value = detailLoading.value = false
  historyVisible.value = detailVisible.value = false
  if (confirming) ElMessageBox.close()
  clearInterval(timer)
  timer = null
}
onMounted(start)
onActivated(start)
onDeactivated(stop)
onBeforeUnmount(stop)
</script>

<style scoped>
.environment-note { margin-bottom: 16px; }
.task-actions { display: flex; align-items: center; gap: 8px; }
.task-actions .el-button { margin-left: 0; }
.m-task-actions { padding: 12px 16px; display: flex; gap: 10px; }
.execution-help { margin-top: 16px; line-height: 1.7; }
.history-table { cursor: pointer; }
.run-log { max-height: 52vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: #f5f7fa; color: #334155; padding: 14px; border-radius: 8px; font-size: 12px; line-height: 1.7; }
.cron-page {
  min-height: 100vh;
  background: #f8fafc;
  color: #334155;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.cron-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px 24px 60px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon { color: #3b82f6; }
.page-desc { font-size: 13px; color: #94a3b8; margin: 0; }

.stats-row {
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px 28px;
  margin-bottom: 20px;
}

.stat-item { flex: 1; text-align: center; }
.stat-num { font-size: 24px; font-weight: 800; color: #1e293b; line-height: 1; margin-bottom: 4px; }
.stat-name { font-size: 12px; color: #94a3b8; }
.stat-divider { width: 1px; height: 30px; background: #e2e8f0; }

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.main-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

:deep(.el-table) {
  --el-table-row-hover-bg-color: #f8fafc;
  --el-table-border-color: #f1f5f9;
}

.name-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
  font-size: 13px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #f0fdf4;
  border-radius: 20px;
  font-size: 12px;
  color: #16a34a;
  font-weight: 600;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
}

.cron-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cron-expr {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  background: #f1f5f9;
  padding: 3px 10px;
  border-radius: 6px;
  width: fit-content;
}

.cron-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cron-part {
  font-size: 12px;
  color: #475569;
  background: #f8fafc;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.time-cell { line-height: 1.5; }
.time-main { font-weight: 600; color: #1e293b; font-size: 13px; }
.time-sub { font-size: 12px; color: #94a3b8; }
.time-empty { color: #cbd5e1; }

.desc-text { color: #475569; font-size: 13px; line-height: 1.5; }

.empty-state { padding: 60px 20px; }
.empty-icon { color: #cbd5e1; }

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.mobile-cards { display: none; gap: 12px; flex-direction: column; }

.m-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.m-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
}

.m-name { font-weight: 700; color: #1e293b; font-size: 14px; }
.m-status {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: #16a34a; font-weight: 600;
}

.m-section { padding: 14px 16px; border-bottom: 1px solid #f8fafc; }
.m-label { font-size: 12px; color: #94a3b8; margin-bottom: 8px; font-weight: 500; }
.m-cron-expr {
  font-family: 'Consolas', monospace;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 6px;
  display: inline-block;
}

.m-cron-desc {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.m-cron-desc span {
  font-size: 12px;
  color: #475569;
  background: #f8fafc;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.m-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: #f1f5f9;
}

.m-grid-item {
  background: #fff;
  padding: 12px 16px;
}

.m-grid-label { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
.m-grid-value { font-size: 13px; font-weight: 600; color: #1e293b; }
.m-grid-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }

.m-desc {
  padding: 12px 16px;
  font-size: 13px;
  color: #475569;
  background: #fafafa;
  line-height: 1.5;
}

.mobile-pagination {
  display: none;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .cron-container { padding: 16px 12px 40px; }
  .page-title { font-size: 18px; }
  .page-header { flex-direction: column; gap: 12px; margin-bottom: 14px; }
  .stats-row { padding: 14px 16px; margin-bottom: 14px; }
  .stat-num { font-size: 20px; }
  .toolbar { margin-bottom: 12px; }
  .main-card :deep(.el-table) { display: none; }
  .pagination-bar { display: none; }
  .mobile-cards { display: flex; }
  .mobile-pagination { display: flex; justify-content: center; }
}
</style>
