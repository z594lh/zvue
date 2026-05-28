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
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 class="section-title" style="margin:0;">计算结果</h3>
          <el-button type="primary" plain size="small" @click="viewCalcTree">
            <el-icon><View /></el-icon> 查看计算过程
          </el-button>
        </div>

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
                trigger="hover"
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh, View } from '@element-plus/icons-vue'
import { calculatePricing, getProducts } from '@/services/api.js'

export default {
  name: 'PricingView',
  components: {
    Search,
    Refresh,
    View
  },
  setup() {
    const loading = ref(false)
    const formRef = ref(null)
    const result = ref(null)

    // 计算过程弹窗
    const logsDialogVisible = ref(false)
    const logsLoading = ref(false)
    const currentLogSku = ref('')
    const treeData = ref([])
    const varLabelMap = ref({})
    const expandedKeys = ref([])
    const treeKey = ref(0)

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

    const getNodeLabel = (data) => {
      const candidates = [data.variable_label, data.variableLabel, data.label, data.varLabel]
      for (const c of candidates) {
        if (c != null && String(c).trim() !== '') return String(c).trim()
      }
      return data.variable_name || '-'
    }

    // 为节点注入唯一 id（后端 calc_tree 无 id 字段）
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

    const viewCalcTree = () => {
      currentLogSku.value = result.value?.seller_sku || ''
      const calcTree = result.value?.calc_tree
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
      formatPercent,
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
      viewCalcTree
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
