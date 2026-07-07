<template>
  <div class="cpc-layout">
    <!-- Tab 导航 -->
    <div class="cpc-tabs">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="cpc-tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab)"
      >
        {{ tab.label }}
      </div>
      <div class="cpc-tab-extra">
        <el-select
          v-model="selectedShopId"
          placeholder="--请选择店铺--"
          filterable
          clearable
          style="width:180px"
          @change="handleShopChange"
        >
          <el-option
            v-for="shop in shopList"
            :key="shop.id"
            :label="shop.shop_name"
            :value="shop.id"
          />
        </el-select>
        <div class="date-range-pickers">
          <el-date-picker v-model="startDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" class="date-start-picker" @change="setStartDate" />
          <span class="date-separator">~</span>
          <el-date-picker v-model="endDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" class="date-end-picker" @change="setEndDate" />
        </div>
        <slot name="tab-extra" />
      </div>
    </div>

    <!-- 内容区 -->
    <div class="cpc-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useShopCache } from '@/composables/useShopCache'
import { useCpcDateRange } from '@/composables/useCpcDateRange'

const route = useRoute()
const router = useRouter()
const { shopList, fetchShopList, defaultShopId } = useShopCache()

const props = defineProps({
  activeTab: { type: String, required: true }
})

const emit = defineEmits(['shopChange'])

const selectedShopId = ref(null)
const CPC_SHOP_KEY = 'cpc_shop_id'
const { startDate, endDate, setStartDate, setEndDate } = useCpcDateRange()

const tabs = [
  { key: 'campaigns', label: 'SP广告活动', routeName: 'CpcCampaigns' }
]

const activeTab = computed(() => props.activeTab)

const handleShopChange = (val) => {
  selectedShopId.value = val
  if (val) sessionStorage.setItem(CPC_SHOP_KEY, val)
  else sessionStorage.removeItem(CPC_SHOP_KEY)
  emit('shopChange', val)
}

const switchTab = (tab) => {
  if (tab.key === 'campaigns') {
    router.push({ name: tab.routeName })
    return
  }
  const campaignId = route.params.id
  if (!campaignId) {
    ElMessage.warning('请先选择一个广告活动')
    router.push({ name: 'CpcCampaigns' })
    return
  }
  router.push({ name: tab.routeName, params: { id: campaignId }, query: { ...route.query } })
}

onMounted(async () => {
  await fetchShopList()
  const saved = sessionStorage.getItem(CPC_SHOP_KEY)
  const defId = defaultShopId()
  const initialId = saved ? Number(saved) : defId
  if (initialId && shopList.value.find(s => s.id === initialId)) {
    selectedShopId.value = initialId
    emit('shopChange', initialId)
  }
})

defineExpose({ shopId: selectedShopId })
</script>

<style scoped>
.cpc-layout {
  min-height: 100%;
  background: #f5f7fa;
}
.cpc-tabs {
  display: flex;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 16px;
}
.cpc-tab-extra {
  margin-left: auto;
  padding: 6px 0;
  display: flex;
  align-items: center;
  gap: 12px;
}
.date-range-pickers {
  display: flex;
  align-items: center;
  gap: 8px;
}
.date-separator {
  color: #909399;
  font-size: 14px;
}
.date-start-picker,
.date-end-picker {
  width: 150px;
}
.cpc-tab-item {
  padding: 12px 18px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.cpc-tab-item:hover {
  color: #409eff;
}
.cpc-tab-item.active {
  color: #009688;
  border-bottom-color: #009688;
  font-weight: 600;
}
.cpc-content {
  padding: 12px 16px;
}
</style>
