<template>
  <div ref="element" class="performance-trend-chart" :style="{height:`${height}px`}" role="img" :aria-label="metrics.map(metric=>metric.label).join('、')+'每日趋势'" />
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { init, use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { performanceChartOption } from '@/services/performanceCharts.js'

use([LineChart, GridComponent, LegendComponent, TooltipComponent, DataZoomComponent, CanvasRenderer])
const props=defineProps({rows:{type:Array,default:()=>[]},metrics:{type:Array,required:true},currency:{type:String,default:''},height:{type:Number,default:320}})
const element=ref(null)
let chart, observer
const render=()=>{if(chart)chart.setOption(performanceChartOption(props.rows,props.metrics,props.currency),true)}
onMounted(()=>{
  chart=init(element.value);render()
  observer=new ResizeObserver(()=>chart?.resize());observer.observe(element.value)
})
watch(()=>[props.rows,props.metrics,props.currency],render,{deep:true})
onBeforeUnmount(()=>{observer?.disconnect();chart?.dispose();chart=null})
</script>

<style scoped>
.performance-trend-chart { width:100%; min-width:0; }
</style>
