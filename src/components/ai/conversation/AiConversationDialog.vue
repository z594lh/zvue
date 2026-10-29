<template>
  <el-dialog v-model="visible" title="ASIN · AI对话" width="92vw" top="3vh" append-to-body destroy-on-close :close-on-click-modal="false">
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <div v-loading="loading"><AiConversation v-if="visible && product" :key="product.id" :product="product" :initial-session-id="sessionId" :initial-plan-id="planId" :initial-question="product.entry_question || ''"/></div>
  </el-dialog>
</template>
<script setup>
import {ref,onDeactivated,onBeforeUnmount} from 'vue'
import {resolveAiProduct} from '@/services/ai/workspace'
import AiConversation from './AiConversation.vue'
const visible=ref(false),loading=ref(false),error=ref(''),product=ref(null),sessionId=ref(''),planId=ref('')
let revision=0
/** 所有入口解析真实商品身份，打开不创建会话、托管或收费任务。 */
async function open(params,initial={}){const current=++revision;visible.value=true;loading.value=true;error.value='';product.value=null;sessionId.value=initial.sessionId || '';planId.value=initial.planId || '';try{const {data}=await resolveAiProduct(params);if(current===revision && visible.value)product.value=data.data}catch(e){if(current===revision)error.value=e.response?.data?.message || '商品对话读取失败'}finally{if(current===revision)loading.value=false}}
defineExpose({open})
/** 系统页签切换/销毁后关闭浮层，使内部轮询与迟到商品响应失效。 */
function close(){revision++;visible.value=false}
onDeactivated(close);onBeforeUnmount(close)
</script>
