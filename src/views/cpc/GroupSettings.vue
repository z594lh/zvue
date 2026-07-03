<template>
  <div class="group-section">
    <div class="settings-form">
      <div class="form-row">
        <label>广告组名称</label>
        <el-input v-model="form.name" style="width:320px" />
      </div>
      <div class="form-row">
        <label>投放中/已暂停</label>
        <div class="form-value">
          <el-switch :model-value="form.state === 'ENABLED'" inline-prompt @change="(val) => form.state = val ? 'ENABLED' : 'PAUSED'" />
          <span class="state-text">{{ form.state === 'ENABLED' ? '正在投放' : '已暂停' }}</span>
        </div>
      </div>
      <div class="form-row">
        <label>状态</label>
        <span class="status-text">{{ servingStatusLabel }}</span>
      </div>
      <div class="form-row">
        <label>默认竞价</label>
        <el-input-number v-model="form.defaultBid" :min="0.01" :step="0.01" :precision="2" controls-position="right" style="width:160px" />
      </div>
      <div class="form-actions">
        <el-button type="primary" :loading="saving" @click="saveSettings">保存</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { updateCpcGroup } from '@/services/cpc'

const props = defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true },
  adGroupId: { type: [Number, String], required: true },
  groupInfo: { type: Object, default: null }
})

const emit = defineEmits(['updated'])

const saving = ref(false)
const form = reactive({ name: '', state: 'ENABLED', defaultBid: 0.5 })

const servingStatusLabel = computed(() => {
  if (!props.groupInfo) return '--'
  if (props.groupInfo.state === 'ENABLED') return '超出预算'
  if (props.groupInfo.state === 'PAUSED') return '已暂停'
  if (props.groupInfo.state === 'ARCHIVED') return '已归档'
  return '未知'
})

watch(() => props.groupInfo, (info) => {
  if (info) {
    form.name = info.name || ''
    form.state = info.state || 'ENABLED'
    form.defaultBid = info.default_bid || 0.5
  }
}, { immediate: true })

const saveSettings = async () => {
  if (!props.groupInfo) return
  saving.value = true
  try {
    await updateCpcGroup(props.groupInfo.ad_group_id, {
      shop_id: props.shopId,
      name: form.name,
      state: form.state === 'ENABLED' ? 'enabled' : 'paused',
      defaultBid: form.defaultBid
    })
    ElMessage.success('保存成功')
    emit('updated')
  } catch { ElMessage.error('保存失败') }
  finally { saving.value = false }
}

</script>

<style scoped>
.group-section { background: #fff; }
.settings-form { max-width: 600px; }
.form-row { display: flex; align-items: center; padding: 16px 0; border-bottom: 1px solid #ebeef5; }
.form-row label { width: 140px; color: #303133; font-weight: 600; font-size: 14px; }
.form-value { display: flex; align-items: center; gap: 12px; }
.state-text { font-size: 14px; color: #303133; }
.status-text { color: #e6a23c; font-size: 14px; }
.form-actions { margin-top: 24px; padding-left: 140px; }
</style>
