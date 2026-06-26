<template>
  <div class="amazon-order-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><ShoppingCart /></el-icon>
          亚马逊订单列表
        </h1>
        <p class="page-subtitle">查看亚马逊订单状态、详情及商品信息</p>
      </div>
      <div class="header-actions">
        <el-tooltip
          effect="dark"
          placement="top"
          content="从亚马逊卖家后台手动同步最新订单及商品数据。页面数据定时自动更新，如需查看最新订单信息可点击此按钮。"
        >
          <el-button type="warning" @click="syncAllData" :loading="syncLoading">
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
        <el-select
          v-model="searchForm.order_status"
          placeholder="订单状态"
          clearable
          style="width: 140px"
        >
          <el-option label="全部" value="" />
          <el-option label="待处理" value="Pending" />
          <el-option label="未发货" value="Unshipped" />
          <el-option label="部分发货" value="PartiallyShipped" />
          <el-option label="已发货" value="Shipped" />
          <el-option label="发票未确认" value="InvoiceUnconfirmed" />
          <el-option label="已取消" value="Canceled" />
          <el-option label="无法配送" value="Unfulfillable" />
        </el-select>
        <el-input
          v-model="searchForm.amazon_order_id"
          placeholder="亚马逊订单号"
          clearable
          style="width: 180px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-input
          v-model="searchForm.buyer_name"
          placeholder="买家姓名"
          clearable
          style="width: 160px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 260px"
        />
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
        :data="orders"
        v-loading="loading"
        style="width: 100%"
        height="calc(100vh - 296px)"
        :default-sort="{ prop: 'purchase_date', order: 'descending' }"
        row-class-name="order-row"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        :cell-style="{padding:'10px 0'}"
      >
        <el-table-column label="店铺名称" width="140" show-overflow-tooltip fixed="left">
          <template #default>
            <el-tag size="small" effect="plain" type="info">{{ getShopName(selectedShopId) || '-' }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="amazon_order_id" label="订单号" width="170" fixed="left">
          <template #default="scope">
            <el-button type="primary" text size="small" @click="viewOrderDetail(scope.row)">
              {{ scope.row.amazon_order_id }}
            </el-button>
          </template>
        </el-table-column>

        <el-table-column prop="purchase_date" label="下单时间" width="160" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ formatDate(scope.row.purchase_date) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="buyer_name" label="买家姓名" width="130" show-overflow-tooltip>
          <template #default="scope">
            <span style="color:#555;">{{ scope.row.buyer_name }}</span>
          </template>
        </el-table-column>

        <el-table-column label="订单金额" width="120" align="right">
          <template #default="scope">
            <span v-if="scope.row.order_total_amount" class="amount-val">
              {{ scope.row.order_total_amount }} {{ scope.row.order_total_currency_code || '' }}
            </span>
            <span v-else style="color:#bbb;">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="order_status" label="状态" width="110" align="center">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.order_status)" size="small" effect="dark" round>
              {{ getStatusText(scope.row.order_status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="fulfillment_channel" label="配送渠道" width="110" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.fulfillment_channel === 'AFN'" type="success" size="small" effect="plain">FBA</el-tag>
            <el-tag v-else-if="scope.row.fulfillment_channel === 'MFN'" type="info" size="small" effect="plain">自配送</el-tag>
            <span v-else style="color:#bbb;">{{ scope.row.fulfillment_channel || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="SKU明细" min-width="260">
          <template #default="scope">
            <div class="sku-items" v-if="scope.row.items && scope.row.items.length > 0">
              <div v-for="(item, idx) in scope.row.items" :key="idx" class="sku-item">
                <span class="sku-code">{{ item.seller_sku }}</span>
                <span v-if="item.name_cn || item.title" class="sku-name"> - {{ item.name_cn || item.title }}</span>
                <span class="sku-qty"> ×{{ item.quantity_ordered }}</span>
                <span v-if="item.asin" class="sku-asin">({{ item.asin }})</span>
              </div>
            </div>
            <span v-else style="color:#ccc;">—</span>
          </template>
        </el-table-column>

        <el-table-column label="SKU数量" width="100" align="center">
          <template #default="scope">
            <span v-if="scope.row.item_count !== undefined && scope.row.item_count !== null" class="qty-total">
              {{ scope.row.item_count }}
            </span>
            <span v-else style="color:#888;">
              {{ scope.row.number_of_items_shipped || 0 }} / {{ scope.row.number_of_items_unshipped || 0 }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="sync_time" label="同步时间" width="160" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ formatDate(scope.row.sync_time) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="scope">
            <el-tooltip content="订单详情" placement="top">
              <el-button type="primary" link @click="viewOrderDetail(scope.row)">
                <el-icon><View /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="同步该订单商品" placement="top">
              <el-button type="warning" link :loading="syncItemLoading === scope.row.amazon_order_id" @click="syncOrderItems(scope.row)">
                <el-icon><RefreshRight /></el-icon>
              </el-button>
            </el-tooltip>
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

    <!-- 订单详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`订单详情 - ${currentOrder?.amazon_order_id}`"
      width="75%"
      :destroy-on-close="true"
      align-center
    >
      <div v-loading="detailLoading">
        <div v-if="orderDetail" class="order-detail">
          <!-- 基础信息 -->
          <div class="detail-section">
            <h4>基础信息</h4>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="订单号">{{ orderDetail.amazon_order_id }}</el-descriptions-item>
              <el-descriptions-item label="市场ID">{{ orderDetail.marketplace_id || '-' }}</el-descriptions-item>
              <el-descriptions-item label="下单时间">{{ formatDate(orderDetail.purchase_date) }}</el-descriptions-item>
              <el-descriptions-item label="最后更新时间">{{ formatDate(orderDetail.last_update_date) }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="getStatusType(orderDetail.order_status)" size="small" effect="dark" round>
                  {{ getStatusText(orderDetail.order_status) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="配送渠道">
                <el-tag v-if="orderDetail.fulfillment_channel === 'AFN'" type="success" size="small" effect="plain">FBA</el-tag>
                <el-tag v-else-if="orderDetail.fulfillment_channel === 'MFN'" type="info" size="small" effect="plain">自配送</el-tag>
                <span v-else>{{ orderDetail.fulfillment_channel || '-' }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="订单类型">{{ orderDetail.order_type || '-' }}</el-descriptions-item>
              <el-descriptions-item label="配送服务">{{ orderDetail.shipment_service_level_category || '-' }}</el-descriptions-item>
              <el-descriptions-item label="支付方式">{{ orderDetail.payment_method || '-' }}</el-descriptions-item>
              <el-descriptions-item label="订单金额">
                <span v-if="orderDetail.order_total_amount" class="amount-val">
                  {{ orderDetail.order_total_amount }} {{ orderDetail.order_total_currency_code || '' }}
                </span>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="已发货 / 未发货">
                {{ orderDetail.number_of_items_shipped || 0 }} / {{ orderDetail.number_of_items_unshipped || 0 }}
              </el-descriptions-item>
              <el-descriptions-item label="买家邮箱">{{ orderDetail.buyer_email || '-' }}</el-descriptions-item>
              <el-descriptions-item label="买家姓名">{{ orderDetail.buyer_name || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 订单标志 -->
          <div class="detail-section">
            <h4>订单标志</h4>
            <div class="flag-tags">
              <el-tag v-if="orderDetail.is_business_order" type="warning" size="small">企业订单</el-tag>
              <el-tag v-if="orderDetail.is_prime" type="success" size="small">Prime</el-tag>
              <el-tag v-if="orderDetail.is_premium_order" type="danger" size="small">Premium</el-tag>
              <el-tag v-if="orderDetail.is_global_express_enabled" type="info" size="small">全球快递</el-tag>
              <el-tag v-if="orderDetail.is_access_point_order" type="info" size="small">自提点</el-tag>
              <el-tag v-if="orderDetail.is_sold_by_ab" type="info" size="small">SoldByAB</el-tag>
              <el-tag v-if="orderDetail.is_iba" type="info" size="small">IBA</el-tag>
              <span v-if="!hasAnyFlag(orderDetail)" class="text-muted">无特殊标志</span>
            </div>
          </div>

          <!-- 收货地址 -->
          <div class="detail-section">
            <h4>收货地址</h4>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="收件人">{{ orderDetail.shipping_name || '-' }}</el-descriptions-item>
              <el-descriptions-item label="地址">{{ orderDetail.shipping_address_line1 || '-' }}</el-descriptions-item>
              <el-descriptions-item label="城市">{{ orderDetail.shipping_city || '-' }}</el-descriptions-item>
              <el-descriptions-item label="州/省">{{ orderDetail.shipping_state_or_region || '-' }}</el-descriptions-item>
              <el-descriptions-item label="邮编">{{ orderDetail.shipping_postal_code || '-' }}</el-descriptions-item>
              <el-descriptions-item label="国家">{{ orderDetail.shipping_country_code || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 时间信息 -->
          <div class="detail-section">
            <h4>时间信息</h4>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="最早发货日期">{{ formatDate(orderDetail.earliest_ship_date) }}</el-descriptions-item>
              <el-descriptions-item label="最晚发货日期">{{ formatDate(orderDetail.latest_ship_date) }}</el-descriptions-item>
              <el-descriptions-item label="订单同步时间">{{ formatDate(orderDetail.sync_time) }}</el-descriptions-item>
              <el-descriptions-item label="商品同步时间">{{ formatDate(orderDetail.items_sync_time) }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 商品列表 -->
          <div class="detail-section">
            <div class="items-header">
              <h4>商品列表</h4>
              <el-button
                type="warning"
                size="small"
                :loading="syncItemLoading === currentOrder?.amazon_order_id"
                @click="syncOrderItems(currentOrder)"
              >
                <el-icon><RefreshRight /></el-icon>
                同步该订单商品
              </el-button>
            </div>
            <el-table
              v-if="orderDetail.items && orderDetail.items.length > 0"
              :data="orderDetail.items"
              stripe
              border
              style="width: 100%"
              size="small"
            >
              <el-table-column prop="order_item_id" label="订单商品ID" width="140" />
              <el-table-column prop="asin" label="ASIN" width="120" />
              <el-table-column prop="seller_sku" label="SKU" width="140" />
              <el-table-column prop="title" label="商品标题" min-width="200" show-overflow-tooltip />
              <el-table-column prop="quantity_ordered" label="订购数" width="80" align="center" />
              <el-table-column prop="quantity_shipped" label="已发数" width="80" align="center" />
              <el-table-column label="商品金额" width="110" align="right">
                <template #default="scope">
                  <span v-if="scope.row.item_price_amount">
                    {{ scope.row.item_price_amount }} {{ scope.row.item_price_currency_code || '' }}
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="运费" width="100" align="right">
                <template #default="scope">
                  <span v-if="scope.row.shipping_price_amount">
                    {{ scope.row.shipping_price_amount }} {{ scope.row.shipping_price_currency_code || '' }}
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="condition_id" label="成色" width="90" />
              <el-table-column prop="condition_subtype_id" label="成色子类" width="100" />
              <el-table-column prop="price_designation" label="价格类型" width="110" />
              <el-table-column label="本地产品" min-width="160" show-overflow-tooltip>
                <template #default="scope">
                  <div v-if="scope.row.local_product_name">
                    <div>{{ scope.row.local_product_name }}</div>
                    <div class="text-muted" style="font-size: 12px;">
                      {{ scope.row.declare_name_cn || scope.row.declare_name_en || '' }}
                    </div>
                  </div>
                  <span v-else class="text-muted">-</span>
                </template>
              </el-table-column>
              <el-table-column label="买家取消" width="100" align="center">
                <template #default="scope">
                  <el-tag v-if="scope.row.buyer_requested_cancel" type="danger" size="small">已取消</el-tag>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="促销ID" min-width="140" show-overflow-tooltip>
                <template #default="scope">
                  {{ formatJsonArray(scope.row.promotion_ids) }}
                </template>
              </el-table-column>
              <el-table-column prop="sync_time" label="同步时间" width="160" align="center">
                <template #default="scope">
                  {{ formatDate(scope.row.sync_time) }}
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无商品数据" />
          </div>
        </div>
        <el-empty v-else description="暂无详情数据" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useListQuerySync } from '@/composables/useListQuerySync.js'
import { ElMessage } from 'element-plus'
import { Search, Refresh, RefreshRight, View, ShoppingCart } from '@element-plus/icons-vue'
import {
  getAmazonOrders,
  getAmazonOrder,
  syncAmazonOrdersAll,
  syncAmazonOrderItems
} from '@/services/api.js'
import { useShopCache } from '@/composables/useShopCache'

export default {
  name: 'AmazonOrderView',
  components: {
    Search,
    Refresh,
    RefreshRight,
    View,
    ShoppingCart
  },
  setup() {
    const loading = ref(false)
    const syncLoading = ref(false)
    const syncItemLoading = ref(null)
    const orders = ref([])

    const { shopList, fetchShopList, refreshShopList, getShopName, defaultShopId } = useShopCache()
    const selectedShopId = ref(null)

    // 搜索表单
    const searchForm = reactive({
      order_status: '',
      amazon_order_id: '',
      buyer_name: ''
    })

    const dateRange = ref(null)

    // 分页状态
    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    const { initFromQuery, syncQuery, watchQuery } = useListQuerySync({
      page: { get: () => pagination.page, set: v => pagination.page = v, type: 'number', default: 1 },
      page_size: { get: () => pagination.page_size, set: v => pagination.page_size = v, type: 'number', default: 20 },
      order_status: { get: () => searchForm.order_status, set: v => searchForm.order_status = v },
      amazon_order_id: { get: () => searchForm.amazon_order_id, set: v => searchForm.amazon_order_id = v },
      buyer_name: { get: () => searchForm.buyer_name, set: v => searchForm.buyer_name = v },
      purchase_date_from: { get: () => dateRange.value?.[0] || '', set: v => { if (!dateRange.value) dateRange.value = [null, null]; dateRange.value[0] = v || null } },
      purchase_date_to: { get: () => dateRange.value?.[1] || '', set: v => { if (!dateRange.value) dateRange.value = [null, null]; dateRange.value[1] = v || null } }
    })

    // 详情对话框
    const detailDialogVisible = ref(false)
    const detailLoading = ref(false)
    const currentOrder = ref(null)
    const orderDetail = ref(null)

    // 获取订单列表
    const fetchOrders = async () => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncQuery()
      loading.value = true
      try {
        const params = {
          shop_id: selectedShopId.value,
          page: pagination.page,
          page_size: pagination.page_size
        }

        if (searchForm.order_status) {
          params.order_status = searchForm.order_status
        }
        if (searchForm.amazon_order_id) {
          params.amazon_order_id = searchForm.amazon_order_id
        }
        if (searchForm.buyer_name) {
          params.buyer_name = searchForm.buyer_name
        }
        if (dateRange.value && dateRange.value.length === 2) {
          params.purchase_date_from = dateRange.value[0]
          params.purchase_date_to = dateRange.value[1]
        }

        const response = await getAmazonOrders(params)

        if (response.data.status === 'success') {
          const data = response.data.data || {}
          orders.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取订单列表失败')
          orders.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取订单列表失败:', error)
        ElMessage.error('获取订单列表失败: ' + (error.response?.data?.message || error.message))
        orders.value = []
        pagination.total = 0
      } finally {
        loading.value = false
      }
    }

    // 搜索
    const handleSearch = () => {
      pagination.page = 1
      fetchOrders()
    }

    // 重置搜索
    const resetSearch = () => {
      searchForm.order_status = ''
      searchForm.amazon_order_id = ''
      searchForm.buyer_name = ''
      dateRange.value = null
      pagination.page = 1
      pagination.page_size = 20
      fetchOrders()
    }

    // 刷新数据
    const refreshData = () => {
      fetchOrders()
    }

    // 获取7天前的 UTC ISO8601 时间字符串（如 2026-05-01T00:00:00Z）
    const getSevenDaysAgoISO = () => {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - 7)
      d.setUTCHours(0, 0, 0, 0)
      return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
    }

    // 切换店铺
    const handleShopChange = async (val) => {
      if (val === '__refresh__') {
        await refreshShopList()
        selectedShopId.value = defaultShopId()
        pagination.page = 1
        fetchOrders()
        return
      }
      pagination.page = 1
      fetchOrders()
    }

    // 一键全量同步
    const syncAllData = async () => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncLoading.value = true
      try {
        const response = await syncAmazonOrdersAll({
          shop_id: selectedShopId.value,
          created_after: getSevenDaysAgoISO()
        })
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '订单全量同步完成')
          await fetchOrders()
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

    // 同步指定订单商品
    const syncOrderItems = async (order) => {
      if (!order) return
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }
      syncItemLoading.value = order.amazon_order_id
      try {
        const response = await syncAmazonOrderItems(order.amazon_order_id, { shop_id: selectedShopId.value })
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '订单商品同步完成')
          // 如果在详情弹窗中，刷新详情
          if (detailDialogVisible.value && currentOrder.value?.amazon_order_id === order.amazon_order_id) {
            await loadOrderDetail(order.amazon_order_id)
          }
        } else {
          ElMessage.error(response.data.message || '订单商品同步失败')
        }
      } catch (error) {
        console.error('同步订单商品失败:', error)
        ElMessage.error('同步订单商品失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncItemLoading.value = null
      }
    }

    // 分页变化
    const handlePageChange = (page) => {
      pagination.page = page
      fetchOrders()
    }

    // 每页数量变化
    const handleSizeChange = (size) => {
      pagination.page_size = size
      pagination.page = 1
      fetchOrders()
    }

    // 查看订单详情
    const viewOrderDetail = async (order) => {
      currentOrder.value = order
      detailDialogVisible.value = true
      detailLoading.value = true
      orderDetail.value = null

      await loadOrderDetail(order.amazon_order_id)
    }

    const loadOrderDetail = async (orderId) => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }
      try {
        const response = await getAmazonOrder(orderId, selectedShopId.value)
        if (response.data.status === 'success') {
          orderDetail.value = response.data.data || null
        } else {
          ElMessage.error(response.data.message || '获取订单详情失败')
        }
      } catch (error) {
        console.error('获取订单详情失败:', error)
        ElMessage.error('获取订单详情失败: ' + (error.response?.data?.message || error.message))
      } finally {
        detailLoading.value = false
      }
    }

    // 状态样式
    const getStatusType = (status) => {
      const typeMap = {
        'Pending': 'warning',
        'Unshipped': 'danger',
        'PartiallyShipped': 'info',
        'Shipped': 'success',
        'InvoiceUnconfirmed': 'info',
        'Canceled': 'danger',
        'Unfulfillable': 'danger'
      }
      return typeMap[status] || 'info'
    }

    const getStatusText = (status) => {
      const textMap = {
        'Pending': '待处理',
        'Unshipped': '未发货',
        'PartiallyShipped': '部分发货',
        'Shipped': '已发货',
        'InvoiceUnconfirmed': '发票未确认',
        'Canceled': '已取消',
        'Unfulfillable': '无法配送'
      }
      return textMap[status] || status
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return dateString.replace('T', ' ')
    }

    // 格式化 JSON 数组字符串
    const formatJsonArray = (str) => {
      try {
        const arr = JSON.parse(str || '[]')
        return Array.isArray(arr) ? arr.join(', ') : str || '-'
      } catch {
        return str || '-'
      }
    }

    // 判断订单是否有任何标志
    const hasAnyFlag = (order) => {
      return !!(
        order.is_business_order ||
        order.is_prime ||
        order.is_premium_order ||
        order.is_global_express_enabled ||
        order.is_access_point_order ||
        order.is_sold_by_ab ||
        order.is_iba
      )
    }

    watchQuery(() => fetchOrders())

    onMounted(async () => {
      await fetchShopList()
      if (shopList.value.length > 0) {
        selectedShopId.value = defaultShopId()
      }
      initFromQuery()
      fetchOrders()
    })

    return {
      loading,
      syncLoading,
      syncItemLoading,
      orders,
      searchForm,
      dateRange,
      pagination,
      detailDialogVisible,
      detailLoading,
      currentOrder,
      orderDetail,
      shopList,
      selectedShopId,
      fetchOrders,
      handleSearch,
      resetSearch,
      refreshData,
      syncAllData,
      syncOrderItems,
      handlePageChange,
      handleSizeChange,
      handleShopChange,
      viewOrderDetail,
      loadOrderDetail,
      getStatusType,
      getStatusText,
      getShopName,
      formatDate,
      formatJsonArray,
      hasAnyFlag
    }
  }
}
</script>

<style scoped>
.amazon-order-page {
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
:deep(.order-row:hover) { background-color: #fafbff !important; }

/* 金额 */
.amount-val { font-weight: 700; color: #1a1a2e; font-size: 14px; }
.qty-total { color: #1a1a2e; font-weight: 700; font-size: 14px; }

/* 分页 */
.pagination-wrap {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
}

.order-detail .detail-section {
  margin-top: 20px;
}

.order-detail .detail-section:first-child {
  margin-top: 0;
}

.order-detail .detail-section h4 {
  margin-bottom: 12px;
  color: #1a1a2e;
  font-size: 16px;
  font-weight: 600;
}

.flag-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0;
}

.text-muted {
  color: #999;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .amazon-order-page {
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
  .order-detail .detail-section h4 {
    font-size: 14px;
  }
  .items-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

/* SKU明细列 */
.sku-items {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sku-item {
  font-size: 13px;
  line-height: 1.5;
  white-space: nowrap;
}

.sku-code {
  color: #1f2937;
  font-weight: 600;
  font-family: monospace;
}

.sku-name {
  color: #6b7280;
}

.sku-qty {
  color: #667eea;
  font-family: monospace;
  font-weight: 500;
}

.sku-asin {
  color: #9ca3af;
  font-size: 11px;
  margin-left: 4px;
}
</style>
