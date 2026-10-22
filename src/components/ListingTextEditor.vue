<template>
  <div class="inline-text-editor" :data-field="field" @keydown.ctrl.enter.prevent="save()" @keydown.meta.enter.prevent="save()" @keydown.esc.stop="collapse">
    <div v-if="!editing" class="inline-text-view">
      <div class="inline-text-content"><slot /></div>
      <el-button type="primary" link size="small" @click="start">编辑</el-button>
    </div>
    <div v-else class="inline-text-form">
      <div v-if="constraints.help" class="inline-policy"><strong>{{ constraints.help }}</strong><el-tooltip :content="snapshot?.content_policy?.note || ''"><small>规范 {{ snapshot?.content_policy?.checked_on }} · {{ snapshot?.content_policy?.schema_status==='ptd_unconditional_intersection'?'已核对类目上限':'保守安全线' }}</small></el-tooltip></div>
      <div v-for="(row, index) in rows" :key="index" class="inline-text-row">
        <span v-if="field === 'bullet_point'" class="bullet-index">{{ index + 1 }}.</span>
        <div class="inline-input">
          <el-input ref="inputs" v-model="row.value" :aria-label="`${label}内容${index + 1}`" type="textarea" :autosize="{ minRows: field === 'product_description' ? 5 : 2, maxRows: 12 }" :disabled="locked" />
          <small :class="{'inline-limit-error':rowErrors(row.value).length}">{{ charCount(row.value) }}<template v-if="constraints.max_chars !== undefined"> / {{ constraints.max_chars }}</template> 字符<span v-if="constraints.max_utf8_bytes !== undefined"> · {{ byteLength(row.value) }} / {{ constraints.max_utf8_bytes }} UTF-8字节（含空格）</span></small>
        </div>
        <el-button v-if="field === 'bullet_point'" link type="danger" :disabled="locked || rows.length <= 1" @click="rows.splice(index, 1)">移除</el-button>
      </div>
      <div class="inline-actions">
        <el-button type="primary" size="small" :loading="sending" :disabled="reading || verifying || !ready || !changed || locked || writeBusy || conflict || validationErrors.length>0" @click="save()">保存</el-button>
        <el-button size="small" :disabled="sending" @click="collapse">{{ result || unknown ? '收起' : '取消' }}</el-button>
        <el-button v-if="field === 'bullet_point'" size="small" link :disabled="locked || !ready || !canAddRow" @click="addRow">添加卖点</el-button>
        <el-popconfirm v-if="field !== 'item_name' && baseline.length && !result && !unknown" :title="`确认清除${label}？此操作会提交到Amazon。`" confirm-button-text="清除" cancel-button-text="取消" @confirm="save(true)">
          <template #reference><el-button type="danger" link size="small" :disabled="!ready || locked || writeBusy || conflict">清除本项</el-button></template>
        </el-popconfirm>
        <el-tooltip content="重新读取会放弃当前草稿；普通保存无需额外确认。Ctrl / ⌘ + Enter 可保存。" placement="top">
          <el-button link size="small" :loading="reading" :disabled="sending || verifying" @click="reload">重读</el-button>
        </el-tooltip>
        <small v-if="reading">正在核对实时数据，可先编辑…</small>
        <small v-else-if="ready && !result && !unknown">Ctrl / ⌘ + Enter 保存</small>
      </div>
      <ul v-if="ready && validationErrors.length" class="inline-issues" role="alert"><li v-for="message in validationErrors" :key="message">{{ message }}</li></ul>
    </div>
    <div v-if="statusText || error || conflict || cacheWarning" class="inline-status" :class="{ 'is-error': error || conflict || result?.state === 'issues', 'is-success': result?.state === 'attributes_confirmed' }" role="status">
      <el-tooltip v-if="statusText" :content="submissionId ? `提交标识：${submissionId}；属性回读不代表商城展示即时更新。` : '结果未确认前不会自动重发修改。'">
        <span>{{ statusText }}</span>
      </el-tooltip>
      <span v-if="error">{{ error }}</span>
      <span v-if="conflict">平台内容已变化，草稿已保留。请重读最新内容后再编辑。</span>
      <span v-if="cacheWarning">{{ cacheWarning }}</span>
      <el-button v-if="token && result?.state !== 'attributes_confirmed'" link size="small" :loading="verifying" :disabled="sending || reading" @click="verify">核对结果</el-button>
      <el-popconfirm v-if="unknown || result?.state === 'issues'" title="请先到Amazon确认结果；结束后不会撤销已提交的操作，确定结束本次核对？" confirm-button-text="已核实，结束" cancel-button-text="继续核对" @confirm="endReview">
        <template #reference><el-button link size="small" :disabled="busy">结束核对</el-button></template>
      </el-popconfirm>
    </div>
    <ul v-if="issues.length" class="inline-issues"><li v-for="(issue, index) in issues" :key="index">{{ issue.code }} · {{ issue.message }}</li></ul>
    <p v-if="historyWarning" class="inline-issues">{{ historyWarning }}</p>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { submitAmazonListingText, verifyAmazonListingText } from '@/services/api'
import { listingCharCount, listingByteCount, listingRowErrors, listingDraftErrors } from '@/utils/listingContentPolicy'

const props = defineProps({
  shopId: { type: [Number, String], required: true }, sku: { type: String, required: true },
  field: { type: String, required: true }, label: { type: String, required: true },
  initialRows: { type: Array, default: () => [] }, loadSnapshot: { type: Function, required: true },
  writeBusy: { type: Boolean, default: false }
})
const emit = defineEmits(['updated', 'busy'])
const editing = ref(false), rows = ref([]), baseline = ref([]), snapshot = ref(null), inputs = ref([])
const reading = ref(false), sending = ref(false), verifying = ref(false), ready = ref(false), conflict = ref(false)
const error = ref(''), unknown = ref(false), result = ref(null), token = ref(''), submissionId = ref(''), issues = ref([]), cacheWarning = ref('')
const historyWarning = ref('')
const storageKey = `listing-text:${props.shopId}:${props.sku}:${props.field}`
const legacyKey = `listing-text:${props.shopId}:${props.sku}`
let disposed = false, timer, readRevision = 0, legacy = false
const copy = value => JSON.parse(JSON.stringify(value))
const equal = (a, b) => JSON.stringify(a.map(row => [row.value, row.language_tag, row.marketplace_id])) === JSON.stringify(b.map(row => [row.value, row.language_tag, row.marketplace_id]))
const byteLength = listingByteCount, charCount = listingCharCount
const constraints = computed(() => snapshot.value?.fields?.[props.field]?.constraints || {})
const validationErrors = computed(() => listingDraftErrors(props.field, rows.value, snapshot.value))
const canAddRow = computed(() => rows.value.filter(row=>(row.language_tag || snapshot.value?.default_language)===snapshot.value?.default_language).length < (constraints.value.max_items || 1))
// 仅显示当前条目的限制；数字全部来自后端，计数与Python Unicode码点口径一致。
function rowErrors(value) { return listingRowErrors(value, constraints.value) }
const busy = computed(() => reading.value || sending.value || verifying.value)
const locked = computed(() => sending.value || !!result.value || unknown.value || (ready.value && !snapshot.value?.fields[props.field].editable))
const changed = computed(() => baseline.value.length || rows.value.some(row => row.value.trim()) ? !equal(rows.value, baseline.value) : false)
const statusText = computed(() => unknown.value ? '结果待核实，请勿重复提交' : verifying.value ? '正在核对…' : result.value?.state === 'attributes_confirmed' ? '已回读确认' : result.value?.state === 'issues' ? '平台处理有问题' : result.value ? '已提交，待Amazon确认' : '')
function draftFrom(values) {
  rows.value = copy(values)
  if (!rows.value.length) addRow()
}
function addRow() {
  rows.value.push({ value: '', language_tag: snapshot.value?.default_language || props.initialRows[0]?.language_tag || '', marketplace_id: snapshot.value?.marketplace_id || props.initialRows[0]?.marketplace_id || '' })
}
function remember() {
  try { sessionStorage.setItem(legacy ? legacyKey : storageKey, JSON.stringify({ token: token.value, submissionId: submissionId.value, result: result.value && { state: result.value.state }, unknown: unknown.value })) }
  catch { error.value = '核对状态无法保存，请在本页完成核对，勿刷新后重复提交' }
}
function forget() {
  try { sessionStorage.removeItem(legacy ? legacyKey : storageKey) } catch { /* 忽略浏览器存储限制 */ }
}
function accept(data) { snapshot.value = data; emit('updated', data) }
async function read(force, reset) {
  const revision = ++readRevision
  reading.value = true; error.value = ''
  const before = copy(baseline.value)
  try {
    const data = await props.loadSnapshot(force)
    if (disposed || revision !== readRevision) return
    const touched = changed.value
    const actual = data.fields[props.field].rows
    accept(data); ready.value = true
    if (reset || !touched) { baseline.value = copy(actual); draftFrom(actual); conflict.value = false }
    else if (!equal(actual, before)) conflict.value = true
    else {
      // 先显示本地草稿，实时读取完成后只补足原语言/站点，不覆盖用户已键入内容。
      rows.value.forEach(row => { row.language_tag ||= data.default_language; row.marketplace_id ||= data.marketplace_id })
    }
    if (!data.fields[props.field].editable) error.value = data.fields[props.field].note || '当前属性只读'
  } catch (err) { if (!disposed && revision === readRevision) { ready.value = false; error.value = err.response?.data?.message || err.message } }
  finally { if (!disposed && revision === readRevision) reading.value = false }
}
async function start() {
  if (sending.value) return
  if (result.value?.state === 'attributes_confirmed') { result.value = null; token.value = ''; submissionId.value = ''; forget() }
  editing.value = true; conflict.value = false
  baseline.value = copy(props.initialRows); draftFrom(baseline.value)
  await nextTick()
  inputs.value[0]?.focus()
  if (!unknown.value && !result.value) await read(false, false)
}
function collapse() { if (!sending.value) { editing.value = false; readRevision++; reading.value = false } }
async function reload() {
  if (sending.value || verifying.value) return
  await read(true, true)
}
async function save(clear = false) {
  if (disposed || busy.value || locked.value || props.writeBusy || !ready.value || conflict.value || (!clear && !changed.value)) return
  if (!clear && rows.value.some(row => !row.value.trim())) { error.value = '内容不可为空；需要清除请使用“清除本项”'; return }
  if (!clear && validationErrors.value.length) { error.value = validationErrors.value.join('；'); return }
  error.value = ''; issues.value = []
  // 同一详情内复用最新回读版本；其他字段已保存时不必为当前字段再开弹框/重新GET。
  reading.value = true
  const current = await props.loadSnapshot(false).catch(err => { error.value = err.response?.data?.message || err.message; return null })
  reading.value = false
  if (!current || disposed || sending.value || locked.value || props.writeBusy) return
  if (!equal(current.fields[props.field].rows, baseline.value)) { conflict.value = true; return }
  snapshot.value = current
  if (!clear && validationErrors.value.length) { error.value = validationErrors.value.join('；'); return }
  const action = clear ? { mode: 'clear' } : { mode: 'set', rows: copy(rows.value) }
  sending.value = true; emit('busy', true); unknown.value = true; remember()
  try {
    const response = await submitAmazonListingText(props.sku, { shop_id: props.shopId, version: current.version, changes: { [props.field]: action } })
    const data = response.data.data
    token.value = data.verification_token; submissionId.value = data.submission.submission_id
    historyWarning.value = data.submission?.history_warning || ''
    result.value = { state: data.state }; unknown.value = false; remember()
    if (!disposed) { sending.value = false; await verify(); schedule(0) }
  } catch (err) {
    const body = err.response?.data
    if (['rejected','not_sent'].includes(body?.data?.write_state) || [400, 403, 404, 409].includes(err.response?.status)) { unknown.value = false; forget() }
    else remember()
    if (!disposed) {
      error.value = body?.message || err.message; issues.value = body?.data?.issues || []
      if (err.response?.status === 409) { ready.value = false; conflict.value = true }
    }
  } finally { sending.value = false; emit('busy', false) }
}
async function verify() {
  if (disposed || sending.value || verifying.value || !token.value) return
  verifying.value = true; error.value = ''
  try {
    const response = await verifyAmazonListingText(props.sku, { shop_id: props.shopId, verification_token: token.value })
    if (disposed) return
    const data = response.data.data
    result.value = { state: data.state }; accept(data.snapshot); issues.value = data.issues || []; cacheWarning.value = data.cache_warning || ''
    historyWarning.value = data.history_warning || ''
    if (data.state === 'attributes_confirmed') { baseline.value = copy(data.snapshot.fields[props.field].rows); editing.value = false; forget() }
    else remember()
  } catch (err) { if (!disposed) error.value = err.response?.data?.message || err.message }
  finally { if (!disposed) verifying.value = false }
}
function schedule(index) {
  if (disposed || index >= 2 || !['submitted', 'pending'].includes(result.value?.state)) return
  timer = setTimeout(async () => { await verify(); schedule(index + 1) }, [4000, 10000][index])
}
function endReview() { clearTimeout(timer); forget(); token.value = ''; result.value = null; unknown.value = false; issues.value = []; error.value = ''; editing.value = false }
onMounted(() => {
  try {
    let saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
    if (!saved) { saved = JSON.parse(sessionStorage.getItem(legacyKey) || 'null'); legacy = !!saved }
    if (saved) { token.value = saved.token || ''; submissionId.value = saved.submissionId || ''; result.value = saved.result; unknown.value = !!saved.unknown }
  } catch { /* 缓存损坏不导致页面崩溃 */ }
})
onBeforeUnmount(() => { disposed = true; clearTimeout(timer); readRevision++ })
</script>

<style scoped>
.inline-policy{display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:10px;color:#426b96;font-size:12px;line-height:1.8}.inline-policy strong{font-weight:500}.inline-policy small{color:#8a9bad}.inline-input small.inline-limit-error{color:#c45656;font-weight:600}
.inline-text-editor{min-width:0;overflow-wrap:anywhere}.inline-text-view{display:flex;align-items:flex-start;gap:12px}.inline-text-content{flex:1;min-width:0}.inline-text-form{padding:10px 12px;border:1px solid #c6e2ff;background:#f8fbff;border-radius:4px}.inline-text-row{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px}.inline-input{flex:1;min-width:0}.inline-input small,.inline-actions small{color:#909399;font-size:12px}.bullet-index{padding-top:6px;color:#909399}.inline-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.inline-actions .el-button+.el-button{margin-left:0}.inline-status{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:5px;color:#b88230;font-size:12px}.inline-status.is-success{color:#529b2e}.inline-status.is-error,.inline-issues{color:#c45656}.inline-issues{padding-left:18px;font-size:12px}
</style>
