<template>
  <div class="purchase-order-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><DocumentChecked /></el-icon>
          进货单管理
        </h1>
        <p class="page-subtitle">管理进货单记录，跟踪采购流程</p>
      </div>
      <div class="header-actions">
        <el-button type="success" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          新增进货单
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <el-input
          v-model="searchForm.keyword"
          placeholder="单号/供应商名称"
          clearable
          style="width: 180px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select
          v-model="searchForm.supplier_id"
          placeholder="供应商"
          clearable
          filterable
          style="width: 180px"
        >
          <el-option
            v-for="s in supplierOptions"
            :key="s.id"
            :label="s.name"
            :value="s.id"
          />
        </el-select>
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
          style="width: 130px"
        >
          <el-option label="全部" value="" />
          <el-option label="待下单" :value="0" />
          <el-option label="已下单" :value="1" />
          <el-option label="已完成" :value="2" />
        </el-select>
        <el-button type="primary" @click="handleSearch" :loading="loading">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
        <el-button plain @click="resetSearch">
          <el-icon><Refresh /></el-icon> 重置
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-card">
      <!-- 批量操作栏 -->
      <div v-if="selectedRows.length > 0" class="batch-bar">
        <span class="batch-tip">已选择 <strong>{{ selectedRows.length }}</strong> 项</span>
        <el-select v-model="batchStatusValue" placeholder="修改状态" style="width: 120px" size="small">
          <el-option label="待下单" :value="0" />
          <el-option label="已下单" :value="1" />
          <el-option label="已完成" :value="2" />
        </el-select>
        <el-button type="primary" size="small" :loading="batchLoading" :disabled="batchStatusValue === ''" @click="handleBatchStatus">
          批量修改状态
        </el-button>
        <el-button size="small" @click="tableRef?.clearSelection?.()">取消选择</el-button>
      </div>

      <el-table
        ref="tableRef"
        :data="orderList"
        v-loading="loading"
        style="width: 100%"
        height="calc(100vh - 260px)"
        row-class-name="purchase-row"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        :cell-style="{padding:'10px 0'}"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="order_no" label="进货单号" width="150">
          <template #default="scope">
            <span style="font-family:monospace;font-size:13px;font-weight:500;color:#1a1a2e;">{{ scope.row.order_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="supplier_name" label="供应商" width="140">
          <template #default="scope">
            <span style="font-weight:500;color:#1a1a2e;">{{ scope.row.supplier_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="product_amount" label="商品金额" width="110" align="right">
          <template #default="scope">
            <span style="color:#555;">{{ formatAmount(scope.row.product_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="shipping_amount" label="运费" width="100" align="right">
          <template #default="scope">
            <span style="color:#888;">{{ formatAmount(scope.row.shipping_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="misc_amount" label="杂项" width="100" align="right">
          <template #default="scope">
            <span style="color:#888;">{{ formatAmount(scope.row.misc_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="总金额" width="110" align="right">
          <template #default="scope">
            <span class="amount-total">{{ formatAmount(scope.row.total_amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small" effect="dark" round>
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="scope">
            <span style="color:#888;font-size:13px;">{{ scope.row.remark }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ scope.row.created_at }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="scope">
            <el-button type="primary" text size="small" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="danger" text size="small" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :page-sizes="[20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          :hide-on-single-page="false"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑进货单' : '新增进货单'"
      width="960px"
      :destroy-on-close="true"
      :close-on-click-modal="false"
      align-center
    >
      <el-form :model="formData" label-width="90px" :rules="formRules" ref="formRef">
        <!-- 基本信息 -->
        <div class="form-section">
          <h4 class="form-section-title">基本信息</h4>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="供应商" prop="supplier_id">
                <el-select
                  v-model="formData.supplier_id"
                  placeholder="选择供应商"
                  filterable
                  style="width: 100%"
                >
                  <el-option
                    v-for="s in supplierOptions"
                    :key="s.id"
                    :label="s.name"
                    :value="s.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="运费" prop="shipping_amount">
                <el-input-number
                  v-model="formData.shipping_amount"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                  @change="calcTotal"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="杂项金额" prop="misc_amount">
                <el-input-number
                  v-model="formData.misc_amount"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                  @change="calcTotal"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="状态" prop="status">
                <el-select v-model="formData.status" placeholder="选择状态" style="width: 100%">
                  <el-option label="待下单" :value="0" />
                  <el-option label="已下单" :value="1" />
                  <el-option label="已完成" :value="2" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="16">
              <el-form-item label="备注" prop="remark">
                <el-input v-model="formData.remark" placeholder="输入备注" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 金额汇总 -->
        <div class="amount-summary">
          <span class="amount-item">商品金额: <strong>{{ formatAmount(productAmount) }}</strong></span>
          <span class="amount-item">运费: <strong>{{ formatAmount(formData.shipping_amount) }}</strong></span>
          <span class="amount-item">杂项: <strong>{{ formatAmount(formData.misc_amount) }}</strong></span>
          <span class="amount-item total">总金额: <strong>{{ formatAmount(totalAmount) }}</strong></span>
        </div>

        <!-- 进货明细 -->
        <div class="form-section">
          <div class="items-header">
            <h4 class="form-section-title">进货明细</h4>
            <el-button type="primary" size="small" @click="addItem">
              <el-icon><Plus /></el-icon>
              添加商品
            </el-button>
          </div>

          <el-table :data="formData.items" border size="small" style="width: 100%">
            <el-table-column type="index" label="#" width="45" align="center" />
            <el-table-column label="卖家SKU" min-width="240">
              <template #default="scope">
                <el-select
                  v-model="scope.row.seller_sku"
                  size="small"
                  filterable
                  placeholder="选择产品"
                  style="width: 100%"
                >
                  <el-option
                    v-for="p in productOptions"
                    :key="p.seller_sku"
                    :label="`${p.seller_sku}${p.declare_name_cn ? ' - ' + p.declare_name_cn : ''}`"
                    :value="p.seller_sku"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="100" align="center">
              <template #default="scope">
                <el-input-number
                  v-model="scope.row.quantity"
                  :min="1"
                  :controls="false"
                  size="small"
                  style="width: 70px"
                  @change="calcItemTotal(scope.row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="单价" width="110" align="right">
              <template #default="scope">
                <el-input-number
                  v-model="scope.row.unit_price"
                  :min="0"
                  :precision="2"
                  :controls="false"
                  size="small"
                  style="width: 85px"
                  @change="calcItemTotal(scope.row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="小计" width="110" align="right">
              <template #default="scope">
                <span style="font-weight:600;">{{ formatAmount(scope.row.total_price) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="120">
              <template #default="scope">
                <el-input v-model="scope.row.remark" size="small" placeholder="备注" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="60" align="center">
              <template #default="scope">
                <el-button type="danger" link size="small" @click="removeItem(scope.$index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="formData.items.length === 0" description="暂无明细，请点击上方按钮添加" />
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, DocumentChecked } from '@element-plus/icons-vue'
import {
  getSuppliers,
  getProducts,
  getPurchaseOrder,
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  batchUpdatePurchaseOrderStatus
} from '@/services/api.js'

export default {
  name: 'PurchaseOrderView',
  components: {
    Search,
    Refresh,
    Plus,
    DocumentChecked
  },
  setup() {
    const loading = ref(false)
    const submitLoading = ref(false)
    const dialogVisible = ref(false)
    const isEdit = ref(false)
    const formRef = ref(null)
    const tableRef = ref(null)
    const orderList = ref([])
    const selectedRows = ref([])
    const batchStatusValue = ref('')
    const batchLoading = ref(false)
    const supplierOptions = ref([])
    const productOptions = ref([])

    const route = useRoute()

    const searchForm = reactive({
      keyword: '',
      supplier_id: null,
      status: ''
    })

    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    const createEmptyItem = () => ({
      seller_sku: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      remark: ''
    })

    const formData = reactive({
      id: null,
      supplier_id: null,
      shipping_amount: 0,
      misc_amount: 0,
      status: 0,
      remark: '',
      items: []
    })

    const formRules = {
      supplier_id: [{ required: true, message: '请选择供应商', trigger: 'change' }]
    }

    // 实时计算商品金额
    const productAmount = computed(() => {
      return formData.items.reduce((sum, item) => sum + (item.total_price || 0), 0)
    })

    // 实时计算总金额
    const totalAmount = computed(() => {
      return productAmount.value + (formData.shipping_amount || 0) + (formData.misc_amount || 0)
    })

    const calcItemTotal = (item) => {
      item.total_price = (item.quantity || 0) * (item.unit_price || 0)
    }

    const calcTotal = () => {
      // 触发 computed 重新计算
    }

    const addItem = () => {
      formData.items.push(createEmptyItem())
    }

    const removeItem = (index) => {
      formData.items.splice(index, 1)
    }

    // 获取供应商列表（用于下拉选择）
    const fetchSupplierOptions = async () => {
      try {
        const response = await getSuppliers({ status: 1, page_size: 1000 })
        if (response.data.status === 'success') {
          supplierOptions.value = response.data.data?.list || []
        }
      } catch (error) {
        console.error('获取供应商列表失败:', error)
      }
    }

    // 获取产品列表（用于下拉选择）
    const fetchProductOptions = async () => {
      try {
        const response = await getProducts({ status: 1, page_size: 1000 })
        if (response.data.status === 'success') {
          productOptions.value = response.data.data?.list || []
        }
      } catch (error) {
        console.error('获取产品列表失败:', error)
      }
    }

    const fetchList = async () => {
      loading.value = true
      try {
        const params = {
          page: pagination.page,
          page_size: pagination.page_size
        }
        if (searchForm.keyword) params.keyword = searchForm.keyword
        if (searchForm.supplier_id) params.supplier_id = searchForm.supplier_id
        if (searchForm.status !== '') params.status = searchForm.status

        const response = await getPurchaseOrders(params)
        if (response.data.status === 'success') {
          const data = response.data.data || {}
          orderList.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取进货单列表失败')
          orderList.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取进货单列表失败:', error)
        ElMessage.error('获取进货单列表失败: ' + (error.response?.data?.message || error.message))
        orderList.value = []
        pagination.total = 0
      } finally {
        loading.value = false
      }
    }

    const handleSearch = () => {
      pagination.page = 1
      fetchList()
    }

    const resetSearch = () => {
      searchForm.keyword = ''
      searchForm.supplier_id = null
      searchForm.status = ''
      pagination.page = 1
      fetchList()
    }

    const resetForm = () => {
      formData.id = null
      formData.supplier_id = null
      formData.shipping_amount = 0
      formData.misc_amount = 0
      formData.status = 0
      formData.remark = ''
      formData.items = []
    }

    const handleCreate = () => {
      isEdit.value = false
      resetForm()
      fetchProductOptions()
      dialogVisible.value = true
    }

    const handleEdit = async (row) => {
      isEdit.value = true
      resetForm()
      await fetchProductOptions()
      formData.id = row.id
      formData.supplier_id = row.supplier_id
      formData.shipping_amount = row.shipping_amount || 0
      formData.misc_amount = row.misc_amount || 0
      formData.status = row.status ?? 0
      formData.remark = row.remark || ''

      // 如果有 items，加载明细
      if (row.items && row.items.length > 0) {
        formData.items = row.items.map(item => ({
          seller_sku: item.seller_sku || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total_price: item.total_price || 0,
          remark: item.remark || ''
        }))
      } else {
        // 尝试从详情接口获取
        try {
          const response = await getPurchaseOrder(row.id)
          if (response.data.status === 'success') {
            const detail = response.data.data || {}
            formData.items = (detail.items || []).map(item => ({
              seller_sku: item.seller_sku || '',
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              total_price: item.total_price || 0,
              remark: item.remark || ''
            }))
          }
        } catch (error) {
          console.error('获取进货单详情失败:', error)
        }
      }

      dialogVisible.value = true
    }

    const handleDelete = (row) => {
      ElMessageBox.confirm(`确定删除进货单 "${row.order_no}" 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await deletePurchaseOrder(row.id)
          if (response.data.status === 'success') {
            ElMessage.success('删除成功')
            await fetchList()
          } else {
            ElMessage.error(response.data.message || '删除失败')
          }
        } catch (error) {
          console.error('删除进货单失败:', error)
          ElMessage.error('删除失败: ' + (error.response?.data?.message || error.message))
        }
      }).catch(() => {})
    }

    const handleSubmit = async () => {
      const valid = await formRef.value?.validate().catch(() => false)
      if (!valid) return

      if (formData.items.length === 0) {
        ElMessage.warning('请至少添加一条进货明细')
        return
      }

      // 校验明细必填字段
      for (let i = 0; i < formData.items.length; i++) {
        const item = formData.items[i]
        if (!item.seller_sku) {
          ElMessage.warning(`第 ${i + 1} 行请选择产品`)
          return
        }
        if (!item.quantity || item.quantity < 1) {
          ElMessage.warning(`第 ${i + 1} 行明细数量必须大于0`)
          return
        }
        if (item.unit_price == null) {
          ElMessage.warning(`第 ${i + 1} 行明细单价不能为空`)
          return
        }
      }

      submitLoading.value = true
      try {
        const payload = {
          supplier_id: formData.supplier_id,
          shipping_amount: formData.shipping_amount || 0,
          misc_amount: formData.misc_amount || 0,
          status: formData.status,
          remark: formData.remark,
          items: formData.items.map(item => ({
            seller_sku: item.seller_sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            remark: item.remark
          }))
        }

        let response
        if (isEdit.value) {
          response = await updatePurchaseOrder(formData.id, payload)
        } else {
          response = await createPurchaseOrder(payload)
        }

        if (response.data.status === 'success') {
          ElMessage.success(isEdit.value ? '编辑成功' : '新增成功')
          dialogVisible.value = false
          await fetchList()
        } else {
          ElMessage.error(response.data.message || (isEdit.value ? '编辑失败' : '新增失败'))
        }
      } catch (error) {
        console.error('提交失败:', error)
        ElMessage.error('提交失败: ' + (error.response?.data?.message || error.message))
      } finally {
        submitLoading.value = false
      }
    }

    const handlePageChange = (page) => {
      pagination.page = page
      fetchList()
    }

    const handleSizeChange = (size) => {
      pagination.page_size = size
      pagination.page = 1
      fetchList()
    }

    const handleSelectionChange = (rows) => {
      selectedRows.value = rows
    }

    const handleBatchStatus = async () => {
      if (selectedRows.value.length === 0) {
        ElMessage.warning('请先选择要操作的记录')
        return
      }
      if (batchStatusValue.value === '') {
        ElMessage.warning('请选择要修改的状态')
        return
      }
      batchLoading.value = true
      try {
        const response = await batchUpdatePurchaseOrderStatus({
          ids: selectedRows.value.map(r => r.id),
          status: batchStatusValue.value
        })
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '批量修改成功')
          selectedRows.value = []
          batchStatusValue.value = ''
          tableRef.value?.clearSelection?.()
          await fetchList()
        } else {
          ElMessage.error(response.data.message || '批量修改失败')
        }
      } catch (error) {
        console.error('批量修改状态失败:', error)
        ElMessage.error('批量修改失败: ' + (error.response?.data?.message || error.message))
      } finally {
        batchLoading.value = false
      }
    }

    const formatAmount = (val) => {
      if (val == null) return '-'
      return '¥ ' + Number(val).toFixed(2)
    }

    const getStatusType = (status) => {
      const map = { 0: 'warning', 1: 'primary', 2: 'success' }
      return map[status] || 'info'
    }

    const getStatusText = (status) => {
      const map = { 0: '待下单', 1: '已下单', 2: '已完成' }
      return map[status] || status
    }

    onMounted(() => {
      if (route.query.keyword) {
        searchForm.keyword = String(route.query.keyword)
      }
      fetchSupplierOptions()
      fetchList()
    })

    return {
      loading,
      submitLoading,
      dialogVisible,
      isEdit,
      formRef,
      tableRef,
      orderList,
      selectedRows,
      batchStatusValue,
      batchLoading,
      supplierOptions,
      productOptions,
      searchForm,
      pagination,
      formData,
      formRules,
      productAmount,
      totalAmount,
      calcItemTotal,
      calcTotal,
      addItem,
      removeItem,
      handleSearch,
      resetSearch,
      handleCreate,
      handleEdit,
      fetchProductOptions,
      handleDelete,
      handleSubmit,
      handlePageChange,
      handleSizeChange,
      handleSelectionChange,
      handleBatchStatus,
      formatAmount,
      getStatusType,
      getStatusText
    }
  }
}
</script>

<style scoped>
.purchase-order-page {
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px 24px 40px;
}

/* ===== 头部 ===== */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
}
.page-title {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 6px;
  letter-spacing: -0.5px;
}
.page-subtitle {
  font-size: 14px;
  color: #888;
  margin: 0;
}
.header-actions {
  display: flex;
  gap: 10px;
}

/* ===== 筛选栏 ===== */
.filter-bar {
  background: #fff;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* ===== 表格卡片 ===== */
.table-card {
  background: #fff;
  border-radius: 14px;
  padding: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
  overflow: hidden;
}
:deep(.el-table) { --el-table-border-color: #f0f0f0; }
:deep(.purchase-row:hover) { background-color: #fafbff !important; }

/* 批量操作栏 */
.batch-bar {
  padding: 10px 16px;
  background: #f0f5ff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.batch-tip {
  color: #555;
}
.batch-tip strong {
  color: #409eff;
  font-weight: 600;
}

.amount-total { color: #f59e0b; font-weight: 700; font-size: 14px; }

/* 分页 */
.pagination-wrap {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
}

.form-section {
  margin-bottom: 20px;
}

.form-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 12px;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.amount-summary {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.amount-item {
  font-size: 14px;
  color: #666;
}

.amount-item strong {
  color: #1a1a2e;
  font-weight: 600;
}

.amount-item.total strong {
  color: #f59e0b;
  font-size: 16px;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .purchase-order-page {
    padding: 16px 16px 40px;
  }
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-group {
    justify-content: stretch;
  }
  .amount-summary {
    gap: 12px;
  }
}
</style>
