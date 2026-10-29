<template>
  <section class="tool-statistics" v-loading="loading">
    <div class="stat-toolbar"><el-select v-model="days" @change="load"><el-option v-for="n in [7,14,30,90]" :key="n" :label="`近 ${n} 天`" :value="n"/></el-select><el-button :loading="loading" @click="load">刷新统计</el-button><small>只读已有记录，不调用AI、不计AI费用</small></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <el-alert v-if="info?.truncated" title="记录已超出本次样本上限，以下仅为最近样本，不代表所选时间段全部使用情况。" type="warning" :closable="false"/>
    <template v-if="info"><div class="stat-cards"><div><small>任务样本</small><strong>{{ num(info.jobs) }}</strong></div><div><small>AI请求轮次 / 工具调用</small><strong>{{ num(info.model_rounds) }} / {{ num(info.tool_calls) }}</strong></div><div><small>已记录输入 / 输出 token</small><strong>{{ num(info.tokens.prompt_tokens) }} / {{ num(info.tokens.completion_tokens) }}</strong></div><div><small>输入缓存命中 token</small><strong>{{ num(info.tokens.prompt_cache_hit_tokens) }}</strong></div></div>
      <p class="stat-note">{{ info.note }}</p>
      <el-table :data="info.tools" row-key="name"><el-table-column label="工具" min-width="180"><template #default="{row}"><strong>{{ row.label }}</strong><code>{{ row.name }}</code></template></el-table-column><el-table-column prop="calls" label="调用次数" width="100" sortable/><el-table-column label="返回状态" min-width="210"><template #default="{row}"><span>{{ statuses(row.statuses) }}</span></template></el-table-column><el-table-column label="累计返回体积" width="150"><template #default="{row}">{{ size(row.result_bytes) }}<small v-if="row.estimated_bytes_calls">含历史估算</small></template></el-table-column><el-table-column label="平均工具耗时" width="150"><template #default="{row}">{{ row.timed_calls?`${Math.round(row.elapsed_ms/row.timed_calls)} ms`:'未记录' }}<small v-if="row.timed_calls">{{ row.timed_calls }} 次有记录</small></template></el-table-column></el-table>
      <el-tabs class="pattern-tabs"><el-tab-pane label="同轮工具组合"><p>同一次AI回复同时要求哪些工具，不把并行调用的排列顺序当调用先后。</p><el-table :data="info.combinations"><el-table-column prop="label" label="工具组合" min-width="400"/><el-table-column prop="count" label="出现轮次" width="110"/></el-table></el-tab-pane><el-tab-pane label="数据与窗口组合"><p>展开组合工具的子查询，查看经常一起读取的数据类型和时间窗口，供下一步设计新工具。</p><el-table :data="info.data_combinations"><el-table-column prop="label" label="同轮资料组合" min-width="450"/><el-table-column prop="count" label="次数" width="100"/></el-table></el-tab-pane><el-tab-pane label="相邻轮次顺序"><p>同一任务相邻的有工具轮次：先查什么，再查什么。频次不代表因果或建议自动新增工具。</p><el-table :data="info.sequences"><el-table-column prop="label" label="工具组合先后顺序" min-width="450"/><el-table-column prop="count" label="次数" width="100"/></el-table></el-tab-pane><el-tab-pane label="常查资料"><el-table :data="info.queries"><el-table-column prop="label" label="资料与窗口" min-width="350"/><el-table-column prop="count" label="次数" width="100"/></el-table></el-tab-pane></el-tabs>
      <small class="stat-note">样本事件 {{ info.sample_events }} 条 · 频次用于研究，不会自动分析或修改工具；耗时只指ERP工具执行，不是模型思考时间。</small>
    </template>
  </section>
</template>

<script setup>
import { onBeforeUnmount,onMounted,ref } from 'vue'
import { getAiToolStatistics } from '@/services/api'
const days=ref(7),info=ref(null),loading=ref(false),error=ref('');let active=true,revision=0
/** 显式读取有界统计，时间切换时只应用最新响应，不启动任何模型任务。 */
async function load(){const id=++revision;loading.value=true;error.value='';try{const {data}=await getAiToolStatistics({days:days.value});if(active && id===revision)info.value=data.data}catch(e){if(active && id===revision)error.value=e.response?.data?.message || '工具统计读取失败'}finally{if(active && id===revision)loading.value=false}}
/** 缺少用量保持未知，不用零掩盖账单回执缺失。 */
function num(value){return value==null?'未知':Number(value).toLocaleString()}
/** 字节与token分别展示，避免误读成模型计费量。 */
function size(value){return value>=1048576?`${(value/1048576).toFixed(2)} MB`:`${(value/1024).toFixed(1)} KB`}
/** 汇总真实状态计数，方案校验通过不等于平台执行成功。 */
function statuses(values){const labels={provided:'已返回',validated:'校验通过',error:'失败',too_large:'超限',budget_exceeded:'预算不足未交付',empty:'无匹配记录',unavailable:'无资料',pending:'无返回',partial:'部分返回',disabled:'已关闭'};return Object.entries(values).map(([key,count])=>`${labels[key] || key} ${count}`).join(' · ')}
/** 离页后不显示迟到统计结果。 */
function stop(){active=false;revision++}
onMounted(load);onBeforeUnmount(stop)
</script>

<style scoped>
.stat-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}.stat-toolbar .el-select{width:140px}.stat-toolbar small,.stat-note{font-size:11px;color:#8398b4;line-height:1.9}.stat-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.stat-cards>div{padding:17px;background:#f3f7fe;border:1px solid #e0e9f6;border-radius:9px}.stat-cards small{font-size:11px;color:#8398b4;display:block}.stat-cards strong{display:block;font-size:20px;margin-top:8px;color:#35669c}.tool-statistics code{font-size:10px;color:#8a9db5;display:block;margin-top:5px;overflow-wrap:anywhere}.tool-statistics .el-table small{display:block;font-size:10px;color:#8a9db5;margin-top:5px}.pattern-tabs{margin-top:24px}.pattern-tabs p{font-size:12px;color:#8398b4;line-height:1.8}@media(max-width:800px){.stat-cards{grid-template-columns:repeat(2,1fr)}.stat-cards>div{padding:12px}.stat-cards strong{font-size:16px}}@media(max-width:420px){.stat-cards{grid-template-columns:1fr}}
</style>
