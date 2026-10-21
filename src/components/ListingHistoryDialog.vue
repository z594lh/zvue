<template>
  <el-dialog :model-value="true" :title="`修改记录 · ${sku}`" width="min(1180px, 96vw)" append-to-body destroy-on-close @close="emit('close')">
    <section class="listing-history">
      <div class="history-notice"><el-icon><InfoFilled /></el-icon><span>仅记录功能上线后从ERP提交的操作，不包含亚马逊后台修改。已接受提交 ≠ 已生效；时间按北京时间显示。</span></div>
      <div class="history-filters">
        <el-select v-model="filters.operation_type" placeholder="全部操作类型" clearable aria-label="历史操作类型" @change="search"><el-option v-for="(label, value) in operationNames" :key="value" :label="label" :value="value" /></el-select>
        <el-select v-model="filters.write_status" placeholder="全部提交结果" clearable aria-label="历史提交结果" @change="search"><el-option v-for="(label, value) in writeNames" :key="value" :label="label" :value="value" /></el-select>
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新记录</el-button><span class="history-total">共 {{ total }} 次操作</span>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-table v-loading="loading" :data="rows" row-key="id" stripe @expand-change="expand">
        <el-table-column type="expand" width="42">
          <template #default="{ row }">
            <div class="history-detail" v-loading="details[row.id]?.loading">
              <el-alert v-if="details[row.id]?.error" :title="details[row.id].error" type="error" :closable="false"><template #default><el-button text @click="loadDetail(row.id)">重试读取</el-button></template></el-alert>
              <template v-if="details[row.id]?.data">
                <div class="history-evidence"><span>记录 #{{ row.id }} · 来源：ERP</span><span>前值依据：{{ beforeSources[details[row.id].data.before_source] || '无法核实' }}</span><span v-if="row.source_sku">来源SKU：{{ row.source_sku }}</span><span v-if="row.submission_id">Amazon提交ID：{{ row.submission_id }}</span></div>
                <div v-if="row.error_message" class="history-error">{{ row.error_message }}</div>
                <ul v-if="details[row.id].data.issues.length" class="history-error"><li v-for="(issue, i) in details[row.id].data.issues" :key="i">{{ issue.code }} · {{ issue.message }}</li></ul>
                <ul v-if="details[row.id].data.verification?.issues?.length" class="history-error"><li v-for="(issue, i) in details[row.id].data.verification.issues" :key="i">核对问题：{{ issue.code }} · {{ issue.message }}</li></ul>
                <div class="change-table"><div class="change-head"><span>修改字段</span><span>修改前</span><span>本次提交内容（不等于已生效）</span></div>
                  <div v-for="(change, i) in details[row.id].data.changes" :key="i" class="change-row">
                    <div class="change-label">{{ change.label }}<small v-if="change.action === 'omitted'">整份更新未提供此字段</small></div>
                    <div v-if="textDiffEntries([change]).length" class="change-text-diff"><TextChangeDiff :changes="[change]" /><details v-if="change.submitted_operations?.length > 1"><summary>查看本次提交明细</summary><pre>{{ JSON.stringify(change.submitted_operations, null, 2) }}</pre></details></div>
                    <template v-else><div class="change-value"><pre>{{ valueText(change, 'before') }}</pre><a v-for="link in imageLinks(change, 'before')" :key="link" :href="link" target="_blank" rel="noopener noreferrer">按需打开原图片</a></div>
                    <div class="change-value submitted"><pre>{{ valueText(change, 'after') }}</pre><a v-for="link in imageLinks(change, 'after')" :key="link" :href="link" target="_blank" rel="noopener noreferrer">按需打开提交图片</a><details v-if="change.submitted_operations && (change.action === 'delete' || change.submitted_operations.length > 1)"><summary>查看本次提交明细</summary><pre>{{ JSON.stringify(change.submitted_operations, null, 2) }}</pre></details></div></template>
                  </div>
                </div>
                <p class="history-detail-note">图片只显示链接，不自动下载OSS原图。历史仅供查看，不会恢复旧内容或重新提交。</p>
              </template>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作时间（北京时间）" width="172"><template #default="{ row }">{{ displayTime(row.requested_at) }}</template></el-table-column>
        <el-table-column label="操作人 / 来源" min-width="160"><template #default="{row}">{{ row.actor_name }} <el-tag v-if="row.audit_context?.source==='AI'" size="small">AI托管</el-tag><small v-if="row.audit_context" style="display:block;color:#8a99ac">发起：{{ row.audit_context.initiated_by.name }} · 优化 #{{ row.audit_context.run_id }}</small></template></el-table-column>
        <el-table-column label="操作类型" width="110"><template #default="{ row }">{{ operationNames[row.operation_type] || row.operation_type }}</template></el-table-column>
        <el-table-column label="修改内容（展开查看）" prop="change_summary" min-width="190" show-overflow-tooltip />
        <el-table-column label="提交结果" width="125"><template #default="{ row }"><el-tooltip :content="writeTips[row.write_status] || '请人工核对'" placement="top"><el-tag :type="row.write_status === 'rejected' ? 'danger' : row.write_status === 'accepted' ? 'info' : 'warning'" size="small">{{ writeNames[row.write_status] || '待核实' }}</el-tag></el-tooltip></template></el-table-column>
        <el-table-column label="最近核对" width="150"><template #default="{ row }"><el-tooltip :content="`核对时间：${displayTime(row.verified_at)}；查看本页不会调用Amazon或触发核对。`" placement="top"><span :class="{ 'history-error': ['issues', 'conflict'].includes(row.verification_status) }">{{ verificationNames[row.verification_status] || '尚未核对' }}</span></el-tooltip></template></el-table-column>
        <template #empty><span>{{ error ? '历史读取未完成，请重试' : '暂无ERP修改记录，上线前的操作无法追溯' }}</span></template>
      </el-table>
      <div class="history-pagination"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[20, 50]" :total="total" layout="total, sizes, prev, pager, next" @current-change="load" @size-change="search" /></div>
    </section>
  </el-dialog>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { InfoFilled, Refresh } from '@element-plus/icons-vue'
import { getAmazonListingChangeHistory, getAmazonListingChangeHistoryDetail } from '@/services/api'
import TextChangeDiff from '@/components/TextChangeDiff.vue'
import { textDiffEntries } from '@/utils/listingTextDiff'

const props = defineProps({ shopId: { type: [Number, String], required: true }, sku: { type: String, required: true } })
const emit = defineEmits(['close'])
const rows = ref([]), total = ref(0), page = ref(1), pageSize = ref(20), loading = ref(false), error = ref('')
const filters = reactive({ operation_type: '', write_status: '' }), details = reactive({})
const operationNames = { price: '修改价格', text: '修改文字', images: '修改图片', variants: '同步到变体', create: '创建Listing', update: '其他修改', delete: '删除Listing' }
const writeNames = { accepted: '已接受提交', rejected: '明确拒绝', unknown: '结果待核实', submitting: '等待回执' }
const writeTips = { accepted: 'Amazon接受了请求，不代表商城展示已生效', rejected: 'Amazon明确拒绝了本次提交，不是后台同步失败', unknown: '没有可靠回执，不等于操作失败，请勿直接重发', submitting: '操作意图已保存，尚无完整回执；长时间未更新请人工核实，勿重复提交' }
const verificationNames = { unverified: '尚未核对', pending: '等待平台回读', attributes_confirmed: '属性已回读确认', effective_confirmed: '实际报价已确认', image_matched: '候选图片相似匹配', issues: '平台处理有问题', conflict: '检测到其他变化' }
const beforeSources = { platform_read: '提交前实时读取', local_cache: '提交前本地缓存（可能滞后）', unavailable: '无法核实，未猜测前值' }
let disposed = false, revision = 0
function displayTime(value) { return value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—' }
async function load() {
  const current = ++revision
  loading.value = true; error.value = ''
  try {
    const response = await getAmazonListingChangeHistory(props.sku, { shop_id: props.shopId, page: page.value, page_size: pageSize.value, ...filters })
    if (!disposed && revision === current) { rows.value = response.data.data.list; total.value = response.data.data.total }
  } catch (err) { if (!disposed && revision === current) { rows.value = []; error.value = err.response?.data?.message || '修改历史读取失败，请重试' } }
  finally { if (!disposed && revision === current) loading.value = false }
}
function search() { page.value = 1; load() }
function expand(row, expanded) { if (expanded.some(item => item.id === row.id) && !details[row.id]) loadDetail(row.id) }
async function loadDetail(id) {
  if (details[id]?.loading) return
  details[id] = { loading: true }
  try { const response = await getAmazonListingChangeHistoryDetail(props.sku, id, props.shopId); if (!disposed) details[id] = { data: response.data.data } }
  catch (err) { if (!disposed) details[id] = { error: err.response?.data?.message || '字段明细读取失败' } }
}
function valueText(change, side) {
  if (side === 'before' && !change.before_known) return '无可核实的前值'
  if (side === 'after' && change.action === 'omitted') return '本次整份提交未提供；平台最终如何处理尚未确认'
  const value = change[side]
  if (value == null || Array.isArray(value) && !value.length) return side === 'before' ? '未设置' : '请求清除'
  if (change.kind === 'text' && Array.isArray(value) && value.every(row => typeof row.value === 'string')) return value.map((row, i) => `${value.length > 1 ? `${i + 1}. ` : ''}${row.value}`).join('\n\n')
  if (change.kind === 'image' && Array.isArray(value)) return value.map(row => row.media_location || JSON.stringify(row)).join('\n')
  if (change.kind === 'price' && Array.isArray(value)) return value.flatMap(row => (row.schedule || []).map(item => `${item.value_with_tax} ${change.currency || ''}${item.start_at ? `\n开始：${displayTime(item.start_at)}` : ''}${item.end_at ? `\n结束：${displayTime(item.end_at)}` : ''}`)).join('\n') || JSON.stringify(value, null, 2)
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}
function imageLinks(change, side) {
  if (change.kind !== 'image' || !Array.isArray(change[side])) return []
  return change[side].map(row => row.media_location).filter(value => typeof value === 'string' && value.startsWith('https://'))
}
onMounted(load)
onBeforeUnmount(() => { disposed = true; revision++ })
</script>

<style scoped>
.change-text-diff{grid-column:span 2;min-width:0}.change-text-diff pre{white-space:pre-wrap;overflow-wrap:anywhere}.change-text-diff details{font-size:12px;color:#7b8ba1}
.history-notice{display:flex;align-items:flex-start;gap:8px;background:#f3f7fd;border-radius:7px;padding:12px 14px;color:#72849c;font-size:12px;line-height:1.7}.history-notice .el-icon{margin-top:3px;flex-shrink:0}.history-filters{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:16px 0}.history-filters .el-select{width:165px}.history-total{margin-left:auto;font-size:12px;color:#94a0b0}.history-pagination{display:flex;justify-content:flex-end;margin-top:18px;overflow-x:auto}.history-detail{padding:14px 22px;background:#fafbfd}.history-evidence{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#8b98aa;overflow-wrap:anywhere;margin-bottom:12px}.change-table{border:1px solid #e5eaf1;border-radius:6px;overflow:hidden}.change-head,.change-row{display:grid;grid-template-columns:125px minmax(0,1fr) minmax(0,1fr)}.change-head{background:#eff4fa;color:#748398;font-size:12px}.change-head>span,.change-row>div{padding:10px 12px}.change-row{border-top:1px solid #e5eaf1;background:#fff}.change-row>div+div{border-left:1px solid #e5eaf1}.change-label{font-size:13px;color:#51627a}.change-label small{display:block;color:#9c8d6c;font-size:11px;margin-top:6px}.change-value{min-width:0}.change-value pre{font-family:inherit;font-size:12px;line-height:1.65;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow-y:auto;color:#6b7789}.change-value.submitted{background:#f6faff}.change-value a{display:inline-block;font-size:12px;color:#409eff;margin-top:6px}.history-error{color:#c45656;font-size:12px;overflow-wrap:anywhere}.history-detail-note{font-size:11px;color:#9ba7b8;margin-bottom:0}.listing-history>.el-alert{margin:12px 0}@media(max-width:650px){.history-detail{padding:10px}.change-head,.change-row{grid-template-columns:80px minmax(0,1fr) minmax(0,1fr)}.change-head>span,.change-row>div{padding:8px}.history-filters .el-select{width:145px}.history-total{margin-left:0}}
</style>
