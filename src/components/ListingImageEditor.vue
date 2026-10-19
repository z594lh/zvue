<template>
  <section class="listing-image-editor">
    <header class="image-heading">
      <div class="image-heading-title"><h4>图片管理</h4>
        <span v-if="!editing" ref="editTipAnchor" class="edit-entry">
          <el-popover :visible="editTipVisible" placement="bottom-start" :width="280" popper-class="listing-image-edit-tip">
            <template #reference><el-button type="primary" :icon="Edit" @click="open">{{ result || unknown ? '查看提交进度' : '编辑图片' }}</el-button></template>
            <div class="edit-tip-copy"><strong>现在可以编辑图片了</strong><p>点击这里，上传、替换或调整图片顺序。</p></div>
            <div class="edit-tip-actions"><el-checkbox :model-value="tipSuppressed" @change="suppressEditTip">不再提醒</el-checkbox><el-button text type="primary" size="small" @click="tipClosed = true">知道了</el-button></div>
          </el-popover>
        </span>
        <span class="image-count">{{ imageCount }} / 9 张</span>
        <el-tooltip content="先调整草稿，再统一保存。预览优先使用本地图片和缓存小图；图片匹配不代表商城已展示。" placement="top"><el-icon class="help-icon" tabindex="0" aria-label="图片编辑说明"><InfoFilled /></el-icon></el-tooltip>
      </div>
      <div class="heading-actions">
        <el-button v-if="!editing && !result && !unknown && hasEmptySlot" :icon="Plus" @click="openUpload">添加图片</el-button>
        <el-tooltip content="对照Amazon当前返回的目录图片；不代表本次修改已生效，日常改图不需要点击。" placement="top"><el-button text :loading="catalogLoading" @click="toggleCatalog">{{ catalogOpen ? '收起目录图' : '查看Amazon目录图' }}</el-button></el-tooltip>
      </div>
    </header>
    <div v-if="editing && !locked && (hasEmptySlot || batch)" class="upload-zone" :class="{ over: fileDragOver, disabled: busy }" @dragover.prevent="fileDragOver = true" @dragleave.self="fileDragOver = false" @drop.prevent="dropFiles">
      <el-icon class="upload-zone-icon"><UploadFilled /></el-icon>
      <div class="upload-zone-copy"><strong>{{ batch ? `正在上传 ${batch.done + 1} / ${batch.total} 张` : '拖入图片，或点击添加' }}</strong><span>JPG / PNG · 每张不超过 10MB · 自动填入空位</span></div>
      <el-button type="primary" plain :icon="Plus" :loading="!!batch" :disabled="busy || !ready || !hasEmptySlot" @click="choose(-1)">添加图片</el-button>
    </div>
    <div v-if="loading" class="image-loading"><el-icon class="is-loading"><Loading /></el-icon>正在读取最新图片…</div>
    <el-button v-if="editing && !ready && !loading" :icon="Refresh" @click="load">重试读取图片</el-button>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-alert v-if="historyWarning" :title="historyWarning" type="warning" :closable="false" show-icon />
    <el-alert v-if="unknown && !sending" title="提交结果待核实，已阻止重复提交；请先到Amazon核对。" type="warning" :closable="false" show-icon />
    <div v-if="result" class="submission-status" :class="{ problem: result.state === 'issues' }" role="status">
      <el-icon><InfoFilled /></el-icon><div><strong>{{ submissionSummary.title }}</strong><span>{{ submissionSummary.note }}</span></div>
      <el-tooltip :content="result.message" placement="top"><el-icon class="help-icon" tabindex="0" aria-label="提交状态详情"><InfoFilled /></el-icon></el-tooltip>
    </div>
    <el-alert v-if="result?.cache_warning" :title="result.cache_warning" type="warning" :closable="false" />
    <ul v-if="issues.length" class="image-errors"><li v-for="(issue, index) in issues" :key="index">{{ issue.code }} · {{ issue.message }}</li></ul>
    <div v-if="editing && !locked" class="grid-caption"><span>主图排第一，拖动手柄可交换位置</span><span v-if="changeCount" class="draft-count">{{ changeCount }} 处未保存</span></div>
    <div class="image-grid" :class="{ 'preview-grid': !editing }">
      <article v-for="card in visibleCards" :key="card.position" class="image-card" :data-position="card.position" :class="{ changed: isChanged(card.position), readonly: !card.editable, 'main-card': card.position === 'MAIN', 'drop-target': dragOverIndex === slotIndex(card) && dragIndex !== null && dragIndex !== slotIndex(card), removed: !card.url && isChanged(card.position) }" @dragover.prevent="dragOverIndex = slotIndex(card)" @dragleave.self="dragOverIndex = null" @drop.stop.prevent="onDrop($event, slotIndex(card))">
        <div class="image-card-title"><span class="position-label">{{ positionLabel(card.position) }}</span>
          <div class="card-tools">
            <el-tooltip v-if="editing && (isChanged(card.position) || uploadErrors[card.position]) && !locked" content="撤销这张的调整" placement="top"><button type="button" class="icon-action" :disabled="busy" :aria-label="`撤销${positionLabel(card.position)}调整`" @click="restore(slotIndex(card))"><el-icon><RefreshLeft /></el-icon></button></el-tooltip>
            <el-tooltip v-if="editing && !locked && card.url && card.editable" content="拖动交换位置" placement="top"><button type="button" class="icon-action drag-handle" :draggable="!busy" :disabled="busy" :aria-label="`拖动${positionLabel(card.position)}`" @dragstart="startDrag($event, slotIndex(card))" @dragend="endDrag"><el-icon><Rank /></el-icon></button></el-tooltip>
          </div>
        </div>
        <div v-loading="!!uploads[card.position]" element-loading-text="上传中" class="card-visual">
          <el-image v-if="displayPreview(card)" :src="displayPreview(card)" :preview-src-list="[displayPreview(card)]" fit="contain" preview-teleported loading="lazy" class="image-preview" :alt="positionLabel(card.position)"><template #error><div class="image-placeholder"><el-icon><Picture /></el-icon><span>预览暂不可用</span></div></template></el-image>
          <button v-else-if="editing && !card.url && !locked && card.editable" type="button" class="empty-slot" :disabled="busy || !ready" :aria-label="`上传${positionLabel(card.position)}`" @click="choose(slotIndex(card))"><el-icon><Plus /></el-icon><strong>{{ isChanged(card.position) ? '已移除，可重新上传' : '添加图片' }}</strong><span>{{ positionLabel(card.position) }}</span></button>
          <div v-else class="image-placeholder"><el-icon><Picture /></el-icon><span>{{ card.url ? '原图按需查看' : '暂无图片' }}</span></div>
          <span v-if="editing && !locked && isChanged(card.position)" class="draft-badge">{{ card.url ? '未保存' : '待移除' }}</span>
          <el-tooltip v-if="card.url && editing && !locked && slotIndex(card) > 0 && card.editable" content="移除图片（保存后生效）" placement="top"><button type="button" class="icon-action remove-action" :disabled="busy" :aria-label="`移除${positionLabel(card.position)}`" @click="remove(slotIndex(card))"><el-icon><Delete /></el-icon></button></el-tooltip>
        </div>
        <div v-if="card.url || locked || !card.editable" class="card-status"><el-tooltip :content="cardNote(card)" placement="top"><span class="status-label" :class="{ pending: !!result?.positions?.some(row => row.position === card.position) }">{{ cardStatus(card) }}</span></el-tooltip>
          <el-tooltip v-if="card.url" content="按需打开源图；OSS原图会产生下载流量" placement="top"><a :href="card.url" target="_blank" rel="noopener noreferrer" class="image-source-link" :aria-label="`打开${positionLabel(card.position)}源图`"><el-icon><TopRight /></el-icon></a></el-tooltip>
        </div>
        <div v-if="editing && !locked && card.url" class="image-card-actions">
          <el-button size="small" :disabled="busy || !card.editable" @click="choose(slotIndex(card))">替换</el-button>
          <el-button v-if="slotIndex(card) > 0" text size="small" :disabled="!canSwap(slotIndex(card), 0)" @click="swap(slotIndex(card), 0)">设为主图</el-button>
          <span v-else class="main-hint">商品首图</span>
        </div>
        <div v-if="editing && !locked && card.url" class="card-reorder">
          <el-tooltip content="向前交换一位" placement="top"><button type="button" class="icon-action" :disabled="!canSwap(slotIndex(card), slotIndex(card) - 1)" :aria-label="`${positionLabel(card.position)}前移`" @click="swap(slotIndex(card), slotIndex(card) - 1)"><el-icon><ArrowLeft /></el-icon></button></el-tooltip>
          <span>调整位置</span>
          <el-tooltip content="向后交换一位" placement="top"><button type="button" class="icon-action" :disabled="!canSwap(slotIndex(card), slotIndex(card) + 1)" :aria-label="`${positionLabel(card.position)}后移`" @click="swap(slotIndex(card), slotIndex(card) + 1)"><el-icon><ArrowRight /></el-icon></button></el-tooltip>
        </div>
        <small v-if="uploadErrors[card.position]" class="image-errors">{{ uploadErrors[card.position] }}</small>
        <el-button v-if="uploadErrors[card.position] && files.has(card.position)" text type="danger" size="small" :disabled="busy || locked" @click="retry(slotIndex(card))">重试上传</el-button>
      </article>
    </div>
    <div v-if="!editing && !imageCount" class="empty-gallery"><el-icon><Picture /></el-icon><span>暂无图片，点击“添加图片”开始</span></div>
    <footer v-if="editing" class="image-toolbar">
      <div class="save-summary"><strong>{{ sending ? '正在提交图片…' : locked ? '本次提交已保留' : changeCount ? `${changeCount} 个位置有调整` : '尚未修改图片' }}</strong><span>{{ locked ? '核对只读取结果，不会重复提交' : '点击保存后才会提交Amazon' }}</span></div>
      <div class="save-actions">
        <template v-if="!locked || sending"><el-button text :disabled="busy || (!changed && !hasUploadErrors)" @click="restoreAll">撤销修改</el-button><el-button :disabled="busy" @click="collapse">取消</el-button><el-button type="primary" :loading="sending" :disabled="busy || !ready || !changed || hasUploadErrors" @click="save">保存图片调整<span v-if="changeCount">（{{ changeCount }}）</span></el-button></template>
        <template v-else><el-button :disabled="busy" @click="collapse">收起</el-button><el-button v-if="result && !unknown" :disabled="busy" @click="continueEditing">继续编辑</el-button><el-button v-if="token" type="primary" plain :icon="Refresh" :loading="verifying" :disabled="busy" @click="verify">核对提交结果</el-button>
          <el-popconfirm v-if="unknown && !sending" title="请先到Amazon核对结果；结束记录不会撤销平台操作。确定已核实并结束？" confirm-button-text="已核实，结束" @confirm="endUnknown"><template #reference><el-button :disabled="busy">结束待核实记录</el-button></template></el-popconfirm>
        </template>
      </div>
    </footer>
    <input ref="fileInput" type="file" accept="image/jpeg,image/png" multiple hidden @change="onSelected" />
    <div v-if="catalogOpen" class="catalog-images"><div class="catalog-heading"><strong>Amazon目录图</strong><span>仅供对照，不代表本次提交已生效</span><el-button text :disabled="catalogLoading" @click="catalogOpen = false">收起</el-button></div><p v-if="catalog" class="image-hint">{{ catalog.message }}</p>
      <div v-if="catalogLoading" class="image-loading"><el-icon class="is-loading"><Loading /></el-icon>正在读取目录图…</div>
      <template v-if="catalog">
      <div class="image-grid"><article v-for="image in catalog.images" :key="image.variant" class="image-card"><strong>{{ image.variant }}</strong><el-image :src="image.link" :preview-src-list="[image.link]" fit="contain" preview-teleported loading="lazy" class="image-preview" /></article></div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Delete, Edit, InfoFilled, Loading, Picture, Plus, Rank, Refresh, RefreshLeft, TopRight, UploadFilled } from '@element-plus/icons-vue'
import { getAmazonListingImages, submitAmazonListingImages, verifyAmazonListingImages, getAmazonCatalogImages, uploadAmazonListingImage } from '@/services/api'

const props = defineProps({ shopId: { type: [Number, String], required: true }, sku: { type: String, required: true }, initialImages: { type: Array, default: () => [] } })
const emit = defineEmits(['updated', 'busy'])
const positions = ['MAIN', ...Array.from({ length: 8 }, (_, i) => `PT${String(i + 1).padStart(2, '0')}`)]
const editing = ref(false), snapshot = ref(null), cards = ref([]), loading = ref(false), sending = ref(false), verifying = ref(false), catalogLoading = ref(false)
const uploads = reactive({}), uploadErrors = reactive({}), files = new Map(), blobs = new Set(), fileInput = ref(null), chosenIndex = ref(-1), dragIndex = ref(null)
const error = ref(''), issues = ref([]), result = ref(null), unknown = ref(false), token = ref(''), submissionId = ref(''), catalog = ref(null)
const historyWarning = ref('')
const catalogOpen = ref(false), fileDragOver = ref(false), dragOverIndex = ref(null), batch = ref(null)
const editTipAnchor = ref(null), tipInView = ref(false), tipClosed = ref(false), tipSuppressed = ref(true)
const editTipKey = 'listing-images-edit-tip-dismissed-v1'
const editTipVisible = computed(() => tipInView.value && !tipClosed.value && !tipSuppressed.value && !editing.value && !result.value && !unknown.value)
const storageKey = `listing-images:${props.shopId}:${props.sku}`
let disposed = false, timer, tipObserver
const copy = value => JSON.parse(JSON.stringify(value))
const busy = computed(() => loading.value || sending.value || verifying.value || !!batch.value || Object.values(uploads).some(Boolean))
const locked = computed(() => !!result.value || unknown.value || sending.value)
const visibleCards = computed(() => editing.value ? cards.value : cards.value.filter(card => card.url))
const changed = computed(() => !!snapshot.value && cards.value.some(card => isChanged(card.position)))
const hasUploadErrors = computed(() => Object.values(uploadErrors).some(Boolean))
const ready = computed(() => !!snapshot.value && !loading.value)
const imageCount = computed(() => cards.value.filter(card => card.url).length)
const changeCount = computed(() => snapshot.value ? cards.value.filter(card => isChanged(card.position)).length : 0)
const hasEmptySlot = computed(() => cards.value.some(card => !card.url && card.editable))
const submissionSummary = computed(() => ({
  submitted: { title: '已提交，等待核对', note: 'Amazon展示可能有延迟，可稍后核对' },
  pending: { title: '已提交，等待图片回读', note: '保留新图预览，不用目录旧图替代' },
  attributes_confirmed: { title: '提交链接已确认', note: '图片处理与商城展示尚未确认' },
  image_matched: { title: '已匹配Amazon候选图', note: '系统相似比对通过，商城展示尚未确认' },
  issues: { title: '图片处理需要关注', note: '请查看下方平台问题，不会自动重发' }
}[result.value?.state] || { title: '提交记录已保留', note: '请核对处理进度' }))
const slotIndex = card => positions.indexOf(card.position)
const positionLabel = position => position === 'MAIN' ? '主图' : `副图 ${Number(position.slice(2))}`
function suppressEditTip(checked) {
  tipSuppressed.value = checked
  try { if (checked) localStorage.setItem(editTipKey, '1'); else localStorage.removeItem(editTipKey) }
  catch { ElMessage.warning('浏览器未允许保存提醒设置，下次可能仍会提示') }
}
function syncEditTipPreference(event) { if (event.key === editTipKey || event.key === null) tipSuppressed.value = event.newValue === '1' }
// 等按钮滚到可视区域再显示气泡，避免详情刚打开时气泡漂在其他内容上。
watch(editTipAnchor, anchor => {
  tipObserver?.disconnect(); tipInView.value = false
  if (!anchor || typeof IntersectionObserver === 'undefined') return
  tipObserver = new IntersectionObserver(entries => { tipInView.value = !!entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.8 }, { threshold: [0, 0.8, 1] })
  tipObserver.observe(anchor)
}, { flush: 'post' })
function initialCards() {
  return positions.map((position, index) => {
    const image = props.initialImages.find(row => row.image_type === (index ? `other_${index}` : 'main'))
    return { position, url: image?.media_location || null, preview_url: smallPreview(image?.media_location), editable: true }
  })
}
function smallPreview(url) {
  if (!url) return null
  if (url.includes('/amazon/listing/images/managed/') && /\/original\.(jpg|png)$/.test(url)) return url.replace(/\/original\.(jpg|png)$/, '/preview.jpg')
  return url.includes('.aliyuncs.com/') ? null : url.startsWith('https://') ? url : null
}
function isChanged(position) { return !!snapshot.value && cards.value.find(card => card.position === position)?.url !== snapshot.value.slots.find(card => card.position === position)?.url }
function displayPreview(card) {
  const item = result.value?.positions?.find(row => row.position === card.position)
  return item?.content_comparison?.matched ? item.actual_url : card.local_preview || card.preview_url
}
function cardNote(card) {
  if (!card.editable) return '多实例或复杂图片配置，本版只读，请在Amazon核对'
  const item = result.value?.positions?.find(row => row.position === card.position)
  if (item?.content_comparison?.matched) return 'Amazon候选图相似匹配（系统比对）'
  if (item?.matched) return '提交链接已回读；展示未确认'
  if (item) return '本次提交待核对，未使用目录旧图替代'
  if (card.local_preview) return '本地预览 · 不下载OSS原图'
  if (card.preview_url?.includes('/preview.jpg')) return '缓存小图预览'
  return card.url ? '当前回读图片，不代表刚提交的新图' : '可拖入或选择图片'
}
function cardStatus(card) {
  if (uploadErrors[card.position]) return '上传未完成'
  if (!card.editable) return '复杂配置 · 只读'
  const item = result.value?.positions?.find(row => row.position === card.position)
  if (item?.content_comparison?.matched) return 'Amazon图已匹配'
  if (item?.matched) return '链接已确认'
  if (item) return '等待回读'
  if (card.local_preview) return '本地预览'
  if (card.preview_url?.includes('/preview.jpg')) return '缓存小图'
  return card.url ? '当前图片' : '空位置'
}
function remember() {
  try { sessionStorage.setItem(storageKey, JSON.stringify({ token: token.value, submissionId: submissionId.value, result: result.value, unknown: unknown.value,
    snapshot: snapshot.value, cards: cards.value.map(card => { const stored = { ...card }; delete stored.local_preview; return stored }) })) }
  catch { error.value = '浏览器无法保存核对记录，请在本页完成核对，不要刷新后重复提交' }
}
function forget() { try { sessionStorage.removeItem(storageKey) } catch { /* 忽略存储限制 */ } }
async function open() { tipClosed.value = true; editing.value = true; if (!unknown.value && !result.value) await load() }
async function openUpload() { await open(); if (ready.value && !locked.value && hasEmptySlot.value) choose(-1) }
async function load() {
  if (busy.value) return
  loading.value = true; error.value = ''
  try {
    const response = await getAmazonListingImages(props.sku, props.shopId)
    if (!disposed) { snapshot.value = response.data.data; cards.value = copy(snapshot.value.slots); files.clear(); emit('updated', snapshot.value); for (const key of Object.keys(uploadErrors)) delete uploadErrors[key] }
  } catch (err) { if (!disposed) error.value = err.response?.data?.message || err.message }
  finally { if (!disposed) loading.value = false }
}
function choose(index) { if (locked.value || busy.value) return; chosenIndex.value = index; fileInput.value.click() }
async function onSelected(event) { const selected = [...event.target.files]; event.target.value = ''; await addFiles(selected, chosenIndex.value) }
function startDrag(event, index) {
  if (busy.value || locked.value || !ready.value) { event.preventDefault(); return }
  dragIndex.value = index; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', positions[index])
}
function endDrag() { dragIndex.value = null; dragOverIndex.value = null }
async function dropFiles(event) { fileDragOver.value = false; if (event.dataTransfer.files.length) await addFiles([...event.dataTransfer.files], -1) }
async function onDrop(event, index) {
  dragOverIndex.value = null
  if (!editing.value || locked.value || busy.value) return
  if (event.dataTransfer.files.length) await addFiles([...event.dataTransfer.files], index)
  else if (dragIndex.value !== null && index >= 0) { swap(dragIndex.value, index); endDrag() }
}
async function addFiles(selected, index) {
  if (locked.value || busy.value || !ready.value || !selected.length) return
  batch.value = { done: 0, total: selected.length }; error.value = ''; emit('busy', true)
  try {
    for (let i = 0; i < selected.length; i++) {
      batch.value.done = i
      const target = i === 0 && index >= 0 ? index : cards.value.findIndex(card => !card.url && !uploads[card.position] && card.editable)
      if (target < 0) { error.value = '图片位置已满，最多9张；可逐张替换，不会覆盖其他位置'; return }
      await upload(selected[i], target)
      if (uploadErrors[positions[target]] || disposed) return
    }
  } finally { batch.value = null; emit('busy', Object.values(uploads).some(Boolean) || sending.value) }
}
async function upload(file, index) {
  if (locked.value || !cards.value[index]?.editable) return
  const position = positions[index]
  if (!['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) { uploadErrors[position] = '请选择不超过10MB的JPEG/PNG图片'; return }
  uploads[position] = true; uploadErrors[position] = ''; files.set(position, file); emit('busy', true)
  const preview = URL.createObjectURL(file); blobs.add(preview)
  try {
    const form = new FormData(); form.append('image', file); form.append('shop_id', props.shopId); form.append('sku', props.sku); form.append('position', position)
    const response = await uploadAmazonListingImage(form)
    if (!disposed) cards.value[index] = { position, editable: true, ...response.data.data, local_preview: preview }
  } catch (err) { if (!disposed) uploadErrors[position] = err.response?.data?.message || '上传未完成，请核对后手动重试' }
  finally { uploads[position] = false; emit('busy', Object.values(uploads).some(Boolean) || sending.value || !!batch.value) }
}
async function retry(index) { const file = files.get(positions[index]); if (file) await upload(file, index) }
function canSwap(first, second) {
  if (locked.value || busy.value || !ready.value || first === second || !cards.value[first]?.editable || !cards.value[second]?.editable || !cards.value[first]?.url) return false
  return (first !== 0 && second !== 0) || !!cards.value[second].url
}
function swap(first, second) {
  if (!canSwap(first, second)) return
  const before = cards.value[first], after = cards.value[second]
  cards.value[first] = { ...after, position: positions[first] }; cards.value[second] = { ...before, position: positions[second] }
}
function remove(index) { if (!locked.value && !busy.value && index > 0) { cards.value[index] = { position: positions[index], editable: true, url: null, preview_url: null }; delete uploadErrors[positions[index]] } }
function restore(index) {
  if (busy.value || locked.value || !snapshot.value) return
  cards.value[index] = copy(snapshot.value.slots[index]); delete uploadErrors[positions[index]]; files.delete(positions[index])
}
function restoreAll() {
  if (busy.value || locked.value || !snapshot.value) return
  cards.value = copy(snapshot.value.slots); files.clear(); error.value = ''; issues.value = []
  for (const key of Object.keys(uploadErrors)) delete uploadErrors[key]
}
async function save() {
  if (busy.value || locked.value || !changed.value || hasUploadErrors.value) return
  const changes = {}
  for (const card of cards.value) if (isChanged(card.position)) changes[card.position] = card.url ? { mode: 'set', url: card.url, asset_token: card.asset_token } : { mode: 'clear' }
  sending.value = true; unknown.value = true; error.value = ''; issues.value = []; remember(); emit('busy', true)
  try {
    const response = await submitAmazonListingImages(props.sku, { shop_id: props.shopId, version: snapshot.value.version, changes })
    const data = response.data.data; token.value = data.verification_token; submissionId.value = data.submission.submission_id; result.value = data; unknown.value = false; remember()
    historyWarning.value = data.submission?.history_warning || ''
    if (!disposed) { sending.value = false; await verify(); schedule(0) }
  } catch (err) {
    const body = err.response?.data
    if (body?.data?.write_state === 'rejected' || [400, 403, 404, 409].includes(err.response?.status)) { unknown.value = false; forget() }
    else remember()
    if (!disposed) { error.value = body?.message || err.message; issues.value = body?.data?.issues || [] }
  } finally { sending.value = false; emit('busy', false) }
}
async function verify() {
  if (disposed || busy.value || !token.value) return
  verifying.value = true; error.value = ''
  try {
    const response = await verifyAmazonListingImages(props.sku, { shop_id: props.shopId, verification_token: token.value })
    if (!disposed) { result.value = response.data.data; token.value = result.value.verification_token || token.value; issues.value = result.value.issues || []; historyWarning.value = result.value.history_warning || ''; emit('updated', result.value.snapshot); remember() }
  } catch (err) { if (!disposed) error.value = err.response?.data?.message || err.message }
  finally { if (!disposed) verifying.value = false }
}
function schedule(index) {
  if (disposed || index >= 2 || !['submitted', 'pending', 'attributes_confirmed', 'image_matched'].includes(result.value?.state)) return
  timer = setTimeout(async () => { await verify(); schedule(index + 1) }, [10000, 30000][index])
}
function collapse() { if (busy.value) return; editing.value = false; if (!unknown.value && !result.value) { cards.value = initialCards(); snapshot.value = null; files.clear() } }
async function continueEditing() { if (busy.value || unknown.value) return; clearTimeout(timer); result.value = null; token.value = ''; forget(); await load() }
async function endUnknown() { unknown.value = false; result.value = null; token.value = ''; forget(); await load() }
async function loadCatalog() {
  if (catalogLoading.value) return
  catalogLoading.value = true
  try { const response = await getAmazonCatalogImages(props.sku, props.shopId); if (!disposed) catalog.value = response.data.data }
  catch (err) { if (!disposed) error.value = err.response?.data?.message || '目录读取未完成，不代表提交失败' }
  finally { if (!disposed) catalogLoading.value = false }
}
async function toggleCatalog() { catalogOpen.value = !catalogOpen.value; if (catalogOpen.value && !catalog.value) await loadCatalog() }
onMounted(() => {
  cards.value = initialCards()
  try { tipSuppressed.value = localStorage.getItem(editTipKey) === '1' } catch { tipSuppressed.value = false }
  window.addEventListener('storage', syncEditTipPreference)
  try { const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); if (saved) { snapshot.value = saved.snapshot; cards.value = saved.cards; token.value = saved.token || ''; submissionId.value = saved.submissionId || ''; result.value = saved.result; unknown.value = !!saved.unknown } } catch { /* 缓存损坏不影响页面 */ }
})
onBeforeUnmount(() => { disposed = true; clearTimeout(timer); tipObserver?.disconnect(); window.removeEventListener('storage', syncEditTipPreference); for (const blob of blobs) URL.revokeObjectURL(blob) })
</script>

<style scoped>
.listing-image-editor{--image-blue:#3977cf;--image-border:#e4e9f0;color:#303b4a}
.image-heading,.image-heading-title,.heading-actions,.image-toolbar,.save-actions,.image-card-title,.card-tools,.image-card-actions,.card-status,.card-reorder,.catalog-heading{display:flex;align-items:center;gap:8px}
.image-heading-title{flex-wrap:wrap}.edit-entry{display:inline-flex;flex-shrink:0}.edit-entry .el-button{margin-left:2px}.edit-tip-copy strong{color:#303b4a;font-size:14px}.edit-tip-copy p{margin:8px 0 12px;font-size:12px;color:#7c8a9e;line-height:1.6}.edit-tip-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.edit-tip-actions :deep(.el-checkbox__label){font-size:12px}
.image-heading{justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px}.image-heading-title h4{margin:0!important}.image-count{padding:3px 9px;background:#f1f5fa;border-radius:12px;font-size:12px;color:#627187;white-space:nowrap}.help-icon{font-size:14px;color:#93a1b4;cursor:help;flex-shrink:0}.heading-actions{flex-wrap:wrap}.heading-actions .el-button+.el-button,.save-actions .el-button+.el-button,.image-card-actions .el-button+.el-button{margin-left:0}
.upload-zone{display:flex;align-items:center;gap:14px;padding:18px 20px;background:#f7faff;border:1px dashed #a9c7ef;border-radius:10px;transition:background .15s,border-color .15s}.upload-zone.over:not(.disabled){background:#eaf3ff;border-color:#3977cf}.upload-zone.disabled{opacity:.7}.upload-zone-icon{font-size:32px;color:#6c9edc}.upload-zone-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}.upload-zone-copy strong{font-size:14px;font-weight:500}.upload-zone-copy span{font-size:12px;color:#7e8da1}
.grid-caption{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:14px 0 10px;font-size:12px;color:#8491a3}.draft-count{color:#b77b18}.image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:12px}.image-card{min-width:0;overflow:hidden;border:1px solid var(--image-border);border-radius:9px;background:#fff;transition:border-color .15s,box-shadow .15s}.image-card:hover{border-color:#bacce3;box-shadow:0 3px 12px #173f7310}.image-card.main-card{border-color:#aac7eb}.image-card.changed{border-color:#e8bc69}.image-card.drop-target{border-color:#3977cf;box-shadow:0 0 0 3px #3977cf25}.image-card.readonly{background:#f6f7f9}.image-card.removed{border-style:dashed;background:#fffcf7}.image-card-title{justify-content:space-between;min-height:38px;padding:3px 10px;border-bottom:1px solid #f0f3f7}.position-label{font-size:12px;font-weight:600;color:#657287}.main-card .position-label{color:#3977cf}.card-tools{gap:0}.card-visual{position:relative;margin:10px;aspect-ratio:1/1;background:#fafbfd;border-radius:5px}.image-preview{display:block;width:100%;height:100%;border-radius:5px}.image-preview :deep(img){padding:3px;box-sizing:border-box}.image-placeholder,.empty-slot{box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#99a5b5;background:#f7f9fc;font-size:12px}.image-placeholder .el-icon{font-size:30px}.empty-slot{border:1px dashed #dbe2ed;border-radius:5px;cursor:pointer;font:inherit;font-size:12px;transition:background .15s}.empty-slot:not(:disabled):hover{background:#eef5ff;border-color:#a9c7ef;color:#3977cf}.empty-slot .el-icon{font-size:28px}.empty-slot strong{font-weight:500}.empty-slot span{font-size:11px;color:#a0acba}.empty-slot:disabled{cursor:not-allowed}.draft-badge{position:absolute;left:5px;top:5px;background:#fff5dc;color:#ae7717;border:1px solid #f0d391;border-radius:4px;font-size:11px;padding:2px 6px;pointer-events:none}.icon-action{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:28px;height:28px;padding:0;border:0;border-radius:5px;background:transparent;color:#77899f;font-size:16px;cursor:pointer}.icon-action:hover:not(:disabled){color:#3977cf;background:#edf4ff}.icon-action:focus-visible,.empty-slot:focus-visible{outline:2px solid #3977cf;outline-offset:2px}.icon-action:disabled{color:#c9d1dc;cursor:not-allowed}.drag-handle{cursor:grab}.drag-handle:active{cursor:grabbing}.remove-action{position:absolute;right:4px;bottom:4px;background:#fffffff0;border:1px solid #e5e9ef}.remove-action:hover:not(:disabled){color:#d05252;background:#fff0f0}
.card-status{justify-content:space-between;min-height:23px;padding:0 11px;margin-top:-2px}.status-label{font-size:11px;color:#8c99aa;line-height:1.5}.status-label.pending{color:#aa7c24}.image-source-link{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;text-decoration:none;color:#8c99aa}.image-source-link:hover{color:#3977cf}.image-card-actions{justify-content:space-between;margin:6px 10px 0;min-height:30px}.main-hint{font-size:11px;color:#a2adbb;padding-right:6px}.card-reorder{justify-content:space-between;border-top:1px solid #eff2f7;margin-top:7px;padding:3px 7px;font-size:10px;color:#a3aebb}.image-card .image-errors{display:block;padding:6px 10px;line-height:1.5;overflow-wrap:anywhere}.image-card>.el-button{margin:0 5px 6px}.preview-grid .image-card{padding-bottom:6px}
.image-toolbar{position:sticky;bottom:-1px;z-index:4;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:14px;padding:14px 2px 10px;background:#fff;border-top:1px solid var(--image-border);box-shadow:0 -8px 16px #ffffffed}.save-summary{display:flex;flex-direction:column;gap:4px}.save-summary strong{font-size:13px;font-weight:500}.save-summary span{font-size:11px;color:#8b98a8}.save-actions{flex-wrap:wrap;justify-content:flex-end}.submission-status{display:flex;align-items:center;gap:10px;padding:12px 14px;margin:12px 0;border:1px solid #dce8f8;background:#f3f7fe;border-radius:8px;color:#517399}.submission-status>div{display:flex;flex:1;flex-direction:column;gap:4px}.submission-status strong{font-size:13px;font-weight:500}.submission-status span{font-size:12px;color:#8293a7}.submission-status.problem{border-color:#f1c8c8;background:#fff5f5;color:#bd5757}.image-loading{display:flex;align-items:center;gap:8px;font-size:13px;color:#6f86a3;padding:16px 0}.image-errors{font-size:12px;color:#c45656}.image-hint{font-size:12px;color:#8c99aa;line-height:1.6}.listing-image-editor>.el-alert{margin:10px 0}.empty-gallery{display:flex;align-items:center;justify-content:center;gap:10px;min-height:120px;border:1px dashed var(--image-border);border-radius:8px;color:#98a5b5;font-size:13px}.empty-gallery .el-icon{font-size:28px}.catalog-images{margin-top:16px;padding:14px;background:#f7f9fc;border:1px solid var(--image-border);border-radius:8px}.catalog-heading{flex-wrap:wrap}.catalog-heading strong{font-size:13px}.catalog-heading span{flex:1;font-size:12px;color:#96a0af}.catalog-images .image-preview{height:140px}.catalog-images .image-card{padding:8px;box-sizing:border-box}.catalog-images .image-card>strong{font-size:12px;color:#718099}
@media(max-width:760px){.image-heading{align-items:flex-start}.heading-actions{gap:4px}.heading-actions .el-button{padding:7px 10px;font-size:12px}.image-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.upload-zone{padding:12px;gap:10px}.upload-zone-icon{display:none}.upload-zone-copy span{font-size:11px;line-height:1.5}.upload-zone-copy strong{font-size:13px}.upload-zone>.el-button{padding:8px 10px}.card-visual{margin:7px}.image-card-title{padding:3px 7px}.image-card-actions{margin:5px 7px 0;gap:2px;flex-wrap:wrap}.image-card-actions .el-button{font-size:11px;padding:4px 7px}.card-status{padding:0 7px}.save-summary span{display:none}.save-actions{gap:6px}.save-actions .el-button{padding:8px 10px;font-size:12px}.image-toolbar{gap:8px;padding-top:10px}.save-summary strong{font-size:12px}}
@media(max-width:480px){.image-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.image-toolbar{flex-direction:column;align-items:stretch}.save-actions{justify-content:flex-end}.upload-zone{flex-wrap:wrap}.upload-zone-copy{flex-basis:65%}.upload-zone>.el-button{font-size:12px}.heading-actions .el-button{padding:6px 8px}.card-tools .icon-action{width:26px}}
</style>
