<template>
  <MetricHelp v-if="tip" :title="tip.title" :paragraphs="tip.paragraphs" popper-class="keyword-metric-tip" />
</template>
<script setup>
import { computed } from 'vue'
import { keywordMetricTips } from '@/utils/keywordReverseTips'
import MetricHelp from '@/components/MetricHelp.vue'
const props=defineProps({metric:{type:String,required:true}})
const tip=computed(()=>keywordMetricTips[props.metric])
</script>
