<template>
  <div class="ad-report-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><Promotion /></el-icon>
          广告效果报表
        </h1>
        <p class="page-subtitle">多维度广告数据分析 · ACOS · ROAS · 归因追踪</p>
      </div>
      <div class="header-actions">
        <el-button plain @click="showGuide = true">
          <el-icon><Document /></el-icon> 指标说明
        </el-button>
        <el-select v-model="selectedShop" placeholder="全部店铺" clearable style="width:160px" @change="handleShopChange">
          <el-option label="全部店铺" :value="null" />
          <el-option v-for="shop in shopList" :key="shop.id" :label="shop.shop_name" :value="shop.id" />
        </el-select>
        <el-button type="primary" :loading="generating" @click="handleGenerate">
          <el-icon><Refresh /></el-icon> 生成报表
        </el-button>
      </div>
    </div>

    <!-- 筛选栏：与店铺报表一致，使用两个独立日期选择器 -->
    <div class="filter-bar">
      <el-radio-group v-model="filter.type" @change="handleTypeChange">
        <el-radio-button label="daily">日报</el-radio-button>
        <el-radio-button label="weekly">周报</el-radio-button>
        <el-radio-button label="monthly">月报</el-radio-button>
      </el-radio-group>
      <div class="date-range-pickers">
        <el-date-picker
          v-model="startDate"
          type="date"
          placeholder="开始日期"
          value-format="YYYY-MM-DD"
          class="date-start-picker"
          @change="onStartDateChange"
        />
        <span class="date-separator">~</span>
        <el-date-picker
          v-model="endDate"
          type="date"
          placeholder="结束日期"
          value-format="YYYY-MM-DD"
          class="date-end-picker"
          @change="onEndDateChange"
        />
      </div>
      <el-button type="primary" @click="fetchAllData"><el-icon><Search /></el-icon> 查询</el-button>
    </div>

    <!-- 指标说明弹窗 -->
    <el-dialog v-model="showGuide" title="📖 广告指标解读手册" width="720px" :close-on-click-modal="true" destroy-on-close>
      <div class="guide-body">
        <h4>🚦 基础流量指标</h4>
        <el-table :data="guideMetrics" size="small" style="margin-bottom:20px" :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}">
          <el-table-column prop="name" label="指标" width="90" />
          <el-table-column prop="meaning" label="含义" min-width="140" />
          <el-table-column prop="formula" label="计算公式" min-width="120" />
          <el-table-column prop="judge" label="好坏判断" min-width="180" />
        </el-table>

        <h4>🔄 转化指标（7天 vs 30天）</h4>
        <p class="guide-tip">
          <el-icon><InfoFilled /></el-icon>
          买家点击广告后，<strong>7天内</strong>下单算广告归因；<strong>30天内</strong>是给高客单价/长决策周期产品参考的。日常看 <strong>7d</strong> 就够了。
        </p>
        <el-table :data="guideConversion" size="small" style="margin-bottom:20px" :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}">
          <el-table-column prop="name" label="指标" width="100" />
          <el-table-column prop="meaning" label="含义" min-width="120" />
          <el-table-column prop="formula" label="计算公式" min-width="160" />
          <el-table-column prop="judge" label="好坏判断" min-width="180" />
        </el-table>

        <h4>🌰 实际例子</h4>
        <div class="guide-example">
          <p>假设一天广告数据：曝光 <strong>10,000</strong>、点击 <strong>50</strong>、花费 <strong>$30</strong>、订单 <strong>3</strong>、销售 <strong>$90</strong></p>
          <ul>
            <li><strong>CTR</strong> = 50÷10,000 = <span class="tag-good">0.5%</span> ✅（及格偏上）</li>
            <li><strong>CPC</strong> = 30÷50 = <span class="tag-good">$0.6</span> ✅（正常）</li>
            <li><strong>ACOS</strong> = 30÷90 = <span class="tag-warn">33.3%</span> ⚠️（略高，需优化）</li>
            <li><strong>ROAS</strong> = 90÷30 = <span class="tag-warn">3.0</span> ⚠️（刚好回本边缘）</li>
          </ul>
        </div>

        <h4>📌 新手看数据的优先级</h4>
        <div class="guide-priority">
          <div class="priority-item">
            <span class="priority-num">1</span>
            <div>
              <strong>第一看 ACOS</strong> — 是否亏钱一目了然
            </div>
          </div>
          <div class="priority-item">
            <span class="priority-num">2</span>
            <div>
              <strong>第二看 CTR</strong> — 判断 Listing 吸引力
            </div>
          </div>
          <div class="priority-item">
            <span class="priority-num">3</span>
            <div>
              <strong>第三看 CPC</strong> — 判断竞价环境激烈程度
            </div>
          </div>
          <div class="priority-item">
            <span class="priority-num">4</span>
            <div>
              <strong>第四看 曝光</strong> — 判断流量入口够不够大
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 汇总卡片 -->
    <div class="summary-section">
      <div class="summary-card card-impressions">
        <div class="card-icon"><el-icon size="24"><View /></el-icon></div>
        <div class="card-body">
          <div class="card-label">总曝光</div>
          <div class="card-value">{{ formatK(summary.total_impressions) }}</div>
        </div>
      </div>
      <div class="summary-card card-clicks">
        <div class="card-icon"><el-icon size="24"><Mouse /></el-icon></div>
        <div class="card-body">
          <div class="card-label">总点击</div>
          <div class="card-value">{{ formatNumber(summary.total_clicks, 0) }}</div>
        </div>
      </div>
      <div class="summary-card card-spend">
        <div class="card-icon"><el-icon size="24"><Money /></el-icon></div>
        <div class="card-body">
          <div class="card-label">广告花费</div>
          <div class="card-value">${{ formatNumber(summary.total_ad_spend) }}</div>
        </div>
      </div>
      <div class="summary-card card-ctr">
        <div class="card-icon"><el-icon size="24"><TrendCharts /></el-icon></div>
        <div class="card-body">
          <div class="card-label">CTR</div>
          <div class="card-value">{{ formatPct(summary.avg_ctr) }}</div>
        </div>
      </div>
      <div class="summary-card card-cpc">
        <div class="card-icon"><el-icon size="24"><Coin /></el-icon></div>
        <div class="card-body">
          <div class="card-label">CPC</div>
          <div class="card-value">${{ formatNumber(summary.avg_cpc) }}</div>
        </div>
      </div>
      <div class="summary-card card-acos">
        <div class="card-icon"><el-icon size="24"><DataAnalysis /></el-icon></div>
        <div class="card-body">
          <div class="card-label">ACOS (7d)</div>
          <div class="card-value" :class="getAcosClass(summary.avg_acos_7d)">{{ formatPct(summary.avg_acos_7d) }}</div>
        </div>
      </div>
      <div class="summary-card card-roas">
        <div class="card-icon"><el-icon size="24"><Histogram /></el-icon></div>
        <div class="card-body">
          <div class="card-label">ROAS (7d)</div>
          <div class="card-value">{{ formatNumber(summary.avg_roas_7d, 2) }}x</div>
        </div>
      </div>
      <div class="summary-card card-orders">
        <div class="card-icon"><el-icon size="24"><ShoppingCart /></el-icon></div>
        <div class="card-body">
          <div class="card-label">订单 (7d)</div>
          <div class="card-value">{{ formatNumber(summary.total_orders_7d, 0) }}</div>
        </div>
      </div>
      <div class="summary-card card-sales">
        <div class="card-icon"><el-icon size="24"><Wallet /></el-icon></div>
        <div class="card-body">
          <div class="card-label">销售 (7d)</div>
          <div class="card-value">${{ formatNumber(summary.total_sales_7d) }}</div>
        </div>
      </div>
    </div>

    <!-- 趋势图 -->
    <div class="chart-card">
      <div class="chart-header">
        <h3><el-icon><DataLine /></el-icon> 广告趋势走势</h3>
        <div class="chart-filter-bar">
          <el-select v-model="trendFilter.campaign_id" placeholder="全部广告活动" clearable filterable style="width:190px" @change="onTrendCampaignChange">
            <el-option label="全部广告活动" value="" />
            <el-option v-for="c in campaignOptions" :key="c.campaign_id" :label="c.campaign_name" :value="c.campaign_id" />
          </el-select>
          <el-select v-model="trendFilter.ad_group_id" placeholder="全部广告组" clearable filterable style="width:170px" :disabled="adGroupDisabled" @change="onTrendAdGroupChange">
            <el-option label="全部广告组" value="" />
            <el-option v-for="g in adGroupOptions" :key="g.ad_group_id" :label="g.ad_group_name" :value="g.ad_group_id" />
          </el-select>
          <el-select v-model="trendFilter.advertised_asin" placeholder="全部广告商品" clearable filterable style="width:240px" :disabled="productDisabled" @change="onTrendProductChange">
            <el-option label="全部广告商品" value="" />
            <el-option v-for="p in productOptions" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
          <el-button plain size="small" @click="resetTrendFilter">
            <el-icon><RefreshLeft /></el-icon> 重置
          </el-button>
        </div>
      </div>
      <div class="chart-legend-hint" style="margin-bottom:8px;">
        <span class="hint-bar">花费</span>
        <span class="hint-bar sales">销售额</span>
        <span class="hint-line acos">ACOS</span>
        <span class="hint-line ctr">CTR</span>
        <span class="hint-line cpc">CPC</span>
      </div>
      <div ref="trendChartRef" class="chart-body" style="height:340px;"></div>
    </div>

    <!-- 数据表格：三层可展开（日期 -> 广告活动 -> 广告商品） -->
    <div class="table-card">
      <div class="table-header">
        <h3><el-icon><List /></el-icon> 广告明细</h3>
        <div class="table-actions">
          <el-button size="small" plain @click="expandAllRows">
            <el-icon><ArrowDown /></el-icon> 一键展开
          </el-button>
          <el-button size="small" plain @click="collapseAllRows">
            <el-icon><ArrowUp /></el-icon> 一键折叠
          </el-button>
        </div>
      </div>
      <el-table
        ref="detailTableRef"
        :data="list"
        v-loading="loading"
        style="width:100%"
        row-key="id"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        @row-click="handleRowClick"
      >
        <el-table-column label="维度" min-width="260">
          <template #default="scope">
            <span v-if="scope.row.level === 'date'" class="tree-level-date">{{ scope.row.report_date }}</span>
            <span v-else-if="scope.row.level === 'campaign'" class="tree-level-campaign">
              <el-tag size="small" effect="plain" type="primary" class="level-tag">广告活动</el-tag>
              {{ scope.row.campaign_name }}
            </span>
            <span v-else-if="scope.row.level === 'ad_group'" class="tree-level-ad-group">
              <el-tag size="small" effect="plain" type="success" class="level-tag">广告组</el-tag>
              {{ scope.row.ad_group_name }}
            </span>
            <span v-else class="tree-level-product">
              <el-tag size="small" effect="plain" type="warning" class="level-tag">广告商品</el-tag>
              {{ scope.row.advertised_asin }}
              <span v-if="scope.row.product_name" class="product-name">- {{ scope.row.product_name }}</span>
              <span v-else-if="scope.row.advertised_sku" class="product-sku">({{ scope.row.advertised_sku }})</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="impressions" label="曝光" align="right" width="100">
          <template #default="scope">{{ formatNumber(scope.row.impressions, 0) }}</template>
        </el-table-column>
        <el-table-column prop="clicks" label="点击" align="right" width="90">
          <template #default="scope">{{ formatNumber(scope.row.clicks, 0) }}</template>
        </el-table-column>
        <el-table-column prop="ad_spend" label="花费" align="right" width="110">
          <template #default="scope">${{ formatNumber(scope.row.ad_spend) }}</template>
        </el-table-column>
        <el-table-column prop="ctr" label="CTR" align="right" width="90">
          <template #default="scope">{{ formatPct(scope.row.ctr) }}</template>
        </el-table-column>
        <el-table-column prop="cpc" label="CPC" align="right" width="90">
          <template #default="scope">${{ formatNumber(scope.row.cpc) }}</template>
        </el-table-column>
        <el-table-column prop="orders_7d" label="订单(7d)" align="right" width="100">
          <template #default="scope">{{ formatNumber(scope.row.orders_7d, 0) }}</template>
        </el-table-column>
        <el-table-column prop="sales_7d" label="销售(7d)" align="right" width="120">
          <template #default="scope">${{ formatNumber(scope.row.sales_7d) }}</template>
        </el-table-column>
        <el-table-column prop="acos_7d" label="ACOS(7d)" align="right" width="110">
          <template #default="scope">
            <span :class="getAcosClass(scope.row.acos_7d)">{{ formatPct(scope.row.acos_7d) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="roas_7d" label="ROAS(7d)" align="right" width="110">
          <template #default="scope">{{ formatNumber(scope.row.roas_7d, 2) }}x</template>
        </el-table-column>
        <el-table-column prop="orders_30d" label="订单(30d)" align="right" width="100">
          <template #default="scope">{{ formatNumber(scope.row.orders_30d, 0) }}</template>
        </el-table-column>
        <el-table-column prop="sales_30d" label="销售(30d)" align="right" width="120">
          <template #default="scope">${{ formatNumber(scope.row.sales_30d) }}</template>
        </el-table-column>
        <el-table-column prop="acos_30d" label="ACOS(30d)" align="right" width="110">
          <template #default="scope">
            <span :class="getAcosClass(scope.row.acos_30d)">{{ formatPct(scope.row.acos_30d) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="roas_30d" label="ROAS(30d)" align="right" width="110">
          <template #default="scope">{{ formatNumber(scope.row.roas_30d, 2) }}x</template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        class="pagination"
        @change="fetchList"
      />
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import {
  Promotion, Refresh, RefreshLeft, Search, View, Mouse, Money, TrendCharts,
  Coin, DataAnalysis, Histogram, ShoppingCart, Wallet, DataLine, List,
  Document, InfoFilled, ArrowDown, ArrowUp
} from '@element-plus/icons-vue'
import {
  getShopOptions,
  getAdvertisingSummary, getAdvertisingTrend, generateAdvertisingReport,
  getAdvertisingCampaignOptions, getAdvertisingAdGroupOptions, getAdvertisingProductOptions,
  getAdvertisingDailyTree
} from '@/services/api.js'

export default {
  name: 'AdvertisingReportView',
  components: {
    Promotion, Refresh, RefreshLeft, Search, View, Mouse, Money, TrendCharts,
    Coin, DataAnalysis, Histogram, ShoppingCart, Wallet, DataLine, List,
    Document, InfoFilled, ArrowDown, ArrowUp
  },
  setup() {
    const selectedShop = ref(null)
    const shopList = ref([])
    const generating = ref(false)

    const filter = reactive({ type: 'daily' })
    const startDate = ref('')
    const endDate = ref('')
    const showGuide = ref(false)

    // 趋势图联动筛选
    const trendFilter = reactive({ campaign_id: '', ad_group_id: '', advertised_asin: '' })
    const campaignOptions = ref([])
    const adGroupOptions = ref([])
    const productOptions = ref([])
    const adGroupDisabled = computed(() => !trendFilter.campaign_id)
    const productDisabled = computed(() => !trendFilter.ad_group_id)

    const summary = reactive({})
    const list = ref([])
    const loading = ref(false)
    const page = ref(1)
    const pageSize = ref(20)
    const total = ref(0)

    let trendChart = null
    const trendChartRef = ref(null)
    const detailTableRef = ref(null)

    const formatNumber = (val, digits = 2) => {
      if (val === null || val === undefined) return '-'
      const n = Number(val)
      if (isNaN(n)) return '-'
      return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    }

    const formatK = (val) => {
      if (val === null || val === undefined) return '-'
      const n = Number(val)
      if (isNaN(n)) return '-'
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
      return n.toLocaleString('en-US')
    }

    const formatPct = (val) => {
      if (val === null || val === undefined) return '—'
      const n = Number(val)
      if (isNaN(n)) return '—'
      return n.toFixed(2) + '%'
    }

    const getAcosClass = (val) => {
      if (val === null || val === undefined) return ''
      let v = Number(val)
      if (isNaN(v)) return ''
      // 兼容后端返回百分比数值（如 55.36）或小数（如 0.5536）
      if (v > 1) v = v / 100
      if (v > 0.5) return 'text-danger'
      if (v > 0.3) return 'text-warning'
      if (v > 0) return 'text-success'
      return ''
    }

    const fetchShops = async () => {
      try {
        const res = await getShopOptions()
        if (res.data.status === 'success') {
          shopList.value = res.data.data || []
        }
      } catch (e) { console.error(e) }
    }

    const handleShopChange = () => {
      // 店铺切换后重置联动筛选并刷新
      trendFilter.campaign_id = ''
      trendFilter.ad_group_id = ''
      trendFilter.advertised_asin = ''
      adGroupOptions.value = []
      productOptions.value = []
      loadCampaignOptions()
      fetchAllData()
    }

    const buildParams = () => {
      const params = {
        type: filter.type,
        shop_id: selectedShop.value
      }
      if (startDate.value && endDate.value) {
        params.start_date = startDate.value
        params.end_date = endDate.value
      }
      return params
    }

    const buildTrendParams = () => {
      const params = buildParams()
      if (trendFilter.advertised_asin) {
        params.advertised_asin = trendFilter.advertised_asin
      } else if (trendFilter.ad_group_id) {
        params.ad_group_id = trendFilter.ad_group_id
      } else if (trendFilter.campaign_id) {
        params.campaign_id = trendFilter.campaign_id
      }
      return params
    }

    const fetchSummary = async () => {
      try {
        const res = await getAdvertisingSummary(buildParams())
        if (res.data.status === 'success') {
          const data = res.data.data || {}
          console.log('[广告报表] 汇总数据:', JSON.parse(JSON.stringify(data)))
          Object.assign(summary, data)
        }
      } catch (e) { console.error(e) }
    }

    const fetchTrend = async () => {
      try {
        const res = await getAdvertisingTrend(buildTrendParams())
        if (res.data.status === 'success') {
          updateTrendChart(res.data.data || [])
        }
      } catch (e) { console.error(e) }
    }

    const fetchList = async () => {
      loading.value = true
      try {
        const params = {
          type: filter.type,
          shop_id: selectedShop.value,
          page: page.value,
          page_size: pageSize.value
        }
        if (startDate.value && endDate.value) {
          params.start_date = startDate.value
          params.end_date = endDate.value
        }
        const res = await getAdvertisingDailyTree(params)
        if (res.data.status === 'success') {
          list.value = normalizeDateRows(res.data.data.list || [])
          total.value = res.data.data.total || 0
        }
      } catch (e) { console.error(e) }
      finally { loading.value = false }
    }

    const fetchAllData = () => {
      fetchSummary()
      fetchTrend()
      fetchList()
    }

    const handleTypeChange = () => {
      page.value = 1
      setDefaultDateRange()
      fetchAllData()
    }

    const onStartDateChange = (val) => {
      if (val && endDate.value && val > endDate.value) {
        endDate.value = val
      }
      page.value = 1
      fetchAllData()
    }

    const onEndDateChange = (val) => {
      if (val && startDate.value && val < startDate.value) {
        startDate.value = val
      }
      page.value = 1
      fetchAllData()
    }

    const guideMetrics = [
      { name: '曝光', meaning: '广告被展示的次数', formula: '—', judge: '曝光低 = 关键词太偏或竞价太低' },
      { name: '点击', meaning: '买家点进Listing的次数', formula: '—', judge: '点击少 = 主图/标题/价格没吸引力' },
      { name: '花费', meaning: '广告烧掉的钱', formula: '—', judge: '控制在你能承受的范围' },
      { name: 'CTR', meaning: '看到广告后点进来的比例', formula: '点击÷曝光×100%', judge: '>0.3%及格，>0.5%优秀' },
      { name: 'CPC', meaning: '每次点击成本', formula: '花费÷点击', judge: '美国站通常$0.5-$2，类目差异大' }
    ]
    const guideConversion = [
      { name: '订单(7d)', meaning: '广告带来的订单数', formula: '—', judge: '—' },
      { name: '销售(7d)', meaning: '广告带来的销售额', formula: '—', judge: '—' },
      { name: 'ACOS(7d)', meaning: '广告销售成本比（最核心）', formula: '花费÷销售×100%', judge: '<30%健康，<15%优秀，>50%亏钱' },
      { name: 'ROAS(7d)', meaning: '广告支出回报率', formula: '销售÷花费', judge: '>3.3健康，>6优秀（1/ACOS）' }
    ]

    const handleGenerate = async () => {
      generating.value = true
      try {
        const body = { report_type: filter.type, shop_id: selectedShop.value }
        if (filter.type === 'daily') {
          body.period = endDate.value || new Date().toISOString().split('T')[0]
        } else if (filter.type === 'weekly') {
          body.period_start = startDate.value
          body.period_end = endDate.value
        } else if (filter.type === 'monthly') {
          const d = endDate.value || new Date().toISOString().split('T')[0]
          body.period = d.slice(0, 7)
        }
        const res = await generateAdvertisingReport(body)
        if (res.data.status === 'success') {
          ElMessage.success('报表生成成功')
          fetchAllData()
        } else {
          ElMessage.warning(res.data.message || '生成完成，请刷新查看')
        }
      } catch (e) {
        ElMessage.error('生成失败: ' + (e.response?.data?.message || e.message))
      } finally {
        generating.value = false
      }
    }

    // --- 趋势图联动下拉框 ---

    const loadCampaignOptions = async () => {
      try {
        const res = await getAdvertisingCampaignOptions({ shop_id: selectedShop.value })
        campaignOptions.value = res.data?.data || []
      } catch (e) { console.error('加载活动选项失败:', e) }
    }

    const loadAdGroupOptions = async () => {
      if (!trendFilter.campaign_id) {
        adGroupOptions.value = []
        return
      }
      try {
        const res = await getAdvertisingAdGroupOptions({
          shop_id: selectedShop.value,
          campaign_id: trendFilter.campaign_id
        })
        adGroupOptions.value = res.data?.data || []
      } catch (e) { console.error('加载广告组选项失败:', e) }
    }

    const loadProductOptions = async () => {
      if (!trendFilter.campaign_id) {
        productOptions.value = []
        return
      }
      try {
        const res = await getAdvertisingProductOptions({
          shop_id: selectedShop.value,
          campaign_id: trendFilter.campaign_id,
          ad_group_id: trendFilter.ad_group_id
        })
        const raw = res.data?.data || []
        productOptions.value = raw.map(item => {
          if (typeof item === 'string') {
            return { value: item, label: item }
          }
          const value = item.advertised_asin || item.asin || ''
          const label = item.product_name
            ? `${value} - ${item.product_name}`
            : value
          return { value, label }
        }).filter(i => i.value)
      } catch (e) { console.error('加载广告商品选项失败:', e) }
    }

    const onTrendCampaignChange = () => {
      trendFilter.ad_group_id = ''
      trendFilter.advertised_asin = ''
      adGroupOptions.value = []
      productOptions.value = []
      loadAdGroupOptions()
      loadProductOptions()
      fetchTrend()
    }

    const onTrendAdGroupChange = () => {
      trendFilter.advertised_asin = ''
      productOptions.value = []
      loadProductOptions()
      fetchTrend()
    }

    const onTrendProductChange = () => {
      fetchTrend()
    }

    // --- 趋势图筛选重置 ---

    const resetTrendFilter = () => {
      trendFilter.campaign_id = ''
      trendFilter.ad_group_id = ''
      trendFilter.advertised_asin = ''
      adGroupOptions.value = []
      productOptions.value = []
      loadCampaignOptions()
      fetchTrend()
    }

    // --- 明细表格展开/折叠 ---

    const toDateStr = (val) => {
      if (!val) return ''
      if (typeof val === 'string') return val.trim().split(' ')[0]
      const d = new Date(val)
      return d.toISOString().split('T')[0]
    }

    const normalizeProductRows = (date, campaignId, adGroupId, rows) => {
      return (rows || []).map(item => ({
        ...item,
        id: `product_${date}_${campaignId}_${adGroupId}_${item.advertised_asin || item.asin || Math.random().toString(36).slice(2)}`,
        level: 'product',
        report_date: date,
        campaign_id: campaignId,
        ad_group_id: adGroupId,
        hasChildren: false,
        children: []
      }))
    }

    const normalizeAdGroupRows = (date, campaignId, rows) => {
      return (rows || []).map(item => ({
        ...item,
        id: `ad_group_${date}_${campaignId}_${item.ad_group_id}`,
        level: 'ad_group',
        report_date: date,
        campaign_id: campaignId,
        hasChildren: (item.children || []).length > 0,
        children: normalizeProductRows(date, campaignId, item.ad_group_id, item.children)
      }))
    }

    const normalizeCampaignRows = (date, rows) => {
      return (rows || []).map(item => ({
        ...item,
        id: `campaign_${date}_${item.campaign_id}`,
        level: 'campaign',
        report_date: date,
        hasChildren: (item.children || []).length > 0,
        children: normalizeAdGroupRows(date, item.campaign_id, item.children)
      }))
    }

    const normalizeDateRows = (rows) => {
      return (rows || []).map(item => {
        const date = toDateStr(item.report_date)
        return {
          ...item,
          report_date: date,
          id: `date_${date}`,
          level: 'date',
          hasChildren: (item.children || []).length > 0,
          children: normalizeCampaignRows(date, item.children)
        }
      })
    }

    const handleRowClick = (row) => {
      if (!detailTableRef.value) return
      detailTableRef.value.toggleRowExpansion(row)
    }

    const expandRows = (rows, expanded) => {
      if (!detailTableRef.value) return
      for (const row of rows || []) {
        detailTableRef.value.toggleRowExpansion(row, expanded)
        if (row.children?.length) {
          expandRows(row.children, expanded)
        }
      }
    }

    const expandAllRows = () => {
      expandRows(list.value, true)
    }

    const collapseAllRows = () => {
      expandRows(list.value, false)
    }

    const updateTrendChart = (data) => {
      if (!trendChart) return
      if (data.length === 0) {
        trendChart.setOption({
          tooltip: { show: false },
          xAxis: { type: 'category', data: ['暂无数据'], axisLabel: { color: '#999' } },
          yAxis: [{ type: 'value', show: false }, { type: 'value', show: false }, { type: 'value', show: false }, { type: 'value', show: false }],
          series: [],
          graphic: [{
            type: 'text', left: 'center', top: 'middle',
            style: { text: '暂无数据', fill: '#999', fontSize: 16 }
          }]
        }, true)
        return
      }
      const formatAxisDate = (label) => {
        if (!label) return label
        if (typeof label === 'string' && label.includes(' ')) return label.split(' ')[0]
        return label
      }
      const xAxis = data.map(d => formatAxisDate(d.time_label))
      trendChart.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          formatter: (params) => {
            let html = `<div style="font-weight:600;margin-bottom:6px;">${params[0].axisValue}</div>`
            params.forEach(p => {
              let val = p.value
              if (['ACOS', 'CTR'].includes(p.seriesName)) val = Number(val).toFixed(2) + '%'
              else if (p.seriesName === 'CPC') val = '$' + Number(val).toFixed(2)
              else val = '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
                <span style="width:8px;height:8px;border-radius:50%;background:${p.color};"></span>
                <span style="flex:1;">${p.seriesName}</span>
                <span style="font-weight:600;">${val}</span>
              </div>`
            })
            return html
          }
        },
        legend: { data: ['花费', '销售额', 'ACOS', 'CTR', 'CPC'], bottom: 0 },
        grid: { left: 70, right: 130, top: 30, bottom: 50 },
        xAxis: {
          type: 'category',
          data: xAxis,
          axisLine: { lineStyle: { color: '#ddd' } },
          axisLabel: { color: '#666' }
        },
        yAxis: [
          {
            type: 'value',
            name: '金额 ($)',
            position: 'left',
            axisLine: { show: false },
            splitLine: { lineStyle: { color: '#f0f0f0' } },
            axisLabel: { color: '#666', formatter: '${value}' }
          },
          {
            type: 'value',
            name: 'ACOS (%)',
            position: 'right',
            axisLine: { show: false },
            splitLine: { show: false },
            axisLabel: { color: '#666', formatter: (v) => Number(v).toFixed(0) + '%' }
          },
          {
            type: 'value',
            name: 'CTR (%)',
            position: 'right',
            offset: 60,
            axisLine: { show: false },
            splitLine: { show: false },
            axisLabel: { color: '#666', formatter: (v) => Number(v).toFixed(2) + '%' }
          },
          {
            type: 'value',
            name: 'CPC ($)',
            position: 'right',
            offset: 120,
            axisLine: { show: false },
            splitLine: { show: false },
            axisLabel: { color: '#666', formatter: '${value}' }
          }
        ],
        series: [
          {
            name: '花费',
            type: 'bar',
            data: data.map(d => d.ad_spend || 0),
            itemStyle: { color: '#667eea', borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 24
          },
          {
            name: '销售额',
            type: 'bar',
            data: data.map(d => d.sales_7d || 0),
            itemStyle: { color: '#0ea5e9', borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 24
          },
          {
            name: 'ACOS',
            type: 'line',
            yAxisIndex: 1,
            data: data.map(d => d.acos || 0),
            smooth: true,
            itemStyle: { color: '#ef4444' },
            lineStyle: { width: 3 },
            symbol: 'circle',
            symbolSize: 6
          },
          {
            name: 'CTR',
            type: 'line',
            yAxisIndex: 2,
            data: data.map(d => d.ctr || 0),
            smooth: true,
            itemStyle: { color: '#10b981' },
            lineStyle: { width: 3 },
            symbol: 'circle',
            symbolSize: 6
          },
          {
            name: 'CPC',
            type: 'line',
            yAxisIndex: 3,
            data: data.map(d => d.cpc || 0),
            smooth: true,
            itemStyle: { color: '#f59e0b' },
            lineStyle: { width: 3 },
            symbol: 'circle',
            symbolSize: 6
          }
        ],
        graphic: []
      }, true)
    }

    const initChart = () => {
      if (trendChartRef.value) {
        trendChart = echarts.init(trendChartRef.value)
      }
    }

    const disposeChart = () => {
      trendChart?.dispose()
    }

    const resizeChart = () => {
      trendChart?.resize()
    }

    const setDefaultDateRange = () => {
      const end = new Date()
      const start = new Date()
      if (filter.type === 'daily') {
        start.setDate(start.getDate() - 30)
      } else if (filter.type === 'weekly') {
        start.setDate(start.getDate() - 90)
      } else if (filter.type === 'monthly') {
        start.setDate(start.getDate() - 365)
      }
      const fmt = (d) => d.toISOString().split('T')[0]
      startDate.value = fmt(start)
      endDate.value = fmt(end)
    }

    const initDates = () => {
      setDefaultDateRange()
    }

    onMounted(() => {
      fetchShops()
      initDates()
      nextTick(() => {
        initChart()
        loadCampaignOptions()
        fetchAllData()
        window.addEventListener('resize', resizeChart)
      })
    })

    onUnmounted(() => {
      disposeChart()
      window.removeEventListener('resize', resizeChart)
    })

    return {
      selectedShop, shopList, generating,
      filter, startDate, endDate, summary, list, loading, page, pageSize, total,
      trendChartRef, detailTableRef, showGuide,
      trendFilter, campaignOptions, adGroupOptions, productOptions,
      adGroupDisabled, productDisabled,
      formatNumber, formatK, formatPct, getAcosClass,
      guideMetrics, guideConversion,
      handleShopChange, fetchAllData, fetchList,
      handleTypeChange, onStartDateChange, onEndDateChange, handleGenerate,
      onTrendCampaignChange, onTrendAdGroupChange, onTrendProductChange,
      resetTrendFilter,
      handleRowClick, expandAllRows, collapseAllRows
    }
  }
}
</script>

<style scoped>
.ad-report-page {
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

/* 筛选栏 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  background: #fff;
  padding: 14px 18px;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  flex-wrap: wrap;
}

.date-range-pickers {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-separator {
  color: #909399;
  font-size: 14px;
}

.date-start-picker,
.date-end-picker {
  width: 150px;
}

/* 汇总卡片 */
.summary-section {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.summary-card {
  background: #fff;
  border-radius: 14px;
  padding: 18px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 4px solid transparent;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.08);
}

.card-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.card-impressions { border-left-color: #3b82f6; }
.card-impressions .card-icon { background: linear-gradient(135deg, #3b82f6, #60a5fa); }

.card-clicks { border-left-color: #8b5cf6; }
.card-clicks .card-icon { background: linear-gradient(135deg, #8b5cf6, #a78bfa); }

.card-spend { border-left-color: #ef4444; }
.card-spend .card-icon { background: linear-gradient(135deg, #ef4444, #f87171); }

.card-ctr { border-left-color: #f59e0b; }
.card-ctr .card-icon { background: linear-gradient(135deg, #f59e0b, #fbbf24); }

.card-cpc { border-left-color: #14b8a6; }
.card-cpc .card-icon { background: linear-gradient(135deg, #14b8a6, #2dd4bf); }

.card-acos { border-left-color: #ec4899; }
.card-acos .card-icon { background: linear-gradient(135deg, #ec4899, #f472b6); }

.card-roas { border-left-color: #10b981; }
.card-roas .card-icon { background: linear-gradient(135deg, #10b981, #34d399); }

.card-orders { border-left-color: #6366f1; }
.card-orders .card-icon { background: linear-gradient(135deg, #6366f1, #818cf8); }

.card-sales { border-left-color: #0ea5e9; }
.card-sales .card-icon { background: linear-gradient(135deg, #0ea5e9, #38bdf8); }

.card-body {
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 4px;
  white-space: nowrap;
}

.card-value {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 图表 */
.chart-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;
}

.chart-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 6px;
}

.chart-filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.chart-legend-hint {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: #888;
}

.hint-bar::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  background: #667eea;
  border-radius: 2px;
  margin-right: 4px;
  vertical-align: middle;
}

.hint-line::before {
  content: '';
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
  margin-right: 4px;
  vertical-align: middle;
}

.hint-bar.sales::before { background: #0ea5e9; }

.hint-line.acos::before { background: #ef4444; }
.hint-line.ctr::before { background: #10b981; }
.hint-line.cpc::before { background: #f59e0b; }

/* 表格 */
.table-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 10px;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tree-level-date {
  font-weight: 600;
  color: #1f2937;
}

.tree-level-campaign {
  color: #374151;
}

.tree-level-ad-group {
  color: #4b5563;
  font-weight: 500;
}

.tree-level-product {
  color: #4b5563;
}

.product-sku {
  color: #909399;
  font-size: 12px;
  margin-left: 4px;
}

.product-name {
  color: #606266;
  font-size: 12px;
  margin-left: 4px;
}

.level-tag {
  margin-right: 6px;
  flex-shrink: 0;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

/* 文字颜色 */
.text-success { color: #10b981; }
.text-warning { color: #f59e0b; }
.text-danger { color: #ef4444; }

/* 指标说明弹窗 */
.guide-body h4 {
  margin: 0 0 10px 0;
  font-size: 15px;
  color: #1f2937;
  font-weight: 600;
}

.guide-tip {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #0369a1;
  margin-bottom: 12px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.guide-tip .el-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.guide-example {
  background: #f8fafc;
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 20px;
  font-size: 13px;
  color: #374151;
}

.guide-example p {
  margin: 0 0 8px 0;
}

.guide-example ul {
  margin: 0;
  padding-left: 18px;
}

.guide-example li {
  margin: 4px 0;
}

.tag-good {
  color: #10b981;
  font-weight: 600;
}

.tag-warn {
  color: #f59e0b;
  font-weight: 600;
}

.guide-priority {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.priority-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 13px;
  color: #374151;
}

.priority-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

/* 防止排序列表头文字换行 */
.el-table th.is-sortable .cell {
  white-space: nowrap;
}
</style>
