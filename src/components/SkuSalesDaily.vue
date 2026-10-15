<template>
  <el-dialog v-model="visible" :title="`${meta.sku || ''} · 每日数据${meta.name ? ` · ${meta.name}` : ''}`" width="min(1240px, 96vw)" class="sku-sales-daily-dialog" append-to-body @close="clear">
    <div class="daily-tools"><el-radio-group v-model="days" size="small" :disabled="loading" @change="load"><el-radio-button v-for="value in [7,14,30,60]" :key="value" :value="value">近{{ value }}天</el-radio-button></el-radio-group><span>{{ meta.shopName }}<template v-if="currency"> · {{ currency }}</template></span></div>
    <p class="daily-note">{{ rangeText }} · 金额和利润沿用原报表，区间内缺失数据保留空值。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-table :data="pageRows" v-loading="loading" stripe max-height="440">
      <el-table-column prop="date" label="日期" width="120" fixed="left" />
      <el-table-column label="销量" min-width="75" align="right"><template #default="{row}">{{ number(row.sales,0) }}</template></el-table-column>
      <el-table-column label="销售额" min-width="100" align="right"><template #default="{row}">{{ number(row.revenue) }}</template></el-table-column>
      <el-table-column label="广告销售额" min-width="110" align="right"><template #default="{row}">{{ number(row.ad_revenue) }}</template></el-table-column>
      <el-table-column label="广告订单数" min-width="100" align="right"><template #default="{row}">{{ number(row.sales_ad,0) }}</template></el-table-column>
      <el-table-column label="广告费" min-width="95" align="right"><template #default="{row}">{{ number(row.ad_cost) }}</template></el-table-column>
      <el-table-column label="利润" min-width="100" align="right"><template #default="{row}"><span :class="profitClass(row.profit)">{{ number(row.profit) }}</span></template></el-table-column>
      <el-table-column label="ACOS" min-width="90" align="right"><template #default="{row}">{{ percent(row.acos) }}</template></el-table-column>
      <el-table-column label="TACOS" min-width="90" align="right"><template #default="{row}">{{ percent(row.tacos) }}</template></el-table-column>
    </el-table>
    <div class="daily-pagination"><span class="daily-note">最新日期在前 · 共 {{ rows.length }} 天</span><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10,20,50,100]" :total="rows.length" layout="total,sizes,prev,pager,next" @size-change="page=1" /></div>
    <section v-if="visible && !loading && !error && rows.length" class="daily-trend">
      <h3>销量与利润趋势</h3><p class="daily-note">完整查询区间，不受上方分页影响；左轴销量（柱状），右轴利润（折线）。</p>
      <div class="daily-chart"><PerformanceTrendChart :rows="chartRows" :metrics="metrics" :currency="currency" :height="360" /></div>
    </section>
    <template #footer><el-button @click="close">关闭</el-button></template>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onDeactivated, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getSkuSalesTrend } from '@/services/api.js'
import PerformanceTrendChart from '@/components/PerformanceTrendChart.vue'

const visible=ref(false),loading=ref(false),error=ref(''),meta=ref({}),days=ref(30),rows=ref([]),currency=ref(''),rangeText=ref('')
const page=ref(1),pageSize=ref(20)
let requestVersion=0
const metrics=[{key:'sales',label:'销量',axis:'quantity',type:'bar',color:'#527eea'},{key:'profit',label:'利润',axis:'amount',color:'#34b7a5'}]
const pageRows=computed(()=>[...rows.value].sort((a,b)=>b.date.localeCompare(a.date)).slice((page.value-1)*pageSize.value,page.value*pageSize.value))
const chartRows=computed(()=>rows.value.map(row=>({...row,business_date:row.date})))
const number=(value,digits=2)=>value==null?'—':Number(value).toLocaleString('zh-CN',{minimumFractionDigits:digits,maximumFractionDigits:digits})
const percent=value=>value==null?'—':`${(Number(value)*100).toFixed(2)}%`
const profitClass=value=>value==null?'':Number(value)>0?'daily-profit':Number(value)<0?'daily-loss':''
const clear=()=>{requestVersion++;loading.value=false;rows.value=[];currency.value='';rangeText.value='';error.value=''}
const close=()=>{visible.value=false;clear()}
const load=async()=>{
  const version=++requestVersion,context={...meta.value}
  loading.value=true;rows.value=[];currency.value='';rangeText.value='';error.value='';page.value=1
  try{
    const response=await getSkuSalesTrend({shop_id:context.shopId,sku:context.sku,days:days.value,end_at_latest:1})
    if(version!==requestVersion || !visible.value)return
    if(response.data.status!=='success')throw Error(response.data.message || '获取每日数据失败')
    const data=response.data.data
    if(data.sku!==context.sku || Number(data.shop_id)!==context.shopId)throw Error('每日数据店铺或SKU不匹配，请重新打开')
    if(data.last_report_date!==data.end_date)throw Error('最新日报截止日期未返回，请确认后端已更新')
    if(!Array.isArray(data.list) || data.list.some(row=>typeof row.has_report!=='boolean'))throw Error('每日数据缺少日报状态，请确认后端已更新')
    const seen=new Set()
    // 保留原接口数字，但只在新窗口把缺日报转换为空值，绝不将真实0过滤掉。
    rows.value=data.list.map(row=>{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date || '') || seen.has(row.date))throw Error('每日数据日期缺失或重复，请重新查询')
      seen.add(row.date)
      if(row.has_report)return {...row,acos:Number(row.ad_revenue)>0?row.acos:null,tacos:Number(row.revenue)>0?row.tacos:null}
      return {...row,...Object.fromEntries(['sales','revenue','ad_revenue','sales_ad','ad_cost','profit','acos','tacos'].map(key=>[key,null]))}
    })
    currency.value=data.currency || '';rangeText.value=data.end_date?`${data.start_date} 至 ${data.end_date}（截至最新日报）`:'该 SKU 暂无日报'
  }catch(err){if(version===requestVersion && visible.value){rows.value=[];error.value=err.response?.data?.message || err.message}}
  finally{if(version===requestVersion)loading.value=false}
}
const open=(row,selectedShop,shops)=>{
  const shopId=Number(row.shop_id ?? selectedShop)
  if(!Number.isInteger(shopId) || shopId<=0 || !row.sku){ElMessage.warning('请先选择店铺再查看每日数据');return}
  close();meta.value={sku:row.sku,name:row.product_name || '',shopId,shopName:shops.find(shop=>Number(shop.id)===shopId)?.shop_name || `店铺 ${shopId}`}
  days.value=30;page.value=1;pageSize.value=20;visible.value=true;load()
}
onDeactivated(close)
onBeforeUnmount(close)
defineExpose({open,close})
</script>

<style>
.sku-sales-daily-dialog{display:flex;flex-direction:column;max-height:90vh;margin-top:5vh !important;border-radius:12px}
.sku-sales-daily-dialog .el-dialog__body{min-height:0;overflow-y:auto}
.sku-sales-daily-dialog .el-dialog__header,.sku-sales-daily-dialog .el-dialog__footer{flex-shrink:0}
.sku-sales-daily-dialog .daily-tools,.sku-sales-daily-dialog .daily-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.sku-sales-daily-dialog .daily-pagination{margin:14px 0}
.sku-sales-daily-dialog .daily-note{font-size:12px;color:#8693a5;line-height:1.6}
.sku-sales-daily-dialog .daily-trend{margin-top:20px;border-top:1px solid #eef2f7;padding-top:16px}
.sku-sales-daily-dialog h3{margin:0;color:#2b4b72;font-size:16px}
.sku-sales-daily-dialog .daily-profit{color:#15803d;font-weight:600}
.sku-sales-daily-dialog .daily-loss{color:#dc2626;font-weight:600}
.sku-sales-daily-dialog .daily-chart{overflow-x:auto}
@media(max-width:768px){.sku-sales-daily-dialog .daily-pagination{overflow-x:auto}.sku-sales-daily-dialog .performance-trend-chart{min-width:500px}}
</style>
