<template>
  <main class="ai-tool-page" v-loading="loading">
    <header><div><span>AI OPERATIONS · TOOLS</span><h1>AI工具管理</h1></div><div><el-button @click="router.push('/ai/operations')">返回托管ASIN</el-button><el-button :loading="loading" @click="load">刷新</el-button></div></header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <section class="tool-guide"><strong>AI工具是系统给AI准备的工具，AI调用这些工具能获取对应的资料，AI会自助选择需要哪些资料，自己查阅所需信息分析。</strong></section>
    <details class="tool-guide"><summary><strong>看懂AI能查什么，也能核对实际返回</strong></summary><p>「说明 / 参数」查看中文用途、参数默认值和示例，原始Schema保留给技术核对。「查看数据」可试查ERP资料，或查看AI当时真正收到的返回，不收费、不执行修改。</p><p>AI查询默认最多1000条，来源省略量、字节预算与续查位置均会披露；页面表格每页10条，两者互不影响。概览仍是摘要，不能当完整明细。工具开关与说明只影响后续新任务。</p></details>
    <el-tabs v-model="tab"><el-tab-pane label="工具目录" name="directory"><section class="tool-card"><div class="filters"><el-input v-model="keyword" placeholder="搜索工具名称、用途" clearable/><el-select v-model="group" clearable placeholder="全部类型"><el-option v-for="value in ['查询','测算','计划']" :key="value" :value="value" :label="value"/></el-select><small>{{ filtered.length }} / {{ rows.length }} 个工具</small></div>
      <el-table :data="filtered" row-key="name"><el-table-column label="工具" min-width="205"><template #default="{row}"><strong>{{ row.label }}</strong><code>{{ row.name }}</code></template></el-table-column><el-table-column label="用途与影响" min-width="330"><template #default="{row}"><p>{{ row.description }}</p><small>{{ row.effect }}</small></template></el-table-column><el-table-column label="类型" width="88"><template #default="{row}"><el-tag size="small" :type="row.required?'warning':'info'">{{ row.group }}</el-tag></template></el-table-column><el-table-column label="对AI开放" width="120"><template #default="{row}"><el-tooltip :content="row.required?'计划提交是必要能力，不可关闭':'点击编辑后确认开关，仅影响后续新任务'" placement="top"><el-tag :type="row.enabled?'success':'info'">{{ row.enabled?'已开放':'已关闭' }}</el-tag></el-tooltip></template></el-table-column><el-table-column label="管理 / 查看" width="210"><template #default="{row}"><el-button link type="primary" @click="edit(row)">说明 / 参数</el-button><el-button v-if="!row.required" link type="primary" @click="edit(row,'data')">查看数据</el-button><small v-else>非查询工具，不可试运行</small></template></el-table-column></el-table>
    </section></el-tab-pane><el-tab-pane label="调用统计" name="statistics"><AiToolStatistics v-if="tab==='statistics'"/></el-tab-pane></el-tabs>
    <el-dialog v-model="visible" :title="chosen?.label || '工具'" width="min(1180px, calc(100% - 24px))" top="4vh" append-to-body destroy-on-close :close-on-click-modal="false" class="tool-management-dialog">
      <template v-if="chosen"><div class="tool-identity"><code>{{ chosen.name }}</code><el-tag size="small" type="info">{{ chosen.group }}工具</el-tag><small>说明版本 {{ chosen.revision }} · 查看与保存不调用AI</small></div>
        <el-tabs v-model="detailTab"><el-tab-pane label="用途与开放配置" name="settings"><div class="detail-guide"><strong>{{ chosen.guide?.purpose || chosen.effect }}</strong><p>{{ chosen.guide?.scope }}</p><p>{{ chosen.guide?.source_limits }}</p></div><el-form label-position="top"><el-form-item label="对后续AI任务开放"><el-switch v-model="form.enabled" :disabled="chosen.required || saving"/><small>{{ chosen.required?'必要计划工具，不允许关闭':'关闭后AI不再看到这个工具；不撤回已发生的操作，不影响已冻结的在途任务' }}</small></el-form-item><el-form-item label="告诉AI：什么时候用这个工具，能查什么"><el-input v-model="form.description" type="textarea" :rows="5" :maxlength="2000" show-word-limit :disabled="saving"/><small>这里是AI实际收到的用途说明。只改变描述，不改变数据口径、参数、字数限制或业务实现。不熟悉时保留默认。</small></el-form-item></el-form></el-tab-pane>
        <el-tab-pane label="中文参数与示例" name="parameters"><p class="tool-note">参数由程序固定，以下是中文解释。原始参数名称不变；修改说明不会改变参数或放宽业务校验。</p><el-alert v-if="!chosen.guide?.parameters?.length" title="这个工具不需要填写参数。调用时自动绑定当前托管ASIN、店铺及资料时间，参数是空对象 {}。" type="info" :closable="false"/><el-table v-else :data="chosen.guide.parameters" border class="human-parameters"><el-table-column label="中文名称 / 原始参数" min-width="205"><template #default="{row}"><strong>{{ row.label }}</strong><code>{{ row.key }}</code></template></el-table-column><el-table-column label="怎么填写、有什么作用" min-width="330"><template #default="{row}"><p>{{ row.help }}</p><p v-if="row.choices?.length"><el-tag v-for="c in row.choices" :key="c.value" size="small" type="info" class="choice-tag">{{ c.label }} · {{ c.value }}</el-tag></p></template></el-table-column><el-table-column label="默认值 / 范围" min-width="160"><template #default="{row}"><div>{{ row.default===null?'无固定默认值':JSON.stringify(row.default) }}</div><small v-if="row.minimum!=null || row.maximum!=null">范围 {{ row.minimum ?? '不限' }} ～ {{ row.maximum ?? '不限' }}</small><small>{{ row.required?'必填':'可省略' }} · {{ row.type }}</small></template></el-table-column></el-table><h4 v-if="!chosen.required">调用示例（AI使用的JSON）</h4><pre v-if="!chosen.required">{{ JSON.stringify(chosen.guide?.example || {},null,2) }}</pre><details><summary>原始参数 Schema（提供给AI，只读）</summary><pre>{{ JSON.stringify(chosen.parameters,null,2) }}</pre></details><p class="tool-note">{{ chosen.guide?.pagination }}</p></el-tab-pane>
        </el-tabs><el-alert v-if="saveError" :title="saveError" type="error" :closable="false"/>
      </template>
      <template #footer><small class="footer-tip">只有保存开关/用途说明才改变配置；试查不影响配置。</small><el-button v-if="detailTab==='settings'" :disabled="saving" @click="reset">恢复默认说明</el-button><el-button :disabled="saving" @click="visible=false">关闭</el-button><el-button v-if="detailTab==='settings'" type="primary" :loading="saving" @click="save">保存工具配置</el-button></template>
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
const detailTab=ref('settings')
const router=useRouter(),loading=ref(false),saving=ref(false),error=ref(''),saveError=ref(''),rows=ref([]),keyword=ref(''),group=ref(''),visible=ref(false),chosen=ref(null),form=ref({})
const filtered=computed(()=>rows.value.filter(row=>(!group.value || row.group===group.value) && [row.name,row.label,row.description].join(' ').toLowerCase().includes(keyword.value.toLowerCase())))
let active=true
/** 只读加载代码注册的工具，不开启模型或业务任务。 */
async function load(){loading.value=true;error.value='';try{const {data}=await getAiTools();if(active)rows.value=data.data.list}catch(e){if(active)error.value=e.response?.data?.message || '工具目录读取失败'}finally{if(active)loading.value=false}}
/** 数据走系统路由及Nav页签；配置仍编辑独立副本，关闭弹框不保存。 */
function edit(row,section='settings'){if(section==='data'){router.push({name:'AiToolPreview',params:{toolName:row.name}});return}chosen.value=row;form.value={enabled:row.enabled,description:row.description,revision:row.revision,reset:false};saveError.value='';detailTab.value=section;visible.value=true}
/** 恢复默认仅填入草稿，仍需点击保存才影响后续任务。 */
function reset(){if(!chosen.value)return;form.value={...form.value,enabled:true,description:chosen.value.default_description,reset:true}}
/** 以原revision确认保存；不添加任意工具或篡改参数Schema。 */
async function save(){if(saving.value || !chosen.value)return;try{await ElMessageBox.confirm('仅影响后续新任务的工具可见性和说明；不影响在途任务，也不会立即调用AI。','保存工具',{confirmButtonText:'确认保存',cancelButtonText:'取消'})}catch{return}saving.value=true;saveError.value='';try{const payload={...form.value,reset:form.value.reset && form.value.description===chosen.value.default_description && form.value.enabled};const {data}=await updateAiTool(chosen.value.name,payload);if(active){rows.value=data.data.list;visible.value=false;ElMessage.success('工具已保存，后续新任务生效')}}catch(e){if(active)saveError.value=e.response?.data?.message || '工具保存未完成，请刷新核对'}finally{if(active)saving.value=false}}
/** 离页后不显示迟到请求结果。 */
function stop(){active=false}
onMounted(load);onBeforeUnmount(stop)
</script>

<style scoped>
.tool-identity{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px}.tool-identity code{color:#7c91ad;font-size:12px}.detail-guide{background:#f2f7ff;border:1px solid #dce8f9;border-radius:10px;padding:16px;margin:8px 0 22px;line-height:1.9;font-size:13px;color:#496584}.detail-guide p{font-size:12px;margin:6px 0;color:#7b90ac}.tool-management-dialog p{line-height:1.8}.human-parameters code{display:block;color:#8197b5;font-size:11px;overflow-wrap:anywhere}.human-parameters p{font-size:12px;line-height:1.8}.human-parameters small{display:block;margin-top:4px}.choice-tag{margin:2px 5px 2px 0}.footer-tip{margin-right:auto;display:inline-block;max-width:360px;text-align:left;vertical-align:middle}.tool-management-dialog :deep(.el-dialog__body){max-height:73vh;overflow:auto}.tool-management-dialog :deep(.el-dialog__footer){display:flex;justify-content:flex-end;align-items:center;gap:6px;flex-wrap:wrap}
.ai-tool-page{max-width:1500px;margin:0 auto;padding:30px 22px;color:#36516e}.ai-tool-page>header{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:24px}.ai-tool-page h1{margin:7px 0;font-size:28px}.ai-tool-page header span{font-size:10px;letter-spacing:2px;color:#7d97b8}.ai-tool-page header p{font-size:12px;color:#7d91aa}.tool-guide{padding:18px 22px;border:1px solid #dae7f9;background:#f2f7ff;border-radius:12px;line-height:1.9;font-size:12px;margin-bottom:22px}.tool-guide p{margin:6px 0;color:#6c83a2}.tool-card{border:1px solid #e1e9f3;border-radius:12px;padding:20px;background:white}.filters{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:18px}.filters .el-input{max-width:330px}.filters .el-select{width:150px}.filters small,.tool-note,small{color:#879ab2;font-size:11px}.ai-tool-page code{display:block;overflow-wrap:anywhere;font-size:11px;color:#8a9db5;margin-top:6px}.tool-card p{font-size:12px;line-height:1.8;margin:6px 0}pre{max-height:35vh;overflow:auto;background:#f5f8fc;padding:12px;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}summary{color:#4c83c2;font-size:12px;cursor:pointer}.el-form-item small{display:block;line-height:1.8;margin-left:8px}@media(max-width:700px){.ai-tool-page{padding:18px 10px}.ai-tool-page>header{align-items:flex-start;flex-direction:column}.tool-card{padding:10px}.tool-guide{padding:12px}.ai-tool-page h1{font-size:24px}}
</style>

<style>
/* 弹框传送到body后单独限定此类名；固定头尾，仅正文滚动，不影响其他业务弹框。 */
.tool-management-dialog{height:min(920px,92vh);display:flex;flex-direction:column;overflow:hidden}
.tool-management-dialog>.el-dialog__body{flex:1;min-height:0;overflow:auto}
.tool-management-dialog>.el-dialog__header,.tool-management-dialog>.el-dialog__footer{flex-shrink:0}
</style>
