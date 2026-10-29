<template>
  <div class="ui-config-page">
    <div class="config-header"><div><h1>界面配置</h1><p>管理公开展示文案，保存后本页立即生效，其他页面刷新后读取。</p></div>
      <el-button :disabled="busy" @click="reload">重新加载</el-button>
    </div>
    <el-alert title="这些内容在登录前也可见，请勿填写密码、Token、密钥或其他内部敏感信息。仅支持纯文本。" type="warning" :closable="false" show-icon />
    <p class="config-note">配置保存在当前连接的数据库，不随 Git 提交。本地与线上需分别连接各自数据库；共享后端或导入线上数据库会带入对应配置。</p>
    <section class="config-panel" v-loading="loading">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-form v-if="ready" label-position="top" :disabled="busy" @submit.prevent>
        <el-form-item v-for="field in fields" :key="field.key" :label="field.label">
          <div class="config-field">
            <el-input v-model="form[field.key]" :type="field.multiline ? 'textarea' : 'text'" :autosize="field.multiline ? {minRows:2,maxRows:5} : undefined" :maxlength="field.max_length" show-word-limit :placeholder="field.default_value || '留空不显示'" />
            <p class="field-note">{{ field.description }}</p>
            <div class="default-line"><span>默认：{{ field.default_value || '（不显示）' }}</span><el-button link type="primary" @click="form[field.key]=field.default_value">填入默认值</el-button></div>
          </div>
        </el-form-item>
        <div class="config-actions"><el-button type="primary" :loading="saving" :disabled="!dirty || busy" @click="save">保存配置</el-button>
          <el-button :disabled="busy" @click="resetAll">恢复全部默认</el-button><span class="field-note">填入默认值后仍需保存；恢复全部默认会经确认后直接保存。</span>
        </div>
        <p class="field-note">版本 {{ version }} · 最近修改：{{ updatedBy || '尚未修改' }}<template v-if="updatedAt"> · {{ time(updatedAt) }}（北京时间）</template></p>
      </el-form>
    </section>
    <section class="config-panel">
      <div class="history-header"><h2>修改记录</h2><el-button size="small" :loading="historyLoading" @click="loadHistory">刷新记录</el-button></div>
      <p class="field-note">仅记录实际发生的变更，展开查看修改前后内容；相同内容保存不会重复写记录。</p>
      <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" />
      <el-table :data="records" v-loading="historyLoading" stripe row-key="id">
        <el-table-column type="expand" width="40"><template #default="{row}"><div class="history-changes">
          <div v-for="key in row.changed_keys" :key="key" class="history-change"><strong>{{ fieldTitle(key) }}</strong><p>修改前：<span>{{ row.before_values[key] || '（不显示）' }}</span></p><p>修改后：<span>{{ row.after_values[key] || '（不显示）' }}</span></p></div>
        </div></template></el-table-column>
        <el-table-column prop="config_version" label="版本" width="80" />
        <el-table-column label="时间（北京时间）" min-width="180"><template #default="{row}">{{ time(row.created_at) }}</template></el-table-column>
        <el-table-column prop="operator_name" label="修改人" min-width="110" show-overflow-tooltip />
        <el-table-column label="操作" width="110"><template #default="{row}">{{ row.action==='reset' ? '恢复默认' : '修改配置' }}</template></el-table-column>
        <el-table-column label="变更项目" min-width="200"><template #default="{row}">{{ row.changed_keys.map(fieldTitle).join('、') }}</template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="historyPage" :page-size="10" :total="historyTotal" layout="total, prev, pager, next" @current-change="loadHistory" />
    </section>
  </div>
</template>

<script>
export default { name: 'UiConfigView' }
</script>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useTabProtection } from '@/composables/workspace/useTabProtection'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUiConfigManagement, saveUiConfig, resetUiConfig, getUiConfigHistory } from '@/services/api.js'
import { applyUiConfig } from '@/services/uiConfig.js'
import { DEFAULT_UI_CONFIG } from '@/config/branding.js'

const form = reactive({ ...DEFAULT_UI_CONFIG }), fields = ref([]), saved = ref({ ...DEFAULT_UI_CONFIG })
const version = ref(null), updatedBy = ref(''), updatedAt = ref(null)
const loading = ref(false), saving = ref(false), ready = ref(false), error = ref('')
const historyLoading = ref(false), historyError = ref(''), records = ref([]), historyPage = ref(1), historyTotal = ref(0)
let historyRequest = 0
const busy = computed(() => loading.value || saving.value)
const dirty = computed(() => ready.value && Object.keys(DEFAULT_UI_CONFIG).some(key => form[key] !== saved.value[key]))
const time = value => value ? new Date(value).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai',hour12:false}) : '—'
const fieldTitle = key => fields.value.find(field => field.key === key)?.label || key
const message = e => e.response?.data?.message || '请求未成功，请检查连接后重新加载；不要重复提交不确定的操作。'

function accept(data) {
  if (!Number.isSafeInteger(data?.version) || !Array.isArray(data.fields) || !applyUiConfig(data.values)) throw new Error('配置响应格式异常')
  fields.value = data.fields.filter(field => Object.prototype.hasOwnProperty.call(DEFAULT_UI_CONFIG, field.key))
  Object.assign(form, data.values)
  saved.value = { ...data.values };version.value = data.version
  updatedBy.value = data.updated_by_name;updatedAt.value = data.updated_at;ready.value = true
}
async function loadConfig() {
  loading.value = true;error.value = ''
  try {
    const response = await getUiConfigManagement()
    if (response.data.status !== 'success') throw new Error('读取失败')
    accept(response.data.data)
  } catch (e) {error.value = message(e);ready.value = false}
  finally {loading.value = false}
}
async function loadHistory() {
  const request = ++historyRequest
  historyLoading.value = true;historyError.value = ''
  try {
    const response = await getUiConfigHistory({page:historyPage.value,page_size:10})
    if (request !== historyRequest) return
    if (response.data.status !== 'success') throw new Error('读取失败')
    records.value = response.data.data.list;historyTotal.value = response.data.data.total
  } catch (e) {if (request === historyRequest) {historyError.value = message(e);records.value = [];historyTotal.value = 0}}
  finally {if (request === historyRequest) historyLoading.value = false}
}
async function confirmDiscard(text='有尚未保存的修改，确定放弃吗？') {
  if (!dirty.value) return true
  try {await ElMessageBox.confirm(text, '确认操作', {type:'warning',confirmButtonText:'放弃修改',cancelButtonText:'继续编辑'});return true}
  catch {return false}
}
async function reload() {
  if (busy.value || !await confirmDiscard()) return
  await loadConfig();await loadHistory()
}
async function save() {
  if (!ready.value || busy.value || !dirty.value) return
  saving.value = true
  try {
    const response = await saveUiConfig({version:version.value,values:{...form}})
    if (response.data.status !== 'success') throw new Error('保存失败')
    accept(response.data.data);ElMessage.success('配置已保存，本页已更新，其他页面刷新后生效')
    historyPage.value = 1;await loadHistory()
  } catch (e) {ElMessage.error(message(e))}
  finally {saving.value = false}
}
async function resetAll() {
  if (!ready.value || busy.value) return
  try {await ElMessageBox.confirm('将恢复系统名称、登录欢迎语和页脚的默认值，并直接保存。尚未保存的修改会被放弃。', '恢复全部默认', {type:'warning',confirmButtonText:'确认恢复',cancelButtonText:'取消'})}
  catch {return}
  if (busy.value) return
  saving.value = true
  try {
    const response = await resetUiConfig({version:version.value})
    if (response.data.status !== 'success') throw new Error('恢复失败')
    accept(response.data.data);ElMessage.success('已恢复默认配置')
    historyPage.value = 1;await loadHistory()
  } catch (e) {ElMessage.error(message(e))}
  finally {saving.value = false}
}
useTabProtection({protected:()=>dirty.value || busy.value,confirm:async()=>!busy.value && await confirmDiscard(),retainOnSwitch:()=>!busy.value})
onMounted(() => {loadConfig();loadHistory()})
</script>

<style scoped>
.ui-config-page{max-width:1120px;margin:0 auto;padding:24px}
.config-header,.history-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px}
h1{font-size:24px;color:#223b5c}h2{font-size:17px;color:#223b5c}
.config-header p,.config-note{color:#71829b;font-size:13px;line-height:1.8;margin-top:8px}
.config-note{margin:12px 0}
.config-panel{background:#fff;border:1px solid #e8edf5;border-radius:12px;padding:22px;margin:18px 0}
.config-field{width:100%;max-width:760px}
.field-note{font-size:12px;color:#8693a5;line-height:1.8;margin-top:6px}
.default-line{display:flex;flex-wrap:wrap;gap:12px;align-items:center;color:#71829b;font-size:12px;overflow-wrap:anywhere}
.config-actions{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:20px}
.history-changes{padding:12px 24px}.history-change{margin-bottom:12px;font-size:13px;color:#52627a}
.history-change p{margin-top:6px}.history-change span{white-space:pre-wrap;overflow-wrap:anywhere}
.el-pagination{justify-content:flex-end;margin-top:16px}
@media(max-width:600px){.ui-config-page{padding:14px}.config-panel{padding:14px}.config-header{align-items:flex-start}.config-header p{font-size:12px}}
</style>
