<template>
  <el-dialog :model-value="true" title="绑定竞品 ASIN" width="min(560px, 94vw)" append-to-body :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" @close="emit('close')">
    <div v-loading="loading" class="competitor-dialog">
      <div class="competitor-source"><strong>{{ snapshot?.asin || asin }}</strong><span>{{ sku }}</span></div>
      <p class="competitor-hint">每行一个，支持逗号或空格分隔，最多50个。清空后保存可解除全部绑定。</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-alert v-if="snapshot && !snapshot.capabilities.can_edit" title="当前仅可查看，需要 Listing 编辑权限才能修改绑定。" type="info" :closable="false" />
      <el-input v-model="draft" type="textarea" :rows="6" :maxlength="2200" :disabled="!editable || saving" placeholder="B0XXXXXXXX&#10;B0YYYYYYYY" aria-label="竞品ASIN列表" />
      <div v-if="preview.length" class="competitor-preview"><a v-for="item in preview" :key="item" :href="`https://www.amazon.com/dp/${item}`" target="_blank" rel="noopener noreferrer">{{ item }}</a></div>
      <el-checkbox v-model="collect" :disabled="!canCollect || saving">同时加入卖家精灵关键词采集配置</el-checkbox>
      <p v-if="snapshot" class="competitor-hint">{{ !snapshot.capabilities.can_collect ? '此选项需要卖家精灵配置权限。' : snapshot.marketplace_id !== US ? '卖家精灵采集目前仅支持美国站。' : '勾选后新增采集配置，等待计划任务采集；已有配置保持原设置。' }}</p>
      <p class="competitor-hint">解除竞品绑定不会停用已有采集配置。</p>
    </div>
    <template #footer><el-button :disabled="saving" @click="emit('close')">取消</el-button><el-button v-if="snapshot?.capabilities.can_edit" type="primary" :loading="saving" :disabled="loading || !snapshot" @click="save">保存绑定</el-button></template>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getListingCompetitors, saveListingCompetitors } from '@/services/api'

const props=defineProps({shopId:{type:[Number,String],required:true},sku:{type:String,required:true},asin:{type:String,default:''}})
const emit=defineEmits(['close','saved']),US='ATVPDKIKX0DER'
const loading=ref(true),saving=ref(false),snapshot=ref(null),draft=ref(''),collect=ref(false),error=ref('')
let disposed=false
const editable=computed(()=>!!snapshot.value?.capabilities.can_edit)
const canCollect=computed(()=>editable.value && snapshot.value?.capabilities.can_collect && snapshot.value.marketplace_id===US)
const tokens=computed(()=>draft.value.trim()?draft.value.trim().split(/[\s,，;；]+/).map(value=>value.toUpperCase()):[])
const preview=computed(()=>[...new Set(tokens.value.filter(value=>/^[A-Z0-9]{10}$/.test(value)))])

/** 读取源Listing当前关系和版本；失败时禁止保存，避免把读取失败误当空绑定。 */
async function load(){
  try{
    const {data}=await getListingCompetitors(props.sku,props.shopId)
    if(disposed)return
    if(data.status!=='success' || !Array.isArray(data.data?.asins) || !data.data?.version || !data.data?.capabilities)throw new Error('invalid response')
    snapshot.value=data.data;draft.value=data.data.asins.join('\n')
  }catch(err){if(!disposed)error.value=err.response?.data?.message || '读取竞品失败，请关闭后重试'}
  finally{if(!disposed)loading.value=false}
}

/** 同一次请求保存完整关系和可选采集配置；冲突保留草稿，不自动重试。 */
async function save(){
  if(saving.value || loading.value || !editable.value)return
  error.value=''
  if(tokens.value.some(value=>!/^[A-Z0-9]{10}$/.test(value))){error.value='ASIN须为10位英文字母或数字';return}
  if(preview.value.length>50){error.value='每条Listing最多绑定50个不同竞品';return}
  if(preview.value.includes(snapshot.value.asin)){error.value='不能将当前商品绑定为自己的竞品';return}
  saving.value=true
  try{
    const {data}=await saveListingCompetitors(props.sku,{shop_id:props.shopId,version:snapshot.value.version,asins:preview.value,add_to_sellersprite:!!(collect.value && canCollect.value)})
    if(disposed)return
    if(data.status!=='success')throw new Error('invalid response')
    const counts=data.data.collection
    ElMessage.success(counts?`竞品已保存；采集配置新增${counts.created}项，已有${counts.existing}项保持原设置`:'竞品绑定已保存')
    emit('saved',data.data);emit('close')
  }catch(err){if(!disposed)error.value=err.response?.data?.message || '保存结果待确认，请重新打开核对，勿反复提交'}
  finally{if(!disposed)saving.value=false}
}
onMounted(load)
onBeforeUnmount(()=>{disposed=true})
</script>

<style scoped>
.competitor-source{display:flex;align-items:center;gap:12px;margin-bottom:12px;color:#314b6c}.competitor-source span{font:12px Consolas,monospace;color:#8a97a8;overflow-wrap:anywhere}.competitor-hint{font-size:12px;color:#8190a3;line-height:1.7;margin:8px 0}.competitor-dialog .el-alert{margin-bottom:12px}.competitor-preview{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0;max-height:130px;overflow:auto}.competitor-preview a{font:12px Consolas,monospace;color:#4a79b7;text-decoration:none;padding:4px 7px;background:#eef4fd;border-radius:4px}.competitor-dialog .el-checkbox{margin-top:10px;max-width:100%;white-space:normal;height:auto;line-height:1.6}
</style>
