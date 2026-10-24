<template>
  <section class="business-section">
    <header class="section-heading"><div><h2>{{ module.title }}</h2><p>{{ state }}<span v-if="data?.report_end"> · 报表截至 {{ data.report_end }}</span></p></div><el-tag type="info" effect="plain">{{ mode==='actual'?'原调用返回':'只读试查' }}</el-tag></header>
    <el-alert v-if="!data || failed" :title="readableNote(String(data?.message || data?.error || data?.reason || state))" type="warning" :closable="false"/>
    <template v-if="data">
      <details v-if="data.note" class="source-note"><summary>工具返回的口径说明</summary><p>{{ readableNote(data.note) }}</p></details>
      <p v-if="data.detail_note" class="warning-note">{{ readableNote(data.detail_note) }}</p>
      <div v-if="Array.isArray(data.rows)" class="coverage-strip"><span>本次返回 <b>{{ data.rows.length }}</b> 条</span><span>归档总量 <b>{{ data.total_in_archive ?? data.total ?? '未记录' }}</b></span><span>还有未返回 <b>{{ data.has_more==null?'未记录':data.has_more?'是':'否' }}</b></span><span v-if="data.byte_limited">受到字节预算限制</span></div>
      <el-alert v-if="data.has_more || data.byte_limited" title="这是部分返回，不代表AI已看过其余资料；需要更多时请另作只读试查。" type="warning" :closable="false"/>
      <details v-if="data.source_coverage?.length" class="source-coverage"><summary>查看各类报告的来源 / 归档覆盖（不能跨报告相加）</summary><AiToolTable :rows="data.source_coverage" :columns="['kind','scope','total_objects','selected_objects','omitted_objects']"/></details>

      <template v-if="module.tool==='get_asin_overview'">
        <div class="identity-card"><span class="eyebrow">工具实际返回的商品范围</span><h3>{{ data.identity?.asin || 'ASIN未提供' }}</h3><AiToolValue :value="pick(data.identity,['shop_name','skus','currency','region'])"/></div>
        <h3>库存</h3><AiToolTable v-if="data.inventory?.length" :rows="data.inventory" :columns="['seller_sku','fulfillable_quantity','inbound_working_quantity','inbound_shipped_quantity','inbound_receiving_quantity','sync_time']"/><p v-else class="empty-note">本次未提供库存记录。</p>
        <h3 v-if="data.products?.length">商品资料</h3><AiToolTable v-if="data.products?.length" :rows="data.products" :columns="['product_name','sku','product_type']"/>
        <h3>报告日期与缺口说明</h3><AiToolValue v-if="data.time" :value="pick(data.time,['report_end','read_start','business_timezone','ads_timezone','notice'])"/><p class="empty-note">{{ gapText }}</p><AiToolValue v-if="gaps?.length" :value="gaps"/>
      </template>

      <template v-else-if="module.tool==='read_listing'">
        <div v-for="(row,index) in pageRows" :key="index" class="listing-card">
          <div class="record-heading"><h3>{{ row.sku || 'SKU未提供' }}</h3><span>{{ row.asin }} · {{ row.brand || '品牌未提供' }}</span></div>
          <p v-if="row.key_fields" class="warning-note">此回包只有文案摘要。未返回的完整文案不会从当前库补入，不能认为AI已经读过。</p>
          <section v-for="field in listingFields" :key="field" class="listing-field"><h4>{{ fieldLabel(field) }}</h4><p v-if="row.content_policy?.fields?.[field]" class="field-policy">本次返回的限制：{{ policyText(row.content_policy.fields[field]) }}</p>
            <AiToolValue v-if="hasField(row,field)" :value="listingValue(row,field)"/>
            <p v-else class="empty-note">本次未提供{{ row.other_field_counts?.[field]!=null?`完整内容（只记录数量 ${row.other_field_counts[field]}）`:'' }}</p>
          </section>
          <details><summary>此SKU的其他返回字段与原文</summary><AiToolValue :value="row"/><pre>{{ pretty(row) }}</pre></details>
        </div>
      </template>

      <template v-else-if="module.tool==='read_business'">
        <div class="metric-toolbar"><el-select v-model="selectedSku" placeholder="选择SKU" aria-label="经营SKU"><el-option v-for="(r,i) in rows" :key="i" :value="i" :label="r.sku || `第${i+1}条`"/></el-select><el-select v-model="window" placeholder="本次未返回窗口" aria-label="经营统计窗口"><el-option v-for="w in windows" :key="w" :value="w" :label="windowLabel(w)"/></el-select></div>
        <p class="window-note">{{ windowNotice }} · 仅显示实际返回的窗口；未返回指标保持未知。</p>
        <div class="metric-cards"><div v-for="key in ['sales_qty','sales_amount','net_profit','ad_cost','tacos']" :key="key"><span>{{ fieldLabel(key) }}</span><strong>{{ formatValue(key,businessPeriod[key],rowCurrency(businessRow,currency)) }}</strong></div></div>
        <h3>该SKU已返回的窗口对比</h3><AiToolTable :rows="businessPeriods" :columns="['window','sales_qty','sales_amount','ad_cost','net_profit','acos','tacos','profit_margin','coverage']" :currency="rowCurrency(businessRow,currency)"/>
        <h3>逐日明细</h3><AiToolTable v-if="businessRow?.daily" :rows="matrixRows(businessRow.daily)" :columns="businessRow.daily.columns || []" :currency="rowCurrency(businessRow,currency)"/><p v-else class="empty-note">此回包没有逐日明细，不能从滚动汇总推算每天数据。</p>
      </template>

      <template v-else-if="module.tool==='read_advertising'">
        <p class="warning-note">活动 / 广告组 / 广告位可能包含其他SKU。不同报告口径不能互相累加；窗口为空不等于没有花费。</p>
        <div class="metric-toolbar"><el-select v-model="adKind" aria-label="广告报告类型" placeholder="全部已返回报告类型"><el-option value="" label="全部已返回报告类型"/><el-option v-for="k in adKinds" :key="k" :value="k" :label="reportLabel(k)"/></el-select><el-select v-model="window" aria-label="广告统计窗口" placeholder="本次未返回窗口"><el-option v-for="w in windows" :key="w" :value="w" :label="windowLabel(w)"/></el-select><el-radio-group v-model="metricGroup" size="small"><el-radio-button value="effect">花费与成交</el-radio-button><el-radio-button value="traffic">曝光与点击</el-radio-button></el-radio-group></div>
        <p class="window-note">{{ windowNotice }} · 某条记录缺此窗口时显示“未提供”，不挪用其他窗口。</p>
        <AiToolTable :rows="adsRows" :columns="adColumns" :window="window" :currency="currency"/>
        <p v-if="rows.some(r=>r.total_objects!=null)" class="empty-note">上表为各报告汇总；对象总数与归档数量见每条“完整记录”，并非所有投放 / 搜索词明细。</p>
      </template>

      <template v-else-if="['read_keywords','read_keyword_history'].includes(module.tool)">
        <p class="warning-note">关键词流量为卖家精灵返回的快照口径，不是ERP单日销量；词组保留原文。日期与排名缺失时不推测。</p>
        <AiToolValue v-if="data.snapshot || module.meta?.snapshot" :value="{snapshot:data.snapshot || module.meta.snapshot}"/>
        <p v-if="module.meta?.total_keywords!=null" class="source-note">源关键词 {{ module.meta.total_keywords }} 个，本模块仅返回 {{ rows.length }} 个；未返回的词不能视为AI已读。</p>
        <div class="metric-toolbar"><el-radio-group v-model="metricGroup" size="small"><el-radio-button value="effect">排名与流量占比</el-radio-button><el-radio-button value="traffic">搜索规模与竞价</el-radio-button></el-radio-group></div>
        <AiToolTable :rows="rows" :columns="keywordColumns" :currency="currency"/>
        <template v-if="module.meta?.recent_history?.length"><h3>概览附带的历史快照</h3><p class="source-note">{{ module.meta.history_note }}</p><details v-for="(version,i) in module.meta.recent_history" :key="i"><summary>查看第 {{ i+1 }} 份历史快照（仅本次返回的词）</summary><AiToolValue :value="{snapshot:version.snapshot}"/><AiToolTable :rows="matrixRows(version)" :columns="['keyword','organic_rank','sponsored_rank','traffic_share','organic_share','sponsored_share']"/></details></template>
      </template>

      <template v-else-if="['read_pricing','simulate_price'].includes(module.tool)">
        <p class="warning-note">下列利润场景是公式测算，不是实际历史利润或销量预测；这里只读，不修改售价。</p>
        <article v-for="(row,index) in priceRows" :key="index" class="pricing-card"><h3>{{ row.sku || 'SKU未提供' }} <small>{{ row.currency || '币种未提供' }}</small></h3><p v-if="row.note" class="source-note">{{ row.note }}</p>
          <template v-if="row.offers"><h4>当前报价（回包记录）</h4><AiToolTable :rows="row.offers" :columns="['audience','our_price','discounted_price','currency','updated_at']" :currency="rowCurrency(row)"/></template>
          <template v-if="row.unit_costs"><h4>单位成本</h4><AiToolValue :value="pick(row.unit_costs,['fba','purchase','headway','fixed_total','commission_rate','exchange_rate'])" :currency="rowCurrency(row)"/><details><summary>成本取值来源</summary><AiToolValue :value="row.unit_costs.sources"/></details></template>
          <template v-if="row.assumptions"><h4>本次测算假设</h4><AiToolValue :value="row.assumptions" :currency="rowCurrency(row)"/></template>
          <h4>{{ row.scenarios?'售价 / 费用假设对应的利润':'测算结果' }}</h4><AiToolTable v-if="row.scenarios" :rows="row.scenarios" :columns="['price','assumed_ad_rate','assumed_refund_rate','profit_amount','profit_rate','total_cost']" :currency="rowCurrency(row)"/><AiToolValue v-else :value="row.result" :currency="rowCurrency(row)"/>
          <template v-if="row.target_price_examples"><h4>目标利润率对应的售价示例</h4><AiToolTable :rows="row.target_price_examples" :columns="['target_profit_rate','suggested_price','actual_profit_rate','profit_amount']" :currency="rowCurrency(row)"/></template>
          <details><summary>本条完整数据、来源与警告</summary><AiToolValue :value="row"/><pre>{{ pretty(row) }}</pre></details>
        </article>
      </template>

      <template v-else>
        <p v-if="module.tool==='read_observations'" class="warning-note">观察计划不代表已经执行；未发送 / 待核实与平台已确认分开记录，尚未到期不下效果结论。</p>
        <article v-for="(row,index) in pageRows" :key="index" class="history-card">
          <template v-if="module.tool==='read_chat_history'"><p class="record-time">{{ row.created_at || '记录时间未提供' }}（原返回时间）</p><h4>提问</h4><p class="chat-question">{{ row.question ?? '未提供' }}</p><h4>AI回答</h4><p class="chat-answer">{{ row.answer ?? '未提供' }}</p></template>
          <template v-else><h3>{{ row.label || row.summary || row.ref || '业务记录' }}</h3><AiToolValue :value="mainRecord(row)" :currency="rowCurrency(row,currency)"/><template v-if="row.baseline || row.post_evidence"><details><summary>修改前基线与修改后资料（工具实际返回）</summary><AiToolValue :value="pick(row,['baseline','post_evidence'])" :currency="rowCurrency(row,currency)"/></details></template><details><summary>完整业务记录与技术原文</summary><AiToolValue :value="row"/><pre>{{ pretty(row) }}</pre></details></template>
        </article>
        <p v-if="!rows.length" class="empty-note">{{ state }}。这不代表没有历史改动，也不能据此认定数据完整。</p>
        <template v-if="data.execution_facts?.length"><h3>另附的实际执行状态</h3><AiToolTable :rows="data.execution_facts" :columns="['label','status','accepted','submitted_at','verified_at','note']" :currency="currency"/></template>
      </template>
      <el-pagination v-if="cardMode && rows.length>10" v-model:current-page="page" :page-size="10" :total="rows.length" layout="prev, pager, next, total"/>
      <details class="module-original"><summary>本模块查询条件、所有返回字段与原始 JSON</summary><p>原始位置：{{ module.path }}。未适配字段仍完整保留在此，不会因阅读模板省略而丢失。</p><pre v-if="module.query">{{ pretty(module.query) }}</pre><pre>{{ pretty(data) }}</pre></details>
    </template>
  </section>
</template>
<script setup>
import { computed,ref,watch } from 'vue'
import { dictionaryLabel } from '@/utils/businessDictionary'
import { actualWindows,fieldLabel,formatValue,matrixRows,moduleState,periodAt,pretty,readableNote,reportKind,rowCurrency } from '@/utils/aiToolData'
import AiToolValue from './AiToolValue.vue'
import AiToolTable from './AiToolTable.vue'
const props=defineProps({module:{type:Object,required:true},currency:{type:String,default:''},time:{type:Object,default:()=>({})},mode:{type:String,default:''}})
const window=ref(''),selectedSku=ref(0),adKind=ref(''),metricGroup=ref('effect'),page=ref(1)
const data=computed(()=>props.module.data),rows=computed(()=>Array.isArray(data.value?.rows)?data.value.rows:[])
const state=computed(()=>moduleState(data.value)),failed=computed(()=>!data.value || !!data.value.error || ['error','failed','too_large','unavailable','disabled'].includes(data.value.status))
const windows=computed(()=>actualWindows(rows.value)),businessRow=computed(()=>rows.value[selectedSku.value]),businessPeriod=computed(()=>periodAt(businessRow.value || {},window.value))
const businessPeriods=computed(()=>matrixRows(businessRow.value?.periods).map(r=>({...r,coverage:businessRow.value.periods.coverage?.[r.window]})))
const adKinds=computed(()=>[...new Set(rows.value.map(reportKind).filter(Boolean))]),adsRows=computed(()=>rows.value.filter(r=>!adKind.value || reportKind(r)===adKind.value))
const adColumns=computed(()=>[...(!adKind.value && adKinds.value.length>1?['kind']:[]),'campaign_name','label',...(metricGroup.value==='effect'?['cost','purchases_7d','sales_7d','acos']:['impressions','clicks','ctr','cpc'])])
const keywordColumns=computed(()=>['keyword',...(props.module.tool==='read_keyword_history'?['snapshot']:[]),...(metricGroup.value==='effect'?['organic_rank','sponsored_rank','traffic_share','organic_share','sponsored_share']:['weekly_impressions','monthly_searches','monthly_purchases','purchase_rate','ppc'])])
const listingFields=['item_name','title_differentiation','bullet_point','product_description','generic_keyword']
const priceRows=computed(()=>props.module.tool==='simulate_price'?[data.value]:rows.value.slice((page.value-1)*10,page.value*10))
const pageRows=computed(()=>rows.value.slice((page.value-1)*10,page.value*10))
const cardMode=computed(()=>!['read_business','read_advertising','read_keywords','read_keyword_history','get_asin_overview'].includes(props.module.tool))
const gaps=computed(()=>data.value?.gaps ?? data.value?.data_gaps)
const gapText=computed(()=>gaps.value==null?'本次未提供缺口信息。':gaps.value.length?'本次记录了以下资料缺口。':'本次未报告缺口，但这不证明数据完整。')
const windowNotice=computed(()=>{const actual=props.time.windows?.find(w=>w.key===window.value);return actual?`${windowLabel(window.value)}：${actual.start} ～ ${actual.end}`:`${window.value?windowLabel(window.value):'统计窗口未提供'}：起止日期未提供`})
/** 仅挑选原对象确实存在的字段，不产生不存在的零或业务说明值。 */
function pick(object,keys){return Object.fromEntries(keys.filter(k=>object && Object.prototype.hasOwnProperty.call(object,k)).map(k=>[k,object[k]]))}
/** 统计窗口名称统一复用字典，原始日期仅使用回包time.windows。 */
function windowLabel(key){return dictionaryLabel('data.window',key,key)}
/** 广告报告中文名称取共享字典，未知分类明确保留原代码供核对。 */
function reportLabel(key){return dictionaryLabel('ads.report',key,`未配置报告类型（${key}）`)}
/** 判断完整文案或摘要是否真的提供了字段；空数组与缺字段不同。 */
function hasField(row,field){return Object.prototype.hasOwnProperty.call(row.fields || row.key_fields || {},field)}
/** 原值直接供全文阅读；不能从其他记录补全概览省略的文案。 */
function listingValue(row,field){return (row.fields || row.key_fields || {})[field]}
/** 限制只读本次返回的规则，不推断或更新实际亚马逊规范。 */
function policyText(policy){return Object.entries(policy).filter(([k])=>['min_chars','max_chars','min_items','max_items','max_utf8_bytes','help'].includes(k)).map(([k,v])=>`${fieldLabel(k)}：${v}`).join('；')}
/** 历史主区只提取真实行动/状态/观察字段；完整对象另行折叠保存。 */
function mainRecord(row){
  if(row.record){const record={...row.record};for(const key of ['previous_value','new_value']){if(typeof record[key]==='string'){try{record[key]=JSON.parse(record[key])}catch{/* 非JSON前后值保持原文，不能误解任意业务文本。 */}}}return record}
  return pick(row,['kind','status','phase','report_date','changed_at','confirmed_at','submitted_at','verified_at','accepted','before','after','proposed_after','subject','unit','constraints','started_on','due_on','duration_days','elapsed_days','remaining_days','observation_plan','original_reason','progress_note','question','summary','actions','note'])
}
/** 切换数据从真实窗口中优先选近7日；没有近7日只选真实第一项。 */
function reset(){window.value=windows.value.includes('d7')?'d7':windows.value[0] || '';selectedSku.value=0;adKind.value='';metricGroup.value='effect';page.value=1}
watch(()=>props.module,reset,{immediate:true})
</script>
<style scoped>
.business-section :deep(.table-cell){color:#344d6b}.business-section :deep(.value-item>b){flex-shrink:0;min-width:20px}.business-section :deep(.readable-value){font-size:14px}.business-section :deep(.el-alert){margin:14px 0}
.business-section>.source-note{margin:6px 0}.section-heading{padding-bottom:10px!important;margin-bottom:12px!important}.coverage-strip{margin:12px 0!important}
.business-section{min-width:0}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:1px solid #e9eef5;padding-bottom:14px;margin-bottom:18px}.section-heading h2{font-size:22px;margin:0 0 8px;color:#233e60}.section-heading p,.source-note,.window-note{font-size:12px;color:#7d8fa7;line-height:1.9;margin:5px 0}.source-note{white-space:pre-wrap}.coverage-strip{display:flex;gap:24px;flex-wrap:wrap;border:1px solid #e2eaf3;border-radius:8px;padding:13px 16px;color:#71849d;font-size:12px;margin:16px 0}.coverage-strip b{color:#344f70;margin-left:6px}.identity-card{background:#f2f7ff;border:1px solid #dce8f9;border-radius:12px;padding:22px;margin:20px 0}.eyebrow{font-size:11px;color:#7894b7}.identity-card h3{font-size:24px;margin:8px 0 18px}h3{font-size:16px;color:#314e70;margin:28px 0 12px}h4{font-size:14px;color:#405d80;margin:18px 0 10px}.metric-toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:20px 0 10px}.metric-toolbar .el-select{width:230px}.metric-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:22px 0}.metric-cards>div{background:#f5f8fd;border:1px solid #e6edf7;border-radius:10px;padding:18px 14px}.metric-cards span{display:block;font-size:12px;color:#7890ae;margin-bottom:12px}.metric-cards strong{font-size:20px;font-variant-numeric:tabular-nums;color:#243f62;overflow-wrap:anywhere}.empty-note,.record-time{font-size:12px;color:#8999ae;line-height:1.9;padding:10px 0}.warning-note{font-size:12px;line-height:1.9;background:#fff8ea;border-left:3px solid #efc06a;padding:12px 16px;color:#927244;margin:16px 0}.listing-card,.pricing-card,.history-card{border:1px solid #e1e9f3;border-radius:12px;padding:22px;margin:18px 0;background:#fff}.record-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.record-heading h3{margin:0}.record-heading span{color:#8699b3;font-size:12px}.listing-field{padding:8px 0 18px;border-bottom:1px solid #edf1f7}.listing-field:last-of-type{border:0}.field-policy{font-size:12px;line-height:1.8;color:#8798ae}.chat-question,.chat-answer{white-space:pre-wrap;line-height:1.9;font-size:14px;padding:16px;border-radius:8px;overflow-wrap:anywhere}.chat-question{background:#f3f0ff}.chat-answer{background:#f4f8fc}.history-card h3{margin:0 0 16px}.source-coverage,.module-original,details{margin:20px 0;font-size:12px;color:#7890ad}summary{cursor:pointer;line-height:1.8}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:50vh;overflow:auto;background:#f5f8fc;padding:16px;line-height:1.8}.el-pagination{justify-content:flex-end;margin:18px 0}@media(max-width:1000px){.metric-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.listing-card,.pricing-card,.history-card{padding:14px}.section-heading h2{font-size:19px}.metric-toolbar .el-select{width:100%}.coverage-strip{gap:12px}.metric-cards strong{font-size:17px}}
</style>
