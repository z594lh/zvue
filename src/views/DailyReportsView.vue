<template>
  <main class="daily-workbench" v-loading="initializing">
    <header class="page-heading">
      <div><span class="eyebrow">DAILY OPERATIONS</span><h1>运营日报</h1><p>系统整理经营状况，你记录今天的行动与需要的协助。</p></div>
      <div v-if="config.can_write" class="write-controls"><span class="muted">工作日期</span><el-date-picker v-model="workDate" type="date" value-format="YYYY-MM-DD" :clearable="false" :disabled-date="futureDate" aria-label="填写日报的工作日期" /><el-button type="primary" :icon="EditPen" :disabled="!shopId || !workDate || opening" @click="openEditor(workDate)">写日报</el-button></div>
    </header>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="page-error" />
    <el-collapse v-model="usageSections" class="usage-guide"><el-collapse-item title="日报怎么写？查看操作说明了解日报三个模块如何写" name="guide"><p>① 第一个模块【当前负责 SKU 是什么状况】<strong class="guide-emphasis">勾选需要汇报的SKU，系统根据报表数据自动生成所勾选SKU的运营情况。只需勾选，无需手写</strong></p><p>② 第二个模块【今天进行了什么调整与优化，思路是什么】 <strong class="guide-emphasis">此处填写今天实际做的调整，重点写这个即可</strong></p><p>③ 第三个模块【发现了什么问题，需要什么协助】此处可写可不写。根据自身情况。</p><p>编辑日报仅限本人；删除需单独授权，全员查看权限不等于代写权限。</p></el-collapse-item></el-collapse>
    <section class="panel filter-bar">
      <div class="field"><label>店铺</label><el-select v-model="shopId" placeholder="选择店铺" @change="changeShop"><el-option v-for="shop in config.shops" :key="shop.id" :label="shop.shop_name + (shop.status === 1 ? '' : '（停用）')" :value="shop.id" /></el-select></div>
      <div class="field"><label>历史日期</label><el-date-picker v-model="dates" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" :disabled-date="futureDate" /></div>
      <div v-if="config.can_all" class="field"><label>人员</label><el-select v-model="ownerFilter" clearable filterable placeholder="全部人员"><el-option v-for="user in config.users" :key="user.id" :label="user.name" :value="user.id" /></el-select></div>
      <div class="field"><label>日报状态</label><el-select v-model="statusFilter" clearable placeholder="全部状态"><el-option label="已提交" value="submitted" /><el-option label="草稿" value="draft" /></el-select></div>
      <el-button :icon="Search" type="primary" plain :loading="loading" @click="page = 1; loadList()">查询</el-button>
    </section>

    <section class="panel history-panel">
      <div class="section-heading"><div><h2>日报记录</h2><span class="muted">共 {{ total }} 条 · 工作日期倒序 · 保存后可分享至微信群</span></div></div>
      <el-table :data="reports" v-loading="loading" empty-text="当前筛选范围暂无日报" @row-click="openDetail" class="history-table">
        <el-table-column label="工作日期" prop="work_date" width="140" />
        <el-table-column label="运营人员" prop="owner_name" width="130" />
        <el-table-column label="状态" width="95"><template #default="{row}"><el-tag :type="row.status === 'submitted' ? 'success' : 'info'" size="small">{{ row.status === 'submitted' ? '已提交' : '草稿' }}</el-tag></template></el-table-column>
        <el-table-column label="今日调整与优化" min-width="280"><template #default="{row}"><span class="summary-cell">{{ row.actions_summary || '尚未填写' }}</span></template></el-table-column>
        <el-table-column label="问题与协助" min-width="230"><template #default="{row}"><span :class="['summary-cell', {'issues-highlight': !row.no_issues && row.issues_summary}]">{{ row.no_issues ? '暂无需协助事项' : row.issues_summary || '尚未填写' }}</span></template></el-table-column>
        <el-table-column label="最近保存（北京时间）" width="185"><template #default="{row}">{{ dailyReportTime(row.updated_at) }}</template></el-table-column>
        <el-table-column label="操作" :width="config.can_delete ? 240 : 155" fixed="right"><template #default="{row}"><el-button :icon="View" size="small" @click.stop="openDetail(row)">查看</el-button><el-button v-if="config.can_write && row.owner_user_id === config.user_id" :icon="EditPen" size="small" @click.stop="openEditor(row.work_date)">编辑</el-button><el-button v-if="canDelete(row)" type="danger" plain :icon="Delete" size="small" :loading="deletingId === row.id" :disabled="!!deletingId" @click.stop="removeReport(row)">删除</el-button></template></el-table-column>
      </el-table>
      <footer class="pagination"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[10,20,50]" layout="total, sizes, prev, pager, next" @current-change="loadList" @size-change="page = 1; loadList()" /></footer>
    </section>

    <el-dialog v-model="editorVisible" :title="`${editForm.version ? '编辑' : '填写'}运营日报 · ${editForm.work_date || ''}`" width="min(1380px, 96vw)" top="4vh" class="daily-editor" :close-on-click-modal="false" :before-close="beforeEditorClose" @closed="invalidateEditor">
      <div class="editor-scroll" v-loading="opening">
        <template v-if="snapshot">
          <div class="editor-intro"><div><el-tag effect="plain">{{ snapshot.shop_name }}</el-tag><span class="muted">每日一份 · 当前登录人员本人填写 · 工作日期按北京时间</span></div><el-button :icon="Refresh" :disabled="saving || opening" @click="refreshSnapshot">重新整理经营数据</el-button></div>
          <el-alert v-if="!snapshot.report_date || snapshot.stale_days > 1" :title="snapshot.report_date ? `经营数据截至 ${snapshot.report_date}，比工作日期早 ${snapshot.stale_days} 天；请留意同步情况。` : '没有工作日前可用的SKU日报，经营指标显示未知，仍可填写实际工作。'" type="warning" :closable="false" show-icon />
          <div class="editor-section"><div class="section-heading"><div><h2><span class="step">1</span>当前负责 SKU 是什么状况</h2><p class="muted">整体概况由系统自动汇总；勾选后，日报会额外展开这些 SKU 的数据和关注原因。</p></div><el-tooltip content="单日为截止日对比前一天；推荐参考近7天与前7天，亏损/金额影响优先。缺数据不当零，广告归因可能回补。勾选不改变整体汇总，也不影响绩效归属。" placement="top"><el-button text circle :icon="QuestionFilled" aria-label="重点SKU筛选指引" /></el-tooltip></div>
            <el-alert class="selection-guide" title="为什么勾选 SKU？勾选之后系统自动生成勾选的SKU数据填写到日报第一部分，无需你去查询。" description="建议选 3～5 个亏损、销量下滑、广告费异常或明显改善的 SKU，可直接采用系统推荐，再按实际工作增删。最多选 10 个；不选也会保留全部负责 SKU 的整体概况。下方“经营判断”可选填，你主要填写第 2、3 部分即可。" type="info" :closable="false" show-icon />
            <div class="source-strip"><span>数据截至 <b>{{ snapshot.report_date || '暂无' }}</b></span><span>当前负责 <b>{{ snapshot.summaries.day.sku_count }}</b> 个 SKU</span><span>当日有记录 <b>{{ snapshot.summaries.day.recorded_sku_count }}</b> 个</span><span>{{ snapshot.currency }} · 非个人绩效</span></div>
            <div class="overview-grid"><div v-for="metric in overviewMetrics" :key="metric.key"><span>{{ metric.label }}</span><strong :class="{'negative': metric.key === 'sku_report_profit' && Number(snapshot.summaries.day.values[metric.key]) < 0}">{{ formatMetric(snapshot.summaries.day.values[metric.key], metric.key) }}</strong><small>较前日 {{ dailyChange(snapshot.changes[metric.key], metric.key === 'sales_qty') }}</small></div></div>
            <p v-if="snapshot.summaries.day.incomplete_count" class="warning-text">{{ snapshot.summaries.day.incomplete_count }} 个 SKU 缺少当日来源，金额仅是已记录小计；不展示完整周期涨跌。</p>
            <div class="sku-picker-bar"><div class="inline-controls"><el-select v-model="category" @change="skuPage = 1" style="width:165px"><el-option label="全部负责 SKU" value="" /><el-option label="优先关注" value="attention" /><el-option label="经营下滑" value="decline" /><el-option label="表现改善" value="improved" /><el-option label="数据缺口" value="missing" /></el-select><el-input v-model="skuSearch" clearable placeholder="搜索 SKU / 产品中文名" :prefix-icon="Search" @input="skuPage = 1" /></div><el-button :icon="MagicStick" @click="useRecommended">采用系统推荐</el-button></div>
            <div class="selected-skus"><span>本次重点 {{ editForm.selected_skus.length }}/10</span><el-tag v-for="sku in editForm.selected_skus" :key="sku" closable @close="editForm.selected_skus = editForm.selected_skus.filter(x => x !== sku)">{{ nameFor(sku) }} · {{ sku }}</el-tag><span v-if="!editForm.selected_skus.length" class="muted">建议选 3～5 个，也可只汇报整体概况，不强求凑数。</span></div>
            <el-table :data="candidatePage" size="small" max-height="350" empty-text="无匹配SKU，可更换筛选条件" class="candidate-table">
              <el-table-column label="重点" width="64"><template #default="{row}"><el-checkbox :model-value="editForm.selected_skus.includes(row.seller_sku)" :disabled="!editForm.selected_skus.includes(row.seller_sku) && editForm.selected_skus.length >= 10" :aria-label="`选择${row.seller_sku}`" @change="checked => selectSku(row.seller_sku, checked)" /></template></el-table-column>
              <el-table-column label="SKU / 产品中文名" min-width="225"><template #default="{row}"><strong>{{ row.product_name || '未维护中文名' }}</strong><small class="sku-code">{{ row.seller_sku }}</small></template></el-table-column>
              <el-table-column label="当日销量" width="85" align="right"><template #default="{row}">{{ formatMetric(row.day.values.sales_qty, 'sales_qty') }}</template></el-table-column>
              <el-table-column label="当日广告费" width="105" align="right"><template #default="{row}">{{ money(row.day.values.ad_cost) }}</template></el-table-column>
              <el-table-column label="当日利润" width="100" align="right"><template #default="{row}"><span :class="{'negative': Number(row.day.values.sku_report_profit) < 0}">{{ money(row.day.values.sku_report_profit) }}</span></template></el-table-column>
              <el-table-column label="近7天利润" width="110" align="right"><template #default="{row}"><span :class="{'negative': Number(row.week.values.sku_report_profit) < 0}">{{ money(row.week.values.sku_report_profit) }}</span><small class="muted">{{ row.week.recorded_days }}/7 天</small></template></el-table-column>
              <el-table-column label="关注原因 / 数据提示" min-width="270"><template #default="{row}"><div class="reason-tags"><el-tag v-for="tag in row.recommendation.tags" :key="tag" size="small" :type="row.recommendation.category === 'attention' ? 'warning' : row.recommendation.category === 'improved' ? 'success' : 'info'" effect="plain">{{ tag }}</el-tag></div></template></el-table-column>
            </el-table>
            <div class="sku-pagination"><span class="muted">按金额影响与持续性推荐，不代表必须调广告。可读取接手前数据。</span><el-pagination v-model:current-page="skuPage" :page-size="10" :total="candidates.length" layout="total, prev, pager, next" small /></div>
            <el-input v-model="editForm.situation_text" type="textarea" :rows="2" maxlength="4000" show-word-limit placeholder="选填：补充你的经营判断，例如异常原因、重点观察方向。不要重复抄表格。" />
          </div>
          <div class="editor-section"><h2><span class="step">2</span>今天进行了什么调整与优化，思路是什么</h2><p class="muted">写清对象 → 动作 → 原因 → 接下来观察什么；没有调整时也请说明实际工作和判断。</p><el-input v-model="editForm.actions_text" type="textarea" :rows="5" maxlength="8000" show-word-limit placeholder="例如：SKU xxx，紧密匹配竞价从 $0.53 调整到 $0.45。原因是近期获客成本偏高，观察3天，重点关注订单量及广告费是否改善。\n只填写实际做过的操作，不由系统代写。" /></div>
          <div class="editor-section"><div class="section-heading"><h2><span class="step">3</span>发现了什么问题，需要什么协助</h2><el-checkbox v-model="editForm.no_issues" @change="confirmNoIssues">暂无需要协助的问题</el-checkbox></div><el-input v-model="editForm.issues_text" :disabled="editForm.no_issues" type="textarea" :rows="3" maxlength="4000" show-word-limit placeholder="请写清：问题是什么、影响什么、希望谁协助处理。" /></div>
        </template>
      </div>
      <template #footer><div class="editor-footer"><span class="muted">{{ editForm.version ? `已保存版本 ${editForm.version} · 修改后记得保存` : '尚未保存' }}<br>可先预览；保存/提交后下载图片，提交后仍可修改。</span><div><el-button :disabled="saving" @click="closeEditor">取消</el-button><el-button :icon="View" :disabled="saving || opening || !snapshot" @click="previewContent">预览日报</el-button><el-button :loading="saving && savingStatus === 'draft'" :disabled="saving || opening || !snapshot" @click="persist('draft')">{{ editForm.status === 'submitted' ? '保存修改' : '保存草稿' }}</el-button><el-button type="primary" :icon="Check" :loading="saving && savingStatus === 'submitted'" :disabled="saving || opening || !snapshot" @click="persist('submitted')">{{ editForm.status === 'submitted' ? '保存并查看' : '提交日报' }}</el-button></div></div></template>
    </el-dialog>

    <el-dialog v-model="detailVisible" :title="detailPreview ? '日报预览 · 尚未保存本次内容' : '运营日报'" width="min(1000px, 95vw)" top="4vh" class="daily-detail" @close="detailVersion++">
      <div class="detail-scroll" v-loading="detailLoading"><article v-if="detailReport" class="report-paper"><header><span class="eyebrow">DAILY OPERATIONS</span><h2>{{ detailReport.snapshot.owner_name }} · 运营日报</h2><p>工作日期 {{ detailReport.work_date }}<el-tag :type="detailReport.status === 'submitted' && !detailPreview ? 'success' : 'info'" size="small">{{ detailPreview ? '未保存预览' : detailReport.status === 'submitted' ? '已提交' : '草稿' }}</el-tag></p></header><div v-for="(block, index) in detailBlocks" :key="index" :class="['report-block', `block-${block.kind}`]">{{ block.text }}</div></article></div>
      <template #footer><div class="detail-footer"><span class="muted">{{ detailPreview ? '预览不会保存或提交，也不会重新读取经营数据。' : '保存快照 · 非实时数据' }}<br>{{ detailPreview ? '返回填写后保存/提交，即可下载日报图片。' : '导出一张完整长图，方便直接发送到微信群。' }}</span><div v-if="detailPreview"><el-button type="primary" @click="detailVisible = false">返回继续填写</el-button></div><div v-else><el-button v-if="config.can_write && detailReport?.owner_user_id === config.user_id" :disabled="detailLoading || exporting || !!deletingId" :icon="EditPen" @click="editDetail">编辑</el-button><el-button v-if="canDelete(detailReport)" type="danger" plain :icon="Delete" :disabled="detailLoading || exporting || !!deletingId" @click="removeReport(detailReport, detailScope)">删除</el-button><el-button :icon="CopyDocument" :disabled="!detailReport || detailLoading || exporting || !!deletingId" @click="copyReport">复制文字</el-button><el-button type="primary" :icon="Download" :loading="exporting" :disabled="!detailReport || detailLoading || !!deletingId" @click="downloadImage">下载日报图片</el-button></div></div></template>
    </el-dialog>

    <el-dialog v-model="copyVisible" title="复制日报文字" width="min(800px, 94vw)"><p class="muted">浏览器暂不允许自动复制，请选中文本后手动复制。</p><el-input :model-value="copyText" type="textarea" :rows="15" readonly /><template #footer><el-button @click="copyVisible = false">关闭</el-button></template></el-dialog>
  </main>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, onActivated, onDeactivated, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, CopyDocument, Delete, Download, EditPen, MagicStick, QuestionFilled, Refresh, Search, View } from '@element-plus/icons-vue'
import { getDailyReportConfig, getDailyReports, getCurrentDailyReport, getDailyReport, previewDailyReport, saveDailyReport, deleteDailyReport } from '@/services/api'
import { dailyChange, dailyReportBlocks, dailyReportText, dailyReportImage, dailyReportTime } from '@/utils/dailyReportShare'

const config = ref({ shops: [], users: [], can_all: false, can_write: false, can_delete: false })
// 首次进入默认展示填写说明，仍允许运营人员手动收起。
const usageSections = ref(['guide'])
const initializing = ref(true), error = ref(''), shopId = ref(null), dates = ref([]), workDate = ref('')
const ownerFilter = ref(null), statusFilter = ref(''), reports = ref([]), total = ref(0), page = ref(1), pageSize = ref(20), loading = ref(false)
const deletingId = ref(null)
const editorVisible = ref(false), opening = ref(false), saving = ref(false), savingStatus = ref(''), snapshot = ref(null), editForm = ref({}), editorScope = ref(null), refreshed = ref(false)
const category = ref(''), skuSearch = ref(''), skuPage = ref(1), baseline = ref('')
const detailVisible = ref(false), detailReport = ref(null), detailLoading = ref(false), exporting = ref(false), detailScope = ref(null)
const detailPreview = ref(false)
const copyVisible = ref(false), copyText = ref('')
let listVersion = 0, editorVersion = 0, detailVersion = 0, disposed = false
const overviewMetrics = [{key: 'sales_qty', label: '当日销量'}, {key: 'sales_amount', label: '销售额'}, {key: 'ad_cost', label: '广告费'}, {key: 'sku_report_profit', label: 'SKU报表利润'}]
const money = v => v === null || v === undefined ? '—' : Number(v).toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2})
const formatMetric = (value, key) => value === null || value === undefined ? '—' : key === 'sales_qty' ? Number(value).toLocaleString('zh-CN') : money(value)
const message = err => err.response?.data?.message || err.message || '操作失败'
const candidates = computed(() => (snapshot.value?.rows || []).filter(row => (!category.value || (category.value === 'decline' ? row.recommendation.signals?.some(signal => ['sales_decline', 'profit_decline'].includes(signal)) : row.recommendation.category === category.value)) && (!skuSearch.value || `${row.seller_sku} ${row.product_name}`.toLowerCase().includes(skuSearch.value.toLowerCase()))))
const candidatePage = computed(() => candidates.value.slice((skuPage.value - 1) * 10, skuPage.value * 10))
const detailBlocks = computed(() => detailReport.value ? dailyReportBlocks(detailReport.value) : [])
const canDelete = report => !!report?.id && config.value.can_delete && (config.value.can_all || report.owner_user_id === config.value.user_id)
const nameFor = sku => snapshot.value?.rows.find(row => row.seller_sku === sku)?.product_name || '未维护中文名'
const fingerprint = () => JSON.stringify({ form: editForm.value, snapshot: snapshot.value, refreshed: refreshed.value })
const dirty = () => editorVisible.value && !!snapshot.value && fingerprint() !== baseline.value
const futureDate = day => config.value.today && `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}` > config.value.today

/** 当前筛选只提供店铺/站点；已打开编辑器固定自己的上下文，防止切店错存。 */
function scopeParams() {
  const shop = config.value.shops.find(s => s.id === shopId.value)
  if (!shop) throw new Error('请选择店铺')
  return {shop_id: shop.id, marketplace_id: shop.marketplace_id}
}

/** 列表请求序号屏蔽切店、翻页后的迟到响应。 */
async function loadList() {
  if (!shopId.value || dates.value?.length !== 2) return
  const version = ++listVersion; loading.value = true; error.value = ''
  try {
    const response = await getDailyReports({...scopeParams(), date_from: dates.value[0], date_to: dates.value[1], owner_user_id: ownerFilter.value || undefined, status: statusFilter.value, page: page.value, page_size: pageSize.value})
    if (!disposed && version === listVersion) { reports.value = response.data.data.list; total.value = response.data.data.total }
  } catch (err) { if (!disposed && version === listVersion) { error.value = message(err); reports.value = []; total.value = 0 } }
  finally { if (version === listVersion) loading.value = false }
}
function changeShop() { page.value = 1; reports.value = []; total.value = 0; loadList() }

/** 打开某工作日：先找本人存档，已有则保留快照，未创建才只读整理新数据。 */
async function openEditor(day) {
  if (!day || opening.value || saving.value) return
  const version = ++editorVersion; editorScope.value = scopeParams(); editorVisible.value = true; opening.value = true; snapshot.value = null
  category.value = ''; skuSearch.value = ''; skuPage.value = 1; refreshed.value = false
  editForm.value = {report_id: null, work_date: day, version: 0, status: 'draft', selected_skus: [], situation_text: '', actions_text: '', issues_text: '', no_issues: false}
  try {
    const response = await getCurrentDailyReport({...editorScope.value, work_date: day})
    let report = response.data.data, data
    if (report) data = report.snapshot
    else data = (await previewDailyReport({...editorScope.value, work_date: day})).data.data
    if (disposed || version !== editorVersion || !editorVisible.value) return
    if (report) adoptReport(report)
    else { snapshot.value = data; editForm.value.selected_skus = [...data.recommended_skus] }
    baseline.value = fingerprint()
  } catch (err) { if (!disposed && version === editorVersion) { ElMessage.error(message(err)); editorVisible.value = false } }
  finally { if (version === editorVersion) opening.value = false }
}
/** 用已保存版本更新编辑状态，避免复制浏览器金额到服务端。 */
function adoptReport(report) {
  snapshot.value = report.snapshot
  editForm.value = {report_id: report.id, work_date: report.work_date, version: report.version, status: report.status, selected_skus: [...report.selected_skus], situation_text: report.situation_text, actions_text: report.actions_text, issues_text: report.issues_text, no_issues: !!report.no_issues}
  refreshed.value = false
}
function selectSku(sku, checked) { if (checked && editForm.value.selected_skus.length < 10) editForm.value.selected_skus.push(sku); else if (!checked) editForm.value.selected_skus = editForm.value.selected_skus.filter(x => x !== sku) }
function useRecommended() { editForm.value.selected_skus = [...snapshot.value.recommended_skus]; category.value = ''; skuSearch.value = ''; skuPage.value = 1 }
/** 刷新仅替换经营部分，人工文字不丢失；保存时仍由服务端重读固定截止日。 */
async function refreshSnapshot() {
  if (saving.value || opening.value) return
  try { await ElMessageBox.confirm('将按当前负责人和最新可用日报重新整理经营概况；你的调整优化和问题文字保留。已转交SKU可能从重点中移除。', '重新整理', {type: 'info', confirmButtonText: '整理数据', cancelButtonText: '取消'}) } catch { return }
  const version = ++editorVersion; opening.value = true
  try {
    const response = await previewDailyReport({...editorScope.value, work_date: editForm.value.work_date})
    if (disposed || version !== editorVersion || !editorVisible.value) return
    snapshot.value = response.data.data; refreshed.value = true
    const skus = new Set(snapshot.value.rows.map(row => row.seller_sku))
    editForm.value.selected_skus = editForm.value.selected_skus.filter(sku => skus.has(sku)); skuPage.value = 1
  } catch (err) { if (!disposed && version === editorVersion) ElMessage.error(message(err)) }
  finally { if (version === editorVersion) opening.value = false }
}
async function confirmNoIssues(value) {
  if (!value || !editForm.value.issues_text) return
  try { await ElMessageBox.confirm('勾选暂无问题会清空当前问题文字，确认吗？', '暂无问题', {type: 'info'}); editForm.value.issues_text = '' } catch { editForm.value.no_issues = false }
}
/** 保存具备版本门禁，不自动重试；成功返回的服务端快照才可供分享。 */
async function persist(status) {
  if (saving.value || opening.value || !snapshot.value) return
  if ((status === 'submitted' || editForm.value.status === 'submitted') && (!editForm.value.actions_text.trim() || (!editForm.value.no_issues && !editForm.value.issues_text.trim()))) return ElMessage.warning('请填写今日调整优化，以及问题协助（或勾选暂无）')
  saving.value = true; savingStatus.value = status
  const version = editorVersion, fixed = {...editorScope.value}
  try {
    const response = await saveDailyReport({...fixed, ...editForm.value, status, refresh_data: refreshed.value, data_date: snapshot.value.report_date || undefined})
    if (disposed || version !== editorVersion) return
    adoptReport(response.data.data); baseline.value = fingerprint(); ElMessage.success(status === 'submitted' ? '日报已保存，可分享至微信群' : '日报已保存')
    loadList()
    if (status === 'submitted') { editorVisible.value = false; detailScope.value = fixed; detailPreview.value = false; detailReport.value = response.data.data; detailLoading.value = false; detailVisible.value = true }
  } catch (err) { if (!disposed && version === editorVersion) ElMessage.error(message(err)) }
  finally { saving.value = false }
}
async function confirmDiscard() {
  if (saving.value) { ElMessage.info('正在保存，请稍候'); return false }
  if (!dirty()) return true
  try { await ElMessageBox.confirm('有尚未保存的修改，确定离开吗？', '保留工作内容', {type: 'warning', confirmButtonText: '放弃修改', cancelButtonText: '继续填写'}); return true } catch { return false }
}
async function beforeEditorClose(done) { if (await confirmDiscard()) done() }
async function closeEditor() { if (await confirmDiscard()) editorVisible.value = false }
function invalidateEditor() { if (!editorVisible.value) { editorVersion++; opening.value = false; snapshot.value = null } }

/** 查看仅取存档，不重新整理源数据。切换记录/关闭后不接受旧响应。 */
async function openDetail(row) {
  if (!row.id || deletingId.value) return
  const version = ++detailVersion; detailScope.value = scopeParams(); detailPreview.value = false; detailReport.value = null; detailVisible.value = true; detailLoading.value = true
  try {
    const response = await getDailyReport(row.id, detailScope.value)
    if (!disposed && version === detailVersion && detailVisible.value) detailReport.value = response.data.data
  } catch (err) { if (!disposed && version === detailVersion) { ElMessage.error(message(err)); detailVisible.value = false } }
  finally { if (version === detailVersion) detailLoading.value = false }
}
/** 预览冻结当前填写内容，复用分享排版；不调用接口、不保存、不改变编辑器未保存状态。 */
function previewContent() {
  if (saving.value || opening.value || !snapshot.value) return
  detailVersion++; detailPreview.value = true; detailLoading.value = false; detailScope.value = {...editorScope.value}
  detailReport.value = JSON.parse(JSON.stringify({...editForm.value, snapshot: snapshot.value, owner_user_id: config.value.user_id, is_preview: true}))
  detailVisible.value = true
}

/** 确认后只删除当时可见的版本；冲突不重试，管理员删除不等于允许代写。 */
async function removeReport(row, fixedScope = scopeParams()) {
  if (!canDelete(row) || deletingId.value || saving.value || exporting.value) return
  const target = {id: row.id, version: row.version, work_date: row.work_date, name: row.owner_name || row.snapshot?.owner_name || '该人员', scope: {...fixedScope}}
  deletingId.value = target.id
  try {
    try { await ElMessageBox.confirm(`确定删除 ${target.name} 在 ${target.work_date} 的日报吗？删除后无法在页面恢复，请先下载需保留的内容。`, '删除日报', {type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '保留日报'}) } catch { return }
    if (disposed) return
    await deleteDailyReport(target.id, {...target.scope, version: target.version, confirm_delete: true})
    if (disposed) return
    if (!detailPreview.value && detailReport.value?.id === target.id) { detailVisible.value = false; detailReport.value = null }
    ElMessage.success('日报已删除，可重新填写该日的日报')
    if (page.value > 1 && reports.value.length === 1) page.value--
    await loadList()
  } catch (err) { if (!disposed) ElMessage.error(message(err)) }
  finally { deletingId.value = null }
}
function editDetail() { const day = detailReport.value.work_date; detailVisible.value = false; openEditor(day) }
async function copyReport() {
  const value = dailyReportText(detailReport.value)
  try { await navigator.clipboard.writeText(value); ElMessage.success('日报文字已复制') }
  catch { copyText.value = value; copyVisible.value = true }
}
/** 一次导出一张已保存版本的完整长图，不拆页，不重新读取经营数据。 */
async function downloadImage() {
  if (exporting.value || !detailReport.value) return
  exporting.value = true
  const report = detailReport.value
  try {
    const blob = await dailyReportImage(report)
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    try {
      link.href = url; link.download = `${report.snapshot.owner_name}_${report.work_date}_运营日报_v${report.version}_长图.png`.replace(/[\\/:*?"<>|]/g, '_')
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (err) {
      link.remove(); URL.revokeObjectURL(url); throw err
    }
    ElMessage.success('日报长图已生成，可直接发送到微信群')
  } catch (err) { ElMessage.error(message(err)) }
  finally { exporting.value = false }
}

/** 离开页面/刷新保护未保存文字；在途保存不承诺被取消，返回后重新查询。 */
function beforeUnload(event) { if (dirty() || saving.value) { event.preventDefault(); event.returnValue = '' } }
onBeforeRouteLeave(async () => await confirmDiscard())
// 页面在系统多页签中可能缓存，失活时必须关闭Teleport弹框并隔离旧请求。
onDeactivated(() => {
  listVersion++; editorVersion++; detailVersion++
  editorVisible.value = false; detailVisible.value = false; copyVisible.value = false
  opening.value = false; loading.value = false
})
onActivated(() => { if (!initializing.value) loadList() })
onBeforeUnmount(() => { disposed = true; listVersion++; editorVersion++; detailVersion++; window.removeEventListener('beforeunload', beforeUnload) })
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  try {
    config.value = (await getDailyReportConfig()).data.data
    shopId.value = config.value.shops[0]?.id || null; workDate.value = config.value.today
    const prior = new Date(`${config.value.today}T12:00:00Z`); prior.setUTCDate(prior.getUTCDate() - 29)
    dates.value = [prior.toISOString().slice(0, 10), config.value.today]
    await loadList()
  } catch (err) { error.value = message(err) }
  finally { initializing.value = false }
})
</script>

<style scoped>
.daily-workbench{max-width:1680px;margin:0 auto;padding:28px 30px 50px;color:#334155;background:#f5f7fb;min-height:calc(100vh - 70px)}
.page-heading,.section-heading,.inline-controls,.editor-intro,.editor-footer,.detail-footer,.sku-picker-bar,.sku-pagination{display:flex;align-items:center;justify-content:space-between;gap:16px}
.page-heading{margin-bottom:24px}.write-controls{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}.write-controls :deep(.el-date-editor){width:150px}.eyebrow{font-size:11px;letter-spacing:2px;color:#7d94b5;font-weight:600}h1{font-size:27px;margin:6px 0 8px;color:#1e3658}h2{font-size:16px;color:#233f62;margin:0}p{line-height:1.7}.page-heading p{margin:0;color:#8594a8;font-size:13px}
.panel{background:white;border:1px solid #e5ebf4;border-radius:14px;margin-bottom:18px;overflow:hidden}.filter-bar{padding:20px;display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap}.field{display:flex;flex-direction:column;gap:8px}.field label{font-size:12px;color:#7d8fa9}.field .el-select{width:170px}.field :deep(.el-date-editor){width:310px}.section-heading{padding:18px 20px;border-bottom:1px solid #edf1f6}.section-heading>div:first-child{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.muted{color:#8a9ab1;font-size:12px}.page-error{margin-bottom:18px}.summary-cell{white-space:pre-line;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.7;font-size:12px}.issues-highlight{color:#b7791f}.history-table :deep(.el-table__row){cursor:pointer}.history-table :deep(th.el-table__cell),.candidate-table :deep(th.el-table__cell){background:#f6f8fc;color:#7c8fa8;font-weight:500}.history-table :deep(td.el-table__cell){padding:17px 0}.pagination{display:flex;justify-content:flex-end;padding:18px}.inline-controls .el-date-editor{width:150px}.editor-scroll{max-height:72vh;overflow:auto;padding:0 6px 10px}.editor-intro{margin-bottom:16px}.editor-intro .muted{margin-left:12px}.editor-section{padding:20px 0;border-bottom:1px solid #e9eef5}.editor-section .section-heading{padding:0;border:0;margin-bottom:14px}.editor-section .section-heading p{margin:6px 0 0}.step{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;color:#467fe3;background:#edf3ff;border-radius:8px;margin-right:9px}.source-strip{display:flex;flex-wrap:wrap;gap:22px;padding:13px 16px;background:#f4f7fd;border-radius:9px;font-size:12px;color:#8a9ab1}.source-strip b{color:#506b91;font-weight:500}.overview-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:18px 0}.overview-grid>div{display:flex;flex-direction:column;gap:8px;padding:14px 18px;background:#fafbfd;border:1px solid #edf1f6;border-radius:10px}.overview-grid span{font-size:12px;color:#8a9ab1}.overview-grid strong{font-size:23px;font-weight:600;color:#365c8e}.overview-grid small{font-size:11px;color:#94a3b8}.negative{color:#ef6464!important}.warning-text{font-size:12px;color:#bc8a35;margin-top:0}.sku-picker-bar{margin:8px 0 12px}.sku-picker-bar .el-input{width:240px}.selected-skus{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0 16px;font-size:12px;color:#6c81a1}.selected-skus .el-tag{height:auto;min-height:25px;white-space:normal}.sku-code{display:block;font-size:11px;color:#8c9fb7;margin-top:4px}.reason-tags{display:flex;gap:5px;flex-wrap:wrap}.reason-tags .el-tag{height:auto;white-space:normal;line-height:1.7}.sku-pagination{margin:13px 0 18px}.candidate-table small.muted{display:block}.editor-section>h2{margin-bottom:10px}.editor-footer{text-align:left}.editor-footer>div,.detail-footer>div{display:flex;gap:8px;flex-wrap:wrap}.editor-footer .el-button+.el-button,.detail-footer .el-button+.el-button{margin:0}.editor-footer .muted,.detail-footer .muted{line-height:1.8}.detail-scroll{max-height:72vh;overflow:auto;background:#f5f7fb;padding:20px}.report-paper{padding:32px 38px;background:#fff;border:1px solid #e7edf6;border-radius:12px}.report-paper header{border-bottom:1px solid #e9eef5;padding-bottom:15px;margin-bottom:18px}.report-paper header h2{font-size:25px;margin:8px 0}.report-paper header p{color:#8a9ab1;font-size:12px;margin-bottom:0}.report-paper header .el-tag{margin-left:15px}.report-block{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;margin:12px 0;font-size:13px}.block-heading{color:#254466;font-size:17px;font-weight:600;border-top:1px solid #edf1f6;padding-top:20px;margin-top:24px}.block-meta,.block-note{font-size:11px;color:#8a9ab1}.block-metric{padding:16px;background:#f0f5ff;border-radius:8px;color:#3f6cac;font-size:16px;font-weight:500}.block-sku{color:#168d83;font-weight:600;margin-top:20px}.block-warning{color:#b48025;background:#fffbeb;padding:12px;border-radius:7px}
@media(max-width:800px){.daily-workbench{padding:18px 12px}.page-heading{align-items:flex-start}.section-heading,.editor-intro,.editor-footer,.detail-footer,.sku-picker-bar,.sku-pagination{flex-wrap:wrap}.overview-grid{grid-template-columns:repeat(2,1fr)}.inline-controls{flex-wrap:wrap;gap:8px}.filter-bar{gap:12px}.report-paper{padding:20px 17px}.detail-scroll{padding:8px}.sku-picker-bar .el-input{width:190px}.source-strip{gap:10px}.editor-intro .muted{display:block;margin:8px 0}.editor-footer,.detail-footer{gap:12px}.editor-footer>div,.detail-footer>div{width:100%;justify-content:flex-end}}
</style>
<style scoped>
/* 操作说明默认展开且可收起；重点勾选用途在编辑器直接可见。 */
/* 关键操作沿用原字号和行内排版，仅轻微加粗、加深颜色。 */
.guide-emphasis{display:inline;color:#475569;font-size:inherit;font-weight:600}
.usage-guide{margin-bottom:18px;padding:0 20px;background:white;border:1px solid #e5ebf4;border-radius:12px}.usage-guide :deep(.el-collapse-item__header){font-size:13px;color:#506b91}.usage-guide p{margin:8px 0;color:#657a96;font-size:13px}.selection-guide{margin-bottom:16px}.selection-guide :deep(.el-alert__description){line-height:1.8}
/* 手机弹框为固定操作预留空间，避免多行页脚挤出可视区。 */
@media(max-width:800px){.editor-scroll{max-height:calc(100dvh - 330px)}.detail-scroll{max-height:calc(100dvh - 270px)}.editor-section>.section-heading{align-items:flex-start}.editor-section>.section-heading>div:first-child{flex:1;min-width:0}.selected-skus .el-tag{max-width:100%}.selected-skus :deep(.el-tag__content){white-space:normal;overflow-wrap:anywhere}}
</style>
