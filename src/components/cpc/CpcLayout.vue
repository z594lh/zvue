<template>
  <div class="cpc-layout">
    <!-- 层级导航与原筛选栏共用一行 -->
    <div class="cpc-tabs">
      <nav class="cpc-breadcrumbs" aria-label="广告层级导航">
        <template v-for="(item, index) in navigationItems" :key="item.key">
          <span v-if="index" class="breadcrumb-separator" aria-hidden="true">›</span>
          <RouterLink :to="item.to" class="breadcrumb-link" :class="{ 'breadcrumb-home': index === 0 }" :title="item.label">
            {{ item.label }}
          </RouterLink>
        </template>
        <el-tooltip content="刷新当前位置数据" placement="bottom" :show-after="250">
          <span class="sync-control">
            <el-button class="sync-button" plain circle type="primary" :icon="Refresh" :loading="syncing" :loading-icon="Refresh" :disabled="!selectedShopId || syncing" :aria-busy="syncing" aria-label="刷新当前位置数据" @click="handleSync" />
          </span>
        </el-tooltip>
      </nav>
      <div class="cpc-tab-extra">
        <el-select
          v-model="selectedShopId"
          placeholder="--请选择店铺--"
          filterable
          clearable
          :disabled="shopDisabled"
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
        <el-tooltip content="筛选所有 CPC 报表的时间范围，默认最近 30 天" placement="bottom">
          <div class="date-range-pickers">
            <el-date-picker v-model="startDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" class="date-start-picker" @change="setStartDate" />
            <span class="date-separator">~</span>
            <el-date-picker v-model="endDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" class="date-end-picker" @change="setEndDate" />
          </div>
        </el-tooltip>
        <el-button size="small" @click="resetDateRange">重置日期</el-button>
        <el-button size="small" :loading="latestDateLoading" @click="fetchLatestDate">最新一天数据</el-button>
        <template v-if="isSingleDay">
          <el-button size="small" :icon="ArrowLeft" @click="shiftDate(-1)">前一天</el-button>
          <el-button size="small" @click="shiftDate(1)">后一天<el-icon class="el-icon--right"><ArrowRight /></el-icon></el-button>
        </template>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Refresh } from '@element-plus/icons-vue'
import { useShopCache } from '@/composables/useShopCache'
import { useCpcDateRange } from '@/composables/useCpcDateRange'
import { getCpcLatestReportDate, syncCpcEntities } from '@/services/cpc'
import { cpcEntitySyncBusy, provideCpcEntityRefresh } from '@/composables/useCpcEntityRefresh'

const route = useRoute()
const { shopList, fetchShopList, defaultShopId } = useShopCache()

const props = defineProps({
  activeTab: { type: String, required: true },
  breadcrumbs: { type: Array, default: () => [] },
  refreshHandler: { type: Function, default: null },
  shopDisabled: { type: Boolean, default: false }
})

const emit = defineEmits(['shopChange'])

const selectedShopId = ref(null)
const CPC_SHOP_KEY = 'cpc_shop_id'
const { startDate, endDate, setStartDate, setEndDate, resetDateRange } = useCpcDateRange()
const latestDateLoading = ref(false)
const syncing = cpcEntitySyncBusy
const refreshChildren = provideCpcEntityRefresh()
let disposed = false
onBeforeUnmount(() => { disposed = true })

const syncContext = computed(() => {
  const context = { shop_id: selectedShopId.value, scope: 'shop' }
  if (['CpcCampaignDetail', 'CpcGroupDetail'].includes(route.name)) {
    context.scope = route.name === 'CpcGroupDetail' ? 'group' : 'campaign'
    context.campaign_id = String(route.params.id)
    if (context.scope === 'group') context.ad_group_id = String(route.params.adGroupId)
  }
  return context
})
const syncScopeLabel = computed(() => ({ shop: '当前店铺', campaign: '当前活动', group: '当前广告组' }[syncContext.value.scope]))

async function handleSync() {
  if (syncing.value || !selectedShopId.value) return
  const payload = { ...syncContext.value }, currentPath = route.path
  const scopeName = syncScopeLabel.value
  const shopName = shopList.value.find(shop => shop.id === payload.shop_id)?.shop_name || String(payload.shop_id)
  syncing.value = true
  try {
    const response = await syncCpcEntities(payload)
    const body = response.data || {}
    if (body.status !== 'success') throw new Error(body.message || '同步未完成，原数据保留')
    if (disposed || currentPath !== route.path || JSON.stringify(payload) !== JSON.stringify(syncContext.value)) {
      ElMessage.success(`${shopName} · ${scopeName}同步完成；你已切换页面，未刷新当前页面`); return
    }
    const results = await Promise.allSettled([props.refreshHandler ? props.refreshHandler() : true, refreshChildren()])
    if (disposed || currentPath !== route.path || JSON.stringify(payload) !== JSON.stringify(syncContext.value)) return
    const refreshed = results.every(result => result.status === 'fulfilled' && result.value !== false)
    if (refreshed) ElMessage.success(`${scopeName}实体已更新；当前页面已重新读取。历史由计划任务同步，效果报表未重新抓取。`)
    else ElMessage.warning('实体同步已完成，但页面部分查询失败；请重新查询页面，无需重复同步。效果报表未重新抓取。')
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || '同步请求失败'
    ElMessage.error(error?.code === 'ECONNABORTED' ? '等待同步响应超时，服务器可能仍在处理；请稍后查询，勿连续重复提交。' : message)
  } finally { syncing.value = false }
}

const isSingleDay = computed(() => startDate.value && endDate.value && startDate.value === endDate.value)

// 名称由详情页现有查询提供，布局不新增实体请求；保留原路由查询参数。
const navigationItems = computed(() => [
  { key: 'campaigns', label: 'SP广告活动', to: { name: 'CpcCampaigns' } },
  ...props.breadcrumbs
].map(item => ({ ...item, to: { ...item.to, query: { ...route.query, ...item.to.query } } })))

const handleShopChange = (val) => {
  selectedShopId.value = val
  if (val) sessionStorage.setItem(CPC_SHOP_KEY, val)
  else sessionStorage.removeItem(CPC_SHOP_KEY)
  emit('shopChange', val)
}

const fetchLatestDate = async () => {
  if (!selectedShopId.value) {
    ElMessage.warning('请先选择店铺')
    return
  }
  latestDateLoading.value = true
  try {
    const res = await getCpcLatestReportDate({
      shop_id: selectedShopId.value,
      report_type: 'spCampaigns'
    })
    if (res.data.status === 'success') {
      const latest = res.data.data?.latest_date
      if (!latest) {
        ElMessage.warning('暂无报告数据')
        return
      }
      setStartDate(latest)
      setEndDate(latest)
      ElMessage.success(`已切换至最新报告日期：${latest}`)
    } else {
      ElMessage.warning(res.data.message || '获取最新日期失败')
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || '获取最新日期失败'
    ElMessage.error(msg)
  } finally {
    latestDateLoading.value = false
  }
}

const shiftDate = (days) => {
  if (!startDate.value) return
  const date = new Date(startDate.value)
  date.setDate(date.getDate() + days)
  const fmt = (d) => d.toISOString().split('T')[0]
  const newDate = fmt(date)
  setStartDate(newDate)
  setEndDate(newDate)
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
  /* 系统导航60px + 页签36px，吸顶时不遮挡上层导航。 */
  position: sticky;
  top: 96px;
  z-index: 98;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 3px 8px rgba(31, 45, 61, 0.06);
  padding: 0 16px;
}
.cpc-tab-extra {
  margin-left: auto;
  padding: 6px 0;
  display: flex;
  flex-wrap: wrap;
  max-width: 100%;
  align-items: center;
  gap: 12px;
}
.sync-control { display: inline-flex; align-items: center; flex-shrink: 0; }
.sync-button { width: 36px; height: 36px; font-size: 20px; }
.sync-button :deep(.el-icon) { stroke: currentColor; stroke-width: 0.5; }
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
.cpc-breadcrumbs { flex: 1 1 280px; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 8px 0; font-size: 13px; }
.breadcrumb-link { flex: 0 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #409eff; text-decoration: none; }
.breadcrumb-link:hover { text-decoration: underline; }
.breadcrumb-link:focus-visible { outline: 2px solid #409eff; outline-offset: 2px; }
.breadcrumb-link[aria-current="page"] { color: #303133; font-weight: 600; }
.breadcrumb-home { flex-shrink: 0; color: #009688; }
.breadcrumb-separator { flex-shrink: 0; color: #a8abb2; font-size: 18px; }
@media (max-width: 1100px) {
  .cpc-breadcrumbs { flex-basis: 100%; }
  .cpc-tab-extra { margin-left: 0; padding-top: 0; gap: 8px; }
}
.cpc-content {
  padding: 12px 16px;
}
</style>
