<template>
  <main class="ai-tool-page" v-loading="loading">
    <header><div><span>AI OPERATIONS · TOOLS</span><h1>AI工具管理</h1><p>工具代码集中管理，AI按需查询资料、提交结构化计划；无需配置大量提问话术。</p></div><div><el-button @click="router.push('/tools/ai-operations')">返回托管ASIN</el-button><el-button :loading="loading" @click="load">刷新</el-button></div></header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <section class="tool-guide"><strong>这里管理什么？</strong><p>开关决定后续任务能否调用此工具；说明用于告诉AI何时、如何使用。参数和实现由程序固定，不能在页面新增任意API、SQL或脚本。</p><p>查询不会修改Amazon；“提交优化计划”只负责校验和归档。人工方案仍须明确确认，每日按已有托管流程执行。新任务固定工具快照，修改不影响进行中的任务。</p></section>
    <el-tabs v-model="tab"><el-tab-pane label="工具目录" name="directory"><section class="tool-card"><div class="filters"><el-input v-model="keyword" placeholder="搜索工具名称、用途" clearable/><el-select v-model="group" clearable placeholder="全部类型"><el-option v-for="value in ['查询','测算','计划']" :key="value" :value="value" :label="value"/></el-select><small>{{ filtered.length }} / {{ rows.length }} 个工具</small></div>
      <el-table :data="filtered" row-key="name"><el-table-column label="工具" min-width="205"><template #default="{row}"><strong>{{ row.label }}</strong><code>{{ row.name }}</code></template></el-table-column><el-table-column label="用途与影响" min-width="330"><template #default="{row}"><p>{{ row.description }}</p><small>{{ row.effect }}</small></template></el-table-column><el-table-column label="类型" width="88"><template #default="{row}"><el-tag size="small" :type="row.required?'warning':'info'">{{ row.group }}</el-tag></template></el-table-column><el-table-column label="对AI开放" width="120"><template #default="{row}"><el-tooltip :content="row.required?'计划提交是必要能力，不可关闭':'点击编辑后确认开关，仅影响后续新任务'" placement="top"><el-tag :type="row.enabled?'success':'info'">{{ row.enabled?'已开放':'已关闭' }}</el-tag></el-tooltip></template></el-table-column><el-table-column label="管理" width="125"><template #default="{row}"><el-button link type="primary" @click="edit(row)">说明 / 参数</el-button></template></el-table-column></el-table>
    </section></el-tab-pane><el-tab-pane label="调用统计" name="statistics"><AiToolStatistics v-if="tab==='statistics'"/></el-tab-pane></el-tabs>
    <el-dialog v-model="visible" :title="chosen?.label || '工具'" width="min(820px, calc(100% - 24px))" top="5vh" append-to-body :close-on-click-modal="false">
      <template v-if="chosen"><code>{{ chosen.name }}</code><el-form label-position="top"><el-form-item label="对后续AI任务开放"><el-switch v-model="form.enabled" :disabled="chosen.required || saving"/><small>{{ chosen.required?'必要计划工具，不允许关闭':'关闭后AI不再看到这个工具；不撤回已发生的操作' }}</small></el-form-item><el-form-item label="提供给AI的用途说明"><el-input v-model="form.description" type="textarea" :rows="5" :maxlength="2000" show-word-limit :disabled="saving"/><small>只改变工具说明，不改变数据口径、参数、字段限制或业务实现。不熟悉时保留默认。</small></el-form-item></el-form><details><summary>参数Schema（只读）</summary><pre>{{ JSON.stringify(chosen.parameters,null,2) }}</pre></details><p class="tool-note">{{ chosen.effect }} · 版本 {{ chosen.revision }} · 保存不调用AI</p><el-alert v-if="saveError" :title="saveError" type="error" :closable="false"/></template>
      <template #footer><el-button :disabled="saving" @click="reset">恢复默认</el-button><el-button :disabled="saving" @click="visible=false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存工具</el-button></template>
    </el-dialog>
  </main>
</template>

<script setup>
import { computed,onBeforeUnmount,onMounted,ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox,ElMessage } from 'element-plus'
import { getAiTools,updateAiTool } from '@/services/api'
import AiToolStatistics from '@/components/AiToolStatistics.vue'
const tab=ref('directory')
const router=useRouter(),loading=ref(false),saving=ref(false),error=ref(''),saveError=ref(''),rows=ref([]),keyword=ref(''),group=ref(''),visible=ref(false),chosen=ref(null),form=ref({})
const filtered=computed(()=>rows.value.filter(row=>(!group.value || row.group===group.value) && [row.name,row.label,row.description].join(' ').toLowerCase().includes(keyword.value.toLowerCase())))
let active=true
/** 只读加载代码注册的工具，不开启模型或业务任务。 */
async function load(){loading.value=true;error.value='';try{const {data}=await getAiTools();if(active)rows.value=data.data.list}catch(e){if(active)error.value=e.response?.data?.message || '工具目录读取失败'}finally{if(active)loading.value=false}}
/** 编辑独立副本，关闭弹框不保存。 */
function edit(row){chosen.value=row;form.value={enabled:row.enabled,description:row.description,revision:row.revision,reset:false};saveError.value='';visible.value=true}
/** 恢复默认仅填入草稿，仍需点击保存才影响后续任务。 */
function reset(){if(!chosen.value)return;form.value={...form.value,enabled:true,description:chosen.value.default_description,reset:true}}
/** 以原revision确认保存；不添加任意工具或篡改参数Schema。 */
async function save(){if(saving.value || !chosen.value)return;try{await ElMessageBox.confirm('仅影响后续新任务的工具可见性和说明；不影响在途任务，也不会立即调用AI。','保存工具',{confirmButtonText:'确认保存',cancelButtonText:'取消'})}catch{return}saving.value=true;saveError.value='';try{const payload={...form.value,reset:form.value.reset && form.value.description===chosen.value.default_description && form.value.enabled};const {data}=await updateAiTool(chosen.value.name,payload);if(active){rows.value=data.data.list;visible.value=false;ElMessage.success('工具已保存，后续新任务生效')}}catch(e){if(active)saveError.value=e.response?.data?.message || '工具保存未完成，请刷新核对'}finally{if(active)saving.value=false}}
/** 离页后不显示迟到请求结果。 */
function stop(){active=false}
onMounted(load);onBeforeUnmount(stop)
</script>

<style scoped>
.ai-tool-page{max-width:1500px;margin:0 auto;padding:30px 22px;color:#36516e}.ai-tool-page>header{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:24px}.ai-tool-page h1{margin:7px 0;font-size:28px}.ai-tool-page header span{font-size:10px;letter-spacing:2px;color:#7d97b8}.ai-tool-page header p{font-size:12px;color:#7d91aa}.tool-guide{padding:18px 22px;border:1px solid #dae7f9;background:#f2f7ff;border-radius:12px;line-height:1.9;font-size:12px;margin-bottom:22px}.tool-guide p{margin:6px 0;color:#6c83a2}.tool-card{border:1px solid #e1e9f3;border-radius:12px;padding:20px;background:white}.filters{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:18px}.filters .el-input{max-width:330px}.filters .el-select{width:150px}.filters small,.tool-note,small{color:#879ab2;font-size:11px}.ai-tool-page code{display:block;overflow-wrap:anywhere;font-size:11px;color:#8a9db5;margin-top:6px}.tool-card p{font-size:12px;line-height:1.8;margin:6px 0}pre{max-height:35vh;overflow:auto;background:#f5f8fc;padding:12px;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}summary{color:#4c83c2;font-size:12px;cursor:pointer}.el-form-item small{display:block;line-height:1.8;margin-left:8px}@media(max-width:700px){.ai-tool-page{padding:18px 10px}.ai-tool-page>header{align-items:flex-start;flex-direction:column}.tool-card{padding:10px}.tool-guide{padding:12px}.ai-tool-page h1{font-size:24px}}
</style>
