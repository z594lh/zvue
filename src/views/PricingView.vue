<template>
  <div class="pricing-page">
    <div class="page-header">
      <h1 class="page-title">SKU 售价计算</h1>
      <p class="page-subtitle">正向反算售价与反向推估利润率</p>
    </div>

    <div class="main-content">
      <el-tabs v-model="activeTab" type="border-card" @tab-change="handleTabChange">
        <!-- ==================== 正向计算 ==================== -->
        <el-tab-pane label="正向计算" name="forward">
          <div class="input-card">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
              <h3 class="section-title" style="margin:0;">参数设置</h3>
              <el-select
                v-model="formForward.shop_id"
                placeholder="选择店铺"
                style="width: 200px"
              >
                <el-option
                  v-for="shop in shopList"
                  :key="shop.id"
                  :label="shop.shop_name"
                  :value="shop.id"
                />
              </el-select>
            </div>
            <el-form :model="formForward" label-width="140px" :rules="forwardRules" ref="formForwardRef">
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="Seller SKU" prop="seller_sku">
                    <el-select
                      v-model="formForward.seller_sku"
                      placeholder="选择 SKU"
                      clearable
                      filterable
                      style="width: 100%"
                    >
                      <el-option
                        v-for="item in productList"
                        :key="item.seller_sku"
                        :label="item.seller_sku + (item.product_name ? ' - ' + item.product_name : '')"
                        :value="item.seller_sku"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="目标利润率" prop="target_profit_rate">
                    <el-input-number
                      v-model="formForward.target_profit_rate"
                      :min="0"
                      :max="1"
                      :precision="2"
                      :step="0.05"
                      style="width: 100%"
                    />
                    <span class="input-hint">如 0.25 = 25%</span>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider>可选参数（留空使用默认值）</el-divider>

              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item>
                    <template #label>
                      <span class="label-with-tip">
                        广告费率 (TACOS)
                        <el-tooltip effect="dark" content="TACOS = 广告花费 ÷ 总销售额（含自然销售额 + 广告归因销售额），表示广告费占总收入的比例。" placement="top">
                          <el-icon class="label-tip-icon"><QuestionFilled /></el-icon>
                        </el-tooltip>
                      </span>
                    </template>
                    <el-input-number
                      v-model="formForward.ad_rate"
                      :min="0"
                      :max="1"
                      :precision="2"
                      :step="0.05"
                      style="width: 100%"
                    />
                    <span class="input-hint">默认 0.20</span>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="退货率">
                    <el-input-number
                      v-model="formForward.refund_rate"
                      :min="0"
                      :max="1"
                      :precision="2"
                      :step="0.01"
                      style="width: 100%"
                    />
                    <span class="input-hint">默认 0.03</span>
                  </el-form-item>
                </el-col>
              </el-row>

              <div class="form-actions">
                <el-button type="primary" size="large" @click="handleForwardCalculate" :loading="loadingForward">
                  <el-icon><Search /></el-icon>
                  计算售价
                </el-button>
                <el-button size="large" @click="resetForwardForm">
                  <el-icon><Refresh /></el-icon>
                  重置
                </el-button>
              </div>
            </el-form>
          </div>

          <div v-if="resultForward" class="result-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
              <h3 class="section-title" style="margin:0;">计算结果</h3>
              <el-button type="primary" plain size="small" @click="viewCalcTree('forward')">
                <el-icon><View /></el-icon> 查看计算过程
              </el-button>
            </div>

            <div class="result-highlight">
              <div class="result-item primary">
                <div class="result-label">建议售价</div>
                <div class="result-value">${{ formatNumber(resultForward.suggested_price) }}</div>
              </div>
              <div class="result-item">
                <div class="result-label">预计利润</div>
                <div class="result-value" :style="{ color: (resultForward.profit_amount >= 0 ? '#67c23a' : '#f56c6c') }">${{ formatNumber(resultForward.profit_amount) }}</div>
              </div>
              <div class="result-item">
                <div class="result-label">实际利润率</div>
                <div class="result-value" style="color: #409eff;">{{ formatPercent(resultForward.actual_profit_rate) }}</div>
              </div>
            </div>

            <el-descriptions :column="2" border class="detail-descriptions">
              <el-descriptions-item label="SKU">{{ resultForward.seller_sku }}</el-descriptions-item>
              <el-descriptions-item label="产品名称">{{ resultForward.product_name || '-' }}</el-descriptions-item>
              <el-descriptions-item label="ASIN">{{ resultForward.asin || '-' }}</el-descriptions-item>
              <el-descriptions-item label="重量 (kg)">{{ resultForward.weight_kg || '-' }}</el-descriptions-item>
              <el-descriptions-item label="佣金费率">
                {{ formatPercent(resultForward.commission?.rate) }}
                <span class="source-hint">{{ resultForward.commission?.source }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="FBA 配送费">
                ${{ formatNumber(resultForward.fba_fee?.fee_usd) }}
                <span class="source-hint">{{ resultForward.fba_fee?.tier ? 'Size tier: ' + resultForward.fba_fee.tier : '' }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="采购成本">{{ resultForward.purchase_cost ? (resultForward.purchase_cost.value + ' ' + resultForward.purchase_cost.currency + ' ≈ $' + formatNumber(resultForward.purchase_cost.usd)) : '-' }}</el-descriptions-item>
              <el-descriptions-item label="汇率">{{ formatNumber(resultForward.inputs?.exchange_rate) }}</el-descriptions-item>
              <el-descriptions-item label="目标利润率">{{ formatPercent(resultForward.inputs?.target_profit_rate) }}</el-descriptions-item>
              <el-descriptions-item label="广告费率 (TACOS)">{{ formatPercent(resultForward.inputs?.ad_rate) }}</el-descriptions-item>
              <el-descriptions-item label="退货率">{{ formatPercent(resultForward.inputs?.refund_rate) }}</el-descriptions-item>
            </el-descriptions>

            <el-divider>成本拆解</el-divider>

            <div class="cost-breakdown-grid">
              <div class="cost-group-card">
                <div class="cost-group-header">固定成本 <span class="cost-group-note">(不随售价变动)</span></div>
                <div class="cost-items">
                  <div class="cost-item">采购成本 <span>${{ formatNumber(resultForward.cost_breakdown?.purchase_cost_usd) }}</span></div>
                  <div class="cost-item">头程运费 <span>${{ formatNumber(resultForward.cost_breakdown?.freight_cost_usd) }}</span></div>
                  <div class="cost-item">FBA配送费 <span>${{ formatNumber(resultForward.cost_breakdown?.fba_fee_usd) }}</span></div>
                </div>
                <div class="cost-group-total">= ${{ formatNumber(fixedCostUsd(resultForward.cost_breakdown)) }}</div>
              </div>
              <div class="cost-operator">+</div>
              <div class="cost-group-card">
                <div class="cost-group-header">变动成本 <span class="cost-group-note">(随售价浮动)</span></div>
                <div class="formula-line">= 售价 × (佣金率 + 广告率 + 退货率)</div>
                <div class="cost-items">
                  <div class="cost-item">佣金 <span>${{ formatNumber(resultForward.cost_breakdown?.commission_usd) }}</span></div>
                  <div class="cost-item">广告费 <span>${{ formatNumber(resultForward.cost_breakdown?.ad_cost_usd) }}</span></div>
                  <div class="cost-item">退货损失 <span>${{ formatNumber(resultForward.cost_breakdown?.refund_cost_usd) }}</span></div>
                </div>
                <div class="cost-group-total">= ${{ formatNumber(resultForward.cost_breakdown?.variable_cost_usd) }}</div>
              </div>
              <div class="cost-operator">=</div>
              <div class="cost-group-card cost-card-total">
                <div class="cost-group-header">总成本</div>
                <div class="cost-group-total cost-total-value">${{ formatNumber(resultForward.cost_breakdown?.total_cost_usd) }}</div>
              </div>
            </div>

            <div v-if="resultForward.freight_cost && resultForward.freight_cost.detail" style="margin-top:16px;">
              <el-divider>头程运费明细</el-divider>
              <div class="freight-detail">
                <div class="freight-meta">
                  <span>运单号：{{ resultForward.freight_cost.detail.waybill_no || '-' }}</span>
                  <span>货件：{{ resultForward.freight_cost.detail.shipment_id || '-' }}</span>
                </div>
                <div class="freight-meta">
                  <span>货代：{{ resultForward.freight_cost.detail.provider_name || '-' }}</span>
                </div>
                <div class="freight-meta">
                  <span>SKU重量：{{ resultForward.freight_cost.detail.sku_weight_kg }} kg</span>
                  <span>货件总重：{{ resultForward.freight_cost.detail.shipment_total_weight_kg }} kg</span>
                </div>
                <div class="freight-meta">
                  <span>运单总费用：¥{{ formatNumber(resultForward.freight_cost.detail.waybill_total_cost_cny) }}</span>
                  <span>运费：¥{{ formatNumber(resultForward.freight_cost.detail.freight_cost_cny) }}</span>
                  <span>关税：¥{{ formatNumber(resultForward.freight_cost.detail.tax_cost_cny) }}</span>
                  <span>杂费：¥{{ formatNumber(resultForward.freight_cost.detail.misc_cost_cny) }}</span>
                </div>
                <div class="freight-formula">
                  分摊 = 运单总费用 × (SKU重量 / 货件总重) = ¥{{ formatNumber(resultForward.freight_cost.detail.waybill_total_cost_cny) }} × ({{ resultForward.freight_cost.detail.sku_weight_kg }} / {{ resultForward.freight_cost.detail.shipment_total_weight_kg }}) = ¥{{ formatNumber(resultForward.freight_cost.cny) }} = ${{ formatNumber(resultForward.freight_cost.usd) }}
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- ==================== 反向计算 ==================== -->
        <el-tab-pane label="反向计算" name="reverse">
          <div class="input-card">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
              <h3 class="section-title" style="margin:0;">参数设置</h3>
              <el-select
                v-model="formReverse.shop_id"
                placeholder="选择店铺"
                style="width: 200px"
              >
                <el-option
                  v-for="shop in shopList"
                  :key="shop.id"
                  :label="shop.shop_name"
                  :value="shop.id"
                />
              </el-select>
            </div>
            <el-form :model="formReverse" label-width="140px" :rules="reverseRules" ref="formReverseRef">
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="Seller SKU" prop="seller_sku">
                    <el-select
                      v-model="formReverse.seller_sku"
                      placeholder="选择 SKU"
                      clearable
                      filterable
                      style="width: 100%"
                    >
                      <el-option
                        v-for="item in productList"
                        :key="item.seller_sku"
                        :label="item.seller_sku + (item.product_name ? ' - ' + item.product_name : '')"
                        :value="item.seller_sku"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="实际售价 (USD)" prop="selling_price">
                    <el-input-number
                      v-model="formReverse.selling_price"
                      :min="0.01"
                      :precision="2"
                      :step="1"
                      style="width: 100%"
                      placeholder="输入实际售价"
                    />
                    <span class="input-hint">如 29.99</span>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider>可选参数（留空使用默认值）</el-divider>

              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item>
                    <template #label>
                      <span class="label-with-tip">
                        广告费率 (TACOS)
                        <el-tooltip effect="dark" content="TACOS = 广告花费 ÷ 总销售额（含自然销售额 + 广告归因销售额），表示广告费占总收入的比例。" placement="top">
                          <el-icon class="label-tip-icon"><QuestionFilled /></el-icon>
                        </el-tooltip>
                      </span>
                    </template>
                    <el-input-number
                      v-model="formReverse.ad_rate"
                      :min="0"
                      :max="1"
                      :precision="2"
                      :step="0.05"
                      style="width: 100%"
                    />
                    <span class="input-hint">默认 0.20</span>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="退货率">
                    <el-input-number
                      v-model="formReverse.refund_rate"
                      :min="0"
                      :max="1"
                      :precision="2"
                      :step="0.01"
                      style="width: 100%"
                    />
                    <span class="input-hint">默认 0.03</span>
                  </el-form-item>
                </el-col>
              </el-row>

              <div class="form-actions">
                <el-button type="primary" size="large" @click="handleReverseCalculate" :loading="loadingReverse">
                  <el-icon><Search /></el-icon>
                  反推利润率
                </el-button>
                <el-button size="large" @click="resetReverseForm">
                  <el-icon><Refresh /></el-icon>
                  重置
                </el-button>
              </div>
            </el-form>
          </div>

          <div v-if="resultReverse" class="result-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
              <h3 class="section-title" style="margin:0;">计算结果</h3>
              <el-button type="primary" plain size="small" @click="viewCalcTree('reverse')">
                <el-icon><View /></el-icon> 查看计算过程
              </el-button>
            </div>

            <div class="result-highlight">
              <div class="result-item" :class="profitRateClass">
                <div class="result-label">实际利润率</div>
                <div class="result-value">{{ formatPercent(resultReverse.profit_rate) }}</div>
              </div>
              <div class="result-item">
                <div class="result-label">利润金额</div>
                <div class="result-value" :style="{ color: (resultReverse.profit_amount >= 0 ? '#67c23a' : '#f56c6c') }">${{ formatNumber(resultReverse.profit_amount) }}</div>
              </div>
              <div class="result-item">
                <div class="result-label">实际售价</div>
                <div class="result-value" style="color: #409eff;">${{ formatNumber(resultReverse.inputs?.selling_price) }}</div>
              </div>
            </div>

            <el-descriptions :column="2" border class="detail-descriptions">
              <el-descriptions-item label="SKU">{{ resultReverse.seller_sku }}</el-descriptions-item>
              <el-descriptions-item label="产品名称">{{ resultReverse.product_name || '-' }}</el-descriptions-item>
              <el-descriptions-item label="ASIN">{{ resultReverse.asin || '-' }}</el-descriptions-item>
              <el-descriptions-item label="重量 (kg)">{{ resultReverse.weight_kg || '-' }}</el-descriptions-item>
              <el-descriptions-item label="佣金费率">
                {{ formatPercent(resultReverse.commission?.rate) }}
                <span class="source-hint">{{ resultReverse.commission?.source }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="FBA 配送费">
                ${{ formatNumber(resultReverse.fba_fee?.fee_usd) }}
                <span class="source-hint">{{ resultReverse.fba_fee?.tier ? 'Size tier: ' + resultReverse.fba_fee.tier : '' }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="采购成本">{{ resultReverse.purchase_cost ? (resultReverse.purchase_cost.value + ' ' + resultReverse.purchase_cost.currency + ' ≈ $' + formatNumber(resultReverse.purchase_cost.usd)) : '-' }}</el-descriptions-item>
              <el-descriptions-item label="汇率">{{ formatNumber(resultReverse.inputs?.exchange_rate) }}</el-descriptions-item>
              <el-descriptions-item label="广告费率 (TACOS)">{{ formatPercent(resultReverse.inputs?.ad_rate) }}</el-descriptions-item>
              <el-descriptions-item label="退货率">{{ formatPercent(resultReverse.inputs?.refund_rate) }}</el-descriptions-item>
            </el-descriptions>

            <el-divider>成本拆解</el-divider>

            <div class="cost-breakdown-grid">
              <div class="cost-group-card">
                <div class="cost-group-header">固定成本 <span class="cost-group-note">(不随售价变动)</span></div>
                <div class="cost-items">
                  <div class="cost-item">采购成本 <span>${{ formatNumber(resultReverse.cost_breakdown?.purchase_cost_usd) }}</span></div>
                  <div class="cost-item">头程运费 <span>${{ formatNumber(resultReverse.cost_breakdown?.freight_cost_usd) }}</span></div>
                  <div class="cost-item">FBA配送费 <span>${{ formatNumber(resultReverse.cost_breakdown?.fba_fee_usd) }}</span></div>
                </div>
                <div class="cost-group-total">= ${{ formatNumber(fixedCostUsd(resultReverse.cost_breakdown)) }}</div>
              </div>
              <div class="cost-operator">+</div>
              <div class="cost-group-card">
                <div class="cost-group-header">变动成本 <span class="cost-group-note">(随售价浮动)</span></div>
                <div class="formula-line">= 售价 × (佣金率 + 广告率 + 退货率)</div>
                <div class="cost-items">
                  <div class="cost-item">佣金 <span>${{ formatNumber(resultReverse.cost_breakdown?.commission_usd) }}</span></div>
                  <div class="cost-item">广告费 <span>${{ formatNumber(resultReverse.cost_breakdown?.ad_cost_usd) }}</span></div>
                  <div class="cost-item">退货损失 <span>${{ formatNumber(resultReverse.cost_breakdown?.refund_cost_usd) }}</span></div>
                </div>
                <div class="cost-group-total">= ${{ formatNumber(resultReverse.cost_breakdown?.variable_cost_usd) }}</div>
              </div>
              <div class="cost-operator">=</div>
              <div class="cost-group-card cost-card-total">
                <div class="cost-group-header">总成本</div>
                <div class="cost-group-total cost-total-value">${{ formatNumber(resultReverse.cost_breakdown?.total_cost_usd) }}</div>
              </div>
            </div>

            <div v-if="resultReverse.freight_cost && resultReverse.freight_cost.detail" style="margin-top:16px;">
              <el-divider>头程运费明细</el-divider>
              <div class="freight-detail">
                <div class="freight-meta">
                  <span>运单号：{{ resultReverse.freight_cost.detail.waybill_no || '-' }}</span>
                  <span>货件：{{ resultReverse.freight_cost.detail.shipment_id || '-' }}</span>
                </div>
                <div class="freight-meta">
                  <span>货代：{{ resultReverse.freight_cost.detail.provider_name || '-' }}</span>
                </div>
                <div class="freight-meta">
                  <span>SKU重量：{{ resultReverse.freight_cost.detail.sku_weight_kg }} kg</span>
                  <span>货件总重：{{ resultReverse.freight_cost.detail.shipment_total_weight_kg }} kg</span>
                </div>
                <div class="freight-meta">
                  <span>运单总费用：¥{{ formatNumber(resultReverse.freight_cost.detail.waybill_total_cost_cny) }}</span>
                  <span>运费：¥{{ formatNumber(resultReverse.freight_cost.detail.freight_cost_cny) }}</span>
                  <span>关税：¥{{ formatNumber(resultReverse.freight_cost.detail.tax_cost_cny) }}</span>
                  <span>杂费：¥{{ formatNumber(resultReverse.freight_cost.detail.misc_cost_cny) }}</span>
                </div>
                <div class="freight-formula">
                  分摊 = 运单总费用 × (SKU重量 / 货件总重) = ¥{{ formatNumber(resultReverse.freight_cost.detail.waybill_total_cost_cny) }} × ({{ resultReverse.freight_cost.detail.sku_weight_kg }} / {{ resultReverse.freight_cost.detail.shipment_total_weight_kg }}) = ¥{{ formatNumber(resultReverse.freight_cost.cny) }} = ${{ formatNumber(resultReverse.freight_cost.usd) }}
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 计算过程弹窗 -->
    <el-dialog
      v-model="logsDialogVisible"
      :title="`计算过程 - ${currentLogSku}`"
      width="1100px"
      :destroy-on-close="false"
      align-center
    >
      <div style="max-height:60vh;overflow-y:auto;padding-right:8px;">
        <el-empty v-if="!treeData.length" description="暂无计算过程数据" />
        <el-tree
          v-else
          :key="treeKey"
          :data="treeData"
          :props="{ children: 'children' }"
          node-key="id"
          :indent="28"
          :default-expanded-keys="expandedKeys"
          style="background:transparent;"
        >
          <template #default="{ data }">
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;width:100%;white-space:nowrap;overflow:hidden;">
              <el-tag v-if="data.is_leaf" size="small" type="success" effect="light" style="flex-shrink:0;">叶子</el-tag>
              <el-tag v-else size="small" type="warning" effect="light" style="flex-shrink:0;">中间</el-tag>
              <span style="font-weight:600;color:#1a1a2e;flex-shrink:0;min-width:120px;overflow:hidden;text-overflow:ellipsis;" :title="getNodeLabel(data)">
                {{ getNodeLabel(data) }}
              </span>
              <span v-if="data.variable_value != null" style="font-family:monospace;font-size:13px;color:#333;background:#f5f7fa;padding:2px 10px;border-radius:4px;flex-shrink:0;">
                {{ data.variable_value }}
              </span>
              <span v-if="data.formula" style="font-size:12px;color:#409eff;background:#f0f5ff;padding:2px 10px;border-radius:4px;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">
                {{ translateFormula(data.formula) }}
              </span>
              <el-popover
                v-if="data.is_leaf && data.source_table"
                placement="top"
                trigger="click"
                :width="420"
              >
                <template #reference>
                  <span style="font-size:12px;color:#67c23a;background:#f0f9eb;padding:2px 10px;border-radius:4px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;max-width:300px;cursor:pointer;">
                    来源：{{ data.source_table }}.{{ data.source_field }} = {{ data.source_value }}
                  </span>
                </template>
                <pre style="margin:0;font-family:monospace;font-size:12px;line-height:1.6;background:#f8f9fa;padding:10px;border-radius:4px;white-space:pre-wrap;word-break:break-all;color:#333;">{{ buildSourceSql(data) }}</pre>
              </el-popover>
            </div>
          </template>
        </el-tree>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, View, QuestionFilled } from '@element-plus/icons-vue'
import { calculatePricing, calculateProfitRate, getProductOptions } from '@/services/api.js'
import { useShopCache } from '@/composables/useShopCache'

export default {
  name: 'PricingView',
  components: {
    Search,
    Refresh,
    View,
    QuestionFilled
  },
  setup() {
    const activeTab = ref('forward')

    // --- 正向计算 ---
    const loadingForward = ref(false)
    const formForwardRef = ref(null)
    const resultForward = ref(null)

    const formForward = reactive({
      seller_sku: '',
      shop_id: null,
      target_profit_rate: 0.25,
      ad_rate: 0.20,
      refund_rate: 0.03
    })

    const forwardRules = {
      seller_sku: [{ required: true, message: '请选择 SKU', trigger: 'change' }],
      target_profit_rate: [{ required: true, message: '请输入目标利润率', trigger: 'change' }]
    }

    const handleForwardCalculate = async () => {
      const valid = await formForwardRef.value?.validate().catch(() => false)
      if (!valid) return
      if (!formForward.shop_id) {
        ElMessage.warning('请选择店铺')
        return
      }

      loadingForward.value = true
      resultForward.value = null
      try {
        const payload = {
          seller_sku: formForward.seller_sku,
          target_profit_rate: formForward.target_profit_rate,
          shop_id: formForward.shop_id
        }
        if (formForward.ad_rate !== null && formForward.ad_rate !== undefined) payload.ad_rate = formForward.ad_rate
        if (formForward.refund_rate !== null && formForward.refund_rate !== undefined) payload.refund_rate = formForward.refund_rate

        const response = await calculatePricing(payload)
        if (response.data.status === 'success') {
          resultForward.value = response.data.data
          ElMessage.success('计算完成')
        } else {
          ElMessage.error(response.data.message || '计算失败')
        }
      } catch (error) {
        console.error('计算售价失败:', error)
        ElMessage.error('计算失败: ' + (error.response?.data?.message || error.message))
      } finally {
        loadingForward.value = false
      }
    }

    const resetForwardForm = () => {
      formForward.seller_sku = ''
      formForward.shop_id = null
      formForward.target_profit_rate = 0.25
      formForward.ad_rate = 0.20
      formForward.refund_rate = 0.03
      resultForward.value = null
      formForwardRef.value?.resetFields?.()
    }

    // --- 反向计算 ---
    const loadingReverse = ref(false)
    const formReverseRef = ref(null)
    const resultReverse = ref(null)

    const formReverse = reactive({
      seller_sku: '',
      shop_id: null,
      selling_price: null,
      ad_rate: 0.20,
      refund_rate: 0.03
    })

    const reverseRules = {
      seller_sku: [{ required: true, message: '请选择 SKU', trigger: 'change' }],
      selling_price: [{ required: true, message: '请输入实际售价', trigger: 'change' }]
    }

    const profitRateClass = computed(() => {
      if (!resultReverse.value) return ''
      const rate = resultReverse.value.profit_rate
      if (rate > 0) return 'positive'
      if (rate < 0) return 'negative'
      return 'zero'
    })

    const handleReverseCalculate = async () => {
      const valid = await formReverseRef.value?.validate().catch(() => false)
      if (!valid) return
      if (!formReverse.shop_id) {
        ElMessage.warning('请选择店铺')
        return
      }

      loadingReverse.value = true
      resultReverse.value = null
      try {
        const payload = {
          seller_sku: formReverse.seller_sku,
          selling_price: formReverse.selling_price,
          shop_id: formReverse.shop_id
        }
        if (formReverse.ad_rate !== null && formReverse.ad_rate !== undefined) payload.ad_rate = formReverse.ad_rate
        if (formReverse.refund_rate !== null && formReverse.refund_rate !== undefined) payload.refund_rate = formReverse.refund_rate

        const response = await calculateProfitRate(payload)
        if (response.data.status === 'success') {
          resultReverse.value = response.data.data
          ElMessage.success('计算完成')
        } else {
          ElMessage.error(response.data.message || '计算失败')
        }
      } catch (error) {
        console.error('反推利润率失败:', error)
        ElMessage.error('计算失败: ' + (error.response?.data?.message || error.message))
      } finally {
        loadingReverse.value = false
      }
    }

    const resetReverseForm = () => {
      formReverse.seller_sku = ''
      formReverse.shop_id = null
      formReverse.selling_price = null
      formReverse.ad_rate = 0.20
      formReverse.refund_rate = 0.03
      resultReverse.value = null
      formReverseRef.value?.resetFields?.()
    }

    // --- 公用 ---
    const { shopList, fetchShopList, defaultShopId } = useShopCache()
    const productList = ref([])

    const formatNumber = (val) => {
      if (val == null) return '-'
      return Number(val).toFixed(2)
    }

    const formatPercent = (val) => {
      if (val == null) return '-'
      return (Number(val) * 100).toFixed(2) + '%'
    }

    const fixedCostUsd = (breakdown) => {
      if (!breakdown) return null
      if (breakdown.fixed_cost_usd != null) return breakdown.fixed_cost_usd
      return (breakdown.purchase_cost_usd || 0) + (breakdown.freight_cost_usd || 0) + (breakdown.fba_fee_usd || 0)
    }

    // --- 计算过程弹窗 ---
    const logsDialogVisible = ref(false)
    const logsLoading = ref(false)
    const currentLogSku = ref('')
    const treeData = ref([])
    const varLabelMap = ref({})
    const expandedKeys = ref([])
    const treeKey = ref(0)
    const currentResultMode = ref('forward')

    const getNodeLabel = (data) => {
      const candidates = [data.variable_label, data.variableLabel, data.label, data.varLabel]
      for (const c of candidates) {
        if (c != null && String(c).trim() !== '') return String(c).trim()
      }
      return data.variable_name || '-'
    }

    const injectIds = (nodes, prefix = '') => {
      nodes.forEach((node, index) => {
        node.id = prefix ? `${prefix}-${index}` : `root-${index}`
        if (node.children && node.children.length > 0) {
          injectIds(node.children, node.id)
        }
      })
    }

    const buildLabelMap = (nodes) => {
      const map = {}
      const walk = (list) => {
        list.forEach(node => {
          if (node.variable_name) {
            const label = getNodeLabel(node)
            if (label && label !== node.variable_name) {
              map[node.variable_name] = label
            }
          }
          if (node.children && node.children.length > 0) {
            walk(node.children)
          }
        })
      }
      walk(nodes)
      return map
    }

    const translateFormula = (formula) => {
      if (!formula || typeof formula !== 'string') return formula
      const map = varLabelMap.value
      const names = Object.keys(map).sort((a, b) => b.length - a.length)
      let result = formula
      names.forEach(name => {
        const regex = new RegExp(`\\b${name}\\b`, 'g')
        result = result.replace(regex, map[name])
      })
      return result
    }

    const buildSourceSql = (data) => {
      if (!data.source_table || !data.source_field) return ''
      let sql = `select ${data.source_field}\nfrom ${data.source_table}`
      if (data.source_condition) {
        sql += `\n${data.source_condition}`
      }
      return sql
    }

    const viewCalcTree = (mode) => {
      currentResultMode.value = mode
      const result = mode === 'forward' ? resultForward.value : resultReverse.value
      currentLogSku.value = result?.seller_sku || ''
      const calcTree = result?.calc_tree
      if (calcTree) {
        const cloned = JSON.parse(JSON.stringify(calcTree))
        injectIds([cloned])
        treeData.value = [cloned]
      } else {
        treeData.value = []
      }
      varLabelMap.value = buildLabelMap(treeData.value)
      expandedKeys.value = treeData.value.map(node => node.id)
      treeKey.value++
      logsDialogVisible.value = true
    }

    const handleTabChange = () => {
      // 切换 tab 时不自动计算
    }

    const fetchProducts = async () => {
      try {
        const response = await getProductOptions()
        if (response.data.status === 'success') {
          productList.value = response.data.data || []
        }
      } catch (error) {
        console.error('获取产品列表失败:', error)
      }
    }

    onMounted(() => {
      fetchProducts()
      fetchShopList().then(() => {
        const defaultId = defaultShopId()
        formForward.shop_id = defaultId
        formReverse.shop_id = defaultId
      })
    })

    return {
      activeTab,
      loadingForward,
      formForwardRef,
      formForward,
      forwardRules,
      resultForward,
      handleForwardCalculate,
      resetForwardForm,
      loadingReverse,
      formReverseRef,
      formReverse,
      reverseRules,
      resultReverse,
      profitRateClass,
      handleReverseCalculate,
      resetReverseForm,
      shopList,
      productList,
      formatNumber,
      formatPercent,
      fixedCostUsd,
      logsDialogVisible,
      logsLoading,
      currentLogSku,
      treeData,
      varLabelMap,
      expandedKeys,
      treeKey,
      getNodeLabel,
      translateFormula,
      buildSourceSql,
      viewCalcTree,
      handleTabChange
    }
  }
}
</script>

<style scoped>
.pricing-page {
  max-width: 1000px;
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

.main-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.input-card,
.result-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.input-card {
  margin-top: 16px;
}

.result-card {
  margin-top: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 20px 0;
}

.input-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  display: block;
}

.source-hint {
  font-size: 11px;
  color: #909399;
  margin-left: 8px;
}

/* 成本拆解三列布局 */
.cost-breakdown-grid {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin-top: 8px;
}

.cost-group-card {
  flex: 1;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  min-width: 0;
}

.cost-group-card.cost-card-total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.cost-group-header {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.cost-card-total .cost-group-header {
  color: rgba(255, 255, 255, 0.85);
}

.cost-group-note {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

.cost-card-total .cost-group-note {
  color: rgba(255, 255, 255, 0.7);
}

.formula-line {
  font-size: 11px;
  color: #909399;
  margin-bottom: 8px;
  background: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

.cost-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.cost-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #666;
  background: #fff;
  padding: 4px 8px;
  border-radius: 4px;
}

.cost-item span {
  font-family: monospace;
  font-weight: 600;
  color: #333;
}

.cost-group-total {
  text-align: right;
  font-size: 16px;
  font-weight: 700;
  font-family: monospace;
  color: #333;
  padding-top: 6px;
  border-top: 1px dashed #ddd;
}

.cost-card-total .cost-group-total {
  color: #fff;
  border-top-color: rgba(255, 255, 255, 0.3);
  font-size: 22px;
}

.cost-operator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  flex-shrink: 0;
  font-size: 22px;
  font-weight: 700;
  color: #909399;
}

.form-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.result-highlight {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.result-item {
  background: #f5f7fa;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
}

.result-item.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.result-item.primary .result-label,
.result-item.primary .result-value {
  color: #fff;
}

.result-item.positive {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  color: #fff;
}

.result-item.positive .result-label,
.result-item.positive .result-value {
  color: #fff;
}

.result-item.negative {
  background: linear-gradient(135deg, #f56c6c 0%, #e64242 100%);
  color: #fff;
}

.result-item.negative .result-label,
.result-item.negative .result-value {
  color: #fff;
}

.result-item.zero {
  background: #909399;
  color: #fff;
}

.result-item.zero .result-label,
.result-item.zero .result-value {
  color: #fff;
}

.result-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.result-value {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.detail-descriptions {
  margin-top: 16px;
}

.freight-detail {
  line-height: 1.8;
}

.freight-amount {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
}

.freight-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #666;
  flex-wrap: wrap;
}

.freight-formula {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
}

.label-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.label-tip-icon {
  color: #909399;
  cursor: help;
  font-size: 14px;
}

/* 响应式 */
@media (max-width: 768px) {
  .pricing-page {
    padding: 12px;
  }

  .page-title {
    font-size: 24px;
  }

  .input-card,
  .result-card {
    padding: 16px;
  }

  .result-highlight {
    grid-template-columns: 1fr;
  }

  .cost-breakdown-grid {
    flex-direction: column;
    gap: 12px;
  }

  .cost-operator {
    width: 100%;
    height: 30px;
  }
}
</style>
