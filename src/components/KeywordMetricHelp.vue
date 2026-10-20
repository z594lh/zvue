<template>
  <el-tooltip v-if="tip" :trigger="['hover','click','focus']" placement="top" effect="light" :show-after="150" :hide-after="120" popper-class="keyword-metric-tip">
    <template #content><div class="metric-tip-content"><strong>{{ tip.title }}</strong><p v-for="(paragraph,index) in tip.paragraphs" :key="index">{{ paragraph }}</p></div></template>
    <button type="button" class="metric-help" :aria-label="`查看${tip.title}说明`" @click.stop><span aria-hidden="true">?</span></button>
  </el-tooltip>
</template>
<script setup>
import { computed } from 'vue'
import { keywordMetricTips } from '@/utils/keywordReverseTips'
const props=defineProps({metric:{type:String,required:true}})
const tip=computed(()=>keywordMetricTips[props.metric])
</script>
<style scoped>
.metric-help{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;vertical-align:middle;width:16px;height:18px;margin-left:2px;padding:0;border:0;background:transparent;color:#dc894a;cursor:help;font:inherit;font-size:10px;line-height:1}
.metric-help>span{display:flex;align-items:center;justify-content:center;border:1px solid currentColor;border-radius:50%;width:11px;height:11px;box-sizing:border-box}
.metric-help:hover,.metric-help:focus-visible{color:#e66d19;background:#fff1e4;border-radius:3px;outline:2px solid #ffcb9f;outline-offset:1px}
.metric-tip-content{width:350px;max-width:calc(100vw - 56px);max-height:55vh;overflow:auto;font-size:12px;line-height:1.85;color:#52657b;overflow-wrap:anywhere;white-space:normal;font-weight:400}
.metric-tip-content strong{font-size:13px;color:#344962}.metric-tip-content p{margin:8px 0 0}
:global(.keyword-metric-tip){max-width:calc(100vw - 28px);padding:12px 14px!important;border-color:#e2e8f0!important;box-shadow:0 5px 20px #25395115}
</style>
