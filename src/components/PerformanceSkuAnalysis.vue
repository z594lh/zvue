<template>
  <el-dialog v-model="configVisible" :title="`${ownerName} · 分析配置`" width="min(820px, 96vw)" class="ownership-dialog sku-analysis-dialog"
    :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" @opened="observeTags" @close="invalidateConfig">
    <el-alert v-if="configError" :title="configError" type="error" :closable="false" show-icon />
    <div v-loading="configLoading" class="analysis-config-body">
      <div class="analysis-section-heading"><h3>关注 SKU</h3><span>已选 {{ selectedSkus.length }} / {{ maxSelected }} · 当前负责 {{ candidateCount }} 个</span></div>
      <p class="analysis-help">选择你需要关注的SKU和指标。后续每次分析数据就只会展示你关注的SKU和指标，当然，随时可以修改配置</p>
      <el-select v-model="selectedSkus" multiple filterable remote :remote-method="searchCandidates" :loading="candidateLoading" :multiple-limit="maxSelected"
        collapse-tags collapse-tags-tooltip :max-collapse-tags="3" placeholder="搜索 SKU 或产品中文名称添加" class="analysis-sku-select" :disabled="configLoading || saving">
        <el-option v-for="item in dropdownOptions" :key="item.seller_sku" :value="item.seller_sku" :label="`${item.seller_sku} · ${item.product_name || '未维护中文名称'}`" :disabled="!item.eligible">
          <span class="analysis-option-sku">{{ item.seller_sku }}</span><span class="analysis-option-name">{{ item.product_name || (item.eligible ? '未维护中文名称' : '已失效，请移除') }}</span>
        </el-option>
        <template #footer><el-button v-if="candidateRows.length < candidateTotal" text :loading="candidateLoading" @click.stop="loadMoreCandidates">加载更多搜索结果</el-button><span v-else class="analysis-help">共 {{ candidateTotal }} 个匹配 SKU</span></template>
      </el-select>
      <div ref="tagViewport" class="analysis-candidate-tags">
        <button v-for="(item, index) in previewRows" :key="item.seller_sku" type="button" class="analysis-sku-tag"
          :class="{ selected: selectedSkus.includes(item.seller_sku) }" :aria-pressed="selectedSkus.includes(item.seller_sku)"
          :aria-hidden="index >= visibleTagCount" :tabindex="index < visibleTagCount ? 0 : -1" :disabled="configLoading || saving" :title="`${item.seller_sku} · ${item.product_name || '未维护中文名称'}`" @click="toggleSku(item.seller_sku)">
          <span class="analysis-sku-tag-code"><el-icon><Check v-if="selectedSkus.includes(item.seller_sku)" /><Plus v-else /></el-icon><span>{{ item.seller_sku }}</span></span>
          <span class="analysis-sku-tag-name">{{ item.product_name || '未维护中文名称' }}</span>
        </button>
      </div>
      <p v-if="candidateCount > visibleTagCount" class="analysis-help">还有 {{ candidateCount - visibleTagCount }} 个 SKU 未在标签区展示，可通过上方搜索添加。</p>
      <el-empty v-if="!configLoading && !candidateCount" description="该人员目前没有可关注的有效子 SKU" :image-size="60" />
      <el-collapse v-if="selectedSkus.length" class="analysis-selected-list"><el-collapse-item :title="`查看已选清单（${selectedSkus.length} 个，隐藏标签不会丢失）`" name="selected">
        <el-tag v-for="sku in selectedSkus" :key="sku" closable :type="lookup[sku]?.eligible === false ? 'danger' : 'info'" :disable-transitions="true" @close="removeSku(sku)">
          {{ sku }}<span v-if="lookup[sku]?.eligible === false"> · 已失效</span>
        </el-tag>
      </el-collapse-item></el-collapse>
      <div class="analysis-section-heading analysis-metric-heading"><h3>分析指标</h3><span>拖动下方标签调整展示顺序</span></div>
      <el-checkbox-group v-model="metricKeys" class="analysis-metric-options" :disabled="configLoading || saving">
        <el-checkbox v-for="metric in allMetrics" :key="metric.key" :label="metric.key">{{ metric.label }}</el-checkbox>
      </el-checkbox-group>
      <div class="analysis-metric-order" role="list" aria-label="已选指标展示顺序，拖动排序；键盘按 Alt 加左右方向键调整">
        <div v-for="(key, index) in metricKeys" :key="key" class="analysis-order-item" role="listitem"
          :class="{ 'is-dragging': draggingMetric === key, 'is-drop-target': dropMetric === key }"
          :draggable="!configLoading && !saving" :tabindex="configLoading || saving ? -1 : 0"
          :aria-label="`${index + 1}. ${metricLabel(key)}，可拖动排序，或按 Alt 加左右方向键调整`"
          @dragstart="startMetricDrag($event, key)" @dragover="overMetric($event, key)" @drop="dropOnMetric($event, key)" @dragend="clearMetricDrag"
          @keydown.alt.left.prevent="moveMetric(index, -1)" @keydown.alt.right.prevent="moveMetric(index, 1)">
          <el-icon class="analysis-drag-handle"><Rank /></el-icon>
          <span>{{ index + 1 }}. {{ metricLabel(key) }}</span>
        </div>
      </div>
      <p class="analysis-help">利润、退款沿用 SKU 日报；退款不再次扣除。ACOS/TACOS 按周期汇总金额计算，广告订单数不是全部订单数。</p>
    </div>
    <template #footer>
      <span class="analysis-footer-note">配置属于该负责人，保存后其他有权限的人员也可查看。</span>
      <el-button :disabled="saving" @click="configVisible = false">取消</el-button>
      <el-button type="primary" :icon="Check" :loading="saving" :disabled="configLoading || !!configError || !metricKeys.length" @click="save(false)">保存配置</el-button>
      <el-button type="primary" plain :icon="DataAnalysis" :disabled="configLoading || saving || !!configError || !metricKeys.length || !selectedSkus.length" @click="save(true)">保存并分析</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="dataVisible" :title="`${ownerName} · SKU 经营分析`" width="min(1560px, 97vw)" class="ownership-dialog sku-analysis-dialog" @close="invalidateData">
    <div class="analysis-result-heading">
      <div><el-tag effect="plain" type="info">SKU 经营分析 · 非个人绩效</el-tag><p>查看当前负责 SKU 的经营历史（包含接手前数据），不受绩效首页日期筛选影响。两种分析方式的用法见“分析工具”旁的问号。</p></div>
      <el-button :icon="Setting" :disabled="dataLoading" @click="editFromData">修改分析配置</el-button>
    </div>
    <div class="analysis-result-toolbar">
      <el-radio-group v-model="period" :disabled="dataLoading" @change="changePeriod"><el-radio-button v-for="days in periods" :key="days" :label="days">{{ days === 1 ? '最新一天' : `最近 ${days} 天` }}</el-radio-button></el-radio-group>
      <div class="analysis-change-filters">
        <el-select v-model="changeMetric" clearable placeholder="指标（不限）" aria-label="涨跌筛选指标" :disabled="dataLoading" @change="changeFilterMetric">
          <el-option v-for="metric in displayMetrics" :key="metric.key" :label="metric.label" :value="metric.key" />
        </el-select>
        <el-select v-model="changeDirection" clearable placeholder="变化（不限）" aria-label="上升下降筛选" :disabled="dataLoading || !changeMetric" @change="searchData">
          <el-option label="上升" value="up" /><el-option label="下降" value="down" />
        </el-select>
        <el-tooltip placement="top" popper-class="analysis-filter-tooltip">
          <template #content><div class="analysis-filter-guide">
            <strong>如何筛出需要关注的 SKU？</strong>
            <p>先选指标，再选上升或下降，自动查询全部关注 SKU。例如“利润 + 下降”只看本期利润低于上期的商品。</p>
            <p>最新一天对比前一天；最近 N 天合计对比前 N 天合计。筛选、排序后再分页，不只筛当前页。</p>
            <p>按数值判断：利润 -10 → -20 属于下降，-20 → -10 属于上升；ACOS 下降也属于下降，方向不代表经营好坏。</p>
            <p>持平、缺日报或无有效比率不进入涨跌结果；上期为 0 且本期增加仍算上升。清除方向恢复全部，清除指标同时清除方向。</p>
            <p>指标选项来自分析配置，需要其他指标时点击“修改分析配置”。</p>
          </div></template>
          <el-button :icon="QuestionFilled" text circle aria-label="涨跌筛选操作指引" />
        </el-tooltip>
      </div>
      <el-input v-model="dataSearch" clearable :prefix-icon="Search" placeholder="筛选关注 SKU / 中文名" class="analysis-result-search" @keyup.enter="searchData" @clear="searchData" />
      <el-button :icon="Search" :loading="dataLoading" @click="searchData">查询</el-button>
    </div>
    <div v-if="dataResult" class="analysis-period-strip">
      <div><span>本期{{ period > 1 ? '合计' : '' }}</span><strong>{{ dateRange(dataResult.current_range) }}</strong></div>
      <div><span>对比期{{ period > 1 ? '合计' : '' }}</span><strong>{{ dateRange(dataResult.previous_range) }}</strong></div>
      <div><span>报表截止日 / 币种</span><strong>{{ dataResult.report_date }} · {{ dataResult.currency }}</strong></div>
    </div>
    <div class="analysis-reading-guide">
      <el-tooltip :content="analysisColorGuide" placement="top" popper-class="performance-color-tooltip"><span class="performance-color-guide" tabindex="0">本期指标参考色 <i class="is-green" />正常 <i class="is-yellow" />关注 <i class="is-red" />重点关注 <el-icon><QuestionFilled /></el-icon></span></el-tooltip>
      <span class="analysis-direction-guide">对比上期 <b class="is-up">↑ 上升</b><b class="is-down">↓ 下降</b> · 方向仅表示数值变化，不代表经营好坏</span>
    </div>
    <el-alert v-if="dataError" :title="dataError" type="error" :closable="false" show-icon />
    <el-alert v-if="dataResult?.invalid_skus.length" :title="`有 ${dataResult.invalid_skus.length} 个关注 SKU 已转交或失效，未读取其数据：${dataResult.invalid_skus.join('、')}。请修改配置。`" type="warning" :closable="false" show-icon />
    <el-alert v-if="dataResult?.incomplete_count" :title="`有 ${dataResult.incomplete_count} 个 SKU 本期或对比期缺日报；${changeDirection ? '这些 SKU 不计入当前涨跌筛选。' : '显示已记录小计，暂停涨跌计算，不将缺失当零。'}`" type="warning" :closable="false" show-icon />
    <el-table :key="tableKey" v-loading="dataLoading" :data="dataResult?.list || []" class="workbench-table analysis-result-table" stripe max-height="560" :default-sort="{ prop: sortBy, order: sortOrder === 'desc' ? 'descending' : 'ascending' }" @sort-change="changeSort">
      <el-table-column prop="seller_sku" label="SKU / 产品中文名称" min-width="190" fixed="left" sortable="custom">
        <template #header><span class="analysis-column-label" title="SKU / 产品中文名称">SKU / 产品中文名称</span></template>
        <template #default="{ row }"><el-tooltip :content="row.product_name || '未维护中文名称'" placement="top"><div class="analysis-product-name analysis-ellipsis">{{ row.product_name || '未维护中文名称' }}</div></el-tooltip><el-tooltip :content="row.seller_sku" placement="top"><div class="workbench-sku analysis-ellipsis">{{ row.seller_sku }}</div></el-tooltip></template>
      </el-table-column>
      <el-table-column v-for="metric in displayMetrics" :key="metric.key" :prop="metric.key" :label="metric.label" :min-width="metric.kind === 'quantity' ? 90 : metric.kind === 'ratio' ? 120 : 110" align="right" sortable="custom">
        <template #header><el-tooltip :content="metric.label" placement="top"><span class="analysis-column-label">{{ metric.label }}</span></el-tooltip></template>
        <template #default="{ row }"><el-tooltip :content="`${metric.label}：${formatValue(row.current.values[metric.key], metric.kind)}。${analysisMetricAttrs(row, metric).title}`" placement="top"><div class="analysis-metric-value analysis-ellipsis" :class="analysisMetricAttrs(row, metric).class">{{ formatValue(row.current.values[metric.key], metric.kind) }}</div></el-tooltip>
          <el-tooltip :content="changeTooltip(row, metric)" placement="top"><div class="analysis-change" :class="`direction-${row.changes[metric.key].direction}`">
            <el-icon v-if="row.changes[metric.key].direction === 'up'"><Top /></el-icon><el-icon v-else-if="row.changes[metric.key].direction === 'down'"><Bottom /></el-icon>
            <span class="analysis-change-text analysis-ellipsis">{{ changeText(row.changes[metric.key], metric) }}</span>
          </div></el-tooltip>
          <el-tooltip :content="`前期${metric.label}：${formatValue(row.previous.values[metric.key], metric.kind)}`" placement="top"><div class="analysis-previous analysis-ellipsis">前期 {{ formatValue(row.previous.values[metric.key], metric.kind) }}</div></el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="日报覆盖" width="105" align="center">
        <template #default="{ row }"><el-tooltip :content="coverageTooltip(row)" placement="top" popper-class="performance-range-tooltip"><div class="analysis-coverage" :class="{ partial: !row.current.complete || !row.previous.complete }">
          <span>本期 {{ row.current.recorded_days }}/{{ row.current.expected_days }} 天</span><span>前期 {{ row.previous.recorded_days }}/{{ row.previous.expected_days }} 天</span>
        </div></el-tooltip></template>
      </el-table-column>
      <el-table-column label="分析工具" width="160" align="center" fixed="right">
        <template #header><span class="analysis-tools-heading">分析工具
          <el-popover placement="bottom-end" :width="340" :trigger="['hover', 'click']" :show-after="150" :hide-after="200">
            <template #reference><el-button :icon="QuestionFilled" text circle size="small" class="analysis-tools-help" aria-label="分析工具使用说明" /></template>
            <div class="analysis-tools-guide">
              <h4>选择适合你的分析方式</h4>
              <p><strong>下载数据文件</strong><br>整理该 SKU 的经营与自动广告数据，生成 Markdown 文件。下载后，可将文件交给你常用的免费 AI 工具分析。</p>
              <p><strong>AI对话</strong><br>打开ASIN对话，按需查询经营资料，可继续讨论或生成方案。发送才计费。</p>
              <p class="analysis-tools-note">下载文件使用固定历史窗口；AI对话按问题查询资料，所选周期会准备到问题草稿中。实际查询范围可展开分析过程核对。</p>
              <p class="analysis-tools-note">请使用公司允许的 AI 工具处理业务数据；广告调整仍由你确认后操作。</p>
            </div>
          </el-popover>
        </span></template>
        <template #default="{ row }">
          <div class="analysis-tool-actions">
          <el-tooltip :content="canExport ? '下载经营与广告数据文件，可交给常用的免费 AI 工具 直接丢给他分析( 例如网页豆包，通义千问，kimi等，稍微麻烦但免费 )。' : '需要 SKU 广告分析资料导出权限，授权后刷新页面。'" placement="top">
            <span><el-button size="small" plain :icon="Download" :loading="exportingSku === row.seller_sku"
              :disabled="!canExport || dataLoading || !!exportingSku" @click="downloadMarkdown(row)">下载数据文件</el-button></span>
          </el-tooltip>
          <el-tooltip content="进入ASIN共享对话，按需查询资料；打开不计费，发送才分析。" placement="top"><span><el-button size="small" type="primary" plain :icon="ChatDotRound" :disabled="!canAi || dataLoading" @click="openChat(row)">AI对话</el-button></span></el-tooltip>
          </div>
        </template>
      </el-table-column>
      <template #empty><el-empty :description="dataLoading ? '正在读取 SKU 日报…' : dataError ? '查询未完成，请查看上方提示' : '没有匹配的有效关注 SKU'" :image-size="70" /></template>
    </el-table>
    <div class="analysis-result-footer"><span>每 SKU 一行 · 先全量排序再分页 · 箭头仅表示数值方向，不代表经营好坏</span>
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50, 100]" :total="dataResult?.total || 0" :disabled="dataLoading" layout="total,sizes,prev,pager,next" @current-change="loadData" @size-change="resizePage" />
    </div>
    <template #footer><el-button @click="dataVisible = false">关闭</el-button></template>
  </el-dialog>

  <AiConversationDialog ref="chatDialog"/>
</template>

<script setup>
import { computed, nextTick, onDeactivated, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Bottom, Check, DataAnalysis, Download, Plus, QuestionFilled, Rank, Search, Setting, Top, ChatDotRound } from '@element-plus/icons-vue'
import { exportPerformanceAnalysisMarkdown, getPerformanceAnalysisCandidates, getPerformanceAnalysisConfig, getPerformanceAnalysisData, savePerformanceAnalysisConfig } from '@/services/api.js'
import AiConversationDialog from '@/components/ai/conversation/AiConversationDialog.vue'
import { performanceColorGuide, performanceMetricAttrs } from '@/utils/performanceMetricTone.js'

defineProps({ canExport: { type: Boolean, default: false }, canAi: { type: Boolean, default: false } })

// 两个弹框共享负责人/店铺上下文，但各自有请求序号；关闭/切人后旧响应不能覆写新结果。
const base = ref({}), ownerName = ref(''), context = ref(null)
const configVisible = ref(false), configLoading = ref(false), configError = ref(''), saving = ref(false)
const selectedSkus = ref([]), metricKeys = ref([]), allMetrics = ref([]), savedVersion = ref(0), maxSelected = ref(200)
const candidateCount = ref(0), candidateTotal = ref(0), candidateRows = ref([]), previewRows = ref([]), lookup = ref({})
const candidateLoading = ref(false), candidatePage = ref(1), candidateSearch = ref(''), tagViewport = ref(null), visibleTagCount = ref(0)
const draggingMetric = ref(''), dropMetric = ref('')
const dataVisible = ref(false), dataLoading = ref(false), dataError = ref(''), dataResult = ref(null), period = ref(1), anchor = ref('')
const dataSearch = ref(''), page = ref(1), pageSize = ref(20), sortBy = ref('seller_sku'), sortOrder = ref('asc'), tableKey = ref(0)
const changeMetric = ref(''), changeDirection = ref('')
const exportingSku = ref('')
const chatDialog=ref(null)
const openChat = row => chatDialog.value?.open({...base.value,seller_sku:row.seller_sku,entry:'performance',report_date:dataResult.value?.report_date,days:period.value})
const periods = [1, 3, 7, 14, 30]
let contextVersion = 0, configVersion = 0, candidateVersion = 0, dataVersion = 0, exportVersion = 0, candidateTimer = null, tagObserver = null
const errorMessage = err => err.response?.data?.message || err.message || '操作失败'
/** 简化广告说明的展示术语；兼容旧接口/历史文案，不改变字段、数字或统计规则。 */
const simplifyAdTerms = value => String(value ?? '').replace(/广告归因/g, '广告').replace(/归因销售额/g, '广告销售额').replace(/归因订单数/g, '广告订单数').replace(/归因回补/g, '数据补充').replace(/归因修订/g, '数据更新').replace(/归因延迟/g, '数据延迟').replace(/归因成熟/g, '数据稳定').replace(/归因窗口/g, '统计窗口').replace(/归因/g, '统计')
const metricLabel = key => allMetrics.value.find(item => item.key === key)?.label || key
const displayMetrics = computed(() => metricKeys.value.map(key => allMetrics.value.find(item => item.key === key)).filter(Boolean))
const analysisColorGuide = `${performanceColorGuide}\n本期缺日报时，仅展示灰色已记录小计，暂不判断状态；其他绝对金额不设置统一颜色门槛。`
const coloredMetrics = new Set(['sku_report_profit', 'profit_margin', 'sales_qty', 'ad_cost', 'acos', 'tacos'])
/** 分析读取完整经营周期，复用指标参考色；不把残缺小计判为完整周期表现。 */
const analysisMetricAttrs = (row, metric) => {
  if (!row.current.complete) return { class: 'performance-metric performance-metric--neutral', title: `本期仅有 ${row.current.recorded_days}/${row.current.expected_days} 天日报，显示已记录小计，暂不判断经营状态。` }
  if (!coloredMetrics.has(metric.key)) return { title: '该指标不设置统一绝对金额/数量门槛，请结合下方对比变化及利润判断。' }
  return performanceMetricAttrs(metric.key, row.current.values, row.current.recorded_days)
}
const dropdownOptions = computed(() => [...new Map([...selectedSkus.value.map(sku => lookup.value[sku] || { seller_sku: sku, eligible: false }), ...candidateRows.value].map(item => [item.seller_sku, item])).values()])
const dateRange = range => range.date_from === range.date_to ? range.date_from : `${range.date_from} ～ ${range.date_to}`

/** 格式化服务端数值；无记录/零分母保留空值，不使用 Number(null) 造零。 */
const formatValue = (value, kind) => {
  if (value === null || value === undefined) return '—'
  const number = Number(value)
  if (kind === 'ratio') return `${(number * 100).toFixed(2)}%`
  return number.toLocaleString('zh-CN', { minimumFractionDigits: kind === 'quantity' ? 0 : 2, maximumFractionDigits: kind === 'quantity' ? 0 : 2 })
}

/** 数值变化来自后端。百分点直接展示；转盈/转亏或亏损变化不伪装成普通增长率。 */
const changeText = (change, metric) => {
  const labels = { incomplete: '数据不足，暂不比较', undefined: '无有效比率', flat: '持平', new: '新增', turn_profit: '转盈', turn_loss: '转亏', new_loss: '新增亏损', loss_cleared: '亏损归零', loss_narrowed: '亏损收窄', loss_expanded: '亏损扩大', negative_adjustment: '负调整变动' }
  if (change.kind === 'incomplete' || change.kind === 'undefined' || change.kind === 'flat' || change.kind === 'new') return labels[change.kind]
  if (change.point_change !== null) return `${Math.abs(Number(change.point_change)).toFixed(2)} 个百分点`
  if (change.rate !== null) return `${Math.abs(Number(change.rate) * 100).toFixed(2)}%`
  return `${labels[change.kind] || '变化'} ${formatValue(Math.abs(Number(change.delta)), metric.kind)}`
}
const coverageTooltip = row => `本期缺日报：${row.current.missing_dates.join('、') || '无'}。前期缺日报：${row.previous.missing_dates.join('、') || '无'}。缺日报只展示已记录小计，不计算涨跌。`
const changeTooltip = (row, metric) => {
  const change = row.changes[metric.key]
  return `${changeText(change, metric)}。本期 ${formatValue(row.current.values[metric.key], metric.kind)}；前期 ${formatValue(row.previous.values[metric.key], metric.kind)}。${change.kind === 'incomplete' ? coverageTooltip(row) : `差额 ${formatValue(change.delta, metric.kind)}${change.rate === null ? '' : `；相对变化 ${(Number(change.rate) * 100).toFixed(2)}%`}`}`
}

/** 停止候选搜索和标签测量，失效序号阻止已关闭弹框接收旧响应。 */
const invalidateConfig = () => {
  configVersion++; candidateVersion++; configLoading.value = false; candidateLoading.value = false
  clearMetricDrag()
  clearTimeout(candidateTimer); tagObserver?.disconnect(); tagObserver = null
}
const invalidateData = () => {
  dataVersion++; exportVersion++; dataLoading.value = false; exportingSku.value = ''

  // 不能清掉仍在途的收费请求状态；关闭窗口不等于服务器取消，直到finally完成才允许再提交。
}
const close = () => { contextVersion++; invalidateConfig(); invalidateData(); configVisible.value = false; dataVisible.value = false }

/** 冻结当前人员/店铺，而不携带绩效日期筛选；新打开默认查询最新 SKU 日报。 */
const prepare = (row, query) => {
  close(); context.value = { row: { ...row }, query: { ...query } }
  base.value = { shop_id: query.shop_id, marketplace_id: query.marketplace_id, owner_user_id: row.owner_user_id }
  ownerName.value = row.owner_name || `用户 ${row.owner_user_id}`
  configError.value = ''; dataError.value = ''; dataResult.value = null; anchor.value = ''
  changeMetric.value = ''; changeDirection.value = ''
  return contextVersion
}

/** 装载服务端配置，原已选值含失效项也保留，交给用户明确移除。 */
const applyConfig = config => {
  selectedSkus.value = [...config.selected_skus]; metricKeys.value = [...config.metric_keys]
  allMetrics.value = config.metrics.map(metric => ({...metric, label: metric.key === 'sku_report_profit' ? '利润' : simplifyAdTerms(metric.label)})); savedVersion.value = config.version; maxSelected.value = config.max_selected_skus
  candidateCount.value = config.candidate_count
  lookup.value = Object.fromEntries(config.selected_items.map(item => [item.seller_sku, item]))
}

/** 配置和第一页候选一起装载；关闭、切人或切店后丢弃整组旧响应。 */
const openConfig = async (row, query) => {
  const current = prepare(row, query), requestId = ++configVersion
  selectedSkus.value = []; metricKeys.value = []; allMetrics.value = []; lookup.value = {}; previewRows.value = []; candidateRows.value = []
  candidateCount.value = 0; candidateTotal.value = 0; visibleTagCount.value = 0; candidateSearch.value = ''; candidatePage.value = 1
  configVisible.value = true; configLoading.value = true
  try {
    const [configResponse, candidatesResponse] = await Promise.all([getPerformanceAnalysisConfig(base.value), getPerformanceAnalysisCandidates({ ...base.value, page: 1, page_size: 60 })])
    if (current !== contextVersion || requestId !== configVersion || !configVisible.value) return
    applyConfig(configResponse.data.data)
    const list = candidatesResponse.data.data
    previewRows.value = list.list; candidateRows.value = list.list; candidateTotal.value = list.total
    list.list.forEach(item => { lookup.value[item.seller_sku] = item })
    await nextTick(); observeTags()
  } catch (err) { if (current === contextVersion && requestId === configVersion) configError.value = errorMessage(err) }
  finally { if (current === contextVersion && requestId === configVersion) configLoading.value = false }
}

/** 标签只展示前三个实际换行行；被裁剪的按钮不进入键盘焦点，选择状态仍完整保存。 */
const measureTags = () => {
  const nodes = [...(tagViewport.value?.children || [])]
  const tops = [...new Set(nodes.map(node => node.offsetTop))].sort((a, b) => a - b).slice(0, 3)
  visibleTagCount.value = nodes.filter(node => tops.includes(node.offsetTop)).length
}
const observeTags = () => {
  tagObserver?.disconnect()
  if (!tagViewport.value) return
  tagObserver = new ResizeObserver(measureTags); tagObserver.observe(tagViewport.value); measureTags()
}
const removeSku = sku => { if (!saving.value) selectedSkus.value = selectedSkus.value.filter(item => item !== sku) }
const toggleSku = sku => {
  if (selectedSkus.value.includes(sku)) return removeSku(sku)
  if (selectedSkus.value.length >= maxSelected.value) return ElMessage.warning(`最多关注 ${maxSelected.value} 个 SKU`)
  selectedSkus.value = [...selectedSkus.value, sku]
}
/** 键盘备用操作与拖拽共用同一指标数组，保存格式仍保持不变。 */
const moveMetric = (index, offset) => {
  if (configLoading.value || saving.value) return
  const next = index + offset
  if (next < 0 || next >= metricKeys.value.length) return
  const list = [...metricKeys.value]; [list[index], list[next]] = [list[next], list[index]]; metricKeys.value = list
}

/** 只接收本弹框内的指标拖放，外部文本不能增加未知指标。取消拖动不会改变原顺序。 */
const clearMetricDrag = () => { draggingMetric.value = ''; dropMetric.value = '' }
const startMetricDrag = (event, key) => {
  if (configLoading.value || saving.value) { event.preventDefault(); return }
  draggingMetric.value = key
  event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key)
}
const overMetric = (event, key) => {
  if (!draggingMetric.value || configLoading.value || saving.value) return
  event.preventDefault(); event.dataTransfer.dropEffect = 'move'
  dropMetric.value = key === draggingMetric.value ? '' : key
}
const dropOnMetric = (event, key) => {
  event.preventDefault()
  const from = metricKeys.value.indexOf(draggingMetric.value), to = metricKeys.value.indexOf(key)
  if (!configLoading.value && !saving.value && from >= 0 && to >= 0 && from !== to) {
    const list = [...metricKeys.value], [moved] = list.splice(from, 1)
    list.splice(to, 0, moved); metricKeys.value = list
  }
  clearMetricDrag()
}

/** 下拉搜索与三排快捷候选独立；分页可找全候选，不会替换或清空已选择项。 */
const loadCandidates = async (append = false) => {
  const current = contextVersion, requestId = ++candidateVersion
  candidateLoading.value = true
  try {
    const response = await getPerformanceAnalysisCandidates({ ...base.value, search: candidateSearch.value, page: candidatePage.value, page_size: 60 })
    if (current !== contextVersion || requestId !== candidateVersion || !configVisible.value) return
    const list = response.data.data
    candidateRows.value = append ? [...candidateRows.value, ...list.list] : list.list; candidateTotal.value = list.total
    list.list.forEach(item => { lookup.value[item.seller_sku] = item })
  } catch (err) { if (current === contextVersion && requestId === candidateVersion) { if (append) candidatePage.value--; ElMessage.error(errorMessage(err)) } }
  finally { if (current === contextVersion && requestId === candidateVersion) candidateLoading.value = false }
}
const searchCandidates = search => {
  clearTimeout(candidateTimer); candidateVersion++; candidateSearch.value = search; candidatePage.value = 1
  // 搜索防抖期间也禁用“加载更多”，避免用户先取新搜索的第二页而漏掉第一页。
  candidateLoading.value = true; candidateRows.value = []; candidateTotal.value = 0
  candidateTimer = setTimeout(() => loadCandidates(false), 250)
}
const loadMoreCandidates = () => { if (!candidateLoading.value) { candidatePage.value++; loadCandidates(true) } }

/** 保存只发送清单/指标/版本；409 不覆盖别人配置，可重新打开配置重新校验。 */
const save = async analyzeAfter => {
  if (saving.value || !metricKeys.value.length) return
  if (selectedSkus.value.some(sku => lookup.value[sku]?.eligible === false)) return ElMessage.warning('请先移除已失效的关注 SKU')
  const current = contextVersion
  saving.value = true
  try {
    const response = await savePerformanceAnalysisConfig({ ...base.value, selected_skus: [...selectedSkus.value], metric_keys: [...metricKeys.value], version: savedVersion.value })
    if (current !== contextVersion) return
    applyConfig(response.data.data); ElMessage.success('分析配置已保存'); configVisible.value = false
    if (analyzeAfter) { period.value = 1; page.value = 1; dataSearch.value = ''; sortBy.value = 'seller_sku'; sortOrder.value = 'asc'; tableKey.value++; dataVisible.value = true; await loadData() }
  } catch (err) { if (current === contextVersion) ElMessage.error(errorMessage(err)) }
  finally { saving.value = false }
}

/** 单击默认一天；周期菜单传 N。没有关注项时转入配置，不悄悄分析全部 SKU。 */
const openData = async (row, query, days = 1) => {
  const current = prepare(row, query), requestId = ++dataVersion
  period.value = days; page.value = 1; dataSearch.value = ''; sortBy.value = 'seller_sku'; sortOrder.value = 'asc'; tableKey.value++
  dataVisible.value = true; dataLoading.value = true; allMetrics.value = []; metricKeys.value = []
  try {
    const response = await getPerformanceAnalysisConfig(base.value)
    if (current !== contextVersion || requestId !== dataVersion || !dataVisible.value) return
    applyConfig(response.data.data)
    if (!selectedSkus.value.length) { ElMessage.info('请先选择关注 SKU 并保存配置'); await openConfig(row, query); return }
    await loadData()
  } catch (err) { if (current === contextVersion && requestId === dataVersion) dataError.value = errorMessage(err) }
  finally { if (current === contextVersion && requestId === dataVersion) dataLoading.value = false }
}

/** 所有排序/分页在后端完成；分页沿用首次截止日，旧响应不可覆盖新周期。 */
const loadData = async () => {
  if (!dataVisible.value) return
  const current = contextVersion, requestId = ++dataVersion
  dataLoading.value = true; dataError.value = ''; dataResult.value = null
  try {
    const response = await getPerformanceAnalysisData({ ...base.value, period: period.value, config_version: savedVersion.value, report_date: anchor.value || undefined,
      search: dataSearch.value, change_metric: changeMetric.value || '', change_direction: changeDirection.value || '',
      page: page.value, page_size: pageSize.value, sort_by: sortBy.value, sort_order: sortOrder.value })
    if (current !== contextVersion || requestId !== dataVersion || !dataVisible.value) return
    dataResult.value = response.data.data; anchor.value = dataResult.value.report_date
  } catch (err) { if (current === contextVersion && requestId === dataVersion) dataError.value = errorMessage(err) }
  finally { if (current === contextVersion && requestId === dataVersion) dataLoading.value = false }
}
const searchData = () => { page.value = 1; loadData() }
/** 改变指标复用全量查询；清空指标时同时去掉方向，避免留下无指标的隐性筛选。 */
const changeFilterMetric = () => { if (!changeMetric.value) changeDirection.value = ''; searchData() }
const changePeriod = () => { page.value = 1; loadData() }
const resizePage = () => { page.value = 1; loadData() }
const changeSort = ({ prop, order }) => {
  // Element Plus 初次渲染会应用默认排序；此时配置仍在装载，不能抢先发起分析请求。
  if (!dataResult.value || dataLoading.value) return
  sortBy.value = order ? prop : 'seller_sku'; sortOrder.value = order === 'descending' ? 'desc' : 'asc'; page.value = 1; loadData()
}
const editFromData = () => { if (context.value) openConfig(context.value.row, context.value.query) }

/** 下载单SKU只读资料：锁定当前截止日/配置版本，不传周期/筛选，避免影响固定分析窗口。
 * 关闭/切人后旧响应不触发下载；只允许一个下载请求，失败不下载伪装成md的JSON。
 */
const downloadMarkdown = async row => {
  if (exportingSku.value || dataLoading.value || !dataResult.value) return
  const current = contextVersion, requestId = ++exportVersion
  const reportDate = dataResult.value.report_date
  exportingSku.value = row.seller_sku
  try {
    const response = await exportPerformanceAnalysisMarkdown({ ...base.value, seller_sku: row.seller_sku,
      report_date: reportDate, config_version: savedVersion.value })
    if (current !== contextVersion || requestId !== exportVersion || !dataVisible.value) return
    if (!String(response.headers['content-type'] || '').includes('text/markdown')) throw new Error('服务器未返回 Markdown 文件，请重试')
    // 优先取服务端UTF-8附件名；代理未保留该头时使用安全SKU和固定截止日。
    let filename = `${row.seller_sku.replace(/[^\w.-]/g, '_')}_经营广告分析_截至${reportDate}.md`
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(response.headers['content-disposition'] || '')
    if (encoded) { try { filename = decodeURIComponent(encoded[1]).replace(/[\\/\r\n]/g, '_') } catch { /* 保留安全默认名 */ } }
    const url = URL.createObjectURL(response.data), link = document.createElement('a')
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    ElMessage.success('数据文件已下载，可交给常用 AI 工具分析')
  } catch (err) {
    let message = errorMessage(err)
    if (err.response?.data instanceof Blob) {
      try { message = JSON.parse(await err.response.data.text()).message || message } catch { /* 非JSON错误沿用通用提示 */ }
    }
    if (current === contextVersion && requestId === exportVersion && dataVisible.value) ElMessage.error(message)
  } finally {
    if (current === contextVersion && requestId === exportVersion) exportingSku.value = ''
  }
}

onUnmounted(close)
onDeactivated(close)
defineExpose({ openConfig, openData, close })
</script>

<style scoped>
.analysis-config-body { min-height:260px; }
.analysis-section-heading { display:flex; justify-content:space-between; gap:12px; align-items:center; margin:4px 0 10px; }
.analysis-section-heading h3 { font-size:15px; color:#283d59; margin:0; }
.analysis-section-heading span,.analysis-help { font-size:12px; color:#8b98aa; line-height:1.8; }
.analysis-help { margin:8px 0 12px; }
.analysis-sku-select { width:100%; }
.analysis-option-sku { font-family:Consolas,monospace; color:#4d6892; }
.analysis-option-name { margin-left:18px; color:#8b98aa; font-size:12px; }
.analysis-candidate-tags { position:relative; display:grid; grid-template-columns:repeat(auto-fill,minmax(min(168px,100%),1fr)); gap:8px; max-height:190px; overflow:hidden; margin-top:14px; }
.analysis-sku-tag { display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:5px; min-width:0; height:58px; overflow:hidden; padding:8px 10px; border:1px solid #e0e7f2; border-radius:7px; background:#f7f9fc; color:#667992; font-size:12px; text-align:left; cursor:pointer; }
.analysis-sku-tag-code { display:flex; align-items:center; gap:5px; max-width:100%; font-family:Consolas,monospace; }
.analysis-sku-tag-code .el-icon { flex-shrink:0; }
.analysis-sku-tag-code>span,.analysis-sku-tag-name { min-width:0; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.analysis-sku-tag-name { font-size:11px; line-height:15px; color:#8b98aa; }
.analysis-sku-tag.selected .analysis-sku-tag-name { color:#7892b9; }
.analysis-sku-tag:hover { border-color:#9fbaef; color:#4679d3; }
.analysis-sku-tag.selected { background:#edf4ff; color:#3773d2; border-color:#a5c3f5; }
.analysis-sku-tag:focus-visible { outline:2px solid #568aeb; outline-offset:-2px; }
.analysis-selected-list { margin-top:10px; border-color:#edf1f6; }
.analysis-selected-list .el-tag { margin:3px 6px 3px 0; }
.analysis-metric-heading { margin-top:24px; }
.analysis-metric-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; padding:12px; border-radius:10px; border:1px solid #edf1f6; background:#fafbfd; }
.analysis-metric-options .el-checkbox { margin:0; }
.analysis-metric-order { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.analysis-order-item { display:flex; align-items:center; gap:6px; background:#f3f6fb; border:1px solid transparent; padding:7px 10px; border-radius:6px; color:#657894; font-size:12px; cursor:grab; user-select:none; transition:background .15s,border-color .15s; }
.analysis-order-item:hover { background:#edf4ff; border-color:#c7d8f5; }
.analysis-order-item.is-dragging { opacity:.45; cursor:grabbing; }
.analysis-order-item.is-drop-target { background:#e5efff; border-color:#568aeb; box-shadow:0 0 0 2px #568aeb20; }
.analysis-order-item:focus-visible { outline:2px solid #568aeb; outline-offset:2px; }
.analysis-order-item[draggable="false"] { cursor:default; }
.analysis-drag-handle { color:#94a5bc; }
.analysis-footer-note { display:block; text-align:left; font-size:12px; color:#8b98aa; margin-bottom:12px; }
.analysis-result-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
.analysis-result-heading p { color:#8b98aa; font-size:12px; line-height:1.8; margin:8px 0 16px; }
.analysis-result-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
.analysis-change-filters { display:flex; align-items:center; gap:8px; }
.analysis-change-filters .el-select { width:172px; }
.analysis-change-filters .el-select:nth-child(2) { width:120px; }
.analysis-change-filters .el-button { margin:0; color:#8b98aa; }
.analysis-filter-guide { max-width:360px; font-size:12px; line-height:1.7; }
.analysis-filter-guide strong { font-size:13px; }
.analysis-filter-guide p { margin:8px 0 0; }
.analysis-result-search { width:230px; margin-left:auto; }
.analysis-period-strip { display:flex; flex-wrap:wrap; gap:20px 40px; padding:14px 18px; background:#f4f7fc; border:1px solid #e6edf6; border-radius:10px; margin-bottom:16px; }
.analysis-period-strip div { display:flex; flex-direction:column; gap:6px; }
.analysis-period-strip span { color:#8595ac; font-size:12px; }
.analysis-period-strip strong { color:#3f597c; font-size:13px; font-weight:600; }
.analysis-reading-guide { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 18px; margin:0 0 14px; }
.analysis-direction-guide { display:inline-flex; flex-wrap:wrap; align-items:center; gap:8px; color:#78879b; font-size:12px; }
.analysis-direction-guide b { font-weight:600; }
.analysis-direction-guide .is-up { color:#15803d; }
.analysis-direction-guide .is-down { color:#dc2626; }
.analysis-product-name { color:#344b68; font-weight:600; font-size:13px; }
/* 仅压缩经营分析表；完整内容保留在悬浮说明中，不改变原始值或排序。 */
.analysis-result-table :deep(.cell) { padding-left:8px; padding-right:8px; }
.analysis-ellipsis { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.analysis-column-label { display:inline-block; max-width:calc(100% - 26px); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle; }
.analysis-metric-value { font-size:16px; font-weight:700; font-variant-numeric:tabular-nums; }
.analysis-metric-value:not(.performance-metric) { color:#2b4263; }
.analysis-change { display:inline-flex; align-items:center; gap:4px; max-width:100%; box-sizing:border-box; color:#718096; font-size:12px; font-weight:500; line-height:20px; padding:1px 6px; border-radius:5px; margin:6px 0 4px; }
.analysis-change .el-icon { font-size:14px; flex-shrink:0; }
.analysis-change.direction-up { color:#15803d; background:#edf8f0; font-weight:600; }
.analysis-change.direction-down { color:#dc2626; background:#fef0f0; font-weight:600; }
.analysis-previous { color:#9aa6b7; font-size:11px; font-variant-numeric:tabular-nums; }
.analysis-result-table .analysis-previous { color:#7e8ca0; font-size:12px; }
.analysis-coverage { display:flex; flex-direction:column; gap:4px; color:#7f91ab; font-size:12px; }
.analysis-coverage.partial { color:#af843e; }
.analysis-result-footer { display:flex; align-items:center; flex-wrap:wrap; justify-content:space-between; gap:16px; margin-top:18px; }
.analysis-result-footer>span { font-size:12px; color:#8b98aa; }
/* 工具入口纵向等宽排列，利用指标行高，避免固定右列遮挡大量数据。 */
.analysis-tool-actions { display:flex; flex-direction:column; align-items:stretch; gap:6px; width:128px; margin:0 auto; }
.analysis-tool-actions>span { display:flex; }
.analysis-tool-actions>span>.el-button { width:100%; margin:0; }
.analysis-tools-heading { display:inline-flex; align-items:center; justify-content:center; gap:5px; }
.analysis-tools-help.el-button { width:20px; height:20px; padding:0; color:#8b98aa; }
.analysis-tools-guide { font-size:13px; line-height:1.8; color:#576a84; font-weight:400; text-align:left; }
.analysis-tools-guide h4 { margin:0 0 10px; color:#344b68; font-size:14px; }
.analysis-tools-guide p { margin:10px 0; }
.analysis-tools-guide strong { color:#344b68; }
.analysis-tools-guide .analysis-tools-note { color:#8b98aa; font-size:12px; }
:deep(.el-alert) { margin-bottom:12px; }
@media(max-width:700px) { .analysis-metric-options { grid-template-columns:repeat(2,minmax(0,1fr)); }.analysis-result-search { margin-left:0; width:100%; }.analysis-result-heading { flex-wrap:wrap; }.analysis-section-heading { align-items:flex-start; } }
</style>
