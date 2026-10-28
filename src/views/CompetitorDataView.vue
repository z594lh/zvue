<template>
  <main class="competitor-data">
    <header class="cd-heading"><h1>竞品数据</h1><span>卖家精灵 · 已采集商品快照</span></header>
    <section class="cd-query cd-panel">
      <el-select v-model="asinDraft" filterable remote allow-create default-first-option clearable :remote-method="searchOptions" :loading="optionsLoading" placeholder="输入或选择竞品 ASIN" aria-label="搜索竞品ASIN" @change="chooseAsin" @visible-change="showOptions">
        <el-option v-for="item in options" :key="item.asin" :value="item.asin" :label="item.asin"><span>{{ item.asin }}</span><small class="cd-option-state">{{ item.has_snapshot ? '已有数据' : '尚无成功快照' }}</small></el-option>
        <template v-if="options.length < optionsTotal" #footer><el-button link :loading="optionsLoading" @click="loadMoreOptions">加载更多ASIN</el-button></template>
      </el-select>
      <el-button type="primary" :icon="Search" :loading="loading" @click="query">立即查询</el-button>
      <span class="cd-muted">仅查询已采集数据，不触发采集</span>
      <span v-if="optionsError" class="cd-error">{{ optionsError }}</span>
    </section>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-alert v-if="data.latest_attempt && data.latest_attempt.status !== 'completed'" :title="`${data.latest_attempt.record_date}：${spriteStates[data.latest_attempt.status] || data.latest_attempt.status}；${data.latest_attempt.error_message || '尚无成功结果'}`" type="warning" :closable="false" show-icon><span>下方保留可用的成功快照。</span><el-button link type="primary" @click="openHistory(activeAsin)">查看采集历史</el-button></el-alert>
    <section class="cd-results cd-panel">
      <div class="cd-toolbar">
        <div class="cd-toolbar-actions">
          <el-checkbox :model-value="allSelected" :indeterminate="selected.length > 0 && !allSelected" :disabled="!rows.length" aria-label="全选当前页" @change="selectAll" />
          <el-button type="primary" :icon="CopyDocument" :disabled="!rows.length" @click="copyAsins">复制ASIN</el-button>
          <el-button class="cd-export" :icon="Download" :disabled="!rows.length" @click="exportPage">导出本页</el-button>
          <span class="cd-count">搜索结果数：<b>{{ data.total ?? 0 }}</b></span>
          <el-tag v-if="historical" type="warning" size="small">历史快照</el-tag>
          <el-button v-if="historical" link type="primary" @click="latest">查看最新</el-button>
        </div>
        <div class="cd-sort">
          <el-select v-model="sortDraft" aria-label="排序字段"><el-option v-for="item in sortOptions" :key="item.key" :value="item.key" :label="label(item.field)" /></el-select>
          <el-select v-model="directionDraft" aria-label="排序方向"><el-option label="降序" value="desc" /><el-option label="升序" value="asc" /></el-select>
          <el-button type="primary" :disabled="loading" @click="applySort">确定</el-button>
        </div>
      </div>
      <div class="cd-scope">每个查询ASIN显示{{ historical ? '选定历史' : '最新成功' }}快照 · 指标为来源最近30天估算，金额 USD · 采集日期见商品信息 · 缺失值显示“—”</div>
      <div v-loading="loading" class="cd-table-scroll">
        <table class="cd-table">
          <colgroup><col style="width:38px"><col style="width:30px"><col style="width:300px"><col style="width:90px"><col style="width:100px"><col style="width:80px"><col style="width:80px"><col style="width:90px"><col style="width:55px"><col style="width:75px"><col style="width:65px"><col style="width:65px"><col style="width:70px"><col style="width:80px"><col style="width:50px"><col style="width:65px"><col style="width:85px"><col style="width:45px"><col style="width:95px"><col style="width:110px"><col style="width:65px"></colgroup>
          <thead><tr>
            <th></th><th>#</th><th class="cd-info-head">产品信息 <el-tooltip content="数据来自卖家精灵普通报告；查看全部字段可核对原列，页面不使用实时商城数据补值。"><span class="cd-help">数据解释</span></el-tooltip></th>
            <th>{{ label('Category BSR') }}<MetricHelp :title="label('Category BSR')" :paragraphs="tips(['Category BSR','Category BSR Increase','Category BSR Growth'])" /></th>
            <th>{{ dictionaryLabel('sellersprite.competitor_column','sales_trend') }}<MetricHelp :title="dictionaryLabel('sellersprite.competitor_column','sales_trend')" :paragraphs="columnTips('sales_trend')" /></th>
            <th class="cd-orange">{{ label('Sales') }}<br>增长率<MetricHelp :title="`${label('Sales')} / 增长率`" :paragraphs="tips(['Sales','MoM Sales Growth Rate'])" /></th>
            <th>销售额<MetricHelp title="销售额" :paragraphs="tips(['Monthly Revenue($)'])" /></th>
            <th>{{ label('Variation Sold') }}<br>{{ label('Variation Revenue($)') }}<MetricHelp :title="`${label('Variation Sold')} / ${label('Variation Revenue($)')}`" :paragraphs="tips(['Variation Sold','Variation Revenue($)'])" /></th>
            <th>{{ label('Variations') }}<MetricHelp :title="label('Variations')" :paragraphs="tips(['Variations'])" /></th>
            <th>{{ label('Price($)') }}<br>{{ label('Q&A') }}<MetricHelp :title="`${label('Price($)')} / ${label('Q&A')}`" :paragraphs="tips(['Price($)','Q&A'])" /></th>
            <th>{{ label('Ratings') }}<br>月新增<MetricHelp :title="`${label('Ratings')} / 月新增`" :paragraphs="tips(['Ratings','Monthly Rating Increase'])" /></th>
            <th>{{ label('Rating') }}<br>{{ label('Reviews Rate') }}<MetricHelp :title="`${label('Rating')} / ${label('Reviews Rate')}`" :paragraphs="tips(['Rating','Reviews Rate'])" /></th>
            <th>FBA<br>{{ label('Gross Margin') }}<MetricHelp :title="`FBA / ${label('Gross Margin')}`" :paragraphs="tips(['FBA($)','Gross Margin'])" /></th>
            <th>{{ label('Date Available') }}<MetricHelp :title="label('Date Available')" :paragraphs="tips(['Date Available'])" /></th>
            <th>{{ label('Sellers') }}<MetricHelp :title="label('Sellers')" :paragraphs="tips(['Sellers'])" /></th>
            <th>{{ label('Seller Type') }}<br>买家运费<MetricHelp :title="`${label('Seller Type')} / 买家运费`" :paragraphs="tips(['Seller Type','Delivery price($)'])" /></th>
            <th>BuyBox<br>卖家<MetricHelp title="BuyBox / 卖家" :paragraphs="tips(['BuyBox Seller','BuyBox Location'])" /></th>
            <th>LQS<MetricHelp title="LQS" :paragraphs="tips(['LQS'])" /></th>
            <th>{{ label('Weight') }}<br>{{ label('Dimension') }}<MetricHelp :title="`${label('Weight')} / ${label('Dimension')}`" :paragraphs="tips(['Weight','Dimension'])" /></th>
            <th>{{ label('Package Weight') }}<br>{{ label('Package Dimension') }}<MetricHelp :title="`${label('Package Weight')} / ${label('Package Dimension')}`" :paragraphs="tips(['Package Weight','Package Dimension'])" /></th>
            <th>操作</th>
          </tr></thead>
          <tbody>
            <template v-for="(row,index) in rows" :key="row.task_id">
              <tr class="cd-product-row">
                <td><el-checkbox :model-value="selected.includes(row.task_id)" :aria-label="`选择竞品 ${row.asin}`" @change="checked => selectRow(row.task_id,checked)" /></td><td class="cd-muted">{{ (page-1)*10+index+1 }}</td>
                <td class="cd-info">
                  <div class="cd-product">
                    <div class="cd-image-box"><div class="cd-badges"><span v-if="row.details['EBC Available'] === true" class="cd-badge cd-aplus" :title="label('EBC Available')">A+</span><span v-if="row.details['Video Available'] === true" class="cd-badge cd-video" :title="label('Video Available')">V</span></div><el-image v-if="imageUrl(row.image_url)" :src="imageUrl(row.image_url)" fit="contain" loading="lazy" :alt="row.title || row.asin"><template #error><span class="cd-image-empty">图片不可用</span></template></el-image><span v-else class="cd-image-empty">暂无图片</span><div class="cd-badges cd-badges-bottom"><span v-if="row.details[&quot;Amazon's Choice&quot;] === true" class="cd-badge cd-choice" :title="label(&quot;Amazon's Choice&quot;)">AC</span><span v-if="row.details['New Release'] === true" class="cd-badge cd-new" :title="label('New Release')">NR</span><span v-if="row.details['Best Seller'] === true" class="cd-badge cd-best" :title="label('Best Seller')">BS</span></div></div>
                    <div class="cd-product-copy"><a :href="amazonUrl(row.asin)" target="_blank" rel="noopener noreferrer" class="cd-title" :title="row.title">{{ row.title || '报告未提供标题' }}</a><div><span class="cd-muted">ASIN: </span><a :href="amazonUrl(row.asin)" target="_blank" rel="noopener noreferrer">{{ row.asin }}</a><el-button link :icon="CopyDocument" :aria-label="`复制 ${row.asin}`" @click="copyText(row.asin)" /></div><div v-if="row.query_asin !== row.asin" class="cd-query-mismatch">查询ASIN：{{ row.query_asin }}<el-tooltip content="单项导出可能选中另一变体；指标属于实际导出商品，不冒充查询商品。"><el-icon><InfoFilled /></el-icon></el-tooltip></div><div><span class="cd-muted">父ASIN: </span><a v-if="amazonUrl(row.parent_asin)" :href="amazonUrl(row.parent_asin)" target="_blank" rel="noopener noreferrer">{{ row.parent_asin }}</a><span v-else>—</span></div><div><span class="cd-muted">品牌: </span>{{ row.brand || '—' }}</div><div class="cd-snapshot"><span>采集 {{ row.record_date }}</span><el-button link type="primary" @click="openHistory(row.query_asin)">历史快照</el-button></div><div v-for="warning in row.warnings" :key="warning" class="cd-error">{{ warning }}</div></div>
                  </div>
                </td>
                <td><div :title="row.category">{{ number(row.bsr) }}</div><div :class="growthClass(row.bsr_change)">{{ signed(row.bsr_change) }}</div><div :class="growthClass(row.bsr_growth)">{{ ratio(row.bsr_growth,true) }}</div></td>
                <td><div class="cd-no-trend"><el-icon><TrendCharts /></el-icon><span>报告未提供<br>趋势序列</span></div></td>
                <td><el-tooltip :content="help('Sales')"><span class="cd-source-number">{{ number(row.monthly_sales) }}</span></el-tooltip><div :class="growthClass(row.sales_growth_mom)">{{ ratio(row.sales_growth_mom,true) }}</div></td>
                <td>{{ money(row.monthly_revenue) }}</td><td><div>{{ number(row.variation_sales) }}</div><div>{{ money(row.variation_revenue) }}</div></td><td>{{ number(row.variation_count) }}</td>
                <td><div>{{ money(row.price) }}</div><div class="cd-muted">{{ number(row.details['Q&A']) }}</div></td><td><div>{{ number(row.ratings) }}</div><div class="cd-muted">{{ number(row.rating_increase) }}</div></td><td><div>{{ number(row.rating,1) }}</div><div class="cd-muted">{{ ratio(row.reviews_rate) }}</div></td>
                <td><div>{{ money(row.fba_fee) }}</div><el-tooltip :content="help('Gross Margin')"><span class="cd-muted">{{ ratio(row.gross_margin) }}</span></el-tooltip></td><td><div>{{ row.date_available || '—' }}</div><div class="cd-muted">{{ number(row.details['Available days']) }} 天</div></td><td>{{ number(row.sellers) }}</td><td><div>{{ row.seller_type || '—' }}</div><div class="cd-muted">{{ money(row.details['Delivery price($)']) }}</div></td>
                <td><div>{{ row.buybox_seller || '—' }}</div><div class="cd-muted">{{ row.buybox_location || '—' }}</div></td><td>{{ number(row.lqs,1) }}</td>
                <td><div><el-tooltip :content="unitTip(row,'Weight(Unit Conversion)')" effect="light"><span tabindex="0" class="cd-unit-value">{{ row.details['Weight'] || '—' }}</span></el-tooltip></div><div><el-tooltip :content="unitTip(row,'Dimension(Unit Conversion)')" effect="light"><span tabindex="0" class="cd-unit-value">{{ row.details['Dimension'] || '—' }}</span></el-tooltip></div></td>
                <td><div><el-tooltip :content="unitTip(row,'Package Weight(Unit Conversion)')" effect="light"><span tabindex="0" class="cd-unit-value">{{ row.details['Package Weight'] || '—' }}</span></el-tooltip></div><div><el-tooltip :content="unitTip(row,'Package Dimension(Unit Conversion)')" effect="light"><span tabindex="0" class="cd-unit-value">{{ row.details['Package Dimension'] || '—' }}</span></el-tooltip></div><div class="cd-muted">{{ dictionaryLabel('sellersprite.product_size_tier',row.details['Product size tiers'],row.details['Product size tiers'] || '—') }}</div></td>
                <td><el-button link type="primary" @click="openSource(row)">全部字段</el-button></td>
              </tr>
              <tr class="cd-category-row"><td></td><td colspan="20"><span class="cd-muted">浏览同类目：</span><span class="cd-category-path">{{ row.category_path ? row.category_path.split(':').join(' › ') : '报告未提供类目路径' }}</span><span v-if="row.subcategory" class="cd-subcategory"><b>#{{ number(row.subcategory_bsr) }}</b> in {{ row.subcategory }}</span><span class="cd-variant-note">仅展示实际导出的商品，变体数不代表已采集所有变体</span></td></tr>
            </template>
          </tbody>
        </table>
        <el-empty v-if="!rows.length && !loading" :description="error ? '数据读取失败，请重试' : activeAsin ? '该ASIN暂无成功竞品快照，请到采集配置查看进度' : '暂无已采集竞品数据'" />
      </div>
      <footer class="cd-pagination"><span class="cd-muted">每页10条 · 翻页只读本地数据</span><el-pagination v-model:current-page="page" :page-size="10" :total="data.total || 0" layout="total, prev, pager, next" :disabled="loading" @current-change="load" /></footer>
    </section>
    <el-drawer v-model="sourceVisible" title="竞品报告 · 全部来源字段" size="min(860px,96vw)" append-to-body>
      <template v-if="sourceRow"><div class="cd-source-meta"><strong>{{ sourceRow.asin }}</strong><p>查询 {{ sourceRow.query_asin }} · 采集 {{ sourceRow.record_date }} · 最近30天 · USD</p><p>文件 {{ sourceRow.file_name }} · 报告编号 {{ sourceRow.report_id || '—' }}</p><p>SHA256：{{ sourceRow.sha256 }}</p></div><el-table :data="sourceFields" stripe border><el-table-column label="字段" width="230"><template #default="{row}"><strong>{{ label(row.code) }}</strong><div class="cd-source-code">{{ row.code }}</div></template></el-table-column><el-table-column label="报告原值" min-width="240"><template #default="{row}"><div class="cd-source-value">{{ rawValue(row.value) }}</div><small class="cd-muted">{{ dictionaryEntry('sellersprite.competitor_field',row.code)?.description }}</small></template></el-table-column></el-table><p class="cd-muted">原始单位和值保持不变；空白/NULL均显示“—”，不自动补0。</p></template>
    </el-drawer>
    <el-drawer v-model="historyVisible" :title="`采集历史 · ${historyAsin}`" size="min(900px,96vw)" append-to-body>
      <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" />
      <el-table :data="historyRows" v-loading="historyLoading" stripe><el-table-column prop="record_date" label="采集日期" width="115" /><el-table-column label="状态" min-width="140"><template #default="{row}">{{ spriteStates[row.status] || row.status }}<p class="cd-error">{{ row.error_message }}</p></template></el-table-column><el-table-column prop="selected_asin" label="实际商品ASIN" width="145" /><el-table-column label="月销量 / 价格" width="140"><template #default="{row}">{{ number(row.monthly_sales) }} / {{ money(row.price) }}</template></el-table-column><el-table-column label="操作" width="100"><template #default="{row}"><el-button v-if="row.can_view" link type="primary" @click="viewSnapshot(row)">查看快照</el-button><span v-else class="cd-muted">无可用快照</span></template></el-table-column></el-table>
      <el-pagination v-model:current-page="historyPage" :page-size="20" :total="historyTotal" layout="total, prev, pager, next" :disabled="historyLoading" @current-change="loadHistory" />
    </el-drawer>
  </main>
</template>

<script>
export default { name: 'CompetitorDataView' }
</script>
<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CopyDocument, Download, InfoFilled, Search, TrendCharts } from '@element-plus/icons-vue'
import { getCompetitorData, getCompetitorDataOptions, getCompetitorDataHistory } from '@/services/api'
import { dictionaryLabel, dictionaryEntry } from '@/utils/businessDictionary'
import { spriteStates } from '@/utils/sellersprite'
import MetricHelp from '@/components/MetricHelp.vue'

const route=useRoute(),router=useRouter(),data=ref({}),loading=ref(false),error=ref(''),page=ref(1),asinDraft=ref(''),activeAsin=ref(''),taskId=ref('')
const options=ref([]),optionsTotal=ref(0),optionsLoading=ref(false),optionsError=ref('')
const selected=ref([]),sortDraft=ref('monthly_sales'),directionDraft=ref('desc'),sort=ref('monthly_sales'),direction=ref('desc')
const sourceVisible=ref(false),sourceRow=ref(null),historyVisible=ref(false),historyAsin=ref(''),historyRows=ref([]),historyTotal=ref(0),historyPage=ref(1),historyLoading=ref(false),historyError=ref('')
const rows=computed(()=>data.value.list || []),historical=computed(()=>!!taskId.value)
const allSelected=computed(()=>rows.value.length>0 && rows.value.every(row=>selected.value.includes(row.task_id)))
const sourceFields=computed(()=>Object.entries(sourceRow.value?.raw_fields || {}).map(([code,value])=>({code,value})))
const sortOptions=[{key:'monthly_sales',field:'Sales'},{key:'monthly_revenue',field:'Monthly Revenue($)'},{key:'price',field:'Price($)'},{key:'bsr',field:'Category BSR'},{key:'ratings',field:'Ratings'},{key:'rating',field:'Rating'},{key:'date_available',field:'Date Available'}]
const label=code=>dictionaryLabel('sellersprite.competitor_field',code)
const help=code=>dictionaryEntry('sellersprite.competitor_field',code)?.description || label(code)
// 指标口径统一读取共享字典，组合列按段落显示；不维护第二份本地说明。
const tips=fields=>fields.flatMap(field=>(dictionaryEntry('sellersprite.competitor_field',field)?.description || '').split('\n\n')).filter(Boolean)
const columnTips=code=>(dictionaryEntry('sellersprite.competitor_column',code)?.description || '').split('\n\n').filter(Boolean)
// 只展示报告已提供的换算值，不执行单位换算或用其他字段补缺失。
const unitTip=(row,field)=>`${label(field)}：${row.details[field] || '来源未提供其他单位'}`
const present=value=>value!==null && value!==undefined && value!==''
const number=(value,digits=0)=>!present(value)?'—':Number.isFinite(Number(value))?Number(value).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):String(value)
const money=value=>!present(value)?'—':Number.isFinite(Number(value))?'$'+Number(value).toLocaleString('en-US',{maximumFractionDigits:2}):String(value)
const signed=value=>!present(value)?'—':(Number(value)>0?'+':'')+number(value)
const ratio=(value,showSign=false)=>!present(value)?'—':Number.isFinite(Number(value))?(showSign && Number(value)>0?'+':'')+Number(Number(value)*100).toLocaleString('en-US',{maximumFractionDigits:2})+'%':String(value)
const growthClass=value=>present(value)?Number(value)>0?'cd-positive':Number(value)<0?'cd-negative':'':''
const rawValue=value=>!present(value)?'—':typeof value==='object'?JSON.stringify(value):String(value)
const amazonUrl=asin=>/^[A-Z0-9]{10}$/.test(asin || '')?`https://www.amazon.com/dp/${asin}`:undefined
let disposed=false,revision=0,optionsRevision=0,historyRevision=0,optionsPage=1,optionQuery='',optionsSearch='',timer,lastRouteKey=''

/** 图片只接受报告中的Amazon图片域名，拒绝危险协议和任意外部主机。 */
function imageUrl(value){try{const url=new URL(value);return url.protocol==='https:' && /(^|\.)(media-amazon\.com|ssl-images-amazon\.com|images-amazon\.com)$/.test(url.hostname)?url.href:''}catch{return ''}}

/** 保留0与空值区别；只有统计表展示格式化，不改写接口返回的原始字段。 */
async function load(){
  const token=++revision;loading.value=true;error.value='';selected.value=[]
  try{const {data:response}=await getCompetitorData({asin:activeAsin.value || undefined,task_id:taskId.value || undefined,page:page.value,page_size:10,sort:sort.value,direction:direction.value});if(disposed || token!==revision)return;data.value=response.data}
  catch(err){if(!disposed && token===revision){data.value={};error.value=err.response?.data?.message || '竞品数据读取失败，请重新查询'}}
  finally{if(!disposed && token===revision)loading.value=false}
}

/** 通过URL携带查询及历史身份，支持直接访问、系统页签和刷新。 */
function applyRoute(){
  if(disposed || route.path!=='/tools/competitor-data')return
  const key=JSON.stringify([route.query.asin,route.query.task_id]);if(key===lastRouteKey)return;lastRouteKey=key
  const asin=typeof route.query.asin==='string'?route.query.asin.trim().toUpperCase():''
  const task=typeof route.query.task_id==='string'?route.query.task_id:''
  if((route.query.asin && !/^[A-Z0-9]{10}$/.test(asin)) || (route.query.task_id && (!asin || !/^\d{1,12}$/.test(task)))){++revision;loading.value=false;data.value={};error.value='ASIN或快照编号无效';return}
  activeAsin.value=asin;asinDraft.value=asin;taskId.value=task;page.value=1;load()
}

/** 支持选择现有ASIN或直接输入合法ASIN；清空查询显示全部最新成功快照。 */
function query(){
  const asin=(optionQuery || asinDraft.value || '').trim().toUpperCase()
  if(asin && !/^[A-Z0-9]{10}$/.test(asin)){ElMessage.warning('请输入10位英文字母或数字组成的ASIN');return}
  optionQuery='';asinDraft.value=asin
  if(activeAsin.value===asin && !taskId.value){page.value=1;load();return}
  router.push({path:'/tools/competitor-data',query:asin?{asin}:{}})
}
function chooseAsin(value){optionQuery='';asinDraft.value=value || '';query()}
function latest(){router.push({path:'/tools/competitor-data',query:activeAsin.value?{asin:activeAsin.value}:{}})}
function applySort(){sort.value=sortDraft.value;direction.value=directionDraft.value;page.value=1;load()}

/** 选项服务分页，不把首次50条冒充全量；并发搜索仅采纳最后一次回包。 */
async function loadOptions(append=false){
  const token=++optionsRevision;optionsLoading.value=true;optionsError.value=''
  try{const {data:response}=await getCompetitorDataOptions({search:optionsSearch,page:optionsPage,page_size:50});if(disposed || token!==optionsRevision)return;options.value=append?[...options.value,...response.data.list]:response.data.list;optionsTotal.value=response.data.total}
  catch{if(!disposed && token===optionsRevision){if(append)optionsPage--;optionsError.value='竞品ASIN列表读取失败，可直接输入ASIN查询'}}
  finally{if(!disposed && token===optionsRevision)optionsLoading.value=false}
}
function searchOptions(value){optionQuery=value;optionsSearch=value;optionsPage=1;++optionsRevision;clearTimeout(timer);timer=setTimeout(()=>loadOptions(),200)}
function showOptions(visible){if(visible){optionQuery='';optionsSearch='';optionsPage=1;loadOptions()}}
function loadMoreOptions(){if(optionsLoading.value)return;optionsPage++;loadOptions(true)}
function selectRow(id,checked){selected.value=checked?[...new Set([...selected.value,id])]:selected.value.filter(value=>value!==id)}
function selectAll(checked){selected.value=checked?rows.value.map(row=>row.task_id):[]}
const pickedRows=()=>selected.value.length?rows.value.filter(row=>selected.value.includes(row.task_id)):rows.value
async function copyText(text){try{await navigator.clipboard.writeText(text);ElMessage.success('ASIN已复制')}catch{ElMessage.warning('复制失败，请手动复制ASIN')}}
function copyAsins(){copyText([...new Set(pickedRows().map(row=>row.asin))].join('\n'))}

/** 导出本页或本页勾选行的真实来源字段，防止Excel将来源文本执行为公式。 */
function exportPage(){
  const list=pickedRows(),fields=[...new Set(list.flatMap(row=>Object.keys(row.raw_fields)))]
  const cell=value=>{let text=present(value)?String(value):'';if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'}
  const csv=[['查询ASIN','采集日期',...fields.map(field=>`${label(field)} (${field})`)],...list.map(row=>[row.query_asin,row.record_date,...fields.map(field=>row.raw_fields[field])])].map(row=>row.map(cell).join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='竞品数据_本页.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function openSource(row){sourceRow.value=row;sourceVisible.value=true}

/** 历史只查看脱敏进度；指定快照仍由后端核对其查询ASIN归属。 */
function openHistory(asin){historyAsin.value=asin;historyPage.value=1;historyRows.value=[];historyVisible.value=true;loadHistory()}
async function loadHistory(){const token=++historyRevision;historyLoading.value=true;historyError.value='';try{const {data:response}=await getCompetitorDataHistory(historyAsin.value,{page:historyPage.value});if(disposed || token!==historyRevision)return;historyRows.value=response.data.list;historyTotal.value=response.data.total}catch(err){if(!disposed && token===historyRevision){historyRows.value=[];historyTotal.value=0;historyError.value=err.response?.data?.message || '采集历史读取失败'}}finally{if(!disposed && token===historyRevision)historyLoading.value=false}}
function viewSnapshot(row){historyVisible.value=false;router.push({path:'/tools/competitor-data',query:{asin:historyAsin.value,task_id:row.id}})}
watch(()=>route.fullPath,applyRoute,{immediate:true})
onActivated(applyRoute)
onDeactivated(()=>{++revision;++optionsRevision;++historyRevision;loading.value=false;optionsLoading.value=false;historyLoading.value=false;lastRouteKey='';clearTimeout(timer);sourceVisible.value=false;historyVisible.value=false})
onBeforeUnmount(()=>{disposed=true;++revision;++optionsRevision;++historyRevision;clearTimeout(timer)})
</script>

<style scoped>
.competitor-data{--el-color-primary:#ff891a;--el-color-primary-light-3:#ffad5f;--el-color-primary-light-5:#ffc48c;--el-color-primary-light-7:#ffdbba;--el-color-primary-light-8:#ffe6d0;--el-color-primary-light-9:#fff3e8;--el-color-primary-dark-2:#dd7310;background:#f5f6f8;padding:20px 22px 30px;color:#314359;font-size:12px;max-width:2200px;margin:auto}.cd-heading{display:flex;align-items:baseline;gap:14px;margin-bottom:14px}.cd-heading h1{margin:0;font-size:22px;color:#304158}.cd-heading>span,.cd-muted{color:#98a2af}.cd-panel{background:#fff;margin-bottom:18px;border:1px solid #f0f1f4}.cd-query{padding:28px 30px;display:flex;align-items:center;flex-wrap:wrap;gap:20px;min-height:84px}.cd-query .el-select{width:340px}.cd-query .el-button{min-width:106px}.cd-option-state{float:right;color:#9ca6b2;padding-left:14px}.cd-error{color:#d9635c;font-size:12px;overflow-wrap:anywhere}.competitor-data>.el-alert{margin-bottom:16px}.cd-toolbar{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px 20px;flex-wrap:wrap}.cd-toolbar-actions,.cd-sort{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.cd-toolbar .el-button+.el-button{margin-left:0}.cd-toolbar .el-button{font-size:12px}.cd-export{color:#00b6a3;border-color:#bcebe5}.cd-count{color:#919ba8;margin-left:6px}.cd-count b{color:#ff891a;margin-left:7px}.cd-sort .el-select{width:130px}.cd-sort .el-select+.el-select{width:94px}.cd-scope{font-size:11px;color:#96a1b0;padding:0 20px 14px;line-height:1.7}.cd-table-scroll{overflow:auto;position:relative;max-height:calc(100vh - 360px);min-height:240px}.cd-table{width:100%;min-width:2066px;border-collapse:collapse;table-layout:fixed}.cd-table th{font-size:12px;font-weight:500;color:#8d96a4;background:#f8f9fb;height:56px;line-height:2;padding:0 6px;border-top:1px solid #f1f2f5;border-bottom:1px solid #e9edf3;text-align:center;position:sticky;top:0;z-index:2}.cd-table th.cd-info-head{text-align:left;padding-left:110px}.cd-help{font-size:10px;color:#ff891a;margin-left:10px;cursor:help;white-space:nowrap}.cd-table td{text-align:center;vertical-align:middle;padding:14px 6px;line-height:1.8;overflow-wrap:anywhere}.cd-table td.cd-info{text-align:left}.cd-product-row{height:172px}.cd-product-row:hover{background:#fffcf8}.cd-product-row td>div+div{margin-top:4px}.cd-product{display:flex;align-items:center;gap:13px}.cd-image-box{width:91px;flex:0 0 91px;height:130px;position:relative;padding:22px 0;box-sizing:border-box}.cd-image-box .el-image{width:91px;height:88px}.cd-image-empty{font-size:11px;color:#b2bcc9;display:flex;align-items:center;justify-content:center;height:88px}.cd-badges{position:absolute;top:0;left:3px;display:flex;gap:3px;z-index:1}.cd-badges-bottom{top:auto;bottom:0}.cd-badge{font:bold 11px Arial;color:#fff;padding:2px 3px;border-radius:3px}.cd-aplus,.cd-new,.cd-best{background:#f33d21}.cd-video{background:#00bfa5}.cd-choice{background:#1d243b}.cd-best{background:#ff891a}.cd-product-copy{flex:1;min-width:0;font-size:11px;line-height:1.8}.cd-product-copy a{color:#36546b;text-decoration:none}.cd-product-copy a:hover{color:#ff891a}.cd-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;margin-bottom:3px}.cd-product-copy .el-button{padding:0;margin-left:4px;font-size:11px;color:#a5afbd}.cd-snapshot{display:flex;align-items:center;gap:7px;color:#98a2af;font-size:10px;flex-wrap:wrap}.cd-snapshot .el-button{color:#ff891a;font-size:11px}.cd-query-mismatch{color:#b57a26}.cd-query-mismatch .el-icon{margin-left:4px}.cd-source-number{border-bottom:1px dashed #a9b4bd;cursor:help}.cd-positive{color:#12a880}.cd-negative{color:#ff5558}.cd-orange{color:#ff891a!important}.cd-no-trend{display:flex;flex-direction:column;align-items:center;gap:6px;color:#b3bcc7;font-size:11px}.cd-no-trend .el-icon{font-size:25px;color:#e2b98d}.cd-category-row td{background:#fff;border-top:1px solid #f8f8fa;border-bottom:15px solid #f5f6f8;text-align:left;padding:8px 10px;font-size:11px}.cd-category-path{color:#ff891a}.cd-subcategory{margin-left:18px;color:#8c99a9;white-space:nowrap}.cd-subcategory b{background:#ff891a;border-radius:3px;color:white;padding:1px 4px;margin-right:4px}.cd-variant-note{float:right;color:#a9b2bf;margin-left:20px}.cd-pagination{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;gap:15px;flex-wrap:wrap}.cd-source-meta{background:#f5f8fc;padding:14px;margin-bottom:16px;font-size:12px;line-height:1.8;overflow-wrap:anywhere}.cd-source-meta p{margin:5px 0;color:#8c99a9}.cd-source-code{font:11px Consolas,monospace;color:#9aa8b8;overflow-wrap:anywhere}.cd-source-value{white-space:pre-wrap;overflow-wrap:anywhere}.cd-source-meta strong{font-size:16px}.cd-source-meta~.el-table{font-size:12px}@media(max-width:760px){.competitor-data{padding:14px 10px}.cd-heading{flex-wrap:wrap;gap:6px}.cd-query{padding:18px 14px;gap:14px}.cd-query .el-select{width:100%}.cd-toolbar{padding:14px;gap:14px}.cd-sort{width:100%;gap:8px}.cd-sort .el-select{flex:1}.cd-sort .el-select+.el-select{flex:0 0 90px}.cd-scope{padding:0 14px 14px}.cd-table-scroll{max-height:540px}.cd-pagination{padding:14px}.cd-pagination>.cd-muted{display:none}}
/* 大屏一次展示截图中的所有指标，小屏保留横向滚动，不压缩数值。 */
.cd-unit-value{cursor:help;border-bottom:1px dashed #cbd3de}
@media(min-width:1800px){.cd-table{min-width:1800px}}
</style>
