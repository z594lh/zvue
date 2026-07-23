<template>
  <CpcLayout active-tab="groups" @shop-change="onShopChange">
    <div class="group-detail-page">
      <!-- 顶部标题区 -->
      <div class="detail-header">
        <div class="header-left">
          <h2 class="group-title">广告组: {{ groupInfo?.name || '-' }}</h2>
          <div class="header-status">
            <el-switch
              :model-value="groupInfo?.state === 'ENABLED'"
              inline-prompt
              :disabled="!shopId || stateLoading"
              :loading="stateLoading"
              @change="toggleGroupState"
            />
            <span class="status-label">状态:</span>
            <el-tag size="small" :type="servingStatusType">{{ servingStatusLabel }}</el-tag>
          </div>
        </div>
        <div class="header-right">
          <span class="back-link" @click="goBack">&lt; 返回广告活动</span>
        </div>
      </div>

      <div class="detail-body">
        <!-- 左侧导航 -->
        <div class="detail-sidebar">
          <div
            v-for="menu in menus"
            :key="menu.key"
            class="sidebar-item"
            :class="{ active: activeMenu === menu.key }"
            @click="activeMenu = menu.key"
          >
            {{ menu.label }}
          </div>
        </div>

        <!-- 右侧内容 -->
        <div class="detail-content">
          <GroupAds v-if="activeMenu === 'ads'" :shop-id="shopId" :campaign-id="campaignId" :ad-group-id="adGroupId" />
          <GroupTargets v-else-if="activeMenu === 'targets'" :shop-id="shopId" :campaign-id="campaignId" :ad-group-id="adGroupId" :targeting-type="campaignInfo?.targeting_type" />
          <GroupNegative v-else-if="activeMenu === 'negative'" :shop-id="shopId" :campaign-id="campaignId" :ad-group-id="adGroupId" />
          <GroupSearchTerms v-else-if="activeMenu === 'searchTerms'" :shop-id="shopId" :campaign-id="campaignId" :ad-group-id="adGroupId" />
          <GroupSettings v-else-if="activeMenu === 'settings'" :shop-id="shopId" :campaign-id="campaignId" :ad-group-id="adGroupId" :group-info="groupInfo" @updated="loadGroupInfo" />
          <GroupHistory v-else-if="activeMenu === 'history'" :shop-id="shopId" :campaign-id="campaignId" :ad-group-id="adGroupId" />
        </div>
      </div>
    </div>
  </CpcLayout>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import CpcLayout from '@/components/cpc/CpcLayout.vue'
import GroupAds from './GroupAds.vue'
import GroupTargets from './GroupTargets.vue'
import GroupNegative from './GroupNegative.vue'
import GroupSearchTerms from './GroupSearchTerms.vue'
import GroupSettings from './GroupSettings.vue'
import GroupHistory from './GroupHistory.vue'
import { getCpcGroup, updateCpcGroup, getCpcCampaign } from '@/services/cpc'

const route = useRoute()
const router = useRouter()
const campaignId = route.params.id
const adGroupId = route.params.adGroupId
const shopId = ref(null)
const groupInfo = ref(null)
const campaignInfo = ref(null)
const activeMenu = ref('ads')
const stateLoading = ref(false)

const menus = [
  { key: 'ads', label: '广告' },
  { key: 'targets', label: '定向策略' },
  { key: 'negative', label: '否定投放' },
  { key: 'searchTerms', label: '搜索词' },
  { key: 'settings', label: '广告组设置' },
  { key: 'history', label: '历史记录' }
]

const servingStatusLabel = computed(() => {
  const state = groupInfo.value?.state
  if (state === 'ENABLED') return '正在投放'
  if (state === 'PAUSED') return '已暂停'
  if (state === 'ARCHIVED') return '已归档'
  return '未知'
})

const servingStatusType = computed(() => {
  const state = groupInfo.value?.state
  if (state === 'ENABLED') return 'success'
  if (state === 'PAUSED') return 'warning'
  if (state === 'ARCHIVED') return 'info'
  return ''
})

const onShopChange = (val) => {
  shopId.value = val
  loadGroupInfo()
  loadCampaignInfo()
}

const loadGroupInfo = async () => {
  if (!shopId.value || !campaignId || !adGroupId) return
  try {
    const res = await getCpcGroup(adGroupId, { shop_id: shopId.value })
    if (res.data.status === 'success') {
      const info = res.data.data || null
      if (info && info.state) info.state = info.state.toUpperCase()
      groupInfo.value = info
    }
  } catch { ElMessage.error('获取广告组信息失败') }
}

const loadCampaignInfo = async () => {
  if (!shopId.value || !campaignId) return
  try {
    const res = await getCpcCampaign(campaignId, { shop_id: shopId.value })
    if (res.data.status === 'success') {
      const info = res.data.data || {}
      if (info.targeting_type) info.targeting_type = info.targeting_type.toUpperCase()
      campaignInfo.value = info
    }
  } catch { /* 活动信息失败不影响主流程 */ }
}

const toggleGroupState = async (val) => {
  if (!groupInfo.value || stateLoading.value) return
  stateLoading.value = true
  try {
    await updateCpcGroup(groupInfo.value.ad_group_id, { shop_id: shopId.value, state: val ? 'enabled' : 'paused' })
    groupInfo.value.state = val ? 'ENABLED' : 'PAUSED'
    ElMessage.success('更新成功')
  } catch {
    ElMessage.error('更新失败')
  } finally {
    stateLoading.value = false
  }
}

const goBack = () => {
  router.push({ name: 'CpcCampaignDetail', params: { id: campaignId } })
}

onMounted(() => {
  if (shopId.value) {
    loadGroupInfo()
    loadCampaignInfo()
  }
})
</script>

<style scoped>
.group-detail-page { background: #fff; min-height: calc(100vh - 120px); }
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}
.group-title { margin: 0 0 10px 0; font-size: 20px; color: #303133; }
.header-status { display: flex; align-items: center; gap: 10px; }
.status-label { font-size: 13px; color: #606266; }
.back-link { color: #409eff; cursor: pointer; font-size: 13px; }
.back-link:hover { text-decoration: underline; }
.detail-body { display: flex; min-height: calc(100vh - 180px); }
.detail-sidebar { width: 160px; border-right: 1px solid #ebeef5; padding: 12px 0; }
.sidebar-item {
  padding: 12px 20px;
  cursor: pointer;
  font-size: 14px;
  color: #303133;
  transition: background 0.2s;
}
.sidebar-item:hover { background: #f5f7fa; }
.sidebar-item.active { background: #f5f7fa; font-weight: 600; }
.detail-content { flex: 1; padding: 16px 20px; }
</style>
