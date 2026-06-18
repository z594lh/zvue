<template>
  <div class="product-board-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><TrendCharts /></el-icon>
          备货看板
        </h1>
        <p class="page-subtitle">选品看趋势 · 跨批次追踪销量与利润变化</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="handleImportClick"><el-icon><Upload /></el-icon> 导入数据</el-button>
        <el-button @click="handleExport" :loading="exportLoading"><el-icon><Download /></el-icon> 导出</el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <el-select v-model="searchForm.amazon_status" placeholder="AMZ状态" clearable style="width:130px" @change="handleSearch">
          <el-option v-for="status in amazonStatusList" :key="status" :label="status" :value="status" />
        </el-select>
        <el-select v-model="searchForm.is_listed" placeholder="上架状态" clearable style="width:120px" @change="handleSearch">
          <el-option label="已上架" :value="true" />
          <el-option label="未上架" :value="false" />
        </el-select>
        <el-select v-model="searchForm.is_new_product" placeholder="新品/老品" clearable style="width:120px" @change="handleSearch">
          <el-option label="新品" :value="true" />
          <el-option label="老品" :value="false" />
        </el-select>
        <el-input v-model="searchForm.keyword" placeholder="搜索 ASIN / 名称" clearable style="width:200px" @keyup.enter="handleSearch">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-input-number v-model="searchForm.min_sales" :min="0" :controls="false" placeholder="最小30天销量" style="width:140px" @keyup.enter="handleSearch" />
        <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon> 搜索</el-button>
        <el-button plain @click="resetSearch"><el-icon><Refresh /></el-icon> 重置</el-button>
      </div>
      <div class="filter-group">
        <el-select v-model="searchForm.sort_by" style="width:150px" @change="handleSearch">
          <el-option label="30天销量" value="sales_30d" />
          <el-option label="7天销量" value="sales_7d" />
          <el-option label="3天销量" value="sales_3d" />
          <el-option label="1天销量" value="sales_1d" />
          <el-option label="30天毛利" value="gross_profit_30d_usd" />
          <el-option label="7天毛利" value="gross_profit_7d_usd" />
          <el-option label="30天毛利率" value="profit_margin_30d" />
          <el-option label="7天毛利率" value="profit_margin_7d" />
          <el-option label="30天退款率" value="refund_rate_30d" />
          <el-option label="60天退款率" value="refund_rate_60d" />
          <el-option label="售价" value="selling_price_usd" />
          <el-option label="昨日广告费" value="ad_spend_yesterday" />
          <el-option label="当月广告费" value="ad_spend_current_month" />
          <el-option label="30天广告费" value="ad_spend_30d" />
          <el-option label="开发时间" value="dev_time" />
          <el-option label="首到时间" value="first_arrival_time" />
          <el-option label="最早到货" value="earliest_arrival_time" />
          <el-option label="FBA到货" value="fba_arrival_time" />
          <el-option label="评分" value="rating" />
        </el-select>
        <el-select v-model="searchForm.sort_dir" style="width:90px" @change="handleSearch">
          <el-option label="降序" value="desc" />
          <el-option label="升序" value="asc" />
        </el-select>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-card">
      <el-table
        :data="productList"
        v-loading="loading"
        style="width:100%"
        height="calc(100vh - 296px)"
        @select="handleSelect"
        @select-all="handleSelectAll"
        ref="tableRef"
        :row-key="(row) => row.id"
        row-class-name="product-row"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        :cell-style="{padding:'10px 0'}"
      >
        <el-table-column type="selection" width="48" align="center" fixed="left" :reserve-selection="true" />
        <el-table-column label="产品" min-width="280" fixed="left">
          <template #default="scope">
            <div class="product-cell">
              <el-image
                :src="scope.row.image_url || defaultImage"
                :preview-src-list="scope.row.image_url ? [scope.row.image_url] : []"
                fit="cover"
                class="product-thumb"
                :preview-teleported="true"
              >
                <template #error><div class="thumb-placeholder"><el-icon><Picture /></el-icon></div></template>
              </el-image>
              <div class="product-meta">
                <div class="product-name" :title="scope.row.product_name_cn">{{ scope.row.product_name_cn || '-' }}</div>
                <div class="product-asin">
                  <el-link v-if="scope.row.sales_url" :href="scope.row.sales_url" target="_blank" :underline="false" type="primary" style="font-family:monospace;font-size:12px;">
                    {{ scope.row.asin }}
                  </el-link>
                  <span v-else style="font-family:monospace;font-size:12px;color:#888;">{{ scope.row.asin }}</span>
                </div>
                <div class="product-tags">
                  <el-tooltip :content="getProductAgeTip(scope.row.dev_time)" placement="top">
                    <el-tag v-if="scope.row.dev_time" size="small" effect="plain" :type="scope.row.is_new_product ? 'success' : 'danger'">{{ scope.row.is_new_product ? '新品' : '老品' }}</el-tag>
                  </el-tooltip>
                  <el-tag v-if="scope.row.amazon_status" size="small" effect="plain" type="info">{{ scope.row.amazon_status }}</el-tag>
                  <el-switch
                    v-model="scope.row.is_listed"
                    :active-value="true"
                    :inactive-value="false"
                    active-text="已上架"
                    inactive-text="未上架"
                    inline-prompt
                    size="small"
                    style="--el-switch-on-color: #10b981;"
                    @change="(val) => handleToggleListed(scope.row, val)"
                  />
                  <span class="rating-badge" v-if="scope.row.rating">
                    <el-icon size="12" color="#ff9900"><Star-Filled /></el-icon>
                    {{ Number(scope.row.rating).toFixed(1) }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="价格(USD)" width="130" align="right">
          <template #default="scope">
            <div class="price-block">
              <!-- 有促销价 -->
              <template v-if="scope.row.promo_price_usd">
                <div class="price-row">
                  <span class="price-tag tag-promo">促</span>
                  <span class="main-price">${{ formatNumber(scope.row.promo_price_usd) }}</span>
                </div>
                <div class="price-row">
                  <span class="price-tag tag-origin">原</span>
                  <span class="promo-price">${{ formatNumber(scope.row.selling_price_usd) }}</span>
                </div>
              </template>
              <!-- 无促销价 -->
              <template v-else>
                <div class="price-row">
                  <span class="price-tag tag-normal">售</span>
                  <span class="main-price">${{ formatNumber(scope.row.selling_price_usd) }}</span>
                </div>
              </template>
              <!-- 建议售价 -->
              <div v-if="scope.row.suggested_price_usd" class="price-row">
                <span class="price-tag tag-suggest">建</span>
                <span class="suggest-price">${{ formatNumber(scope.row.suggested_price_usd) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column width="90" align="center">
          <template #header>
            <el-tooltip content="30天/14天/7天/3天/1天" placement="top">
              <span>销量</span>
            </el-tooltip>
          </template>
          <template #default="scope">
            <div style="line-height:1.5;text-align:center;font-size:13px;">
              <div style="font-weight:700;color:#667eea;">{{ scope.row.sales_30d || 0 }}</div>
              <div style="color:#888;">{{ scope.row.sales_14d || 0 }}</div>
              <div style="color:#888;">{{ scope.row.sales_7d || 0 }}</div>
              <div style="color:#888;">{{ scope.row.sales_3d || 0 }}</div>
              <div style="color:#aaa;">{{ scope.row.sales_1d || 0 }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column width="110" align="right">
          <template #header>
            <el-tooltip content="30天 / 7天" placement="top">
              <span>毛利(USD)</span>
            </el-tooltip>
          </template>
          <template #default="scope">
            <div style="line-height:1.5;text-align:right;font-size:13px;">
              <div :class="getProfitClass(scope.row.gross_profit_30d_usd)" style="font-weight:700;">${{ formatNumber(scope.row.gross_profit_30d_usd) }}</div>
              <div :class="getProfitClass(scope.row.gross_profit_7d_usd)" style="color:#888;">${{ formatNumber(scope.row.gross_profit_7d_usd) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column width="95" align="center">
          <template #header>
            <el-tooltip content="30天 / 7天" placement="top">
              <span>毛利率</span>
            </el-tooltip>
          </template>
          <template #default="scope">
            <div style="line-height:1.5;text-align:center;font-size:13px;">
              <div><el-tag :type="getMarginTagType(scope.row.profit_margin_30d)" size="small" effect="dark" round>{{ formatPercent(scope.row.profit_margin_30d) }}</el-tag></div>
              <div v-if="scope.row.profit_margin_7d != null" style="margin-top:2px;"><el-tag :type="getMarginTagType(scope.row.profit_margin_7d)" size="small" effect="plain" round>{{ formatPercent(scope.row.profit_margin_7d) }}</el-tag></div>
              <div v-else style="color:#ccc;font-size:12px;">-</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column width="90" align="center">
          <template #header>
            <el-tooltip content="60天 / 30天" placement="top">
              <span>退款率</span>
            </el-tooltip>
          </template>
          <template #default="scope">
            <div style="line-height:1.5;text-align:center;font-size:13px;">
              <div :class="getRefundClass(scope.row.refund_rate_60d)">{{ formatPercent(scope.row.refund_rate_60d) }}</div>
              <div :class="getRefundClass(scope.row.refund_rate_30d)" style="color:#888;">{{ formatPercent(scope.row.refund_rate_30d) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="广告" width="130" align="center">
          <template #default="scope">
            <div class="ad-block">
              <div v-if="scope.row.acos_current_month != null">
                <el-tooltip :raw-content="true" placement="top">
                  <template #content>
                    <div style="max-width:360px;line-height:1.6;font-size:13px;">
                      <div style="font-weight:600;margin-bottom:4px;">ACoS（Advertising Cost of Sales）广告成本销售比</div>
                      <div style="color:#ddd;margin-bottom:4px;">公式：ACoS = 广告花费 ÷ 广告带来的销售额 × 100%</div>
                      <div style="color:#ddd;margin-bottom:4px;">只看广告直接带来的订单</div>
                      <div style="color:#ddd;margin-bottom:4px;">例如：广告花了 3000 美元，广告销售额 3 万美元，ACoS = 10%</div>
                      <div style="color:#ccc;">用途：衡量单次广告投放效率，用来调竞价、优化关键词</div>
                    </div>
                  </template>
                  <span>ACoS {{ formatPercentDecimal(scope.row.acos_current_month) }}</span>
                </el-tooltip>
              </div>
              <div v-if="scope.row.tacos_current_month != null" class="ad-sub">
                <el-tooltip :raw-content="true" placement="top">
                  <template #content>
                    <div style="max-width:360px;line-height:1.6;font-size:13px;">
                      <div style="font-weight:600;margin-bottom:4px;">TACoS（Total Advertising Cost of Sales）总广告成本销售比</div>
                      <div style="color:#ddd;margin-bottom:4px;">公式：TACoS = 广告花费 ÷ 店铺总销售额 × 100%</div>
                      <div style="color:#ddd;margin-bottom:4px;">看整个店铺，包括自然流量订单 + 广告订单</div>
                      <div style="color:#ddd;margin-bottom:4px;">例如：广告花 3000 美元，但店铺总销售额 10 万美元（广告 3 万 + 自然 7 万），TACoS = 3%</div>
                      <div style="color:#ccc;">用途：衡量广告对整体生意的占比，判断你是否过度依赖广告</div>
                    </div>
                  </template>
                  <span>TACoS {{ formatPercentDecimal(scope.row.tacos_current_month) }}</span>
                </el-tooltip>
              </div>
              <span v-if="scope.row.acos_current_month == null && scope.row.tacos_current_month == null" style="color:#ccc;font-size:12px;">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column width="130" align="right">
          <template #header>
            <el-tooltip content="昨日 / 当月 / 30天" placement="top">
              <span>广告费(USD)</span>
            </el-tooltip>
          </template>
          <template #default="scope">
            <div class="adfee-block">
              <div v-if="scope.row.ad_spend_yesterday != null" class="adfee-row">
                <span class="adfee-tag">昨</span>
                <span class="adfee-val">${{ formatNumber(scope.row.ad_spend_yesterday) }}</span>
              </div>
              <div v-if="scope.row.ad_spend_current_month != null" class="adfee-row">
                <span class="adfee-tag">当月</span>
                <span class="adfee-val">${{ formatNumber(scope.row.ad_spend_current_month) }}</span>
              </div>
              <div v-if="scope.row.ad_spend_30d != null" class="adfee-row">
                <span class="adfee-tag">30天</span>
                <span class="adfee-val">${{ formatNumber(scope.row.ad_spend_30d) }}</span>
              </div>
              <span v-if="scope.row.ad_spend_yesterday == null && scope.row.ad_spend_current_month == null && scope.row.ad_spend_30d == null" style="color:#ccc;font-size:12px;">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column width="170" align="center">
          <template #header>
            <el-tooltip content="导入 / 开发 / 到货" placement="top">
              <span>时间节点</span>
            </el-tooltip>
          </template>
          <template #default="scope">
            <div class="timeline-block">
              <div v-if="scope.row.created_at" class="timeline-row">
                <el-tooltip :content="getDataAgeTip(scope.row.created_at)" placement="left">
                  <span class="timeline-tag">导入</span>
                </el-tooltip>
                <span class="timeline-val">{{ formatDate(scope.row.created_at) }}</span>
              </div>
              <div v-if="scope.row.dev_time" class="timeline-row">
                <el-tooltip content="产品开发时间" placement="left">
                  <span class="timeline-tag">开发</span>
                </el-tooltip>
                <span class="timeline-val">{{ scope.row.dev_time }}</span>
              </div>
              <div v-if="scope.row.first_arrival_time" class="timeline-row">
                <el-tooltip content="最早到货时间" placement="left">
                  <span class="timeline-tag">到货</span>
                </el-tooltip>
                <span class="timeline-val">{{ scope.row.first_arrival_time }}</span>
              </div>
              <span v-if="!scope.row.created_at && !scope.row.dev_time && !scope.row.first_arrival_time" style="color:#ccc;font-size:12px;">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column width="150" align="right">
          <template #header>
            <span>采购成本</span>
          </template>
          <template #default="scope">
            <div class="cost-block">
              <div class="cost-row">
                <span class="cost-label">成本</span>
                <span class="cost-val">¥{{ formatNumber(scope.row.purchase_cost_rmb) }}</span>
              </div>
              <div class="cost-row">
                <a v-if="scope.row.supplier_reference" :href="scope.row.supplier_reference" target="_blank" class="cost-link" :title="scope.row.supplier_reference">供应商链接参考</a>
                <span v-else class="cost-link-empty">暂无供应商链接</span>
              </div>
              <div class="cost-row">
                <a v-if="scope.row.competitor_link_reference" :href="scope.row.competitor_link_reference" target="_blank" class="cost-link" :title="scope.row.competitor_link_reference">竞品链接</a>
                <span v-else class="cost-link-empty">暂无竞品链接</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" align="center" fixed="right">
          <template #default="scope">
            <el-button type="primary" text size="small" @click="viewSingleTrend(scope.row)">趋势</el-button>
            <el-button type="danger" text size="small" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :page-sizes="[20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next"
          :hide-on-single-page="false"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 底部批量操作 -->
    <transition name="slide-up">
      <div class="batch-bar" v-show="selectedRows.length > 0">
        <div class="batch-left">
          <el-checkbox v-model="selectAll" @change="handleSelectAllChange" style="margin-right:12px;" />
          <span class="batch-text">已选 <b>{{ selectedRows.length }}</b> 项</span>
          <el-divider direction="vertical" />
          <div class="batch-tags">
            <el-tooltip v-for="row in selectedRows.slice(0,20)" :key="row.id" placement="top" :show-arrow="false">
              <template #content>
                <div style="display:flex;align-items:center;gap:8px;padding:4px;">
                  <el-image :src="row.image_url || defaultImage" fit="cover" style="width:48px;height:48px;border-radius:4px;flex-shrink:0;" />
                  <div style="max-width:200px;">
                    <div style="font-weight:600;font-size:13px;color:#fff;margin-bottom:2px;">{{ row.product_name_cn || row.product_name || '无标题' }}</div>
                    <div style="font-size:11px;color:#ccc;font-family:monospace;">{{ row.asin }}</div>
                  </div>
                </div>
              </template>
              <el-tag closable size="small" type="info" effect="plain" @close="removeSelectedRow(row)" style="cursor:pointer;">
                {{ row.asin }}
              </el-tag>
            </el-tooltip>
            <el-tag v-if="selectedRows.length > 20" size="small" type="warning" effect="plain">+{{ selectedRows.length - 20 }}</el-tag>
          </div>
        </div>
        <div class="batch-right">
          <el-button type="primary" @click="handleViewTrend"><el-icon><TrendCharts /></el-icon> 查看趋势</el-button>
          <el-button type="danger" plain @click="handleBatchDelete"><el-icon><Delete /></el-icon> 批量删除</el-button>
        </div>
      </div>
    </transition>

    <!-- 导入弹窗 -->
    <el-dialog v-model="importDialogVisible" title="导入选品数据" width="460px" align-center>
      <el-upload ref="uploadRef" drag action="#" :auto-upload="false" :on-change="handleFileChange" :limit="1" accept=".csv,.xlsx,.xls">
        <el-icon class="el-icon--upload" size="40"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽文件到此处或 <em>点击上传</em></div>
        <template #tip><div class="el-upload__tip">支持 .csv / .xlsx / .xls，每次导入生成一个新批次</div></template>
      </el-upload>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitImport" :loading="importLoading">确定导入</el-button>
      </template>
    </el-dialog>

    <!-- 趋势分析弹窗 -->
    <el-dialog v-model="trendDialogVisible" title="产品趋势分析" width="92%" top="4vh" :destroy-on-close="true" class="trend-dialog" align-center>
      <div class="trend-toolbar" v-if="trendProducts.length">
        <div class="trend-metric-select">
          <span class="trend-label">指标</span>
          <el-select v-model="trendMetric" style="width:180px" @change="renderTrendChart">
            <el-option-group label="销量">
              <el-option label="30天销量" value="sales_30d" />
              <el-option label="14天销量" value="sales_14d" />
              <el-option label="7天销量" value="sales_7d" />
              <el-option label="3天销量" value="sales_3d" />
              <el-option label="1天销量" value="sales_1d" />
            </el-option-group>
            <el-option-group label="价格">
              <el-option label="售价" value="selling_price_usd" />
              <el-option label="促销价" value="promo_price_usd" />
              <el-option label="原价" value="original_price_usd" />
              <el-option label="建议售价" value="suggested_price_usd" />
            </el-option-group>
            <el-option-group label="毛利">
              <el-option label="30天毛利" value="gross_profit_30d_usd" />
              <el-option label="7天毛利" value="gross_profit_7d_usd" />
            </el-option-group>
            <el-option-group label="利润率">
              <el-option label="30天毛利率" value="profit_margin_30d" />
              <el-option label="7天毛利率" value="profit_margin_7d" />
            </el-option-group>
            <el-option-group label="退款率">
              <el-option label="30天退款率" value="refund_rate_30d" />
              <el-option label="60天退款率" value="refund_rate_60d" />
            </el-option-group>
            <el-option-group label="广告">
              <el-option label="ACoS" value="acos_current_month" />
              <el-option label="TACoS" value="tacos_current_month" />
              <el-option label="昨日广告费" value="ad_spend_yesterday" />
              <el-option label="当月广告费" value="ad_spend_current_month" />
              <el-option label="30天广告费" value="ad_spend_30d" />
            </el-option-group>
            <el-option-group label="其他">
              <el-option label="采购成本" value="purchase_cost_rmb" />
              <el-option label="评分" value="rating" />
              <el-option label="评论数" value="review_count" />
            </el-option-group>
          </el-select>
        </div>
        <div class="trend-selected-products">
          <div v-for="p in trendProducts.slice(0,10)" :key="p.asin" class="trend-mini-product">
            <el-image :src="p.image_url || defaultImage" fit="cover" style="width:28px;height:28px;border-radius:4px;" />
            <span class="trend-mini-name" :title="p.product_name_cn">{{ p.product_name_cn || p.asin }}</span>
          </div>
          <span v-if="trendProducts.length > 10" class="trend-more">+{{ trendProducts.length - 10 }}</span>
        </div>
      </div>

      <div class="trend-chart-area" v-loading="trendLoading">
        <canvas ref="trendChartRef" class="trend-canvas"></canvas>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, Picture, TrendCharts, UploadFilled, StarFilled
} from '@element-plus/icons-vue'
import { Chart } from 'chart.js/auto'
import {
  getProductBoardList,
  getProductBoardFilterOptions, getProductBoardTrend, deleteProductBoardItem,
  batchDeleteProductBoardItems, importProductBoard, exportProductBoard,
  toggleProductBoardListed
} from '@/services/api.js'

const COLOR_PALETTE = ['#667eea','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#84cc16','#6366f1']

export default {
  name: 'ProductBoardView',
  components: {
    Search, Picture, TrendCharts, UploadFilled, StarFilled
  },
  setup() {
    const loading = ref(false)
    const exportLoading = ref(false)
    const importLoading = ref(false)
    const trendLoading = ref(false)
    const importDialogVisible = ref(false)
    const trendDialogVisible = ref(false)
    const tableRef = ref(null)
    const uploadRef = ref(null)
    const productList = ref([])
    const amazonStatusList = ref([])
    const selectedRows = ref([])
    const selectedRowMap = ref(new Map())
    const selectAll = ref(false)
    const importFile = ref(null)
    const trendProducts = ref([])
    const trendChartRef = ref(null)
    let trendChart = null
    const trendMetric = ref('sales_30d')

    const defaultImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA1NiA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIgZmlsbD0iI2Y1ZjdmYSIvPgo8cGF0aCBkPSJNMjggMjBDMjQuMTM0IDIwIDIxIDIzLjEzNCAyMSAyN0MyMSAzMC44NjYgMjQuMTM0IDM0IDI4IDM0QzMxLjg2NiAzNCAzNSAzMC44NjYgMzUgMjdDMzUgMjMuMTM0IDMxLjg2NiAyMCAyOCAyMFoiIGZpbGw9IiNkZGUiLz4KPC9zdmc+'

    const searchForm = reactive({ keyword: '', amazon_status: '', is_listed: null, is_new_product: null, min_sales: null, sort_by: 'sales_30d', sort_dir: 'desc' })
    const pagination = reactive({ page: 1, page_size: 20, total: 0 })

    const formatNumber = (val) => {
      if (val == null || val === '') return '-'
      const num = Number(val)
      if (isNaN(num)) return '-'
      if (Number.isInteger(num)) return num.toLocaleString()
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    const formatDate = (val) => {
      if (!val) return '-'
      return String(val).split(' ')[0]
    }

    // 后端已返回百分比数值（如 36.62 表示 36.62%），直接格式化
    // 后端已返回百分比数值（如 36.62 表示 36.62%），直接格式化
    const formatPercent = (val) => {
      if (val == null || val === '') return '-'
      const num = Number(val)
      if (isNaN(num)) return '-'
      return num.toFixed(1) + '%'
    }

    // 后端返回的是小数（如 0.193），需要乘100显示为百分比
    const formatPercentDecimal = (val) => {
      if (val == null || val === '') return '-'
      const num = Number(val)
      if (isNaN(num)) return '-'
      return (num * 100).toFixed(1) + '%'
    }

    // 数据时效提示：根据导入时间计算距今天数
    const getDataAgeTip = (createdAt) => {
      if (!createdAt) return ''
      const datePart = createdAt.split(' ')[0]
      if (!datePart) return ''
      const importDate = new Date(datePart + 'T00:00:00')
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const diffMs = today - importDate
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      return `该ASIN所有指标最新数据是截止 ${datePart}，距今已 ${diffDays}天。`
    }

    const getProfitClass = (val) => {
      const num = Number(val)
      if (isNaN(num) || num >= 0) return 'profit-pos'
      return 'profit-neg'
    }

    const getMarginTagType = (val) => {
      const num = Number(val)
      if (isNaN(num)) return 'info'
      if (num >= 30) return 'success'
      if (num >= 15) return 'warning'
      return 'danger'
    }

    const getRefundClass = (val) => {
      const num = Number(val)
      if (isNaN(num)) return ''
      if (num <= 3) return 'text-green'
      if (num <= 8) return 'text-orange'
      return 'text-red'
    }

    const getProductAgeTip = (devTime) => {
      if (!devTime) return ''
      const devDate = new Date(devTime)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const devDay = new Date(devDate.getFullYear(), devDate.getMonth(), devDate.getDate())
      const diffMs = today - devDay
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const dateStr = devTime.split(' ')[0] || devTime
      const isNew = diffDays <= 90
      return `开发于 ${dateStr}，距今 ${diffDays} 天，${isNew ? '属于新品（≤3个月）' : '属于老品（>3个月）'}`
    }

    const fetchFilters = async () => {
      try {
        const res = await getProductBoardFilterOptions()
        if (res.data.status === 'success') amazonStatusList.value = res.data.data?.amazon_statuses || []
      } catch (e) { console.error(e) }
    }

    const fetchList = async () => {
      loading.value = true
      try {
        const params = { page: pagination.page, page_size: pagination.page_size, sort_by: searchForm.sort_by, sort_dir: searchForm.sort_dir }
        if (searchForm.keyword) params.keyword = searchForm.keyword
        if (searchForm.amazon_status) params.amazon_status = searchForm.amazon_status
        if (searchForm.min_sales != null && searchForm.min_sales !== '') params.min_sales = searchForm.min_sales
        if (searchForm.is_listed !== null && searchForm.is_listed !== '') params.is_listed = searchForm.is_listed
        if (searchForm.is_new_product !== null && searchForm.is_new_product !== '') params.is_new_product = searchForm.is_new_product
        const res = await getProductBoardList(params)
        if (res.data.status === 'success') {
          const d = res.data.data || {}
          productList.value = (d.list || []).map(item => ({
            ...item,
            is_listed: !!item.is_listed
          }))
          pagination.total = d.total || 0
          pagination.page = d.page || 1
          pagination.page_size = d.page_size || 20
        } else {
          ElMessage.error(res.data.message || '获取失败')
          productList.value = []; pagination.total = 0
        }
      } catch (error) {
        ElMessage.error('获取失败: ' + (error.response?.data?.message || error.message))
        productList.value = []; pagination.total = 0
      } finally {
        loading.value = false
        nextTick(() => { updateSelectAllState() })
      }
    }

    const refreshAll = async () => { 
      await fetchList()
    }

    const clearSelection = () => {
      selectedRowMap.value.clear()
      selectedRows.value = []
      selectAll.value = false
      tableRef.value?.clearSelection()
    }

    const updateSelectAllState = () => {
      if (productList.value.length === 0) { selectAll.value = false; return }
      const currentPageSelected = productList.value.filter(r => selectedRowMap.value.has(r.id))
      selectAll.value = currentPageSelected.length === productList.value.length
    }

    const handleSearch = () => { clearSelection(); pagination.page = 1; fetchList() }
    const resetSearch = () => {
      searchForm.keyword = ''; searchForm.amazon_status = ''; searchForm.is_listed = null; searchForm.is_new_product = null; searchForm.min_sales = null
      searchForm.sort_by = 'sales_30d'; searchForm.sort_dir = 'desc'
      clearSelection(); pagination.page = 1; fetchList()
    }
    const handlePageChange = (page) => { pagination.page = page; fetchList() }
    const handleSizeChange = (size) => { pagination.page_size = size; clearSelection(); pagination.page = 1; fetchList() }

    const handleSelect = (selection, row) => {
      const isSelected = selection.some(r => r.id === row.id)
      if (isSelected) { selectedRowMap.value.set(row.id, row) }
      else { selectedRowMap.value.delete(row.id) }
      selectedRows.value = Array.from(selectedRowMap.value.values())
      updateSelectAllState()
    }
    const handleSelectAll = (selection) => {
      if (selection.length > 0) {
        for (const row of selection) { selectedRowMap.value.set(row.id, row) }
      } else {
        for (const row of productList.value) { selectedRowMap.value.delete(row.id) }
      }
      selectedRows.value = Array.from(selectedRowMap.value.values())
      updateSelectAllState()
    }
    const removeSelectedRow = (row) => {
      selectedRowMap.value.delete(row.id)
      selectedRows.value = Array.from(selectedRowMap.value.values())
      tableRef.value?.toggleRowSelection(row, false)
      updateSelectAllState()
    }

    const handleSelectAllChange = (val) => {
      if (val) {
        for (const row of productList.value) {
          selectedRowMap.value.set(row.id, row)
          tableRef.value?.toggleRowSelection(row, true)
        }
      } else {
        for (const row of productList.value) {
          selectedRowMap.value.delete(row.id)
          tableRef.value?.toggleRowSelection(row, false)
        }
      }
      selectedRows.value = Array.from(selectedRowMap.value.values())
      updateSelectAllState()
    }

    const handleToggleListed = async (row, val) => {
      try {
        const res = await toggleProductBoardListed(row.asin, val)
        if (res.data.status === 'success') {
          row.is_listed = val
          ElMessage.success(val ? '已标记为已上架' : '已标记为未上架')
        } else {
          row.is_listed = !val
          ElMessage.error(res.data.message || '操作失败')
        }
      } catch (e) {
        row.is_listed = !val
        ElMessage.error('操作失败')
      }
    }

    const handleDelete = (row) => {
      ElMessageBox.confirm(`确定删除 ASIN "${row.asin}" 吗？`, '提示', { type: 'warning' }).then(async () => {
        try {
          const res = await deleteProductBoardItem(row.id)
          if (res.data.status === 'success') {
            ElMessage.success('删除成功')
            selectedRowMap.value.delete(row.id)
            selectedRows.value = Array.from(selectedRowMap.value.values())
            updateSelectAllState()
            await fetchList()
          }
          else ElMessage.error(res.data.message || '删除失败')
        } catch (e) { ElMessage.error('删除失败') }
      }).catch(()=>{})
    }

    const handleBatchDelete = () => {
      const ids = selectedRows.value.map(r => r.id)
      ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条记录吗？`, '提示', { type: 'warning' }).then(async () => {
        try {
          const res = await batchDeleteProductBoardItems(ids)
          if (res.data.status === 'success') { ElMessage.success('批量删除成功'); clearSelection(); await fetchList() }
          else ElMessage.error(res.data.message || '删除失败')
        } catch (e) { ElMessage.error('删除失败') }
      }).catch(()=>{})
    }

    const handleImportClick = () => { importDialogVisible.value = true; importFile.value = null }
    const handleFileChange = (file) => { importFile.value = file.raw }
    const submitImport = async () => {
      if (!importFile.value) { ElMessage.warning('请选择文件'); return }
      importLoading.value = true
      try {
        const fd = new FormData(); fd.append('file', importFile.value)
        const res = await importProductBoard(fd)
        if (res.data.status === 'success') {
          ElMessage.success(res.data.message || '导入成功')
          importDialogVisible.value = false; await refreshAll()
        } else ElMessage.error(res.data.message || '导入失败')
      } catch (e) { ElMessage.error('导入失败') } finally { importLoading.value = false }
    }

    const handleExport = async () => {
      exportLoading.value = true
      try {
        const params = {}
        if (searchForm.keyword) params.keyword = searchForm.keyword
        if (searchForm.amazon_status) params.amazon_status = searchForm.amazon_status
        if (searchForm.is_listed !== null && searchForm.is_listed !== '') params.is_listed = searchForm.is_listed
        const res = await exportProductBoard(params)
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `product-board-export.csv`
        link.click()
        URL.revokeObjectURL(link.href)
        ElMessage.success('导出成功')
      } catch (e) {
        ElMessage.error('导出失败')
      } finally {
        exportLoading.value = false
      }
    }

    // ============ 趋势图（Chart.js 单图+下拉筛选） ============
    const METRIC_CONFIG = {
      // 销量
      sales_30d: { label: '30天销量', isMoney: false, isPercent: false, isDecimalPercent: false },
      sales_14d: { label: '14天销量', isMoney: false, isPercent: false, isDecimalPercent: false },
      sales_7d: { label: '7天销量', isMoney: false, isPercent: false, isDecimalPercent: false },
      sales_3d: { label: '3天销量', isMoney: false, isPercent: false, isDecimalPercent: false },
      sales_1d: { label: '1天销量', isMoney: false, isPercent: false, isDecimalPercent: false },
      // 价格
      selling_price_usd: { label: '售价', isMoney: true, isPercent: false, isDecimalPercent: false },
      promo_price_usd: { label: '促销价', isMoney: true, isPercent: false, isDecimalPercent: false },
      original_price_usd: { label: '原价', isMoney: true, isPercent: false, isDecimalPercent: false },
      suggested_price_usd: { label: '建议售价', isMoney: true, isPercent: false, isDecimalPercent: false },
      // 毛利
      gross_profit_30d_usd: { label: '30天毛利', isMoney: true, isPercent: false, isDecimalPercent: false },
      gross_profit_7d_usd: { label: '7天毛利', isMoney: true, isPercent: false, isDecimalPercent: false },
      // 利润率
      profit_margin_30d: { label: '30天毛利率', isMoney: false, isPercent: true, isDecimalPercent: false },
      profit_margin_7d: { label: '7天毛利率', isMoney: false, isPercent: true, isDecimalPercent: false },
      // 退款率
      refund_rate_30d: { label: '30天退款率', isMoney: false, isPercent: true, isDecimalPercent: false },
      refund_rate_60d: { label: '60天退款率', isMoney: false, isPercent: true, isDecimalPercent: false },
      // 广告
      acos_current_month: { label: 'ACoS', isMoney: false, isPercent: false, isDecimalPercent: true },
      tacos_current_month: { label: 'TACoS', isMoney: false, isPercent: false, isDecimalPercent: true },
      ad_spend_yesterday: { label: '昨日广告费', isMoney: true, isPercent: false, isDecimalPercent: false },
      ad_spend_current_month: { label: '当月广告费', isMoney: true, isPercent: false, isDecimalPercent: false },
      ad_spend_30d: { label: '30天广告费', isMoney: true, isPercent: false, isDecimalPercent: false },
      // 其他
      purchase_cost_rmb: { label: '采购成本', isMoney: false, isPercent: false, isDecimalPercent: false, isRmb: true },
      rating: { label: '评分', isMoney: false, isPercent: false, isDecimalPercent: false },
      review_count: { label: '评论数', isMoney: false, isPercent: false, isDecimalPercent: false }
    }

    const formatTrendValue = (val, config) => {
      if (val == null) return '-'
      if (config.isDecimalPercent) return (Number(val) * 100).toFixed(1) + '%'
      if (config.isPercent) return Number(val).toFixed(1) + '%'
      if (config.isMoney) return '$' + Number(val).toFixed(2)
      if (config.isRmb) return '¥' + Number(val).toFixed(2)
      return Number(val).toLocaleString()
    }

    const renderTrendChart = () => {
      if (trendChart) { trendChart.destroy(); trendChart = null }
      nextTick(() => {
        if (!trendProducts.value.length || !trendChartRef.value) return
        const metric = trendMetric.value
        const config = METRIC_CONFIG[metric] || METRIC_CONFIG.sales_30d

        // 统一时间轴
        const allDatesSet = new Set()
        trendProducts.value.forEach(p => {
          (p.data_points || []).forEach(d => allDatesSet.add(d.created_at || ''))
        })
        const dateAxis = Array.from(allDatesSet).filter(Boolean).sort()
        const labels = dateAxis.map(d => {
          const datePart = d.split(' ')[0]
          if (datePart) {
            const parts = datePart.split('-')
            if (parts.length >= 3) return `${parts[1]}-${parts[2]}`
          }
          return d
        })

        // 构建 datasets
        const datasets = trendProducts.value.map((product, idx) => {
          const dataMap = new Map()
          ;(product.data_points || []).forEach(d => {
            dataMap.set(d.created_at || '', d[metric] ?? null)
          })
          const color = COLOR_PALETTE[idx % COLOR_PALETTE.length]
          return {
            label: product.product_name_cn || product.asin,
            data: dateAxis.map(d => dataMap.get(d) ?? null),
            borderColor: color,
            backgroundColor: color + '15',
            borderWidth: 2.5,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#fff',
            pointBorderWidth: 2,
            fill: false,
            spanGaps: true
          }
        })

        // 平均值基准线（所有指标通用）
        const allValues = []
        trendProducts.value.forEach(p => {
          (p.data_points || []).forEach(d => {
            const v = d[metric]
            if (v != null && !isNaN(Number(v))) allValues.push(Number(v))
          })
        })
        if (allValues.length) {
          const avg = allValues.reduce((a, b) => a + b, 0) / allValues.length
          datasets.push({
            label: '平均值',
            data: dateAxis.map(() => avg),
            borderColor: '#999',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            tension: 0
          })
        }

        const ctx = trendChartRef.value.getContext('2d')
        trendChart = new Chart(ctx, {
          type: 'line',
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'top',
                labels: { usePointStyle: true, boxWidth: 8, padding: 15, font: { size: 12 } }
              },
              tooltip: {
                backgroundColor: 'rgba(255,255,255,0.96)',
                titleColor: '#1a1a2e',
                bodyColor: '#555',
                borderColor: '#eee',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                callbacks: {
                  label: (context) => {
                    const val = context.parsed.y
                    return context.dataset.label + ': ' + formatTrendValue(val, config)
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: '#999', font: { size: 11 } }
              },
              y: {
                grid: { color: '#f2f2f2' },
                ticks: {
                  color: '#999',
                  font: { size: 11 },
                  callback: (val) => formatTrendValue(val, config)
                }
              }
            }
          }
        })
      })
    }

    const handleViewTrend = async () => {
      if (selectedRows.value.length === 0) return
      const asins = selectedRows.value.map(r => r.asin).join(',')
      trendDialogVisible.value = true
      trendLoading.value = true
      trendProducts.value = []
      try {
        const res = await getProductBoardTrend(asins)
        if (res.data.status === 'success') {
          trendProducts.value = res.data.data?.products || []
          renderTrendChart()
        } else ElMessage.error(res.data.message || '获取趋势失败')
      } catch (e) { ElMessage.error('获取趋势失败') } finally { trendLoading.value = false }
    }

    const viewSingleTrend = async (row) => {
      trendDialogVisible.value = true
      trendLoading.value = true
      trendProducts.value = []
      try {
        const res = await getProductBoardTrend(row.asin)
        if (res.data.status === 'success') {
          trendProducts.value = res.data.data?.products || []
          renderTrendChart()
        } else ElMessage.error(res.data.message || '获取趋势失败')
      } catch (e) { ElMessage.error('获取趋势失败') } finally { trendLoading.value = false }
    }

    const handleResize = () => {
      if (trendChart) trendChart.resize()
    }

    watch(trendDialogVisible, (val) => {
      if (!val && trendChart) {
        nextTick(() => { trendChart.destroy(); trendChart = null })
      }
    })

    onMounted(() => { refreshAll(); fetchFilters(); window.addEventListener('resize', handleResize) })
    onUnmounted(() => { window.removeEventListener('resize', handleResize); if (trendChart) { trendChart.destroy(); trendChart = null } })

    return {
      loading, exportLoading, importLoading, trendLoading,
      importDialogVisible, trendDialogVisible, tableRef, uploadRef,
      productList, amazonStatusList, selectedRows, selectAll,
      searchForm, pagination, defaultImage,
      trendChartRef, trendProducts, trendMetric,
      formatNumber, formatPercent, formatPercentDecimal, formatDate, getDataAgeTip, getProductAgeTip,
      getProfitClass, getMarginTagType, getRefundClass,
      handleSearch, resetSearch, handlePageChange, handleSizeChange,
      handleSelect, handleSelectAll, handleSelectAllChange, removeSelectedRow,
      handleToggleListed, handleDelete, handleBatchDelete,
      handleImportClick, handleFileChange, submitImport, handleExport,
      handleViewTrend, viewSingleTrend, renderTrendChart
    }
  }
}
</script>

<style scoped>
.product-board-page {
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px 24px 100px;
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

/* ===== 统计卡片 ===== */
.stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: #fff;
  border-radius: 14px;
  padding: 18px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 4px solid transparent;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}
.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-body {
  flex: 1;
  min-width: 0;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.stat-blue  { border-left-color: #667eea; }
.stat-blue .stat-icon { background: #f0f3ff; color: #667eea; }
.stat-purple { border-left-color: #8b5cf6; }
.stat-purple .stat-icon { background: #f5f3ff; color: #8b5cf6; }
.stat-green { border-left-color: #10b981; }
.stat-green .stat-icon { background: #ecfdf5; color: #10b981; }
.stat-orange { border-left-color: #f59e0b; }
.stat-orange .stat-icon { background: #fffbeb; color: #f59e0b; }
.stat-red { border-left-color: #ef4444; }
.stat-red .stat-icon { background: #fef2f2; color: #ef4444; }
.stat-cyan { border-left-color: #06b6d4; }
.stat-cyan .stat-icon { background: #ecfeff; color: #06b6d4; }

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
:deep(.product-row:hover) { background-color: #fafbff !important; }

/* 产品单元格 */
.product-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}
.product-thumb {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  flex-shrink: 0;
  border: 1px solid #f0f0f0;
  background: #fafafa;
}
.thumb-placeholder {
  width: 64px; height: 64px; border-radius: 10px;
  background: #f5f7fa; display: flex; align-items: center; justify-content: center;
  color: #ccc; font-size: 22px;
}
.product-meta { min-width: 0; flex: 1; }
.product-name {
  font-size: 14px; font-weight: 600; color: #1a1a2e;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 3px;
}
.product-asin {
  font-size: 12px; color: #888; font-family: monospace;
  margin-bottom: 5px;
}
.product-tags {
  display: flex; align-items: center; gap: 6px;
}
.rating-badge {
  display: inline-flex; align-items: center; gap: 2px;
  font-size: 12px; color: #ff9900; font-weight: 600;
  background: #fff8f0; padding: 1px 6px; border-radius: 10px;
}

/* 价格 */
.price-block {
  display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
}
.price-row {
  display: flex; align-items: center; gap: 5px;
}
.price-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1;
  flex-shrink: 0;
}
.tag-normal { background: #e8f4fd; color: #1890ff; }
.tag-promo  { background: #fff2e8; color: #fa8c16; }
.tag-origin { background: #f5f5f5; color: #aaa; }
.tag-suggest { background: #f6ffed; color: #52c41a; }
.main-price { font-size: 14px; font-weight: 700; color: #1a1a2e; }
.promo-price { font-size: 12px; color: #bbb; text-decoration: line-through; }
.suggest-price { font-size: 12px; color: #52c41a; font-weight: 500; }

/* 毛利颜色 */
.profit-pos { color: #10b981; font-weight: 600; }
.profit-neg { color: #ef4444; font-weight: 600; }

/* 广告 */
.ad-block { font-size: 12px; color: #666; line-height: 1.5; }
.ad-sub { color: #aaa; font-size: 11px; }

/* 广告费 */
.adfee-block { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.adfee-row { display: flex; align-items: center; gap: 4px; }
.cost-block { line-height: 1.6; text-align: right; font-size: 13px; }
.cost-row { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
.cost-label { color: #888; font-size: 11px; }
.cost-val { color: #555; font-weight: 500; }
.cost-link { color: #409eff; font-size: 12px; text-decoration: none; }
.cost-link:hover { text-decoration: underline; }
.cost-link-empty { color: #f56c6c; font-size: 12px; cursor: default; }
.adfee-tag { font-size: 10px; color: #999; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; line-height: 1; }
.adfee-val { font-size: 12px; color: #333; }

/* 时间节点 */
.timeline-block { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 2px 0; }
.timeline-row { display: flex; align-items: center; gap: 5px; width: 100%; justify-content: center; }
.timeline-tag { font-size: 10px; color: #888; background: #f0f0f0; padding: 2px 5px; border-radius: 3px; line-height: 1; flex-shrink: 0; }
.timeline-val { font-size: 12px; color: #444; font-weight: 500; }

/* 文字颜色 */
.text-green { color: #10b981; }
.text-orange { color: #f59e0b; }
.text-red { color: #ef4444; font-weight: 600; }

/* 分页 */
.pagination-wrap {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
}

/* ===== 批量操作栏 ===== */
.batch-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border-radius: 12px;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  z-index: 100;
  min-width: 560px;
  max-width: 900px;
  width: auto;
}
.batch-left {
  display: flex; align-items: center; gap: 10px; overflow: hidden;
}
.batch-text { font-size: 14px; color: #555; }
.batch-tags {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  max-width: 380px; overflow: hidden;
}
.batch-right { display: flex; gap: 10px; flex-shrink: 0; }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateX(-50%) translateY(100px); opacity: 0; }

/* ===== 趋势弹窗 ===== */
.trend-dialog :deep(.el-dialog__body) { padding: 0 20px 20px; }
.trend-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;
  gap: 16px;
  flex-wrap: wrap;
}
.trend-metric-select {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
}
.trend-label {
  font-size: 13px; color: #666; font-weight: 500;
}
.trend-selected-products {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.trend-mini-product {
  display: flex; align-items: center; gap: 5px;
  background: #f8f9fa; padding: 3px 8px 3px 3px; border-radius: 16px;
}
.trend-mini-name {
  font-size: 11px; color: #555; max-width: 90px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.trend-more {
  font-size: 11px; color: #888; background: #f0f0f0;
  padding: 3px 8px; border-radius: 10px;
}
.trend-chart-area {
  background: #fafbfc;
  border-radius: 14px;
  padding: 16px;
  border: 1px solid #f0f0f0;
  height: 480px;
}
.trend-canvas {
  width: 100% !important;
  height: 100% !important;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .product-board-page { padding: 16px 16px 100px; }
  .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .filter-bar { flex-direction: column; align-items: stretch; }
  .filter-group { justify-content: stretch; }
  .batch-bar {
    left: 12px; right: 12px; transform: none;
    min-width: auto; width: auto;
    flex-direction: column; gap: 10px; padding: 12px;
  }
  .batch-tags { max-width: 260px; }
  .trend-chart-body { height: 260px; }
}
</style>
