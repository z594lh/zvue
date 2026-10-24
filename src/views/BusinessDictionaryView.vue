<template>
  <main class="business-dictionary" v-loading="loading">
    <header><div><small>SYSTEM · BUSINESS DICTIONARY</small><h1>业务字典</h1><p>同一份英文代码、中文名称和解释，供广告、AI工具及后续业务模块共用。</p></div><el-button :loading="loading" @click="load">重新加载</el-button></header>
    <section class="dictionary-guide"><strong>改中文显示，不改业务含义</strong><p>例如：报表的 close-match 与广告API的 QUERY_HIGH_REL_MATCHES 共用“紧密匹配”。标准代码、别名关联、数值格式由程序固定；这里可改中文名称与解释，也可补充未收录的词条。</p><p>使用“界面配置”权限维护。保存后当前窗口立即共用；其他后端进程最多约15秒刷新缓存，其他浏览器页面刷新后读取。不会改写历史工具原文，不会修改Amazon。</p></section>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <el-alert v-if="catalog.warning" :title="catalog.warning" type="warning" :closable="false"/>
    <div class="dictionary-layout"><aside><button v-for="category in catalog.groups" :key="category.code" :class="{active:group===category.code}" @click="selectGroup(category.code)"><span>{{ category.name }}</span><small>{{ groupCount(category.code) }}</small></button></aside>
      <section class="dictionary-content"><div class="dictionary-toolbar"><div><h2>{{ groupName(group) }}</h2><small>{{ group }} · {{ filtered.length }} 个词条</small></div><el-button type="primary" :disabled="!catalog.storage_ready" @click="add">补充词条</el-button></div>
        <div class="dictionary-filters"><el-input v-model="keyword" clearable placeholder="搜索英文代码、别名、中文名称或解释" @input="page=1"/><el-checkbox v-model="onlyOverrides" @change="page=1">只看已修改 / 补充</el-checkbox></div>
        <el-table :data="pageRows" row-key="code" stripe class="dictionary-table"><el-table-column label="标准英文代码 / 报表别名" min-width="255"><template #default="{row}"><code>{{ row.code }}</code><div v-if="row.aliases.length" class="aliases"><small>同义代码：</small><el-tag v-for="alias in row.aliases" :key="alias" size="small" type="info">{{ alias }}</el-tag></div></template></el-table-column><el-table-column label="全系统共用中文" min-width="160"><template #default="{row}"><strong>{{ row.label }}</strong><small class="entry-origin">{{ row.overridden?'已人工维护':'程序默认' }} · {{ row.builtin?'内置词条':'补充词条' }}</small></template></el-table-column><el-table-column label="含义 / 使用说明" min-width="270"><template #default="{row}"><p class="entry-description">{{ row.description || '尚未填写解释，可在维护词条中补充。' }}</p></template></el-table-column><el-table-column label="维护" width="170"><template #default="{row}"><el-button link type="primary" :disabled="!catalog.storage_ready" @click="edit(row)">编辑</el-button><el-button link type="primary" :disabled="!catalog.storage_ready" @click="showHistory(row)">记录</el-button><el-button v-if="row.overridden" link type="warning" :disabled="!catalog.storage_ready" @click="reset(row)">{{ row.builtin?'恢复默认':'移除' }}</el-button></template></el-table-column></el-table>
        <el-pagination v-model:current-page="page" :page-size="20" :total="filtered.length" layout="prev, pager, next, total" small/>
        <p class="dictionary-footnote">仅统一名称与解释，不将中文名称用于代码判断。新增词条不会自动增加AI工具、广告投放类型或修改系统校验规则。暂未接入的历史模块需要逐步迁移。</p>
      </section>
    </div>
    <el-dialog v-model="editing" :title="form.builtin?'维护内置词条':'补充业务词条'" width="min(720px, calc(100% - 24px))" append-to-body :close-on-click-modal="false">
      <el-form label-position="top"><el-form-item label="业务分类"><el-select v-model="form.group" :disabled="existing || saving"><el-option v-for="category in catalog.groups" :key="category.code" :value="category.code" :label="category.name"/></el-select></el-form-item><el-form-item label="标准英文代码"><el-input v-model="form.code" :disabled="existing || saving" maxlength="180" placeholder="精确英文代码，例如 customer_search_term"/><small>已有代码和别名只读，不能把紧密匹配改为宽泛匹配。相同含义的报表别名会指向同一标准词条。</small></el-form-item><el-form-item label="中文名称"><el-input v-model="form.label" maxlength="100" show-word-limit :disabled="saving"/></el-form-item><el-form-item label="中文解释 / 使用说明"><el-input v-model="form.description" type="textarea" :rows="5" maxlength="2000" show-word-limit :disabled="saving"/></el-form-item></el-form>
      <p v-if="form.aliases?.length" class="dictionary-footnote">只读别名：{{ form.aliases.join('、') }}</p><el-alert v-if="saveError" :title="saveError" type="error" :closable="false"/>
      <template #footer><el-button :disabled="saving" @click="editing=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存词条</el-button></template>
    </el-dialog>
    <el-dialog v-model="historyVisible" :title="`${historyTarget?.label || ''} · 修改记录`" width="min(1040px, calc(100% - 24px))" append-to-body><div v-loading="historyLoading"><el-alert v-if="historyError" :title="historyError" type="error" :closable="false"/><el-table :data="historyRows"><el-table-column label="时间 / 操作人" min-width="180"><template #default="{row}">{{ time(row.created_at) }}<small class="entry-origin">{{ row.operator_name }} · 版本 {{ row.item_version }}</small></template></el-table-column><el-table-column label="修改前" min-width="240"><template #default="{row}"><p>{{ auditText(row.before) }}</p><small>{{ row.before?.description }}</small></template></el-table-column><el-table-column label="修改后" min-width="240"><template #default="{row}"><p>{{ auditText(row.after) }}</p><small>{{ row.after?.description }}</small></template></el-table-column><el-table-column label="操作" width="110"><template #default="{row}">{{ row.action==='reset'?'恢复 / 移除':'维护词条' }}</template></el-table-column></el-table><el-pagination v-model:current-page="historyPage" :page-size="10" :total="historyTotal" layout="prev, pager, next, total" small @current-change="loadHistory"/></div></el-dialog>
  </main>
</template>
<script setup>
import { computed,onMounted,onBeforeUnmount,ref } from 'vue'
import { ElMessage,ElMessageBox } from 'element-plus'
import { getBusinessDictionaryManagement,saveBusinessDictionary,getBusinessDictionaryHistory } from '@/services/api'
import { publishDictionary,applyDictionary } from '@/utils/businessDictionary'
import { conversationTime } from '@/utils/aiOperationConversation'
const loading=ref(false),saving=ref(false),error=ref(''),catalog=ref({groups:[],list:[],storage_ready:false}),group=ref('ads.auto_target'),keyword=ref(''),onlyOverrides=ref(false),page=ref(1)
const editing=ref(false),existing=ref(false),form=ref({}),saveError=ref(''),historyVisible=ref(false),historyTarget=ref(null),historyRows=ref([]),historyLoading=ref(false),historyError=ref(''),historyPage=ref(1),historyTotal=ref(0)
let active=true,loadVersion=0,historyVersion=0
const filtered=computed(()=>catalog.value.list.filter(r=>r.group===group.value && (!onlyOverrides.value || r.overridden) && [r.code,r.label,r.description,...r.aliases].join(' ').toLowerCase().includes(keyword.value.toLowerCase())))
const pageRows=computed(()=>filtered.value.slice((page.value-1)*20,page.value*20))
/** 根据共享目录显示分类中文名称，不再另写分类映射。 */
function groupName(code){return catalog.value.groups.find(g=>g.code===code)?.name || code}
/** 统计当前完整字典的分类数量，不代表任何报表条数。 */
function groupCount(code){return catalog.value.list.filter(r=>r.group===code).length}
/** 切换分类只改变展示，不查询业务报表。 */
function selectGroup(code){group.value=code;page.value=1;keyword.value=''}
/** 加载配置和版本，不创建覆盖行或修改AI/广告配置。 */
async function load(){const v=++loadVersion;loading.value=true;error.value='';try{const {data}=await getBusinessDictionaryManagement();if(active && v===loadVersion){catalog.value=data.data;applyDictionary(data.data)}}catch(e){if(active && v===loadVersion)error.value=e.response?.data?.message || '字典读取失败'}finally{if(active && v===loadVersion)loading.value=false}}
/** 编辑草稿独立于共享快照，取消不生效。 */
function edit(row){form.value={...row};existing.value=true;saveError.value='';editing.value=true}
/** 补充项仅能选择已注册命名空间，不新增任何执行能力。 */
function add(){form.value={group:group.value,code:'',label:'',description:'',version:0,builtin:false,aliases:[]};existing.value=false;saveError.value='';editing.value=true}
/** 明确保存单词条并广播新快照；不自动重试失败或超时请求。 */
async function save(){
  if(saving.value)return
  if(!form.value.label?.trim() || !form.value.code?.trim()){saveError.value='请填写英文代码与中文名称';return}
  saving.value=true;saveError.value=''
  try{const {group,code,label,description,version}=form.value;const {data}=await saveBusinessDictionary({group,code,label,description,version,reset:false});if(active){catalog.value=data.data;publishDictionary(data.data);editing.value=false;ElMessage.success('已保存，共用字典已刷新')}}catch(e){if(active)saveError.value=e.response?.data?.message || '未确认保存结果，请重新加载核对；不会自动重试'}finally{if(active)saving.value=false}
}
/** 恢复默认或移除补充项均留审计；重建继续历史版本，旧编辑不能覆盖新记录。 */
async function reset(row){
  try{await ElMessageBox.confirm(row.builtin?'将恢复程序默认中文名称和解释，并记录操作历史。':'移除此补充显示词条，已保存历史和业务数据不删除。','确认字典变更',{confirmButtonText:'确认',cancelButtonText:'取消'})}catch{return}
  try{const {data}=await saveBusinessDictionary({group:row.group,code:row.code,label:'',description:'',version:row.version,reset:true});if(active){catalog.value=data.data;publishDictionary(data.data);ElMessage.success('字典已更新')}}catch(e){if(active)error.value=e.response?.data?.message || '变更结果待核对，请重新加载，不要重复提交'}
}
/** 打开精确词条的修改审计，不使用当前文案冒充历史默认值。 */
function showHistory(row){historyTarget.value=row;historyPage.value=1;historyVisible.value=true;loadHistory()}
/** 按词条分页读取历史，过期响应不能覆盖后选词条。 */
async function loadHistory(){const v=++historyVersion;historyLoading.value=true;historyError.value='';try{const {data}=await getBusinessDictionaryHistory({group:historyTarget.value.group,code:historyTarget.value.code,page:historyPage.value});if(active && v===historyVersion){historyRows.value=data.data.list;historyTotal.value=data.data.total}}catch(e){if(active && v===historyVersion)historyError.value=e.response?.data?.message || '修改记录读取失败'}finally{if(active && v===historyVersion)historyLoading.value=false}}
/** 空覆盖不能反推当时的程序默认文案，明确只展示人工覆盖事实。 */
function auditText(value){return value?.label ?? '无人工覆盖（内置使用默认；补充项不展示）'}
/** 项目统一UTC转北京时间，避免维护记录跨日误读。 */
function time(value){return conversationTime(value)}
/** 离页后丢弃迟到响应，不终止或重复已提交保存。 */
function stop(){active=false;loadVersion++;historyVersion++}
onMounted(load);onBeforeUnmount(stop)
</script>
<style scoped>
.business-dictionary{max-width:1650px;margin:auto;padding:28px;color:#354d6c}.business-dictionary>header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:22px}h1{margin:8px 0;font-size:28px}header>div>small{font-size:10px;letter-spacing:2px;color:#8299b9}header p{font-size:13px;color:#8194ad}.dictionary-guide{background:#f0f6ff;border:1px solid #dae8fc;border-radius:12px;padding:20px 24px;margin-bottom:22px;line-height:1.9;font-size:13px}.dictionary-guide p{margin:7px 0;color:#7287a3}.dictionary-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:20px}.dictionary-layout aside{background:white;border:1px solid #e1e8f3;border-radius:12px;padding:9px;height:fit-content}.dictionary-layout aside button{display:flex;align-items:center;justify-content:space-between;width:100%;background:transparent;border:0;border-radius:7px;padding:13px 12px;color:#7187a3;cursor:pointer;font-size:13px}.dictionary-layout aside button.active{background:#ebf3ff;color:#307be2;font-weight:600}.dictionary-content{background:white;border:1px solid #e1e8f3;border-radius:12px;padding:22px;min-width:0}.dictionary-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}.dictionary-toolbar h2{font-size:18px;margin:0 0 6px}.dictionary-filters{display:flex;align-items:center;gap:20px;margin-bottom:18px}.dictionary-filters .el-input{max-width:430px}.dictionary-table code{font-size:12px;color:#486888;overflow-wrap:anywhere}.aliases{display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:9px}.entry-origin{display:block;margin-top:6px}.entry-description{font-size:13px;line-height:1.8;margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere}.el-pagination{margin-top:22px;max-width:100%;overflow:auto;justify-content:flex-end}.dictionary-footnote,small{font-size:11px;line-height:1.9;color:#879ab4}.dictionary-footnote{margin-top:18px}.el-form-item small{display:block;margin-top:7px}.el-form-item .el-select{width:100%}@media(max-width:800px){.business-dictionary{padding:15px 10px}.dictionary-layout{grid-template-columns:1fr}.dictionary-layout aside{display:flex;overflow:auto;white-space:nowrap;border-radius:8px}.dictionary-layout aside button{width:auto;gap:10px;flex-shrink:0}.dictionary-content{padding:14px}.dictionary-filters{align-items:flex-start;flex-direction:column;gap:10px}.dictionary-toolbar{align-items:flex-start}.dictionary-guide{padding:15px}.business-dictionary>header{align-items:flex-start}}
</style>
