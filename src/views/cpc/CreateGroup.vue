<template>
  <CpcLayout active-tab="campaigns" @shop-change="onShopChange">
    <div class="cpc-create-page">
      <div class="page-header">
        <div class="header-left">
          <el-button @click="$router.back()"><el-icon><ArrowLeft /></el-icon> 返回</el-button>
          <h2>添加广告组</h2>
        </div>
      </div>

      <div class="shop-row">
        <span class="label">当前店铺ID：</span>
        <span>{{ shopId || '未选择' }}</span>
      </div>
      <div class="shop-row">
        <span class="label">所属广告活动ID：</span>
        <span>{{ campaignId }}</span>
      </div>

      <el-card v-loading="loading" shadow="hover">
        <el-form :model="form" label-width="140px" ref="formRef" :rules="formRules">
          <el-form-item label="广告组名称" prop="name">
            <el-input v-model="form.name" placeholder="留空自动生成" maxlength="128" show-word-limit style="width:400px" />
          </el-form-item>
          <el-form-item label="默认出价" prop="defaultBid" required>
            <el-input-number v-model="form.defaultBid" :min="0.01" :step="0.01" :precision="2" controls-position="right" />
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
      </el-card>

      <div class="step-actions">
        <el-button @click="$router.back()">取消</el-button>
        <el-button type="primary" class="btn-search" @click="submit" :loading="submitting" :disabled="!shopId">提交</el-button>
      </div>
    </div>
  </CpcLayout>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import CpcLayout from '@/components/cpc/CpcLayout.vue'
import { getCpcCreateProducts, createCpcCampaign, syncCpcEntities } from '@/services/cpc'

const router = useRouter()
const route = useRoute()
const campaignId = route.params.id

const shopId = ref(null)
const loading = ref(false)
const submitting = ref(false)

const form = reactive({
  name: '',
  defaultBid: 0.5
})

const formRules = {
  name: [{ required: true, message: '请输入广告组名称', trigger: 'blur' }],
  defaultBid: [{ required: true, message: '请输入默认出价' }]
}

const searchType = ref('ASIN')
const searchQuery = ref('')
const searchResults = ref([])
const selectedProducts = ref([])

const onShopChange = (val) => {
  shopId.value = val
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

const submit = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (selectedProducts.value.length === 0) {
    ElMessage.warning('请至少选择一个产品')
    return
  }

  submitting.value = true
  try {
    const res = await createCpcCampaign({
      shop_id: shopId.value,
      campaign_id: campaignId,
      data2: {
        name: form.name || undefined,
        defaultBid: Number(form.defaultBid),
        products: selectedProducts.value.map(p => ({ asin: p.asin, sku: p.sku }))
      }
    })
    if (res.data.status === 'success') {
      ElMessage.success('广告组创建成功')
      try {
        await syncCpcEntities({ shop_id: shopId.value })
      } catch { /* noop */ }
      router.push({ name: 'CpcCampaignDetail', params: { id: campaignId } })
    } else {
      ElMessage.error(res.data.message || '创建失败')
    }
  } catch { ElMessage.error('创建请求失败') }
  finally { submitting.value = false }
}

const formatNum = (val) => val != null ? Number(val).toFixed(2) : '--'

const formRef = ref(null)
</script>

<style scoped>
.cpc-create-page { background: #fff; border-radius: 4px; padding: 16px; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.page-header h2 { margin: 0; font-size: 20px; }
.shop-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.shop-row .label { font-size: 14px; color: #606266; }
.step-actions { margin-top: 20px; display: flex; justify-content: center; gap: 12px; }
.btn-search { background: #009688; border-color: #009688; }
.product-info { min-width: 0; }
.product-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; font-size: 13px; }
.product-meta { color: #909399; font-size: 12px; margin-top: 2px; }
</style>
