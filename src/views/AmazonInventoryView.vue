<template>
  <div class="amazon-inventory-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><Box /></el-icon>
          亚马逊库存列表
        </h1>
        <p class="page-subtitle">查看亚马逊FBA库存汇总，掌握商品库存状态</p>
      </div>
      <div class="header-actions">
        <el-tooltip
          effect="dark"
          placement="top"
          content="从亚马逊卖家后台手动同步最新库存数据。页面数据每小时自动更新一次，如需查看最新库存状态可点击此按钮。"
        >
          <el-button type="warning" @click="syncInventoryData" :loading="syncLoading">
            <el-icon><RefreshRight /></el-icon>
            同步最新数据
          </el-button>
        </el-tooltip>
        <el-button type="primary" @click="refreshData" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <el-select
          v-model="selectedShopId"
          placeholder="选择店铺"
          style="width: 180px"
          @change="handleShopChange"
        >
          <el-option
            v-for="shop in shopList"
            :key="shop.id"
            :label="shop.shop_name"
            :value="shop.id"
          />
          <el-option value="__refresh__" label="🔄 刷新店铺列表" />
        </el-select>
        <el-input
          v-model="searchForm.seller_sku"
          placeholder="卖家SKU"
          clearable
          style="width: 180px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-input
          v-model="searchForm.asin"
          placeholder="ASIN"
          clearable
          style="width: 180px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="handleSearch" :loading="loading">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
        <el-button plain @click="resetSearch">
          <el-icon><Refresh /></el-icon> 重置
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-card">
      <el-table
        :data="inventoryList"
        v-loading="loading"
        style="width: 100%"
        height="calc(100vh - 260px)"
        :default-sort="{ prop: 'sync_time', order: 'descending' }"
        row-class-name="inventory-row"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        :cell-style="{padding:'10px 0'}"
      >
        <el-table-column label="店铺名称" width="140" show-overflow-tooltip fixed="left">
          <template #default>
            <el-tag size="small" effect="plain" type="info">{{ getShopName(selectedShopId) || '-' }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="seller_sku" label="卖家SKU" width="150" fixed="left">
          <template #default="scope">
            <span
              style="font-family:monospace;font-size:13px;font-weight:500;color:#1a1a2e;cursor:pointer;"
              class="sku-link"
              @click="gotoListing(scope.row.seller_sku)"
              title="点击跳转Listing列表筛选此SKU"
            >{{ scope.row.seller_sku }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="asin" label="ASIN" width="130">
          <template #default="scope">
            <a
              v-if="scope.row.asin && scope.row.marketplace_id"
              :href="`https://${getMarketplaceDomain(scope.row.marketplace_id)}/dp/${scope.row.asin}`"
              target="_blank"
              class="asin-link"
            >{{ scope.row.asin }}</a>
            <span v-else style="font-family:monospace;font-size:12px;color:#888;">{{ scope.row.asin }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="fn_sku" label="FNSKU" width="130">
          <template #default="scope">
            <span style="font-family:monospace;font-size:12px;color:#888;">{{ scope.row.fn_sku }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="product_name" label="商品名称" min-width="240" show-overflow-tooltip>
          <template #default="scope">
            <span style="font-weight:500;color:#1a1a2e;">{{ scope.row.product_name }}</span>
          </template>
        </el-table-column>

        <el-table-column label="产品中文名" min-width="180" show-overflow-tooltip>
          <template #default="scope">
            <span style="color:#555;">{{ scope.row.declare_name_cn || scope.row.product_name || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="fulfillable_quantity" label="可售数量" width="100" align="center">
          <template #default="scope">
            <span v-if="scope.row.fulfillable_quantity > 0" class="qty-good">{{ scope.row.fulfillable_quantity }}</span>
            <span v-else class="qty-zero">{{ scope.row.fulfillable_quantity }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="total_quantity" label="总数量" width="100" align="center">
          <template #default="scope">
            <span class="qty-total">{{ scope.row.total_quantity }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="inbound_working_quantity" label="入库处理中" width="110" align="center">
          <template #default="scope">
            <span v-if="scope.row.inbound_working_quantity > 0" class="qty-warn">{{ scope.row.inbound_working_quantity }}</span>
            <span v-else class="qty-zero">{{ scope.row.inbound_working_quantity }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="inbound_shipped_quantity" label="已发货" width="90" align="center">
          <template #default="scope">
            <span v-if="scope.row.inbound_shipped_quantity > 0" class="qty-info">{{ scope.row.inbound_shipped_quantity }}</span>
            <span v-else class="qty-zero">{{ scope.row.inbound_shipped_quantity }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="inbound_receiving_quantity" label="接收中" width="90" align="center">
          <template #default="scope">
            <span v-if="scope.row.inbound_receiving_quantity > 0" class="qty-info">{{ scope.row.inbound_receiving_quantity }}</span>
            <span v-else class="qty-zero">{{ scope.row.inbound_receiving_quantity }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="reserved_total" label="预留总数" width="100" align="center">
          <template #default="scope">
            <span v-if="scope.row.reserved_total > 0" class="qty-warn">{{ scope.row.reserved_total }}</span>
            <span v-else class="qty-zero">{{ scope.row.reserved_total }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="unfulfillable_total" label="不可售总数" width="110" align="center">
          <template #default="scope">
            <span v-if="scope.row.unfulfillable_total > 0" class="qty-bad">{{ scope.row.unfulfillable_total }}</span>
            <span v-else class="qty-zero">{{ scope.row.unfulfillable_total }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="sync_time" label="同步时间" width="160" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ formatDate(scope.row.sync_time) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="scope">
            <el-button type="primary" text size="small" @click="showInventoryDetails(scope.row)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :page-sizes="[20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          :hide-on-single-page="false"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 库存详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`库存详情 - ${currentItem?.seller_sku}`"
      width="75%"
      :destroy-on-close="true"
      align-center
    >
      <div v-if="currentItem" class="inventory-detail">
        <!-- 基础信息 -->
        <div class="detail-section">
          <h4>基础信息</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="卖家SKU">{{ currentItem.seller_sku }}</el-descriptions-item>
            <el-descriptions-item label="ASIN">{{ currentItem.asin }}</el-descriptions-item>
            <el-descriptions-item label="FNSKU">{{ currentItem.fn_sku }}</el-descriptions-item>
            <el-descriptions-item label="市场ID">{{ currentItem.marketplace_id }}</el-descriptions-item>
            <el-descriptions-item label="商品状态">{{ currentItem.condition_status }}</el-descriptions-item>
            <el-descriptions-item label="商品名称" :span="2">{{ currentItem.product_name }}</el-descriptions-item>
            <el-descriptions-item label="中文申报" :span="2">{{ currentItem.declare_name_cn || currentItem.product_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="英文申报" :span="2">{{ currentItem.declare_name_en || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 可售与入库 -->
        <div class="detail-section">
          <h4>可售与入库数量</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="可售数量">
              <span v-if="currentItem.fulfillable_quantity > 0" class="qty-good">{{ currentItem.fulfillable_quantity }}</span>
              <span v-else>{{ currentItem.fulfillable_quantity }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="总数量">{{ currentItem.total_quantity }}</el-descriptions-item>
            <el-descriptions-item label="入库处理中">{{ currentItem.inbound_working_quantity }}</el-descriptions-item>
            <el-descriptions-item label="已发货">{{ currentItem.inbound_shipped_quantity }}</el-descriptions-item>
            <el-descriptions-item label="接收中">{{ currentItem.inbound_receiving_quantity }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 预留数量 -->
        <div class="detail-section">
          <h4>预留数量</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="预留总数">{{ currentItem.reserved_total }}</el-descriptions-item>
            <el-descriptions-item label="客户订单预留">{{ currentItem.reserved_pending_customer_order }}</el-descriptions-item>
            <el-descriptions-item label="调拨预留">{{ currentItem.reserved_pending_transshipment }}</el-descriptions-item>
            <el-descriptions-item label="FC处理中预留">{{ currentItem.reserved_fc_processing }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 调查中 -->
        <div class="detail-section">
          <h4>调查中数量</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="调查总数">{{ currentItem.researching_total }}</el-descriptions-item>
            <el-descriptions-item label="调查明细" :span="2">
              <div v-if="parseResearchingBreakdown(currentItem.researching_breakdown).length > 0">
                <el-tag
                  v-for="(item, idx) in parseResearchingBreakdown(currentItem.researching_breakdown)"
                  :key="idx"
                  size="small"
                  class="detail-tag"
                >
                  {{ formatResearchingName(item.name) }}: {{ item.quantity }}
                </el-tag>
              </div>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 不可售数量 -->
        <div class="detail-section">
          <h4>不可售数量</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="不可售总数">
              <span v-if="currentItem.unfulfillable_total > 0" class="qty-bad">{{ currentItem.unfulfillable_total }}</span>
              <span v-else>{{ currentItem.unfulfillable_total }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="客户损坏">{{ currentItem.unfulfillable_customer_damaged }}</el-descriptions-item>
            <el-descriptions-item label="仓库损坏">{{ currentItem.unfulfillable_warehouse_damaged }}</el-descriptions-item>
            <el-descriptions-item label="分销商损坏">{{ currentItem.unfulfillable_distributor_damaged }}</el-descriptions-item>
            <el-descriptions-item label="承运商损坏">{{ currentItem.unfulfillable_carrier_damaged }}</el-descriptions-item>
            <el-descriptions-item label="缺陷品">{{ currentItem.unfulfillable_defective }}</el-descriptions-item>
            <el-descriptions-item label="过期品">{{ currentItem.unfulfillable_expired }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 未来供应 -->
        <div class="detail-section">
          <h4>未来供应</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="未来供应预留">{{ currentItem.future_supply_reserved }}</el-descriptions-item>
            <el-descriptions-item label="未来可售数量">{{ currentItem.future_supply_buyable }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 时间信息 -->
        <div class="detail-section">
          <h4>时间信息</h4>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="亚马逊最后更新时间">{{ formatDate(currentItem.last_updated_time) }}</el-descriptions-item>
            <el-descriptions-item label="数据同步时间">{{ formatDate(currentItem.sync_time) }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useListQuerySync } from '@/composables/useListQuerySync.js'
import { ElMessage } from 'element-plus'
import { Search, Refresh, RefreshRight, Box } from '@element-plus/icons-vue'
import { getAmazonInventory, syncAmazonInventory } from '@/services/api.js'
import { useShopCache } from '@/composables/useShopCache'

export default {
  name: 'AmazonInventoryView',
  components: {
    Search,
    Refresh,
    RefreshRight,
    Box
  },
  setup() {
    const router = useRouter()
    const loading = ref(false)
    const syncLoading = ref(false)
    const inventoryList = ref([])

    // 店铺列表（从接口获取，禁止硬编码）
    const { shopList, fetchShopList, refreshShopList, getShopName, defaultShopId } = useShopCache()
    const selectedShopId = ref(null)

    // 搜索表单
    const searchForm = reactive({
      seller_sku: '',
      asin: ''
    })

    // 分页状态
    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    const { initFromQuery, syncQuery, watchQuery } = useListQuerySync({
      page: { get: () => pagination.page, set: v => pagination.page = v, type: 'number', default: 1 },
      page_size: { get: () => pagination.page_size, set: v => pagination.page_size = v, type: 'number', default: 20 },
      seller_sku: { get: () => searchForm.seller_sku, set: v => searchForm.seller_sku = v },
      asin: { get: () => searchForm.asin, set: v => searchForm.asin = v }
    })

    // 详情对话框
    const detailDialogVisible = ref(false)
    const currentItem = ref(null)

    // 获取库存列表
    const fetchInventory = async () => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncQuery()
      loading.value = true
      try {
        const params = {
          page: pagination.page,
          page_size: pagination.page_size,
          shop_id: selectedShopId.value
        }

        if (searchForm.seller_sku) {
          params.seller_sku = searchForm.seller_sku
        }

        if (searchForm.asin) {
          params.asin = searchForm.asin
        }

        const response = await getAmazonInventory(params)

        if (response.data.status === 'success') {
          const data = response.data.data || {}
          inventoryList.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取库存列表失败')
          inventoryList.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取库存列表失败:', error)
        ElMessage.error('获取库存列表失败: ' + (error.response?.data?.message || error.message))
        inventoryList.value = []
        pagination.total = 0
      } finally {
        loading.value = false
      }
    }

    // 搜索
    const handleSearch = () => {
      pagination.page = 1
      fetchInventory()
    }

    // 重置搜索
    const resetSearch = () => {
      searchForm.seller_sku = ''
      searchForm.asin = ''
      pagination.page = 1
      pagination.page_size = 20
      fetchInventory()
    }

    // 刷新数据
    const refreshData = () => {
      fetchInventory()
    }

    // 切换店铺
    const handleShopChange = async (val) => {
      if (val === '__refresh__') {
        await refreshShopList()
        selectedShopId.value = defaultShopId()
        pagination.page = 1
        fetchInventory()
        return
      }
      pagination.page = 1
      fetchInventory()
    }

    // 同步库存数据
    const syncInventoryData = async () => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncLoading.value = true
      try {
        const body = {
          shop_id: selectedShopId.value
        }
        const response = await syncAmazonInventory(body)
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '库存同步完成')
          await fetchInventory()
        } else {
          ElMessage.error(response.data.message || '库存同步失败')
        }
      } catch (error) {
        console.error('同步库存数据失败:', error)
        ElMessage.error('同步库存数据失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncLoading.value = false
      }
    }

    // 分页变化
    const handlePageChange = (page) => {
      pagination.page = page
      fetchInventory()
    }

    // 每页数量变化
    const handleSizeChange = (size) => {
      pagination.page_size = size
      pagination.page = 1
      fetchInventory()
    }

    // 显示库存详情
    const showInventoryDetails = (item) => {
      currentItem.value = item
      detailDialogVisible.value = true
    }

    // 解析 investigating breakdown
    const parseResearchingBreakdown = (str) => {
      try {
        return JSON.parse(str || '[]')
      } catch {
        return []
      }
    }

    // 格式化 investigating 名称
    const formatResearchingName = (name) => {
      const nameMap = {
        'researchingQuantityInShortTerm': '短期调查中',
        'researchingQuantityInMidTerm': '中期调查中',
        'researchingQuantityInLongTerm': '长期调查中'
      }
      return nameMap[name] || name
    }

    // 根据 shop_id 获取店铺名称
    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return dateString.replace('T', ' ')
    }

    // marketplace_id 对应亚马逊域名
    const getMarketplaceDomain = (marketplaceId) => {
      const domainMap = {
        'ATVPDKIKX0DER': 'amazon.com',
        'A2EUQ1WTGCTBG2': 'amazon.ca',
        'A1AM78C64UM0Y8': 'amazon.com.mx',
        'A2Q3Y263D00KWC': 'amazon.com.br',
        'A2VIGQ35RCS4UG': 'amazon.ae',
        'A1PA6795UKMFR9': 'amazon.de',
        'A1RKKUPIHCS9HS': 'amazon.es',
        'A13V1IB3VIYZZH': 'amazon.fr',
        'APJ6JRA9NG5U4': 'amazon.it',
        'A1F83G8C2ARO7P': 'amazon.co.uk',
        'A21TJRUUN4KGV': 'amazon.in',
        'A17E79C6D8DWNP': 'amazon.sa',
        'A33AVAJ2PDY3EV': 'amazon.com.tr',
        'A19VAU5U5O7RUS': 'amazon.sg',
        'A39IBJ37TRP1C6': 'amazon.co.jp',
        'A3H6HPSLHAK3XG': 'amazon.com.au',
        'A1805IZSGTT6HS': 'amazon.eg',
        'A2NODRKZP88ZB9': 'amazon.se',
        'A1C3SOZRARQ6R3': 'amazon.pl',
        'A1ZFFQZ3HTUKT9': 'amazon.be'
      }
      return domainMap[marketplaceId] || 'amazon.com'
    }

    // 跳转到 Listing 列表并筛选对应 SKU
    const gotoListing = (sku) => {
      if (!sku) return
      router.push({ path: '/amazon-listings', query: { sku } })
    }

    watchQuery(() => fetchInventory())

    onMounted(async () => {
      await fetchShopList()
      if (shopList.value.length > 0) {
        selectedShopId.value = defaultShopId()
      }
      initFromQuery()
      fetchInventory()
    })

    return {
      loading,
      syncLoading,
      inventoryList,
      searchForm,
      pagination,
      detailDialogVisible,
      currentItem,
      shopList,
      selectedShopId,
      fetchInventory,
      handleSearch,
      resetSearch,
      refreshData,
      syncInventoryData,
      handlePageChange,
      handleSizeChange,
      handleShopChange,
      showInventoryDetails,
      parseResearchingBreakdown,
      formatResearchingName,
      getShopName,
      formatDate,
      getMarketplaceDomain,
      gotoListing
    }
  }
}
</script>

<style scoped>
.amazon-inventory-page {
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px 24px 40px;
}

/* ===== 头部 ===== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
}
.page-title {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 6px;
  letter-spacing: -0.5px;
}
.page-subtitle {
  font-size: 14px;
  color: #888;
  margin: 0;
}
.header-actions {
  display: flex;
  gap: 10px;
}

/* ===== 筛选栏 ===== */
.filter-bar {
  background: #fff;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* ===== 表格卡片 ===== */
.table-card {
  background: #fff;
  border-radius: 14px;
  padding: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
  overflow: hidden;
}
:deep(.el-table) { --el-table-border-color: #f0f0f0; }
:deep(.inventory-row:hover) { background-color: #fafbff !important; }

/* 数量样式 */
.qty-good { color: #10b981; font-weight: 700; font-size: 14px; }
.qty-total { color: #1a1a2e; font-weight: 700; font-size: 14px; }
.qty-warn { color: #f59e0b; font-weight: 700; font-size: 14px; }
.qty-info { color: #667eea; font-weight: 700; font-size: 14px; }
.qty-bad { color: #ef4444; font-weight: 700; font-size: 14px; }
.qty-zero { color: #bbb; font-size: 13px; }

/* 分页 */
.pagination-wrap {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
}

/* 详情弹窗 */
.inventory-detail .detail-section {
  margin-top: 20px;
}
.inventory-detail .detail-section:first-child {
  margin-top: 0;
}
.inventory-detail .detail-section h4 {
  margin-bottom: 12px;
  color: #1a1a2e;
  font-size: 16px;
  font-weight: 600;
}
.detail-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

.asin-link {
  font-family: monospace;
  font-size: 12px;
  color: #667eea;
  text-decoration: none;
}
.asin-link:hover {
  text-decoration: underline;
}

/* SKU 链接悬停效果 */
.sku-link:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .amazon-inventory-page {
    padding: 16px 16px 40px;
  }
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-group {
    justify-content: stretch;
  }
}
</style>
