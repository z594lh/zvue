<template>
  <CpcLayout active-tab="campaigns" @shop-change="onShopChange">
    <div class="campaign-detail-page">
      <!-- 顶部标题区 -->
      <div class="detail-header">
        <div class="header-left">
          <h2 class="campaign-title">广告活动: {{ campaignInfo?.name || '-' }}</h2>
          <div class="header-meta">
            <el-switch
              :model-value="campaignInfo?.state === 'ENABLED'"
              inline-prompt
              :disabled="!shopId || stateLoading"
              :loading="stateLoading"
              @change="toggleCampaignState"
            />
            <span class="meta-item">状态: <el-tag size="small" :type="servingStatusType">{{ servingStatusLabel }}</el-tag></span>
            <span class="meta-item">类型: {{ campaignInfo?.targeting_type === 'AUTO' ? '商品推广 - 自动投放' : '商品推广 - 手动投放' }}</span>
            <span class="meta-item">时间安排: {{ campaignInfo?.start_date || '-' }} - {{ campaignInfo?.end_date || '无结束日期' }}</span>
            <span class="meta-item">预算: ${{ formatNum(campaignInfo?.daily_budget) }} - 每日</span>
          </div>
        </div>
        <div class="header-right">
          <span class="back-link" @click="goBack">&lt; 返回广告活动列表</span>
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
          <CampaignGroups v-if="activeMenu === 'groups'" :shop-id="shopId" :campaign-id="campaignId" />
          <CampaignPlacement v-else-if="activeMenu === 'placement'" :shop-id="shopId" :campaign-id="campaignId" />
          <!-- <CampaignNegative v-else-if="activeMenu === 'negative'" :shop-id="shopId" :campaign-id="campaignId" /> -->
          <!-- <CampaignBudgetRules v-else-if="activeMenu === 'budgetRules'" :shop-id="shopId" :campaign-id="campaignId" :daily-budget="Number(campaignInfo?.daily_budget) || 0" /> -->
          <CampaignSettings v-else-if="activeMenu === 'settings'" :shop-id="shopId" :campaign-id="campaignId" :campaign-info="campaignInfo" @updated="loadCampaignInfo" />
          <CampaignHistory v-else-if="activeMenu === 'history'" :shop-id="shopId" :campaign-id="campaignId" />
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
import CampaignGroups from './CampaignGroups.vue'
import CampaignPlacement from './CampaignPlacement.vue'
// import CampaignNegative from './CampaignNegative.vue'
// import CampaignBudgetRules from './CampaignBudgetRules.vue'
import CampaignSettings from './CampaignSettings.vue'
import CampaignHistory from './CampaignHistory.vue'
import { getCpcCampaign, updateCpcCampaign } from '@/services/cpc'

const route = useRoute()
const router = useRouter()
const campaignId = route.params.id
const shopId = ref(null)
const campaignInfo = ref(null)
const activeMenu = ref('groups')
const stateLoading = ref(false)

const menus = [
  { key: 'groups', label: '广告组' },
  { key: 'placement', label: '竞价调整' },
  // { key: 'negative', label: '否定投放' }, // v3 API 暂不支持活动级否定投放
  // { key: 'budgetRules', label: '预算规则' }, // 后端列为二期
  { key: 'settings', label: '广告活动设置' },
  { key: 'history', label: '历史记录' }
]

const servingStatusLabel = computed(() => {
  const state = campaignInfo.value?.state
  if (state === 'ENABLED') return '正在投放'
  if (state === 'PAUSED') return '已暂停'
  if (state === 'ARCHIVED') return '已归档'
  return '未知'
})

const servingStatusType = computed(() => {
  const state = campaignInfo.value?.state
  if (state === 'ENABLED') return 'success'
  if (state === 'PAUSED') return 'warning'
  if (state === 'ARCHIVED') return 'info'
  return ''
})

const onShopChange = (val) => {
  shopId.value = val
  loadCampaignInfo()
}

const loadCampaignInfo = async () => {
  if (!shopId.value || !campaignId) return
  try {
    const res = await getCpcCampaign(campaignId, { shop_id: shopId.value })
    if (res.data.status === 'success') {
      const info = res.data.data || {}
      if (info.state) info.state = info.state.toUpperCase()
      if (info.daily_budget != null) info.daily_budget = Number(info.daily_budget)
      campaignInfo.value = info
    }
  } catch { ElMessage.error('获取广告活动信息失败') }
}

const toggleCampaignState = async (val) => {
  if (!campaignInfo.value || stateLoading.value) return
  stateLoading.value = true
  try {
    await updateCpcCampaign(campaignInfo.value.campaign_id, { shop_id: shopId.value, state: val ? 'enabled' : 'paused' })
    await loadCampaignInfo()
    ElMessage.success('更新成功')
  } catch {
    ElMessage.error('更新失败')
  } finally {
    stateLoading.value = false
  }
}

const goBack = () => {
  router.push({ name: 'CpcCampaigns' })
}

const formatNum = (val) => val != null && Number(val) !== 0 ? Number(val).toFixed(2) : '--'

onMounted(() => { if (shopId.value) loadCampaignInfo() })
</script>

<style scoped>
.campaign-detail-page { background: #fff; min-height: calc(100vh - 120px); }
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}
.campaign-title { margin: 0 0 10px 0; font-size: 20px; color: #303133; }
.header-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 13px; color: #606266; }
.meta-item { display: flex; align-items: center; gap: 6px; }
.back-link { color: #409eff; cursor: pointer; font-size: 13px; }
.back-link:hover { text-decoration: underline; }
.detail-body { display: flex; min-height: calc(100vh - 180px); }
.detail-sidebar { width: 160px; border-right: 1px solid #ebeef5; padding: 12px 0; }
.sidebar-item {
  padding: 12px 20px;
  cursor: pointer;
  font-size: 14px;
  color: #303133;
  border-bottom: 2px solid transparent;
}
.sidebar-item:hover { background: #f5f7fa; }
.sidebar-item.active { background: #f5f7fa; font-weight: 600; }
.detail-content { flex: 1; padding: 16px 20px; }
</style>
