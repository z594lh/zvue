<template>
  <div class="ai-facts ai-facts-panel">
      <section class="facts-card">
        <div class="card-heading"><div><h2>{{ result.products[0]?.product_name || result.identity.asin }}</h2><p>{{ result.identity.shop_name }} · {{ result.identity.asin }} · {{ result.identity.skus.join(' / ') }} · USD</p></div><el-button @click="download">导出本次资料 JSON</el-button></div>
        <div class="summary-grid">
          <div><span>统计区间</span><strong>{{ result.time.read_start }} ～ {{ result.time.report_end }}</strong></div>
          <div><span>资料大小</span><strong>{{ Math.ceil(result.size_bytes / 1024) }} KB</strong></div>
          <div><span>广告组关系</span><strong>{{ result.relationships.length }} 组 · {{ sharedCount }} 组共享或未知</strong></div>
          <div><span>资料来源</span><strong class="muted">本次优化保存的原始输入，非当前重新查询</strong></div>
        </div>
      </section>
      <section v-if="result.pricing?.length" class="facts-card"><h2>计算售价与成本场景</h2><div v-for="p in result.pricing" :key="p.sku"><h3>{{ p.sku }} · USD</h3><p class="subtle">采购 {{ value(p.unit_costs.purchase) }} · 头程 {{ value(p.unit_costs.headway) }} · FBA {{ value(p.unit_costs.fba) }} · 佣金 {{ value(p.unit_costs.commission_rate,true) }}</p><el-table :data="p.scenarios" size="small"><el-table-column label="售价"><template #default="{row}">{{ value(row.price) }}</template></el-table-column><el-table-column label="假设广告费率"><template #default="{row}">{{ value(row.assumed_ad_rate,true) }}</template></el-table-column><el-table-column label="假设退款率"><template #default="{row}">{{ value(row.assumed_refund_rate,true) }}</template></el-table-column><el-table-column label="场景单件利润"><template #default="{row}">{{ value(row.profit_amount) }}</template></el-table-column><el-table-column label="场景利润率"><template #default="{row}">{{ value(row.profit_rate,true) }}</template></el-table-column></el-table><p class="subtle">{{ p.note }}</p></div></section>
      <section class="facts-card">
        <h2>资料检查与利润参考</h2>
        <p class="subtle">利润与分摊沿用已确认的现有报表口径，不重复核算。</p>
        <p v-if="!visibleGaps.length && !(result.unit_profit_references || []).some(r=>!r.reliable || r.warnings?.length)" class="data-ok">当前检查未发现需要处理的数据异常。</p>
        <div class="gap" v-for="gap in visibleGaps" :key="gap.code + gap.message">{{ gap.message }}</div>
        <div v-for="r in result.unit_profit_references || []" :key="r.sku" :class="r.reliable && !r.warnings?.length?'profit-reference':'gap'"><strong>{{ r.sku }} · 当前单位利润参考</strong><p>广告及退款前单件利润 USD {{ value(r.profit) }} · {{ r.reliable?'资料齐全':'资料有缺口' }}</p><p v-for="warning in r.warnings" :key="warning">{{ warning }}</p></div>
        <el-collapse><el-collapse-item title="查看统计口径与来源说明" name="notes"><p v-for="note in result.notes" :key="note">{{ note }}</p><p>经营时区：{{ result.time.business_timezone }}；广告时区：{{ result.time.ads_timezone.startsWith('unverified')?'尚未核实或包含混合来源':result.time.ads_timezone }}。两个来源的业务日不自动视为相同；缺失日期不会补0。</p></el-collapse-item></el-collapse>
      </section>
      <section class="facts-card">
        <div class="card-heading"><h2>经营表现</h2><el-radio-group v-model="period" size="small"><el-radio-button v-for="n in [7,14,30]" :key="n" :value="n">{{ n }}天与前{{ n }}天</el-radio-button></el-radio-group></div>
        <div v-for="business in result.business" :key="business.sku" class="sku-block">
          <h3>{{ business.sku }}</h3>
          <p class="subtle">金额为已观测小计；利润沿用SKU报表，包含分摊和估算。多SKU不直接加总。</p>
          <el-table :data="comparison(business.periods)" border>
            <el-table-column label="周期" min-width="180"><template #default="{row}">{{ row.key.startsWith('p') ? '前期' : '本期' }}<small>{{ row.start }} ～ {{ row.end }}</small></template></el-table-column>
            <el-table-column label="覆盖" min-width="150"><template #default="{row}"><el-tag :type="row.coverage==='complete'?'success':'warning'">{{ coverageLabel(row) }}</el-tag><small>已观测 {{ row.observed_days }}/{{ row.days }} 天</small><el-tooltip v-if="row.missing_days.length" :content="row.missing_days.join('、')"><span class="missing">查看缺口日期</span></el-tooltip></template></el-table-column>
            <el-table-column v-for="m in businessMetrics" :key="m.key" :label="m.label" min-width="100"><template #default="{row}">{{ value(row.metrics[m.key], m.ratio) }}</template></el-table-column>
          </el-table>
          <el-collapse><el-collapse-item title="展开最近30天每日经营数据（缺失保留为空）" :name="business.sku"><el-table :data="business.daily" max-height="400"><el-table-column prop="date" label="日期" width="120" /><el-table-column v-for="m in businessMetrics" :key="m.key" :label="m.label" min-width="100"><template #default="{row}">{{ value(row.metrics[m.key],m.ratio) }}</template></el-table-column></el-table></el-collapse-item></el-collapse>
        </div>
      </section>
      <section class="facts-card">
        <div class="card-heading"><h2>广告与搜索词</h2><span class="subtle">{{ result.ads_reporting_policy?'按报告日期使用现有采集数据 · 不要求归因回补':'历史快照：保留当时的统计口径' }}</span></div>
        <el-tabs v-model="adTab">
          <el-tab-pane v-for="module in result.ads" :key="module.kind" :label="module.label" :name="module.kind">
            <p class="scope-note">{{ scopeLabel(module.scope) }}；不同报表是同一业务的不同切面，金额不能相加。</p>
            <el-table :data="comparison(module.periods)" border>
              <el-table-column label="周期" min-width="170"><template #default="{row}">{{ row.start }} ～ {{ row.end }}</template></el-table-column>
              <el-table-column label="日期覆盖" min-width="160"><template #default="{row}">{{ coverageLabel(row) }}<small>有明细 {{ row.observed_days }} 天；未确认日期 {{ row.missing_days.length }} 天</small></template></el-table-column>
              <el-table-column v-for="m in adMetrics" :key="m.key" :label="m.label" min-width="90"><template #default="{row}">{{ value(row.metrics[m.key],m.ratio) }}</template></el-table-column>
            </el-table>
            <el-collapse v-if="module.source_provenance?.length"><el-collapse-item title="查看采集记录（可选）" :name="module.kind"><p class="subtle">这些记录仅供追溯。按报告日期使用现有数据，不要求重新抓取或等待归因窗口结束；旧报表没记录生成时间也可正常分析。</p><el-table :data="module.source_provenance" max-height="300"><el-table-column prop="date" label="报告日期" width="115" /><el-table-column label="记录核对" width="160"><template #default="{row}">{{ row.state==='verified'?'已核对':row.account_matches===false?'账户不匹配':row.content_check==='row_limit'?'未完成全量核对':row.content_matches===false?'内容有变化':'信息未齐（可选记录）' }}</template></el-table-column><el-table-column label="生成时间（UTC）" min-width="180"><template #default="{row}">{{ row.generated_at || '未记录' }}</template></el-table-column><el-table-column prop="imported_at" label="入库时间（UTC）" min-width="180" /><el-table-column prop="timezone" label="广告时区" min-width="180" /><el-table-column prop="currency" label="币种" width="70" /></el-table></el-collapse-item></el-collapse>
            <p class="subtle">共 {{ module.total_objects }} 个对象，展示 {{ module.selected_objects }} 个，省略 {{ module.omitted_objects }} 个；覆盖60日已观测花费 {{ value(module.selected_cost_share,true) }}。按花费、购买、曝光选取，全量小计保留。</p>
            <el-table :data="module.details" max-height="520" stripe>
              <el-table-column type="expand"><template #default="{row}"><div class="evidence"><p>证据编号：{{ row.evidence_id }}</p><p>活动 {{ row.dimensions.campaign_id }} / 组 {{ row.dimensions.ad_group_id || '—' }} / 报表对象 {{ row.dimensions.keyword_id || '—' }}</p><p>当前实体关联：{{ row.entity_link ? `${row.entity_link.kind} / ${row.entity_link.id}` : '未核实，不生成执行对象' }}</p><p>来源行数 {{ row.source.row_count }} · 最近源行更新 {{ row.source.latest_row_update || '未知' }}</p><el-table v-if="row.daily" :data="row.daily" max-height="300"><el-table-column prop="date" label="日期" width="120" /><el-table-column v-for="m in adMetrics" :key="m.key" :label="m.label" min-width="95"><template #default="slot">{{ value(slot.row.metrics[m.key],m.ratio) }}</template></el-table-column></el-table><p v-else>本轮仅为前6个优先展示对象附每日明细，其余保留周期汇总。</p></div></template></el-table-column>
              <el-table-column label="对象 / 搜索词" min-width="220"><template #default="{row}"><strong>{{ objectLabel(row) }}</strong><small>{{ row.campaign_name }} · {{ row.campaign_type==='AUTO'?'自动':row.campaign_type==='MANUAL'?'手动':'未知' }} · {{ row.dimensions.keyword_match_type || '' }}</small></template></el-table-column>
              <el-table-column v-for="m in adMetrics" :key="m.key" :label="`${period}天${m.label}`" min-width="105"><template #default="{row}">{{ value(detailPeriod(row)[m.key],m.ratio) }}</template></el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </section>
      <section class="facts-card">
        <div class="card-heading"><h2>卖家精灵关键词</h2><span class="subtle">采集 {{ result.keywords.snapshot?.record_date || '暂无' }} · 展示 {{ result.keywords.selected }}/{{ result.keywords.total }} 词</span></div>
        <p class="subtle">{{ result.keywords.note }}</p>
        <el-table :data="result.keywords.items" max-height="430" stripe>
          <el-table-column label="关键词" min-width="240"><template #default="{row}">{{ row.keyword }}<small>{{ row.translation || '暂无来源译文' }}</small></template></el-table-column>
          <el-table-column label="ASIN流量占比" min-width="120"><template #default="{row}">{{ value(row.traffic_share,true) }}</template></el-table-column>
          <el-table-column label="自然 / 广告占比" min-width="150"><template #default="{row}">{{ value(row.organic_share,true) }} / {{ value(row.sponsored_share,true) }}</template></el-table-column>
          <el-table-column label="来源预估周曝光" min-width="140"><template #default="{row}">{{ value(row.weekly_impressions) }}</template></el-table-column>
          <el-table-column label="自然排名" min-width="120"><template #default="{row}">{{ value(row.organic_rank) }}<small>{{ row.organic_updated_text || '来源时间未知' }}</small></template></el-table-column>
          <el-table-column label="广告排名" min-width="120"><template #default="{row}">{{ value(row.sponsored_rank) }}<small>{{ row.sponsored_updated_text || '来源时间未知' }}</small></template></el-table-column>
          <el-table-column label="市场月搜索量" min-width="130"><template #default="{row}">{{ value(row.monthly_searches) }}</template></el-table-column>
          <el-table-column label="建议竞价 USD" min-width="130"><template #default="{row}">{{ value(row.ppc) }}</template></el-table-column>
        </el-table>
        <el-collapse v-if="result.keywords.history?.length"><el-collapse-item title="查看关键词历史快照（实际采集版本，不是每日自然曝光）" name="keyword-history"><div v-for="history in result.keywords.history" :key="history.snapshot.id"><h3>{{ history.snapshot.record_date }} · {{ history.items.length }} 个词</h3><el-table :data="history.items" max-height="260" size="small"><el-table-column prop="keyword" label="完整关键词" min-width="220" /><el-table-column prop="organic_rank" label="自然排名" /><el-table-column label="自然占比"><template #default="{row}">{{ value(row.organic_share,true) }}</template></el-table-column><el-table-column prop="organic_updated_text" label="来源排名时间" min-width="180" /></el-table></div></el-collapse-item></el-collapse>
      </section>
      <section class="facts-card">
        <h2>当前设置、共享关系与最近操作</h2>
        <el-collapse>
          <el-collapse-item title="广告组关联商品（当前及60日历史并集）" name="relations"><div v-for="r in result.relationships" :key="r.campaign_id+r.ad_group_id" class="gap"><strong>活动 {{ r.campaign_id }} / 组 {{ r.ad_group_id }}</strong><p>{{ r.shared_or_unknown?'共享或存在未知商品，不能按本ASIN独占判断':'已知商品属于本次ASIN，历史完整性仍须核实' }}</p><span>{{ r.members.map(m=>`${m.sku || '未知SKU'} / ${m.asin || '未知ASIN'}`).join('；') }}</span></div></el-collapse-item>
          <el-collapse-item title="库存与报价（当前本地快照）" name="inventory"><el-table :data="result.inventory"><el-table-column prop="seller_sku" label="SKU" /><el-table-column prop="fulfillable_quantity" label="可售量" /><el-table-column prop="inbound_shipped_quantity" label="已发在途" /><el-table-column prop="sync_time" label="同步时间（源值）" /></el-table><el-table :data="result.offers"><el-table-column prop="sku" label="SKU" /><el-table-column prop="audience" label="受众" /><el-table-column prop="our_price" label="普通价" /><el-table-column prop="discounted_price" label="促销价" /><el-table-column prop="currency" label="币种" /><el-table-column prop="updated_at" label="更新时间（源值）" /></el-table><p>未核实实际当前报价、促销独立排期及到货时间。</p></el-collapse-item>
          <el-collapse-item title="最近已知修改记录" name="history"><p>{{ result.recent_operations.note }}</p><el-table :data="result.recent_operations.listing"><el-table-column prop="sku" label="SKU" /><el-table-column prop="change_summary" label="Listing修改" /><el-table-column prop="write_status" label="提交状态" /><el-table-column prop="requested_at" label="操作时间（UTC）" /></el-table><el-table :data="result.recent_operations.ads"><el-table-column prop="campaign_id" label="活动" /><el-table-column prop="change_type" label="广告修改" /><el-table-column prop="previous_value" label="从" /><el-table-column prop="new_value" label="到" /><el-table-column prop="write_status" label="提交状态" /></el-table></el-collapse-item>
        </el-collapse>
        <p class="subtle">生成 {{ result.generated_at }} · 内容摘要 {{ result.content_hash.slice(0,16) }} · 本次读取的完整资料。</p>
      </section>

  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
const props=defineProps({result:{type:Object,required:true}})
const result=computed(()=>props.result),period=ref(7),adTab=ref('spTargeting')
const businessMetrics=[{key:'sales_qty',label:'销量'},{key:'sales_amount',label:'销售额'},{key:'net_profit',label:'利润'},{key:'ad_cost',label:'广告费'},{key:'acos',label:'ACOS',ratio:true},{key:'tacos',label:'TACOS',ratio:true}]
const adMetrics=[{key:'impressions',label:'曝光'},{key:'clicks',label:'点击'},{key:'cost',label:'花费'},{key:'purchases_7d',label:'归因购买'},{key:'sales_7d',label:'归因销售'},{key:'acos',label:'ACOS',ratio:true}]
const sharedCount=computed(()=>result.value?.relationships.filter(r=>r.shared_or_unknown).length || 0)
const visibleGaps=computed(()=>result.value?.gaps.filter(g=>g.code!=='historical_cost_estimated') || [])
const value=(n,ratio=false)=>n===null || n===undefined ? '—' : ratio ? `${(Number(n)*100).toFixed(2)}%` : Number(n).toLocaleString('zh-CN',{maximumFractionDigits:4})
const comparison=rows=>rows.filter(r=>r.key===`d${period.value}` || r.key===`p${period.value}`)
const coverageLabel=r=>r.coverage==='complete'?(r.coverage_basis==='report_date'?'报告日期数据齐全':'入库覆盖完整'):r.coverage==='partial'?'部分日期有数据':'尚无日期覆盖信息'
const scopeLabel=s=>s==='asin_promoted'?'当前ASIN推广商品表现':s==='associated_group'?'关联广告组整体表现，可能含其他SKU':'关联活动整体表现，含其他组和SKU'
const objectLabel=r=>r.dimensions.customer_search_term || r.dimensions.keyword_text || r.dimensions.targeting_expression || r.dimensions.placement || r.dimensions.advertised_sku || r.campaign_name
const detailPeriod=r=>r.periods.find(p=>p.key===`d${period.value}`)?.metrics || {}
function download(){
  if(!result.value)return
  const payload=result.value
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}))
  const a=document.createElement('a');a.href=url;a.download=`${result.value.identity.asin}_经营事实_${result.value.time.report_end}.json`
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
</script>

<style scoped>
.ai-facts{max-width:1560px;margin:auto;padding:28px;color:#263b56;background:#f5f7fb;min-height:100vh}
.facts-heading,.card-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.model-tools{display:flex;gap:14px;align-items:center;margin-top:20px;color:#76869b;font-size:13px;flex-wrap:wrap}
.eyebrow{font-size:12px;letter-spacing:2px;color:#5875ad}.facts-heading h1{font-size:27px;margin:12px 0}.facts-heading p,.subtle,small{color:#76869b;font-size:13px;line-height:1.8}
.facts-card{background:white;border:1px solid #e4eaf2;border-radius:12px;padding:22px;margin-top:20px;min-width:0}
.filters{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}.filters label{display:flex;flex-direction:column;gap:9px;font-size:13px}.filters label>.el-select{width:190px}.filters .product-picker{flex:1;min-width:270px}.filters .product-picker>.el-select{width:100%}
h2{font-size:18px;margin:0 0 12px}h3{font-size:15px}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;margin-top:20px}.summary-grid span,.summary-grid strong{display:block}.summary-grid span{font-size:12px;color:#8190a3;margin-bottom:9px}.summary-grid strong{font-size:14px}.gap{background:#fff8e9;border-left:3px solid #eab765;padding:12px 16px;margin:10px 0;font-size:13px;line-height:1.7}.muted{color:#8390a2}.scope-note{background:#eef5ff;padding:12px;font-size:13px}.sku-block{margin-top:18px}.evidence{padding:8px 30px;font-size:13px;overflow-wrap:anywhere}small{display:block}.missing{color:#b68530;font-size:12px;cursor:help}
.profit-reference{padding:12px 16px;margin:10px 0;background:#f5f8fc;border-radius:8px;font-size:13px;line-height:1.7}.data-ok{font-size:13px;color:#4b6b59}
@media(max-width:800px){.ai-facts{padding:14px}.facts-card{padding:14px}.facts-heading h1{font-size:22px}.summary-grid{grid-template-columns:1fr 1fr}.filters label{width:100%}.filters label>.el-select,.filters label :deep(.el-date-editor){width:100%}.filters .product-picker{min-width:0}}
</style>


