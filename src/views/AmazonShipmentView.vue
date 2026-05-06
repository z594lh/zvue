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

        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="scope">
            <el-tooltip content="查看商品" placement="top">
              <el-button type="primary" link @click="viewShipmentItems(scope.row)">
                <el-icon><Goods /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="查看箱子" placement="top">
              <el-button type="info" link @click="viewShipmentBoxes(scope.row)">
                <el-icon><Box /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="打印箱唛" placement="top">
              <el-button type="success" link :loading="labelsLoading" @click="printShipmentLabels(scope.row)">
                <el-icon><Printer /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="导出发票" placement="top">
              <el-button type="warning" link @click="exportInvoice(scope.row)">
                <el-icon><Download /></el-icon>
              </el-button>
            </el-tooltip>
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

    <!-- 箱子列表对话框 -->
    <el-dialog
      v-model="boxesDialogVisible"
      :title="`箱子列表 - ${selectedBoxesShipment?.shipment_id}`"
      width="85%"
      :destroy-on-close="true"
      @closed="allBoxesExpanded = false"
    >
      <div v-loading="boxesLoading">
        <div v-if="shipmentBoxes && shipmentBoxes.length > 0">
          <div class="boxes-dialog-header">
            <el-button type="warning" size="small" :loading="boxesSyncLoading" @click="syncInboundPlanBoxes">
              <el-icon><RefreshRight /></el-icon>
              同步最新数据
            </el-button>
            <el-button type="primary" size="small" @click="toggleAllBoxesExpansion">
              {{ allBoxesExpanded ? '全部收缩' : '全部展开' }}
            </el-button>
          </div>
          <el-table ref="boxesTable" :data="shipmentBoxes" stripe style="width: 100%" border>
            <el-table-column type="expand" width="45">
              <template #default="scope">
                <div class="box-expand-content">
                  <el-descriptions :column="2" border size="small" class="box-detail-desc">
                    <el-descriptions-item label="inbound_plan_id">{{ scope.row.inbound_plan_id || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="package_id">{{ scope.row.package_id || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="content_information_source">{{ scope.row.content_information_source || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="template_name">{{ scope.row.template_name || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="external_container_identifier">{{ scope.row.external_container_identifier || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="external_container_identifier_type">{{ scope.row.external_container_identifier_type || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="同步时间">{{ formatDate(scope.row.sync_time) }}</el-descriptions-item>
                  </el-descriptions>
                  <div class="box-items-section" v-if="getBoxItems(scope.row).length > 0">
                    <h5>箱内商品</h5>
                    <el-table :data="getBoxItems(scope.row)" size="small" border>
                      <el-table-column prop="msku" label="MSKU" min-width="140" />
                      <el-table-column prop="sku_name_cn" label="产品名称" min-width="140" show-overflow-tooltip />
                      <el-table-column prop="labelOwner" label="标签所有者" min-width="110" />
                      <el-table-column prop="prepOwner" label="预处理所有者" min-width="110" />
                      <el-table-column prop="quantity" label="数量" min-width="70" align="center" />
                      <el-table-column prop="expiration" label="有效期" min-width="110" />
                      <el-table-column prop="manufacturingLotCode" label="生产批号" min-width="110" />
                    </el-table>
                  </div>
                  <el-empty v-else description="暂无箱内商品数据" :image-size="60" />
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="box_id" label="箱子ID" min-width="1" show-overflow-tooltip />
            <el-table-column prop="quantity" label="数量" min-width="1" align="center" />
            <el-table-column label="尺寸" min-width="1" align="center">
              <template #default="scope">
                <span v-if="scope.row.dimensions_length || scope.row.dimensions_width || scope.row.dimensions_height">
                  {{ scope.row.dimensions_length }}×{{ scope.row.dimensions_width }}×{{ scope.row.dimensions_height }} {{ scope.row.dimensions_unit }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="重量" min-width="1" align="center">
              <template #default="scope">
                <span v-if="scope.row.weight_value">
                  {{ scope.row.weight_value }} {{ scope.row.weight_unit }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="sync_time" label="同步时间" min-width="1" align="center">
              <template #default="scope">
                {{ formatDate(scope.row.sync_time) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="1" align="center">
              <template #default="scope">
                <el-button type="success" link size="small" :loading="labelsLoading" @click="printShipmentLabels(selectedBoxesShipment, scope.row.box_id)">
                  打印箱唛
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 箱子分页 -->
          <div class="pagination-container">
            <el-pagination
              v-model:current-page="boxesPagination.page"
              v-model:page-size="boxesPagination.page_size"
              :page-sizes="[20, 50, 100]"
              :total="boxesPagination.total"
              layout="total, sizes, prev, pager, next, jumper"
              :hide-on-single-page="false"
              @current-change="handleBoxesPageChange"
              @size-change="handleBoxesSizeChange"
            />
          </div>
        </div>
        <el-empty v-else description="暂无箱子数据" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, RefreshRight, Goods, Box, Printer, Download } from '@element-plus/icons-vue'
import {
  getAmazonShipments,
  getAmazonShipmentItems,
  getAmazonShipmentLabels,
  syncAmazonAll,
  syncAmazonShipmentItems,
  getAmazonWarehouses,
  getAmazonInboundPlanBoxes,
  syncAmazonInboundPlanBoxes,
  exportAmazonShipmentInvoice
} from '@/services/api.js'

export default {
  name: 'AmazonShipmentView',
  components: {
    Search,
    Refresh,
    RefreshRight,
    Goods,
    Box,
    Printer,
    Download
  },
  setup() {
    const loading = ref(false)
    const itemsLoading = ref(false)
    const syncLoading = ref(false)
    const labelsLoading = ref(false)
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

    // 箱子列表对话框
    const boxesDialogVisible = ref(false)
    const boxesLoading = ref(false)
    const selectedBoxesShipment = ref(null)
    const shipmentBoxes = ref([])

    // 箱子分页
    const boxesPagination = reactive({
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
        const response = await syncAmazonAll()
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

    // 查看箱子列表
    const viewShipmentBoxes = async (shipment) => {
      selectedBoxesShipment.value = shipment
      boxesDialogVisible.value = true
      boxesLoading.value = true
      boxesPagination.page = 1
      boxesPagination.page_size = 20

      await loadShipmentBoxes()
    }

    // 加载货件箱子
    const loadShipmentBoxes = async () => {
      if (!selectedBoxesShipment.value) return

      boxesLoading.value = true
      try {
        const response = await getAmazonInboundPlanBoxes(
          selectedBoxesShipment.value.shipment_id,
          {
            page: boxesPagination.page,
            page_size: boxesPagination.page_size
          }
        )

        if (response.data.status === 'success') {
          const data = response.data.data || {}
          shipmentBoxes.value = data.list || []
          boxesPagination.total = data.total || 0
          boxesPagination.page = data.page || 1
          boxesPagination.page_size = data.page_size || 20
        } else {
          shipmentBoxes.value = []
          boxesPagination.total = 0
          ElMessage.error(response.data.message || '获取箱子列表失败')
        }
      } catch (error) {
        console.error('获取箱子列表失败:', error)
        ElMessage.error('获取箱子列表失败: ' + (error.response?.data?.message || error.message))
        shipmentBoxes.value = []
        boxesPagination.total = 0
      } finally {
        boxesLoading.value = false
      }
    }

    // 箱子分页变化
    const handleBoxesPageChange = (page) => {
      boxesPagination.page = page
      loadShipmentBoxes()
    }

    // 箱子每页数量变化
    const handleBoxesSizeChange = (size) => {
      boxesPagination.page_size = size
      boxesPagination.page = 1
      loadShipmentBoxes()
    }

    // 同步入库计划箱子数据
    const boxesSyncLoading = ref(false)
    const syncInboundPlanBoxes = async () => {
      const planId = shipmentBoxes.value[0]?.inbound_plan_id
      if (!planId) {
        ElMessage.error('未获取到入库计划ID，无法同步')
        return
      }
      boxesSyncLoading.value = true
      try {
        const response = await syncAmazonInboundPlanBoxes(planId)
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '箱子数据同步完成')
          await loadShipmentBoxes()
        } else {
          ElMessage.error(response.data.message || '箱子数据同步失败')
        }
      } catch (error) {
        console.error('同步箱子数据失败:', error)
        ElMessage.error('同步箱子数据失败: ' + (error.response?.data?.message || error.message))
      } finally {
        boxesSyncLoading.value = false
      }
    }

    // 全部展开/收缩箱子
    const allBoxesExpanded = ref(false)
    const boxesTable = ref(null)
    const toggleAllBoxesExpansion = () => {
      allBoxesExpanded.value = !allBoxesExpanded.value
      shipmentBoxes.value.forEach((row) => {
        boxesTable.value.toggleRowExpansion(row, allBoxesExpanded.value)
      })
    }

    // 获取箱子商品列表（优先用 items 字段，兼容 items_json）
    const getBoxItems = (row) => {
      if (row.items && Array.isArray(row.items)) {
        return row.items
      }
      try {
        return JSON.parse(row.items_json || '[]')
      } catch {
        return []
      }
    }

    // 打印箱唛标签
    const printShipmentLabels = async (shipment, boxId = null) => {
      labelsLoading.value = true
      try {
        const response = await getAmazonShipmentLabels(shipment.shipment_id, 'PackageLabel_Thermal_NonPCP', 2, boxId)
        const downloadUrl = response.data?.data?.payload?.DownloadURL
        if (!downloadUrl) {
          ElMessage.error('未获取到箱唛下载链接')
          return
        }
        // S3 预签名 URL 有跨域限制，不能在前端 fetch 获取 blob
        // 直接用 window.open 让浏览器自行下载，避免 CORS 问题
        window.open(downloadUrl, '_blank')
        ElMessage.success('箱唛已打开，请在浏览器新标签页中查看或下载')
      } catch (error) {
        console.error('下载箱唛失败:', error)
        ElMessage.error('下载箱唛失败: ' + (error.message || '未知错误'))
      } finally {
        labelsLoading.value = false
      }
    }

    // 导出发票
    const exportInvoice = async (shipment) => {
      try {
        const response = await exportAmazonShipmentInvoice(shipment.shipment_id)
        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${shipment.shipment_id}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        ElMessage.success('发票导出成功')
      } catch (error) {
        console.error('导出发票失败:', error)
        ElMessage.error('导出发票失败')
      }
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
      labelsLoading,
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
      printShipmentLabels,
      exportInvoice,
      handleItemsPageChange,
      handleItemsSizeChange,
      parsePrepDetails,
      formatDate,
      formatAddress,
      formatFullAddress,
      getStatusType,
      getStatusText,
      // 箱子列表
      boxesDialogVisible,
      boxesLoading,
      selectedBoxesShipment,
      shipmentBoxes,
      boxesPagination,
      viewShipmentBoxes,
      loadShipmentBoxes,
      handleBoxesPageChange,
      handleBoxesSizeChange,
      getBoxItems,
      allBoxesExpanded,
      toggleAllBoxesExpansion,
      boxesTable,
      boxesSyncLoading,
      syncInboundPlanBoxes
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

.boxes-dialog-header {
  margin-bottom: 12px;
  display: flex;
  justify-content: flex-end;
}

/* 箱子展开详情 */
.box-expand-content {
  padding: 12px 24px;
  background-color: #fafafa;
  border-radius: 4px;
}

.box-detail-desc {
  margin-bottom: 12px;
}

.box-items-section {
  margin-top: 12px;
}

.box-items-section h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #333;
  font-weight: 600;
}
</style>
