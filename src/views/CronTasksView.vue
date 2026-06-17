<template>
  <div class="cron-page">
    <div class="cron-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">
            <el-icon size="24" class="title-icon"><Timer /></el-icon>
            计划任务
          </h1>
          <p class="page-desc">系统定时任务调度中心 · 上次执行 / 下次执行一目了然</p>
        </div>
      </div>

      <div class="stats-row" v-if="pagination.total > 0">
        <div class="stat-item">
          <div class="stat-num">{{ pagination.total }}</div>
          <div class="stat-name">任务总数</div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <div class="stat-num" style="color: #f59e0b">{{ upcomingCount }}</div>
          <div class="stat-name">未来 1 小时内执行</div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <div class="stat-num" style="color: #10b981">{{ runningCount }}</div>
          <div class="stat-name">运行中</div>
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
          <el-table-column label="任务名称" min-width="130">
            <template #default="{ row }">
              <span class="name-tag">{{ row.task_name }}</span>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="90" align="center">
            <template #default>
              <span class="status-badge">
                <span class="status-dot" />
                运行中
              </span>
            </template>
          </el-table-column>

          <el-table-column label="执行周期" min-width="260">
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
                <div class="time-main">{{ row.next_run || '-' }}</div>
                <div class="time-sub">{{ fromNow(row.next_run) }}</div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="上次执行" width="170">
            <template #default="{ row }">
              <div v-if="row.last_run" class="time-cell">
                <div class="time-main">{{ row.last_run }}</div>
                <div class="time-sub">{{ timeAgo(row.last_run) }}</div>
              </div>
              <span v-else class="time-empty">—</span>
            </template>
          </el-table-column>

          <el-table-column label="描述" min-width="180">
            <template #default="{ row }">
              <span class="desc-text">{{ row.description }}</span>
            </template>
          </el-table-column>
        </el-table>

        <div v-else-if="!loading" class="empty-state">
          <el-empty description="暂无计划任务">
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
            <span class="m-status"><span class="status-dot" />运行中</span>
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
              <div class="m-grid-value">{{ task.next_run || '-' }}</div>
              <div class="m-grid-sub">{{ fromNow(task.next_run) }}</div>
            </div>
            <div class="m-grid-item">
              <div class="m-grid-label">上次执行</div>
              <div v-if="task.last_run" class="m-grid-value">{{ task.last_run }}</div>
              <div v-if="task.last_run" class="m-grid-sub">{{ timeAgo(task.last_run) }}</div>
              <div v-else class="m-grid-value" style="color: #94a3b8">—</div>
            </div>
          </div>
          <div v-if="task.description" class="m-desc">{{ task.description }}</div>
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
    </div>
  </div>
</template>

<script>
export default { name: 'CronTasksView' }
</script>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { Timer, Refresh, Search } from '@element-plus/icons-vue'
import { getCronTasks } from '@/services/api.js'
import { ElMessage } from 'element-plus'

const tasks = ref([])
const loading = ref(false)
const keyword = ref('')

const pagination = ref({
  page: 1,
  per_page: 10,
  total: 0,
  total_pages: 0
})

const upcomingCount = computed(() => {
  const oneHour = Date.now() + 60 * 60 * 1000
  return tasks.value.filter(t => t.next_run && new Date(t.next_run).getTime() <= oneHour).length
})
const runningCount = computed(() => tasks.value.length)

const timeAgo = (ts) => {
  const diff = Date.now() - new Date(ts).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return sec + ' 秒前'
  const min = Math.floor(sec / 60)
  if (min < 60) return min + ' 分钟前'
  const hr = Math.floor(min / 60)
  if (hr < 24) return hr + ' 小时前'
  const day = Math.floor(hr / 24)
  return day + ' 天前'
}

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

  if (schedule.startsWith('0 ') && schedule.endsWith(' * * *')) {
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

const fetchTasks = async () => {
  loading.value = true
  try {
    const res = await getCronTasks({
      keyword: keyword.value || undefined,
      page: pagination.value.page,
      per_page: pagination.value.per_page
    })
    if (res.data && (res.data.status === 'success' || res.data.success)) {
      tasks.value = res.data.tasks || res.data.data || []
      if (res.data.pagination) {
        pagination.value = { ...pagination.value, ...res.data.pagination }
      }
    } else {
      ElMessage.warning((res.data && res.data.message) || '获取任务列表失败')
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('网络异常，无法获取计划任务')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.value.page = 1
  fetchTasks()
}

const handlePageChange = () => {
  fetchTasks()
}

onMounted(() => {
  fetchTasks()
})
</script>

<style scoped>
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