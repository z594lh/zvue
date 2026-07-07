<template>
  <div class="report-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><DataLine /></el-icon>
          数据报表中心
        </h1>
        <p class="page-subtitle">经营分析 · SKU利润 · 库存周转 · 一站掌握</p>
      </div>
      <div class="header-actions">
        <el-select v-model="selectedShop" placeholder="全部店铺" clearable style="width:160px" @change="handleShopChange">
          <el-option label="全部店铺" :value="null" />
          <el-option v-for="shop in shopList" :key="shop.id" :label="shop.shop_name" :value="shop.id" />
        </el-select>
        <el-button type="primary" :loading="generating" @click="handleGenerateYesterday">
          <el-icon><Refresh /></el-icon> 一键生成昨日报表
        </el-button>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="tab-bar">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <el-icon size="18"><component :is="tab.icon" /></el-icon>
        <span>{{ tab.label }}</span>
      </div>
    </div>

    <!-- ========== 经营报表 ========== -->
    <div v-show="activeTab === 'business'" class="tab-content">
      <!-- data_status 提示 -->
      <div class="status-hint">
        <el-icon style="color:#909399;margin-right:6px;"><InfoFilled /></el-icon>
        每行含 data_status 字段: estimated=预估 / partial=部分结算 / settled=已结算
      </div>
      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-radio-group v-model="businessFilter.type" @change="handleBusinessTypeChange">
          <el-radio-button label="daily">日报</el-radio-button>
          <el-radio-button label="weekly">周报</el-radio-button>
          <el-radio-button label="monthly">月报</el-radio-button>
        </el-radio-group>
        <div class="date-range-pickers">
          <el-date-picker
            v-model="businessDateRange[0]"
            type="date"
            placeholder="开始日期"
            value-format="YYYY-MM-DD"
            class="date-start-picker"
            @change="onStartDateChange"
          />
          <span class="date-separator">~</span>
          <el-date-picker
            v-model="businessDateRange[1]"
            type="date"
            placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="date-end-picker"
            @change="onEndDateChange"
          />
        </div>
        <el-button type="primary" @click="fetchBusinessData"><el-icon><Search /></el-icon> 查询</el-button>
        <el-button plain @click="exportBusiness"><el-icon><Download /></el-icon> 导出</el-button>
      </div>

      <!-- 汇总卡片 -->
      <div class="summary-cards business-summary">
        <div class="summary-card card-sales">
          <div class="card-icon"><el-icon size="28"><Money /></el-icon></div>
          <div class="card-body">
            <div class="card-label">销售额</div>
            <div class="card-value">${{ formatNumber(businessSummary.sum_sales) }}</div>
            <div class="card-sub">共 {{ businessSummary.record_count || 0 }} 条记录</div>
          </div>
        </div>
        <div class="summary-card card-cost">
          <div class="cost-header">
            <div class="card-icon"><el-icon size="28"><Wallet /></el-icon></div>
            <div class="card-body">
              <div class="card-label">成本</div>
              <div class="card-value">${{ formatNumber(businessSummary.sum_total_cost) }}</div>
            </div>
          </div>
          <div class="cost-treemap">
            <div
              v-for="item in costTreemapItems"
              :key="item.key"
              class="cost-treemap-item"
              :class="'cost-' + item.key"
              :style="{ flex: item.flex }"
              :title="`${item.name}: $${formatNumber(item.value)} (${item.percent}%)`"
            >
              <div class="cost-treemap-name">{{ item.name }}</div>
              <div class="cost-treemap-value">${{ formatNumber(item.value) }}</div>
              <div class="cost-treemap-percent">{{ item.percent }}%</div>
            </div>
          </div>
        </div>
        <div class="summary-card card-profit">
          <div class="card-icon"><el-icon size="28"><Coin /></el-icon></div>
          <div class="card-body">
            <div class="card-label">利润</div>
            <div class="card-value">${{ formatNumber(businessSummary.sum_gross_profit) }}</div>
            <div class="card-sub">利润率 {{ (businessSummary.sum_sales > 0 ? ((businessSummary.sum_gross_profit || 0) / businessSummary.sum_sales * 100).toFixed(1) : 0) }}%</div>
          </div>
        </div>
        <div class="summary-card card-order">
          <div class="card-icon"><el-icon size="28"><ShoppingCart /></el-icon></div>
          <div class="card-body">
            <div class="card-label">订单数</div>
            <div class="card-value">{{ formatNumber(businessSummary.sum_orders, 0) }}</div>
            <div class="card-sub">平均 {{ businessSummary.record_count ? ((businessSummary.sum_orders || 0) / businessSummary.record_count).toFixed(0) : 0 }} 单/天</div>
          </div>
        </div>
      </div>

      <!-- 数据表格 -->
      <div class="table-card">
        <div class="chart-header">
          <h3><el-icon><List /></el-icon> 经营数据明细</h3>
        </div>
        <el-table :data="businessList" v-loading="businessLoading" style="width:100%" :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}">
          <el-table-column label="周期" width="140">
            <template #default="scope">
              {{ scope.row.report_date || scope.row.report_week || scope.row.report_month || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="数据状态" width="110" align="center">
            <template #default="scope">
              <el-tag :type="getDataStatusType(scope.row.data_status)" size="small">
                {{ getDataStatusLabel(scope.row.data_status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="total_sales" label="销售额" align="right" width="120">
            <template #default="scope">${{ formatNumber(scope.row.total_sales) }}</template>
          </el-table-column>
          <el-table-column prop="total_cost" label="总成本" align="right" width="120">
            <template #default="scope">${{ formatNumber(scope.row.total_cost) }}</template>
          </el-table-column>
          <el-table-column prop="gross_profit" label="毛利" align="right" width="120">
            <template #default="scope">
              <span :class="scope.row.gross_profit >= 0 ? 'text-profit' : 'text-loss'">
                ${{ formatNumber(scope.row.gross_profit) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="gross_profit_rate" label="毛利率" align="right" width="100">
            <template #default="scope">
              <el-tag :type="getProfitRateTagType(scope.row.gross_profit_rate)" size="small">
                {{ ((scope.row.gross_profit_rate || 0) * 100).toFixed(1) }}%
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="ad_cost" label="广告费" align="right" width="110">
            <template #default="scope">${{ formatNumber(scope.row.ad_cost) }}</template>
          </el-table-column>
          <el-table-column prop="fba_fees" label="FBA费" align="right" width="110">
            <template #default="scope">
              <span :class="{ 'text-muted': scope.row.data_status === 'settled' || scope.row.data_status === 'partial' }">${{ formatNumber(scope.row.fba_fees) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="platform_fees" label="平台佣金" align="right" width="110">
            <template #default="scope">
              <span :class="{ 'text-muted': scope.row.data_status === 'settled' || scope.row.data_status === 'partial' }">${{ formatNumber(scope.row.platform_fees) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="product_cost" label="产品成本" align="right" width="110">
            <template #default="scope">${{ formatNumber(scope.row.product_cost) }}</template>
          </el-table-column>
          <el-table-column prop="headway_cost" label="头程" align="right" width="110">
            <template #default="scope">${{ formatNumber(scope.row.headway_cost) }}</template>
          </el-table-column>
          <el-table-column prop="refund_amount" label="退款" align="right" width="110">
            <template #default="scope">${{ formatNumber(scope.row.refund_amount) }}</template>
          </el-table-column>
          <el-table-column prop="order_count" label="订单" align="right" width="80" />
          <el-table-column prop="sku_count" label="SKU" align="right" width="80" />
        </el-table>
        <el-pagination
          v-model:current-page="businessPage"
          v-model:page-size="businessPageSize"
          :total="businessTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          class="pagination"
        />
      </div>

      <!-- 趋势图 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3><el-icon><TrendCharts /></el-icon> 经营趋势</h3>
          <el-radio-group v-model="trendMetric" size="small" @change="updateTrendChart">
            <el-radio-button label="sales">销售额</el-radio-button>
            <el-radio-button label="profit">毛利</el-radio-button>
            <el-radio-button label="profit_rate">毛利率</el-radio-button>
          </el-radio-group>
        </div>
        <div ref="trendChartRef" class="chart-body" style="height:320px;"></div>
      </div>

      <!-- 成本构成 & 利润结构 -->
      <div class="chart-row">
        <div class="chart-card half">
          <div class="chart-header"><h3><el-icon><PieChart /></el-icon> 成本构成分析</h3></div>
          <div ref="costPieChartRef" class="chart-body" style="height:280px;"></div>
        </div>
        <div class="chart-card half">
          <div class="chart-header"><h3><el-icon><DataAnalysis /></el-icon> 利润结构对比</h3></div>
          <div ref="profitBarChartRef" class="chart-body" style="height:280px;"></div>
        </div>
      </div>
    </div>

    <!-- ========== SKU 利润 ========== -->
    <div v-show="activeTab === 'sku-profit'" class="tab-content">
      <div class="filter-bar">
        <div class="date-range-pickers">
          <el-date-picker
            v-model="skuDateRange[0]"
            type="date"
            placeholder="开始日期"
            value-format="YYYY-MM-DD"
            class="date-start-picker"
            @change="onSkuStartDateChange"
          />
          <span class="date-separator">~</span>
          <el-date-picker
            v-model="skuDateRange[1]"
            type="date"
            placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="date-end-picker"
            @change="onSkuEndDateChange"
          />
        </div>
        <el-input v-model="skuKeyword" placeholder="搜索 ASIN / SKU / 产品名" clearable style="width:240px" @keyup.enter="fetchSkuData">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="fetchSkuData"><el-icon><Search /></el-icon> 查询</el-button>
        <el-button plain @click="exportSkuProfit"><el-icon><Download /></el-icon> 导出</el-button>
      </div>

      <!-- TOP 汇总卡片 -->
      <div class="summary-cards sku-summary">
        <div class="summary-card card-sku-orders">
          <div class="card-icon"><el-icon size="28"><ShoppingCart /></el-icon></div>
          <div class="card-body">
            <div class="card-label">订单数前三 SKU</div>
            <div class="top-sku-list">
              <div v-for="(item, idx) in topOrderSkus" :key="idx" class="top-sku-item">
                <span class="top-sku-rank">{{ idx + 1 }}</span>
                <span class="top-sku-name" :title="`${item.sku || '-'} - ${item.product_name || '-'}`">
                  {{ item.sku || '-' }} - {{ item.product_name || '-' }}
                </span>
                <span class="top-sku-value">{{ formatNumber(item.sales_qty, 0) }}</span>
              </div>
              <div v-if="!topOrderSkus.length" class="top-sku-empty">暂无数据</div>
            </div>
          </div>
        </div>
        <div class="summary-card card-sku-sales">
          <div class="card-icon"><el-icon size="28"><Money /></el-icon></div>
          <div class="card-body">
            <div class="card-label">销售额前三 SKU</div>
            <div class="top-sku-list">
              <div v-for="(item, idx) in topSalesSkus" :key="idx" class="top-sku-item">
                <span class="top-sku-rank">{{ idx + 1 }}</span>
                <span class="top-sku-name" :title="`${item.sku || '-'} - ${item.product_name || '-'}`">
                  {{ item.sku || '-' }} - {{ item.product_name || '-' }}
                </span>
                <span class="top-sku-value">${{ formatNumber(item.sales_amount) }}</span>
              </div>
              <div v-if="!topSalesSkus.length" class="top-sku-empty">暂无数据</div>
            </div>
          </div>
        </div>
        <div class="summary-card card-sku-profit">
          <div class="card-icon"><el-icon size="28"><Coin /></el-icon></div>
          <div class="card-body">
            <div class="card-label">利润前三 SKU</div>
            <div class="top-sku-list">
              <div v-for="(item, idx) in topProfitSkus" :key="idx" class="top-sku-item">
                <span class="top-sku-rank">{{ idx + 1 }}</span>
                <span class="top-sku-name" :title="`${item.sku || '-'} - ${item.product_name || '-'}`">
                  {{ item.sku || '-' }} - {{ item.product_name || '-' }}
                </span>
                <span class="top-sku-value">${{ formatNumber(item.net_profit) }}</span>
              </div>
              <div v-if="!topProfitSkus.length" class="top-sku-empty">暂无数据</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 数据表格 -->
      <div class="table-card">
        <div class="chart-header"><h3><el-icon><List /></el-icon> SKU 利润明细</h3></div>
        <el-table :data="skuList" v-loading="skuLoading" style="width:100%" :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}">
          <el-table-column label="产品" min-width="240">
            <template #default="scope">
              <div class="product-cell-simple">
                <div class="product-name">{{ scope.row.product_name || '-' }}</div>
                <div class="product-code">{{ scope.row.asin }} / {{ scope.row.sku }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="sales_qty" label="销量" align="right" width="80" />
          <el-table-column prop="sales_amount" label="销售额" align="right" width="120">
            <template #default="scope">${{ formatNumber(scope.row.sales_amount) }}</template>
          </el-table-column>
          <el-table-column prop="avg_selling_price" label="均价" align="right" width="100">
            <template #default="scope">${{ formatNumber(scope.row.avg_selling_price) }}</template>
          </el-table-column>
          <el-table-column prop="product_cost" label="产品成本" align="right" width="110">
            <template #default="scope">${{ formatNumber(scope.row.product_cost) }}</template>
          </el-table-column>
          <el-table-column prop="fba_fees" label="FBA费" align="right" width="100">
            <template #default="scope">${{ formatNumber(scope.row.fba_fees) }}</template>
          </el-table-column>
          <el-table-column prop="platform_fees" label="佣金" align="right" width="100">
            <template #default="scope">${{ formatNumber(scope.row.platform_fees) }}</template>
          </el-table-column>
          <el-table-column prop="ad_cost" label="广告费" align="right" width="100">
            <template #default="scope">${{ formatNumber(scope.row.ad_cost) }}</template>
          </el-table-column>
          <el-table-column prop="headway_cost" label="头程" align="right" width="100">
            <template #default="scope">${{ formatNumber(scope.row.headway_cost) }}</template>
          </el-table-column>
          <el-table-column prop="refund_amount" label="退款" align="right" width="100">
            <template #default="scope">${{ formatNumber(scope.row.refund_amount) }}</template>
          </el-table-column>
          <el-table-column prop="gross_profit" label="毛利" align="right" width="110">
            <template #default="scope">
              <span :class="scope.row.gross_profit >= 0 ? 'text-profit' : 'text-loss'">${{ formatNumber(scope.row.gross_profit) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="net_profit" label="净利润" align="right" width="110">
            <template #default="scope">
              <span :class="scope.row.net_profit >= 0 ? 'text-profit' : 'text-loss'">${{ formatNumber(scope.row.net_profit) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="profit_margin" label="利润率" align="right" width="100">
            <template #default="scope">
              <el-tag :type="getProfitRateTagType(scope.row.profit_margin)" size="small">
                {{ ((scope.row.profit_margin || 0) * 100).toFixed(1) }}%
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="skuPage"
          v-model:page-size="skuPageSize"
          :total="skuTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          class="pagination"
        />
      </div>

      <!-- TOP 排行 -->
      <div class="chart-row">
        <div class="chart-card half">
          <div class="chart-header"><h3><el-icon><Top /></el-icon> TOP 盈利 SKU</h3></div>
          <div ref="topProfitChartRef" class="chart-body" style="height:300px;"></div>
        </div>
        <div class="chart-card half">
          <div class="chart-header"><h3><el-icon><Bottom /></el-icon> TOP 亏损 SKU</h3></div>
          <div ref="topLossChartRef" class="chart-body" style="height:300px;"></div>
        </div>
      </div>

      <!-- 成本构成 -->
      <div class="chart-row">
        <div class="chart-card half">
          <div class="chart-header"><h3><el-icon><PieChart /></el-icon> 平均成本构成</h3></div>
          <div ref="skuCostPieRef" class="chart-body" style="height:280px;"></div>
        </div>
        <div class="chart-card half">
          <div class="chart-header"><h3><el-icon><Histogram /></el-icon> 利润率分布</h3></div>
          <div ref="profitDistChartRef" class="chart-body" style="height:280px;"></div>
        </div>
      </div>
    </div>

    <!-- ========== 库存周转 ========== -->
    <div v-show="activeTab === 'inventory'" class="tab-content">
      <div class="filter-bar">
        <el-radio-group v-model="inventoryFilter.status" @change="fetchInventoryData">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="normal">正常</el-radio-button>
          <el-radio-button label="warning">预警</el-radio-button>
          <el-radio-button label="slow">滞销</el-radio-button>
          <el-radio-button label="out_of_stock">缺货</el-radio-button>
        </el-radio-group>
        <el-input v-model="inventoryKeyword" placeholder="搜索 SKU / ASIN / 产品名" clearable style="width:240px" @keyup.enter="fetchInventoryData">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="fetchInventoryData"><el-icon><Search /></el-icon> 查询</el-button>
        <el-button type="success" plain @click="handleGenerateInventory"><el-icon><Refresh /></el-icon> 刷新数据</el-button>
      </div>

      <!-- 汇总卡片 -->
      <div class="summary-cards inventory-summary">
        <div class="summary-card card-inventory-total">
          <div class="card-icon"><el-icon size="28"><Box /></el-icon></div>
          <div class="card-body">
            <div class="card-label">总 SKU</div>
            <div class="card-value">{{ inventoryStats.total_sku || 0 }}</div>
          </div>
        </div>
        <div class="summary-card card-inventory-stock">
          <div class="card-icon"><el-icon size="28"><OfficeBuilding /></el-icon></div>
          <div class="card-body">
            <div class="card-label">总库存</div>
            <div class="card-value">{{ formatNumber(inventoryStats.total_stock, 0) }}</div>
          </div>
        </div>
        <div class="summary-card card-status-normal clickable" @click="openInventoryStatusDialog('normal')">
          <div class="card-icon"><el-icon size="28"><CircleCheck /></el-icon></div>
          <div class="card-body">
            <div class="card-label">正常</div>
            <div class="card-value">{{ inventoryStats.normal_count || 0 }}</div>
          </div>
        </div>
        <div class="summary-card card-status-warning clickable" @click="openInventoryStatusDialog('warning')">
          <div class="card-icon"><el-icon size="28"><Warning /></el-icon></div>
          <div class="card-body">
            <div class="card-label">预警</div>
            <div class="card-value">{{ inventoryStats.warning_count || 0 }}</div>
          </div>
        </div>
        <div class="summary-card card-status-slow clickable" @click="openInventoryStatusDialog('slow')">
          <div class="card-icon"><el-icon size="28"><Timer /></el-icon></div>
          <div class="card-body">
            <div class="card-label">滞销</div>
            <div class="card-value">{{ inventoryStats.slow_count || 0 }}</div>
          </div>
        </div>
        <div class="summary-card card-status-out clickable" @click="openInventoryStatusDialog('out_of_stock')">
          <div class="card-icon"><el-icon size="28"><CircleClose /></el-icon></div>
          <div class="card-body">
            <div class="card-label">缺货</div>
            <div class="card-value">{{ inventoryStats.out_of_stock_count || 0 }}</div>
          </div>
        </div>
      </div>

      <!-- 数据表格 -->
      <div class="table-card">
        <div class="chart-header"><h3><el-icon><List /></el-icon> 库存周转明细</h3></div>
        <el-table :data="inventoryList" v-loading="inventoryLoading" style="width:100%" :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}">
          <el-table-column label="产品" min-width="220">
            <template #default="scope">
              <div class="product-cell-simple">
                <div class="product-name">{{ scope.row.product_name || '-' }}</div>
                <div class="product-code">{{ scope.row.asin }} / {{ scope.row.sku }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="current_stock" label="FBA库存" align="right" width="100" />
          <el-table-column prop="inbound_qty" label="在途" align="right" width="90" />
          <el-table-column prop="total_available" label="总可用" align="right" width="100" />
          <el-table-column prop="avg_daily_sales" label="日均销" align="right" width="100">
            <template #default="scope">{{ Number(scope.row.avg_daily_sales || 0).toFixed(1) }}</template>
          </el-table-column>
          <el-table-column prop="sales_30d" label="30天销量" align="right" width="100" />
          <el-table-column prop="turnover_days" label="周转天" align="right" width="90">
            <template #default="scope">
              <span :class="getTurnoverClass(scope.row.turnover_days, scope.row.stock_status)">
                {{ scope.row.turnover_days === 9999 ? '—' : (scope.row.turnover_days || '-') }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="stock_status" label="状态" align="center" width="90">
            <template #default="scope">
              <el-tag :type="getStatusTagType(scope.row.stock_status)" size="small">
                {{ getStatusLabel(scope.row.stock_status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="last_sale_date" label="最后销售" align="center" width="110">
            <template #default="scope">
              {{ scope.row.last_sale_date || '从未销售' }}
            </template>
          </el-table-column>
          <el-table-column prop="days_without_sale" label="无销售天" align="right" width="100">
            <template #default="scope">
              {{ scope.row.days_without_sale === 999 ? '—' : (scope.row.days_without_sale || 0) }}
            </template>
          </el-table-column>
          <el-table-column prop="suggested_replenish" label="建议补货" align="right" width="100">
            <template #default="scope">
              <span :class="scope.row.suggested_replenish > 0 ? 'text-warning' : ''">{{ scope.row.suggested_replenish || 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="unit_cost" label="单件成本" align="right" width="110">
            <template #default="scope">${{ formatNumber(scope.row.unit_cost) }}</template>
          </el-table-column>
          <el-table-column prop="inventory_value" label="库存货值" align="right" width="120">
            <template #default="scope">${{ formatNumber(scope.row.inventory_value) }}</template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="inventoryPage"
          v-model:page-size="inventoryPageSize"
          :total="inventoryTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          class="pagination"
        />
      </div>

      <!-- 库存状态图 -->
      <div class="chart-row">
        <div class="chart-card half">
          <div class="chart-header"><h3><el-icon><PieChart /></el-icon> 库存状态分布</h3></div>
          <div ref="inventoryPieRef" class="chart-body" style="height:300px;"></div>
        </div>
        <div class="chart-card half">
          <div class="chart-header"><h3><el-icon><Histogram /></el-icon> 周转天数分布</h3></div>
          <div ref="turnoverDistRef" class="chart-body" style="height:300px;"></div>
        </div>
      </div>

      <!-- 库存状态SKU弹框 -->
      <el-dialog
        v-model="inventoryDialogVisible"
        :title="inventoryDialogTitle"
        width="900px"
        top="10vh"
        destroy-on-close
      >
        <el-table :data="inventoryDialogList" v-loading="inventoryDialogLoading" style="width:100%" :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}">
          <el-table-column label="产品" min-width="240">
            <template #default="scope">
              <div class="product-cell-simple">
                <div class="product-name">{{ scope.row.product_name || '-' }}</div>
                <div class="product-code">{{ scope.row.asin }} / {{ scope.row.sku }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="current_stock" label="FBA库存" align="right" width="100" />
          <el-table-column prop="turnover_days" label="周转天" align="right" width="90">
            <template #default="scope">
              {{ scope.row.turnover_days === 9999 ? '—' : (scope.row.turnover_days || '-') }}
            </template>
          </el-table-column>
          <el-table-column prop="last_sale_date" label="最后销售" align="center" width="110">
            <template #default="scope">
              {{ scope.row.last_sale_date || '从未销售' }}
            </template>
          </el-table-column>
          <el-table-column prop="days_without_sale" label="无销售天" align="right" width="100">
            <template #default="scope">
              {{ scope.row.days_without_sale === 999 ? '—' : (scope.row.days_without_sale || 0) }}
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="inventoryDialogPage"
          v-model:page-size="inventoryDialogPageSize"
          :total="inventoryDialogTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          class="pagination"
        />
      </el-dialog>
    </div>

    <!-- ========== 生成日志 ========== -->
    <div v-show="activeTab === 'logs'" class="tab-content">
      <div class="filter-bar">
        <el-select v-model="logFilter.report_type" placeholder="报表类型" clearable style="width:160px" @change="fetchLogs">
          <el-option label="经营日报" value="business_daily" />
          <el-option label="经营周报" value="business_weekly" />
          <el-option label="经营月报" value="business_monthly" />
          <el-option label="SKU利润" value="sku_profit" />
          <el-option label="库存周转" value="inventory_turnover" />
        </el-select>
        <el-select v-model="logFilter.status" placeholder="状态" clearable style="width:120px" @change="fetchLogs">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
          <el-option label="运行中" value="running" />
        </el-select>
        <el-button type="primary" @click="fetchLogs"><el-icon><Search /></el-icon> 查询</el-button>
      </div>

      <div class="table-card">
        <el-table :data="logList" v-loading="logLoading" style="width:100%" :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}">
          <el-table-column prop="report_type" label="报表类型" width="140">
            <template #default="scope">{{ getReportTypeLabel(scope.row.report_type) }}</template>
          </el-table-column>
          <el-table-column prop="period" label="周期" width="120" />
          <el-table-column prop="shop_id" label="店铺ID" width="90" align="center" />
          <el-table-column prop="status" label="状态" width="100" align="center">
            <template #default="scope">
              <el-tag :type="getLogStatusType(scope.row.status)" size="small">
                {{ getLogStatusLabel(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="started_at" label="开始时间" width="170" />
          <el-table-column prop="completed_at" label="完成时间" width="170" />
          <el-table-column prop="affected_rows" label="影响行数" width="100" align="right" />
          <el-table-column prop="error_message" label="错误信息" min-width="200" show-overflow-tooltip>
            <template #default="scope">
              <span v-if="scope.row.error_message" class="text-error">{{ scope.row.error_message }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="logPage"
          v-model:page-size="logPageSize"
          :total="logTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          class="pagination"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import {
  DataLine, Money, Coin, ShoppingCart, Promotion, RefreshLeft, Ship,
  TrendCharts, PieChart, DataAnalysis, List, Search, Download,
  Refresh, Top, Bottom, Histogram, Box, OfficeBuilding,
  Wallet, CircleCheck, Warning, Timer, CircleClose, ArrowUp, ArrowDown, InfoFilled
} from '@element-plus/icons-vue'
import {
  getShopOptions,
  getBusinessReports, getBusinessSummary, getBusinessTrend, getBusinessCostBreakdown,
  getSkuProfitTop, getSkuProfitAggregate,
  getInventoryTurnover, getInventoryStats, getInventoryByStatus,
  getGenerationLogs,
  generateYesterdayReports, generateInventoryTurnover
} from '@/services/api.js'

export default {
  name: 'ReportView',
  components: {
    DataLine, Money, Coin, ShoppingCart, Promotion, RefreshLeft, Ship,
    TrendCharts, PieChart, DataAnalysis, List, Search, Download,
    Refresh, Top, Bottom, Histogram, Box, OfficeBuilding,
    Wallet, CircleCheck, Warning, Timer, CircleClose, ArrowUp, ArrowDown, InfoFilled
  },
  setup() {
    const activeTab = ref('business')
    const selectedShop = ref(null)
    const shopList = ref([])
    const generating = ref(false)

    const tabs = [
      { key: 'business', label: '经营报表', icon: 'TrendCharts' },
      { key: 'sku-profit', label: 'SKU利润', icon: 'Coin' },
      { key: 'inventory', label: '库存周转', icon: 'Box' },
      { key: 'logs', label: '生成日志', icon: 'List' }
    ]

    // ============= 图表实例 =============
    let trendChart = null
    let costPieChart = null
    let profitBarChart = null
    let topProfitChart = null
    let topLossChart = null
    let skuCostPieChart = null
    let profitDistChart = null
    let inventoryPieChart = null
    let turnoverDistChart = null

    const trendChartRef = ref(null)
    const costPieChartRef = ref(null)
    const profitBarChartRef = ref(null)
    const topProfitChartRef = ref(null)
    const topLossChartRef = ref(null)
    const skuCostPieRef = ref(null)
    const profitDistChartRef = ref(null)
    const inventoryPieRef = ref(null)
    const turnoverDistRef = ref(null)

    // ============= 经营报表 =============
    const businessFilter = reactive({ type: 'daily' })
    const businessDateRange = ref([])
    const businessSummary = reactive({})
    const costBreakdown = reactive({
      ad_cost: 0,
      fba_fees: 0,
      platform_fees: 0,
      product_cost: 0,
      headway_cost: 0,
      refund_amount: 0
    })

    const costTreemapItems = computed(() => {
      const total = Math.max(
        Number(businessSummary.sum_total_cost || 0),
        0.01
      )
      const items = [
        { key: 'ad_cost', name: '广告费', value: Number(costBreakdown.ad_cost || 0), color: '#f59e0b' },
        { key: 'fba_fees', name: 'FBA费', value: Number(costBreakdown.fba_fees || 0), color: '#3b82f6' },
        { key: 'platform_fees', name: '平台佣金', value: Number(costBreakdown.platform_fees || 0), color: '#8b5cf6' },
        { key: 'product_cost', name: '产品成本', value: Number(costBreakdown.product_cost || 0), color: '#10b981' },
        { key: 'headway_cost', name: '头程', value: Number(costBreakdown.headway_cost || 0), color: '#06b6d4' },
        { key: 'refund_amount', name: '退款', value: Number(costBreakdown.refund_amount || 0), color: '#ef4444' }
      ].filter(i => i.value > 0)
        .sort((a, b) => b.value - a.value)
      return items.map(i => ({
        ...i,
        flex: Math.max(i.value / total, 0.05),
        percent: ((i.value / total) * 100).toFixed(1)
      }))
    })

    const businessList = ref([])
    const businessLoading = ref(false)
    const businessPage = ref(1)
    const businessPageSize = ref(20)
    const businessTotal = ref(0)
    const trendMetric = ref('sales')

    // ============= SKU 利润 =============
    const skuDateRange = ref([])
    const skuKeyword = ref('')
    const skuList = ref([])
    const skuLoading = ref(false)
    const skuPage = ref(1)
    const skuPageSize = ref(20)
    const skuTotal = ref(0)
    const topOrderSkus = ref([])
    const topSalesSkus = ref([])
    const topProfitSkus = ref([])

    // ============= 库存周转 =============
    const inventoryFilter = reactive({ status: '' })
    const inventoryKeyword = ref('')
    const inventoryStats = reactive({})
    const inventoryList = ref([])
    const inventoryLoading = ref(false)
    const inventoryPage = ref(1)
    const inventoryPageSize = ref(20)
    const inventoryTotal = ref(0)

    // 库存状态弹框
    const inventoryDialogVisible = ref(false)
    const inventoryDialogStatus = ref('')
    const inventoryDialogTitle = ref('')
    const inventoryDialogList = ref([])
    const inventoryDialogLoading = ref(false)
    const inventoryDialogPage = ref(1)
    const inventoryDialogPageSize = ref(20)
    const inventoryDialogTotal = ref(0)

    // ============= 生成日志 =============
    const logFilter = reactive({ report_type: '', status: '' })
    const logList = ref([])
    const logLoading = ref(false)
    const logPage = ref(1)
    const logPageSize = ref(20)
    const logTotal = ref(0)

    // ============= 工具函数 =============
    const formatNumber = (val, digits = 2) => {
      if (val === null || val === undefined) return '-'
      const n = Number(val)
      if (isNaN(n)) return '-'
      return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    }

    const getProfitRateTagType = (rate) => {
      const r = Number(rate) || 0
      if (r >= 0.3) return 'success'
      if (r >= 0.15) return ''
      if (r >= 0.05) return 'warning'
      return 'danger'
    }

    const getStatusTagType = (status) => {
      const map = { normal: 'success', warning: 'warning', slow: 'info', out_of_stock: 'danger' }
      return map[status] || 'info'
    }

    const getStatusLabel = (status) => {
      const map = { normal: '正常', warning: '预警', slow: '滞销', out_of_stock: '缺货' }
      return map[status] || status
    }

    const getTurnoverClass = (days, status) => {
      if (status === 'out_of_stock') return 'text-danger'
      if (days > 90) return 'text-danger'
      if (days <= 7) return 'text-warning'
      return ''
    }

    const getLogStatusType = (status) => {
      const map = { success: 'success', failed: 'danger', running: 'warning' }
      return map[status] || 'info'
    }

    const getLogStatusLabel = (status) => {
      const map = { success: '成功', failed: '失败', running: '运行中' }
      return map[status] || status
    }

    const getReportTypeLabel = (type) => {
      const map = {
        business_daily: '经营日报',
        business_weekly: '经营周报',
        business_monthly: '经营月报',
        sku_profit: 'SKU利润',
        inventory_turnover: '库存周转'
      }
      return map[type] || type
    }

    const getDataStatusLabel = (status) => {
      const map = { estimated: '预估', partial: '部分结算', settled: '已结算' }
      return map[status] || status
    }

    const getDataStatusType = (status) => {
      const map = { estimated: 'warning', partial: 'info', settled: 'success' }
      return map[status] || 'info'
    }

    // ============= 数据获取 =============
    const fetchShops = async () => {
      try {
        const res = await getShopOptions()
        if (res.data.status === 'success') {
          shopList.value = res.data.data || []
        }
      } catch (e) { console.error(e) }
    }

    const handleShopChange = () => {
      if (activeTab.value === 'business') fetchBusinessData()
      else if (activeTab.value === 'sku-profit') fetchSkuData()
      else if (activeTab.value === 'inventory') fetchInventoryData()
    }

    const fetchBusinessData = async () => {
      fetchBusinessSummary()
      fetchBusinessCostBreakdown()
      fetchBusinessTrend()
      fetchBusinessList()
    }

    const fetchBusinessSummary = async () => {
      try {
        const params = { type: businessFilter.type, shop_id: selectedShop.value }
        if (businessDateRange.value?.length === 2) {
          params.start_date = businessDateRange.value[0]
          params.end_date = businessDateRange.value[1]
        }
        const res = await getBusinessSummary(params)
        if (res.data.status === 'success') {
          const data = res.data.data || {}
          Object.assign(businessSummary, data)
          // 优先使用汇总接口返回的 cost_breakdown，否则后续调用专项接口
          if (data.cost_breakdown) {
            Object.assign(costBreakdown, data.cost_breakdown)
            updateCostPieChart()
          }
        }
      } catch (e) { console.error(e) }
    }

    const fetchBusinessCostBreakdown = async () => {
      try {
        const params = { type: businessFilter.type, shop_id: selectedShop.value }
        if (businessDateRange.value?.length === 2) {
          params.start_date = businessDateRange.value[0]
          params.end_date = businessDateRange.value[1]
        }
        const res = await getBusinessCostBreakdown(params)
        if (res.data.status === 'success') {
          const data = res.data.data || {}
          Object.assign(costBreakdown, {
            ad_cost: data.ad_cost || 0,
            fba_fees: data.fba_fees || 0,
            platform_fees: data.platform_fees || 0,
            product_cost: data.product_cost || 0,
            headway_cost: data.headway_cost || 0,
            refund_amount: data.refund_amount || 0
          })
          updateCostPieChart()
        }
      } catch (e) { console.error(e) }
    }

    const fetchBusinessTrend = async () => {
      try {
        const params = { type: businessFilter.type, shop_id: selectedShop.value }
        if (businessDateRange.value?.length === 2) {
          params.start_date = businessDateRange.value[0]
          params.end_date = businessDateRange.value[1]
        }
        const res = await getBusinessTrend(params)
        if (res.data.status === 'success') {
          const data = res.data.data || []
          updateTrendChartData(data)
          updateProfitBarChart(data)
        }
      } catch (e) { console.error(e) }
    }

    const fetchBusinessList = async () => {
      businessLoading.value = true
      try {
        const params = {
          type: businessFilter.type,
          shop_id: selectedShop.value,
          page: businessPage.value,
          page_size: businessPageSize.value
        }
        if (businessDateRange.value?.length === 2) {
          params.start_date = businessDateRange.value[0]
          params.end_date = businessDateRange.value[1]
        }
        const res = await getBusinessReports(params)
        if (res.data.status === 'success') {
          businessList.value = res.data.data.list || []
          businessTotal.value = res.data.data.total || 0
        }
      } catch (e) { console.error(e) }
      finally { businessLoading.value = false }
    }

    const onStartDateChange = (val) => {
      if (val && businessDateRange.value[1] && val > businessDateRange.value[1]) {
        businessDateRange.value[1] = val
      }
      businessPage.value = 1
      fetchBusinessData()
    }

    const onEndDateChange = (val) => {
      if (val && businessDateRange.value[0] && val < businessDateRange.value[0]) {
        businessDateRange.value[0] = val
      }
      businessPage.value = 1
      fetchBusinessData()
    }

    const handleBusinessTypeChange = () => {
      businessPage.value = 1
      setBusinessDefaultDateRange()
      fetchBusinessData()
    }

    const fetchSkuData = async () => {
      fetchSkuTopCards()
      fetchSkuTop()
      fetchSkuList()
    }

    const fetchSkuTopCards = async () => {
      try {
        const baseParams = { shop_id: selectedShop.value, limit: 3 }
        if (skuDateRange.value?.length === 2) {
          baseParams.start_date = skuDateRange.value[0]
          baseParams.end_date = skuDateRange.value[1]
        }
        const [resOrder, resSales, resProfit] = await Promise.all([
          getSkuProfitTop({ ...baseParams, sort_by: 'sales_qty', sort_dir: 'desc' }),
          getSkuProfitTop({ ...baseParams, sort_by: 'sales_amount', sort_dir: 'desc' }),
          getSkuProfitTop({ ...baseParams, sort_by: 'net_profit', sort_dir: 'desc' })
        ])
        if (resOrder.data.status === 'success') topOrderSkus.value = resOrder.data.data || []
        if (resSales.data.status === 'success') topSalesSkus.value = resSales.data.data || []
        if (resProfit.data.status === 'success') topProfitSkus.value = resProfit.data.data || []
      } catch (e) { console.error(e) }
    }

    const fetchSkuTop = async () => {
      try {
        const baseParams = { shop_id: selectedShop.value, limit: 10 }
        if (skuDateRange.value?.length === 2) {
          baseParams.start_date = skuDateRange.value[0]
          baseParams.end_date = skuDateRange.value[1]
        }
        const resProfit = await getSkuProfitTop({ ...baseParams, sort_by: 'net_profit', sort_dir: 'desc' })
        if (resProfit.data.status === 'success') {
          updateTopProfitChart(resProfit.data.data || [])
        }
        const resLoss = await getSkuProfitTop({ ...baseParams, sort_by: 'net_profit', sort_dir: 'asc' })
        if (resLoss.data.status === 'success') {
          updateTopLossChart(resLoss.data.data || [])
        }
      } catch (e) { console.error(e) }
    }

    const fetchSkuList = async () => {
      skuLoading.value = true
      try {
        const params = {
          keyword: skuKeyword.value,
          shop_id: selectedShop.value,
          page: skuPage.value,
          page_size: skuPageSize.value
        }
        if (skuDateRange.value?.length === 2) {
          params.start_date = skuDateRange.value[0]
          params.end_date = skuDateRange.value[1]
        }
        const res = await getSkuProfitAggregate(params)
        if (res.data.status === 'success') {
          skuList.value = res.data.data.list || []
          skuTotal.value = res.data.data.total || 0
          updateSkuCostPie(skuList.value)
          updateProfitDistChart(skuList.value)
        }
      } catch (e) { console.error(e) }
      finally { skuLoading.value = false }
    }

    const onSkuStartDateChange = (val) => {
      if (val && skuDateRange.value[1] && val > skuDateRange.value[1]) {
        skuDateRange.value[1] = val
      }
      skuPage.value = 1
      fetchSkuData()
    }

    const onSkuEndDateChange = (val) => {
      if (val && skuDateRange.value[0] && val < skuDateRange.value[0]) {
        skuDateRange.value[0] = val
      }
      skuPage.value = 1
      fetchSkuData()
    }

    const fetchInventoryData = async () => {
      fetchInventoryStats()
      fetchInventoryList()
    }

    const fetchInventoryStats = async () => {
      try {
        const res = await getInventoryStats({ shop_id: selectedShop.value })
        if (res.data.status === 'success') {
          const data = res.data.data || {}
          Object.assign(inventoryStats, data.overall || {})
          updateInventoryPie(data.by_status || [])
        }
      } catch (e) { console.error(e) }
    }

    const fetchInventoryList = async () => {
      inventoryLoading.value = true
      try {
        const params = {
          status: inventoryFilter.status,
          keyword: inventoryKeyword.value,
          shop_id: selectedShop.value,
          page: inventoryPage.value,
          page_size: inventoryPageSize.value
        }
        const res = await getInventoryTurnover(params)
        if (res.data.status === 'success') {
          inventoryList.value = res.data.data.list || []
          inventoryTotal.value = res.data.data.total || 0
          updateTurnoverDistChart(inventoryList.value)
        }
      } catch (e) { console.error(e) }
      finally { inventoryLoading.value = false }
    }

    const openInventoryStatusDialog = (status) => {
      const statusMap = { normal: '正常', warning: '预警', slow: '滞销', out_of_stock: '缺货' }
      inventoryDialogStatus.value = status
      inventoryDialogTitle.value = `${statusMap[status] || status} SKU 列表`
      inventoryDialogPage.value = 1
      inventoryDialogPageSize.value = 20
      inventoryDialogVisible.value = true
      fetchInventoryDialogList()
    }

    const fetchInventoryDialogList = async () => {
      inventoryDialogLoading.value = true
      try {
        const params = {
          status: inventoryDialogStatus.value,
          shop_id: selectedShop.value,
          page: inventoryDialogPage.value,
          page_size: inventoryDialogPageSize.value
        }
        const res = await getInventoryByStatus(params)
        if (res.data.status === 'success') {
          inventoryDialogList.value = res.data.data.list || []
          inventoryDialogTotal.value = res.data.data.total || 0
        }
      } catch (e) { console.error(e) }
      finally { inventoryDialogLoading.value = false }
    }

    const fetchLogs = async () => {
      logLoading.value = true
      try {
        const params = {
          report_type: logFilter.report_type,
          status: logFilter.status,
          page: logPage.value,
          page_size: logPageSize.value
        }
        const res = await getGenerationLogs(params)
        if (res.data.status === 'success') {
          logList.value = res.data.data.list || []
          logTotal.value = res.data.data.total || 0
        }
      } catch (e) { console.error(e) }
      finally { logLoading.value = false }
    }

    const fetchLogList = fetchLogs

    const handleGenerateYesterday = async () => {
      generating.value = true
      try {
        const res = await generateYesterdayReports()
        if (res.data.status === 'success') {
          ElMessage.success(res.data.message || '报表已生成，当前为预估数据（2-3 天后自动升级为已结算）')
          if (activeTab.value === 'logs') fetchLogs()
        }
      } catch (e) {
        ElMessage.error('生成失败')
        console.error(e)
      } finally {
        generating.value = false
      }
    }

    const handleGenerateInventory = async () => {
      try {
        const res = await generateInventoryTurnover({ shop_id: selectedShop.value })
        if (res.data.status === 'success') {
          ElMessage.success('库存周转数据已刷新')
          fetchInventoryData()
        }
      } catch (e) {
        ElMessage.error('刷新失败')
        console.error(e)
      }
    }

    const exportBusiness = () => {
      ElMessage.info('导出功能开发中...')
    }
    const exportSkuProfit = () => {
      ElMessage.info('导出功能开发中...')
    }

    // ============= 图表更新 =============
    const updateTrendChartData = (data) => {
      if (!trendChart) return
      // 趋势接口返回字段：time_label, total_sales, gross_profit, gross_profit_rate, headway_cost, headway_ratio, ad_cost, order_count
      const xAxis = data.map(d => d.time_label || '-')
      const series = []
      if (trendMetric.value === 'sales') {
        series.push({ name: '订单数', type: 'line', yAxisIndex: 1, data: data.map(d => d.order_count || 0), smooth: true, itemStyle: { color: '#f97316' }, lineStyle: { width: 3 } })
        series.push({ name: '销售额', type: 'line', data: data.map(d => d.total_sales || 0), smooth: true, areaStyle: { opacity: 0.15 }, itemStyle: { color: '#667eea' }, lineStyle: { width: 3 } })
        series.push({ name: '广告费', type: 'line', data: data.map(d => d.ad_cost || 0), smooth: true, itemStyle: { color: '#f59e0b' }, lineStyle: { width: 3 } })
        series.push({ name: '毛利', type: 'line', data: data.map(d => d.gross_profit || 0), smooth: true, areaStyle: { opacity: 0.1 }, itemStyle: { color: '#10b981' }, lineStyle: { width: 3 } })
      } else if (trendMetric.value === 'profit') {
        series.push({ name: '毛利', type: 'bar', data: data.map(d => d.gross_profit || 0), itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } })
        series.push({ name: '头程', type: 'bar', data: data.map(d => d.headway_cost || 0), itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] } })
      } else if (trendMetric.value === 'orders') {
        series.push({ name: '订单数', type: 'line', data: data.map(d => d.order_count || 0), smooth: true, areaStyle: { opacity: 0.15 }, itemStyle: { color: '#f97316' }, lineStyle: { width: 3 } })
      } else {
        series.push({ name: '毛利率', type: 'line', data: data.map(d => ((d.gross_profit_rate || 0) * 100).toFixed(1)), smooth: true, itemStyle: { color: '#8b5cf6' }, lineStyle: { width: 3 } })
      }
      const yAxis = trendMetric.value === 'sales'
        ? [
            { type: 'value', name: '金额', position: 'left', axisLine: { show: false }, splitLine: { lineStyle: { color: '#f0f0f0' } }, axisLabel: { color: '#666' } },
            { type: 'value', name: '订单数', position: 'right', axisLine: { show: false }, splitLine: { show: false }, axisLabel: { color: '#666' } }
          ]
        : { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: '#f0f0f0' } }, axisLabel: { color: '#666' } }
      trendChart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { data: series.map(s => s.name), bottom: 0 },
        grid: { left: 50, right: 50, top: 30, bottom: 40 },
        xAxis: { type: 'category', data: xAxis.length ? xAxis : ['暂无数据'], axisLine: { lineStyle: { color: '#ddd' } }, axisLabel: { color: '#666' } },
        yAxis,
        series: xAxis.length ? series : []
      }, true)
    }

    // 成本构成饼图（基于筛选日期范围汇总数据）
    // total_cost = 产品成本 + FBA费 + 平台佣金 + 头程 + 退款 + 广告费
    const updateCostPieChart = () => {
      if (!costPieChart) return
      const breakdown = costBreakdown || {}
      const totalCost = Number(businessSummary.sum_total_cost || 0)
      const productCost = Number(breakdown.product_cost || 0)
      const fbaFees = Number(breakdown.fba_fees || 0)
      const platformFees = Number(breakdown.platform_fees || 0)
      const headwayCost = Number(breakdown.headway_cost || 0)
      const adCost = Number(breakdown.ad_cost || 0)
      const refundAmount = Number(breakdown.refund_amount || 0)
      const pieData = [
        { value: productCost, name: '产品成本' },
        { value: fbaFees, name: 'FBA费' },
        { value: platformFees, name: '平台佣金' },
        { value: headwayCost, name: '头程' },
        { value: adCost, name: '广告费' },
        { value: refundAmount, name: '退款' }
      ].filter(d => d.value > 0)
      if (pieData.length > 0) {
        costPieChart.setOption({
          title: {
            text: `总成本\n$${formatNumber(totalCost)}`,
            left: '60%',
            top: '50%',
            textAlign: 'center',
            textVerticalAlign: 'middle',
            textStyle: { fontSize: 14, color: '#666' }
          },
          tooltip: { trigger: 'item', formatter: '{b}: ${c} ({d}%)' },
          legend: { orient: 'vertical', left: 'left', top: 'center' },
          graphic: [],
          series: [{
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['60%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
            label: { show: true, formatter: '{b}\n{d}%' },
            data: pieData
          }]
        }, true)
      } else {
        costPieChart.setOption({
          tooltip: { show: false },
          legend: { show: false },
          title: { show: false },
          graphic: [{
            type: 'text',
            left: 'center',
            top: 'middle',
            style: { text: '暂无数据', fill: '#999', fontSize: 16 }
          }],
          series: []
        }, true)
      }
    }

    // 利润结构对比（基于趋势数据）
    const updateProfitBarChart = (data) => {
      if (!profitBarChart) return
      if (data.length > 0) {
        const latest5 = data.slice(-5)
        profitBarChart.setOption({
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          legend: { bottom: 0 },
          grid: { left: 50, right: 30, top: 20, bottom: 40 },
          xAxis: { type: 'category', data: latest5.map(d => d.time_label || '-'), axisLabel: { color: '#666' } },
          yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f0f0' } } },
          series: [
            { name: '销售额', type: 'bar', data: latest5.map(d => d.total_sales || 0), itemStyle: { color: '#667eea' } },
            { name: '毛利', type: 'bar', data: latest5.map(d => d.gross_profit || 0), itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } }
          ]
        }, true)
      } else {
        profitBarChart.setOption({
          tooltip: { show: false },
          legend: { show: false },
          xAxis: { type: 'category', data: ['暂无数据'], axisLabel: { color: '#999' } },
          yAxis: { type: 'value', show: false },
          series: [],
          graphic: [{
            type: 'text',
            left: 'center',
            top: 'middle',
            style: { text: '暂无数据', fill: '#999', fontSize: 16 }
          }]
        }, true)
      }
    }

    const updateTrendChart = () => {
      fetchBusinessTrend()
    }

    const formatSkuChartLabel = (d) => {
      const sku = d.sku || d.asin || '-'
      const name = d.product_name || ''
      const full = name ? `${sku} - ${name}` : sku
      return full.length > 26 ? full.slice(0, 26) + '...' : full
    }

    const updateTopProfitChart = (data) => {
      if (!topProfitChart) return
      const list = data.slice(0, 10).reverse()
      topProfitChart.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const item = list[params[0].dataIndex]
            const label = item ? formatSkuChartLabel(item) : params[0].name
            return `${label}<br/>净利润: $${formatNumber(params[0].value)}`
          }
        },
        grid: { left: 200, right: 30, top: 10, bottom: 20 },
        xAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f0f0' } } },
        yAxis: { type: 'category', data: list.length ? list.map(formatSkuChartLabel) : ['暂无数据'], axisLabel: { color: '#666', width: 190, overflow: 'truncate' } },
        series: [{
          type: 'bar',
          data: list.length ? list.map(d => d.net_profit || 0) : [0],
          itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] },
          label: { show: list.length > 0, position: 'right', formatter: '${c}' }
        }]
      }, true)
    }

    const updateTopLossChart = (data) => {
      if (!topLossChart) return
      const list = data.slice(0, 10).reverse()
      topLossChart.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const item = list[params[0].dataIndex]
            const label = item ? formatSkuChartLabel(item) : params[0].name
            return `${label}<br/>净利润: $${formatNumber(params[0].value)}`
          }
        },
        grid: { left: 200, right: 30, top: 10, bottom: 20 },
        xAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f0f0' } } },
        yAxis: { type: 'category', data: list.length ? list.map(formatSkuChartLabel) : ['暂无数据'], axisLabel: { color: '#666', width: 190, overflow: 'truncate' } },
        series: [{
          type: 'bar',
          data: list.length ? list.map(d => d.net_profit || 0) : [0],
          itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] },
          label: { show: list.length > 0, position: 'right', formatter: '${c}' }
        }]
      }, true)
    }

    const updateSkuCostPie = (data) => {
      if (!skuCostPieChart) return
      if (data.length === 0) {
        skuCostPieChart.setOption({
          tooltip: { show: false },
          legend: { show: false },
          graphic: [{
            type: 'text',
            left: 'center',
            top: 'middle',
            style: { text: '暂无数据', fill: '#999', fontSize: 16 }
          }],
          series: []
        }, true)
        return
      }
      const totals = data.reduce((acc, row) => {
        acc.product_cost += Number(row.product_cost || 0)
        acc.fba_fees += Number(row.fba_fees || 0)
        acc.platform_fees += Number(row.platform_fees || 0)
        acc.headway_cost += Number(row.headway_cost || 0)
        acc.ad_cost += Number(row.ad_cost || 0)
        acc.refund_amount += Number(row.refund_amount || 0)
        return acc
      }, { product_cost: 0, fba_fees: 0, platform_fees: 0, headway_cost: 0, ad_cost: 0, refund_amount: 0 })
      const pieData = [
        { value: totals.product_cost, name: '产品成本' },
        { value: totals.fba_fees, name: 'FBA费' },
        { value: totals.platform_fees, name: '佣金' },
        { value: totals.headway_cost, name: '头程' },
        { value: totals.ad_cost, name: '广告' },
        { value: totals.refund_amount, name: '退款' }
      ].filter(d => d.value > 0)
      skuCostPieChart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: ${c} ({d}%)' },
        legend: { orient: 'vertical', left: 'left', top: 'center' },
        graphic: [],
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '{b}\n{d}%' },
          data: pieData.length ? pieData : [{ value: 0, name: '暂无数据' }]
        }]
      }, true)
    }

    const updateProfitDistChart = (data) => {
      if (!profitDistChart) return
      if (data.length === 0) {
        profitDistChart.setOption({
          tooltip: { show: false },
          xAxis: { type: 'category', data: ['暂无数据'], axisLabel: { color: '#999' } },
          yAxis: { type: 'value', show: false },
          graphic: [{
            type: 'text',
            left: 'center',
            top: 'middle',
            style: { text: '暂无数据', fill: '#999', fontSize: 16 }
          }],
          series: []
        }, true)
        return
      }
      const ranges = { '<0%': 0, '0-10%': 0, '10-20%': 0, '20-30%': 0, '30%+': 0 }
      data.forEach(row => {
        const r = (row.profit_margin || 0) * 100
        if (r < 0) ranges['<0%']++
        else if (r < 10) ranges['0-10%']++
        else if (r < 20) ranges['10-20%']++
        else if (r < 30) ranges['20-30%']++
        else ranges['30%+']++
      })
      profitDistChart.setOption({
        tooltip: { trigger: 'axis' },
        graphic: [],
        grid: { left: 50, right: 30, top: 20, bottom: 30 },
        xAxis: { type: 'category', data: Object.keys(ranges), axisLabel: { color: '#666' } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f0f0' } } },
        series: [{
          type: 'bar',
          data: Object.values(ranges),
          itemStyle: {
            color: (params) => {
              const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981']
              return colors[params.dataIndex] || '#667eea'
            },
            borderRadius: [4, 4, 0, 0]
          }
        }]
      }, true)
    }

    const updateInventoryPie = (data) => {
      if (!inventoryPieChart) return
      const statusMap = { normal: '正常', warning: '预警', slow: '滞销', out_of_stock: '缺货' }
      const colorMap = { normal: '#10b981', warning: '#f59e0b', slow: '#6b7280', out_of_stock: '#ef4444' }
      if (data.length === 0) {
        inventoryPieChart.setOption({
          tooltip: { show: false },
          legend: { show: false },
          graphic: [{
            type: 'text',
            left: 'center',
            top: 'middle',
            style: { text: '暂无数据', fill: '#999', fontSize: 16 }
          }],
          series: []
        }, true)
        return
      }
      const pieData = data.map(d => ({
        value: d.count || 0,
        name: statusMap[d.stock_status] || d.stock_status || '未知',
        itemStyle: { color: colorMap[d.stock_status] || '#667eea' }
      }))
      inventoryPieChart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} SKU ({d}%)' },
        legend: { orient: 'vertical', left: 'left', top: 'center' },
        graphic: [],
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '{b}\n{d}%' },
          data: pieData
        }]
      }, true)
    }

    const updateTurnoverDistChart = (data) => {
      if (!turnoverDistChart) return
      if (data.length === 0) {
        turnoverDistChart.setOption({
          tooltip: { show: false },
          xAxis: { type: 'category', data: ['暂无数据'], axisLabel: { color: '#999' } },
          yAxis: { type: 'value', show: false },
          graphic: [{
            type: 'text',
            left: 'center',
            top: 'middle',
            style: { text: '暂无数据', fill: '#999', fontSize: 16 }
          }],
          series: []
        }, true)
        return
      }
      const ranges = { '≤7天': 0, '8-30天': 0, '31-60天': 0, '61-90天': 0, '>90天': 0, '缺货': 0 }
      data.forEach(row => {
        if (row.stock_status === 'out_of_stock') ranges['缺货']++
        else if (!row.turnover_days || row.turnover_days <= 7) ranges['≤7天']++
        else if (row.turnover_days <= 30) ranges['8-30天']++
        else if (row.turnover_days <= 60) ranges['31-60天']++
        else if (row.turnover_days <= 90) ranges['61-90天']++
        else ranges['>90天']++
      })
      turnoverDistChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 50, right: 30, top: 20, bottom: 30 },
        xAxis: { type: 'category', data: Object.keys(ranges), axisLabel: { color: '#666' } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f0f0' } } },
        series: [{
          type: 'bar',
          data: Object.values(ranges),
          itemStyle: {
            color: (params) => {
              const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#6b7280', '#dc2626']
              return colors[params.dataIndex] || '#667eea'
            },
            borderRadius: [4, 4, 0, 0]
          }
        }]
      }, true)
    }

    // ============= 初始化图表 =============
    const initCharts = () => {
      if (trendChartRef.value) trendChart = echarts.init(trendChartRef.value)
      if (costPieChartRef.value) costPieChart = echarts.init(costPieChartRef.value)
      if (profitBarChartRef.value) profitBarChart = echarts.init(profitBarChartRef.value)
      if (topProfitChartRef.value) topProfitChart = echarts.init(topProfitChartRef.value)
      if (topLossChartRef.value) topLossChart = echarts.init(topLossChartRef.value)
      if (skuCostPieRef.value) skuCostPieChart = echarts.init(skuCostPieRef.value)
      if (profitDistChartRef.value) profitDistChart = echarts.init(profitDistChartRef.value)
      if (inventoryPieRef.value) inventoryPieChart = echarts.init(inventoryPieRef.value)
      if (turnoverDistRef.value) turnoverDistChart = echarts.init(turnoverDistRef.value)
    }

    const disposeCharts = () => {
      trendChart?.dispose()
      costPieChart?.dispose()
      profitBarChart?.dispose()
      topProfitChart?.dispose()
      topLossChart?.dispose()
      skuCostPieChart?.dispose()
      profitDistChart?.dispose()
      inventoryPieChart?.dispose()
      turnoverDistChart?.dispose()
    }

    const resizeCharts = () => {
      trendChart?.resize()
      costPieChart?.resize()
      profitBarChart?.resize()
      topProfitChart?.resize()
      topLossChart?.resize()
      skuCostPieChart?.resize()
      profitDistChart?.resize()
      inventoryPieChart?.resize()
      turnoverDistChart?.resize()
    }

    // ============= 初始化日期 =============
    const setBusinessDefaultDateRange = () => {
      const end = new Date()
      const start = new Date()
      if (businessFilter.type === 'daily') {
        start.setDate(start.getDate() - 30)
      } else if (businessFilter.type === 'weekly') {
        start.setDate(start.getDate() - 90)
      } else if (businessFilter.type === 'monthly') {
        start.setDate(start.getDate() - 365)
      }
      const fmt = (d) => d.toISOString().split('T')[0]
      businessDateRange.value = [fmt(start), fmt(end)]
    }

    const initDates = () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 30)
      const fmt = (d) => d.toISOString().split('T')[0]
      setBusinessDefaultDateRange()
      skuDateRange.value = [fmt(start), fmt(end)]
    }

    // ============= 监听分页变化 =============
    watch([businessPage, businessPageSize], () => {
      if (activeTab.value === 'business') fetchBusinessList()
    })

    watch([skuPage, skuPageSize], () => {
      if (activeTab.value === 'sku-profit') fetchSkuList()
    })

    watch([inventoryPage, inventoryPageSize], () => {
      if (activeTab.value === 'inventory') fetchInventoryList()
    })

    watch([inventoryDialogPage, inventoryDialogPageSize], () => {
      if (inventoryDialogVisible.value) fetchInventoryDialogList()
    })

    watch([logPage, logPageSize], () => {
      if (activeTab.value === 'logs') fetchLogList()
    })

    // ============= 监听 Tab 切换 =============
    watch(activeTab, (val) => {
      nextTick(() => {
        initCharts()
        resizeCharts()
        if (val === 'business') fetchBusinessData()
        else if (val === 'sku-profit') fetchSkuData()
        else if (val === 'inventory') fetchInventoryData()
        else if (val === 'logs') fetchLogs()
      })
    })

    onMounted(() => {
      initDates()
      fetchShops()
      nextTick(() => {
        initCharts()
        fetchBusinessData()
        window.addEventListener('resize', resizeCharts)
      })
    })

    onUnmounted(() => {
      disposeCharts()
      window.removeEventListener('resize', resizeCharts)
    })

    return {
      activeTab, tabs, selectedShop, shopList, generating,
      trendChartRef, costPieChartRef, profitBarChartRef,
      topProfitChartRef, topLossChartRef, skuCostPieRef, profitDistChartRef,
      inventoryPieRef, turnoverDistRef,
      businessFilter, businessDateRange, businessSummary, costBreakdown, costTreemapItems, businessList,
      businessLoading, businessPage, businessPageSize, businessTotal, trendMetric,
      skuDateRange, skuKeyword, skuList, skuLoading, skuPage, skuPageSize, skuTotal,
      topOrderSkus, topSalesSkus, topProfitSkus,
      inventoryFilter, inventoryKeyword, inventoryStats, inventoryList,
      inventoryLoading, inventoryPage, inventoryPageSize, inventoryTotal,
      inventoryDialogVisible, inventoryDialogTitle, inventoryDialogStatus, inventoryDialogList,
      inventoryDialogLoading, inventoryDialogPage, inventoryDialogPageSize, inventoryDialogTotal,
      logFilter, logList, logLoading, logPage, logPageSize, logTotal,
      formatNumber, getProfitRateTagType, getStatusTagType, getStatusLabel,
      getTurnoverClass, getLogStatusType, getLogStatusLabel, getReportTypeLabel,
      getDataStatusLabel, getDataStatusType,
      handleShopChange, fetchBusinessData, handleBusinessTypeChange,
      onStartDateChange, onEndDateChange,
      fetchSkuData, onSkuStartDateChange, onSkuEndDateChange,
      fetchInventoryData, openInventoryStatusDialog, fetchInventoryDialogList, fetchLogs, fetchLogList,
      handleGenerateYesterday, handleGenerateInventory,
      updateTrendChart, updateCostPieChart, exportBusiness, exportSkuProfit
    }
  }
}
</script>

<style scoped>
.report-page {
  padding: 20px 24px;
  background: #f5f7fa;
  min-height: calc(100vh - 60px);
}

/* 头部 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
}

.page-subtitle {
  font-size: 14px;
  color: #888;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Tab 栏 */
.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  background: #fff;
  padding: 6px;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  transition: all 0.3s;
}

.tab-item:hover {
  background: #f3f4f6;
  color: #667eea;
}

.tab-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.date-range-pickers {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-range-pickers .el-date-picker {
  width: 150px;
}

.date-separator {
  color: #9ca3af;
  font-size: 14px;
}

/* 汇总卡片 */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.summary-cards.business-summary {
  grid-template-columns: 1fr 2fr 1fr 1fr;
}

.summary-cards.business-summary .card-cost {
  grid-column: span 1;
}

.summary-cards.inventory-summary {
  grid-template-columns: repeat(6, 1fr);
}

.summary-card {
  background: #fff;
  border-radius: 14px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.summary-card.clickable {
  cursor: pointer;
}

.summary-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.card-sales .card-icon { background: linear-gradient(135deg, #667eea, #764ba2); }
.card-profit .card-icon { background: linear-gradient(135deg, #10b981, #059669); }
.card-order .card-icon { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.card-cost .card-icon { background: linear-gradient(135deg, #f59e0b, #d97706); }
.card-ad .card-icon { background: linear-gradient(135deg, #f59e0b, #d97706); }
.card-refund .card-icon { background: linear-gradient(135deg, #ef4444, #dc2626); }
.card-headway .card-icon { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
.card-inventory-total .card-icon { background: linear-gradient(135deg, #667eea, #764ba2); }
.card-inventory-stock .card-icon { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.card-inventory-inbound .card-icon { background: linear-gradient(135deg, #f59e0b, #d97706); }
.card-inventory-value .card-icon { background: linear-gradient(135deg, #10b981, #059669); }
.card-status-normal .card-icon { background: linear-gradient(135deg, #10b981, #059669); }
.card-status-warning .card-icon { background: linear-gradient(135deg, #f59e0b, #d97706); }
.card-status-slow .card-icon { background: linear-gradient(135deg, #6b7280, #4b5563); }
.card-status-out .card-icon { background: linear-gradient(135deg, #ef4444, #dc2626); }

.card-body {
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.card-value {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

/* 成本卡片 — 横向树状图 */
.card-cost {
  flex-direction: column;
  align-items: stretch;
  padding: 16px;
  gap: 12px;
}

.cost-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cost-treemap {
  display: flex;
  width: 100%;
  height: 64px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
}

.cost-treemap-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 56px;
  padding: 6px 4px;
  color: #fff;
  text-align: center;
  transition: filter 0.2s;
  cursor: default;
}

.cost-treemap-item:hover {
  filter: brightness(1.08);
}

.cost-treemap-item + .cost-treemap-item {
  border-left: 1px solid rgba(255, 255, 255, 0.2);
}

.cost-treemap-name {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.95;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.cost-treemap-value {
  font-size: 12px;
  font-weight: 700;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.cost-treemap-percent {
  font-size: 10px;
  opacity: 0.85;
  margin-top: 1px;
}

.cost-ad_cost { background: linear-gradient(135deg, #f59e0b, #d97706); }
.cost-fba_fees { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.cost-platform_fees { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
.cost-product_cost { background: linear-gradient(135deg, #10b981, #059669); }
.cost-headway_cost { background: linear-gradient(135deg, #06b6d4, #0891b2); }
.cost-refund_amount { background: linear-gradient(135deg, #ef4444, #dc2626); }

.card-trend {
  font-size: 12px;
  color: #10b981;
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}

/* SKU 利润 TOP 汇总卡片 */
.summary-cards.sku-summary {
  grid-template-columns: repeat(3, 1fr);
}

.summary-cards.sku-summary .summary-card {
  align-items: flex-start;
  padding: 16px;
}

.card-sku-orders .card-icon { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.card-sku-sales .card-icon { background: linear-gradient(135deg, #667eea, #764ba2); }
.card-sku-profit .card-icon { background: linear-gradient(135deg, #10b981, #059669); }

.top-sku-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.top-sku-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 6px 8px;
  background: #f9fafb;
  border-radius: 8px;
}

.top-sku-rank {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #9ca3af;
  flex-shrink: 0;
}

.top-sku-item:nth-child(1) .top-sku-rank { background: #f59e0b; }
.top-sku-item:nth-child(2) .top-sku-rank { background: #9ca3af; }
.top-sku-item:nth-child(3) .top-sku-rank { background: #b45309; }

.top-sku-name {
  flex: 1;
  min-width: 0;
  color: #374151;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-sku-value {
  color: #1f2937;
  font-weight: 700;
  flex-shrink: 0;
}

.top-sku-empty {
  font-size: 13px;
  color: #9ca3af;
  padding: 12px 0;
  text-align: center;
}

/* 图表卡片 */
.chart-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  margin-bottom: 20px;
}

.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.chart-row .chart-card {
  margin-bottom: 0;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.chart-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.chart-body {
  width: 100%;
}

/* 表格卡片 */
.table-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  margin-bottom: 20px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

/* 产品单元格 */
.product-cell-simple {
  line-height: 1.4;
}

.product-cell-simple .product-name {
  font-weight: 500;
  color: #374151;
  font-size: 13px;
}

.product-cell-simple .product-code {
  font-size: 12px;
  color: #9ca3af;
  font-family: monospace;
}

/* 文本颜色 */
.text-profit { color: #10b981; font-weight: 600; }
.text-loss { color: #ef4444; font-weight: 600; }
.text-warning { color: #f59e0b; font-weight: 600; }
.text-danger { color: #ef4444; font-weight: 600; }
.text-error { color: #ef4444; }
.text-muted { color: #9ca3af; }

.status-hint {
  display: flex;
  align-items: flex-start;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
  margin-bottom: 16px;
}

/* 响应式 */
@media (max-width: 1280px) {
  .summary-cards { grid-template-columns: repeat(3, 1fr); }
  .summary-cards.business-summary { grid-template-columns: repeat(2, 1fr); }
  .summary-cards.business-summary .card-cost { grid-column: span 2; }
  .summary-cards.sku-summary { grid-template-columns: repeat(2, 1fr); }
  .summary-cards.sku-summary .card-sku-profit { grid-column: span 2; }
  .summary-cards.inventory-summary { grid-template-columns: repeat(3, 1fr); }
  .chart-row { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .report-page { padding: 12px; }
  .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .summary-cards { grid-template-columns: repeat(2, 1fr); }
  .summary-cards.business-summary { grid-template-columns: repeat(1, 1fr); }
  .summary-cards.business-summary .card-cost { grid-column: span 1; }
  .summary-cards.sku-summary { grid-template-columns: repeat(1, 1fr); }
  .summary-cards.sku-summary .card-sku-profit { grid-column: span 1; }
  .summary-cards.inventory-summary { grid-template-columns: repeat(2, 1fr); }
  .tab-item { padding: 8px 12px; font-size: 13px; }
  .filter-bar { gap: 8px; }
  .date-range-pickers { width: 100%; }
  .date-range-pickers .el-date-picker { flex: 1; }
}
</style>
