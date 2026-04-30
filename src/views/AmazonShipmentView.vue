<template>
  <div class="amazon-shipment-page">
    <div class="page-header">
      <h1 class="page-title">亚马逊货件管理</h1>
      <p class="page-subtitle">管理您的亚马逊FBA货件，查看货件状态和详情</p>
    </div>

    <!-- 搜索和筛选区域 -->
    <div class="search-card">
      <el-form :model="searchForm" :inline="true" class="search-form">
        <el-form-item label="状态筛选">
          <el-select
            v-model="searchForm.status"
            placeholder="选择状态"
            clearable
            style="width: 160px"
          >
            <el-option label="全部" value="" />
            <el-option label="处理中" value="WORKING" />
            <el-option label="已发货" value="SHIPPED" />
            <el-option label="接收中" value="RECEIVING" />
            <el-option label="已关闭" value="CLOSED" />
            <el-option label="已删除" value="DELETED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>

        <el-form-item label="目标仓库">
          <el-select
            v-model="searchForm.destination_fc"
            placeholder="选择仓库"
            clearable
            filterable
            style="width: 160px"
          >
            <el-option
              v-for="wh in warehouses"
              :key="wh.warehouse_id"
              :label="wh.warehouse_id"
              :value="wh.warehouse_id"
            />
          </el-select>
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
        <h3 class="section-title">货件列表</h3>
        <div class="header-actions">
          <el-tooltip
            effect="dark"
            placement="top"
            content="从亚马逊卖家后台手动同步最新货件数据。页面数据每小时自动更新一次，如需查看最新货件信息可点击此按钮。"
          >
            <el-button type="warning" @click="syncAllData" :loading="syncLoading">
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

      <!-- 货件列表 -->
      <el-table
        :data="shipments"
        v-loading="loading"
        stripe
        style="width: 100%"
        :default-sort="{ prop: 'sync_time', order: 'descending' }"
      >
        <el-table-column prop="shipment_id" label="货件ID" width="140" fixed="left">
          <template #default="scope">
            <el-button type="primary" link @click="showShipmentDetails(scope.row)">
              {{ scope.row.shipment_id }}
            </el-button>
          </template>
        </el-table-column>

        <el-table-column prop="shipment_name" label="货件名称" min-width="220" show-overflow-tooltip />

        <el-table-column label="发货地址" min-width="240" show-overflow-tooltip>
          <template #default="scope">
            <div v-if="scope.row.ship_from_name">
              <div class="address-name">{{ scope.row.ship_from_name }}</div>
              <div class="address-detail">{{ formatFullAddress(scope.row) }}</div>
            </div>
            <div v-else>-</div>
          </template>
        </el-table-column>

        <el-table-column prop="destination_fulfillment_center_id" label="目标仓库" width="100" align="center" />

        <el-table-column prop="shipment_status" label="状态" width="100" align="center">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.shipment_status)">
              {{ getStatusText(scope.row.shipment_status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="box_contents_source" label="装箱来源" width="110" align="center" />

        <el-table-column prop="label_prep_type" label="标签类型" width="120" align="center" />

        <el-table-column prop="sync_time" label="同步时间" width="160" align="center">
          <template #default="scope">
            {{ formatDate(scope.row.sync_time) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="scope">
            <el-button type="primary" link @click="viewShipmentItems(scope.row)">
              查看商品
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

    <!-- 货件详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`货件详情 - ${currentShipment?.shipment_id}`"
      width="70%"
      :destroy-on-close="true"
    >
      <div v-if="currentShipment" class="shipment-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="货件ID">{{ currentShipment.shipment_id }}</el-descriptions-item>
          <el-descriptions-item label="货件名称">{{ currentShipment.shipment_name }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentShipment.shipment_status)">
              {{ getStatusText(currentShipment.shipment_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="目标仓库">{{ currentShipment.destination_fulfillment_center_id }}</el-descriptions-item>
          <el-descriptions-item label="标签类型">{{ currentShipment.label_prep_type }}</el-descriptions-item>
          <el-descriptions-item label="装箱来源">{{ currentShipment.box_contents_source }}</el-descriptions-item>
          <el-descriptions-item label="市场ID">{{ currentShipment.marketplace_id }}</el-descriptions-item>
          <el-descriptions-item label="同步时间">{{ formatDate(currentShipment.sync_time) }}</el-descriptions-item>
        </el-descriptions>

        <div class="detail-section" v-if="currentShipment.ship_from_name">
          <h4>发货地址</h4>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="名称">{{ currentShipment.ship_from_name }}</el-descriptions-item>
            <el-descriptions-item label="详细地址">{{ formatAddress(currentShipment) }}</el-descriptions-item>
            <el-descriptions-item label="城市">{{ currentShipment.ship_from_city }}, {{ currentShipment.ship_from_state }}</el-descriptions-item>
            <el-descriptions-item label="邮编">{{ currentShipment.ship_from_postal_code }}</el-descriptions-item>
            <el-descriptions-item label="国家">{{ currentShipment.ship_from_country }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </el-dialog>

    <!-- 商品列表对话框 -->
    <el-dialog
      v-model="itemsDialogVisible"
      :title="`商品列表 - ${selectedShipment?.shipment_id}`"
      width="75%"
      :destroy-on-close="true"
    >
      <div class="items-dialog-header">
        <el-tooltip
          effect="dark"
          placement="top"
          content="从亚马逊卖家后台手动同步该货件的商品明细。页面数据每小时自动更新一次，如需查看最新商品信息可点击此按钮。"
        >
          <el-button type="warning" @click="syncCurrentShipmentItems" :loading="itemsLoading" size="small">
            <el-icon><RefreshRight /></el-icon>
            同步该货件商品
          </el-button>
        </el-tooltip>
      </div>
      <div v-loading="itemsLoading">
        <div v-if="shipmentItems && shipmentItems.length > 0">
          <el-table :data="shipmentItems" stripe style="width: 100%">
            <el-table-column prop="seller_sku" label="SKU" width="150" />
            <el-table-column label="中文申报" min-width="180" show-overflow-tooltip>
              <template #default="scope">
                {{ scope.row.declare_name_cn || scope.row.product_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="declare_name_en" label="英文申报" min-width="180" show-overflow-tooltip />
            <el-table-column prop="fulfillment_network_sku" label="FNSKU" width="150" />
            <el-table-column prop="quantity_shipped" label="发货数量" width="100" align="center" />
            <el-table-column prop="quantity_received" label="接收数量" width="100" align="center" />
            <el-table-column prop="quantity_in_case" label="每箱数量" width="100" align="center" />
            <el-table-column label="预处理详情" min-width="200">
              <template #default="scope">
                <div v-if="parsePrepDetails(scope.row.prep_details).length > 0">
                  <el-tag
                    v-for="(prep, idx) in parsePrepDetails(scope.row.prep_details)"
                    :key="idx"
                    size="small"
                    class="prep-tag"
                  >
                    {{ prep.PrepInstruction }} ({{ prep.PrepOwner }})
                  </el-tag>
                </div>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="sync_time" label="同步时间" width="160" align="center">
              <template #default="scope">
                {{ formatDate(scope.row.sync_time) }}
              </template>
            </el-table-column>
          </el-table>

          <!-- 商品分页 -->
          <div class="pagination-container">
            <el-pagination
              v-model:current-page="itemsPagination.page"
              v-model:page-size="itemsPagination.page_size"
              :page-sizes="[20, 50, 100]"
              :total="itemsPagination.total"
              layout="total, sizes, prev, pager, next, jumper"
              :hide-on-single-page="false"
              @current-change="handleItemsPageChange"
              @size-change="handleItemsSizeChange"
            />
          </div>
        </div>
        <el-empty v-else description="暂无商品数据" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, RefreshRight } from '@element-plus/icons-vue'
import {
  getAmazonShipments,
  getAmazonShipmentItems,
  syncAmazonShipments,
  syncAmazonShipmentItems,
  getAmazonWarehouses
} from '@/services/api.js'

export default {
  name: 'AmazonShipmentView',
  components: {
    Search,
    Refresh,
    RefreshRight
  },
  setup() {
    const loading = ref(false)
    const itemsLoading = ref(false)
    const syncLoading = ref(false)
    const shipments = ref([])
    const warehouses = ref([])

    // 搜索表单
    const searchForm = reactive({
      status: 'WORKING',
      destination_fc: ''
    })

    // 分页状态
    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    // 详情对话框
    const detailDialogVisible = ref(false)
    const currentShipment = ref(null)

    // 商品列表对话框
    const itemsDialogVisible = ref(false)
    const selectedShipment = ref(null)
    const shipmentItems = ref([])

    // 商品分页
    const itemsPagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    // 获取仓库列表
    const fetchWarehouses = async () => {
      try {
        const response = await getAmazonWarehouses()
        if (response.data.status === 'success') {
          warehouses.value = response.data.data || []
        }
      } catch (error) {
        console.error('获取仓库列表失败:', error)
      }
    }

    // 获取货件列表
    const fetchShipments = async () => {
      loading.value = true
      try {
        const params = {
          page: pagination.page,
          page_size: pagination.page_size
        }

        if (searchForm.status) {
          params.status = searchForm.status
        }

        if (searchForm.destination_fc) {
          params.destination_fc = searchForm.destination_fc
        }

        const response = await getAmazonShipments(params)

        if (response.data.status === 'success') {
          const data = response.data.data || {}
          shipments.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取货件列表失败')
          shipments.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取货件列表失败:', error)
        ElMessage.error('获取货件列表失败: ' + (error.response?.data?.message || error.message))
        shipments.value = []
        pagination.total = 0
      } finally {
        loading.value = false
      }
    }

    // 搜索
    const handleSearch = () => {
      pagination.page = 1
      fetchShipments()
    }

    // 重置搜索
    const resetSearch = () => {
      searchForm.status = ''
      searchForm.destination_fc = ''
      pagination.page = 1
      pagination.page_size = 20
      fetchShipments()
    }

    // 刷新数据
    const refreshData = () => {
      fetchShipments()
    }

    // 同步最新货件
    const syncAllData = async () => {
      syncLoading.value = true
      try {
        const response = await syncAmazonShipments()
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '同步完成')
          await fetchShipments()
        } else {
          ElMessage.error(response.data.message || '同步失败')
        }
      } catch (error) {
        console.error('同步数据失败:', error)
        ElMessage.error('同步数据失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncLoading.value = false
      }
    }

    // 同步当前货件商品
    const syncCurrentShipmentItems = async () => {
      if (!selectedShipment.value) return
      itemsLoading.value = true
      try {
        const response = await syncAmazonShipmentItems(selectedShipment.value.shipment_id)
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '货件商品同步完成')
          await loadShipmentItems()
        } else {
          ElMessage.error(response.data.message || '货件商品同步失败')
        }
      } catch (error) {
        console.error('同步货件商品失败:', error)
        ElMessage.error('同步货件商品失败: ' + (error.response?.data?.message || error.message))
      } finally {
        itemsLoading.value = false
      }
    }

    // 分页变化
    const handlePageChange = (page) => {
      pagination.page = page
      fetchShipments()
    }

    // 每页数量变化
    const handleSizeChange = (size) => {
      pagination.page_size = size
      pagination.page = 1
      fetchShipments()
    }

    // 显示货件详情
    const showShipmentDetails = (shipment) => {
      currentShipment.value = shipment
      detailDialogVisible.value = true
    }

    // 查看商品列表
    const viewShipmentItems = async (shipment) => {
      selectedShipment.value = shipment
      itemsDialogVisible.value = true
      itemsLoading.value = true
      itemsPagination.page = 1
      itemsPagination.page_size = 20

      await loadShipmentItems()
    }

    // 加载货件商品
    const loadShipmentItems = async () => {
      if (!selectedShipment.value) return

      itemsLoading.value = true
      try {
        const response = await getAmazonShipmentItems(
          selectedShipment.value.shipment_id,
          {
            page: itemsPagination.page,
            page_size: itemsPagination.page_size
          }
        )

        if (response.data.status === 'success') {
          const data = response.data.data || {}
          shipmentItems.value = data.list || []
          itemsPagination.total = data.total || 0
          itemsPagination.page = data.page || 1
          itemsPagination.page_size = data.page_size || 20
        } else {
          shipmentItems.value = []
          itemsPagination.total = 0
          ElMessage.error(response.data.message || '获取商品列表失败')
        }
      } catch (error) {
        console.error('获取商品列表失败:', error)
        ElMessage.error('获取商品列表失败: ' + (error.response?.data?.message || error.message))
        shipmentItems.value = []
        itemsPagination.total = 0
      } finally {
        itemsLoading.value = false
      }
    }

    // 商品分页变化
    const handleItemsPageChange = (page) => {
      itemsPagination.page = page
      loadShipmentItems()
    }

    // 商品每页数量变化
    const handleItemsSizeChange = (size) => {
      itemsPagination.page_size = size
      itemsPagination.page = 1
      loadShipmentItems()
    }

    // 解析预处理详情
    const parsePrepDetails = (str) => {
      try {
        return JSON.parse(str || '[]')
      } catch {
        return []
      }
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      // 直接替换 T 为空格展示，避免 new Date() 时区解析导致时间偏移
      return dateString.replace('T', ' ')
    }

    // 格式化详细地址（用于表格展示）
    const formatFullAddress = (row) => {
      const parts = [
        row.ship_from_address_line1,
        row.ship_from_address_line2,
        row.ship_from_district,
        row.ship_from_city,
        row.ship_from_state,
        row.ship_from_postal_code,
        row.ship_from_country
      ].filter(Boolean)
      return parts.join(', ')
    }

    // 格式化地址（用于详情页面）
    const formatAddress = (row) => {
      const parts = [
        row.ship_from_address_line1,
        row.ship_from_address_line2,
        row.ship_from_city,
        row.ship_from_state,
        row.ship_from_postal_code,
        row.ship_from_country
      ].filter(Boolean)
      return parts.join(', ')
    }

    // 状态样式
    const getStatusType = (status) => {
      const typeMap = {
        'WORKING': 'warning',
        'SHIPPED': 'info',
        'RECEIVING': 'success',
        'CLOSED': 'success',
        'DELETED': 'danger',
        'CANCELLED': 'danger'
      }
      return typeMap[status] || 'info'
    }

    const getStatusText = (status) => {
      const textMap = {
        'WORKING': '处理中',
        'SHIPPED': '已发货',
        'RECEIVING': '接收中',
        'CLOSED': '已关闭',
        'DELETED': '已删除',
        'CANCELLED': '已取消'
      }
      return textMap[status] || status
    }

    onMounted(() => {
      fetchWarehouses()
      fetchShipments()
    })

    return {
      loading,
      itemsLoading,
      shipments,
      warehouses,
      searchForm,
      pagination,
      detailDialogVisible,
      currentShipment,
      itemsDialogVisible,
      selectedShipment,
      shipmentItems,
      itemsPagination,
      syncLoading,
      fetchShipments,
      handleSearch,
      resetSearch,
      refreshData,
      syncAllData,
      syncCurrentShipmentItems,
      handlePageChange,
      handleSizeChange,
      showShipmentDetails,
      viewShipmentItems,
      handleItemsPageChange,
      handleItemsSizeChange,
      parsePrepDetails,
      formatDate,
      formatAddress,
      formatFullAddress,
      getStatusType,
      getStatusText
    }
  }
}
</script>

<style scoped>
.amazon-shipment-page {
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

.address-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.address-detail {
  font-size: 13px;
  color: #666;
  line-height: 1.4;
}

.shipment-detail .detail-section {
  margin-top: 20px;
}

.shipment-detail .detail-section h4 {
  margin-bottom: 12px;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.prep-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

.items-dialog-header {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

/* 响应式 */
@media (max-width: 768px) {
  .amazon-shipment-page {
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
}
</style>
