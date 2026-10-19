<template>
  <section class="text-change-diff" aria-label="文本修改差异">
    <div class="diff-toolbar"><span>红删绿增 · 提交内容对比</span><button type="button" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起未变内容' : '展开完整对照' }}</button></div>
    <article v-for="(entry, index) in comparisons" :key="index" class="diff-field">
      <div class="diff-label">{{ entry.label }}</div>
      <div v-for="(row, rowIndex) in textDiffRows(entry, expanded)" :key="rowIndex" :class="['diff-line', `diff-${row.type}`]"><span class="diff-sign" :aria-label="row.type === 'remove' ? '删除' : row.type === 'add' ? '新增' : '未变化'">{{ row.type === 'remove' ? '−' : row.type === 'add' ? '+' : '=' }}</span><div class="diff-content"><span v-for="(part, partIndex) in row.parts" :key="partIndex" :class="{'diff-emphasis': part.changed}">{{ part.text }}</span></div></div>
    </article>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { textDiffEntries, textDiffRows } from '@/utils/listingTextDiff'
const props = defineProps({changes: {type: Array, default: () => []}, entries: {type: Array, default: null}})
const expanded = ref(false)
const comparisons = computed(() => props.entries || textDiffEntries(props.changes))
</script>

<style scoped>
.text-change-diff{border:1px solid #dce5ee;border-radius:6px;overflow:hidden;margin:8px 0;font-size:12px;line-height:1.8;color:#475569;white-space:normal}.diff-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:5px 10px;background:#f7f9fc;color:#7b8ba1;font-size:11px;flex-wrap:wrap}.diff-toolbar button{border:0;background:transparent;color:#2475be;cursor:pointer;font-size:11px;padding:3px}.diff-toolbar button:focus-visible{outline:2px solid #409eff}.diff-label{padding:5px 10px;background:#f1f5f9;font-weight:600}.diff-field+.diff-field{border-top:1px solid #dce5ee}.diff-line{display:flex;align-items:stretch;min-width:0}.diff-sign{width:28px;flex-shrink:0;text-align:center;user-select:none;color:#64748b;padding:5px 0}.diff-content{padding:5px 10px 5px 0;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}.diff-remove{background:#fff0f0}.diff-remove .diff-sign{color:#a83636}.diff-add{background:#edfaf1}.diff-add .diff-sign{color:#227444}.diff-remove .diff-emphasis{background:#ffcaca;color:#8f2727;text-decoration:line-through;text-decoration-thickness:1px}.diff-add .diff-emphasis{background:#bceccc;color:#175e32}.diff-equal{background:#f8fafc;color:#94a3b8}
</style>
