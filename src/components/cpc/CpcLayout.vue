<template>
  <div class="cpc-layout">
    <!-- 顶部账号选择栏 -->
    <div class="cpc-topbar">
      <div class="account-select-wrap">
        <el-select
          v-model="selectedShopId"
          placeholder="--请选择账号--"
          filterable
          clearable
          @change="handleShopChange"
        >
          <el-option-group
            v-for="group in accountGroups"
            :key="group.name"
            :label="group.name"
          >
            <el-option
              v-for="shop in group.shops"
              :key="shop.shop_id"
              :label="shop.shop_name"
              :value="shop.shop_id"
            />
          </el-option-group>
        </el-select>
      </div>
    </div>

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
import { getCpcAccounts } from '@/services/cpc'

const route = useRoute()
const router = useRouter()

const props = defineProps({
  activeTab: { type: String, required: true }
})

const emit = defineEmits(['shopChange'])

const selectedShopId = ref(null)
const accountGroups = ref([])

const tabs = [
  { key: 'campaigns', label: 'SP广告活动', routeName: 'CpcCampaigns' }
]

const activeTab = computed(() => props.activeTab)

const loadAccounts = async () => {
  try {
    const res = await getCpcAccounts()
    if (res.data.status === 'success') {
      const data = res.data.data
      accountGroups.value = Object.entries(data).map(([name, shops]) => ({ name, shops }))
    }
  } catch { ElMessage.error('获取账号列表失败') }
}

const handleShopChange = (val) => {
  selectedShopId.value = val
  if (val) sessionStorage.setItem('cpc_shop_id', val)
  else sessionStorage.removeItem('cpc_shop_id')
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
  await loadAccounts()
  const saved = sessionStorage.getItem('cpc_shop_id')
  if (saved) {
    selectedShopId.value = Number(saved)
    emit('shopChange', selectedShopId.value)
  }
})

defineExpose({ shopId: selectedShopId })
</script>

<style scoped>
.cpc-layout {
  min-height: 100%;
  background: #f5f7fa;
}
.cpc-topbar {
  background: #2b83d5;
  padding: 8px 16px;
}
.account-select-wrap :deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.9);
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
