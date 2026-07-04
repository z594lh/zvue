<template>
  <div class="campaign-section">
    <div class="settings-form">
      <div class="form-row">
        <label>广告活动名称</label>
        <span class="form-text">{{ form.name }}</span>
      </div>
      <div class="form-row">
        <label>广告活动 ID</label>
        <span class="form-text">{{ campaignId }}</span>
      </div>
      <div class="form-row">
        <label>广告组合</label>
        <el-select v-model="form.portfolioId" placeholder="无广告组合" clearable style="width:220px">
          <el-option label="无广告组合" :value="null" />
        </el-select>
      </div>
      <div class="form-row">
        <label>类型</label>
        <span class="form-text">{{ campaignInfo?.targeting_type === 'AUTO' ? '商品推广 - 自动投放' : '商品推广 - 手动投放' }}</span>
      </div>
      <div class="form-row">
        <label>投放中/已暂停</label>
        <div class="form-value">
          <el-switch :model-value="form.state === 'ENABLED'" inline-prompt @change="(val) => form.state = val ? 'ENABLED' : 'PAUSED'" />
          <span class="state-text">{{ form.state === 'ENABLED' ? '正在投放' : '已暂停' }}</span>
        </div>
      </div>
      <div class="form-row">
        <label>预算状态</label>
        <span class="status-text">{{ servingStatusLabel }}</span>
      </div>
      <div class="form-row">
        <label>时间安排</label>
        <div class="form-value">
          <el-date-picker v-model="form.startDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" />
          <el-date-picker v-model="form.endDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" clearable />
        </div>
      </div>
      <div class="form-row">
        <label>预算</label>
        <div class="form-value">
          <el-input-number v-model="form.dailyBudget" :min="0.01" :step="0.01" :precision="2" controls-position="right" style="width:160px" />
          <span class="unit">每日</span>
          <el-button link type="primary" size="small" @click="addBudgetRule">添加预算规则</el-button>
        </div>
      </div>
      <div class="form-row">
        <label>广告活动投放</label>
        <span class="form-text">{{ campaignInfo?.targeting_type === 'AUTO' ? '自动投放' : '手动投放' }}</span>
      </div>
      <div class="form-row">
        <label>广告活动竞价策略</label>
        <div class="form-value">
          <el-select v-model="form.biddingStrategy" style="width:240px">
            <el-option label="动态竞价 - 仅降低" value="LEGACY_FOR_SALES" />
            <el-option label="动态竞价 - 提高和降低" value="AUTO_FOR_SALES" />
            <el-option label="固定竞价" value="MANUAL" />
          </el-select>
        </div>
      </div>

      <!-- 根据广告位调整竞价 -->
      <div class="form-row form-row-block">
        <label>根据广告位调整竞价</label>
        <div class="form-block-content">
          <p class="section-tip">提高对特定亚马逊广告位的竞价。</p>
          <div class="placement-list">
            <div v-for="item in form.placements" :key="item.placement" class="placement-row">
              <span class="placement-label">{{ placementLabel(item.placement) }}</span>
              <el-input-number v-model="item.percentage" :min="0" :max="900" :step="1" controls-position="right" style="width:120px" />
              <span class="percentage-suffix">%</span>
            </div>
          </div>
          <p class="section-desc">如果竞价为 $1.00，那么搜索结果首页首位的起始竞价为 $1.30、搜索结果其余位置的起始竞价为 $1.00，商品页面的起始竞价为 $1.00。</p>
          <el-checkbox v-model="form.businessBidBoost">针对亚马逊企业购站内的各广告位进一步提高竞价</el-checkbox>
        </div>
      </div>

      <!-- 在亚马逊站外投放的广告的设置 -->
      <div class="form-row form-row-block">
        <label>在亚马逊站外投放的广告的设置</label>
        <div class="form-block-content">
          <el-radio-group v-model="form.offAmazonSetting" class="off-amazon-group">
            <el-radio label="EXPAND_REACH">
              <span class="radio-label">扩大受众触达</span>
              <span class="radio-desc">扩大您在亚马逊站外的受众触达。此设置可能会增加亚马逊站外的展示量和销售机会。</span>
            </el-radio>
            <el-radio label="LIMIT_SPEND">
              <span class="radio-label">限制在亚马逊站外的花费</span>
              <span class="radio-desc">减少在亚马逊站外效果不佳的广告位上的花费。此设置可能会减少亚马逊站外的展示量，但有助于控制花费。</span>
            </el-radio>
          </el-radio-group>
        </div>
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
import { updateCpcCampaign } from '@/services/cpc'

const props = defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true },
  campaignInfo: { type: Object, default: null }
})

const emit = defineEmits(['updated'])

const defaultPlacements = [
  { placement: 'PLACEMENT_TOP', percentage: 0 },
  { placement: 'PLACEMENT_PRODUCT_PAGE', percentage: 0 },
  { placement: 'PLACEMENT_REST_OF_SEARCH', percentage: 0 }
]

const saving = ref(false)
const form = reactive({
  name: '',
  state: 'ENABLED',
  startDate: '',
  endDate: '',
  dailyBudget: 0,
  biddingStrategy: 'LEGACY_FOR_SALES',
  portfolioId: null,
  placements: defaultPlacements.map(p => ({ ...p })),
  businessBidBoost: false,
  offAmazonSetting: 'EXPAND_REACH'
})

const placementLabelMap = {
  'PLACEMENT_TOP': '搜索结果首页首位（第一页）',
  'PLACEMENT_PRODUCT_PAGE': '商品页面',
  'PLACEMENT_REST_OF_SEARCH': '搜索结果的其余位置'
}

const placementLabel = (val) => placementLabelMap[val] || val

const parseBidding = (bidding) => {
  if (!bidding) return {}
  if (typeof bidding === 'string') {
    try {
      return JSON.parse(bidding)
    } catch { return {} }
  }
  return bidding
}

const servingStatusLabel = computed(() => {
  if (!props.campaignInfo) return '--'
  return props.campaignInfo.serving_status || '预算状态暂时无法获取'
})

const parsePlacements = (placementBidding = []) => {
  const map = {}
  placementBidding.forEach(item => { map[item.placement] = item.percentage })
  return defaultPlacements.map(p => ({
    placement: p.placement,
    percentage: map[p.placement] ?? 0
  }))
}

watch(() => props.campaignInfo, (info) => {
  if (info) {
    const bidding = parseBidding(info.bidding)
    form.name = info.name || ''
    form.state = (info.state || 'ENABLED').toUpperCase()
    form.startDate = info.start_date || ''
    form.endDate = info.end_date || ''
    form.dailyBudget = Number(info.daily_budget) || 0
    form.biddingStrategy = info.bidding_strategy || bidding.strategy || 'LEGACY_FOR_SALES'
    form.portfolioId = info.portfolio_id || null
    form.placements = parsePlacements(bidding.placementBidding)
    form.businessBidBoost = bidding.businessBidBoost || false
    form.offAmazonSetting = bidding.offAmazonSetting || 'EXPAND_REACH'
  }
}, { immediate: true })

const saveSettings = async () => {
  if (!props.campaignInfo) return
  saving.value = true
  try {
    const payload = {
      shop_id: props.shopId,
      state: form.state === 'ENABLED' ? 'enabled' : 'paused',
      startDate: form.startDate,
      endDate: form.endDate,
      dailyBudget: Number(form.dailyBudget),
      bidding: {
        strategy: form.biddingStrategy,
        placementBidding: form.placements.map(p => ({ placement: p.placement, percentage: Number(p.percentage) })),
        businessBidBoost: form.businessBidBoost,
        offAmazonSetting: form.offAmazonSetting
      }
    }
    await updateCpcCampaign(props.campaignInfo.campaign_id, payload)
    ElMessage.success('保存成功')
    emit('updated')
  } catch { ElMessage.error('保存失败') }
  finally { saving.value = false }
}

const addBudgetRule = () => {}
</script>

<style scoped>
.campaign-section { background: #fff; }
.settings-form { max-width: 760px; }
.form-row { display: flex; align-items: center; padding: 16px 0; border-bottom: 1px solid #ebeef5; }
.form-row-block { align-items: flex-start; }
.form-row-block > label { padding-top: 8px; }
.form-row label { width: 200px; color: #303133; font-weight: 600; font-size: 14px; flex-shrink: 0; }
.form-text { color: #606266; font-size: 14px; }
.form-value { display: flex; align-items: center; gap: 12px; }
.form-block-content { flex: 1; }
.state-text { font-size: 14px; color: #303133; }
.status-text { color: #e6a23c; font-size: 14px; }
.unit { color: #606266; font-size: 13px; }
.form-actions { margin-top: 24px; padding-left: 200px; }

.section-tip { margin: 0 0 12px; font-size: 13px; color: #606266; }
.section-desc { margin: 12px 0; font-size: 12px; color: #909399; line-height: 1.6; }
.placement-list { display: flex; flex-direction: column; gap: 12px; }
.placement-row { display: flex; align-items: center; gap: 12px; }
.placement-label { width: 180px; font-size: 14px; color: #303133; }
.percentage-suffix { color: #606266; font-size: 14px; }

.off-amazon-group { display: flex; flex-direction: column; gap: 12px; }
.off-amazon-group :deep(.el-radio) {
  display: flex;
  align-items: flex-start;
  height: auto;
  line-height: 1.5;
  white-space: normal;
  margin-right: 0;
}
.off-amazon-group :deep(.el-radio__input) {
  padding-top: 3px;
  flex-shrink: 0;
}
.off-amazon-group :deep(.el-radio__label) {
  display: flex;
  flex-direction: column;
  padding-left: 8px;
  white-space: normal;
  line-height: 1;
}
.off-amazon-group .radio-label { font-weight: 500; color: #303133; line-height: 20px; }
.off-amazon-group .radio-desc { font-size: 12px; color: #909399; line-height: 18px; margin-top: 2px; }
</style>
