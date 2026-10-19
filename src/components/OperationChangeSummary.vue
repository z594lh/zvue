<template>
  <div class="operation-change-summary"><div v-if="summary" class="operation-plain-summary">{{ summary }}</div><TextChangeDiff v-if="entries.length" :entries="entries" /></div>
</template>
<script setup>
import { computed } from 'vue'
import TextChangeDiff from '@/components/TextChangeDiff.vue'
import { operationTextSummary, textDiffEntries } from '@/utils/listingTextDiff'
const props = defineProps({operation: {type: Object, required: true}})
const entries = computed(() => textDiffEntries(props.operation.text_changes))
const summary = computed(() => operationTextSummary(props.operation))
</script>
<style scoped>
.operation-change-summary{white-space:normal}.operation-plain-summary{white-space:pre-wrap;overflow-wrap:anywhere;max-height:160px;overflow-y:auto;line-height:1.7}
</style>
