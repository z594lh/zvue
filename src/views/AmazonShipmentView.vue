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
            multiple
            placeholder="选择状态"
            clearable
            style="width: 200px"
          >
            <el-option label="处理中" value="WORKING" />
            <el-option label="已发货" value="SHIPPED" />
            <el-option label="接收中" value="RECEIVING" />
            <el-option label="已取消" value="CANCELLED" />
            <el-option label="已删除" value="DELETED" />
            <el-option label="已关闭" value="CLOSED" />
            <el-option label="错误" value="ERROR" />
          </el-select>
        </el-form-item>

        <el-form-item label="货件ID">
          <el-input
            v-model="searchForm.shipment_id"
            placeholder="输入货件ID"
            clearable
            style="width: 200px"
          />
        </el-form-item>

        <el-form-item label="时间范围">
          <el-select v-model="searchForm.days" style="width: 120px">
            <el-option label="最近7天" :value="7" />
            <el-option label="最近15天" :value="15" />
            <el-option label="最近30天" :value="30" />
            <el-option label="最近90天" :value="90" />
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
        :default-sort="{ prop: 'created_date', order: 'descending' }"
      >
        <el-table-column prop="ShipmentId" label="货件ID" width="140" fixed="left">
          <template #default="scope">
            <el-button type="text" @click="showShipmentDetails(scope.row)">
              {{ scope.row.ShipmentId }}
            </el-button>
          </template>
        </el-table-column>

        <el-table-column prop="ShipmentName" label="货件名称" min-width="200" show-overflow-tooltip />

        <el-table-column prop="ShipFromAddress" label="发货地址" min-width="200" show-overflow-tooltip>
          <template #default="scope">
            <div v-if="scope.row.ShipFromAddress">
              <div class="address-name">{{ scope.row.ShipFromAddress.Name }}</div>
              <div class="address-detail">{{ formatFullAddress(scope.row.ShipFromAddress) }}</div>
            </div>
            <div v-else>-</div>
          </template>
        </el-table-column>

        <el-table-column prop="DestinationFulfillmentCenterId" label="目标仓库" width="120" />

        <el-table-column prop="ShipmentStatus" label="状态" width="100" align="center">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.ShipmentStatus)">
              {{ getStatusText(scope.row.ShipmentStatus) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="BoxContentsSource" label="装箱来源" width="100" align="center" />

        <el-table-column prop="LabelPrepType" label="标签类型" width="100" align="center" />

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
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[1000]"
          :total="pagination.total"
          layout="total, prev, pager, next, jumper"
          :hide-on-single-page="true"
          @current-change="handleCurrentChange"
        />
      </div>

    </div>

    <!-- 货件详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`货件详情 - ${currentShipment?.ShipmentId}`"
      width="70%"
      :destroy-on-close="true"
    >
      <div v-if="currentShipment" class="shipment-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="货件ID">{{ currentShipment.ShipmentId }}</el-descriptions-item>
          <el-descriptions-item label="货件名称">{{ currentShipment.ShipmentName }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentShipment.ShipmentStatus)">
              {{ getStatusText(currentShipment.ShipmentStatus) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="目标仓库">{{ currentShipment.DestinationFulfillmentCenterId }}</el-descriptions-item>
          <el-descriptions-item label="标签类型">{{ currentShipment.LabelPrepType }}</el-descriptions-item>
          <el-descriptions-item label="装箱来源">{{ currentShipment.BoxContentsSource }}</el-descriptions-item>
        </el-descriptions>

        <div class="detail-section" v-if="currentShipment.ShipFromAddress">
          <h4>发货地址</h4>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="名称">{{ currentShipment.ShipFromAddress.Name }}</el-descriptions-item>
            <el-descriptions-item label="详细地址">{{ formatAddress(currentShipment.ShipFromAddress) }}</el-descriptions-item>
            <el-descriptions-item label="城市">{{ currentShipment.ShipFromAddress.City }}, {{ currentShipment.ShipFromAddress.StateOrProvinceCode }}</el-descriptions-item>
            <el-descriptions-item label="邮编">{{ currentShipment.ShipFromAddress.PostalCode }}</el-descriptions-item>
            <el-descriptions-item label="国家">{{ currentShipment.ShipFromAddress.CountryCode }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </el-dialog>

    <!-- 商品列表对话框 -->
    <el-dialog
      v-model="itemsDialogVisible"
      :title="`商品列表 - ${selectedShipment?.ShipmentId}`"
      width="70%"
      :destroy-on-close="true"
    >
      <div v-loading="itemsLoading">
        <div v-if="shipmentItems && shipmentItems.length > 0">
          <el-table :data="shipmentItems" stripe style="width: 100%">
            <el-table-column prop="sku" label="SKU" width="120" />
            <el-table-column prop="fnsku" label="FNSKU" width="140" />
            <el-table-column prop="title" label="商品名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="quantity_shipped" label="发货数量" width="100" align="center" />
            <el-table-column prop="quantity_received" label="接收数量" width="100" align="center" />
            <el-table-column prop="quantity_in_case" label="箱内数量" width="100" align="center" />
          </el-table>
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
import { getAmazonShipments, getAmazonShipmentItems } from '@/services/api.js'

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
    const shipments = ref([])

    // 搜索表单
    const searchForm = reactive({
      status: [],
      shipment_id: '',
      days: 30
    })

    // 分页状态（固定1页）
    const pagination = reactive({
      currentPage: 1,
      pageSize: 1000,
      total: 0
    })


    // 详情对话框
    const detailDialogVisible = ref(false)
    const currentShipment = ref(null)

    // 商品列表对话框
    const itemsDialogVisible = ref(false)
    const selectedShipment = ref(null)
    const shipmentItems = ref([])

    // 获取货件列表
    const fetchShipments = async () => {
      loading.value = true
      try {
        const params = {
          days: searchForm.days,
          page: 1,
          page_size: 1000  // 设置足够大，确保1页显示所有数据
        }

        if (searchForm.status && searchForm.status.length > 0) {
          params.status = searchForm.status.join(',')
        }

        if (searchForm.shipment_id) {
          params.shipment_id = searchForm.shipment_id
        }

        const response = await getAmazonShipments(params)

        console.log('亚马逊货件API返回数据:', response.data)

        if (response.data.status === 'success') {
          // 根据真实API响应，数据在 response.data.data.payload.ShipmentData 中
          const payload = response.data.data?.payload || {}
          const shipmentData = payload.ShipmentData || []
          shipments.value = shipmentData
          pagination.total = shipmentData.length

          console.log(`成功获取 ${shipments.value.length} 个货件`)
        } else {
          ElMessage.error(response.data.message || '获取货件列表失败')
          shipments.value = []
        }
      } catch (error) {
        console.error('获取货件列表失败:', error)
        ElMessage.error('获取货件列表失败: ' + (error.response?.data?.message || error.message))
        shipments.value = []
      } finally {
        loading.value = false
      }
    }

    // 搜索
    const handleSearch = () => {
      pagination.currentPage = 1
      fetchShipments()
    }

    // 重置搜索
    const resetSearch = () => {
      searchForm.status = []
      searchForm.shipment_id = ''
      searchForm.days = 30
      pagination.currentPage = 1
      fetchShipments()
    }

    // 刷新数据
    const refreshData = () => {
      fetchShipments()
    }

    // 分页变化（固定1页，主要用于保持接口一致性）
    const handleCurrentChange = (page) => {
      // 由于固定为1页，这里不做实际翻页操作
      console.log('当前页面:', page)
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

      try {
        const response = await getAmazonShipmentItems(shipment.ShipmentId)
        console.log(`货件 ${shipment.ShipmentId} 的商品数据:`, response.data)

        if (response.data.status === 'success') {
          shipmentItems.value = response.data.data || []
        } else {
          shipmentItems.value = []
          ElMessage.error(response.data.message || '获取商品列表失败')
        }
      } catch (error) {
        console.error('获取商品列表失败:', error)
        ElMessage.error('获取商品列表失败: ' + (error.response?.data?.message || error.message))
        shipmentItems.value = []
      } finally {
        itemsLoading.value = false
      }
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      try {
        const date = new Date(dateString)
        return date.toLocaleString('zh-CN')
      } catch {
        return dateString
      }
    }

    // 格式化详细地址（用于表格展示）
    const formatFullAddress = (address) => {
      if (!address) return '-'
      const parts = [
        address.AddressLine1,
        address.AddressLine2,
        address.DistrictOrCounty,
        address.City,
        address.StateOrProvinceCode,
        address.PostalCode,
        address.CountryCode
      ].filter(Boolean)
      return parts.join(', ')
    }

    // 格式化地址（用于详情页面）
    const formatAddress = (address) => {
      if (!address) return '-'
      const parts = [
        address.AddressLine1,
        address.AddressLine2,
        address.City,
        address.StateOrProvinceCode,
        address.PostalCode,
        address.CountryCode
      ].filter(Boolean)
      return parts.join(', ')
    }

    // 状态样式
    const getStatusType = (status) => {
      const typeMap = {
        'WORKING': 'warning',
        'SHIPPED': 'info',
        'RECEIVING': 'success',
        'CANCELLED': 'danger',
        'DELETED': 'danger',
        'CLOSED': 'success',
        'ERROR': 'danger'
      }
      return typeMap[status] || 'info'
    }

    const getStatusText = (status) => {
      const textMap = {
        'WORKING': '处理中',
        'SHIPPED': '已发货',
        'RECEIVING': '接收中',
        'CANCELLED': '已取消',
        'DELETED': '已删除',
        'CLOSED': '已关闭',
        'ERROR': '错误'
      }
      return textMap[status] || status
    }


    onMounted(() => {
      fetchShipments()
    })

    return {
      loading,
      itemsLoading,
      shipments,
      searchForm,
      pagination,
      detailDialogVisible,
      currentShipment,
      itemsDialogVisible,
      selectedShipment,
      shipmentItems,
      fetchShipments,
      handleSearch,
      resetSearch,
      refreshData,
      handleCurrentChange,
      showShipmentDetails,
      viewShipmentItems,
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

.debug-panel {
  margin-bottom: 20px;
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

.shipment-detail {
  .detail-section {
    margin-top: 20px;

    h4 {
      margin-bottom: 12px;
      color: #333;
      font-size: 16px;
      font-weight: 600;
    }
  }
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
.pagination-container {
  margin-top: 20px;
  text-align: right;
}

</style>