<template>
  <section class="storage-trend" v-loading="loading">
    <div class="trend-heading">
      <div>
        <h2>近一年仓储费趋势</h2>
        <span class="trend-note">{{ rangeText }} · 全店汇总，不受下方筛选影响</span>
      </div>
      <el-select v-if="data.series.length > 1" v-model="currency" :empty-values="[null, undefined]" size="small" style="width:140px" aria-label="图表币种">
        <el-option v-for="item in data.series" :key="item.currency" :value="item.currency" :label="item.currency || '未标明币种'" />
      </el-select>
      <span v-else-if="data.series.length" class="trend-currency">{{ currency || '未标明币种' }}</span>
    </div>
    <div v-if="error" class="trend-empty">{{ error }} <el-button link type="primary" @click="fetchTrend">重试</el-button></div>
    <div v-else-if="!loading && !data.series.length" class="trend-empty">{{ shopId ? '暂无仓储费报表数据' : '请选择店铺查看趋势' }}</div>
    <div ref="chartElement" v-show="data.series.length && !error" class="trend-canvas" role="img" :aria-label="`最近12个月仓储费、激励抵扣和净仓储费柱状图，${currency || '未标明币种'}`" />
    <p v-if="data.series.length && !error" class="trend-footnote">净仓储费 = 仓储费 − 激励抵扣；空白月份表示无报表记录，不代表费用为 0。不同币种分别查看。</p>
  </section>
</template>

<script setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { init, use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { getFbaStorageFeeMonthlyTrend } from '@/services/api'

use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])
const props = defineProps({ shopId: [Number, String], refreshKey: { type: Number, default: 0 } })
const chartElement = ref(null)
const loading = ref(false)
const error = ref('')
const currency = ref('')
const emptyData = () => ({ months: [], latest_month: null, series: [] })
const data = ref(emptyData())
const rangeText = computed(() => data.value.months.length ? `${data.value.months[0]} ～ ${data.value.latest_month}` : '截至最新计费月，连续 12 个月')
let chart = null
let observer = null
let active = false
let sequence = 0

const formatAmount = value => value == null ? '无记录' : Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const render = async () => {
  await nextTick()
  if (!active || !chartElement.value || !data.value.series.length || error.value || !chartElement.value.clientWidth) return
  if (!chart) {
    chart = init(chartElement.value)
    observer = new ResizeObserver(() => { if (active && chart) chart.resize() })
    observer.observe(chartElement.value)
  }
  const points = data.value.series.find(item => item.currency === currency.value)?.points || []
  chart.setOption({
    color: ['#667eea', '#10b981', '#f59e0b'],
    grid: { left: 16, right: 20, top: 45, bottom: 12, containLabel: true },
    legend: { top: 4, itemWidth: 12, itemHeight: 9, textStyle: { color: '#606266', fontSize: 12 } },
    tooltip: { trigger: 'axis', renderMode: 'richText', axisPointer: { type: 'shadow' }, valueFormatter: formatAmount },
    xAxis: { type: 'category', data: data.value.months, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e4e7ed' } }, axisLabel: { color: '#7b8798', fontSize: 11, hideOverlap: true } },
    yAxis: { type: 'value', axisLabel: { color: '#7b8798', fontSize: 11 }, splitLine: { lineStyle: { color: '#f0f2f5', type: 'dashed' } } },
    series: [['仓储费总额', 'storage_fee'], ['激励抵扣总额', 'incentive_fee'], ['净仓储费总额', 'net_fee']].map(([name, key]) => ({
      name, type: 'bar', barMaxWidth: 22, barGap: '15%', itemStyle: { borderRadius: [3, 3, 0, 0] },
      data: points.map(point => point[key] == null ? null : Number(point[key])),
    })),
  }, true)
  chart.resize()
}

const dispose = () => { observer?.disconnect(); observer = null; chart?.dispose(); chart = null }
const fetchTrend = async () => {
  if (!active) return
  const ticket = ++sequence
  const shop = props.shopId
  dispose()
  data.value = emptyData()
  error.value = ''
  loading.value = !!shop
  if (!shop) return
  try {
    const response = await getFbaStorageFeeMonthlyTrend({ shop_id: shop })
    if (!active || ticket !== sequence) return
    if (response.data.status !== 'success') throw new Error(response.data.message || '趋势加载失败')
    data.value = response.data.data || emptyData()
    if (!data.value.series.some(item => item.currency === currency.value)) currency.value = data.value.series[0]?.currency || ''
    render()
  } catch {
    if (active && ticket === sequence) error.value = '仓储费趋势加载失败，请重试'
  } finally {
    if (ticket === sequence) loading.value = false
  }
}
watch(currency, render)
watch(() => [props.shopId, props.refreshKey], fetchTrend)
const start = () => { if (!active) { active = true; fetchTrend() } }
const stop = () => { active = false; sequence++; loading.value = false; dispose() }
onMounted(start)
onActivated(start)
onDeactivated(stop)
onBeforeUnmount(stop)
</script>

<style scoped>
.storage-trend { background: #fff; border-radius: 8px; padding: 14px 18px 10px; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.04); }
.trend-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.trend-heading h2 { display: inline; margin: 0 14px 0 0; font-size: 14px; font-weight: 600; color: #303133; }
.trend-note, .trend-currency, .trend-footnote { font-size: 12px; color: #909399; }
.trend-currency { color: #606266; }
.trend-canvas { width: 100%; height: 240px; margin-top: 8px; }
.trend-footnote { margin: 4px 0 0; line-height: 1.5; }
.trend-empty { min-height: 100px; display: flex; gap: 8px; align-items: center; justify-content: center; color: #909399; font-size: 13px; }
@media (max-width: 768px) { .trend-heading h2 { display: block; margin-bottom: 4px; } .trend-canvas { height: 250px; } }
</style>
