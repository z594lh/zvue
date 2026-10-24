<template>
  <div class="readable-value">
    <template v-if="objectValue">
      <dl v-if="known.length" class="value-pairs">
        <template v-for="[key,child] in known" :key="key"><dt :title="dictionaryEntry('data.field',key)?.description || key">{{ fieldLabel(key) }}</dt><dd>
          <AiToolValue v-if="child && typeof child==='object' && depth<4" :value="child" :field="key" :depth="depth+1" :currency="rowCurrency(value,currency)"/>
          <span v-else>{{ formatValue(key,child,rowCurrency(value,currency),value.unit) }}</span>
        </dd></template>
      </dl>
      <details v-if="unknown.length" class="unknown-fields"><summary>{{ unknown.length }} 个技术字段 / 尚未配置中文名称的字段（保留原文）</summary><dl><template v-for="[key,child] in unknown" :key="key"><dt>{{ key }}</dt><dd><pre>{{ pretty(child) }}</pre></dd></template></dl></details>
      <p v-if="!Object.keys(value).length" class="muted">已返回空对象</p>
    </template>
    <template v-else-if="Array.isArray(value)"><p v-if="!value.length" class="muted">已返回空列表</p><div v-for="(child,i) in value" :key="i" class="value-item"><b v-if="value.length>1">{{ i+1 }}.</b><AiToolValue v-if="child && typeof child==='object' && depth<4" :value="child" :field="field" :depth="depth+1" :currency="currency"/><span v-else>{{ typeof child==='object'?pretty(child):formatValue(field,child) }}</span></div></template>
    <span v-else>{{ formatValue('',value) }}</span>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { dictionaryEntry } from '@/utils/businessDictionary'
import { fieldEntry,fieldLabel,formatValue,pretty,rowCurrency } from '@/utils/aiToolData'
const props=defineProps({value:{default:null},field:{type:String,default:''},currency:{type:String,default:''},depth:{type:Number,default:0}})
const objectValue=computed(()=>props.value && typeof props.value==='object' && !Array.isArray(props.value))
// 未适配或技术字段只折叠，不丢弃；不把未知字段猜成某项业务结论。
const known=computed(()=>objectValue.value?Object.entries(props.value).filter(([key])=>fieldEntry(key)):[])
const unknown=computed(()=>objectValue.value?Object.entries(props.value).filter(([key])=>!fieldEntry(key)):[])
</script>
<style scoped>
.readable-value{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.8;color:#344f70}.value-pairs{display:grid;grid-template-columns:minmax(110px,160px) minmax(0,1fr);margin:0;gap:10px 18px}.value-pairs>dt{color:#71849c;font-size:12px}.value-pairs>dd{margin:0;min-width:0}.value-item{padding:8px 0;display:flex;gap:10px}.value-item>.readable-value{flex:1;min-width:0}.muted{color:#8a99ad}.unknown-fields{margin:12px 0;color:#7b8da5;font-size:12px}.unknown-fields summary{cursor:pointer}.unknown-fields dt{font-family:monospace}.unknown-fields dd{margin:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7fb;padding:8px;max-height:280px;overflow:auto}@media(max-width:650px){.value-pairs{grid-template-columns:1fr;gap:3px}.value-pairs>dd{margin-bottom:12px}}
</style>
