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

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-radio-group v-model="filter.type" @change="handleTypeChange">
        <el-radio-button label="daily">日报</el-radio-button>
        <el-radio-button label="weekly">周报</el-radio-button>
        <el-radio-button label="monthly">月报</el-radio-button>
      </el-radio-group>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="~"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        @change="fetchAllData"
      />
      <el-select v-model="filter.dimension" placeholder="维度" style="width:140px" @change="handleDimensionChange">
        <el-option label="整体" value="overall" />
        <el-option label="广告活动" value="campaign" />
        <el-option label="广告组" value="ad_group" />
        <el-option label="ASIN" value="asin" />
      </el-select>
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
        <div class="chart-legend-hint">
          <span class="hint-bar">花费</span>
          <span class="hint-line acos">ACOS</span>
          <span class="hint-line roas">ROAS</span>
        </div>
      </div>
      <div ref="trendChartRef" class="chart-body" style="height:340px;"></div>
    </div>

    <!-- 数据表格 -->
    <div class="table-card">
      <div class="table-header">
        <h3><el-icon><List /></el-icon> {{ dimensionLabel }} 明细</h3>
        <el-tag v-if="filter.type === 'daily'" type="warning" size="small" effect="plain">日报 ACOS 仅作趋势参考</el-tag>
      </div>
      <el-table :data="list" v-loading="loading" style="width:100%" :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}">
        <el-table-column v-if="filter.dimension === 'overall'" prop="report_date" label="日期" width="110" />
        <el-table-column v-if="filter.dimension === 'campaign'" prop="campaign_name" label="广告活动" min-width="180" show-overflow-tooltip />
        <el-table-column v-if="filter.dimension === 'ad_group'" prop="campaign_name" label="广告活动" min-width="160" show-overflow-tooltip />
        <el-table-column v-if="filter.dimension === 'ad_group'" prop="ad_group_name" label="广告组" min-width="160" show-overflow-tooltip />
        <el-table-column v-if="filter.dimension === 'asin'" prop="asin" label="ASIN" width="130" />
        <el-table-column v-if="filter.dimension === 'asin'" prop="sku" label="SKU" width="120" />

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
  Promotion, Refresh, Search, View, Mouse, Money, TrendCharts,
  Coin, DataAnalysis, Histogram, ShoppingCart, Wallet, DataLine, List,
  Document, InfoFilled
} from '@element-plus/icons-vue'
import {
  getShopOptions,
  getAdvertisingReports, getAdvertisingSummary, getAdvertisingTrend, generateAdvertisingReport
} from '@/services/api.js'

export default {
  name: 'AdvertisingReportView',
  components: {
    Promotion, Refresh, Search, View, Mouse, Money, TrendCharts,
    Coin, DataAnalysis, Histogram, ShoppingCart, Wallet, DataLine, List, Document, InfoFilled
  },
  setup() {
    const selectedShop = ref(null)
    const shopList = ref([])
    const generating = ref(false)

    const filter = reactive({ type: 'daily', dimension: 'campaign' })
    const dateRange = ref([])
    const showGuide = ref(false)
    const summary = reactive({})
    const list = ref([])
    const loading = ref(false)
    const page = ref(1)
    const pageSize = ref(20)
    const total = ref(0)

    let trendChart = null
    const trendChartRef = ref(null)

    const dimensionLabel = computed(() => {
      const map = { overall: '整体', campaign: '广告活动', ad_group: '广告组', asin: 'ASIN' }
      return map[filter.dimension] || filter.dimension
    })

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
      return (n * 100).toFixed(2) + '%'
    }

    const getAcosClass = (val) => {
      if (val === null || val === undefined) return ''
      const v = Number(val)
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
      fetchAllData()
    }

    const buildParams = () => {
      const params = {
        type: filter.type,
        dimension: filter.dimension,
        shop_id: selectedShop.value
      }
      if (dateRange.value?.length === 2) {
        params.start_date = dateRange.value[0]
        params.end_date = dateRange.value[1]
      }
      return params
    }

    const fetchSummary = async () => {
      try {
        const res = await getAdvertisingSummary(buildParams())
        if (res.data.status === 'success') {
          Object.assign(summary, res.data.data || {})
        }
      } catch (e) { console.error(e) }
    }

    const fetchTrend = async () => {
      try {
        const res = await getAdvertisingTrend(buildParams())
        if (res.data.status === 'success') {
          updateTrendChart(res.data.data || [])
        }
      } catch (e) { console.error(e) }
    }

    const fetchList = async () => {
      loading.value = true
      try {
        const params = { ...buildParams(), page: page.value, page_size: pageSize.value }
        const res = await getAdvertisingReports(params)
        if (res.data.status === 'success') {
          list.value = res.data.data.list || []
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
      fetchAllData()
    }

    const handleDimensionChange = () => {
      page.value = 1
      fetchList()
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
          body.period = dateRange.value?.[1] || new Date().toISOString().split('T')[0]
        } else if (filter.type === 'weekly') {
          body.period_start = dateRange.value?.[0]
          body.period_end = dateRange.value?.[1]
        } else if (filter.type === 'monthly') {
          const d = dateRange.value?.[1] || new Date().toISOString().split('T')[0]
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

    const updateTrendChart = (data) => {
      if (!trendChart) return
      if (data.length === 0) {
        trendChart.setOption({
          tooltip: { show: false },
          xAxis: { type: 'category', data: ['暂无数据'], axisLabel: { color: '#999' } },
          yAxis: [{ type: 'value', show: false }, { type: 'value', show: false }],
          series: [],
          graphic: [{
            type: 'text', left: 'center', top: 'middle',
            style: { text: '暂无数据', fill: '#999', fontSize: 16 }
          }]
        }, true)
        return
      }
      const xAxis = data.map(d => d.time_label)
      trendChart.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          formatter: (params) => {
            let html = `<div style="font-weight:600;margin-bottom:6px;">${params[0].axisValue}</div>`
            params.forEach(p => {
              let val = p.value
              if (p.seriesName === 'ACOS') val = (val * 100).toFixed(2) + '%'
              else if (p.seriesName === 'ROAS') val = val.toFixed(2) + 'x'
              else if (p.seriesName === '花费') val = '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
                <span style="width:8px;height:8px;border-radius:50%;background:${p.color};"></span>
                <span style="flex:1;">${p.seriesName}</span>
                <span style="font-weight:600;">${val}</span>
              </div>`
            })
            return html
          }
        },
        legend: { data: ['花费', 'ACOS', 'ROAS'], bottom: 0 },
        grid: { left: 60, right: 60, top: 30, bottom: 40 },
        xAxis: {
          type: 'category',
          data: xAxis,
          axisLine: { lineStyle: { color: '#ddd' } },
          axisLabel: { color: '#666' }
        },
        yAxis: [
          {
            type: 'value',
            name: '花费 ($)',
            position: 'left',
            axisLine: { show: false },
            splitLine: { lineStyle: { color: '#f0f0f0' } },
            axisLabel: { color: '#666', formatter: '${value}' }
          },
          {
            type: 'value',
            name: '比率',
            position: 'right',
            axisLine: { show: false },
            splitLine: { show: false },
            axisLabel: {
              color: '#666',
              formatter: (v) => (v * 100).toFixed(0) + '%'
            }
          }
        ],
        series: [
          {
            name: '花费',
            type: 'bar',
            data: data.map(d => d.ad_spend || 0),
            itemStyle: { color: '#667eea', borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 28
          },
          {
            name: 'ACOS',
            type: 'line',
            yAxisIndex: 1,
            data: data.map(d => d.acos_7d || 0),
            smooth: true,
            itemStyle: { color: '#ef4444' },
            lineStyle: { width: 3 },
            symbol: 'circle',
            symbolSize: 6
          },
          {
            name: 'ROAS',
            type: 'line',
            yAxisIndex: 1,
            data: data.map(d => d.roas_7d || 0),
            smooth: true,
            itemStyle: { color: '#10b981' },
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

    const initDates = () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 14)
      const fmt = (d) => d.toISOString().split('T')[0]
      dateRange.value = [fmt(start), fmt(end)]
    }

    onMounted(() => {
      fetchShops()
      initDates()
      nextTick(() => {
        initChart()
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
      filter, dateRange, summary, list, loading, page, pageSize, total,
      trendChartRef, dimensionLabel, showGuide,
      formatNumber, formatK, formatPct, getAcosClass,
      guideMetrics, guideConversion,
      handleShopChange, fetchAllData, fetchList,
      handleTypeChange, handleDimensionChange, handleGenerate
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
}

.chart-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 6px;
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

.hint-line.acos::before { background: #ef4444; }
.hint-line.roas::before { background: #10b981; }

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
}

.table-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 6px;
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
</style>
