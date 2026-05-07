<template>
  <div class="pricing-page">
    <div class="page-header">
      <h1 class="page-title">SKU 售价反算</h1>
      <p class="page-subtitle">根据目标利润率，反推亚马逊售价</p>
    </div>

    <div class="main-content">
      <!-- 输入区域 -->
      <div class="input-card">
        <h3 class="section-title">参数设置</h3>
        <el-form :model="formData" label-width="140px" :rules="formRules" ref="formRef">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="Seller SKU" prop="seller_sku">
                <el-select
                  v-model="formData.seller_sku"
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
                  v-model="formData.target_profit_rate"
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
              <el-form-item label="广告费率 (ACoS)">
                <el-input-number
                  v-model="formData.ad_rate"
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
                  v-model="formData.refund_rate"
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
            <el-button type="primary" size="large" @click="handleCalculate" :loading="loading">
              <el-icon><Search /></el-icon>
              计算售价
            </el-button>
            <el-button size="large" @click="resetForm">
              <el-icon><Refresh /></el-icon>
              重置
            </el-button>
          </div>
        </el-form>
      </div>

      <!-- 结果区域 -->
      <div v-if="result" class="result-card">
        <h3 class="section-title">计算结果</h3>

        <div class="result-highlight">
          <div class="result-item primary">
            <div class="result-label">建议售价</div>
            <div class="result-value">${{ formatNumber(result.suggested_price) }}</div>
          </div>
          <div class="result-item">
            <div class="result-label">预计利润</div>
            <div class="result-value" style="color: #67c23a;">${{ formatNumber(result.profit_amount) }}</div>
          </div>
          <div class="result-item">
            <div class="result-label">利润率</div>
            <div class="result-value" style="color: #409eff;">{{ formatPercent(result.actual_profit_rate) }}</div>
          </div>
        </div>

        <el-descriptions :column="2" border class="detail-descriptions">
          <el-descriptions-item label="SKU">{{ result.seller_sku }}</el-descriptions-item>
          <el-descriptions-item label="产品名称">{{ result.product_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="ASIN">{{ result.asin || '-' }}</el-descriptions-item>
          <el-descriptions-item label="重量 (kg)">{{ result.weight_kg || '-' }}</el-descriptions-item>
          <el-descriptions-item label="采购成本">{{ result.purchase_cost ? (result.purchase_cost.value + ' ' + result.purchase_cost.currency + ' ≈ $' + formatNumber(result.purchase_cost.usd)) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="FBA 配送费">${{ formatNumber(result.cost_breakdown?.fba_fee_usd) }}</el-descriptions-item>
          <el-descriptions-item label="佣金">${{ formatNumber(result.cost_breakdown?.commission_usd) }}</el-descriptions-item>
          <el-descriptions-item label="广告费">${{ formatNumber(result.cost_breakdown?.ad_cost_usd) }}</el-descriptions-item>
          <el-descriptions-item label="退货损失">${{ formatNumber(result.cost_breakdown?.refund_cost_usd) }}</el-descriptions-item>
          <el-descriptions-item label="头程运费">
            <template v-if="result.freight_cost && result.freight_cost.detail">
              <div class="freight-detail">
                <div class="freight-amount">${{ formatNumber(result.cost_breakdown?.freight_cost_usd) }}</div>
                <div class="freight-meta">
                  <span>货件：{{ result.freight_cost.detail.shipment_id || '-' }}</span>
                  <span>数量：{{ result.freight_cost.detail.quantity_shipped }} 件</span>
                </div>
                <div class="freight-meta">
                  <span>SKU重量：{{ result.freight_cost.detail.sku_weight_kg }} kg</span>
                  <span>货件总重：{{ result.freight_cost.detail.shipment_total_weight_kg }} kg</span>
                </div>
                <div class="freight-meta">
                  <span>运单总费用：¥{{ formatNumber(result.freight_cost.detail.waybill_total_cost_cny) }}</span>
                </div>
                <div class="freight-formula">分摊公式：{{ result.freight_cost.detail.allocation_formula }}</div>
              </div>
            </template>
            <template v-else>${{ formatNumber(result.cost_breakdown?.freight_cost_usd) }}</template>
          </el-descriptions-item>
          <el-descriptions-item label="总成本">${{ formatNumber(result.cost_breakdown?.total_cost_usd) }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { calculatePricing, getProducts } from '@/services/api.js'

export default {
  name: 'PricingView',
  components: {
    Search,
    Refresh
  },
  setup() {
    const loading = ref(false)
    const formRef = ref(null)
    const result = ref(null)

    const formData = reactive({
      seller_sku: '',
      target_profit_rate: 0.25,
      ad_rate: 0.20,
      refund_rate: 0.03
    })

    const formRules = {
      seller_sku: [{ required: true, message: '请输入 SKU', trigger: 'blur' }],
      target_profit_rate: [{ required: true, message: '请输入目标利润率', trigger: 'change' }]
    }

    const handleCalculate = async () => {
      const valid = await formRef.value?.validate().catch(() => false)
      if (!valid) return

      loading.value = true
      result.value = null
      try {
        const payload = {
          seller_sku: formData.seller_sku,
          target_profit_rate: formData.target_profit_rate
        }
        if (formData.ad_rate !== null && formData.ad_rate !== undefined) payload.ad_rate = formData.ad_rate
        if (formData.refund_rate !== null && formData.refund_rate !== undefined) payload.refund_rate = formData.refund_rate

        const response = await calculatePricing(payload)
        if (response.data.status === 'success') {
          result.value = response.data.data
          ElMessage.success('计算完成')
        } else {
          ElMessage.error(response.data.message || '计算失败')
        }
      } catch (error) {
        console.error('计算售价失败:', error)
        ElMessage.error('计算失败: ' + (error.response?.data?.message || error.message))
      } finally {
        loading.value = false
      }
    }

    const resetForm = () => {
      formData.seller_sku = ''
      formData.target_profit_rate = 0.25
      formData.ad_rate = 0.20
      formData.refund_rate = 0.03
      result.value = null
      formRef.value?.resetFields?.()
    }

    const formatNumber = (val) => {
      if (val == null) return '-'
      return Number(val).toFixed(2)
    }

    const formatPercent = (val) => {
      if (val == null) return '-'
      return (Number(val) * 100).toFixed(2) + '%'
    }

    const productList = ref([])

    const fetchProducts = async () => {
      try {
        const response = await getProducts({ status: 1, page_size: 9999 })
        if (response.data.status === 'success') {
          productList.value = response.data.data?.list || []
        }
      } catch (error) {
        console.error('获取产品列表失败:', error)
      }
    }

    onMounted(() => {
      fetchProducts()
    })

    return {
      loading,
      formRef,
      formData,
      formRules,
      result,
      productList,
      handleCalculate,
      resetForm,
      formatNumber,
      formatPercent
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
}
</style>
