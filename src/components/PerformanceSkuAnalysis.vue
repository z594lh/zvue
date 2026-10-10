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
      <p class="analysis-help">利润、退款沿用 SKU 日报；退款不再次扣除。ACOS/TACOS 按周期汇总金额计算，广告归因订单数不是全部订单数。</p>
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
      <el-table-column prop="seller_sku" label="SKU / 产品中文名称" min-width="235" fixed="left" sortable="custom">
        <template #default="{ row }"><div class="analysis-product-name">{{ row.product_name || '未维护中文名称' }}</div><div class="workbench-sku">{{ row.seller_sku }}</div></template>
      </el-table-column>
      <el-table-column v-for="metric in displayMetrics" :key="metric.key" :prop="metric.key" :label="metric.label" min-width="155" align="right" sortable="custom">
        <template #default="{ row }"><div class="analysis-metric-value" v-bind="analysisMetricAttrs(row, metric)">{{ formatValue(row.current.values[metric.key], metric.kind) }}</div>
          <el-tooltip :content="changeTooltip(row, metric)" placement="top"><div class="analysis-change" :class="`direction-${row.changes[metric.key].direction}`">
            <el-icon v-if="row.changes[metric.key].direction === 'up'"><Top /></el-icon><el-icon v-else-if="row.changes[metric.key].direction === 'down'"><Bottom /></el-icon>
            {{ changeText(row.changes[metric.key], metric) }}
          </div></el-tooltip>
          <div class="analysis-previous">前期 {{ formatValue(row.previous.values[metric.key], metric.kind) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="日报覆盖" width="160" align="center">
        <template #default="{ row }"><el-tooltip :content="coverageTooltip(row)" placement="top" popper-class="performance-range-tooltip"><div class="analysis-coverage" :class="{ partial: !row.current.complete || !row.previous.complete }">
          <span>本期 {{ row.current.recorded_days }}/{{ row.current.expected_days }} 天</span><span>前期 {{ row.previous.recorded_days }}/{{ row.previous.expected_days }} 天</span>
        </div></el-tooltip></template>
      </el-table-column>
      <el-table-column label="分析工具" width="400" align="center" fixed="right">
        <template #header><span class="analysis-tools-heading">分析工具
          <el-popover placement="bottom-end" :width="340" :trigger="['hover', 'click']" :show-after="150" :hide-after="200">
            <template #reference><el-button :icon="QuestionFilled" text circle size="small" class="analysis-tools-help" aria-label="分析工具使用说明" /></template>
            <div class="analysis-tools-guide">
              <h4>选择适合你的分析方式</h4>
              <p><strong>下载数据文件</strong><br>整理该 SKU 的经营与自动广告数据，生成 Markdown 文件。下载本身免费，可将文件交给你常用的免费 AI 工具分析。</p>
              <p><strong>AI 分析</strong><br>直接调用 DeepSeek API，自动生成经营诊断和具体调整建议，在系统内查看或下载结果。{{ aiCostHint }}</p>
              <p><strong>查看分析结果</strong><br>点击打开最近一次可查看的分析；悬浮右侧菜单可进入历史列表。成功结果保存在数据库，刷新页面后仍可查看。</p>
              <p class="analysis-tools-note">两种方式使用相同资料：最近 3 天逐日及 7 / 15 / 30 天汇总，以表格截止日为准，不随上方展示周期改变。查看、下载已有结果不再调用 API。</p>
              <p class="analysis-tools-note">请使用公司允许的 AI 工具处理业务数据；广告调整仍由你确认后操作。</p>
            </div>
          </el-popover>
        </span></template>
        <template #default="{ row }">
          <el-tooltip :content="canExport ? '下载经营与广告数据文件，可交给常用的免费 AI 工具 直接丢给他分析( 例如网页豆包，通义千问，kimi等，稍微麻烦但免费 )。' : '需要 SKU 广告分析资料导出权限，授权后刷新页面。'" placement="top">
            <span><el-button size="small" plain :icon="Download" :loading="exportingSku === row.seller_sku"
              :disabled="!canExport || dataLoading || !!exportingSku" @click="downloadMarkdown(row)">下载数据文件</el-button></span>
          </el-tooltip>
          <el-tooltip :content="canAi ? `由 DeepSeek API 生成一份新的经营建议并保存历史。${aiCostHint}` : '需要 SKU AI经营分析及广告资料导出权限，授权后刷新页面。'" placement="top">
            <span class="analysis-ai-action"><el-button size="small" type="primary" plain :icon="MagicStick" :loading="aiLoading && aiBusySku === row.seller_sku"
              :disabled="!canAi || dataLoading || !!aiBusySku || !!aiReadSku || !!exportingSku" @click="startAIAnalysis(row)">AI 分析</el-button></span>
          </el-tooltip>
          <el-dropdown split-button size="small" :icon="View" trigger="hover" class="analysis-view-action"
            :disabled="!canAi || dataLoading || !!aiBusySku || !!aiReadSku" @click="readAIResult(row)" @command="openAIHistory(row)">
            查看分析结果
            <template #dropdown><el-dropdown-menu><el-dropdown-item command="history" :icon="Clock">查看历史</el-dropdown-item></el-dropdown-menu></template>
          </el-dropdown>
        </template>
      </el-table-column>
      <template #empty><el-empty :description="dataLoading ? '正在读取 SKU 日报…' : dataError ? '查询未完成，请查看上方提示' : '没有匹配的有效关注 SKU'" :image-size="70" /></template>
    </el-table>
    <div class="analysis-result-footer"><span>每 SKU 一行 · 先全量排序再分页 · 箭头仅表示数值方向，不代表经营好坏</span>
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50, 100]" :total="dataResult?.total || 0" :disabled="dataLoading" layout="total,sizes,prev,pager,next" @current-change="loadData" @size-change="resizePage" />
    </div>
    <template #footer><el-button @click="dataVisible = false">关闭</el-button></template>
  </el-dialog>

  <el-dialog v-model="historyVisible" :title="`${historyMeta.product_name || historyMeta.seller_sku || ''} · 历史分析记录`" width="min(1180px, 96vw)" class="ownership-dialog sku-analysis-dialog" top="5vh" @close="invalidateHistory">
    <div class="analysis-history-heading"><span class="workbench-sku">{{ historyMeta.seller_sku }}</span><span>按生成时间倒序 · 仅展示当前权限可查看的记录 · 点击一行查看详情</span></div>
    <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" show-icon />
    <el-table v-loading="historyLoading" :data="historyResult.list" class="workbench-table analysis-history-table" stripe max-height="520" @row-click="openHistoryRecord">
      <el-table-column prop="id" label="记录 ID" width="90" />
      <el-table-column label="生成时间（本地）" width="180"><template #default="{ row }">{{ historyTime(row.generated_at) }}</template></el-table-column>
      <el-table-column prop="report_date" label="报表截止日" width="115" />
      <el-table-column label="操作人" width="110"><template #default="{ row }">{{ row.created_by_name || `用户 ${row.created_by}` }}</template></el-table-column>
      <el-table-column label="可信度" width="90"><template #default="{ row }"><el-tag :type="confidenceType[row.confidence]" size="small" effect="light">{{ confidenceLabel[row.confidence] }}</el-tag></template></el-table-column>
      <el-table-column label="分析结论" min-width="300"><template #default="{ row }"><div class="analysis-history-summary">{{ row.summary }}</div></template></el-table-column>
      <el-table-column label="详情" width="90" fixed="right" align="center"><template #default="{ row }"><el-button size="small" plain :icon="View" :disabled="!!aiReadSku" @click.stop="openHistoryRecord(row)">查看</el-button></template></el-table-column>
      <template #empty><el-empty :description="historyLoading ? '正在读取分析记录…' : historyError ? '读取未完成，请查看提示' : '暂无历史分析，点击“AI 分析”生成第一份建议'" :image-size="65" /></template>
    </el-table>
    <div class="analysis-result-footer"><span>查看历史不调用 AI；历史竞价及建议为生成时快照，仅用于复盘。</span>
      <el-pagination v-model:current-page="historyPage" v-model:page-size="historyPageSize" :page-sizes="[10, 20, 50]" :total="historyResult.total" :disabled="historyLoading" layout="total,sizes,prev,pager,next" @current-change="loadHistory" @size-change="resizeHistory" />
    </div>
    <template #footer><el-button @click="historyVisible = false">关闭</el-button></template>
  </el-dialog>

  <el-dialog v-model="aiVisible" :title="`${aiMeta.product_name || aiMeta.seller_sku || ''} · AI 经营建议`" width="min(1180px, 96vw)" class="ownership-dialog sku-analysis-dialog analysis-ai-dialog"
    top="4vh" :close-on-click-modal="false" @close="closeAIResult">
    <template #header="{ titleId, titleClass }"><div class="analysis-ai-titlebar">
      <span :id="titleId" :class="titleClass">{{ aiMeta.product_name || aiMeta.seller_sku || '' }} · AI 经营建议</span>
      <el-dropdown trigger="click" :disabled="!aiResult || aiLoading" @command="downloadAIResult">
        <el-button size="small" plain :icon="Download" :disabled="!aiResult || aiLoading">下载 AI 分析文档<el-icon class="analysis-download-arrow"><ArrowDown /></el-icon></el-button>
        <template #dropdown><el-dropdown-menu><el-dropdown-item command="md">Markdown（.md）</el-dropdown-item><el-dropdown-item command="txt">纯文本（.txt）</el-dropdown-item></el-dropdown-menu></template>
      </el-dropdown>
    </div></template>
    <div class="analysis-ai-heading">
      <div><span class="workbench-sku">{{ aiMeta.seller_sku }}</span><span class="analysis-ai-date">截止 {{ aiMeta.report_date }}</span></div>
      <el-tag v-if="aiResult" :type="confidenceType[aiResult.analysis.confidence]" effect="light">结论可信度：{{ confidenceLabel[aiResult.analysis.confidence] }}</el-tag>
    </div>
    <el-alert title="AI 提供经营建议，不自动修改广告。成功结果会保存到历史记录，也可下载留存；历史报价为生成时快照，请勿当作当前设置直接执行。" type="info" :closable="false" show-icon />
    <el-alert v-if="aiResult?.history_warning" :title="aiResult.history_warning" type="warning" :closable="false" show-icon />
    <div v-if="aiLoading" class="analysis-ai-loading"><el-icon class="is-loading"><Loading /></el-icon><h3>{{ aiReading ? '正在读取分析结果' : '正在分析经营数据与自动广告' }}</h3><p>{{ aiReading ? '读取已保存的结果，不调用 AI。' : '最近 3 天逐日 · 7 / 15 / 30 天汇总，请稍候，无需重复提交。' }}</p></div>
    <el-alert v-if="aiError" :title="aiError" type="error" :closable="false" show-icon />
    <div v-if="aiResult" class="analysis-ai-content">
      <section class="analysis-ai-summary"><div class="analysis-ai-section-title"><el-icon><MagicStick /></el-icon><h3>核心结论</h3></div><p>{{ aiResult.analysis.summary }}</p>
        <div class="analysis-ai-meta">{{ aiResult.model }} · 生成时间（UTC）：{{ aiResult.generated_at }}<span v-if="aiResult.history_id"> · 记录 {{ aiResult.history_id }}</span><span v-if="aiResult.usage?.total_tokens != null"> · 本次 {{ aiResult.usage.total_tokens.toLocaleString() }} tokens</span></div>
      </section>
      <section v-if="aiResult.analysis.diagnostics.length"><div class="analysis-ai-section-title"><el-icon><DataAnalysis /></el-icon><h3>诊断与依据</h3></div>
        <el-collapse v-model="expandedDiagnostics" class="analysis-ai-diagnostics"><el-collapse-item v-for="(item, index) in aiResult.analysis.diagnostics" :key="index" :name="index" :title="item.title"><p>{{ item.judgment }}</p><ul><li v-for="(evidence, i) in item.evidence" :key="i">{{ evidence }}</li></ul></el-collapse-item></el-collapse>
      </section>
      <section><div class="analysis-ai-section-title"><el-icon><DataAnalysis /></el-icon><h3>具体竞价试验方案</h3><span>人工审核 · 不自动调价</span></div>
        <h4 class="analysis-bid-subtitle">定向竞价调整</h4>
        <el-table v-if="aiResult.analysis.bid_adjustments?.length" :data="aiResult.analysis.bid_adjustments" class="workbench-table analysis-bid-table" stripe>
          <el-table-column label="作用对象" min-width="215"><template #default="{ row }"><strong>{{ row.target_name }}</strong><div class="analysis-previous">活动 {{ row.campaign_id }}<br>广告组 {{ row.ad_group_id }}<br>定向 {{ row.target_id }}</div></template></el-table-column>
          <el-table-column label="当前竞价" width="100" align="right"><template #default="{ row }">${{ formatValue(row.current_bid, 'money') }}</template></el-table-column>
          <el-table-column label="建议试验价" width="110" align="right"><template #default="{ row }"><strong>${{ formatValue(row.suggested_bid, 'money') }}</strong><div class="analysis-previous">{{ row.change_percent > 0 ? '+' : '' }}{{ row.change_percent }}%</div></template></el-table-column>
          <el-table-column prop="reason" label="依据 / 共享影响" min-width="260" />
          <el-table-column label="复查 / 停止条件" min-width="250"><template #default="{ row }"><div>{{ row.review_window }}</div><div class="analysis-bid-stop">{{ row.stop_condition }}</div></template></el-table-column>
        </el-table>
        <p v-else class="analysis-no-adjustment">本次没有可核实的定向改价建议，不代表必须调整。</p>
        <h4 class="analysis-bid-subtitle">广告位加价比例调整</h4>
        <p class="analysis-placement-hint">比例作用于整个活动及其所有 SKU；0% 为无额外加价，不是停投。请避免同时大幅修改基础竞价和广告位比例。</p>
        <el-table v-if="aiResult.analysis.placement_adjustments?.length" :data="aiResult.analysis.placement_adjustments" class="workbench-table analysis-bid-table analysis-placement-table" stripe>
          <el-table-column label="活动 / 广告位" min-width="215"><template #default="{ row }"><strong>{{ row.placement_name || placementLabel[row.placement] || row.placement }}</strong><div class="analysis-previous">活动 {{ row.campaign_id }}</div></template></el-table-column>
          <el-table-column label="当前加价" width="100" align="right"><template #default="{ row }">{{ row.current_percentage }}%</template></el-table-column>
          <el-table-column label="建议比例" width="130" align="right"><template #default="{ row }"><strong>{{ row.suggested_percentage }}%</strong><div class="analysis-previous">{{ row.change_points > 0 ? '+' : '' }}{{ row.change_points }} 个百分点</div></template></el-table-column>
          <el-table-column prop="reason" label="依据 / 活动共享影响" min-width="260" />
          <el-table-column label="复查 / 停止条件" min-width="250"><template #default="{ row }"><div>{{ row.review_window }}</div><div class="analysis-bid-stop">{{ row.stop_condition }}</div></template></el-table-column>
        </el-table>
        <p v-else class="analysis-no-adjustment">本次没有可核实的广告位比例建议；资料或样本不足时保持观察。</p>
      </section>
      <section v-if="aiBriefNotes" class="analysis-ai-notes"><div class="analysis-ai-section-title"><el-icon><WarningFilled /></el-icon><h3>简短补充</h3></div><p>{{ aiBriefNotes }}</p></section>
    </div>
    <template #footer><span class="analysis-ai-footer-note">查看和下载已有结果无需重新分析；需要更新建议时，可点击“重新分析”。</span>
      <el-button v-if="aiResult || aiError" :icon="MagicStick" :disabled="!!aiBusySku || !canAi || !dataVisible" @click="startAIAnalysis(aiMeta, true)">重新分析</el-button><el-button @click="aiVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, onDeactivated, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Bottom, Check, Clock, DataAnalysis, Download, Loading, MagicStick, Plus, QuestionFilled, Rank, Search, Setting, Top, View, WarningFilled } from '@element-plus/icons-vue'
import { analyzePerformanceSkuWithAI, exportPerformanceAnalysisMarkdown, getPerformanceAIHistory, getPerformanceAIHistoryResult, getLatestPerformanceAIResult, getPerformanceAnalysisCandidates, getPerformanceAnalysisConfig, getPerformanceAnalysisData, savePerformanceAnalysisConfig } from '@/services/api.js'
import { performanceColorGuide, performanceMetricAttrs } from '@/utils/performanceMetricTone.js'

const analysisProps = defineProps({ canExport: { type: Boolean, default: false }, canAi: { type: Boolean, default: false } })

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
const aiVisible = ref(false), aiLoading = ref(false), aiError = ref(''), aiResult = ref(null), aiMeta = ref({}), aiBusySku = ref('')
const aiReading = ref(false), aiReadSku = ref(''), historyVisible = ref(false), historyLoading = ref(false), historyError = ref(''), historyMeta = ref({})
const historyResult = ref({ list: [], total: 0 }), historyPage = ref(1), historyPageSize = ref(20)
const expandedDiagnostics = ref([])
const confidenceLabel = { high: '高', medium: '中', low: '低' }, confidenceType = { high: 'success', medium: 'warning', low: 'info' }
const placementLabel = { PLACEMENT_TOP: '搜索结果顶部（首页）', PLACEMENT_REST_OF_SEARCH: '搜索结果其余位置', PLACEMENT_PRODUCT_PAGE: '商品页面' }
// 费用由用户提供为参考值，非计价配置；不会改变API实际计费或自动发起报销。
const aiCostHint = '单次约 ¥0.05，费用后续按公司流程报销；实际费用随数据量略有变化。'
// 仅保留简短后续说明；关键资料缺口/服务端移除警告必须可见，不能因精简而隐藏。
const aiBriefNotes = computed(() => {
  const result = aiResult.value?.analysis
  if (!result) return ''
  const note = result.brief_notes || (result.action_plan || []).slice(0, 1).map(item => `${item.action}；${item.monitor}；${item.stop_condition}`).join('')
  return [...new Set([note, ...(result.data_gaps || [])].filter(Boolean))].join('；')
})
const periods = [1, 3, 7, 14, 30]
let contextVersion = 0, configVersion = 0, candidateVersion = 0, dataVersion = 0, exportVersion = 0, aiVersion = 0, aiReadVersion = 0, historyVersion = 0, candidateTimer = null, tagObserver = null
const errorMessage = err => err.response?.data?.message || err.message || '操作失败'
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
  return `本期 ${formatValue(row.current.values[metric.key], metric.kind)}；前期 ${formatValue(row.previous.values[metric.key], metric.kind)}。${change.kind === 'incomplete' ? coverageTooltip(row) : `差额 ${formatValue(change.delta, metric.kind)}${change.rate === null ? '' : `；相对变化 ${(Number(change.rate) * 100).toFixed(2)}%`}`}`
}

/** 停止候选搜索和标签测量，失效序号阻止已关闭弹框接收旧响应。 */
const invalidateConfig = () => {
  configVersion++; candidateVersion++; configLoading.value = false; candidateLoading.value = false
  clearMetricDrag()
  clearTimeout(candidateTimer); tagObserver?.disconnect(); tagObserver = null
}
const invalidateData = () => {
  dataVersion++; exportVersion++; aiVersion++; dataLoading.value = false; exportingSku.value = ''
  closeAIResult(); aiLoading.value = false; aiError.value = ''; aiResult.value = null
  historyVisible.value = false; invalidateHistory()
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
  allMetrics.value = config.metrics.map(metric => metric.key === 'sku_report_profit' ? {...metric, label: '利润'} : metric); savedVersion.value = config.version; maxSelected.value = config.max_selected_skus
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

/** 关闭结果弹框使在途只读请求失效；不取消已发送的生成请求或删除数据库记录。 */
const closeAIResult = () => {
  aiVisible.value = false; aiReadVersion++; aiReadSku.value = ''
  if (aiReading.value) { aiLoading.value = false; aiReading.value = false }
}

/** 服务端存UTC，历史列表按浏览器本地时间展示；保留原始生成时间供结果下载核查。 */
const historyTime = value => {
  if (!value) return '—'
  const raw = String(value).replace(' ', 'T'), date = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

/** 点击主按钮读取最近可查看记录；历史行传入ID读取快照，不传展示周期/配置版本。 */
const readAIResult = async (row, recordId = null) => {
  if (!analysisProps.canAi || aiBusySku.value || aiReadSku.value || !dataVisible.value) return
  // 存储故障的降级结果只保留当前窗口，允许重新打开下载；不伪装成数据库历史。
  if (recordId === null && aiResult.value?.history_saved === false && aiResult.value.seller_sku === row.seller_sku) {
    aiMeta.value = { ...row, report_date: aiResult.value.report_date }; aiError.value = ''; expandedDiagnostics.value = []; aiVisible.value = true; return
  }
  const current = contextVersion, requestId = ++aiReadVersion
  const params = { ...base.value, seller_sku: row.seller_sku }
  aiMeta.value = { ...row }; aiResult.value = null; aiError.value = ''; expandedDiagnostics.value = []
  aiReadSku.value = row.seller_sku; aiReading.value = true; aiLoading.value = true; aiVisible.value = true
  try {
    const response = recordId === null ? await getLatestPerformanceAIResult(params) : await getPerformanceAIHistoryResult(recordId, params)
    if (current !== contextVersion || requestId !== aiReadVersion || !dataVisible.value) return
    aiResult.value = response.data.data
    aiMeta.value = { seller_sku: aiResult.value.seller_sku, product_name: aiResult.value.product_name || row.product_name, report_date: aiResult.value.report_date }
  } catch (err) {
    if (current !== contextVersion || requestId !== aiReadVersion) return
    if (err.response?.status === 404) { closeAIResult(); ElMessage.info(errorMessage(err)) }
    else aiError.value = errorMessage(err)
  } finally {
    if (current === contextVersion && requestId === aiReadVersion) { aiReadSku.value = ''; aiReading.value = false; aiLoading.value = false }
  }
}

/** 关闭/切换上下文后丢弃旧列表响应；历史仅做服务端分页，不加载全部结果JSON。 */
const invalidateHistory = () => { historyVersion++; historyLoading.value = false }
const loadHistory = async () => {
  if (!historyVisible.value || !dataVisible.value) return
  const current = contextVersion, requestId = ++historyVersion
  historyLoading.value = true; historyError.value = ''
  try {
    const response = await getPerformanceAIHistory({ ...base.value, seller_sku: historyMeta.value.seller_sku, page: historyPage.value, page_size: historyPageSize.value })
    if (current !== contextVersion || requestId !== historyVersion || !historyVisible.value) return
    historyResult.value = response.data.data
  } catch (err) {
    if (current === contextVersion && requestId === historyVersion) { historyError.value = errorMessage(err); historyResult.value = { list: [], total: 0 } }
  } finally {
    if (current === contextVersion && requestId === historyVersion) historyLoading.value = false
  }
}
const openAIHistory = row => {
  if (!analysisProps.canAi || aiBusySku.value || aiReadSku.value) return
  historyMeta.value = { seller_sku: row.seller_sku, product_name: row.product_name }
  historyPage.value = 1; historyResult.value = { list: [], total: 0 }; historyVisible.value = true; loadHistory()
}
const resizeHistory = () => { historyPage.value = 1; loadHistory() }
const openHistoryRecord = row => { if (!historyLoading.value) readAIResult(historyMeta.value, row.id) }

/** 将当前已生成的AI结果导出为Markdown/纯文本；不下载输入资料、不发请求、不重新计费。
 * 折叠诊断导出时保留全部依据。Markdown对模型文本转义，避免名称/建议变成图片或HTML。
 * 旧结果兼容缺省新字段；只导出当前精简版内容，不恢复被删除的长篇行动卡片。
 */
const downloadAIResult = extension => {
  if (!aiResult.value || aiLoading.value || !['md', 'txt'].includes(extension)) return
  const result = aiResult.value, analysis = result.analysis, markdown = extension === 'md', lines = []
  const text = value => {
    const raw = String(value ?? '—').replace(/\r\n?/g, '\n')
    return markdown ? raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}[\]()#+.!|~-]/g, '\\$&') : raw
  }
  const heading = (value, level = 2) => lines.push(`${markdown ? '#'.repeat(level) + ' ' : ''}${text(value)}`, '')
  const paragraph = value => lines.push(text(value), '')
  const table = (headers, rows) => {
    // TXT采用标签化记录，长中文说明不会因制表符/换行错列；Markdown保留可阅读表格。
    if (!markdown) {
      rows.forEach(row => { row.forEach((value, index) => lines.push(`${headers[index]}：${text(value)}`)); lines.push('') })
      return
    }
    const rowLine = row => `| ${row.map(value => text(value).replace(/\n/g, '<br>')).join(' | ')} |`
    lines.push(rowLine(headers), `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map(rowLine), '')
  }
  heading(`${aiMeta.value.product_name || aiMeta.value.seller_sku} · AI 经营建议`, 1)
  paragraph(`SKU：${aiMeta.value.seller_sku}；报表截止日：${aiMeta.value.report_date}；结论可信度：${confidenceLabel[analysis.confidence]}`)
  paragraph(`模型：${result.model}；生成时间（UTC）：${result.generated_at}`)
  if (result.history_id) paragraph(`历史记录 ID：${result.history_id}`)
  paragraph('AI 建议仅供人工审核，不自动修改广告；以下为已生成结果，下载不再次调用 AI。')
  heading('核心结论'); paragraph(analysis.summary)
  if (analysis.diagnostics?.length) {
    heading('诊断与依据')
    analysis.diagnostics.forEach(item => {
      heading(item.title, 3); paragraph(item.judgment)
      item.evidence.forEach(value => lines.push(`${markdown ? '- ' : '依据：'}${text(value)}`)); lines.push('')
    })
  }
  heading('具体竞价试验方案')
  heading('定向竞价调整', 3)
  if (analysis.bid_adjustments?.length) table(['活动 / 广告组 / 定向', '当前竞价', '建议试验价', '变化', '依据 / 共享影响', '复查', '停止条件'],
    analysis.bid_adjustments.map(row => [`${row.campaign_id} / ${row.ad_group_id} / ${row.target_name}（${row.target_id}）`, `$${formatValue(row.current_bid, 'money')}`, `$${formatValue(row.suggested_bid, 'money')}`, `${row.change_percent > 0 ? '+' : ''}${row.change_percent}%`, row.reason, row.review_window, row.stop_condition]))
  else paragraph('本次没有可核实的定向改价建议，不代表必须调整。')
  heading('广告位加价比例调整', 3)
  paragraph('比例作用于整个活动及所有 SKU；0% 为无额外加价，不是停投。避免同时大幅修改基础竞价和广告位比例。')
  if (analysis.placement_adjustments?.length) table(['活动 / 广告位', '当前加价', '建议比例', '变化', '依据 / 活动共享影响', '复查', '停止条件'],
    analysis.placement_adjustments.map(row => [`${row.campaign_id} / ${row.placement_name || placementLabel[row.placement] || row.placement}`, `${row.current_percentage}%`, `${row.suggested_percentage}%`, `${row.change_points > 0 ? '+' : ''}${row.change_points} 个百分点`, row.reason, row.review_window, row.stop_condition]))
  else paragraph('本次没有可核实的广告位比例建议；资料或样本不足时保持观察。')
  if (aiBriefNotes.value) { heading('简短补充'); paragraph(aiBriefNotes.value) }
  const blob = new Blob([lines.join('\n')], { type: `${markdown ? 'text/markdown' : 'text/plain'};charset=utf-8` })
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  const sku = String(aiMeta.value.seller_sku || 'SKU').replace(/[^\w.-]/g, '_').slice(0, 100)
  link.href = url; link.download = `${sku}_AI经营建议_截至${aiMeta.value.report_date}${result.history_id ? `_记录${result.history_id}` : ''}.${extension}`
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000)
  ElMessage.success('AI 分析文档已保存，可随时查看')
}

/** 人工确认才发送收费POST，资料在服务端生成，不上传名称/原文/任意模型。
 * 每次生成均需确认，成功结果由服务端持久化；查看入口独立GET，不再隐式依赖内存缓存。
 * 全程阻止二次点击，关闭/切人后旧结果不可覆写或弹回，新请求不自动重试。
 */
const startAIAnalysis = async (row, force = false) => {
  if (!analysisProps.canAi || aiBusySku.value || aiReadSku.value || dataLoading.value || !dataResult.value) return
  const meta = { seller_sku: row.seller_sku, product_name: row.product_name, report_date: dataResult.value.report_date }
  const current = contextVersion, requestId = ++aiVersion
  const params = { ...base.value, seller_sku: row.seller_sku, report_date: meta.report_date, config_version: savedVersion.value, confirm_ai: true }
  aiBusySku.value = row.seller_sku
  let sent = false
  try {
    await ElMessageBox.confirm(`使用 DeepSeek 分析 ${row.seller_sku} 截至 ${meta.report_date} 的经营与自动广告数据，生成优化建议。${aiCostHint}建议仅供参考，不会自动调整广告。`, force ? '更新 AI 分析' : '开始 AI 分析', { type: 'info', confirmButtonText: force ? '重新分析' : '开始分析', cancelButtonText: '取消', closeOnClickModal: false })
    if (current !== contextVersion || requestId !== aiVersion || !dataVisible.value) return
    aiMeta.value = meta; aiResult.value = null; aiError.value = ''; expandedDiagnostics.value = []; aiLoading.value = true; aiVisible.value = true
    sent = true
    const response = await analyzePerformanceSkuWithAI(params)
    if (current !== contextVersion || requestId !== aiVersion || !dataVisible.value) return
    aiResult.value = response.data.data
    if (historyVisible.value && historyMeta.value.seller_sku === row.seller_sku) { historyPage.value = 1; loadHistory() }
    if (!aiVisible.value) ElMessage.success(aiResult.value.history_saved === false ? 'AI 分析已完成，但未能保存历史，请保持当前窗口并下载结果' : 'AI 分析已完成并保存，可点击“查看分析结果”查看')
  } catch (err) {
    if (!sent || current !== contextVersion || requestId !== aiVersion) return
    // 失败仍保留具体原因和手动重试说明；费用在工具指引/确认中说明，不重复警示。
    aiError.value = err.response ? errorMessage(err).replace(/；(?:本次请求|AI请求|请求)可能已计费(?:，重试前请确认)?/g, '').replace(/，未自动重试/g, '，可稍后手动重试')
      : 'AI 分析暂未完成，请检查网络后再试。系统没有自动重复提交请求。'
    if (!aiVisible.value) ElMessage.error(aiError.value)
  } finally {
    // 同一组件至多一个在途AI请求；切上下文也要在请求完成后解除收费防重复。
    aiBusySku.value = ''
    if (current === contextVersion && requestId === aiVersion) aiLoading.value = false
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
.analysis-metric-value { font-size:16px; font-weight:700; font-variant-numeric:tabular-nums; }
.analysis-metric-value:not(.performance-metric) { color:#2b4263; }
.analysis-change { display:inline-flex; align-items:center; gap:4px; color:#718096; font-size:12px; font-weight:500; line-height:20px; padding:1px 7px; border-radius:5px; margin:6px 0 4px; }
.analysis-change .el-icon { font-size:14px; }
.analysis-change.direction-up { color:#15803d; background:#edf8f0; font-weight:600; }
.analysis-change.direction-down { color:#dc2626; background:#fef0f0; font-weight:600; }
.analysis-previous { color:#9aa6b7; font-size:11px; font-variant-numeric:tabular-nums; }
.analysis-result-table .analysis-previous { color:#7e8ca0; font-size:12px; }
.analysis-coverage { display:flex; flex-direction:column; gap:4px; color:#7f91ab; font-size:12px; }
.analysis-coverage.partial { color:#af843e; }
.analysis-result-footer { display:flex; align-items:center; flex-wrap:wrap; justify-content:space-between; gap:16px; margin-top:18px; }
.analysis-result-footer>span { font-size:12px; color:#8b98aa; }
.analysis-ai-action { margin-left:8px; }
.analysis-view-action { margin-left:8px; vertical-align:middle; }
.analysis-history-heading { display:flex; align-items:center; flex-wrap:wrap; gap:18px; margin-bottom:16px; }
.analysis-history-heading>span:last-child { color:#8b98aa; font-size:12px; }
.analysis-history-summary { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.8; color:#576a84; }
.analysis-history-table :deep(.el-table__row) { cursor:pointer; }
.analysis-tools-heading { display:inline-flex; align-items:center; justify-content:center; gap:5px; }
.analysis-tools-help.el-button { width:20px; height:20px; padding:0; color:#8b98aa; }
.analysis-tools-guide { font-size:13px; line-height:1.8; color:#576a84; font-weight:400; text-align:left; }
.analysis-tools-guide h4 { margin:0 0 10px; color:#344b68; font-size:14px; }
.analysis-tools-guide p { margin:10px 0; }
.analysis-tools-guide strong { color:#344b68; }
.analysis-tools-guide .analysis-tools-note { color:#8b98aa; font-size:12px; }
.analysis-ai-titlebar { display:flex; align-items:center; flex-wrap:wrap; gap:12px; padding-right:20px; }
.analysis-ai-titlebar>.el-dialog__title { min-width:0; overflow-wrap:anywhere; }
.analysis-download-arrow { margin-left:6px; }
.analysis-ai-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:14px; }
.analysis-ai-date { margin-left:18px; font-size:12px; color:#8897ac; }
.analysis-ai-loading { padding:42px 16px; text-align:center; color:#758ba9; }
.analysis-ai-loading>.el-icon { font-size:28px; color:#5484df; }
.analysis-ai-loading h3 { font-size:16px; margin:14px 0 8px; color:#405878; }
.analysis-ai-loading p { font-size:12px; }
.analysis-ai-content { padding-right:6px; }
.analysis-ai-content>section { margin:22px 0; }
.analysis-ai-section-title { display:flex; align-items:center; gap:8px; color:#4974b8; margin-bottom:12px; }
.analysis-ai-section-title h3 { margin:0; font-size:15px; color:#344b68; }
.analysis-ai-section-title>span { margin-left:auto; color:#8b98aa; font-size:12px; }
.analysis-ai-summary { background:#f1f6ff; border:1px solid #dfebfd; border-radius:10px; padding:18px; }
.analysis-ai-content p,.analysis-ai-content li,.analysis-ai-content dd { font-size:13px; color:#576a84; line-height:1.9; white-space:pre-line; overflow-wrap:anywhere; }
.analysis-ai-summary p { font-size:14px; color:#344b68; }
.analysis-ai-meta { color:#8b98aa; font-size:11px; }
.analysis-ai-diagnostics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; align-items:start; border:0; }
.analysis-ai-diagnostics :deep(.el-collapse-item) { border:1px solid #e6edf5; background:#fafcfe; border-radius:8px; overflow:hidden; }
.analysis-ai-diagnostics :deep(.el-collapse-item__header) { height:auto; min-height:48px; padding:12px 16px; background:transparent; color:#344b68; font-size:14px; font-weight:600; line-height:1.6; border:0; overflow-wrap:anywhere; }
.analysis-ai-diagnostics :deep(.el-collapse-item__wrap) { background:transparent; border:0; }
.analysis-ai-diagnostics :deep(.el-collapse-item__content) { padding:0 16px 14px; }
.analysis-ai-diagnostics p { margin-top:0; }
.analysis-ai-content h4 { margin:0; font-size:14px; color:#344b68; overflow-wrap:anywhere; }
.analysis-ai-content ul { margin:8px 0 0; padding-left:20px; }
.analysis-ai-content .analysis-bid-subtitle { margin:18px 0 10px; font-size:13px; }
.analysis-ai-content .analysis-placement-hint,.analysis-ai-content .analysis-no-adjustment { font-size:12px; color:#8b98aa; }
.analysis-bid-table :deep(.cell) { white-space:normal; overflow-wrap:anywhere; line-height:1.8; }
.analysis-bid-stop { margin-top:8px; color:#9b783e; }
.analysis-ai-notes { padding:14px 16px; border-radius:8px; border:1px solid #f0e3c6; background:#fffbf2; }
.analysis-ai-notes p { margin:0; }
.analysis-ai-footer-note { display:block; text-align:left; color:#8b98aa; font-size:12px; margin-bottom:10px; }
:deep(.el-alert) { margin-bottom:12px; }
@media(max-width:700px) { .analysis-ai-diagnostics { grid-template-columns:1fr; } }
@media(max-width:700px) { .analysis-metric-options { grid-template-columns:repeat(2,minmax(0,1fr)); }.analysis-result-search { margin-left:0; width:100%; }.analysis-result-heading { flex-wrap:wrap; }.analysis-section-heading { align-items:flex-start; } }
</style>

<style>
/* AI建议可能较长：只滚动正文，始终保留标题、关闭及重新分析按钮。 */
.analysis-ai-dialog.el-dialog { max-height:92vh; display:flex; flex-direction:column; }
.analysis-ai-dialog .el-dialog__header,.analysis-ai-dialog .el-dialog__footer { flex-shrink:0; }
.analysis-ai-dialog .el-dialog__body { min-height:0; overflow:auto; }
</style>
