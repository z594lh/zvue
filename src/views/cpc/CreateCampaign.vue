<template>
  <CpcLayout active-tab="campaigns" @shop-change="onShopChange">
    <div class="cpc-create-page">
      <div class="page-header">
        <div class="header-left">
          <el-button @click="$router.back()"><el-icon><ArrowLeft /></el-icon> 返回</el-button>
          <h2>{{ pageTitle }}</h2>
        </div>
      </div>

      <el-steps :active="step" finish-status="success" align-center style="margin-bottom:30px">
        <el-step title="活动设置" />
        <el-step title="广告组与选品" />
        <el-step title="投放设置" description="可选" />
      </el-steps>

      <div class="shop-row">
        <span class="label">当前店铺ID：</span>
        <span>{{ shopId || '未选择' }}</span>
      </div>

      <el-card v-loading="loading" shadow="hover">
        <!-- Step 1: 活动设置 -->
        <template v-if="step === 0">
          <el-form :model="form1" label-width="140px" ref="form1Ref" :rules="form1Rules">
            <el-form-item label="活动名称" prop="name">
              <el-input v-model="form1.name" placeholder="留空自动生成" maxlength="128" show-word-limit style="width:400px" />
            </el-form-item>
            <el-form-item label="投放类型" prop="targetingType" required>
              <el-radio-group v-model="form1.targetingType">
                <el-radio-button value="AUTO">自动投放</el-radio-button>
                <el-radio-button value="MANUAL">手动投放</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="竞价策略" required>
              <el-select v-model="form1.biddingStrategy" style="width:280px">
                <el-option label="动态竞价-仅降低" value="LEGACY_FOR_SALES" />
                <el-option label="动态竞价-提高与降低" value="AUTO_FOR_SALES" />
                <el-option label="固定竞价" value="MANUAL" />
              </el-select>
            </el-form-item>
            <el-form-item label="日预算" prop="dailyBudget" required>
              <el-input-number v-model="form1.dailyBudget" :min="1" :step="5" :precision="2" controls-position="right" />
              <span style="margin-left:8px;color:#909399">$</span>
            </el-form-item>
            <el-form-item label="开始日期">
              <el-date-picker v-model="form1.startDate" type="date" value-format="YYYY-MM-DD" placeholder="今天" style="width:200px" />
            </el-form-item>
            <el-form-item label="结束日期">
              <el-date-picker v-model="form1.endDate" type="date" value-format="YYYY-MM-DD" placeholder="不限" style="width:200px" />
            </el-form-item>
            <el-form-item label="广告组合">
              <el-select v-model="form1.portfolioId" placeholder="不指定" clearable filterable style="width:280px" @focus="loadPortfolios">
                <el-option v-for="p in portfolios" :key="p.portfolioId" :label="p.name" :value="p.portfolioId" />
              </el-select>
            </el-form-item>
            <el-form-item label="广告位出价调整">
              <div style="display:flex;flex-direction:column;gap:8px">
                <div><span style="display:inline-block;width:120px">搜索顶部:</span>
                  <el-input-number v-model="form1.topPer" :min="0" :max="900" :step="1" size="small" controls-position="right" /> %
                </div>
                <div><span style="display:inline-block;width:120px">搜索其余:</span>
                  <el-input-number v-model="form1.restPer" :min="0" :max="900" :step="1" size="small" controls-position="right" /> %
                </div>
                <div><span style="display:inline-block;width:120px">商品详情页:</span>
                  <el-input-number v-model="form1.productPer" :min="0" :max="900" :step="1" size="small" controls-position="right" /> %
                </div>
              </div>
            </el-form-item>
          </el-form>
        </template>

        <!-- Step 2: 广告组与选品 -->
        <template v-if="step === 1">
          <el-form :model="form2" label-width="140px" ref="form2Ref" :rules="form2Rules">
            <el-form-item label="广告组名称" prop="name">
              <el-input v-model="form2.name" placeholder="留空自动生成" maxlength="128" style="width:400px" />
            </el-form-item>
            <el-form-item label="默认出价" prop="defaultBid" required>
              <el-input-number v-model="form2.defaultBid" :min="0.01" :step="0.01" :precision="2" controls-position="right" />
              <span style="margin-left:8px;color:#909399">$</span>
            </el-form-item>
            <el-form-item label="选择产品" required>
              <div style="display:flex;gap:8px;margin-bottom:8px">
                <el-select v-model="searchType" style="width:120px">
                  <el-option label="ASIN" value="ASIN" />
                  <el-option label="SKU" value="SELLER_SKU" />
                </el-select>
                <el-input v-model="searchQuery" placeholder="输入ASIN或SKU搜索" style="width:280px" @keyup.enter="searchProducts" />
                <el-button type="primary" class="btn-search" @click="searchProducts">搜索</el-button>
              </div>
              <el-table v-if="searchResults.length" :data="searchResults" stripe size="small" max-height="240" style="width:620px" @selection-change="handleSelectionChange">
                <el-table-column type="selection" width="50" />
                <el-table-column label="商品" min-width="220">
                  <template #default="{ row }">
                    <div style="display:flex;align-items:center;gap:8px">
                      <el-image v-if="row.main_image_url" :src="row.main_image_url" style="width:40px;height:40px;border-radius:4px;flex-shrink:0" fit="cover" />
                      <div v-else style="width:40px;height:40px;background:#f0f0f0;border-radius:4px;flex-shrink:0"></div>
                      <div class="product-info">
                        <div class="product-name" :title="row.item_name">{{ row.item_name || '-' }}</div>
                        <div class="product-meta">ASIN: {{ row.asin }} / SKU: {{ row.sku }}</div>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="list_price" label="售价" width="90" align="right">
                  <template #default="{ row }">${{ formatNum(row.list_price) }}</template>
                </el-table-column>
              </el-table>
              <div style="margin-top:8px">
                <el-tag v-for="(p, idx) in selectedProducts" :key="idx" closable style="margin:2px" @close="selectedProducts.splice(idx, 1)">{{ p.asin }} / {{ p.sku }}</el-tag>
              </div>
              <el-empty v-if="!selectedProducts.length && !searchResults.length" description="请搜索并选择产品" style="width:620px" />
            </el-form-item>
          </el-form>
        </template>

        <!-- Step 3: 投放设置 -->
        <template v-if="step === 2">
          <div v-if="form1.targetingType === 'AUTO'" style="margin-bottom:20px">
            <h4>自动投放出价设置</h4>
            <p class="section-tip">创建后 Amazon 会自动生成 4 个定向目标，可在此预设状态与出价（出价留空则继承默认出价）。</p>
            <el-table :data="autoTargetOptions" stripe size="small" style="width:100%">
              <el-table-column prop="label" label="投放类型" width="140" />
              <el-table-column prop="name" label="说明" min-width="180" />
              <el-table-column label="状态" width="100" align="center">
                <template #default="{ row }">
                  <el-switch v-model="row.state" active-value="enabled" inactive-value="paused" inline-prompt />
                </template>
              </el-table-column>
              <el-table-column label="出价" width="160">
                <template #default="{ row }">
                  <el-input-number v-model="row.bid" :min="0.01" :step="0.01" :precision="2" size="small" controls-position="right" />
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div v-else style="margin-bottom:20px">
            <h4>手动投放 - 关键词</h4>
            <p class="section-tip">每行一个关键词，统一设置匹配类型与出价。</p>
            <el-input v-model="form3.keywordsText" type="textarea" :rows="4" placeholder="每行一个关键词" />
            <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span>匹配类型:</span>
              <el-select v-model="form3.keywordMatchType" style="width:140px">
                <el-option label="广泛匹配" value="BROAD" />
                <el-option label="短语匹配" value="PHRASE" />
                <el-option label="精准匹配" value="EXACT" />
              </el-select>
              <span>统一出价:</span>
              <el-input-number v-model="form3.keywordBid" :min="0.01" :step="0.01" :precision="2" size="small" controls-position="right" />
              <span>$</span>
            </div>
          </div>
        </template>
      </el-card>

      <div class="step-actions">
        <el-button v-if="step > 0" @click="step--">上一步</el-button>
        <el-button v-if="step < 2" type="primary" class="btn-search" @click="nextStep" :disabled="!shopId">
          下一步
        </el-button>
        <el-button v-if="step === 2" type="primary" class="btn-search" @click="submitAll" :loading="submitAllLoading" :disabled="!shopId">
          完成创建
        </el-button>
      </div>
    </div>
  </CpcLayout>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import CpcLayout from '@/components/cpc/CpcLayout.vue'
import { getCpcCreatePortfolios, getCpcCreateProducts, createCpcCampaign, syncCpcEntities } from '@/services/cpc'

const router = useRouter()

const shopId = ref(null)
const loading = ref(false)
const submitAllLoading = ref(false)
const step = ref(0)

const pageTitle = '创建广告活动'

const form1 = reactive({
  name: '',
  targetingType: 'AUTO',
  biddingStrategy: 'LEGACY_FOR_SALES',
  dailyBudget: 10,
  startDate: '',
  endDate: '',
  portfolioId: null,
  topPer: 0,
  restPer: 0,
  productPer: 0
})

const form1Rules = {
  name: [{ required: true, message: '请输入活动名称', trigger: 'blur' }],
  targetingType: [{ required: true, message: '请选择投放类型' }],
  dailyBudget: [{ required: true, message: '请输入日预算' }]
}

const form2 = reactive({
  name: '',
  defaultBid: 0.5
})

const form2Rules = {
  name: [{ required: true, message: '请输入广告组名称', trigger: 'blur' }],
  defaultBid: [{ required: true, message: '请输入默认出价' }]
}

const form3 = reactive({
  keywordsText: '',
  keywordMatchType: 'EXACT',
  keywordBid: 0.5
})

const portfolios = ref([])
const searchType = ref('ASIN')
const searchQuery = ref('')
const searchResults = ref([])
const selectedProducts = ref([])

const autoTargetOptions = ref([
  { targetId: 'QUERY_HIGH_REL_MATCHES', label: '紧密匹配', name: '与客户搜索词紧密相关的商品', state: 'enabled', bid: null },
  { targetId: 'QUERY_BROAD_REL_MATCHES', label: '宽泛匹配', name: '与客户搜索词宽泛相关的商品', state: 'enabled', bid: null },
  { targetId: 'ASIN_SUBSTITUTE_RELATED', label: '同类商品', name: '与推广商品类似的商品', state: 'enabled', bid: null },
  { targetId: 'ASIN_ACCESSORY_RELATED', label: '关联商品', name: '与推广商品互补的商品', state: 'enabled', bid: null }
])

const onShopChange = (val) => {
  shopId.value = val
}

const loadPortfolios = async () => {
  if (!shopId.value || portfolios.value.length) return
  try {
    const res = await getCpcCreatePortfolios(shopId.value)
    if (res.data.status === 'success') {
      portfolios.value = res.data.data || []
    }
  } catch { /* noop */ }
}

const searchProducts = async () => {
  if (!shopId.value || !searchQuery.value.trim()) return
  loading.value = true
  try {
    const res = await getCpcCreateProducts({
      shop_id: shopId.value,
      search_type: searchType.value,
      search: searchQuery.value.trim()
    })
    if (res.data.status === 'success') {
      searchResults.value = res.data.data || []
    }
  } catch { ElMessage.error('搜索产品失败') }
  finally { loading.value = false }
}

const handleSelectionChange = (rows) => {
  selectedProducts.value = rows
}

const validateStep = async () => {
  if (step.value === 0) {
    const valid = await form1Ref.value.validate().catch(() => false)
    return valid
  }
  if (step.value === 1) {
    const valid = await form2Ref.value.validate().catch(() => false)
    if (!valid) return false
    if (selectedProducts.value.length === 0) {
      ElMessage.warning('请至少选择一个产品')
      return false
    }
    return true
  }
  return true
}

const nextStep = async () => {
  const ok = await validateStep()
  if (!ok) return
  step.value++
}

const buildData1 = () => {
  const data = {
    name: form1.name || undefined,
    targetingType: form1.targetingType,
    biddingStrategy: form1.biddingStrategy,
    dailyBudget: Number(form1.dailyBudget),
    startDate: form1.startDate || undefined,
    endDate: form1.endDate || undefined,
    portfolioId: form1.portfolioId || undefined,
    topPer: Number(form1.topPer) || 0,
    restPer: Number(form1.restPer) || 0,
    productPer: Number(form1.productPer) || 0
  }
  // 如果没有任何溢价，则不传 placements 相关字段
  if (!data.topPer && !data.restPer && !data.productPer) {
    delete data.topPer
    delete data.restPer
    delete data.productPer
  }
  return data
}

const buildData2 = () => ({
  name: form2.name || undefined,
  defaultBid: Number(form2.defaultBid),
  products: selectedProducts.value.map(p => ({ asin: p.asin, sku: p.sku }))
})

const buildData3 = () => {
  if (form1.targetingType === 'AUTO') {
    return {
      autoTargets: autoTargetOptions.value.map(t => ({
        targetId: t.targetId,
        state: t.state,
        bid: t.bid != null ? Number(t.bid) : null
      }))
    }
  }
  const data = {}
  const kwLines = form3.keywordsText.split(/\n|\r/).map(s => s.trim()).filter(Boolean)
  if (kwLines.length) {
    data.keywords = kwLines.map(text => ({
      keywordText: text,
      matchType: form3.keywordMatchType,
      bid: Number(form3.keywordBid)
    }))
  }
  return data
}

const submitAll = async () => {
  const ok = await validateStep()
  if (!ok) return

  submitAllLoading.value = true
  try {
    const payload = {
      shop_id: shopId.value,
      data1: buildData1(),
      data2: buildData2(),
      data3: buildData3()
    }

    const res = await createCpcCampaign(payload)
    if (res.data.status === 'success') {
      const result = res.data.data || {}
      const campaignId = result.campaign_id
      ElMessage.success('广告活动创建成功')
      // 同步实体后跳转详情
      try {
        await syncCpcEntities({ shop_id: shopId.value })
      } catch { /* noop */ }
      router.push({ name: 'CpcCampaignDetail', params: { id: campaignId } })
    } else {
      ElMessage.error(res.data.message || '创建失败')
    }
  } catch { ElMessage.error('创建请求失败') }
  finally { submitAllLoading.value = false }
}

const formatNum = (val) => val != null ? Number(val).toFixed(2) : '--'

const form1Ref = ref(null)
const form2Ref = ref(null)
</script>

<style scoped>
.cpc-create-page { background: #fff; border-radius: 4px; padding: 16px; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.page-header h2 { margin: 0; font-size: 20px; }
.shop-row { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.shop-row .label { font-size: 14px; color: #606266; }
.step-actions { margin-top: 20px; display: flex; justify-content: center; gap: 12px; }
.btn-search { background: #009688; border-color: #009688; }
.section-tip { color: #909399; font-size: 13px; margin: 8px 0 16px; }
.product-info { min-width: 0; }
.product-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; font-size: 13px; }
.product-meta { color: #909399; font-size: 12px; margin-top: 2px; }
</style>
