<template>
  <CpcLayout active-tab="campaigns" :shop-disabled="loading || busy || draftDirty || !!job" :breadcrumbs="breadcrumbs" @shop-change="changeShop">
    <div class="creation-wizard">
      <div class="creation-heading"><h2>{{ campaignId ? '新增广告组' : '创建 SP 广告活动' }}</h2><el-button :disabled="busy" @click="clearDraft">清空页面 / 开始新建</el-button></div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-alert type="info" :closable="false" show-icon title="配置完整前保持暂停；创建成功不等于已经投放。切换店铺前请清空草稿，已创建对象不会随清空页面而删除。" />
      <div class="account-line" v-if="meta">{{ meta.shop_name }} · {{ meta.country }} · {{ meta.currency }} · 账户时区 {{ meta.timezone }}<span>历史记录由计划任务采集</span></div>

      <el-card v-if="recent.length && !job" class="creation-card" shadow="never">
        <template #header>最近创建记录 <small>刷新或中断后可恢复本人进度，不会重新创建成功项</small></template>
        <div class="recent-list"><el-button v-for="item in recent" :key="item.id" :disabled="busy" @click="restore(item.id)">{{ item.created_at }} · {{ statusText(item.status) }} · {{ item.id.slice(0, 8) }}</el-button></div>
      </el-card>

      <template v-if="!job">
        <el-card class="creation-card" shadow="never" v-loading="loading">
          <template #header>1 · {{ campaignId ? '父活动设置（只读继承）' : '活动设置' }}</template>
          <template v-if="campaignId && meta?.campaign">
            <el-descriptions :column="2" border><el-descriptions-item label="活动">{{ meta.campaign.name }}</el-descriptions-item><el-descriptions-item label="类型">{{ form.targetingType === 'AUTO' ? '自动投放，不能创建手动组' : '手动投放，不能创建自动组' }}</el-descriptions-item><el-descriptions-item label="日预算">{{ meta.campaign.daily_budget }} {{ meta.currency }}</el-descriptions-item><el-descriptions-item label="竞价策略">{{ strategyLabel(meta.campaign.bidding?.strategy) }}</el-descriptions-item></el-descriptions>
            <p class="creation-tip">预算、日期、竞价策略及广告位调整均继承父活动，本页不会修改这些活动设置。</p>
          </template>
          <el-form v-else label-width="130px" :disabled="busy || !meta">
            <el-form-item label="活动名称"><el-input v-model="form.campaignName" maxlength="128" show-word-limit /></el-form-item>
            <el-form-item label="投放类型"><el-radio-group v-model="form.targetingType" @change="changeType"><el-radio-button value="AUTO">自动投放</el-radio-button><el-radio-button value="MANUAL">手动投放</el-radio-button></el-radio-group></el-form-item>
            <el-form-item label="每日预算"><el-input-number v-model="form.budget" :min="0.01" :precision="digits" /><span class="unit">{{ meta?.currency }}</span></el-form-item>
            <el-form-item label="竞价策略"><el-select v-model="form.strategy"><el-option v-for="(label,value) in strategies" :key="value" :label="label" :value="value" /></el-select></el-form-item>
            <el-form-item label="开始 / 结束日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" :clearable="false" /><span class="unit">至</span><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" placeholder="无结束日期" /></el-form-item>
            <el-form-item label="广告组合（可选）"><el-select v-model="form.portfolioId" clearable placeholder="不指定" @visible-change="visible => visible && loadPortfolios()"><el-option v-for="p in portfolios" :key="p.portfolioId" :label="p.name" :value="String(p.portfolioId)" /></el-select></el-form-item>
            <el-form-item label="广告位竞价调整"><div class="placement-fields"><label v-for="p in placements" :key="p.key">{{ p.label }} <el-input-number v-model="form.placements[p.key]" :min="0" :max="900" :precision="0" size="small" /> %</label></div></el-form-item>
          </el-form>
          <p class="creation-tip">金额使用账户原币，不进行汇率换算。站点预算与竞价上下限由 Amazon 进一步校验。</p>
        </el-card>

        <el-card class="creation-card" shadow="never">
          <template #header>2 · 广告组与推广商品</template>
          <el-form label-width="130px" :disabled="busy || !meta"><el-form-item label="广告组名称"><el-input v-model="form.groupName" maxlength="128" show-word-limit /></el-form-item><el-form-item label="默认竞价"><el-input-number v-model="form.defaultBid" :min="0.01" :precision="digits" /><span class="unit">{{ meta?.currency }}</span></el-form-item></el-form>
          <div class="product-columns">
            <div><div class="search-bar"><el-input v-model="productSearch" placeholder="商品名 / SKU / ASIN" clearable @keyup.enter="searchProducts(true)" /><el-button :loading="productsLoading" :disabled="!meta" @click="searchProducts(true)">搜索</el-button></div>
              <div v-for="row in productRows" :key="row.sku" class="product-row"><el-image v-if="row.main_image_url" :src="row.main_image_url" fit="contain" /><div class="product-copy"><div :title="row.item_name">{{ row.item_name || row.sku }}</div><small>{{ row.sku }} · {{ row.asin }}<br>{{ row.list_price ?? '—' }} {{ row.list_price_currency || meta?.currency }} · 资格待平台确认</small></div><el-button size="small" :disabled="selected.some(p => p.sku === row.sku) || !row.asin || row.parentage_level === 'parent'" @click="addProduct(row)">{{ selected.some(p => p.sku === row.sku) ? '已添加' : '添加' }}</el-button></div>
              <el-empty v-if="!productRows.length" description="暂无商品，请搜索或同步本店 Listing" :image-size="55" />
              <el-pagination v-model:current-page="productPage" :total="productTotal" :page-size="20" layout="total, prev, pager, next" :disabled="productsLoading" @current-change="searchProducts()" />
            </div>
            <div class="selected-products"><h4>已选择 {{ selected.length }} / 100</h4><p class="creation-tip">切换搜索、翻页不会清空已选商品；父体不可选择。</p><div v-for="row in selected" :key="row.sku" class="selected-row"><div>{{ row.item_name || row.sku }}<small>{{ row.sku }} · {{ row.asin }}</small></div><el-button text type="danger" @click="selected = selected.filter(p => p.sku !== row.sku)">移除</el-button></div></div>
          </div>
        </el-card>

        <el-card class="creation-card" shadow="never">
          <template #header>3 · {{ form.targetingType === 'AUTO' ? '自动投放' : '手动投放' }}</template>
          <template v-if="form.targetingType === 'AUTO'">
            <el-radio-group v-model="customAuto"><el-radio :value="false">统一使用默认竞价</el-radio><el-radio :value="true">四类分别竞价</el-radio></el-radio-group>
            <el-table :data="autoTargets"><el-table-column prop="label" label="类型" /><el-table-column label="启用"><template #default="{row}"><el-switch v-model="row.state" active-value="ENABLED" inactive-value="PAUSED" /></template></el-table-column><el-table-column :label="`竞价（${meta?.currency || ''}）`"><template #default="{row}"><el-input-number v-if="customAuto" v-model="row.bid" :min="0.01" :precision="digits" size="small" /><span v-else>{{ form.defaultBid }}</span></template></el-table-column></el-table>
            <p class="creation-tip">至少开启一类。系统取得真实投放 ID 后配置，不会把类型名称当作 ID；目标未出现时保留进度，稍后可继续。</p>
          </template>
          <template v-else>
            <el-radio-group v-model="form.mode"><el-radio-button value="KEYWORDS">关键词投放</el-radio-button><el-radio-button value="PRODUCTS">商品 ASIN 投放</el-radio-button></el-radio-group>
            <p class="creation-tip">本版每个手动组选择一种投放方式，最多100条。输入后点击“添加至列表”，并逐条检查竞价。</p>
            <el-input v-model="targetText" type="textarea" :rows="4" :placeholder="form.mode === 'KEYWORDS' ? '每行一个关键词' : '每行一个目标ASIN，支持空格或逗号分隔'" />
            <div class="target-actions"><el-checkbox-group v-if="form.mode === 'KEYWORDS'" v-model="matches"><el-checkbox value="BROAD">广泛</el-checkbox><el-checkbox value="PHRASE">词组</el-checkbox><el-checkbox value="EXACT">精准</el-checkbox></el-checkbox-group><span>批量竞价</span><el-input-number v-model="batchBid" :min="0.01" :precision="digits" size="small" /><el-button @click="addTargets">添加至列表</el-button></div>
            <el-table :data="form.mode === 'KEYWORDS' ? keywords : productTargets" max-height="350"><el-table-column label="关键词 / ASIN"><template #default="{row}">{{ row.keywordText || row.asin }}</template></el-table-column><el-table-column prop="matchType" label="匹配类型" /><el-table-column label="竞价"><template #default="{row}"><el-input-number v-model="row.bid" :min="0.01" :precision="digits" size="small" /></template></el-table-column><el-table-column width="80"><template #default="{$index}"><el-button text type="danger" @click="removeTarget($index)">删除</el-button></template></el-table-column></el-table>
          </template>
        </el-card>

        <el-card class="creation-card" shadow="never">
          <template #header>4 · 否定投放（可选）</template>
          <div class="target-actions"><span>作用范围</span><el-select v-model="form.negativeScope" :disabled="!!campaignId"><el-option label="仅本广告组" value="group" /><el-option v-if="!campaignId" label="整个新活动" value="campaign" /></el-select></div>
          <p class="creation-tip">已有活动新增组只添加组级否定，不修改父活动规则。活动级否定商品仅支持自动活动。</p>
          <div class="product-columns"><div><h4>否定关键词</h4><el-select v-model="form.negativeMatch"><el-option label="否定精准" value="NEGATIVE_EXACT" /><el-option label="否定词组" value="NEGATIVE_PHRASE" /></el-select><el-input v-model="negativeText" type="textarea" :rows="4" placeholder="每行一条；本次统一使用所选匹配方式" /></div><div><h4>否定商品 ASIN</h4><el-input v-model="negativeProductText" type="textarea" :rows="5" placeholder="每行一个要排除的ASIN" :disabled="form.negativeScope === 'campaign' && form.targetingType !== 'AUTO'" /></div></div>
        </el-card>
        <div class="creation-submit"><el-checkbox v-model="form.launch">配置并核验完成后启动（将可能产生广告费用）</el-checkbox><el-button type="primary" :disabled="!meta || busy" :loading="busy" @click="review">检查并确认创建</el-button></div>
      </template>

      <el-card v-else class="creation-card" shadow="never">
        <template #header>创建进度 · {{ statusText(job.status) }} <small>{{ job.completed_steps }} / {{ job.steps.length }} 步 · {{ job.id }}</small></template>
        <el-alert v-if="job.error_message" :title="job.error_message" type="warning" :closable="false" show-icon />
        <p>活动 ID：{{ job.campaign_id || '待返回' }} · 广告组 ID：{{ job.ad_group_id || '待返回' }}</p>
        <el-alert v-if="job.status === 'unknown'" type="warning" :closable="false" title="平台可能已经创建，请勿重新提交整份表单。先到Amazon核实ID，再关联本次对象；不能仅凭同名判断。" />
        <el-collapse><el-collapse-item v-for="step in job.steps" :key="step.key" :name="step.key" :title="`${step.label} · ${statusText(step.status)}`">
          <el-table v-if="step.items.length" :data="step.items" size="small"><el-table-column label="对象"><template #default="{row}">{{ itemLabel(row) }}</template></el-table-column><el-table-column prop="id" label="平台ID" /><el-table-column label="结果"><template #default="{row}">{{ statusText(row.status) }}</template></el-table-column><el-table-column prop="error" label="说明" min-width="220" /><el-table-column label="处理" width="150"><template #default="{row,$index}"><el-button v-if="row.status === 'failed'" size="small" :disabled="busy" @click="editItem(step,$index)">修正</el-button><el-button v-if="['unknown','requesting'].includes(row.status)" size="small" :disabled="busy" @click="confirmItem(step,$index)">核实关联</el-button></template></el-table-column></el-table>
          <p v-else class="creation-tip">只读核对平台结果，不重复创建对象。</p>
        </el-collapse-item></el-collapse>
        <div class="target-actions"><el-button :disabled="busy" @click="restore(job.id)">重读本地进度</el-button><el-button v-if="['ready','waiting','running'].includes(job.status)" type="primary" :loading="busy" @click="advance(false)">{{ job.status === 'waiting' ? '重新核验并继续' : '继续创建' }}</el-button><el-button v-if="job.status === 'failed'" type="warning" :loading="busy" @click="advance(true)">仅重试失败项</el-button><el-button v-if="job.status === 'complete'" type="primary" @click="goDetail">查看广告组</el-button></div>
        <p class="creation-tip">已成功项不会重发；未知结果不自动重试。已创建对象不能通过清空页面撤销。暂停、审核和商品资格可能影响后续投放。</p>
      </el-card>
    </div>

    <el-dialog v-model="reviewOpen" title="确认创建内容" width="620px" :close-on-click-modal="false">
      <el-descriptions :column="1" border><el-descriptions-item label="店铺">{{ meta?.shop_name }} · {{ meta?.country }} · {{ meta?.currency }}</el-descriptions-item><el-descriptions-item label="活动">{{ meta?.campaign?.name || form.campaignName }} · {{ form.targetingType }}</el-descriptions-item><el-descriptions-item label="广告组">{{ form.groupName }}</el-descriptions-item><el-descriptions-item label="商品 / 投放">{{ selected.length }} 个商品 · {{ payloadTargets().length }} 条投放</el-descriptions-item><el-descriptions-item label="默认竞价">{{ form.defaultBid }} {{ meta?.currency }}</el-descriptions-item><el-descriptions-item v-if="!campaignId" label="日预算 / 策略">{{ form.budget }} {{ meta?.currency }} · {{ strategyLabel(form.strategy) }}</el-descriptions-item><el-descriptions-item label="完成后状态">{{ form.launch ? '核验后启动，可能产生费用' : '保持暂停，不启动' }}</el-descriptions-item></el-descriptions>
      <p>本次将真实创建广告对象，之后只能归档，不能彻底删除。部分失败会保留已成功对象供继续处理。</p>
      <template #footer><el-button :disabled="busy" @click="reviewOpen = false">返回修改</el-button><el-button type="primary" :loading="busy" @click="submit">{{ form.launch ? '确认创建并启动' : '确认创建并保持暂停' }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="editOpen" title="修正明确失败项" width="560px" :close-on-click-modal="false">
      <el-form v-if="editing" label-width="100px">
        <el-form-item v-if="editPayload.name !== undefined" label="名称"><el-input v-model="editPayload.name" /></el-form-item>
        <el-form-item v-if="editPayload.defaultBid !== undefined" label="默认竞价"><el-input-number v-model="editPayload.defaultBid" :min="0.01" :precision="digits" /></el-form-item>
        <el-form-item v-if="editPayload.bid !== undefined" label="竞价"><el-input-number v-model="editPayload.bid" :min="0.01" :precision="digits" /></el-form-item>
        <el-form-item v-if="editPayload.budget" label="日预算"><el-input-number v-model="editPayload.budget.budget" :min="0.01" :precision="digits" /></el-form-item>
        <el-form-item v-if="editPayload.keywordText !== undefined" label="关键词"><el-input v-model="editPayload.keywordText" /></el-form-item>
        <el-form-item v-if="editPayload.sku !== undefined" label="SKU"><el-input v-model="editPayload.sku" /></el-form-item>
        <el-form-item v-if="editPayload.asin !== undefined" label="ASIN"><el-input v-model="editPayload.asin" /></el-form-item>
        <el-form-item v-if="editPayload.expression?.[0]" label="目标ASIN"><el-input v-model="editPayload.expression[0].value" /></el-form-item>
      </el-form>
      <p class="creation-tip">只修正失败项，不改已成功对象。保存修正仅更新本地进度，之后点击“仅重试失败项”。</p>
      <template #footer><el-button @click="editOpen = false">取消</el-button><el-button type="primary" :loading="busy" @click="saveRepair">保存修正</el-button></template>
    </el-dialog>
    <el-dialog v-model="resolveOpen" title="核实未知结果并关联" width="560px" :close-on-click-modal="false">
      <el-input v-model="resolveId" placeholder="填写已在Amazon后台核实的实体ID" />
      <el-checkbox v-model="resolveConfirmed">我确认此ID对应这次提交，不是仅凭名称相同判断</el-checkbox>
      <p>此操作只回读并关联，不发送新的广告创建请求。内容、状态或归属不符将拒绝关联。</p>
      <template #footer><el-button @click="resolveOpen = false">取消</el-button><el-button type="primary" :disabled="!resolveConfirmed || !resolveId" :loading="busy" @click="saveResolve">仅回读核实并关联</el-button></template>
    </el-dialog>
  </CpcLayout>
</template>

<script setup>
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { dictionaryLabel } from '@/utils/businessDictionary'
import { ElMessage, ElMessageBox } from 'element-plus'
import CpcLayout from './CpcLayout.vue'
import { getCpcCreationMeta, getCpcCreationProducts, getCpcCreationJobs, getCpcCreationJob, startCpcCreation, runCpcCreation, repairCpcCreation, resolveCpcCreation, getCpcCreatePortfolios } from '@/services/cpc'

const props = defineProps({ campaignId: { type: String, default: '' } })
const router = useRouter(), shopId = ref(null), meta = ref(null), loading = ref(false), busy = ref(false), error = ref(''), job = ref(null), recent = ref([])
const form = reactive({}), seed = ref(''), autoSeed = ref(''), selected = ref([]), keywords = ref([]), productTargets = ref([]), autoTargets = ref([]), customAuto = ref(false)
const targetText = ref(''), matches = ref(['EXACT']), batchBid = ref(0.5), negativeText = ref(''), negativeProductText = ref(''), portfolios = ref([])
const productRows = ref([]), productSearch = ref(''), productPage = ref(1), productTotal = ref(0), productsLoading = ref(false)
const reviewOpen = ref(false), editOpen = ref(false), resolveOpen = ref(false), editing = ref(null), editPayload = ref({}), resolveId = ref(''), resolveConfirmed = ref(false)
// 可选项仍由创建API固定允许列表决定，字典只提供名称，不能增加可提交类型。
const strategies = computed(() => Object.fromEntries(['LEGACY_FOR_SALES','AUTO_FOR_SALES','MANUAL'].map(code => [code,dictionaryLabel('ads.strategy',code)])))
const placements = [{ key: 'top', label: '搜索顶部（首页）' }, { key: 'rest', label: '其余搜索结果' }, { key: 'product', label: '商品页面' }]
const digits = computed(() => meta.value?.currency === 'JPY' ? 0 : 2)
const draftDirty = computed(() => customAuto.value || JSON.stringify(autoTargets.value) !== autoSeed.value || selected.value.length > 0 || keywords.value.length > 0 || productTargets.value.length > 0 || !!targetText.value || !!negativeText.value || !!negativeProductText.value || JSON.stringify(form) !== seed.value)
const breadcrumbs = computed(() => props.campaignId ? [{ key: 'campaign', label: `广告活动：${meta.value?.campaign?.name || props.campaignId}`, to: { name: 'CpcCampaignDetail', params: { id: props.campaignId } } }] : [])
let generation = 0, productVersion = 0, disposed = false
onBeforeUnmount(() => { disposed = true; generation++; productVersion++ })
const storageKey = () => `cpc_creation:${shopId.value}:${props.campaignId || 'new'}`
function uuid() { return window.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = window.crypto.getRandomValues(new Uint8Array(1))[0] % 16; return (c === 'x' ? r : (r & 3) | 8).toString(16) }) }
function data(response) { if (response.data?.status !== 'success') throw new Error(response.data?.message || '请求未完成'); return response.data.data }
function message(exc) { return exc.response?.data?.message || exc.message || '请求未完成，请先读取原进度，勿重复创建' }
function strategyLabel(value) { return dictionaryLabel('ads.strategy',value,value || '—') }
function statusText(value) { return ({ ready: '待继续', pending: '待处理', running: '处理中', waiting: '等待回读', failed: '明确失败', unknown: '结果待确认', requesting: '发送中待核实', accepted: '平台已接受', complete: '已完成', skipped: '已跳过' })[value] || value }
function itemLabel(row) { const p = row.payload; return p.name || p.sku || p.keywordText || p.type || p.expression?.[0]?.value || p.state || '对象' }
function reset() {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  Object.assign(form, { campaignName: `SP广告-${stamp}`, groupName: `广告组-${stamp}`, targetingType: meta.value?.campaign?.targeting_type || 'AUTO', mode: 'KEYWORDS', budget: 10, defaultBid: 0.5, strategy: 'LEGACY_FOR_SALES', startDate: meta.value?.today || '', endDate: '', portfolioId: '', placements: { top: 0, rest: 0, product: 0 }, negativeScope: 'group', negativeMatch: 'NEGATIVE_EXACT', launch: false })
  seed.value = JSON.stringify(form); selected.value = []; keywords.value = []; productTargets.value = []; targetText.value = ''; negativeText.value = ''; negativeProductText.value = ''; customAuto.value = false
  autoTargets.value = ['QUERY_HIGH_REL_MATCHES', 'QUERY_BROAD_REL_MATCHES', 'ASIN_SUBSTITUTE_RELATED', 'ASIN_ACCESSORY_RELATED'].map(type => ({ type, label: dictionaryLabel('ads.auto_target',type), state: 'ENABLED', bid: 0.5 }))
  autoSeed.value = JSON.stringify(autoTargets.value)
}
reset()
async function changeShop(value) {
  const version = ++generation; productVersion++; shopId.value = value; meta.value = null; job.value = null; recent.value = []; portfolios.value = []; productRows.value = []; error.value = ''; reset()
  if (!value) return
  loading.value = true
  try {
    const result = data(await getCpcCreationMeta({ shop_id: value, ...(props.campaignId ? { campaign_id: props.campaignId } : {}) }))
    if (disposed || version !== generation) return
    meta.value = result; reset()
    const records = data(await getCpcCreationJobs({ shop_id: value }))
    if (disposed || version !== generation) return
    recent.value = records
    const saved = sessionStorage.getItem(storageKey())
    if (saved) { try { await restore(saved) } catch { /* 记录错误已展示，不自动创建 */ } }
    if (!job.value) await searchProducts(true)
  } catch (exc) { if (version === generation) error.value = message(exc) }
  finally { if (version === generation) loading.value = false }
}
async function loadPortfolios() { if (!shopId.value || portfolios.value.length) return; const version = generation; try { const result = data(await getCpcCreatePortfolios(shopId.value)); if (version === generation) portfolios.value = result } catch (exc) { ElMessage.warning(message(exc)) } }
async function searchProducts(first = false) {
  if (!meta.value) return
  if (first) productPage.value = 1
  const version = ++productVersion; productsLoading.value = true
  try { const result = data(await getCpcCreationProducts({ shop_id: shopId.value, search: productSearch.value, page: productPage.value })); if (version === productVersion && !disposed) { productRows.value = result.list; productTotal.value = result.total } } catch (exc) { if (version === productVersion) ElMessage.error(message(exc)) } finally { if (version === productVersion) productsLoading.value = false }
}
function addProduct(row) { if (selected.value.length >= 100) return ElMessage.warning('最多100个商品'); selected.value.push({ ...row }) }
function changeType() { keywords.value = []; productTargets.value = []; targetText.value = ''; form.negativeScope = 'group' }
function addTargets() {
  const target = form.mode === 'KEYWORDS' ? keywords.value : productTargets.value
  if (!targetText.value.trim() || form.mode === 'KEYWORDS' && !matches.value.length) return ElMessage.warning('请输入内容并选择匹配方式')
  const lines = form.mode === 'KEYWORDS' ? targetText.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean) : targetText.value.toUpperCase().split(/[\s,，;；]+/).filter(Boolean)
  const additions = form.mode === 'KEYWORDS' ? lines.flatMap(keywordText => matches.value.map(matchType => ({ keywordText, matchType, bid: batchBid.value }))) : lines.map(asin => ({ asin, bid: batchBid.value }))
  const key = x => x.asin || `${x.keywordText.toLowerCase()}|${x.matchType}`
  const seen = new Set(target.map(key)); let skipped = 0
  for (const row of additions) { if (seen.has(key(row))) { skipped++; continue } if (target.length >= 100) { skipped++; continue } seen.add(key(row)); target.push(row) }
  targetText.value = ''; if (skipped) ElMessage.info(`已忽略${skipped}条重复或超出上限的内容`)
}
function removeTarget(index) { (form.mode === 'KEYWORDS' ? keywords.value : productTargets.value).splice(index, 1) }
function payloadTargets() { return form.targetingType === 'AUTO' ? autoTargets.value.map(x => ({ type: x.type, state: x.state, bid: customAuto.value ? x.bid : null })) : form.mode === 'KEYWORDS' ? keywords.value : productTargets.value }
function buildPayload() {
  const lines = value => [...new Set(value.split(/\r?\n/).map(x => x.trim()).filter(Boolean))]
  return { shop_id: shopId.value, ...(props.campaignId ? { campaign_id: props.campaignId } : {}), targeting_type: form.targetingType, mode: form.targetingType === 'AUTO' ? 'AUTO' : form.mode, group_name: form.groupName, default_bid: form.defaultBid, products: selected.value.map(({ sku, asin }) => ({ sku, asin })), targets: payloadTargets(), negative_scope: form.negativeScope, negative_keywords: lines(negativeText.value).map(keywordText => ({ keywordText, matchType: form.negativeMatch })), negative_products: lines(negativeProductText.value.toUpperCase()).map(asin => ({ expression: [{ type: 'ASIN_SAME_AS', value: asin }] })), launch: form.launch, campaign: { name: form.campaignName, budget: form.budget, strategy: form.strategy, start_date: form.startDate, end_date: form.endDate, portfolio_id: form.portfolioId, placements: form.placements } }
}
function review() { if (!selected.value.length || !form.groupName.trim() || !props.campaignId && !form.campaignName.trim()) return ElMessage.warning('请填写名称并选择商品'); if (targetText.value.trim()) return ElMessage.warning('投放输入区还有未添加内容，请先添加至列表'); if (!payloadTargets().length) return ElMessage.warning('至少配置一条投放'); reviewOpen.value = true }
async function submit() {
  if (busy.value) return
  busy.value = true; error.value = ''
  let id = sessionStorage.getItem(storageKey()); if (!id) { id = uuid(); sessionStorage.setItem(storageKey(), id) }
  try { job.value = data(await startCpcCreation({ ...buildPayload(), submission_id: id })); sessionStorage.setItem(storageKey(), job.value.id); reviewOpen.value = false } catch (exc) { error.value = message(exc); ElMessage.error(error.value) } finally { busy.value = false }
  if (job.value) await advance(false)
}
async function advance(retry) {
  if (busy.value || !job.value) return
  busy.value = true; error.value = ''
  try {
    for (let count = 0; count < 30 && !disposed; count++) {
      job.value = data(await runCpcCreation(job.value.id, { shop_id: shopId.value, retry_failed: retry && count === 0 }))
      if (job.value.status !== 'ready') break
    }
    if (job.value.status === 'complete') ElMessage.success(job.value.configuration.launch ? '创建及启动核验完成，实际投放仍受平台资格和审核影响' : '创建核验完成，已保持暂停')
  } catch (exc) { error.value = message(exc); ElMessage.error(error.value) } finally { busy.value = false }
}
async function restore(id) {
  if (busy.value) return
  busy.value = true
  try { const result = data(await getCpcCreationJob(id, shopId.value)); if (props.campaignId && result.configuration.campaign_id !== props.campaignId) throw new Error('该记录不属于本页面父活动，请到创建活动入口恢复'); job.value = result; sessionStorage.setItem(storageKey(), id); error.value = '' } catch (exc) { if (exc.response?.status === 404) sessionStorage.removeItem(storageKey()); else error.value = message(exc) } finally { busy.value = false }
}
async function clearDraft() {
  if (busy.value) return
  try { await ElMessageBox.confirm('仅清空当前页面草稿，不会删除、暂停或归档Amazon对象。已保存进度可从最近记录恢复。', '清空页面', { type: 'warning' }) } catch { return }
  if (shopId.value) sessionStorage.removeItem(storageKey()); job.value = null; reset(); error.value = ''
  const version = generation
  if (meta.value) { try { const records = data(await getCpcCreationJobs({ shop_id: shopId.value })); if (version === generation && !disposed) recent.value = records } catch (exc) { ElMessage.warning(message(exc)) } }
}
function editItem(step, index) { editing.value = { step, index }; editPayload.value = JSON.parse(JSON.stringify(step.items[index].payload)); editOpen.value = true }
async function saveRepair() { busy.value = true; try { job.value = data(await repairCpcCreation(job.value.id, { shop_id: shopId.value, index: editing.value.index, payload: editPayload.value })); editOpen.value = false } catch (exc) { ElMessage.error(message(exc)) } finally { busy.value = false } }
function confirmItem(step, index) { editing.value = { step, index }; resolveId.value = step.items[index].id || ''; resolveConfirmed.value = false; resolveOpen.value = true }
async function saveResolve() { busy.value = true; try { job.value = data(await resolveCpcCreation(job.value.id, { shop_id: shopId.value, index: editing.value.index, entity_id: resolveId.value })); resolveOpen.value = false } catch (exc) { ElMessage.error(message(exc)) } finally { busy.value = false } }
function goDetail() { router.push({ name: 'CpcGroupDetail', params: { id: job.value.campaign_id, adGroupId: job.value.ad_group_id } }) }
</script>

<style scoped>
.creation-wizard { max-width: 1240px; margin: 0 auto; padding-bottom: 30px; }
.search-bar { flex-wrap:nowrap; }.search-bar :deep(.el-input) { flex:1; width:0; min-width:100px; }
.creation-heading,.account-line,.target-actions,.search-bar,.creation-submit { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.creation-heading { justify-content:space-between; }.creation-heading h2{font-size:21px}.account-line{padding:16px 0;color:#506078}.account-line span,small,.creation-tip{font-size:12px;color:#8492a6}.creation-card{margin:16px 0}.creation-card small{margin-left:10px}.creation-card :deep(.el-card__header){font-weight:600}.creation-card :deep(.el-select){width:240px}.creation-card :deep(.el-input){max-width:650px}.unit{margin:0 10px}.placement-fields{display:flex;gap:12px;flex-wrap:wrap}.placement-fields label{white-space:nowrap}.placement-fields :deep(.el-input-number){width:120px}.product-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px}.product-row,.selected-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #edf0f5}.product-row :deep(.el-image){width:45px;height:45px;flex-shrink:0}.product-copy{flex:1;min-width:0}.product-copy>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.selected-products{background:#f7f9fc;padding:0 15px}.selected-row>div{flex:1;overflow-wrap:anywhere}.selected-row small{display:block}.creation-tip{line-height:1.8}.target-actions{margin:14px 0}.creation-submit{background:#fff;padding:18px;justify-content:space-between;border:1px solid #e6eaf0}.recent-list{display:flex;gap:8px;flex-wrap:wrap}.recent-list .el-button{margin-left:0}.creation-wizard :deep(.el-form-item__content){gap:5px}.creation-wizard :deep(.el-alert){margin-bottom:12px}.creation-wizard :deep(.el-table){font-variant-numeric:tabular-nums}
@media(max-width:800px){.product-columns{grid-template-columns:1fr}.creation-wizard :deep(.el-form-item__label){width:100px!important}.creation-wizard :deep(.el-form-item__content){min-width:0}.creation-wizard :deep(.el-pagination){overflow-x:auto}.creation-wizard{min-width:0}}
</style>
