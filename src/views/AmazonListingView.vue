<template>
  <div class="amazon-listing-page">
    <div class="page-header">
      <h1 class="page-title">Amazon Listing 列表</h1>
      <p class="page-subtitle">查看和管理亚马逊商品 Listing 信息</p>
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
            <el-option value="__refresh__" label="🔄 刷新店铺列表" />
          </el-select>
        </el-form-item>

        <el-form-item label="SKU">
          <el-input
            v-model="searchForm.sku"
            placeholder="精确匹配"
            clearable
            style="width: 160px"
          />
        </el-form-item>

        <el-form-item label="ASIN">
          <el-input
            v-model="searchForm.asin"
            placeholder="精确匹配"
            clearable
            style="width: 160px"
          />
        </el-form-item>

        <el-form-item label="商品类型">
          <el-input
            v-model="searchForm.product_type"
            placeholder="如 MARKING_PEN"
            clearable
            style="width: 160px"
          />
        </el-form-item>

        <el-form-item label="状态">
          <el-select
            v-model="searchForm.status"
            placeholder="选择状态"
            clearable
            style="width: 160px"
          >
            <el-option label="全部" value="" />
            <el-option label="正常在售" value="DISCOVERABLE" />
            <el-option label="被抑制" value="SUPPRESSED" />
            <el-option label="信息不完整" value="INCOMPLETE" />
          </el-select>
        </el-form-item>

        <el-form-item label="父 SKU">
          <el-input
            v-model="searchForm.parent_sku"
            placeholder="精确匹配"
            clearable
            style="width: 160px"
          />
        </el-form-item>

        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="标题/品牌/SKU 模糊搜索"
            clearable
            style="width: 200px"
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
        <h3 class="section-title">Listing 列表</h3>
        <div class="header-actions">
          <el-tooltip
            effect="dark"
            placement="top"
            content="从亚马逊 SP-API 手动同步最新 Listing 数据到本地数据库。"
          >
            <el-button type="warning" @click="syncListings" :loading="syncLoading">
              <el-icon><RefreshRight /></el-icon>
              同步 Listing
            </el-button>
          </el-tooltip>
          <el-button type="primary" @click="refreshData" :loading="loading">
            <el-icon><RefreshRight /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <!-- Listing 列表 -->
      <el-table
        :data="listings"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column label="店铺名称" width="140" show-overflow-tooltip fixed="left">
          <template #default>
            {{ getShopName(selectedShopId) || '-' }}
          </template>
        </el-table-column>

        <el-table-column label="主图" width="80" align="center">
          <template #default="scope">
            <el-image
              v-if="scope.row.main_image_url"
              :src="scope.row.main_image_url"
              :preview-src-list="[scope.row.main_image_url]"
              preview-teleported
              fit="cover"
              style="width: 50px; height: 50px; border-radius: 4px; cursor: pointer"
            />
            <div v-else class="no-image">无图</div>
          </template>
        </el-table-column>

        <el-table-column prop="sku" label="SKU" width="150" show-overflow-tooltip fixed="left">
          <template #default="scope">
            <el-button type="primary" link @click="viewDetail(scope.row)">
              {{ scope.row.sku }}
            </el-button>
          </template>
        </el-table-column>

        <el-table-column prop="asin" label="ASIN" width="120" show-overflow-tooltip />

        <el-table-column prop="item_name" label="商品标题" min-width="240" show-overflow-tooltip />

        <el-table-column prop="brand" label="品牌" width="110" show-overflow-tooltip />

        <el-table-column label="价格" width="110" align="right">
          <template #default="scope">
            <span v-if="scope.row.list_price !== undefined && scope.row.list_price !== null">
              {{ scope.row.list_price }} {{ scope.row.list_price_currency || '' }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="140" align="center">
          <template #default="scope">
            <el-tooltip
              v-if="getStatusList(scope.row.status).length > 1"
              effect="dark"
              :content="getStatusList(scope.row.status).join(', ')"
              placement="top"
            >
              <el-tag :type="getStatusType(scope.row.status)" size="small">
                {{ getStatusText(scope.row.status) }}
              </el-tag>
            </el-tooltip>
            <el-tag v-else :type="getStatusType(scope.row.status)" size="small">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="product_type" label="商品类型" width="140" show-overflow-tooltip />

        <el-table-column prop="parentage_level" label="层级" width="80" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.parentage_level === 'parent'" type="warning" size="small">父体</el-tag>
            <el-tag v-else-if="scope.row.parentage_level === 'child'" type="success" size="small">子体</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>

        <el-table-column prop="parent_sku" label="父 SKU" width="130" show-overflow-tooltip />

        <el-table-column prop="variation_theme" label="变体主题" width="120" show-overflow-tooltip />

        <el-table-column prop="fn_sku" label="FNSKU" width="130" show-overflow-tooltip />

        <el-table-column prop="sync_time" label="同步时间" width="160" align="center">
          <template #default="scope">
            {{ formatDate(scope.row.sync_time) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="170" fixed="right" align="center">
          <template #default="scope">
            <el-tooltip content="查看详情" placement="top">
              <el-button type="primary" link @click="viewDetail(scope.row)">
                <el-icon><View /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="同步到产品" placement="top">
              <el-button
                type="warning"
                link
                :loading="syncToProductLoading === scope.row.sku"
                @click="syncToProduct(scope.row.sku)"
              >
                <el-icon><RefreshRight /></el-icon>
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

    <!-- Listing 详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`Listing 详情 - ${currentListing?.sku}`"
      width="80%"
      :destroy-on-close="true"
    >
      <div v-loading="detailLoading">
        <div v-if="listingDetail" class="listing-detail">
          <!-- 基础信息 -->
          <div class="detail-section">
            <h4>基础信息</h4>
            <el-descriptions :column="3" border>
              <el-descriptions-item label="SKU">{{ listingDetail.sku }}</el-descriptions-item>
              <el-descriptions-item label="ASIN">{{ listingDetail.asin || '-' }}</el-descriptions-item>
              <el-descriptions-item label="FNSKU">{{ listingDetail.fn_sku || '-' }}</el-descriptions-item>
              <el-descriptions-item label="市场ID">{{ listingDetail.marketplace_id || '-' }}</el-descriptions-item>
              <el-descriptions-item label="商品类型">{{ listingDetail.product_type || '-' }}</el-descriptions-item>
              <el-descriptions-item label="状况">{{ listingDetail.condition_type || '-' }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <div class="status-tags">
                  <el-tag
                    v-for="s in getStatusList(listingDetail.status)"
                    :key="s"
                    :type="getSingleStatusType(s)"
                    size="small"
                    style="margin-right: 6px; margin-bottom: 4px"
                  >
                    {{ getSingleStatusText(s) }}
                  </el-tag>
                </div>
              </el-descriptions-item>
              <el-descriptions-item label="层级">
                <el-tag v-if="listingDetail.parentage_level === 'parent'" type="warning" size="small">父体</el-tag>
                <el-tag v-else-if="listingDetail.parentage_level === 'child'" type="success" size="small">子体</el-tag>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="变体主题">{{ listingDetail.variation_theme || '-' }}</el-descriptions-item>
              <el-descriptions-item label="父 SKU">{{ listingDetail.parent_sku || '-' }}</el-descriptions-item>
              <el-descriptions-item label="品牌">{{ listingDetail.brand || '-' }}</el-descriptions-item>
              <el-descriptions-item label="价格">
                <span v-if="listingDetail.list_price !== undefined && listingDetail.list_price !== null">
                  {{ listingDetail.list_price }} {{ listingDetail.list_price_currency || '' }}
                </span>
                <span v-else>-</span>
              </el-descriptions-item>
              <el-descriptions-item label="商品标题" :span="3">{{ listingDetail.item_name || '-' }}</el-descriptions-item>
              <el-descriptions-item label="同步时间">{{ formatDate(listingDetail.sync_time) }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ formatDate(listingDetail.created_at) }}</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ formatDate(listingDetail.updated_at) }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 商品描述 -->
          <div v-if="listingDetail.product_description" class="detail-section">
            <h4>商品描述</h4>
            <div class="description-box">{{ listingDetail.product_description }}</div>
          </div>

          <!-- Issues -->
          <div v-if="listingDetail.issues && listingDetail.issues.length > 0" class="detail-section">
            <h4>问题/警告 ({{ listingDetail.issues.length }})</h4>
            <el-alert
              v-for="(issue, idx) in listingDetail.issues"
              :key="idx"
              :title="issue.message || issue.code || '问题'"
              :type="issue.severity === 'ERROR' ? 'error' : 'warning'"
              :closable="false"
              style="margin-bottom: 8px"
            />
          </div>

          <!-- Bullet Points -->
          <div v-if="listingDetail.bullets && listingDetail.bullets.length > 0" class="detail-section">
            <h4>卖点 ({{ listingDetail.bullets.length }})</h4>
            <el-table :data="listingDetail.bullets" stripe border size="small" style="width: 100%">
              <el-table-column type="index" label="序号" width="60" align="center" />
              <el-table-column prop="content" label="内容" min-width="300" show-overflow-tooltip />
              <el-table-column prop="language_tag" label="语言" width="100" align="center" />
            </el-table>
          </div>

          <!-- 图片列表 -->
          <div v-if="listingDetail.images && listingDetail.images.length > 0" class="detail-section">
            <h4>图片 ({{ listingDetail.images.length }})</h4>
            <div class="image-list">
              <div
                v-for="img in listingDetail.images"
                :key="img.sort_order"
                class="image-item"
              >
                <el-image
                  :src="img.media_location"
                  fit="cover"
                  :preview-src-list="listingDetail.images.map(i => i.media_location)"
                  preview-teleported
                  style="width: 120px; height: 120px; border-radius: 6px"
                />
                <div class="image-label">{{ img.image_type }}</div>
              </div>
            </div>
          </div>

          <!-- Offers -->
          <div v-if="listingDetail.offers && listingDetail.offers.length > 0" class="detail-section">
            <h4>报价信息 ({{ listingDetail.offers.length }})</h4>
            <el-table :data="listingDetail.offers" stripe border size="small" style="width: 100%">
              <el-table-column prop="currency" label="币种" width="80" align="center" />
              <el-table-column prop="audience" label="受众" width="100" align="center" />
              <el-table-column prop="our_price" label="售价" width="120" align="right" />
              <el-table-column prop="start_at" label="开始时间" width="160" align="center">
                <template #default="scope">
                  {{ formatDate(scope.row.start_at) }}
                </template>
              </el-table-column>
              <el-table-column prop="end_at" label="结束时间" width="160" align="center">
                <template #default="scope">
                  {{ formatDate(scope.row.end_at) }}
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- Attributes JSON -->
          <div v-if="listingDetail.attributes_json" class="detail-section">
            <h4>原始属性 (JSON)</h4>
            <el-input
              type="textarea"
              :rows="6"
              :model-value="formatJson(listingDetail.attributes_json)"
              readonly
              resize="none"
            />
          </div>
        </div>
        <el-empty v-else description="暂无详情数据" />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, RefreshRight, View } from '@element-plus/icons-vue'
import {
  getAmazonListings,
  getAmazonListing,
  syncAmazonListings,
  syncListingToProduct
} from '@/services/api.js'
import { useShopCache } from '@/composables/useShopCache'

export default {
  name: 'AmazonListingView',
  components: {
    Search,
    Refresh,
    RefreshRight,
    View
  },
  setup() {
    const loading = ref(false)
    const syncLoading = ref(false)
    const listings = ref([])

    const { shopList, fetchShopList, refreshShopList, getShopName, defaultShopId } = useShopCache()
    const selectedShopId = ref(null)

    // 搜索表单
    const searchForm = reactive({
      sku: '',
      asin: '',
      product_type: '',
      status: '',
      parent_sku: '',
      keyword: ''
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
    const syncToProductLoading = ref(null)
    const currentListing = ref(null)
    const listingDetail = ref(null)

    // 获取 Listing 列表
    const fetchListings = async () => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      loading.value = true
      try {
        const params = {
          shop_id: selectedShopId.value,
          page: pagination.page,
          page_size: pagination.page_size
        }

        if (searchForm.sku) params.sku = searchForm.sku
        if (searchForm.asin) params.asin = searchForm.asin
        if (searchForm.product_type) params.product_type = searchForm.product_type
        if (searchForm.status) params.status = searchForm.status
        if (searchForm.parent_sku) params.parent_sku = searchForm.parent_sku
        if (searchForm.keyword) params.keyword = searchForm.keyword

        const response = await getAmazonListings(params)

        if (response.data.status === 'success') {
          const data = response.data.data || {}
          listings.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取 Listing 列表失败')
          listings.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取 Listing 列表失败:', error)
        ElMessage.error('获取 Listing 列表失败: ' + (error.response?.data?.message || error.message))
        listings.value = []
        pagination.total = 0
      } finally {
        loading.value = false
      }
    }

    // 搜索
    const handleSearch = () => {
      pagination.page = 1
      fetchListings()
    }

    // 重置搜索
    const resetSearch = () => {
      searchForm.sku = ''
      searchForm.asin = ''
      searchForm.product_type = ''
      searchForm.status = ''
      searchForm.parent_sku = ''
      searchForm.keyword = ''
      pagination.page = 1
      pagination.page_size = 20
      fetchListings()
    }

    // 刷新数据
    const refreshData = () => {
      fetchListings()
    }

    // 切换店铺
    const handleShopChange = async (val) => {
      if (val === '__refresh__') {
        await refreshShopList()
        selectedShopId.value = defaultShopId()
        pagination.page = 1
        fetchListings()
        return
      }
      pagination.page = 1
      fetchListings()
    }

    // 同步 Listing
    const syncListings = async () => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncLoading.value = true
      try {
        const response = await syncAmazonListings({
          shop_id: selectedShopId.value,
          included_data: ['summaries', 'attributes', 'issues'],
          page_size: 20
        })
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || 'Listing 同步完成')
          await fetchListings()
        } else {
          ElMessage.error(response.data.message || '同步失败')
        }
      } catch (error) {
        console.error('同步 Listing 失败:', error)
        ElMessage.error('同步 Listing 失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncLoading.value = false
      }
    }

    // 分页变化
    const handlePageChange = (page) => {
      pagination.page = page
      fetchListings()
    }

    // 每页数量变化
    const handleSizeChange = (size) => {
      pagination.page_size = size
      pagination.page = 1
      fetchListings()
    }

    // 查看详情
    const viewDetail = async (row) => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      currentListing.value = row
      detailDialogVisible.value = true
      detailLoading.value = true
      listingDetail.value = null

      try {
        const response = await getAmazonListing(row.sku, selectedShopId.value)
        if (response.data.status === 'success') {
          listingDetail.value = response.data.data || null
        } else {
          ElMessage.error(response.data.message || '获取 Listing 详情失败')
        }
      } catch (error) {
        console.error('获取 Listing 详情失败:', error)
        ElMessage.error('获取 Listing 详情失败: ' + (error.response?.data?.message || error.message))
      } finally {
        detailLoading.value = false
      }
    }

    // 同步 Listing 到产品
    const syncToProduct = async (sku) => {
      if (!selectedShopId.value) {
        ElMessage.warning('请选择店铺')
        return
      }

      syncToProductLoading.value = sku
      try {
        const response = await syncListingToProduct(sku, selectedShopId.value)
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || `产品 ${sku} 已同步`)
        } else {
          ElMessage.error(response.data.message || '同步到产品失败')
        }
      } catch (error) {
        console.error('同步到产品失败:', error)
        ElMessage.error('同步到产品失败: ' + (error.response?.data?.message || error.message))
      } finally {
        syncToProductLoading.value = null
      }
    }

    // 解析状态列表（逗号分隔）
    const getStatusList = (status) => {
      if (!status) return []
      return status.split(',').map(s => s.trim()).filter(Boolean)
    }

    // 单个状态的样式
    const getSingleStatusType = (status) => {
      const typeMap = {
        'BUYABLE': 'success',
        'DISCOVERABLE': 'warning',
        'SUPPRESSED': 'danger',
        'DELETED': 'info',
        'INCOMPLETE': 'warning'
      }
      return typeMap[status] || 'info'
    }

    // 单个状态的文本
    const getSingleStatusText = (status) => {
      const textMap = {
        'BUYABLE': '可购买',
        'DISCOVERABLE': '可发现',
        'SUPPRESSED': '被抑制',
        'DELETED': '已删除',
        'INCOMPLETE': '信息不完整'
      }
      return textMap[status] || status
    }

    // 综合状态样式（列表用，按优先级判断）
    const getStatusType = (status) => {
      const list = getStatusList(status)
      if (list.length === 0) return 'info'
      // 优先级：SUPPRESSED > DELETED > BUYABLE > DISCOVERABLE > 其他
      if (list.includes('SUPPRESSED')) return 'danger'
      if (list.includes('DELETED')) return 'info'
      if (list.includes('BUYABLE')) return 'success'
      if (list.includes('DISCOVERABLE')) return 'warning'
      return 'info'
    }

    // 综合状态文本（列表用）
    const getStatusText = (status) => {
      const list = getStatusList(status)
      if (list.length === 0) return status || '-'
      // 优先级：SUPPRESSED > DELETED > BUYABLE > DISCOVERABLE > 其他
      if (list.includes('SUPPRESSED')) return '被抑制'
      if (list.includes('DELETED')) return '已删除'
      if (list.includes('BUYABLE')) return '正常在售'
      if (list.includes('DISCOVERABLE')) return '仅可发现'
      return list[0]
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return dateString.replace('T', ' ')
    }

    // 格式化 JSON
    const formatJson = (jsonStr) => {
      try {
        const obj = JSON.parse(jsonStr || '{}')
        return JSON.stringify(obj, null, 2)
      } catch {
        return jsonStr || ''
      }
    }

    onMounted(async () => {
      await fetchShopList()
      if (shopList.value.length > 0) {
        selectedShopId.value = defaultShopId()
      }
      fetchListings()
    })

    return {
      loading,
      syncLoading,
      listings,
      searchForm,
      pagination,
      detailDialogVisible,
      detailLoading,
      syncToProductLoading,
      syncToProduct,
      currentListing,
      listingDetail,
      shopList,
      selectedShopId,
      fetchListings,
      handleSearch,
      resetSearch,
      refreshData,
      syncListings,
      handlePageChange,
      handleSizeChange,
      handleShopChange,
      viewDetail,
      getStatusType,
      getStatusText,
      getShopName,
      formatDate,
      formatJson,
      getStatusList,
      getSingleStatusType,
      getSingleStatusText
    }
  }
}
</script>

<style scoped>
.amazon-listing-page {
  max-width: 1500px;
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

.no-image {
  width: 50px;
  height: 50px;
  border-radius: 4px;
  background: #f0f0f0;
  color: #999;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.listing-detail .detail-section {
  margin-top: 20px;
}

.listing-detail .detail-section:first-child {
  margin-top: 0;
}

.listing-detail .detail-section h4 {
  margin-bottom: 12px;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.description-box {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  line-height: 1.6;
  color: #555;
  white-space: pre-wrap;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.image-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.image-label {
  font-size: 12px;
  color: #666;
}

.status-tags {
  display: flex;
  flex-wrap: wrap;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

/* 响应式 */
@media (max-width: 768px) {
  .amazon-listing-page {
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

  .image-list {
    gap: 8px;
  }

  .description-box {
    padding: 10px;
    font-size: 13px;
  }

  .listing-detail .detail-section h4 {
    font-size: 14px;
  }
}
</style>
