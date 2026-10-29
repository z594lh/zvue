<template>
  <main class="ai-tool-preview-page" v-loading="loading">
    <header class="preview-page-header"><el-button @click="router.push('/ai/tools')">← 返回工具目录</el-button><div><h1>{{ tool?.label || '工具数据预览' }}</h1><p>{{ context || '保留系统导航与页签，只读核对工具实际返回的数据。' }}</p></div><el-tag type="info" effect="plain">只读 · 不调用AI</el-tag></header>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <AiToolDataBrowser v-if="tool" :key="tool.name" :tool="tool" @context-change="context=$event"/>
    <el-empty v-else-if="!loading && !error" description="该工具不存在或不是可预览的查询工具，请返回工具目录选择。"/>
  </main>
</template>
<script setup>
import { computed,onBeforeUnmount,onMounted,ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAiTools } from '@/services/api'
import AiToolDataBrowser from '@/components/AiToolDataBrowser.vue'
// 使用路由props而非全局route，缓存页签失活后仍保留各自的工具与查询结果。
const props=defineProps({toolName:{type:String,required:true}})
const router=useRouter(),loading=ref(false),error=ref(''),rows=ref([]),context=ref('')
const tool=computed(()=>rows.value.find(row=>row.name===props.toolName && !row.required))
let active=true
/** 独立页面按工具目录核对入口，直接访问或刷新也不依赖上一页临时状态。 */
async function load(){loading.value=true;error.value='';try{const {data}=await getAiTools();if(active)rows.value=data.data.list}catch(e){if(active)error.value=e.response?.data?.message || '工具目录读取失败，请刷新页面重试'}finally{if(active)loading.value=false}}
/** 页签关闭后忽略迟到响应；切换页签由系统keep-alive保留只读浏览状态。 */
function stop(){active=false}
onMounted(load);onBeforeUnmount(stop)
</script>
<style scoped>
.ai-tool-preview-page{margin:20px;padding:24px 28px;background:#fff;border:1px solid #e2eaf3;border-radius:12px;min-width:0;color:#324f72}.preview-page-header{display:flex;align-items:center;gap:20px;padding-bottom:20px;margin-bottom:20px;border-bottom:1px solid #e7edf5}.preview-page-header>div{flex:1;min-width:0}.preview-page-header h1{font-size:22px;margin:0}.preview-page-header p{font-size:12px;color:#7d92ad;margin:8px 0 0;line-height:1.8;overflow-wrap:anywhere}@media(max-width:700px){.ai-tool-preview-page{margin:10px;padding:16px 12px}.preview-page-header{gap:12px;flex-wrap:wrap}.preview-page-header h1{font-size:19px}.preview-page-header>.el-tag{display:none}}
</style>
