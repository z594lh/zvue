<template>
  <div class="ownership-workbench">
    <header class="workbench-heading">
      <div><div class="workbench-eyebrow">AMAZON · OWNERSHIP</div><h1>Listing 负责人分配</h1><p>让每一个 SKU 的责任清晰可追溯。交接从站点次日零点生效，原订单业绩仍归原负责人。</p></div>
      <div class="workbench-header-actions"><el-button :icon="Refresh" @click="fetchRows" :loading="loading">刷新列表</el-button></div>
    </header>
    <section class="workbench-card">
    <div class="workbench-filters">
      <div class="workbench-field"><label>店铺</label><el-select v-model="shopId" placeholder="选择店铺" style="width:190px">
        <el-option v-for="shop in shops" :key="shop.id" :label="shop.shop_name" :value="shop.id" />
      </el-select></div>
      <div class="workbench-field"><label>SKU</label><el-input v-model="sku" placeholder="精确查找 SKU" :prefix-icon="Search" clearable style="width:200px" @keyup.enter="search" /></div>
      <div class="workbench-field"><label>商品关键字</label><el-input v-model="keyword" placeholder="中文名称 / 标题 / SKU" :prefix-icon="Search" clearable style="width:260px" @keyup.enter="search" /></div>
      <div class="workbench-field"><label>是否分配</label><el-select v-model="assignmentStatus" style="width:145px" :disabled="!ready" @change="changeAssignmentStatus"><el-option label="全部" value="all" /><el-option label="已分配" value="assigned" /><el-option label="未分配" value="unassigned" /></el-select></div>
      <el-button type="primary" :icon="Search" :disabled="!ready || !shopId" :loading="loading" @click="search">查询</el-button>
      <el-button :icon="RefreshLeft" @click="reset">重置</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="workbench-card-heading"><h2>Listing 责任清单 <small> · {{ rows.length }} 条 / 本页</small></h2>
      <ListingOwnershipControls ref="controls" :selection="selection" :shop-id="shopId" :show-unassigned-filter="false"
        @ready="ready = $event" @filter="changeOwnerFilter" @changed="fetchRows" />
    </div>
    <el-table ref="table" class="workbench-table" :data="rows" v-loading="loading" row-key="id" stripe @selection-change="selection = $event">
      <el-table-column type="selection" width="48" fixed="left" />
      <el-table-column label="SKU / ASIN" min-width="175"><template #default="{row}"><div class="workbench-sku">{{ row.sku }}</div><div class="workbench-muted" style="margin-top:5px">{{ row.asin || '—' }}</div></template></el-table-column>
      <el-table-column prop="product_name" label="产品中文名称" min-width="180" show-overflow-tooltip><template #default="{row}">{{ row.product_name || '—' }}</template></el-table-column>
      <el-table-column prop="item_name" label="亚马逊标题" min-width="240" show-overflow-tooltip />
      <el-table-column label="类型" width="80"><template #default="{row}"><el-tag size="small" effect="plain" :type="row.parentage_level === 'parent' ? 'info' : 'primary'">{{ row.parentage_level === 'parent' ? '父体' : '子体' }}</el-tag></template></el-table-column>
      <el-table-column label="负责人" width="155"><template #default="{row}"><div v-if="row.ownership?.current?.owner_name" class="workbench-owner"><span class="workbench-avatar">{{ row.ownership.current.owner_name.slice(0,1) }}</span>{{ row.ownership.current.owner_name }}</div><el-tag v-else type="warning" size="small" effect="light">尚未分配</el-tag></template></el-table-column>
      <el-table-column label="交接计划" min-width="190">
        <template #default="{row}">
          <div v-if="row.ownership?.scheduled"><el-tag size="small" type="success" effect="plain">{{ row.ownership.scheduled.owner_name || '解除分配' }}</el-tag><div class="workbench-muted" style="margin-top:6px">{{ row.ownership.scheduled.effective_from_utc?.slice(0,16).replace('T',' ') }} UTC</div></div>
          <span v-else class="workbench-muted">暂无交接计划</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right"><template #default="{row}"><div class="workbench-row-actions">
        <el-button type="primary" plain size="small" :icon="UserFilled" @click="controls?.openAssignment([row])">分配</el-button>
        <el-tooltip v-if="canHistory" content="操作历史 · 谁进行了变更" placement="top"><el-button size="small" :icon="Document" aria-label="操作历史" @click="controls?.showOperations(row)" /></el-tooltip>
        <el-tooltip v-if="canHistory" content="负责历史 · SKU 归属区间" placement="top"><el-button size="small" :icon="Clock" aria-label="负责历史" @click="controls?.showHistory(row)" /></el-tooltip>
      </div>
      </template></el-table-column>
    </el-table>
    <div class="workbench-pagination"><span class="workbench-muted">父体分配会自动展开为现有子 SKU · 每次最多 200 条</span>
    <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20,50,100]"
      layout="total, sizes, prev, pager, next" @current-change="fetchRows" @size-change="search" />
    </div></section>
    <div class="workbench-selection-bar"><div class="workbench-selection-info"><span class="workbench-selection-count">已选 {{ selection.length }} 条</span><span>选中 SKU 后直接分配，无需返回页面顶部</span><el-button v-if="selection.length" link @click="table?.clearSelection()">清空选择</el-button></div>
      <el-button type="primary" :icon="UserFilled" :disabled="!ready || !selection.length" @click="controls?.openAssignment()">批量分配负责人</el-button></div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { Search, Refresh, RefreshLeft, UserFilled, Document, Clock } from '@element-plus/icons-vue'
import ListingOwnershipControls from '@/components/ListingOwnershipControls.vue'
import { getAssignmentListings, getListingPerformanceConfig, getUserPermissions } from '@/services/api.js'

const shops = ref([]), shopId = ref(null), ready = ref(false)
const sku = ref(''), keyword = ref(''), filter = ref({})
const assignmentStatus=ref('all')
const rows = ref([]), selection = ref([]), controls = ref(null), table = ref(null)
const page = ref(1), pageSize = ref(20), total = ref(0), loading = ref(false), error = ref('')
const canHistory = getUserPermissions().includes('amazon_listings:assignment_history')
let requestVersion = 0
const message = err => err.response?.data?.message || err.message || '获取待分配 Listing 失败'
const fetchRows = async () => {
  if (!ready.value || !shopId.value) return
  const version = ++requestVersion
  loading.value = true; error.value = ''; selection.value = []; table.value?.clearSelection()
  try {
    const response = await getAssignmentListings({ shop_id:shopId.value, sku:sku.value.trim(), keyword:keyword.value.trim(),
      ...filter.value, assignment_status:assignmentStatus.value, page:page.value, page_size:pageSize.value })
    if (version !== requestVersion) return
    rows.value = response.data.data.list; total.value = response.data.data.total
  } catch (err) {
    if (version !== requestVersion) return
    error.value = message(err); rows.value = []; total.value = 0
  } finally { if (version === requestVersion) loading.value = false }
}
const search = () => { page.value = 1; fetchRows() }
const changeAssignmentStatus=()=>{
  if(assignmentStatus.value==='unassigned'){filter.value={};controls.value?.resetFilter()}
  search()
}
const changeOwnerFilter=value=>{
  filter.value=value
  if((value.owner_user_id || value.only_mine) && assignmentStatus.value==='unassigned')assignmentStatus.value='assigned'
  search()
}
const reset = () => { sku.value = ''; keyword.value = ''; assignmentStatus.value='all'; filter.value = {}; controls.value?.resetFilter(); search() }
watch([shopId,ready], () => { rows.value = []; selection.value = []; total.value = 0; search() })
onMounted(async () => {
  try {
    shops.value = (await getListingPerformanceConfig()).data.data.shops
    shopId.value = shops.value[0]?.id || null
    if (!shops.value.length) error.value = '没有启用的店铺，请先检查店铺配置'
  } catch (err) { error.value = message(err) }
})
</script>

<style src="../styles/ownership-workbench.css"></style>
