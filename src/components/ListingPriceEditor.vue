<template>
  <el-dialog :model-value="true" :title="`价格编辑 · ${sku}`" width="min(920px, 96vw)" append-to-body :close-on-click-modal="false" :before-close="close">
    <div class="listing-price-editor" v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-alert v-if="historyWarning" :title="historyWarning" type="warning" :closable="false" show-icon />
      <el-alert v-if="unknown" title="上次提交结果尚未确认。请只读重查，确认前不要再次提交价格；重新读取也不会解除此保护。" type="warning" :closable="false" show-icon />
      <template v-if="snapshot">
        <div class="price-account">{{ snapshot.marketplace_id }} · {{ snapshot.currency }} · 实时读取 {{ displayTime(snapshot.fetched_at) }}</div>
        <el-alert v-if="snapshot.cache_warning" :title="snapshot.cache_warning" type="warning" :closable="false" />
        <el-alert title="普通价、促销价和企业价独立生效。默认保留；清空输入不会取消原配置。" type="info" :closable="false" show-icon />
        <el-alert v-if="snapshot.listing_status && !snapshot.listing_status.includes('BUYABLE')" title="当前Listing不可售。报价核对不代表恢复可售；本面板不修改库存、报价结束时间或上架状态。" type="warning" :closable="false" show-icon />
        <el-alert v-if="snapshot.offer_end_at" :title="`当前报价配置结束时间：${displayTime(snapshot.offer_end_at)}；本次不会自动延长。`" type="info" :closable="false" />
        <el-alert v-if="saleConfigured" :title="saleNotice" type="warning" :closable="false" show-icon />
        <el-alert v-if="snapshot.automatic_pricing" title="已绑定自动调价，普通价和上下限请先在Amazon核对规则；本页不会解除规则。" type="warning" :closable="false" />
        <details v-if="snapshot.issues.length"><summary>Amazon当前问题（{{ snapshot.issues.length }}项）</summary><ul class="price-issues"><li v-for="(issue, index) in snapshot.issues" :key="index">{{ issue.severity }} · {{ issue.code }} · {{ issue.message }}</li></ul></details>
        <div class="effective-prices">
          <span>当前普通买家实际报价：<strong>{{ actualPrice('B2C') }}</strong></span>
          <span>企业价（本次不修改）：<strong>{{ businessPrice }}</strong></span>
        </div>
        <div class="price-fields">
          <div v-for="field in fields" :key="field.key" class="price-field">
            <div class="price-label"><el-tooltip :content="field.tip" placement="top"><span>{{ field.label }} ⓘ</span></el-tooltip><small>当前 {{ amount(snapshot.fields[field.key].value) }}</small></div>
            <el-select v-model="form[field.key].mode" :aria-label="`${field.label}操作`" :disabled="locked || !canEdit(field.key)">
              <el-option label="保留" value="keep" /><el-option label="修改 / 设置" value="set" /><el-option v-if="field.key !== 'standard_price'" label="清除原配置" value="clear" />
            </el-select>
            <div class="price-value">
              <el-input-number v-if="form[field.key].mode === 'set'" v-model="form[field.key].value" :aria-label="`${field.label}金额`" :min="0" :precision="precision" :step="10 ** -precision" :disabled="locked" controls-position="right" />
              <el-tag v-else-if="form[field.key].mode === 'clear'" type="danger">{{ clearLabel }}</el-tag>
              <span v-else class="muted">保持Amazon当前配置</span>
              <small v-if="!snapshot.fields[field.key].editable">{{ snapshot.fields[field.key].note }}</small>
            </div>
            <div v-if="field.key === 'sale_price'" class="sale-dates">
              <template v-if="form.sale_price.mode === 'set'">
                <el-date-picker v-model="saleStart" type="datetime" :disabled="locked" placeholder="促销开始" aria-label="促销开始时间" />
                <span>至</span><el-date-picker v-model="saleEnd" type="datetime" :disabled="locked" placeholder="促销结束" aria-label="促销结束时间" />
                <small>按浏览器本地时区显示，提交时自动转为UTC。</small>
              </template>
              <small v-else-if="snapshot.fields.sale_price.configured">原时段：{{ displayTime(snapshot.fields.sale_price.start_at) }} 至 {{ displayTime(snapshot.fields.sale_price.end_at) }}（本地时间）</small>
            </div>
          </div>
        </div>
        <el-alert v-if="result" :title="result.message" :type="resultType" :closable="false" show-icon />
        <p v-if="submissionId" class="submission-id">Amazon提交ID：{{ submissionId }}</p>
        <ul v-if="issues.length" class="price-issues"><li v-for="(issue, index) in issues" :key="index">{{ issue.code }} · {{ issue.message }}</li></ul>
        <p v-if="unknown" class="muted">结果未确认时不能再次提交。可只读重查当前价格；确认后再结束本次核对。</p>
      </template>
    </div>
    <template #footer>
      <div class="price-footer">
        <el-button :disabled="busy" @click="loadSnapshot">重新读取价格</el-button>
        <el-button v-if="verificationToken" :loading="verifying" :disabled="sending || loading" @click="verifyOnce">只读核对结果</el-button>
        <el-button v-if="snapshot && !result && !unknown" type="primary" :loading="sending" :disabled="loading || !changed" @click="submit">确认变更并提交</el-button>
        <el-button :disabled="busy" @click="close">{{ result || unknown ? '结束核对' : '取消' }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { getAmazonListingPricing, submitAmazonListingPricing, verifyAmazonListingPricing } from '@/services/api'

const props = defineProps({ shopId: { type: [String, Number], required: true }, sku: { type: String, required: true } })
const emit = defineEmits(['close', 'updated'])
const snapshot = ref(null), loading = ref(false), sending = ref(false), verifying = ref(false), unknown = ref(false)
const error = ref(''), result = ref(null), verificationToken = ref(''), submissionId = ref(''), issues = ref([])
const historyWarning = ref('')
const saleStart = ref(null), saleEnd = ref(null), form = reactive({})
const fields = [
  { key: 'standard_price', label: '普通价', tip: '普通买家基础售价。存在有效促销时，修改普通价可能不改变当前实际售价。' },
  { key: 'sale_price', label: '促销价', tip: '仅在设定时段内生效。选择清除才会取消原促销；保留不会发送促销字段。' },
  { key: 'minimum_price', label: '最低允许价', tip: '卖家允许价格下限。清除会移除此保护项，请明确确认。' },
  { key: 'maximum_price', label: '最高允许价', tip: '卖家允许价格上限。清除会移除此保护项，请明确确认。' },
  { key: 'map_price', label: '最低广告价 MAP', tip: '商品展示价格的独立规则，不等于最低允许售价。未修改时保持不变。' }
]
for (const field of fields) form[field.key] = { mode: 'keep', value: undefined }
const busy = computed(() => loading.value || sending.value || verifying.value)
const locked = computed(() => busy.value || !!result.value || unknown.value)
const changed = computed(() => fields.some(field => form[field.key].mode !== 'keep'))
const precision = computed(() => ['JPY', 'KRW', 'VND', 'CLP'].includes(snapshot.value?.currency) ? 0 : ['BHD', 'KWD', 'OMR', 'TND', 'IQD', 'LYD'].includes(snapshot.value?.currency) ? 3 : 2)
const saleConfigured = computed(() => snapshot.value?.fields.sale_price.configured)
const saleNotice = computed(() => `Amazon已有促销价 ${amount(snapshot.value.fields.sale_price.value)}；有效时会影响普通买家的实际售价。只改普通价不会自动取消促销。`)
const businessPrice = computed(() => snapshot.value?.business_offers.map(row => `${row.price.value ?? '复杂配置'} ${row.currency || ''}`).join(' / ') || '未设置')
const resultType = computed(() => ['issues', 'conflict'].includes(result.value?.state) ? 'error' : result.value?.state === 'effective_confirmed' ? 'success' : 'warning')
const clearLabel = computed(() => unknown.value ? '结果待核实' : !result.value ? '将明确清除该项' : ['attributes_confirmed', 'effective_confirmed'].includes(result.value.state) ? '已确认清除' : '已提交清除，待核对')
let disposed = false, timer = null
onBeforeUnmount(() => { disposed = true; clearTimeout(timer) })
const storageKey = `listing-price-review:${props.shopId}:${props.sku}`
function displayTime(value) { return value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString() : '未设置' }
function amount(value) { return value == null ? '未设置' : `${value} ${snapshot.value?.currency || ''}` }
function actualPrice(type) {
  const offers = snapshot.value?.effective_offers.filter(row => row.offerType === type) || []
  return offers.map(row => `${row.price?.amount ?? '未知'} ${row.price?.currency || row.price?.currencyCode || ''}`).join(' / ') || '平台未返回'
}
function canEdit(key) { return snapshot.value?.fields[key].editable && !(snapshot.value?.automatic_pricing && ['standard_price', 'minimum_price', 'maximum_price'].includes(key)) }
function remember() {
  try { sessionStorage.setItem(storageKey, JSON.stringify({ verificationToken: verificationToken.value, submissionId: submissionId.value, unknown: unknown.value, result: result.value })) }
  catch { error.value = '浏览器未能保存核对状态，请在本窗口完成核对，不要刷新后重复提交' }
}
function acceptSnapshot(value, reset = false) {
  snapshot.value = value; emit('updated', value)
  if (reset) {
    for (const field of fields) Object.assign(form[field.key], { mode: 'keep', value: value.fields[field.key].value == null ? undefined : Number(value.fields[field.key].value) })
    saleStart.value = value.fields.sale_price.start_at ? new Date(value.fields.sale_price.start_at) : null
    saleEnd.value = value.fields.sale_price.end_at ? new Date(value.fields.sale_price.end_at) : null
  }
}
async function loadSnapshot() {
  if (busy.value) return
  loading.value = true; error.value = ''
  try {
    const response = await getAmazonListingPricing(props.sku, props.shopId)
    if (disposed) return
    if (response.data.status !== 'success') throw new Error(response.data.message || '实时价格读取失败')
    acceptSnapshot(response.data.data, true)
    // 重读不解除未知/已提交状态；避免点击重读后误重发同一请求。
  } catch (err) { if (!disposed) error.value = err.response?.data?.message || err.message || '价格读取失败' }
  finally { if (!disposed) loading.value = false }
}
function actions() {
  const payload = {}
  for (const field of fields) {
    const action = form[field.key]
    if (action.mode === 'keep') continue
    if (action.mode === 'set' && (action.value == null || !Number.isFinite(Number(action.value)) || Number(action.value) <= 0)) throw new Error(`${field.label}须填写大于0的金额；清空输入不会删除配置`)
    payload[field.key] = { mode: action.mode }
    if (action.mode === 'set') payload[field.key].value = action.value
  }
  if (payload.sale_price?.mode === 'set') {
    if (!saleStart.value || !saleEnd.value || +saleEnd.value <= +saleStart.value || +saleEnd.value <= Date.now()) throw new Error('促销起止时间无效或已过期')
    payload.sale_price.start_at = new Date(saleStart.value).toISOString(); payload.sale_price.end_at = new Date(saleEnd.value).toISOString()
  }
  return payload
}
async function submit() {
  if (busy.value || result.value || unknown.value) return
  let payload
  try {
    payload = actions()
    const summary = fields.filter(field => payload[field.key]).map(field => `${field.label}：${payload[field.key].mode === 'clear' ? '明确清除原配置' : `修改为 ${payload[field.key].value} ${snapshot.value.currency}`}`)
    if (!summary.length) return
    if (payload.sale_price?.mode === 'set') summary.push(`促销时段：${displayTime(payload.sale_price.start_at)} 至 ${displayTime(payload.sale_price.end_at)}（本地时间）`)
    await ElMessageBox.confirm(`${props.sku}\n${summary.join('\n')}\n其他价格、企业价和自动调价规则保持不变。`, '确认价格变更', { type: 'warning', confirmButtonText: '提交这些变更', cancelButtonText: '取消', customStyle: { whiteSpace: 'pre-line' } })
  } catch (err) { if (err instanceof Error) error.value = err.message; return }
  if (disposed || busy.value || result.value || unknown.value) return
  sending.value = true; error.value = ''; issues.value = []; unknown.value = true; remember()
  try {
    const response = await submitAmazonListingPricing(props.sku, { shop_id: props.shopId, version: snapshot.value.version, currency: snapshot.value.currency, actions: payload })
    const data = response.data.data
    if (response.data.status !== 'success') throw new Error(response.data.message || '未获得可靠提交结果')
    historyWarning.value = data.submission?.history_warning || ''
    // 即便用户离开页面，也留下回读凭据；恢复页面时不会再次提交价格。
    verificationToken.value = data.verification_token; submissionId.value = data.submission.submission_id
    result.value = { state: data.state, message: data.message }; unknown.value = false; remember()
    if (!disposed) { sending.value = false; await verifyOnce(); scheduleVerification(0) }
  } catch (err) {
    const body = err.response?.data
    if (body?.data?.write_state === 'rejected' || (err.response && [400, 403, 404, 409].includes(err.response.status))) { unknown.value = false; sessionStorage.removeItem(storageKey) }
    else remember()
    if (!disposed) { error.value = body?.message || err.message || '结果待核实，不要重复提交'; issues.value = body?.data?.issues || []; submissionId.value = body?.data?.submission_id || '' }
  } finally { if (!disposed) sending.value = false }
}
async function verifyOnce() {
  if (busy.value || !verificationToken.value) return
  verifying.value = true; error.value = ''
  try {
    const response = await verifyAmazonListingPricing(props.sku, { shop_id: props.shopId, verification_token: verificationToken.value })
    if (disposed) return
    if (response.data.status !== 'success') throw new Error(response.data.message || '核对未完成')
    result.value = response.data.data; issues.value = result.value.issues || []; acceptSnapshot(result.value.snapshot); remember()
    historyWarning.value = result.value.history_warning || ''
  } catch (err) { if (!disposed) error.value = err.response?.data?.message || err.message || '只读核对失败，未重新提交改价' }
  finally { if (!disposed) verifying.value = false }
}
function scheduleVerification(index) {
  if (disposed || index >= 2 || !['submitted', 'pending', 'attributes_confirmed'].includes(result.value?.state)) return
  timer = setTimeout(async () => { await verifyOnce(); scheduleVerification(index + 1) }, [3000, 8000][index])
}
async function close(done) {
  if (busy.value) return
  if ((result.value && result.value.state !== 'effective_confirmed') || unknown.value) {
    try { await ElMessageBox.confirm('结果尚未完全确认。结束后仍需到Amazon或重新读取核实；不要直接重发改价。确定结束本次核对？', '结束核对', { type: 'warning' }) }
    catch { return }
  }
  clearTimeout(timer); sessionStorage.removeItem(storageKey)
  if (typeof done === 'function') done()
  emit('close')
}
onMounted(async () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
    if (saved) { verificationToken.value = saved.verificationToken || ''; submissionId.value = saved.submissionId || ''; unknown.value = !!saved.unknown; result.value = saved.result }
  } catch { sessionStorage.removeItem(storageKey) }
  await loadSnapshot()
  if (!disposed && verificationToken.value) await verifyOnce()
})
</script>

<style scoped>
.listing-price-editor{min-height:180px}.listing-price-editor :deep(.el-alert){margin-bottom:12px}.price-account,.muted,.price-label small,.sale-dates small,.price-value small,.submission-id{color:#8492a6;font-size:12px;line-height:1.7}.price-account{margin-bottom:12px}.effective-prices{display:flex;gap:16px;flex-wrap:wrap;padding:12px 0}.price-fields{border:1px solid #e6eaf0;border-radius:8px;overflow:hidden;margin:10px 0 16px}.price-field{display:grid;grid-template-columns:180px 145px minmax(0,1fr);gap:12px;padding:14px;border-bottom:1px solid #edf0f5;align-items:center}.price-field:last-child{border-bottom:0}.price-label{font-weight:500}.price-label small,.price-value small{display:block}.price-label>span{cursor:help}.price-value :deep(.el-input-number){width:170px}.sale-dates{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.sale-dates :deep(.el-date-editor){width:215px}.price-footer{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.price-footer :deep(.el-button){margin-left:0}.price-issues{padding-left:20px;color:#c45656;font-size:12px}.submission-id{overflow-wrap:anywhere}@media(max-width:650px){.price-field{grid-template-columns:minmax(0,1fr) minmax(125px,1fr)}.price-value{grid-column:1/-1}.price-value :deep(.el-input-number){width:100%}.sale-dates :deep(.el-date-editor){width:100%}.price-footer :deep(.el-button){flex:1;min-width:120px}}
</style>
