<template>
  <div class="sku-sales-report-page">
    <!-- 顶部标题区 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:10px;vertical-align:middle;color:#667eea;"><ShoppingCart /></el-icon>
          SKU 销售数据报表
        </h1>
        <p class="page-subtitle">按 SKU 维度汇总每日库存、销量、广告、售价与利润</p>
      </div>
      <div class="header-actions">
        <el-select v-model="selectedShop" placeholder="全部店铺" clearable style="width:160px" @change="handleSearch">
          <el-option label="全部店铺" :value="null" />
          <el-option v-for="shop in shopList" :key="shop.id" :label="shop.shop_name" :value="shop.id" />
        </el-select>
        <el-button type="success" plain :loading="generating" @click="handleGenerateAll">
          <el-icon><Refresh /></el-icon> 全量生成
        </el-button>
      </div>
    </div>

    <!-- 筛选控制区 -->
    <div class="control-panel">
      <div class="control-row">
        <div class="control-group">
          <span class="control-label">搜索</span>
          <el-input v-model="keyword" placeholder="ASIN / SKU / 产品名" clearable style="width:200px" @keyup.enter="handleSearch">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>
        <div class="control-group">
          <span class="control-label">SKU</span>
          <el-input v-model="sku" placeholder="精确 SKU" clearable style="width:150px" @keyup.enter="handleSearch">
            <template #prefix><el-icon><Box /></el-icon></template>
          </el-input>
        </div>
        <div class="control-group">
          <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon> 查询</el-button>
          <el-button plain @click="handleExport"><el-icon><Download /></el-icon> 导出</el-button>
          <el-button plain @click="handleReset"><el-icon><CircleClose /></el-icon> 重置筛选</el-button>
        </div>
        <div class="control-group window-select-group">
          <span class="control-label">选择时间窗口</span>
          <div class="window-chips">
            <button
              v-for="w in allWindows"
              :key="w"
              class="window-chip"
              :class="{ active: selectedWindows.includes(w) }"
              @click="toggleWindow(w)"
            >
              {{ windowLabels[w] }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 汇总指标卡 -->
    <div class="summary-cards">
      <div class="summary-card card-total">
        <div class="card-icon"><el-icon size="26"><Box /></el-icon></div>
        <div class="card-body">
          <div class="card-label">总 SKU</div>
          <div class="card-value">{{ formatNumber(total, 0) }}</div>
        </div>
      </div>
      <div class="summary-card card-stock">
        <div class="card-icon"><el-icon size="26"><OfficeBuilding /></el-icon></div>
        <div class="card-body">
          <div class="card-label">总库存</div>
          <div class="card-value">{{ formatNumber(summary.total_stock, 0) }}</div>
        </div>
      </div>
      <div class="summary-card card-sales">
        <div class="card-icon"><el-icon size="26"><ShoppingCart /></el-icon></div>
        <div class="card-body">
          <div class="card-label">30天总销量</div>
          <div class="card-value">{{ formatNumber(summary.total_sales_30d, 0) }}</div>
          <div class="card-sub">
            广告 {{ formatNumber(summary.total_sales_ad_30d, 0) }} ·
            自然 {{ formatNumber(summary.total_sales_natural_30d, 0) }}
          </div>
        </div>
      </div>
      <div class="summary-card card-revenue">
        <div class="card-icon"><el-icon size="26"><Money /></el-icon></div>
        <div class="card-body">
          <div class="card-label">30天总销售额</div>
          <div class="card-value">${{ formatNumber(summary.total_revenue_30d) }}</div>
          <div class="card-sub">
            广告 ${{ formatNumber(summary.total_ad_revenue_30d) }} ·
            自然 ${{ formatNumber(summary.total_natural_revenue_30d) }}
          </div>
        </div>
      </div>
      <div class="summary-card card-ad">
        <div class="card-icon"><el-icon size="26"><Wallet /></el-icon></div>
        <div class="card-body">
          <div class="card-label">30天广告费</div>
          <div class="card-value">${{ formatNumber(summary.total_ad_cost_30d) }}</div>
          <div class="card-sub">ACOS {{ formatPercent(summary.avg_acos) }} · TACOS {{ formatPercent(summary.avg_tacos) }}</div>
        </div>
      </div>
      <div class="summary-card card-profit">
        <div class="card-icon"><el-icon size="26"><Coin /></el-icon></div>
        <div class="card-body">
          <div class="card-label">30天总利润</div>
          <div class="card-value">${{ formatNumber(summary.total_profit_30d) }}</div>
          <div class="card-sub">平均利润率 {{ formatPercent(summary.avg_profit_rate_30d) }}</div>
        </div>
      </div>
    </div>

    <!-- 表格区：固定高度，底部滚动条始终可见 -->
    <div class="table-section">
      <div class="table-scroll-wrapper">
        <el-table
          :data="list"
          v-loading="loading"
          style="width: 100%"
          height="calc(100vh - 450px)"
          :header-cell-style="headerCellStyle"
          :default-sort="{ prop: 'sales_30d', order: 'descending' }"
          @sort-change="handleSortChange"
          stripe
          border
        >
          <!-- 产品信息：固定左侧 -->
          <el-table-column label="产品信息" fixed="left" align="center" width="220">
            <template #default="scope">
              <div class="product-cell">
                <div class="product-name" :title="scope.row.product_name">{{ scope.row.product_name || '-' }}</div>
                <div class="product-code">{{ scope.row.asin || '-' }} / {{ scope.row.sku || '-' }}</div>
                <div class="product-date">{{ scope.row.report_date || '-' }}</div>
              </div>
            </template>
          </el-table-column>

          <!-- 库存/售价 -->
          <el-table-column label="库存/售价" prop="stock" align="center" width="140" sortable="custom">
            <template #default="scope">
              <div class="mini-card compact">
                <div class="mini-card-row">
                  <span class="mini-card-label">FBA库存</span>
                  <span class="mini-card-value">{{ formatNumber(scope.row.stock, 0) }}</span>
                </div>
                <div class="mini-card-row">
                  <span class="mini-card-label">当前售价</span>
                  <span class="mini-card-value">${{ formatNumber(scope.row.sell_price) }}</span>
                </div>
                <div class="mini-card-row">
                  <span class="mini-card-label">促销价</span>
                  <span class="mini-card-value">${{ formatNumber(scope.row.promo_price) }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 广告效率卡片列 -->
          <el-table-column label="广告效率" prop="acos" align="center" width="160" sortable="custom">
            <template #default="scope">
              <div class="mini-card">
                <div class="mini-card-grid">
                  <div class="mini-card-item">
                    <span class="mini-card-label">CPC</span>
                    <span class="mini-card-value">${{ formatNumber(scope.row.cpc) }}</span>
                  </div>
                  <div class="mini-card-item">
                    <span class="mini-card-label">CVR</span>
                    <span class="mini-card-value">{{ formatPercent(scope.row.cvr) }}</span>
                  </div>
                  <div class="mini-card-item">
                    <span class="mini-card-label">ACOS</span>
                    <span class="mini-card-value" :class="getAcosClass(scope.row.acos)">{{ formatPercent(scope.row.acos) }}</span>
                  </div>
                  <div class="mini-card-item">
                    <span class="mini-card-label">TACOS</span>
                    <span class="mini-card-value">{{ formatPercent(scope.row.tacos) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 销量分析卡片列：每个窗口一列，合并表头 -->
          <el-table-column label="销量" align="center">
            <el-table-column v-for="w in displayWindows" :key="'sales_' + w" :prop="'sales_' + w" :label="windowLabels[w]" align="center" width="140" sortable="custom">
              <template #default="scope">
                <div class="mini-card compact">
                  <div class="mini-card-row">
                    <span class="mini-card-label">总销量</span>
                    <span class="mini-card-value">{{ formatNumber(scope.row['sales_' + w], 0) }}</span>
                  </div>
                  <div class="mini-card-row">
                    <span class="mini-card-label">广告销量</span>
                    <span class="mini-card-value ad">{{ formatNumber(scope.row['sales_ad_' + w], 0) }}</span>
                  </div>
                  <div class="mini-card-row">
                    <span class="mini-card-label">自然销量</span>
                    <span class="mini-card-value natural">{{ formatNumber(scope.row['sales_natural_' + w], 0) }}</span>
                  </div>
                  <div class="mini-card-row">
                    <span class="mini-card-label">广告占比</span>
                    <span class="mini-card-value ratio">{{ formatPercent(getAdRatio(scope.row, 'sales', w)) }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
          </el-table-column>

          <!-- 销售额 -->
          <el-table-column label="销售额" align="center">
            <el-table-column v-for="w in displayWindows" :key="'revenue_' + w" :prop="'total_revenue_' + w" :label="windowLabels[w]" align="center" width="140" sortable="custom">
              <template #default="scope">
                <div class="mini-card compact">
                  <div class="mini-card-row">
                    <span class="mini-card-label">总销售额</span>
                    <span class="mini-card-value">${{ formatNumber(scope.row['total_revenue_' + w]) }}</span>
                  </div>
                  <div class="mini-card-row">
                    <span class="mini-card-label">广告销售额</span>
                    <span class="mini-card-value">${{ formatNumber(scope.row['ad_revenue_' + w]) }}</span>
                  </div>
                  <div class="mini-card-row">
                    <span class="mini-card-label">自然销售额</span>
                    <span class="mini-card-value">${{ formatNumber(scope.row['natural_revenue_' + w]) }}</span>
                  </div>
                  <div class="mini-card-row">
                    <span class="mini-card-label">广告占比</span>
                    <span class="mini-card-value ratio">{{ formatPercent(getAdRatio(scope.row, 'revenue', w)) }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
          </el-table-column>

          <!-- 广告/利润：合并列，每个窗口一列 -->
          <el-table-column label="广告/利润" align="center">
            <el-table-column v-for="w in displayWindows" :key="'ad_profit_' + w" :prop="'profit_' + w" :label="windowLabels[w]" align="center" width="150" sortable="custom">
              <template #default="scope">
                <div class="mini-card compact">
                  <div class="mini-card-row">
                    <span class="mini-card-label">广告费</span>
                    <span class="mini-card-value">${{ formatNumber(scope.row['ad_cost_' + w]) }}</span>
                  </div>
                  <div class="mini-card-row">
                    <span class="mini-card-label">利润</span>
                    <span class="mini-card-value" :class="(scope.row['profit_' + w] || 0) >= 0 ? 'text-profit' : 'text-loss'">${{ formatNumber(scope.row['profit_' + w]) }}</span>
                  </div>
                  <div class="mini-card-row">
                    <span class="mini-card-label">利润率</span>
                    <el-tag :type="getProfitRateTagType(scope.row['profit_rate_' + w])" size="small">{{ formatPercent(scope.row['profit_rate_' + w], 1) }}</el-tag>
                  </div>
                </div>
              </template>
            </el-table-column>
          </el-table-column>

          <!-- 操作：固定右侧 -->
          <el-table-column label="操作" align="center" width="90" fixed="right">
            <template #default="scope">
              <el-button type="primary" link size="small" :loading="scope.row.generating" @click="handleGenerateSingle(scope.row)">生成</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 分页固定在表格下方 -->
      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          class="pagination"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ShoppingCart, Box, OfficeBuilding, Coin, Wallet, Money,
  Search, Refresh, Download, CircleClose
} from '@element-plus/icons-vue'
import {
  getShopOptions,
  getSkuSalesList,
  generateSkuSales,
  generateSkuSalesForSku
} from '@/services/api.js'

export default {
  name: 'SkuSalesReportView',
  components: {
    ShoppingCart, Box, OfficeBuilding, Coin, Wallet, Money,
    Search, Refresh, Download, CircleClose
  },
  setup() {
    const selectedShop = ref(null)
    const shopList = ref([])
    const keyword = ref('')
    const sku = ref('')
    const sortBy = ref('sales_30d')
    const sortDir = ref('desc')
    const page = ref(1)
    const pageSize = ref(20)
    const total = ref(0)
    const list = ref([])
    const loading = ref(false)
    const generating = ref(false)
    const allWindows = ['1d', '3d', '7d', '14d', '30d']
    const selectedWindows = ref(['1d', '7d', '30d'])
    const displayWindows = computed(() => allWindows.filter(w => selectedWindows.value.includes(w)))
    const windowLabels = { '1d': '1天', '3d': '3天', '7d': '7天', '14d': '14天', '30d': '30天' }

    const windows = allWindows

    const toggleWindow = (w) => {
      const idx = selectedWindows.value.indexOf(w)
      if (idx > -1) {
        if (selectedWindows.value.length > 1) {
          selectedWindows.value.splice(idx, 1)
        }
      } else {
        selectedWindows.value.push(w)
        selectedWindows.value.sort((a, b) => allWindows.indexOf(a) - allWindows.indexOf(b))
      }
    }

    const summary = reactive({
      total_stock: 0,
      total_sales_30d: 0,
      total_sales_ad_30d: 0,
      total_sales_natural_30d: 0,
      total_revenue_30d: 0,
      total_ad_revenue_30d: 0,
      total_natural_revenue_30d: 0,
      total_ad_cost_30d: 0,
      total_profit_30d: 0,
      avg_profit_rate_30d: 0,
      avg_acos: 0,
      avg_tacos: 0
    })

    const formatNumber = (val, digits = 2) => {
      if (val === null || val === undefined) return '-'
      const n = Number(val)
      if (isNaN(n)) return '-'
      return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    }

    const formatPercent = (val, digits = 2) => {
      if (val === null || val === undefined || val === '') return '-'
      const n = Number(val)
      if (isNaN(n)) return '-'
      return (n * 100).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + '%'
    }

    const getProfitRateTagType = (rate) => {
      const r = Number(rate) || 0
      if (r >= 0.3) return 'success'
      if (r >= 0.15) return ''
      if (r >= 0.05) return 'warning'
      return 'danger'
    }

    const getAcosClass = (acos) => {
      const a = Number(acos) || 0
      if (a >= 0.4) return 'text-danger'
      if (a >= 0.25) return 'text-warning'
      return 'text-success'
    }

    const getAdRatio = (row, type, w) => {
      if (type === 'sales') {
        const total = Number(row['sales_' + w] || 0)
        const ad = Number(row['sales_ad_' + w] || 0)
        return total > 0 ? ad / total : 0
      } else {
        const adRev = Number(row['ad_revenue_' + w] || 0)
        const totalRev = adRev + Number(row['natural_revenue_' + w] || 0)
        return totalRev > 0 ? adRev / totalRev : 0
      }
    }

    const headerCellStyle = ({ column }) => {
      if (column.children && column.children.length) {
        return { background: '#e8eaf6', color: '#4338ca', fontWeight: 700, fontSize: '13px' }
      }
      return { background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: '12px' }
    }

    const computeSummary = () => {
      const data = list.value
      const s = {
        total_stock: 0,
        total_sales_30d: 0,
        total_sales_ad_30d: 0,
        total_sales_natural_30d: 0,
        total_ad_revenue_30d: 0,
        total_natural_revenue_30d: 0,
        total_ad_cost_30d: 0,
        total_profit_30d: 0,
        profit_rate_sum: 0,
        profit_rate_count: 0,
        acos_sum: 0,
        acos_count: 0,
        tacos_sum: 0,
        tacos_count: 0
      }
      data.forEach(row => {
        s.total_stock += Number(row.stock || 0)
        s.total_sales_30d += Number(row.sales_30d || 0)
        s.total_sales_ad_30d += Number(row.sales_ad_30d || 0)
        s.total_sales_natural_30d += Number(row.sales_natural_30d || 0)
        s.total_ad_revenue_30d += Number(row.ad_revenue_30d || 0)
        s.total_natural_revenue_30d += Number(row.natural_revenue_30d || 0)
        s.total_ad_cost_30d += Number(row.ad_cost_30d || 0)
        s.total_profit_30d += Number(row.profit_30d || 0)
        const rate = Number(row.profit_rate_30d || 0)
        if (rate !== 0 || row.profit_30d !== 0) {
          s.profit_rate_sum += rate
          s.profit_rate_count++
        }
        const acos = Number(row.acos || 0)
        if (acos > 0) { s.acos_sum += acos; s.acos_count++ }
        const tacos = Number(row.tacos || 0)
        if (tacos > 0) { s.tacos_sum += tacos; s.tacos_count++ }
      })
      summary.total_stock = s.total_stock
      summary.total_sales_30d = s.total_sales_30d
      summary.total_sales_ad_30d = s.total_sales_ad_30d
      summary.total_sales_natural_30d = s.total_sales_natural_30d
      summary.total_revenue_30d = s.total_ad_revenue_30d + s.total_natural_revenue_30d
      summary.total_ad_revenue_30d = s.total_ad_revenue_30d
      summary.total_natural_revenue_30d = s.total_natural_revenue_30d
      summary.total_ad_cost_30d = s.total_ad_cost_30d
      summary.total_profit_30d = s.total_profit_30d
      summary.avg_profit_rate_30d = s.profit_rate_count > 0 ? s.profit_rate_sum / s.profit_rate_count : 0
      summary.avg_acos = s.acos_count > 0 ? s.acos_sum / s.acos_count : 0
      summary.avg_tacos = s.tacos_count > 0 ? s.tacos_sum / s.tacos_count : 0
    }

    const fetchShops = async () => {
      try {
        const res = await getShopOptions()
        if (res.data.status === 'success') {
          shopList.value = res.data.data || []
        }
      } catch (e) { console.error(e) }
    }

    const fetchSkuSalesData = async () => {
      loading.value = true
      try {
        const params = {
          keyword: keyword.value,
          sku: sku.value,
          shop_id: selectedShop.value,
          sort_by: sortBy.value,
          sort_dir: sortDir.value,
          page: page.value,
          page_size: pageSize.value
        }
        const res = await getSkuSalesList(params)
        if (res.data.status === 'success') {
          list.value = (res.data.data.list || []).map(row => ({ ...row, generating: false }))
          total.value = res.data.data.total || 0
          computeSummary()
        }
      } catch (e) {
        console.error(e)
        ElMessage.error('获取 SKU 销售数据失败')
      } finally {
        loading.value = false
      }
    }

    const handleSortChange = ({ prop, order }) => {
      if (prop && order) {
        sortBy.value = prop
        sortDir.value = order === 'ascending' ? 'asc' : 'desc'
      } else {
        // 取消排序时恢复默认
        sortBy.value = 'sales_30d'
        sortDir.value = 'desc'
      }
      page.value = 1
      fetchSkuSalesData()
    }

    const handleSearch = () => {
      page.value = 1
      fetchSkuSalesData()
    }

    const handleGenerateAll = async () => {
      generating.value = true
      try {
        const res = await generateSkuSales({ shop_id: selectedShop.value })
        if (res.data.status === 'success') {
          ElMessage.success(res.data.message || 'SKU 销售报表生成完成')
          fetchSkuSalesData()
        }
      } catch (e) {
        console.error(e)
        ElMessage.error('生成失败')
      } finally {
        generating.value = false
      }
    }

    const handleGenerateSingle = async (row) => {
      if (!selectedShop.value) {
        ElMessage.warning('请先选择店铺')
        return
      }
      row.generating = true
      try {
        const res = await generateSkuSalesForSku(row.sku, { shop_id: selectedShop.value })
        if (res.data.status === 'success') {
          ElMessage.success(`${row.sku} 生成完成`)
          fetchSkuSalesData()
        }
      } catch (e) {
        console.error(e)
        ElMessage.error(`${row.sku} 生成失败`)
      } finally {
        row.generating = false
      }
    }

    const handleExport = () => {
      ElMessage.info('导出功能开发中...')
    }

    const handleReset = () => {
      selectedShop.value = null
      keyword.value = ''
      sku.value = ''
      selectedWindows.value = ['1d', '7d', '30d']
      page.value = 1
      sortBy.value = 'sales_30d'
      sortDir.value = 'desc'
      fetchSkuSalesData()
    }

    watch([page, pageSize], () => {
      fetchSkuSalesData()
    })

    onMounted(() => {
      fetchShops()
      fetchSkuSalesData()
    })

    return {
      selectedShop, shopList,
      keyword, sku, sortBy, sortDir,
      page, pageSize, total, list, loading, generating,
      allWindows, selectedWindows, displayWindows, windows, windowLabels, toggleWindow,
      summary,
      formatNumber, formatPercent, getProfitRateTagType, getAcosClass, getAdRatio,
      headerCellStyle,
      fetchSkuSalesData, handleSearch, handleSortChange,
      handleGenerateAll, handleGenerateSingle, handleExport, handleReset
    }
  }
}
</script>

<style scoped>
.sku-sales-report-page {
  padding: 16px 20px 40px;
  background: #f5f7fa;
  min-height: 100vh;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
}

.page-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 控制面板 */
.control-panel {
  background: #fff;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.control-row {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 13px;
  color: #4b5563;
  font-weight: 500;
  white-space: nowrap;
}

/* 汇总卡片 */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}

.summary-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.card-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.card-total .card-icon { background: linear-gradient(135deg, #667eea, #764ba2); }
.card-stock .card-icon { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.card-sales .card-icon { background: linear-gradient(135deg, #f97316, #ea580c); }
.card-revenue .card-icon { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
.card-ad .card-icon { background: linear-gradient(135deg, #f59e0b, #d97706); }
.card-profit .card-icon { background: linear-gradient(135deg, #10b981, #059669); }

.card-body {
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 3px;
}

.card-value {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-sub {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 表格区 */
.table-section {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  overflow: hidden;
}

.table-scroll-wrapper {
  padding: 0;
}

/* 强制 el-table 出现横向滚动条 */
.table-scroll-wrapper :deep(.el-scrollbar__wrap) {
  overflow-x: auto !important;
}

.table-scroll-wrapper :deep(.el-table__body-wrapper) {
  overflow-x: auto !important;
}

.table-scroll-wrapper :deep(.el-table__body-wrapper::-webkit-scrollbar) {
  height: 10px;
}

.table-scroll-wrapper :deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #c0c4cc;
  border-radius: 5px;
}

.table-scroll-wrapper :deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
  background: transparent;
  border-radius: 5px;
}

/* 产品单元格 */
.product-cell {
  line-height: 1.4;
  text-align: left;
  padding: 4px 0;
}

.product-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-code {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.product-date {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

/* 迷你卡片：核心样式 */
.mini-card {
  background: #f8fafc;
  border-radius: 8px;
  padding: 8px;
  border: 1px solid #e2e8f0;
}

.mini-card.compact {
  padding: 6px 8px;
}

.mini-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.mini-card-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.mini-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 2px 0;
}

.mini-card-label {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
}

.mini-card-value {
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
}

.mini-card-value.ad {
  color: #f59e0b;
}

.mini-card-value.natural {
  color: #3b82f6;
}

.mini-card-value.ratio {
  color: #8b5cf6;
}

.text-profit { color: #10b981; }
.text-loss { color: #ef4444; }
.text-success { color: #10b981; }
.text-warning { color: #f59e0b; }
.text-danger { color: #ef4444; }

/* 窗口选择器 */
.window-select-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.window-chips {
  display: flex;
  gap: 6px;
}

.window-chip {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #4b5563;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  outline: none;
}

.window-chip:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.window-chip.active {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
  font-weight: 500;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

/* 分页 */
.pagination-bar {
  flex-shrink: 0;
  padding: 12px 16px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  justify-content: flex-end;
}

/* 响应式 */
@media (max-width: 1400px) {
  .summary-cards { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 768px) {
  .summary-cards { grid-template-columns: repeat(2, 1fr); }
  .page-header { flex-direction: column; align-items: flex-start; gap: 10px; }
  .header-actions { width: 100%; justify-content: flex-end; }
  .control-row { gap: 10px; }
}
</style>
