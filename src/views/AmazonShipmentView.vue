<template>
  <div class="amazon-shipment-page">
    <div class="page-header">
      <h1 class="page-title">亚马逊货件列表</h1>
      <p class="page-subtitle">查看您的亚马逊FBA货件，查看货件状态和详情</p>
    </div>

    <!-- 搜索和筛选区域 -->
    <div class="search-card">
      <el-form :model="searchForm" :inline="true" class="search-form">
        <el-form-item label="货件编号">
          <el-input
            v-model="searchForm.shipment_confirmation_id"
            placeholder="如 FBA19CDP5H0W"
            clearable
            style="width: 180px"
          />
        </el-form-item>

        <el-form-item label="亚马逊参考号">
          <el-input
            v-model="searchForm.amazon_reference_id"
            placeholder="如 8AAFYNCI"
            clearable
            style="width: 160px"
          />
        </el-form-item>

        <el-form-item label="目标仓库">
          <el-select
            v-model="searchForm.destination_warehouse_id"
            placeholder="选择仓库"
            clearable
            filterable
            style="width: 140px"
          >
            <el-option
              v-for="wh in warehouses"
              :key="wh.warehouse_id"
              :label="wh.warehouse_id"
              :value="wh.warehouse_id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="状态筛选">
          <el-select
            v-model="searchForm.status"
            placeholder="选择状态"
            clearable
            style="width: 140px"
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
        :default-sort="{ prop: 'shipment_sync_time', order: 'descending' }"
      >
        <el-table-column prop="shipment_id" label="货件ID" width="220" fixed="left">
          <template #default="scope">
            <el-button type="primary" link @click="viewShipmentDetail(scope.row)">
              {{ scope.row.shipment_id }}
            </el-button>
          </template>
        </el-table-column>

        <el-table-column prop="shipment_name" label="货件名称" min-width="220" show-overflow-tooltip />

        <el-table-column prop="shipment_confirmation_id" label="货件编号" width="140" />

        <el-table-column prop="amazon_reference_id" label="亚马逊参考号" width="130" />

        <el-table-column prop="destination_warehouse_id" label="目标仓库" width="100" align="center" />
        
        <el-table-column prop="shipment_status" label="状态" width="100" align="center">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.shipment_status)">
              {{ getStatusText(scope.row.shipment_status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="shipment_sync_time" label="同步时间" width="170" align="center">
          <template #default="scope">
            {{ formatDate(scope.row.shipment_sync_time) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="scope">
            <el-tooltip content="货件详情" placement="top">
              <el-button type="primary" link @click="viewShipmentDetail(scope.row)">
                <el-icon><InfoFilled /></el-icon>
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
      <div v-loading="detailLoading">
        <div v-if="shipmentDetailData" class="shipment-detail">
          <!-- 基础信息 -->
          <div class="detail-section">
            <h4>基础信息</h4>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="货件ID">{{ shipmentDetailData.shipment_id }}</el-descriptions-item>
              <el-descriptions-item label="入库计划ID">{{ shipmentDetailData.inbound_plan_id }}</el-descriptions-item>
              <el-descriptions-item label="货件名称">{{ shipmentDetailData.name }}</el-descriptions-item>
              <el-descriptions-item label="货件编号">{{ shipmentDetailData.shipment_confirmation_id || '-' }}</el-descriptions-item>
              <el-descriptions-item label="亚马逊参考号">{{ shipmentDetailData.amazon_reference_id || '-' }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="getStatusType(shipmentDetailData.status)">
                  {{ getStatusText(shipmentDetailData.status) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="目标仓库">{{ shipmentDetailData.destination_warehouse_id || '-' }}</el-descriptions-item>
              <el-descriptions-item label="目标类型">{{ shipmentDetailData.destination_type || '-' }}</el-descriptions-item>
              <el-descriptions-item label="来源类型">{{ shipmentDetailData.source_type || '-' }}</el-descriptions-item>
              <el-descriptions-item label="同步时间">{{ formatDate(shipmentDetailData.sync_time) }}</el-descriptions-item>
              <el-descriptions-item label="Placement Option ID">{{ shipmentDetailData.placement_option_id || '-' }}</el-descriptions-item>
              <el-descriptions-item label="Transportation Option ID">{{ shipmentDetailData.selected_transportation_option_id || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 目的地址 -->
          <div class="detail-section" v-if="parsedDestinationAddress">
            <h4>目的地址</h4>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="名称">{{ parsedDestinationAddress.name || '-' }}</el-descriptions-item>
              <el-descriptions-item label="公司">{{ parsedDestinationAddress.companyName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="地址行1">{{ parsedDestinationAddress.addressLine1 || '-' }}</el-descriptions-item>
              <el-descriptions-item label="地址行2">{{ parsedDestinationAddress.addressLine2 || '-' }}</el-descriptions-item>
              <el-descriptions-item label="城市">{{ parsedDestinationAddress.city || '-' }}</el-descriptions-item>
              <el-descriptions-item label="州/省">{{ parsedDestinationAddress.stateOrProvinceCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="邮编">{{ parsedDestinationAddress.postalCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="国家">{{ parsedDestinationAddress.countryCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="电话">{{ parsedDestinationAddress.phoneNumber || '-' }}</el-descriptions-item>
              <el-descriptions-item label="区县">{{ parsedDestinationAddress.districtOrCounty || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 发货地址 -->
          <div class="detail-section" v-if="parsedSourceAddress">
            <h4>发货地址</h4>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="名称">{{ parsedSourceAddress.name || '-' }}</el-descriptions-item>
              <el-descriptions-item label="公司">{{ parsedSourceAddress.companyName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="地址行1">{{ parsedSourceAddress.addressLine1 || '-' }}</el-descriptions-item>
              <el-descriptions-item label="地址行2">{{ parsedSourceAddress.addressLine2 || '-' }}</el-descriptions-item>
              <el-descriptions-item label="城市">{{ parsedSourceAddress.city || '-' }}</el-descriptions-item>
              <el-descriptions-item label="州/省">{{ parsedSourceAddress.stateOrProvinceCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="邮编">{{ parsedSourceAddress.postalCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="国家">{{ parsedSourceAddress.countryCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="电话">{{ parsedSourceAddress.phoneNumber || '-' }}</el-descriptions-item>
              <el-descriptions-item label="区县">{{ parsedSourceAddress.districtOrCounty || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 配送窗口 -->
          <div class="detail-section" v-if="parsedDeliveryWindow">
            <h4>配送窗口</h4>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="窗口ID">{{ parsedDeliveryWindow.deliveryWindowOptionId || '-' }}</el-descriptions-item>
              <el-descriptions-item label="可用性">{{ parsedDeliveryWindow.availabilityType || '-' }}</el-descriptions-item>
              <el-descriptions-item label="开始时间">{{ formatDate(parsedDeliveryWindow.startDate) }}</el-descriptions-item>
              <el-descriptions-item label="结束时间">{{ formatDate(parsedDeliveryWindow.endDate) }}</el-descriptions-item>
              <el-descriptions-item label="可编辑截止">{{ formatDate(parsedDeliveryWindow.editableUntil) }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 追踪详情 -->
          <div class="detail-section" v-if="parsedTrackingDetails">
            <h4>追踪详情</h4>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="LTL 追踪">
                <pre v-if="hasLtlTracking" class="json-pre">{{ JSON.stringify(parsedTrackingDetails.ltlTrackingDetail, null, 2) }}</pre>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="SPD 追踪">
                <pre v-if="hasSpdTracking" class="json-pre">{{ JSON.stringify(parsedTrackingDetails.spdTrackingDetail, null, 2) }}</pre>
                <span v-else>-</span>
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 日期信息 -->
          <div class="detail-section" v-if="parsedDates && Object.keys(parsedDates).length > 0">
            <h4>日期信息</h4>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="Dates JSON">
                <pre class="json-pre">{{ JSON.stringify(parsedDates, null, 2) }}</pre>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
        <el-empty v-else description="暂无详情数据" />
      </div>
    </el-dialog>

    <!-- 箱子列表对话框 -->
    <el-dialog
      v-model="boxesDialogVisible"
      :title="`箱子列表 - ${selectedBoxesShipment?.shipment_confirmation_id || selectedBoxesShipment?.shipment_id}`"
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
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, RefreshRight, InfoFilled, Box, Printer, Download } from '@element-plus/icons-vue'
import {
  getInboundShipments,
  getInboundShipmentDetail,
  syncInboundShipments,
  getAmazonShipmentLabels,
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
    InfoFilled,
    Box,
    Printer,
    Download
  },
  setup() {
    const loading = ref(false)
    const syncLoading = ref(false)
    const labelsLoading = ref(false)
    const shipments = ref([])
    const warehouses = ref([])

    // 搜索表单
    const searchForm = reactive({
      inbound_plan_id: '',
      shipment_confirmation_id: '',
      amazon_reference_id: '',
      destination_warehouse_id: '',
      status: 'WORKING'
    })

    // 分页状态
    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    // 详情对话框
    const detailDialogVisible = ref(false)
    const detailLoading = ref(false)
    const currentShipment = ref(null)
    const shipmentDetailData = ref(null)

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

        if (searchForm.shipment_confirmation_id) {
          params.shipment_confirmation_id = searchForm.shipment_confirmation_id
        }
        if (searchForm.amazon_reference_id) {
          params.amazon_reference_id = searchForm.amazon_reference_id
        }
        if (searchForm.destination_warehouse_id) {
          params.destination_warehouse_id = searchForm.destination_warehouse_id
        }
        if (searchForm.status) {
          params.status = searchForm.status
        }

        const response = await getInboundShipments(params)

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
      searchForm.shipment_confirmation_id = ''
      searchForm.amazon_reference_id = ''
      searchForm.destination_warehouse_id = ''
      searchForm.status = ''
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
        const response = await syncInboundShipments()
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

    // 查看货件详情
    const viewShipmentDetail = async (shipment) => {
      currentShipment.value = shipment
      detailDialogVisible.value = true
      detailLoading.value = true
      shipmentDetailData.value = null

      try {
        const response = await getInboundShipmentDetail(shipment.shipment_id)
        if (response.data.status === 'success') {
          shipmentDetailData.value = response.data.data || null
        } else {
          ElMessage.error(response.data.message || '获取货件详情失败')
        }
      } catch (error) {
        console.error('获取货件详情失败:', error)
        ElMessage.error('获取货件详情失败: ' + (error.response?.data?.message || error.message))
      } finally {
        detailLoading.value = false
      }
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
          selectedBoxesShipment.value.shipment_confirmation_id,
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
        const response = await getAmazonShipmentLabels(shipment.shipment_confirmation_id, 'PackageLabel_Thermal_NonPCP', 2, boxId)
        const downloadUrl = response.data?.data?.payload?.DownloadURL
        if (!downloadUrl) {
          ElMessage.error('未获取到箱唛下载链接')
          return
        }
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
        const response = await exportAmazonShipmentInvoice(shipment.shipment_confirmation_id)
        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${shipment.shipment_confirmation_id}.xlsx`
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

    // 解析 JSON
    const safeParseJson = (str) => {
      try {
        return JSON.parse(str || '{}')
      } catch {
        return {}
      }
    }

    // 计算属性：解析详情中的 JSON 字段
    const parsedDestinationAddress = computed(() => {
      if (!shipmentDetailData.value?.destination_address_json) return null
      return safeParseJson(shipmentDetailData.value.destination_address_json)
    })

    const parsedSourceAddress = computed(() => {
      if (!shipmentDetailData.value?.source_address_json) return null
      return safeParseJson(shipmentDetailData.value.source_address_json)
    })

    const parsedDeliveryWindow = computed(() => {
      if (!shipmentDetailData.value?.selected_delivery_window_json) return null
      return safeParseJson(shipmentDetailData.value.selected_delivery_window_json)
    })

    const parsedTrackingDetails = computed(() => {
      if (!shipmentDetailData.value?.tracking_details_json) return null
      return safeParseJson(shipmentDetailData.value.tracking_details_json)
    })

    const hasLtlTracking = computed(() => {
      const td = parsedTrackingDetails.value
      return td && td.ltlTrackingDetail && Object.keys(td.ltlTrackingDetail).length > 0
    })

    const hasSpdTracking = computed(() => {
      const td = parsedTrackingDetails.value
      return td && td.spdTrackingDetail && Object.keys(td.spdTrackingDetail).length > 0
    })

    const parsedDates = computed(() => {
      if (!shipmentDetailData.value?.dates_json) return null
      return safeParseJson(shipmentDetailData.value.dates_json)
    })

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return dateString.replace('T', ' ')
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
      shipments,
      warehouses,
      searchForm,
      pagination,
      detailDialogVisible,
      detailLoading,
      currentShipment,
      shipmentDetailData,
      syncLoading,
      labelsLoading,
      fetchShipments,
      handleSearch,
      resetSearch,
      refreshData,
      syncAllData,
      handlePageChange,
      handleSizeChange,
      viewShipmentDetail,
      viewShipmentBoxes,
      printShipmentLabels,
      exportInvoice,
      formatDate,
      getStatusType,
      getStatusText,
      parsedDestinationAddress,
      parsedSourceAddress,
      parsedDeliveryWindow,
      parsedTrackingDetails,
      hasLtlTracking,
      hasSpdTracking,
      parsedDates,
      // 箱子列表
      boxesDialogVisible,
      boxesLoading,
      selectedBoxesShipment,
      shipmentBoxes,
      boxesPagination,
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

.shipment-detail .detail-section {
  margin-top: 20px;
}

.shipment-detail .detail-section h4 {
  margin-bottom: 12px;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.json-pre {
  margin: 0;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
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
