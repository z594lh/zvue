<template>
  <main class="managed-workbench">
    <header class="managed-heading"><div><span class="eyebrow">AI STORE MANAGEMENT</span><h1>托管 ASIN</h1><p>自然语言交流，AI按需查询ERP，形成计划与连续观察。</p></div><div class="heading-actions"><el-tag type="warning" effect="plain">DeepSeek真实分析 · Amazon正式执行</el-tag><el-button type="primary" :disabled="!canAssign" :title="canAssign?'预约ASIN全部子SKU给AI运营':'需要AI托管权限'" @click="showAdd">＋ 添加托管ASIN</el-button></div></header>
    <section class="schedule-card"><div class="schedule-clock">18:30 <small>北京时间 · 每日</small></div><div><strong>自然任务 → 工具查询 → 优化计划 → 每日自动执行 / 人工确认执行</strong><p>同ASIN统一排队；问答历史超限时另行压缩摘要。DeepSeek按实际调用计费；工具过程仅本次分析使用，不重复加入下次聊天。</p></div></section>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <section class="managed-card">
      <div class="managed-filters"><el-input v-model="keyword" placeholder="搜索中文名、ASIN或SKU" clearable @keyup.enter="load(true)" /><el-select v-model="shopFilter" clearable placeholder="全部店铺" @change="load(true)"><el-option v-for="s in shops" :key="s.id" :value="s.id" :label="s.shop_name" /></el-select><el-select v-model="enabledFilter" clearable placeholder="全部托管状态" @change="load(true)"><el-option label="托管中" value="1" /><el-option label="已暂停" value="0" /></el-select><el-button :loading="loading" @click="load(true)">查询 / 刷新</el-button></div>
      <el-table :data="rows" v-loading="loading" class="managed-table" row-key="id" @row-click="openChat">
        <el-table-column label="托管商品" min-width="320"><template #default="{row}"><div class="managed-product"><el-image v-if="row.main_image_url" :src="row.main_image_url" fit="contain" loading="lazy" /><span v-else class="image-fallback">商品</span><div><strong>{{ row.product_name || row.products?.[0]?.item_name || '商品资料暂不可用' }}</strong><p>{{ row.asin }} <span>｜ {{ row.shop_name }}</span></p><small>{{ row.skus.join(' / ') || '有效Listing已移除，运行时会记录异常' }}</small></div></div></template></el-table-column>
        <el-table-column label="状态" width="110"><template #default="{row}"><el-tag :type="!row.enabled?'info':row.ownership_consistent===false?'warning':'success'">{{ !row.enabled?'已暂停':row.ownership_consistent===false?'归属待同步':'托管中' }}</el-tag><p v-if="row.executor_status===0" class="table-note" style="color:#d45c5c">AI账号已停用</p></template></el-table-column>
        <el-table-column label="AI人员 / 绩效归属" min-width="240"><template #default="{row}"><strong>{{ row.executor_name || '尚未绑定AI账号' }}</strong><el-tag v-if="row.executor_user_id" size="small" effect="plain" style="margin-left:7px">AI运营</el-tag><p class="table-note">人工启用：{{ row.initiated_by_name || '—' }}</p><div v-for="owner in row.ownership" :key="owner.sku" class="table-note">{{ row.ownership.length>1?owner.sku+'：':'' }}当前 {{ owner.current_owner || '未分配' }}<template v-if="owner.has_scheduled"><br>{{ owner.effective_date }} 起 → {{ owner.scheduled_owner || '解除分配' }}</template></div><el-button v-if="row.executor_user_id && canViewAll" link type="primary" @click.stop="viewPerformance(row)">查看AI绩效</el-button></template></el-table-column>
        <el-table-column label="最近优化" min-width="220"><template #default="{row}"><template v-if="row.latest_run"><strong>{{ row.latest_run.run_date }} · {{ stateName(row.latest_run.status) }}</strong><p class="table-note">已确认 {{ row.latest_run.summary.confirmed_count || 0 }} 项 · 当前保留观察 {{ row.active_observation_count }} 项</p></template><span v-else class="table-note">尚未运行 · 等待18:30或手动触发</span></template></el-table-column>
        <el-table-column label="操作" width="270" :fixed="wideScreen?'right':false">
          <template #header><span class="action-header">操作<el-tooltip content="运行今日会产生AI费用，并可能真实修改亚马逊；查看历史和同步归属不调用AI。" placement="top"><el-icon><QuestionFilled /></el-icon></el-tooltip></span></template>
          <template #default="{row}"><div class="operation-actions" @click.stop>
            <el-tooltip content="查看该ASIN跨日的ERP与AI共享对话、真实消息时间和资料；可新建会话。打开不调用AI、不修改店铺。" placement="top"><el-button type="primary" plain :icon="ChatDotRound" size="small" @click="openChat(row)">AI对话</el-button></el-tooltip>
            <el-tooltip content="统一查看每日自动优化和人工生成方案的改动、确认与执行回读。旧版记录只显示提示。只读，不计费。" placement="top"><el-button class="history-action" :icon="Clock" size="small" @click="openHistory(row)">优化记录</el-button></el-tooltip>
            <el-tooltip content="把今天的托管加入统一队列，排在同ASIN当前作业之后；后台随后收费分析并真实执行。同日已有记录不重复入队。" placement="top"><span><el-button type="primary" :icon="VideoPlay" size="small" :loading="runningId===row.id" :disabled="!row.enabled || !row.executor_user_id || !row.ownership_consistent || !!runningId" @click="runToday(row)">运行今日</el-button></span></el-tooltip>
            <el-dropdown trigger="click" @command="command=>moreAction(command,row)"><el-button size="small">更多操作 ▾</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="sync" :disabled="!row.enabled || !canAssign || row.ownership_consistent || !!changingId || !!runningId"><span title="仅预约全部子SKU的AI负责交接，不调用AI或修改亚马逊">同步AI负责归属</span></el-dropdown-item><el-dropdown-item command="toggle" :disabled="!!changingId || (!row.enabled && !canAssign)"><span :title="row.enabled?'停止后续任务，已提交操作不撤回，负责人不自动交回人工':'恢复后续每日真实托管，可能产生AI费用和真实修改'">{{ row.enabled?'暂停托管':'恢复托管' }}</span></el-dropdown-item></el-dropdown-menu></template></el-dropdown>
          </div></template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !rows.length" description="尚无托管商品，添加ASIN后可开始真实AI分析与正式执行" />
      <div class="managed-footer"><span>共 {{ total }} 个托管ASIN · 开启/恢复会预约全部子SKU给AI；15:00前变更次日生效，15:00起后天生效。暂停仅停止任务，不自动交回人工。</span><el-pagination v-if="total>20" v-model:current-page="page" :page-size="20" :total="total" layout="prev, pager, next" @current-change="load(false)" /></div>
    </section>
    <AiConversationDialog ref="chatDialog"/>
    <el-dialog v-if="selected" v-model="historyVisible" title="统一优化历史" width="min(1280px, calc(100% - 28px))" top="5vh" append-to-body class="ai-managed-history" :close-on-click-modal="false" @closed="closeHistory">
    <section class="daily-history">
      <div class="managed-heading"><div><span class="eyebrow">OPTIMIZATION HISTORY</span><h2>{{ selected.product_name || selected.asin }} · 统一优化历史</h2><p>{{ selected.asin }} · 每日自动优化、人工方案及其执行结果；普通讨论不列入，多批确认不重复计为多个方案。</p></div><el-button :loading="historyLoading" @click="loadHistory">刷新优化历史</el-button></div>
      <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" />
      <el-table :data="runs" v-loading="historyLoading" max-height="460">
        <el-table-column label="任务日（北京时间）" prop="run_date" width="145" />
        <el-table-column label="来源" width="140"><template #default="{row}"><el-tag effect="plain" :type="row.source==='human'?'warning':'primary'">{{ row.source==='human'?'人工生成方案':'每日自动优化' }}</el-tag></template></el-table-column>
        <el-table-column label="结果" width="130"><template #default="{row}"><el-tag :type="row.legacy?'info':row.status==='completed'?'success':row.status==='failed'?'danger':'info'">{{ row.legacy?'旧版记录':stateName(row.status) }}</el-tag></template></el-table-column>
        <el-table-column label="执行 / 发起人员" min-width="160"><template #default="{row}"><template v-if="row.audit_context"><strong>{{ row.audit_context.executor.name }}</strong><p class="table-note">{{ row.trigger_source==='scheduled'?'授权启用人':'人工发起人' }}：{{ row.audit_context.initiated_by.name }}</p></template><span v-else class="table-note">{{ row.actor_name?'提问人：'+row.actor_name:'历史记录未保存独立AI身份' }}</span></template></el-table-column>
        <el-table-column label="本次优化结论" min-width="320"><template #default="{row}"><p class="run-conclusion">{{ row.legacy?'旧数据，无法查看':row.summary.conclusion || row.message }}</p><small v-if="!row.legacy" class="table-note">报告截至 {{ row.report_date || '准备中' }} · {{ row.source==='human'?'人工方案需确认后执行':row.trigger_source==='scheduled'?'18:30自动执行':'手动触发每日流程' }} · 建议改动 {{ row.summary.change_count || 0 }} 项</small></template></el-table-column>
        <el-table-column label="执行 / 回读一致" min-width="140"><template #default="{row}"><span v-if="row.legacy">—</span><template v-else>{{ row.summary.executed_count || 0 }} / {{ row.summary.confirmed_count || 0 }}</template></template></el-table-column>
        <el-table-column label="详情" width="145"><template #default="{row}"><span v-if="row.legacy || row.detail_available===false" class="table-note">旧数据，无法查看</span><el-button v-else link type="primary" @click="openDetail(row)">查看详情</el-button></template></el-table-column>
      </el-table>
      <el-empty v-if="!historyLoading && !runs.length" description="暂无优化记录；每日优化和人工生成方案将在这里统一展示" />
      <el-pagination v-if="historyTotal>20" v-model:current-page="historyPage" :page-size="20" :total="historyTotal" layout="prev, pager, next" @current-change="loadHistory" />
    </section>
    </el-dialog>
    <el-dialog v-model="detailVisible" title="优化详情" width="min(1380px, calc(100% - 24px))" top="3vh" append-to-body destroy-on-close class="ai-managed-detail" :close-on-click-modal="false" @closed="closeDetail"><AiOperationDetail v-if="detailVisible && selectedRun" :run-id="selectedRun.id" :source="selectedRun.source" @open-chat="openLinkedChat" /></el-dialog>
    <el-dialog v-model="addVisible" title="添加托管ASIN" :width="wideScreen?'560px':'calc(100% - 28px)'" class="managed-add" :close-on-click-modal="false">
      <p class="add-description">每天北京时间18:30参与托管，DeepSeek会真实分析并计费；ERP将根据方案真实修改Listing与广告并记录AI操作，可随时暂停后续任务。</p>
      <el-alert title="开启后预约全部有效子SKU给AI运营；北京时间15:00前变更默认次日生效，15:00起默认后天生效。历史绩效不回填；暂停不会自动交回人工。" type="info" :closable="false" show-icon style="margin-bottom:18px" />
      <el-form label-position="top"><el-form-item label="店铺"><el-select v-model="addShop" placeholder="选择店铺" @change="chooseShop"><el-option v-for="s in shops" :key="s.id" :value="s.id" :label="s.shop_name" /></el-select></el-form-item><el-form-item label="本店ASIN"><el-select v-model="addAsin" filterable :disabled="!addShop || optionsLoading" :loading="optionsLoading" placeholder="搜索中文名、ASIN或SKU"><el-option v-for="p in products" :key="p.asin" :value="p.asin" :label="(p.product_name || '未维护中文名')+' · '+p.asin+' · '+p.skus.join(' / ')" /></el-select></el-form-item></el-form>
      <el-alert v-if="addError" :title="addError" type="error" :closable="false" />
      <template #footer><el-button :disabled="adding" @click="addVisible=false">取消</el-button><el-button type="primary" :loading="adding" :disabled="!addShop || !addAsin || optionsLoading" @click="add">开启托管（真实AI）</el-button></template>
    </el-dialog>
  </main>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, VideoPlay, QuestionFilled, ChatDotRound } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import AiOperationDetail from '@/components/AiOperationDetail.vue'
import AiConversationDialog from '@/components/ai/conversation/AiConversationDialog.vue'
import { getUserPermissions, getAiOperationsOptions, getAiManagedAsins, addAiManagedAsin, updateAiManagedAsin, getAiManagedRuns, runAiManagedAsin } from '@/services/api.js'
const router=useRouter(),userCodes=getUserPermissions(),canViewAll=userCodes.includes('performance:view_all'),canAssign=userCodes.includes('ai_operations:manage')
/** 跳到同店铺、同AI人员的绩效筛选，不更改绩效数据或重新分析。 */
function viewPerformance(row){router.push({path:'/performance',query:{shop_id:String(row.shop_id),user_id:String(row.executor_user_id)}})}
const wideScreen=ref(window.innerWidth>700)
const chatDialog=ref(null)
/** 从托管行独立打开跨日对话，不触发AI或每日流程。 */
function openChat(row){chatDialog.value?.open({shop_id:row.shop_id,asin:row.asin})}
/** 从每日详情定位原会话与方案，关闭旧弹框避免三层滚动。 */
function openLinkedChat(info){const row=rows.value.find(r=>String(r.id)===String(info.managed_id)) || selected.value;if(!row)return;chatDialog.value?.open({shop_id:row.shop_id,asin:row.asin},{sessionId:String(info.conversation_id),planId:String(info.plan_id)});detailVisible.value=false;historyVisible.value=false}
/** 配套归属与启停操作收进菜单，仍使用原权限和提示。 */
function moreAction(command,row){if(command==='sync')syncOwner(row);else if(command==='toggle')toggle(row)}
/** 跟随窗口宽度切换列表固定操作列，不改变弹框的当前记录。 */
function resize(){wideScreen.value=window.innerWidth>700}
const shops=ref([]),rows=ref([]),total=ref(0),page=ref(1),keyword=ref(''),shopFilter=ref(null),enabledFilter=ref(null),loading=ref(false),error=ref('')
const selected=ref(null),runs=ref([]),historyTotal=ref(0),historyPage=ref(1),historyLoading=ref(false),historyError=ref('')
const historyVisible=ref(false),detailVisible=ref(false),selectedRun=ref(null)
const addVisible=ref(false),addShop=ref(null),addAsin=ref(''),rawProducts=ref([]),optionsLoading=ref(false),adding=ref(false),addError=ref(''),runningId=ref(''),changingId=ref('')
let revision=0,historyRevision=0,optionRevision=0,active=true,initialized=false
/** 用中文展示当前会话任务阶段。 */
function stateName(state){return {queued:'统一队列等待中',running:'处理中',awaiting_confirmation:'方案待确认',unknown:'结果待核实',cancelled:'已取消',preparing:'整理资料',analyzing:'AI分析中',executing:'执行回读中',completed:'优化完成',partial:'部分待核对',failed:'执行异常',paused:'已停止'}[state] || state}
/** 提取可展示的异常，超时明确提示勿重复发起付费请求。 */
function message(error){return error.response?.data?.message || (error.code==='ECONNABORTED'?'等待超时不代表后台任务停止，请刷新优化历史，不要重复发起付费分析':'读取或处理未完成，请刷新历史核对')}
// 把店铺多个SKU按ASIN合并为添加托管时的一条选项。
const products=computed(()=>{const map=new Map();for(const p of rawProducts.value){if(!map.has(p.asin))map.set(p.asin,{...p,skus:[]});map.get(p.asin).skus.push(p.sku)}return [...map.values()]})
/** 按当前筛选分页读取托管列表，过期响应不覆盖新列表。 */
async function load(reset=false){
  const current=++revision;loading.value=true;error.value=''
  if(reset)page.value=1
  try{const {data}=await getAiManagedAsins({page:page.value,keyword:keyword.value,shop_id:shopFilter.value || undefined,enabled:enabledFilter.value ?? undefined});if(current===revision && active){rows.value=data.data.list;total.value=data.data.total}}
  catch(e){if(current===revision && active)error.value=message(e)}
  finally{if(current===revision)loading.value=false}
}
/** 在弹框中打开选中ASIN的历史，不改变路由或页面滚动位置。 */
async function openHistory(row){
  selected.value=row;historyPage.value=1;historyVisible.value=true;await loadHistory()
}
/** 在历史弹框中刷新当前分页，切ASIN或关闭后的响应直接丢弃。 */
async function loadHistory(){
  if(!selected.value || !active || !historyVisible.value)return
  const current=++historyRevision;historyLoading.value=true;historyError.value='';runs.value=[]
  try{const {data}=await getAiManagedRuns(selected.value.id,{page:historyPage.value});if(current===historyRevision && active && historyVisible.value){runs.value=data.data.list;historyTotal.value=data.data.total}}
  catch(e){if(current===historyRevision && active)historyError.value=message(e)}
  finally{if(current===historyRevision)historyLoading.value=false}
}
/** 在第二层弹框打开详情，保留第一层历史的分页和滚动位置。 */
function openDetail(row){if(row.legacy || row.detail_available===false)return;selectedRun.value={id:row.id,source:row.source || 'daily'};detailVisible.value=true}
/** 关闭历史后使进行中的读取失效，避免迟到列表重新出现。 */
function closeHistory(){historyRevision++;historyLoading.value=false}
/** 详情关闭后销毁记录组件，不保留其网络请求与阅读弹框。 */
function closeDetail(){selectedRun.value=null}
/** 打开添加配置弹框并清除上次选择，未触发AI分析。 */
function showAdd(){addVisible.value=true;addShop.value=null;addAsin.value='';rawProducts.value=[];addError.value='';optionRevision++}
/** 切换店铺后只读取该店可托管ASIN，丢弃之前店铺的迟到选项。 */
async function chooseShop(){
  const current=++optionRevision;addAsin.value='';rawProducts.value=[];optionsLoading.value=true;addError.value=''
  if(!addShop.value){optionsLoading.value=false;return}
  try{const {data}=await getAiOperationsOptions({shop_id:addShop.value});if(current===optionRevision && active)rawProducts.value=data.data.products}
  catch(e){if(current===optionRevision && active)addError.value=message(e)}
  finally{if(current===optionRevision)optionsLoading.value=false}
}
/** 保存托管配置；重复添加不自动恢复暂停，也不自动付费运行。 */
async function add(){
  if(adding.value || !addShop.value || !addAsin.value)return
  const current=revision;adding.value=true;addError.value=''
  try{await addAiManagedAsin({shop_id:addShop.value,asin:addAsin.value});if(current===revision && active){addVisible.value=false;ElMessage.success('托管配置已保存；已存在的ASIN不会重复添加或自动恢复');await load(true)}}
  catch(e){if(active)addError.value=message(e)}
  finally{adding.value=false}
}
/** 暂停或恢复每日托管，保留会话与历史。 */
async function toggle(row){
  if(!row.enabled){try{await ElMessageBox.confirm('恢复后将参与每日真实AI托管，可能产生AI费用并修改Listing和广告；同时预约AI负责交接。','恢复真实托管',{confirmButtonText:'确认恢复',cancelButtonText:'取消',type:'warning'})}catch{return}}
  changingId.value=row.id
  try{await updateAiManagedAsin(row.id,{enabled:!row.enabled});if(active){ElMessage.success(row.enabled?'已暂停；负责人不会自动交回人工，请在负责人分配页交接':'已恢复并同步AI负责交接，将参与后续每日托管');await load()}}
  catch(e){if(active)error.value=message(e)}
  finally{changingId.value=''}
}
/** 旧托管绑定AI或明确重新预约负责人，不触发AI计费或商品广告修改。 */
async function syncOwner(row){
  if(changingId.value || runningId.value)return
  changingId.value=row.id
  try{await updateAiManagedAsin(row.id,{enabled:true});if(active){ElMessage.success('AI账号与全部子SKU负责归属已同步，当前归属和待生效日期见列表');await load()}}
  catch(e){if(active)error.value=message(e)}
  finally{changingId.value=''}
}
/** 显式登记今日任务，入队后打开历史弹框；同日由服务端保证幂等。 */
async function runToday(row){
  if(runningId.value || !row.enabled)return
  runningId.value=row.id;error.value=''
  try{await ElMessageBox.confirm('将把今日任务加入统一队列，后台随后调用DeepSeek（可能计费），并按每日方案真实修改Listing或关联广告。与人工分析/确认执行按同ASIN顺序处理；同日已有记录不重复入队。','运行今日 · 排队后真实运营',{confirmButtonText:'确认入队并授权每日执行',cancelButtonText:'取消',type:'warning',closeOnClickModal:false})}catch{runningId.value='';return}
  try{const {data}=await runAiManagedAsin(row.id);if(active){ElMessage.info(data.data.reused?'今日记录已存在，未重复入队或提交':'今日任务已进入统一队列；后台稍后分析和执行，可在AI对话查看进度');await load();await openHistory(rows.value.find(r=>r.id===row.id) || row)}}
  catch(e){if(active){error.value=message(e);await openHistory(row)}}
  finally{runningId.value=''}
}
/** 首次进入只加载店铺与托管列表，不自动触发AI或弹历史。 */
async function initialize(){
  if(initialized)return
  initialized=true
  try{const {data}=await getAiOperationsOptions();if(active)shops.value=data.data.shops}catch(e){if(active)error.value=message(e)}
  await load()
}
/** 离开页签时关闭所有弹框，使未完成请求失效。 */
function stop(){active=false;revision++;historyRevision++;optionRevision++;loading.value=false;historyLoading.value=false;optionsLoading.value=false;detailVisible.value=false;historyVisible.value=false;addVisible.value=false}
/** 首次挂载绑定尺寸变化并初始化列表。 */
function mount(){window.addEventListener('resize',resize);initialize()}
/** 销毁时释放窗口监听器，避免页签重复注册。 */
function unmount(){stop();window.removeEventListener('resize',resize)}
/** 回到缓存页签只刷新列表，不重开之前关闭的弹框。 */
function resume(){if(!active){active=true;load()}}
onMounted(mount);onDeactivated(stop);onBeforeUnmount(unmount);onActivated(resume)
</script>

<style scoped>
.action-header{display:inline-flex;align-items:center;gap:6px}.action-header .el-icon{color:#8ba0bc;cursor:help}.operation-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 0}.operation-actions>span{display:block;min-width:0}.operation-actions .el-button{width:100%;margin:0;height:31px;border-radius:7px;font-weight:500}.history-action{background:#f1f6ff;color:#4776b6;border-color:#dce7f7}.managed-workbench{max-width:1540px;margin:auto;padding:28px;color:#293f5b}.managed-heading,.heading-actions,.managed-filters,.managed-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.eyebrow{font-size:11px;letter-spacing:2px;color:#6887b5}.managed-heading h1{font-size:28px;margin:10px 0}.managed-heading h2{font-size:19px;margin:9px 0}.managed-heading p,.schedule-card p,.table-note,.managed-footer{font-size:12px;color:#8191a7;line-height:1.8}.schedule-card{display:flex;gap:24px;align-items:center;padding:22px 26px;border:1px solid #d7e7fb;border-radius:12px;background:#edf5ff;margin:24px 0}.schedule-clock{font-size:28px;font-weight:650;color:#3c78bf;white-space:nowrap}.schedule-clock small{display:block;font-size:11px;font-weight:400;margin-top:7px}.schedule-card strong{font-size:13px;line-height:1.8}.schedule-card p{margin:5px 0}.managed-card{background:white;border:1px solid #e2e9f2;border-radius:12px;padding:22px;margin-top:20px;min-width:0}.managed-filters{justify-content:flex-start;margin-bottom:20px}.managed-filters>.el-input{width:260px}.managed-filters>.el-select{width:165px}.managed-product{display:flex;align-items:center;gap:14px;padding:15px 0}.managed-product .el-image,.image-fallback{width:58px;height:58px;flex-shrink:0;background:#f5f8fc;border:1px solid #e9eef6;border-radius:8px}.image-fallback{display:flex;align-items:center;justify-content:center;font-size:12px;color:#9aa8ba}.managed-product strong{display:block;line-height:1.6;font-size:14px}.managed-product p{margin:5px 0;font-size:12px;color:#4c7bb5}.managed-product p span,.managed-product small{font-size:12px;color:#91a0b4}.managed-table :deep(.el-table__row){cursor:pointer}.managed-table :deep(.el-table__header-wrapper th){background:#f6f9fd;color:#788da8}.managed-footer{margin-top:18px}.run-conclusion{line-height:1.8;font-size:13px}.daily-history{scroll-margin-top:110px}.managed-add .el-select{width:100%}.add-description{color:#71859f;line-height:1.8;font-size:13px}.managed-workbench>.el-alert{margin:12px 0}@media(max-width:700px){.managed-workbench{padding:14px}.managed-card{padding:14px}.schedule-card{padding:16px;align-items:flex-start;gap:14px;flex-direction:column}.managed-heading h1{font-size:24px}.heading-actions{justify-content:flex-start}.managed-filters>.el-input,.managed-filters>.el-select{width:100%}.managed-workbench :deep(.managed-add){width:calc(100% - 28px)!important}.managed-product{gap:9px}.managed-product .el-image,.image-fallback{width:45px;height:45px}}
</style>
<style>
.ai-managed-history .el-dialog__body,.ai-managed-detail .el-dialog__body{max-height:78vh;overflow-y:auto;overflow-x:hidden;padding-top:12px}.ai-managed-history .run-conclusion{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.ai-managed-history .managed-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}.ai-managed-history h2{font-size:17px;color:#344e6e}.ai-managed-history p{font-size:12px;color:#8798ae}.ai-managed-history .el-pagination{margin-top:20px}.ai-managed-detail .el-dialog__header{border-bottom:1px solid #edf0f5;margin-right:0;padding-bottom:18px}
</style>
