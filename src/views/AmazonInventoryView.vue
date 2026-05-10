<template>
  <div class="amazon-inventory-page">
    <div class="page-header">
      <h1 class="page-title">亚马逊库存列表</h1>
      <p class="page-subtitle">查看亚马逊FBA库存汇总，掌握商品库存状态</p>
    </div>

    <!-- 搜索和筛选区域 -->
    <div class="search-card">
      <el-form :model="searchForm" :inline="true" class="search-form">
        <el-form-item label="店铺">
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
          </el-select>
        </el-form-item>

        <el-form-item label="卖家SKU">
          <el-input
            v-model="searchForm.seller_sku"
            placeholder="输入卖家SKU"
            clearable
            style="width: 180px"
          />
        </el-form-item>

        <el-form-item label="ASIN">
          <el-input
            v-model="searchForm.asin"
            placeholder="输入ASIN"
            clearable
            style="width: 180px"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSearch" :loading="loading">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetSearch">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 数据展示区域 -->
    <div class="content-card">
      <div class="card-header">
        <h3 class="section-title">库存列表</h3>
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
            <el-icon><RefreshRight /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <!-- 库存列表 -->
      <el-table
        :data="inventoryList"
        v-loading="loading"
        stripe
        style="width: 100%"
        :default-sort="{ prop: 'sync_time', order: 'descending' }"
      >
        <el-table-column label="店铺名称" width="140" show-overflow-tooltip fixed="left">
          <template #default>
            {{ getShopName(selectedShopId) || '-' }}
          </template>
        </el-table-column>

        <el-table-column prop="seller_sku" label="卖家SKU" width="150" fixed="left" />

        <el-table-column prop="asin" label="ASIN" width="130" />

        <el-table-column prop="fn_sku" label="FNSKU" width="130" />

        <el-table-column prop="product_name" label="商品名称" min-width="240" show-overflow-tooltip />

        <el-table-column label="产品中文名" min-width="180" show-overflow-tooltip>
          <template #default="scope">
            {{ scope.row.declare_name_cn || scope.row.product_name || '-' }}
          </template>
        </el-table-column>

        <el-table-column prop="fulfillable_quantity" label="可售数量" width="100" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.fulfillable_quantity > 0" type="success">{{ scope.row.fulfillable_quantity }}</el-tag>
            <span v-else>{{ scope.row.fulfillable_quantity }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="total_quantity" label="总数量" width="100" align="center" />

        <el-table-column prop="inbound_working_quantity" label="入库处理中" width="110" align="center" />

        <el-table-column prop="inbound_shipped_quantity" label="已发货" width="90" align="center" />

        <el-table-column prop="inbound_receiving_quantity" label="接收中" width="90" align="center" />

        <el-table-column prop="reserved_total" label="预留总数" width="100" align="center" />

        <el-table-column prop="unfulfillable_total" label="不可售总数" width="110" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.unfulfillable_total > 0" type="danger">{{ scope.row.unfulfillable_total }}</el-tag>
            <span v-else>{{ scope.row.unfulfillable_total }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="sync_time" label="同步时间" width="160" align="center">
          <template #default="scope">
            {{ formatDate(scope.row.sync_time) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="scope">
            <el-button type="primary" link @click="showInventoryDetails(scope.row)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
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
              <el-tag v-if="currentItem.fulfillable_quantity > 0" type="success">{{ currentItem.fulfillable_quantity }}</el-tag>
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
              <el-tag v-if="currentItem.unfulfillable_total > 0" type="danger">{{ currentItem.unfulfillable_total }}</el-tag>
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
import { ElMessage } from 'element-plus'
import { Search, Refresh, RefreshRight } from '@element-plus/icons-vue'
import { getAmazonInventory, syncAmazonInventory, getShops } from '@/services/api.js'

export default {
  name: 'AmazonInventoryView',
  components: {
    Search,
    Refresh,
    RefreshRight
  },
  setup() {
    const loading = ref(false)
    const syncLoading = ref(false)
    const inventoryList = ref([])

    // 店铺列表（从接口获取，禁止硬编码）
    const shopList = ref([])
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

    // 详情对话框
    const detailDialogVisible = ref(false)
    const currentItem = ref(null)

    // 获取店铺列表
    const fetchShopList = async () => {
      try {
        const response = await getShops()
        if (response.data.status === 'success') {
          const list = response.data.data || []
          if (list.length === 0) {
            shopList.value = []
            selectedShopId.value = null
            ElMessage.warning('暂无店铺数据，请先配置店铺')
            return
          }
          shopList.value = list
          // 优先选中 is_default=1 的店铺，否则选中第一个
          const defaultShop = list.find(s => s.is_default === 1)
          selectedShopId.value = defaultShop ? defaultShop.id : list[0].id
        } else {
          shopList.value = []
          selectedShopId.value = null
          ElMessage.error(response.data.message || '获取店铺列表失败')
        }
      } catch (error) {
        console.error('获取店铺列表失败:', error)
        shopList.value = []
        selectedShopId.value = null
        ElMessage.error('获取店铺列表失败: ' + (error.response?.data?.message || error.message))
      }
    }

    // 获取库存列表
    const fetchInventory = async () => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

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
    const handleShopChange = () => {
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
    const getShopName = (shopId) => {
      if (!shopId) return '-'
      const shop = shopList.value.find(s => s.id === shopId)
      return shop ? shop.shop_name : '-'
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return dateString.replace('T', ' ')
    }

    onMounted(async () => {
      await fetchShopList()
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
      formatDate
    }
  }
}
</script>

<style scoped>
.amazon-inventory-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
  text-align: center;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.page-subtitle {
  font-size: 16px;
  color: #666;
  margin: 0;
}

.search-card,
.content-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;
}

.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.inventory-detail .detail-section {
  margin-top: 20px;
}

.inventory-detail .detail-section:first-child {
  margin-top: 0;
}

.inventory-detail .detail-section h4 {
  margin-bottom: 12px;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.detail-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

/* 响应式 */
@media (max-width: 768px) {
  .amazon-inventory-page {
    padding: 12px;
  }

  .page-title {
    font-size: 24px;
  }

  .search-card,
  .content-card {
    padding: 16px;
  }

  .search-form {
    flex-direction: column;
    align-items: stretch;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .pagination-container {
    text-align: center;
  }

  .inventory-detail .detail-section h4 {
    font-size: 14px;
  }

  .detail-tag {
    margin-right: 4px;
    margin-bottom: 4px;
  }
}
</style>
