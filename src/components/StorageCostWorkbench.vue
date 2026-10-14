<template>
  <section class="cost-workbench">
    <el-alert v-if="data.schema_ready === false" type="warning" :closable="false" show-icon title="分析资料表尚未初始化。现有月费可查看，库龄/超龄资料需先执行本次上线SQL。" />
    <div class="cost-toolbar">
      <el-date-picker v-model="query.month" type="month" value-format="YYYY-MM" placeholder="最新计费月" style="width:150px" @change="search" />
      <el-input v-model="query.search" clearable placeholder="SKU / 中文名" style="width:200px" @keyup.enter="search" @clear="search" />
      <el-select v-model="query.risk" clearable placeholder="关注原因" style="width:165px" @change="search">
        <el-option v-for="item in risks" :key="item[0]" :value="item[0]" :label="item[1]">
          <el-tooltip :content="riskTip(item[0])" placement="right" :fallback-placements="['left', 'top', 'bottom']" :show-after="250" :hide-after="0" :popper-style="riskTipStyle">
            <span class="risk-option"><span>{{ item[1] }}</span><el-icon class="help" aria-hidden="true"><QuestionFilled /></el-icon></span>
          </el-tooltip>
        </el-option>
      </el-select>
      <el-select v-model="query.country_code" clearable placeholder="国家" style="width:100px" @change="search"><el-option v-for="item in data.countries || []" :key="item" :value="item" :label="item || '未标明'" /></el-select>
      <el-select v-model="query.currency" clearable placeholder="币种" style="width:100px" @change="search"><el-option v-for="item in data.currencies || []" :key="item" :value="item" :label="item || '未标明'" /></el-select>
      <el-button @click="fetchRows">刷新</el-button>
      <el-tooltip :content="data.rules || '关注标签为运营参考，不是Amazon收费门槛'" placement="top"><el-icon class="help"><QuestionFilled /></el-icon></el-tooltip>
      <el-button class="source-button" type="primary" plain :disabled="!shopId || !data.can_sync || data.schema_ready === false" @click="syncVisible = true">补齐仓储报告</el-button>
    </div>
    <div class="cost-scope">
      <span>历史费用月 <strong>{{ data.month || '—' }}</strong> · 对比 {{ data.prior_month || '—' }}</span>
      <span>当前库存快照 <strong>{{ data.sources?.find(item => item.kind === 'health')?.snapshot_date || '未获取' }}</strong></span>
      <span v-for="item in data.totals || []" :key="`${item.country_code}-${item.currency}`">{{ item.country_code || '未标国家' }} · {{ item.currency || '未标币种' }} 全店月度净费 <strong>{{ amount(item.net_fee) }}</strong><span v-if="item.net_fee == null && item.unknown_amount_groups">（已知小计 {{ amount(item.known_net_fee) }}，{{ item.unknown_amount_groups }}组金额待核对）</span></span>
      <span>关注 SKU / 国家 / 币种组合 {{ data.risk_count || 0 }} 个</span>
    </div>
    <div class="source-status">
      <span>资料状态：</span><span v-for="kind in ['monthly', 'health', 'aged', 'overage']" :key="kind" :title="sourceText(kind)">{{ kindNames[kind] }}：{{ sourceText(kind) }}</span>
    </div>
    <details class="report-coverage"><summary>查看报告覆盖情况（4类来源）及店铺超量费</summary>
      <el-table :data="data.report_coverage || []" size="small">
        <el-table-column prop="label" label="报告" min-width="170" /><el-table-column prop="scope" label="时间 / 粒度" min-width="180" />
        <el-table-column label="获取状态" min-width="130"><template #default="{row}">{{ statusLabel(row.attempt_status) }}<div class="secondary">{{ row.attempt_message }}</div></template></el-table-column>
        <el-table-column prop="row_count" label="成功原行数" width="110" /><el-table-column prop="field_count" label="已保留字段数" width="110" />
        <el-table-column label="需核对" min-width="160"><template #default="{row}"><div v-if="row.ambiguous_groups">{{ row.ambiguous_groups }}组重复身份，原行完整保留</div><div v-if="row.component_mismatch_rows">{{ row.component_mismatch_rows }}行拆分与月费总额不一致</div><span v-if="!row.ambiguous_groups && !row.component_mismatch_rows">—</span></template></el-table-column>
      </el-table>
      <p class="scope-note">完整月报用于工作台，历史月表/年度图仍沿用原同步数据。基础费和仓储利用率附加费是月报拆分，不再次加回净费；长期/超龄费与仓储超量费是其他报告。取消/缺报告均不代表0收费。</p>
      <el-table v-if="data.overage_rows?.length" :data="data.overage_rows.slice((overagePage-1)*20,overagePage*20)" size="small">
        <el-table-column prop="charge_date" label="日期" width="105" /><el-table-column prop="country_code" label="国家" width="70" /><el-table-column prop="storage_type" label="存储类型" />
        <el-table-column label="使用 / 限额 / 超量体积"><template #default="{row}">{{ number(row.usage_volume) }} / {{ number(row.limit_volume) }} / {{ number(row.overage_volume) }} {{ row.volume_units }}</template></el-table-column>
        <el-table-column label="报告列示超量费"><template #default="{row}">{{ amount(row.amount) }} {{ row.currency }}</template></el-table-column>
      </el-table>
      <el-pagination v-if="data.overage_rows?.length" v-model:current-page="overagePage" :page-size="20" :total="data.overage_rows.length" layout="total, prev, pager, next" />
      <p class="scope-note">仓储超量费按店铺/存储类型统计，没有SKU或仓库明细，不按比例分摊给SKU，也不混入已收超龄费。</p>
    </details>
    <p class="scope-note">由服务器计划任务每日更新库存健康及最近两个完整月份的费用报告；本页只展示已保存数据，点“刷新”不会调用Amazon。手动“补齐仓储报告”可更新其他月份。工作台优先完整月报，历史月表/年度图沿用原同步。“—”为未知，不是0；历史费用与当前库存分开看。</p>
    <el-table :data="data.list || []" v-loading="loading" class="cost-table" @sort-change="sortChanged" :default-sort="{prop:'priority', order:'descending'}">
      <el-table-column label="SKU / 中文名" min-width="220"><template #default="{ row }"><strong class="sku-name" :title="row.product_name">{{ row.product_name || '未匹配名称' }}</strong><div class="sku-code">{{ row.identifier_type === 'fnsku' ? 'FNSKU：' : '' }}{{ row.seller_sku }}</div><div v-if="row.identifier_type === 'fnsku'" class="secondary">尚未唯一匹配SKU</div><div v-if="row.top_warehouse" class="secondary">主要费用仓库 {{ row.top_warehouse.code }} · {{ amount(row.top_warehouse.net_fee) }}</div></template></el-table-column>
      <el-table-column label="国家 / 币种" width="95"><template #default="{ row }">{{ row.country_code || '未知' }} · {{ row.currency || '未知' }}</template></el-table-column>
      <el-table-column label="月度净仓储费" prop="net_fee" sortable="custom" width="155" align="right"><template #default="{ row }"><strong :class="row.priority ? 'cost-warning' : ''">{{ amount(row.net_fee) }}</strong><div v-if="row.net_fee == null && row.known_net_fee != null" class="secondary">已知小计 {{ amount(row.known_net_fee) }}</div><div class="secondary">上月 {{ amount(row.prior_net_fee) }}</div><div v-if="row.fee_source" class="secondary" :title="`本期：${row.fee_source}；上期：${row.prior_fee_source || '未知'}`">{{ row.fee_source }}</div><el-tooltip v-if="row.utilization_fee != null" content="月报拆分列，不重复加回月费；与超龄附加费不同"><div :class="Number(row.utilization_fee)>0 ? 'cost-warning' : 'secondary'">利用率附加费 {{ amount(row.utilization_fee) }}</div></el-tooltip></template></el-table-column>
      <el-table-column label="较上月变化" prop="change" sortable="custom" width="145" align="right"><template #default="{ row }"><span :class="changeClass(row.change)">{{ changeText(row.change) }}</span><div class="secondary">{{ row.change.percent == null ? '无有效百分比' : `${signed(row.change.percent)}%` }}</div></template></el-table-column>
      <el-table-column label="已收超龄费" prop="aged_fee" sortable="custom" width="135" align="right"><template #default="{ row }"><strong :class="Number(row.aged_fee) > 0 ? 'cost-danger' : ''">{{ amount(row.aged_fee) }}</strong></template></el-table-column>
      <el-table-column label="全店净费占比" width="115" align="right"><template #default="{ row }">{{ row.share_percent == null ? '—' : `${Number(row.share_percent).toFixed(1)}%` }}</template></el-table-column>
      <el-table-column label="当前库存 / 消化" prop="days_of_supply" sortable="custom" width="180"><template #default="{ row }">
        <template v-if="row.health"><div :class="!row.health.fresh ? 'secondary' : ''">可售 <strong>{{ number(row.health.available) }}</strong> · 30天销量 {{ number(row.health.sales_30d) }}</div><div :class="stockClass(row.health)">{{ supplyText(row.health) }}</div><div class="secondary">快照 {{ row.health.snapshot_date }}{{ row.health.fresh ? '' : ' · 已过期' }}</div></template>
        <span v-else class="secondary">{{ healthMissing(row) }}</span>
      </template></el-table-column>
      <el-table-column label="库龄 / 积压" prop="aged_quantity" sortable="custom" width="175"><template #default="{ row }">
        <template v-if="row.health"><div :class="row.health.age_fresh && Number(row.health.aged_quantity) > 0 ? 'cost-warning' : 'secondary'">{{ oldStockText(row.health) }}</div><div v-if="row.health.excess_quantity != null" :class="row.health.fresh && Number(row.health.excess_quantity) > 0 ? 'cost-warning' : 'secondary'">预计冗余 {{ number(row.health.excess_quantity) }} 件</div><div class="secondary">库龄 {{ row.health.age_snapshot_date || '日期未知' }}{{ row.health.age_snapshot_date && !row.health.age_fresh ? ' · 已过期' : '' }}</div></template>
        <span v-else class="secondary">库龄待核实</span>
      </template></el-table-column>
      <el-table-column label="关注原因" prop="priority" sortable="custom" min-width="200">
        <template #header><span>关注原因 </span><el-tooltip :content="riskGuide" :popper-style="riskTipStyle" placement="top"><el-icon class="help" tabindex="0" aria-label="关注原因使用说明" @click.stop><QuestionFilled /></el-icon></el-tooltip></template>
        <template #default="{ row }"><div class="risk-tags">
          <el-tooltip v-for="tag in row.tags" :key="tag.code" :content="riskTip(tag.code, tag.label)" :popper-style="riskTipStyle" :show-after="200" :hide-after="0" placement="top">
            <el-tag :type="tag.tone" size="small" class="risk-tag" tabindex="0">{{ tag.label }}</el-tag>
          </el-tooltip>
          <span v-if="!row.tags.length" class="secondary">未触发关注，非无风险</span>
        </div><div v-if="row.health_status && row.health_status !== 'fresh'" class="secondary">{{ row.health_status === 'stale' ? '库存快照过期，当前风险待更新' : '库存资料不全，风险待核实' }}</div></template>
      </el-table-column>
      <el-table-column label="操作" width="75" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openDetail(row)">详情</el-button></template></el-table-column>
    </el-table>
    <div class="cost-pagination"><el-pagination v-model:current-page="query.page" v-model:page-size="query.page_size" :total="data.total || 0" :page-sizes="[20,50,100]" layout="total, sizes, prev, pager, next" @change="fetchRows" /></div>

    <el-drawer v-model="detailVisible" :title="`${detail?.sku?.product_name || detailQuery.seller_sku || ''} · 仓储成本详情`" size="min(1100px, 96vw)" destroy-on-close>
      <div v-loading="detailLoading">
        <template v-if="detail">
          <div class="detail-overview"><strong>{{ detailQuery.seller_sku }}</strong> · {{ detailQuery.country_code }} · {{ detailQuery.currency }} · 计费 {{ detail.month }}<p>{{ detail.overview }}</p><ul v-if="detail.suggestions?.length"><li v-for="tip in detail.suggestions" :key="tip">{{ tip }}</li></ul></div>
          <p class="scope-note">{{ detail.note }}</p>
          <p v-if="detail.sku.fee_source" class="scope-note">月费来源：{{ detail.sku.fee_source }} · 上期：{{ detail.sku.prior_fee_source }}。基础费 {{ amount(detail.sku.base_fee) }} / 利用率附加费 {{ amount(detail.sku.utilization_fee) }} {{ detailQuery.currency }}；拆分不重复叠加，利用率附加费不等于超龄费。</p>
          <el-alert v-if="detail.sku.ambiguous_fee_rows" type="warning" :closable="false" :title="`${detail.sku.ambiguous_fee_rows}组月费记录存在重复业务身份，原行已完整保留；不能确认的非零费用和库存不累加、不补0，请核对下方完整报告。`" />
          <el-alert v-if="detail.sku.component_difference != null && Number(detail.sku.component_difference) !== 0" type="warning" :closable="false" :title="`报告月费与基础费＋利用率附加费之和相差 ${amount(detail.sku.component_difference)} ${detailQuery.currency}，原因尚未核实。按月费原总额对账，差额不当作新增收费。`" />
          <div class="detail-title"><h3>仓库月度费用排名（{{ detail.warehouses.length }} 个，每页10个）</h3><el-button size="small" @click="loadDetail">刷新详情</el-button></div>
          <el-table :data="detail.warehouses.slice((warehousePage-1)*10,warehousePage*10)" size="small">
            <el-table-column prop="warehouse" label="仓库" width="85" />
            <el-table-column label="月均库存" width="105" align="right"><template #default="{row}">{{ number(row.average_quantity) }}</template></el-table-column>
            <el-table-column label="净仓储费" width="115" align="right"><template #default="{row}"><strong>{{ amount(row.net_fee) }}</strong></template></el-table-column>
            <el-table-column label="SKU费用占比" width="110" align="right"><template #default="{row}">{{ row.share_percent == null ? '—' : `${Number(row.share_percent).toFixed(1)}%` }}</template></el-table-column>
            <el-table-column label="单件月费" width="110" align="right"><template #default="{row}">{{ amount(row.unit_monthly_fee) }}</template></el-table-column>
            <el-table-column label="较上月" min-width="130" align="right"><template #default="{row}"><span :class="changeClass(row.change)">{{ changeText(row.change) }}</span></template></el-table-column>
            <el-table-column label="基础费 / 利用率附加费" min-width="175" align="right"><template #default="{row}">{{ amount(row.base_fee) }} / {{ amount(row.utilization_fee) }}</template></el-table-column>
          </el-table>
          <el-pagination v-model:current-page="warehousePage" :page-size="10" :total="detail.warehouses.length" layout="total, prev, pager, next" />
          <p class="scope-note">单件月费 = 同月净仓储费 ÷ 同月月均库存，不是实际单件收费标准。拆分缺失或与原月费快照金额不一致时不展示；基础费与附加费不再叠加计入净额。</p>

          <h3>当前库存与库龄</h3>
          <template v-if="detail.sku.health">
            <div class="health-summary">库存快照 {{ detail.sku.health.snapshot_date }} <el-tag v-if="!detail.sku.health.fresh" type="warning" size="small">超过7天，仅供参考</el-tag> · 可售 {{ number(detail.sku.health.available) }} 件 · 近30天销量 {{ number(detail.sku.health.sales_30d) }} 件 · <span :class="stockClass(detail.sku.health)">{{ supplyText(detail.sku.health) }}</span></div>
            <div class="health-summary">预计冗余 {{ number(detail.sku.health.excess_quantity) }} 件 · 待移除 {{ number(detail.sku.health.pending_removal) }} 件 · 不可售 {{ number(detail.sku.health.unfulfillable) }} 件 · 在途 {{ number(detail.sku.health.inbound_quantity) }} 件</div>
            <p class="scope-note">预计消化天数 = 可售库存 ÷ 近30天日均销量，是静态参考，不是清仓期限；近30天销量为报告中的发货件数。预计冗余为Amazon报告建议，不直接执行补货或移除。</p>
            <div class="health-summary">库龄快照 <strong>{{ detail.sku.health.age_snapshot_date || '日期未知' }}</strong> <el-tag v-if="!detail.sku.health.age_fresh" type="warning" size="small">日期未知或超过7天，仅供参考</el-tag> · <span :class="detail.sku.health.age_fresh && Number(detail.sku.health.aged_quantity) > 0 ? 'cost-warning' : ''">{{ oldStockText(detail.sku.health) }}</span></div>
            <div class="age-buckets"><el-tag v-for="(bucket,index) in detail.sku.health.age_buckets" :key="index" type="info">{{ bucket.tier }} 天：{{ number(bucket.quantity) }} 件</el-tag></div>
            <p class="scope-note">库龄按原分档展示，部分档位重叠。180天以上汇总只用不重叠档位；缺档显示“至少”，不是完整总量。180/365天仅作运营筛查，不代表当地实际收费门槛。</p>
            <h4>预计超龄费用（不是已收费）</h4>
            <el-table :data="detail.sku.health.estimated_aged" size="small"><el-table-column prop="tier" label="库龄档位" /><el-table-column label="预计收费数量"><template #default="{row}">{{ number(row.quantity) }}</template></el-table-column><el-table-column label="预计金额"><template #default="{row}">{{ amount(row.amount) }} {{ detail.sku.health.currency || '未标币种' }}</template></el-table-column></el-table>
          </template>
          <p v-else class="empty-note">未获取可唯一匹配的健康快照，无法判断库龄或滞销；不是库存为0。请更新库龄资料。</p>
          <details v-if="detail.health_report_rows?.length" class="raw-records"><summary>查看库存健康完整原字段 / 多库存身份</summary><div v-for="(item,index) in detail.health_report_rows" :key="index"><strong>{{ item.fnsku }} · 报告快照 {{ item.snapshot_date }}</strong><div class="original-fields"><div v-for="(value,key) in item.report_fields" :key="key"><strong>{{ key }}</strong>：{{ value || '—' }}</div></div></div></details>
          <h3>已收超龄附加费 · {{ detail.month }}</h3>
          <el-table v-if="detail.aged_rows.length" :data="detail.aged_rows" size="small"><el-table-column prop="charge_date" label="收费快照日期" /><el-table-column prop="tier" label="库龄档位" /><el-table-column label="收费数量"><template #default="{row}">{{ number(row.quantity) }}</template></el-table-column><el-table-column label="已收金额"><template #default="{row}">{{ amount(row.amount) }} {{ detailQuery.currency }}</template></el-table-column></el-table>
          <p v-else class="empty-note">本月未获取该SKU的超龄收费记录，不按0收费处理；查看资料状态确认报告是否可用。</p>
          <details v-if="detail.monthly_report_rows?.length" class="raw-records"><summary>完整月费报告原行及费率（{{ detail.monthly_report_rows.length }} 条）</summary>
            <p class="scope-note">以下为报告原行，重复身份会标出；不要直接累加疑似重复金额。点“全部字段”可查看该行完整业务字段。</p>
            <el-table :data="detail.monthly_report_rows.slice((reportPage-1)*10,reportPage*10)" size="small">
              <el-table-column prop="warehouse" label="仓库" width="75" /><el-table-column label="原月均库存" width="105"><template #default="{row}">{{ number(row.average_quantity) }}</template></el-table-column>
              <el-table-column label="基础费 / 利用率附加费" min-width="180"><template #default="{row}">{{ amount(row.base_fee) }} / {{ amount(row.utilization_fee) }}<div v-if="row.component_difference != null && Number(row.component_difference)!==0" class="cost-warning">与月费差额 {{ amount(row.component_difference) }}</div></template></el-table-column>
              <el-table-column label="利用率 / 费率" min-width="155"><template #default="{row}">{{ number(row.utilization_ratio) }} {{ row.utilization_ratio_units }} / {{ amount(row.utilization_rate) }}</template></el-table-column>
              <el-table-column label="金额 / 抵扣" min-width="140"><template #default="{row}">{{ amount(row.storage_fee) }} / {{ amount(row.incentive_fee) }}</template></el-table-column>
              <el-table-column label="原字段" width="110"><template #default="{row}"><el-popover trigger="click" placement="left" width="430"><template #reference><el-button link type="primary">全部字段</el-button></template><div class="original-fields"><div v-for="(value,key) in row.report_fields" :key="key"><strong>{{ key }}</strong>：{{ value || '—' }}</div></div></el-popover><div v-if="row.identity_rows>1" class="cost-warning">重复身份</div></template></el-table-column>
            </el-table>
            <el-pagination v-model:current-page="reportPage" :page-size="10" :total="detail.monthly_report_rows.length" layout="total, prev, pager, next" />
          </details>
          <details class="raw-records" @toggle="rawOpen = $event.target.open"><summary>查看原始月费记录（{{ detail.raw_rows.length }} 条，含上月对比来源）</summary>
            <el-table v-if="rawOpen" :data="detail.raw_rows.slice((rawPage-1)*20,rawPage*20)" size="small"><el-table-column prop="month_of_charge" label="计费月" width="100" /><el-table-column prop="fulfillment_center" label="仓库" width="85" /><el-table-column prop="fnsku" label="FNSKU" min-width="120" /><el-table-column prop="product_size_tier" label="尺寸段" min-width="120" /><el-table-column label="仓储费"><template #default="{row}">{{ amount(row.estimated_monthly_storage_fee) }}</template></el-table-column><el-table-column label="激励抵扣"><template #default="{row}">{{ amount(row.total_incentive_fee_amount) }}</template></el-table-column></el-table>
            <el-pagination v-if="rawOpen" v-model:current-page="rawPage" :page-size="20" :total="detail.raw_rows.length" layout="total, prev, pager, next" />
          </details>
        </template>
        <el-empty v-else-if="!detailLoading" description="暂无详情，请重试" />
      </div>
    </el-drawer>

    <el-dialog v-model="syncVisible" title="更新仓储分析资料" width="min(560px, 94vw)" @closed="stopPolling">
      <p class="scope-note">通常由服务器计划任务自动采集；此处用于手动补齐或查看其他月份。只获取报告，不修改库存或广告。最近6小时成功资料会复用；关闭窗口仅停止本页检查，服务器任务仍会续查已有请求，不会重复创建。</p>
      <el-select v-model="sourceKind" :disabled="syncing" style="width:280px"><el-option value="all" label="一键补齐全部仓储报告（推荐）" /><el-option v-for="(label,kind) in kindNames" :key="kind" :value="kind" :label="label" /></el-select>
      <p v-if="sourceKind === 'all'" class="scope-note">分别获取所选月/上月完整月报、最新库存健康、所选月超龄收费及仓储超量费。各来源独立推进，一个报告失败或取消不影响其他报告，不自动重建失败请求。</p>
      <div class="sync-month" v-if="sourceKind !== 'health'"><span>完整计费月</span><el-date-picker v-model="sourceMonth" type="month" value-format="YYYY-MM" :disabled="syncing" style="width:160px" /></div>
      <p v-else class="scope-note">获取最新可用健康快照，不按历史月份伪造当时库龄。超过7天的快照不参与风险判断。</p>
      <el-alert v-if="syncMessage" :title="syncMessage" type="info" :closable="false" />
      <div v-for="job in syncJobs" :key="`${job.kind}-${job.month}`" class="scope-note">{{ kindNames[job.kind] }}{{ job.kind === 'health' ? '' : ` ${job.month}` }}：{{ statusLabel(job.status) }}{{ job.message ? ` · ${job.message}` : '' }}</div>
      <template #footer><el-button @click="syncVisible=false">关闭</el-button><el-button :loading="syncing" :disabled="!data.can_sync" @click="updateSource('check')">继续检查</el-button><el-button type="primary" :loading="syncing" :disabled="!data.can_sync" @click="updateSource('start')">请求 / 更新资料</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import { getStorageCostAnalysis, getStorageCostDetail, updateStorageAnalysisSource } from '@/services/api'

const props = defineProps({ shopId: [Number,String], refreshKey: Number })
const initial = () => ({ month:'', search:'', risk:'', country_code:'', currency:'', sort:'priority', order:'desc', page:1, page_size:20 })
const query = reactive(initial())
const data = ref({ list:[], sources:[] })
const loading = ref(false)
const detailVisible = ref(false), detailLoading = ref(false), detail = ref(null), detailQuery = ref({})
const rawOpen = ref(false), rawPage = ref(1)
const warehousePage = ref(1)
const reportPage = ref(1), overagePage = ref(1)
const syncVisible = ref(false), syncing = ref(false), syncMessage = ref(''), sourceKind = ref('all'), sourceMonth = ref(''), syncJobs = ref([])
const kindNames = { monthly:'完整月费 / 利用率附加费', health:'库存健康 / 库龄', aged:'长期 / 超龄收费', overage:'仓储超量费（店铺级）' }
const risks = [['aged','已有超龄收费'],['utilization','利用率附加费'],['fee_review','月费金额待核对'],['split_review','月费拆分待核对'],['slow','库存消化慢'],['aging','180天以上库存'],['excess','预计冗余库存'],['estimated','预计超龄费用'],['rising','费用明显上涨'],['high','费用占比高']]
// 与后端classify/dataset的实际触发口径保持一致；筛选项和表格标签共用说明。
const riskTipStyle = { maxWidth:'min(360px, calc(100vw - 32px))', boxSizing:'border-box', whiteSpace:'pre-line', lineHeight:'1.8', overflowWrap:'anywhere' }
const riskGuide = '鼠标停留在关注标签或筛选选项上，可查看含义、判断条件和处理建议。\n费用标签对应所选历史计费月；库存标签使用最新可用快照，不代表该历史月的库存。\n库存快照超过7天暂停对应库存预警；库龄日期未知或超过7天，暂停库龄/预计超龄预警。没有标签不代表没有风险。'
const riskTips = {
  aged: '含义：所选计费月的长期/超龄收费报告中，该SKU列示的收费金额大于0。\n注意：这是历史收费记录，不是未来费用预估，也不与月费混加为账单总额。\n建议：点“详情”核对收费日期、库龄档位和数量，再评估促销、控制补货或移除。',
  utilization: '含义：所选月的完整月费报告中，仓储利用率附加费大于0。\n注意：它是月费的拆分项，不再次加回净仓储费，也不等于超龄附加费或仓储超量费。\n建议：点“详情”查看仓库费率、利用率及计费数量/体积，结合当前库存评估处理。',
  fee_review: '含义：该SKU当月净仓储费无法完整确认，例如存在疑似重复身份的非零金额或必需金额缺失。\n注意：“已知小计”不等于全部费用，未知金额不是0。\n建议：点“详情”展开完整月费原行，核对重复记录和金额后再判断费用高低。',
  split_review: '含义：报告月费总额与“基础费＋仓储利用率附加费”之和不一致，当前原因未确认。\n注意：差额不代表新增收费，也不能自行补加到费用中。\n建议：点“详情”查看拆分差额和完整原字段，以报告月费原总额核对账单。',
  slow: '判断：最新有效健康快照中，有可售库存但近30天销量为0，或预计消化天数超过120天。\n算法：可售库存 ÷（近30天销量 ÷ 30）；这里的销量为报告发货件数。\n注意：是按现有销量不变估算的运营参考，不是清仓期限或收费门槛。\n建议：结合季节、在途补货与销售计划，评估促销及补货节奏。',
  aging: '判断：有效库龄快照中存在180天以上库存；存在365天以上库存时重点标红，两类都可被此筛选选中。\n注意：180/365天只是运营筛查线，不代表当地实际收费门槛；“至少”表示仅能确认部分库存数量。\n建议：点“详情”核对库龄快照日期、原分档数量及预计超龄费用。',
  excess: '含义：最新有效健康报告中，Amazon给出的“预计冗余库存”数量大于0，即预计超出需求的库存。\n注意：这是库存建议，不代表商品不能销售、已经亏损或已经收费。\n建议：结合季节性和推广计划核对预计冗余数量，再评估控补货、促销或移除。',
  estimated: '判断：有效库龄资料中，预计超龄金额大于0，或预计收费数量大于0但金额尚未提供。\n注意：这是预计费用/预计收费库存，不是已收费用；金额未知不按0处理。\n建议：点“详情”的“预计超龄费用”查看档位、数量和金额，提前评估处理成本。',
  rising: '判断：本月净仓储费比上个日历月增加至少5个对应币种单位，且涨幅至少30%；上月净费≤0时，只判断增加金额。\n注意：必须有可比金额，缺上月记录不判上涨；这是运营参考规则，不代表一定出现附加收费。\n建议：点“详情”查看增费仓库，并对照库存数量、体积、费率及抵扣变化。',
  high: '判断：该SKU当月净仓储费为正，且占同月、同国家、同币种全店净仓储费至少10%。\n注意：分母不受搜索/分页影响；全店金额不完整或分母≤0时不计算。占比高不等于违规或单位费用高。\n建议：优先检查费用贡献大的SKU，再结合销量、库存与仓库单件月费判断是否需要处理。'
}
const riskTip = (code, label = '') => {
  if (code === 'slow' && label.includes('无销量')) return '判断：当前可售库存大于0，但同一有效健康报告近30天发货件数为0。\n注意：只反映这30天的报告表现，不代表从未卖出；不使用历史费用月推断当前库存。\n建议：检查商品是否正常可售、近期流量和季节性，结合库存评估销售或去库存计划。'
  if (code === 'slow' && label.includes('120')) return '判断：可售库存 ÷（近30天发货件数 ÷ 30）超过120天。\n含义：假设销量保持不变，现有库存预计需要超过120天消化；不是实际清仓期限或收费门槛。\n建议：结合季节、在途补货和推广计划，评估控补货与促销。'
  if (code === 'aging' && label.includes('365')) return '判断：有效库龄快照中存在365天以上库存，因此重点标红。\n注意：365天只是运营筛查线，不代表当地实际收费起点；数量缺档时仅显示已知下限。\n建议：点“详情”核对库龄分档及已收/预计超龄费用，评估继续持有与处理成本。'
  if (code === 'estimated' && label.includes('金额未知')) return '判断：报告预计会被收取超龄费用的库存数量大于0，但未提供对应金额。\n注意：费用未知，不等于免费或0费用，也不是已经扣费。\n建议：点“详情”核对预计收费档位、数量，补齐金额后再比较处理方案。'
  return riskTips[code] || '请点“详情”核对报告来源和数据日期；未提供资料不代表没有风险。'
}
let active = false, sequence = 0, detailSequence = 0, syncSequence = 0, pollTimer = null
const amount = value => value == null ? '—' : Number(value).toLocaleString('en-US',{ minimumFractionDigits:2, maximumFractionDigits:4 })
const number = value => value == null ? '—' : Number(value).toLocaleString('zh-CN',{ maximumFractionDigits:2 })
const signed = value => Number(value)>0 ? `+${Number(value).toFixed(2)}` : Number(value).toFixed(2)
const changeClass = change => change?.direction === 'up' ? 'cost-danger' : change?.direction === 'down' ? 'cost-success' : 'secondary'
const changeText = change => change?.amount == null ? '无可比记录' : `${change.direction==='up'?'↑ ':change.direction==='down'?'↓ ':''}${signed(change.amount)}`
const healthMissing = row => row.health_status === 'ambiguous' ? '多个库存身份，待核对' : '未获取健康快照'
const supplyText = health => health.available != null && health.sales_30d != null && Number(health.available) > 0 && Number(health.sales_30d) === 0 ? '有库存 · 近30天未出单' : health.days_of_supply == null ? '消化天数无法计算' : `预计消化 ${number(health.days_of_supply)} 天`
const stockClass = health => !health.fresh ? 'secondary' : Number(health.available) > 0 && health.sales_30d != null && Number(health.sales_30d) === 0 ? 'cost-danger' : Number(health.days_of_supply) > 120 ? 'cost-warning' : ''
const oldStockText = health => health.aged_quantity == null || (!health.aged_quantity_complete && Number(health.aged_quantity) === 0) ? '180天以上库存未知' : `180天以上 ${health.aged_quantity_complete ? '' : '至少 '}${number(health.aged_quantity)} 件`
const statusLabel = status => ({queued:'等待请求',creating:'请求创建中',pending:'报告生成中',ready:'已获取',no_data:'未获报告（金额未知）',failed:'本次失败',missing:'未获取',uncertain:'请求未确认'}[status] || '待核对')
const sourceText = kind => {
  const row = data.value.sources?.find(item=>item.kind===kind)
  if (!row) return '未获取'
  return `${statusLabel(row.attempt_status)}${row.data_at ? ` · 上次成功 ${row.data_at.slice(0,10)}（${row.row_count}条）${kind === 'health' && row.snapshot_date ? ` · 库存快照 ${row.snapshot_date}` : ''}` : ''}${row.attempt_message ? ` · ${row.attempt_message}` : ''}`
}
const fetchRows = async () => {
  if (!active) return
  const ticket=++sequence
  if (!props.shopId) { data.value={list:[],sources:[]};loading.value=false;return }
  loading.value=true
  try {
    const res=await getStorageCostAnalysis({shop_id:props.shopId,...query})
    if (!active || ticket!==sequence) return
    if (res.data.status!=='success') throw new Error(res.data.message)
    data.value=res.data.data
    query.month=data.value.month
    sourceMonth.value=data.value.month
  } catch(error) { if(active && ticket===sequence) { data.value={list:[],sources:[]};ElMessage.error(error.response?.data?.message || error.message || '仓储分析加载失败') } }
  finally { if(ticket===sequence)loading.value=false }
}
const search=()=>{query.page=1;fetchRows()}
const sortChanged=({prop,order})=>{query.sort=prop||'priority';query.order=order==='ascending'?'asc':'desc';search()}
const openDetail=row=>{detailQuery.value={shop_id:props.shopId,month:data.value.month,seller_sku:row.seller_sku,country_code:row.country_code,currency:row.currency};detailVisible.value=true;rawOpen.value=false;rawPage.value=warehousePage.value=reportPage.value=1;loadDetail()}
const loadDetail=async()=>{
  const ticket=++detailSequence;detail.value=null;detailLoading.value=true
  try { const res=await getStorageCostDetail({...detailQuery.value});if(!active || !detailVisible.value || ticket!==detailSequence)return;if(res.data.status!=='success')throw new Error(res.data.message);detail.value=res.data.data }
  catch(error){if(active && detailVisible.value && ticket===detailSequence)ElMessage.error(error.response?.data?.message || error.message || '详情加载失败')}
  finally{if(ticket===detailSequence)detailLoading.value=false}
}
const stopPolling=()=>{clearTimeout(pollTimer);pollTimer=null;syncSequence++;syncing.value=false}
const updateSource=async action=>{
  if(!active || syncing.value || !syncVisible.value)return
  const ticket=++syncSequence, shop=props.shopId, kind=sourceKind.value, month=sourceMonth.value
  if(kind!=='health' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')){ElMessage.warning('请先选择完整计费月');return}
  const parts=month ? month.split('-').map(Number) : [], prior=parts.length ? `${parts[1]===1?parts[0]-1:parts[0]}-${String(parts[1]===1?12:parts[1]-1).padStart(2,'0')}` : ''
  const jobs=kind==='all' ? [{kind:'monthly',month},{kind:'monthly',month:prior},{kind:'health',month},{kind:'aged',month},{kind:'overage',month}] : [{kind,month}]
  syncJobs.value=jobs.map(job=>({...job,status:'queued',message:''}))
  syncing.value=true
  const live=()=>active && ticket===syncSequence && syncVisible.value
  const round=async(operation,indices)=>{
    for(const index of indices){
      if(!live())return
      const job=jobs[index]
      syncJobs.value[index]={...job,status:operation==='start'?'creating':'pending',message:''}
      try{
        const res=await updateStorageAnalysisSource({shop_id:shop,kind:job.kind,month:job.month,action:operation})
        if(!live())return
        if(res.data.status!=='success')throw new Error(res.data.message)
        const result=res.data.data
        syncJobs.value[index]={...job,status:result.attempt_status,message:result.attempt_message || ''}
      }catch(error){if(!live())return;syncJobs.value[index]={...job,status:error.response?'failed':'uncertain',message:error.response?.data?.message || '请求未确认，仅继续检查，不重新创建'}}
    }
    if(!live())return
    const waiting=syncJobs.value.map((job,index)=>['creating','pending','uncertain'].includes(job.status)?index:-1).filter(index=>index>=0)
    syncMessage.value=waiting.length ? '各报告独立获取中；不会因某一来源取消而跳过其他报告' : syncJobs.value.every(job=>job.status==='ready') ? '资料已保存，清单已更新' : '本轮检查结束；已保存可得报告，未取得的来源请查看说明'
    if(waiting.length)pollTimer=setTimeout(()=>round('check',waiting),6000)
    else{syncing.value=false;await fetchRows()}
  }
  round(action,jobs.map((_,index)=>index))
}
watch(()=>[props.shopId,props.refreshKey],()=>{sequence++;detailSequence++;stopPolling();detailVisible.value=false;syncVisible.value=false;syncMessage.value='';syncJobs.value=[];overagePage.value=1;data.value={list:[],sources:[]};Object.assign(query,initial());fetchRows()})
const start=()=>{if(!active){active=true;fetchRows()}}
const stop=()=>{active=false;sequence++;detailSequence++;stopPolling();loading.value=detailLoading.value=false;detailVisible.value=syncVisible.value=false}
onMounted(start);onActivated(start);onDeactivated(stop);onBeforeUnmount(stop)
</script>

<style scoped>
.cost-workbench{background:#fff;border-radius:8px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
.cost-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}.source-button{margin-left:auto}.help{color:#909399;cursor:help}
.cost-scope{display:flex;gap:18px;flex-wrap:wrap;padding:10px 12px;background:#f4f7fc;border-radius:6px;font-size:12px;color:#64748b}.cost-scope strong{color:#334155}
.source-status{display:flex;gap:10px 18px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:#8492a6}.source-status>span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scope-note{color:#909399;font-size:12px;line-height:1.7;margin:10px 0}.sku-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155}.sku-code{font-family:monospace;font-size:11px;color:#8492a6;margin-top:4px}
.secondary{color:#909399;font-size:12px}.cost-warning{color:#b77900}.cost-danger{color:#dc2626}.cost-success{color:#059669}.risk-tags{display:flex;gap:5px;flex-wrap:wrap}.cost-pagination{display:flex;justify-content:flex-end;margin-top:14px}
.risk-option{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;height:100%}.risk-option .help{font-size:12px}.risk-tag{cursor:help}
.detail-overview{background:#f4f7fc;padding:12px 16px;border-radius:7px;color:#475569;font-size:13px;line-height:1.8}.detail-overview p{margin:5px 0 0}.detail-title{display:flex;justify-content:space-between;align-items:center}h3{font-size:14px;color:#334155;margin:20px 0 12px}h4{font-size:13px;color:#475569}
.health-summary{font-size:13px;color:#64748b;line-height:2}.age-buckets{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.empty-note{font-size:13px;color:#909399;background:#f8fafc;padding:12px;border-radius:5px}.raw-records{margin-top:24px;font-size:13px;color:#64748b}.raw-records summary{cursor:pointer;margin-bottom:12px}.sync-month{display:flex;align-items:center;gap:12px;margin:20px 0}
.report-coverage{margin-top:8px;font-size:12px;color:#64748b}.report-coverage summary{cursor:pointer}.original-fields{max-height:380px;overflow:auto;font-size:12px;line-height:1.8;overflow-wrap:anywhere}.original-fields strong{color:#475569}
@media(max-width:768px){.cost-pagination{overflow-x:auto;justify-content:flex-start}.source-button{margin-left:0}.cost-scope{gap:8px}.cost-toolbar :deep(.el-input){max-width:100%}}
</style>
