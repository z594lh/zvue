<template>
  <el-dialog v-model="visible" :title="`${meta.sku || ''} · 库存止损参考`" width="min(1200px, 96vw)" class="sku-decision-dialog" append-to-body @close="clear">
    <p class="decision-note">{{ meta.name }} · {{ meta.shopName }} · {{ decision.currency || '币种待核实' }} · 判断截至 {{ decision.date_to || '—' }}<template v-if="decision.basis_days"> · 主参考 {{ decision.basis_days }} 天</template></p>
    <el-alert :title="decision.label || '暂不能判断'" :description="decision.summary || '请更新后端并重新查询'" :type="alertType" :style="recoveryToneStyle(decision)" :closable="false" show-icon />
    <p v-if="decision.fallback_note" class="decision-caution">{{ decision.fallback_note }}</p>
    <div class="decision-formula">
      <strong>每件回收贡献＝平均每件利润＋每件成本</strong>
      <p>主要用于判断<strong>亏损 SKU 继续销售，还能收回多少已投入成本</strong>。平均每件利润已经扣除了产品成本和头程运费，而这些钱已经花出去了；把这部分成本加回来，是为了区分“亏损但还能回收部分成本”和“越卖越额外亏钱”。</p>
      <p><strong>正数：</strong>虽然账面亏损，仍能收回部分成本；<strong>为 0：</strong>无法收回产品和头程成本；<strong>负数：</strong>不仅收不回成本，每卖一件还会额外亏钱，应优先评估止损。</p>
      <small>以上按历史平均估算，金额为 USD。是否直接弃置，还需比较弃置费、后续仓储 / 超龄费及其他处置回收额，不能只凭这个数决定；能回收部分成本也不代表值得补货。</small>
    </div>
    <el-table :data="decision.periods || []" stripe :row-class-name="periodClass" style="width:100%">
      <el-table-column label="参考周期" width="125"><template #default="{row}"><strong>{{ row.days }} 天</strong><el-tag v-if="row.days===decision.basis_days" size="small" type="info" class="basis-tag">主参考</el-tag></template></el-table-column>
      <el-table-column label="日报覆盖 / 销量" width="145"><template #default="{row}"><div>{{ row.recorded_days }}/{{ row.days }} 天 · {{ row.sales_qty ?? '—' }} 件</div><small v-if="!row.complete" class="decision-caution">仅已有日报小计</small></template></el-table-column>
      <el-table-column label="总利润" min-width="110" align="right">
        <template #header><el-tooltip content="所选周期内已有日报的利润合计（USD），已扣产品成本、头程运费、配送费、平台佣金、广告费及原日报分摊退款；不是单件利润，也不是实际到账。缺日报时仅为已有数据小计。" popper-class="sku-decision-tooltip" placement="top"><span class="decision-column-help" tabindex="0">总利润 <el-icon><QuestionFilled /></el-icon></span></el-tooltip></template>
        <template #default="{row}"><span :class="amountClass(row.profit)">{{ money(row.profit) }}</span></template>
      </el-table-column>
      <el-table-column label="平均每件利润" min-width="150" align="right">
        <template #header><el-tooltip content="平均每件利润＝周期总利润÷周期销量，单位 USD/件。按整期金额除销量，不是每日单件利润的简单平均；无销量日的广告消耗也计入。负数表示按历史平均每卖一件账面亏损。" popper-class="sku-decision-tooltip" placement="top"><span class="decision-column-help" tabindex="0">平均每件利润 <el-icon><QuestionFilled /></el-icon></span></el-tooltip></template>
        <template #default="{row}"><span :class="amountClass(row.unit_profit)">{{ money(row.unit_profit) }}</span></template>
      </el-table-column>
      <el-table-column label="每件成本 (USD)" min-width="155" align="right">
        <template #header><el-tooltip content="每件成本＝（周期产品成本＋周期头程运费）÷周期销量，单位 USD/件。两项成本已在生成日报时由人民币换算成 USD，此处不二次换汇；采用历史成本的销量加权平均，不是当前采购报价，不含广告、配送费和平台佣金。悬浮数值可查看成本拆分；成本缺失或无法确认时显示 —。" popper-class="sku-decision-tooltip" placement="top"><span class="decision-column-help" tabindex="0">每件成本 (USD) <el-icon><QuestionFilled /></el-icon></span></el-tooltip></template>
        <template #default="{row}"><el-tooltip v-if="row.costs_known && row.unit_cost!=null" :content="`周期产品成本 USD ${money(row.product_cost)} ＋ 周期头程运费 USD ${money(row.headway_cost)}，再除以周期销量 ${row.sales_qty} 件。两项均为已换算的历史 USD 金额。`" popper-class="sku-decision-tooltip" placement="top"><span tabindex="0">{{ money(row.unit_cost) }}</span></el-tooltip><span v-else>—</span></template>
      </el-table-column>
      <el-table-column label="每件回收贡献" min-width="195" align="right">
        <template #header><el-tooltip content="主要针对亏损 SKU：平均每件利润已扣除产品成本和头程运费，这些成本已经支出。每件回收贡献＝平均每件利润＋每件成本（USD/件），用来判断继续销售还能收回多少已投入成本。正数表示仍能收回部分成本；为0表示无法收回成本；负数为除库存成本外还在额外亏钱。是否直接弃置，还需比较弃置费、后续仓储/超龄费及其他处置回收额，不能仅凭负数断言弃置更划算。不是额外利润或实际到账，也不代表值得补货；按原金额计算，展示四舍五入可能有尾差。" popper-class="sku-decision-tooltip" placement="top"><span class="decision-column-help" tabindex="0">每件回收贡献 <el-icon><QuestionFilled /></el-icon></span></el-tooltip></template>
        <template #default="{row}"><template v-if="row.costs_known && row.unit_recovery!=null"><span :class="amountClass(row.unit_recovery)">{{ money(row.unit_recovery) }}</span><small class="decision-cell-formula">{{ money(row.unit_profit) }} ＋ {{ money(row.unit_cost) }}</small></template><span v-else>—</span></template>
      </el-table-column>
      <el-table-column label="资料说明" min-width="220" show-overflow-tooltip><template #default="{row}">{{ row.reason || '日报完整、样本达到参考数量；不代表未来保证' }}</template></el-table-column>
    </el-table>
    <p class="decision-note">金额单位：{{ decision.currency || '未知' }}。退款已包含在原利润中，不再重复扣除；无销量不计算单件指标。</p>
    <section class="decision-reading">
      <h3>近期变化与库存</h3>
      <p v-if="decision.trend">近7天对比前7天，每件回收贡献 <strong :class="amountClass(decision.trend.change)">{{ decision.trend.direction==='up'?'↑':decision.trend.direction==='down'?'↓':'→' }} {{ money(decision.trend.change) }}</strong>。两段均须日报完整且至少 {{ decision.rules?.min_units || 10 }} 件，才展示变化。</p>
      <p v-else>近7天与前7天的可比样本不足，或当前资料不足，暂不判断涨跌。</p>
      <p>报表库存快照：<strong>{{ money(decision.stock,0) }} 件</strong>；按主参考周期销量估算，可销售约 <strong>{{ money(decision.stock_cover_days,1) }} 天</strong>。此为主表库存快照，不是实时库存。</p>
      <p class="decision-caution">弃置费：未纳入。未来仓储 / 超龄费：未纳入。不输出“直接弃置一定更划算”的结论。</p>
    </section>
    <el-collapse><el-collapse-item title="判断规则与适用边界" name="rules">
      <p>14天主判断；样本少时才参考30天，必须明确显示参考周期。每周期至少 {{ decision.rules?.min_units || 10 }} 件且日报完整、成本有效；近14天无销量不借用旧30天盈利结论。</p>
      <p>亏损时：回收贡献为负提示“继续销售额外亏钱”；等于0单独提示无成本回收；为正时提示“亏损但能回收部分成本”。回收比例＝每件回收贡献÷每件成本（产品＋头程），按不足10%、10%～20%直至90%～100%分档，各档包含下限、不含上限；红色越深表示回收比例越低。按未舍入金额分档，展示取整不改变所属档位。</p>
      <p>例如平均每件利润 -3.29 USD、每件成本 3.50 USD，每件回收贡献＝-3.29＋3.50＝0.21 USD；回收比例＝0.21÷3.50＝6%，因此标为“亏损但能回收部分成本（不足10%）”。</p>
      <p>盈利和持平标签不变。超过3天未更新日报时暂停明确结论。10件、10%分档和3天是运营阅读参考，不是统计置信保证、考核标准或Amazon收费门槛。</p>
      <p v-for="note in decision.limitations || []" :key="note">{{ note }}</p>
      <p>本功能只提供人工判断依据，不修改广告、不补货、不降价、不提交移除或弃置。</p>
    </el-collapse-item></el-collapse>
    <template #footer><el-button @click="close">关闭</el-button></template>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onDeactivated, ref } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'
import { recoveryToneStyle } from '@/services/skuInventoryDecision.js'
const visible=ref(false),meta=ref({}),decision=ref({})
const alertType=computed(()=>({profitable:'success',recoverable:'error',thin:'warning',draining:'error'}[decision.value.code] || 'info'))
const money=(value,digits=2)=>value==null?'—':Number(value).toLocaleString('zh-CN',{minimumFractionDigits:digits,maximumFractionDigits:digits===2?4:digits})
const amountClass=value=>value==null?'':Number(value)>0?'decision-positive':Number(value)<0?'decision-negative':''
const periodClass=({row})=>row.days===decision.value.basis_days?'decision-basis-row':''
const clear=()=>{meta.value={};decision.value={}}
const close=()=>{visible.value=false;clear()}
const open=(row,shops)=>{
  meta.value={sku:row.sku,name:row.product_name || '',shopName:shops.find(shop=>Number(shop.id)===Number(row.shop_id))?.shop_name || `店铺 ${row.shop_id}`}
  decision.value=JSON.parse(JSON.stringify(row.inventory_decision || {}));visible.value=true
}
onDeactivated(close)
onBeforeUnmount(close)
defineExpose({open,close})
</script>

<style>
.sku-decision-dialog{display:flex;flex-direction:column;max-height:90vh;margin-top:5vh !important;border-radius:12px}
.sku-decision-dialog .el-dialog__body{min-height:0;overflow:auto}
.sku-decision-dialog .el-dialog__header,.sku-decision-dialog .el-dialog__footer{flex-shrink:0}
.sku-decision-dialog .decision-note{color:#8693a5;font-size:12px;line-height:1.7}
.sku-decision-dialog .decision-formula{margin:16px 0;padding:12px 16px;background:#f3f7ff;border-radius:8px;line-height:1.8;color:#2b4b72}
.sku-decision-dialog .decision-formula small{color:#71829b}
.sku-decision-dialog .decision-formula p{margin:6px 0;font-size:13px}
.sku-decision-dialog .decision-reading{margin:20px 0;font-size:13px;line-height:1.7}
.sku-decision-dialog h3{color:#2b4b72;font-size:15px}
.sku-decision-dialog .decision-caution{color:#a16207;font-size:12px}
.sku-decision-dialog .decision-positive{color:#15803d;font-weight:600}
.sku-decision-dialog .decision-negative{color:#dc2626;font-weight:600}
.sku-decision-dialog .basis-tag{margin-left:5px}
.sku-decision-dialog .decision-column-help{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;cursor:help}
.sku-decision-dialog .decision-column-help .el-icon{font-size:12px;color:#8693a5}
.sku-decision-dialog .decision-cell-formula{display:block;margin-top:4px;color:#71829b;font-size:11px;white-space:nowrap}
.sku-decision-dialog .decision-basis-row{--el-table-tr-bg-color:#f2f6ff}
.sku-decision-tooltip{max-width:380px;white-space:pre-line;line-height:1.7}
</style>
