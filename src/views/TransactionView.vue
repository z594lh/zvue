<template>
  <div class="expense-page">
    <div class="page-header">
      <h1 class="page-title">收支记账</h1>
      <div class="page-actions">
        <el-button @click="exportData" :loading="exporting">导出</el-button>
        <el-button type="danger" @click="openAddDialog('expense')" :icon="Plus">新增支出</el-button>
        <el-button type="success" @click="openAddDialog('income')" :icon="Plus">新增收入</el-button>
        <el-button type="primary" @click="openAddDialog('adjustment')" :icon="Plus">新增盘盈冲正</el-button>
      </div>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <div class="filter-row">
        <div class="date-range-pickers">
          <el-date-picker
            v-model="filterStartDate"
            type="date"
            placeholder="开始日期"
            value-format="YYYY-MM-DD"
            clearable
            class="date-start-picker"
          />
          <span class="date-separator">~</span>
          <el-date-picker
            v-model="filterEndDate"
            type="date"
            placeholder="结束日期"
            value-format="YYYY-MM-DD"
            clearable
            class="date-end-picker"
          />
        </div>
        <el-select v-model="filterTransactionType" placeholder="全部类型" clearable style="width: 120px">
          <el-option label="支出" value="expense" />
          <el-option label="收入" value="income" />
          <el-option label="盘盈冲正" value="adjustment" />
        </el-select>
        <el-select
          v-model="filterCategory"
          placeholder="全部分类"
          clearable
          style="width: 140px"
          :loading="categoriesLoading"
        >
          <el-option
            v-for="cat in filteredCategories"
            :key="cat.code"
            :label="cat.name"
            :value="cat.code"
          />
        </el-select>
        <el-select v-model="filterAccountType" placeholder="全部账目" clearable style="width: 120px">
          <el-option label="公账" value="company" />
          <el-option label="私账" value="personal" />
        </el-select>
        <el-select v-model="filterReimbursed" placeholder="报销状态" clearable style="width: 120px">
          <el-option label="已报销" value="true" />
          <el-option label="未报销" value="false" />
        </el-select>
        <el-select v-model="filterCreatedBy" placeholder="全部创建人" clearable style="width: 140px">
          <el-option
            v-for="user in usersList"
            :key="user.id"
            :label="user.nickname || user.username"
            :value="user.id"
          />
        </el-select>
        <el-input v-model="filterSourceNo" placeholder="搜索单号" clearable style="width: 180px" @keyup.enter="fetchRecords" />
        <el-button type="primary" @click="fetchRecords"><el-icon><Search /></el-icon> 查询</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card clickable" @click="applyFilter({})">
        <div class="stat-label">净收支</div>
        <div class="stat-value" :style="{ color: summary.net_amount >= 0 ? '#27ae60' : '#e74c3c' }">¥{{ formatNumber(summary.net_amount) }}</div>
        <div class="stat-sub">共 {{ summary.total_count || 0 }} 条记录</div>
      </div>
      <div class="stat-card clickable stat-card-income" @click="applyFilter({ transaction_type: 'income' })">
        <div class="income-card-header">
          <div>
            <div class="stat-label">收入总计</div>
            <div class="stat-value" style="color: #27ae60;">¥{{ formatNumber(typeStats.income?.amount || 0) }}</div>
            <div class="stat-sub">共 {{ typeStats.income?.count || 0 }} 条</div>
          </div>
        </div>
        <div v-if="incomeCategoryItems.length > 0" class="income-category-treemap">
          <div
            v-for="item in incomeCategoryItems"
            :key="item.category"
            class="income-treemap-item"
            :style="{ flex: item.flex, background: item.color }"
            :title="`${item.name}: ¥${formatNumber(item.value)} (${item.percent}%)`"
          >
            <div class="income-treemap-name">{{ item.name }}</div>
            <div class="income-treemap-value">¥{{ formatNumber(item.value) }}</div>
            <div class="income-treemap-percent">{{ item.percent }}%</div>
          </div>
        </div>
      </div>
      <div class="stat-card clickable" @click="applyFilter({ transaction_type: 'expense' })">
        <div class="stat-label">支出总计</div>
        <div class="stat-value" style="color: #e74c3c;">¥{{ formatNumber(typeStats.expense?.amount || 0) }}</div>
        <div class="stat-sub">共 {{ typeStats.expense?.count || 0 }} 条</div>
      </div>
      <div class="stat-card clickable" @click="applyFilter({ transaction_type: 'expense', account_type: 'personal', reimbursed: 'false' })">
        <div class="stat-label">私账未报销</div>
        <div class="stat-value" style="color: #f39c12;">¥{{ formatNumber(unreimbursedSummary.total_amount) }}</div>
        <div class="stat-sub">共 {{ unreimbursedSummary.total_count || 0 }} 条</div>
      </div>
    </div>

    <!-- 数据表格 -->
    <el-table
      :data="filteredRecords"
      stripe
      style="width: 100%"
      empty-text="暂无记录"
      v-loading="loading"
    >
      <el-table-column prop="date" label="日期" width="105" sortable />
      <el-table-column label="类型" width="90" align="center">
        <template #default="scope">
          <el-tag :type="getTransactionTypeTag(scope.row.transaction_type)" size="small" effect="dark">
            {{ getTransactionTypeLabel(scope.row.transaction_type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="账目" width="80" align="center">
        <template #default="scope">
          <el-tag :type="scope.row.account_type === 'company' ? 'danger' : 'primary'" size="small" effect="dark">
            {{ scope.row.account_type === 'company' ? '公账' : '私账' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="分类" width="110">
        <template #default="scope">
          <el-tag :color="getCategoryColor(scope.row.category)" effect="dark" size="small">
            {{ getCategoryName(scope.row.category) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="85" align="center">
        <template #default="scope">
          <el-tag v-if="scope.row.source_type === 'purchase_order'" type="warning" size="small" effect="light">采购单</el-tag>
          <el-tag v-else-if="scope.row.source_type === 'logistics_waybill'" type="success" size="small" effect="light">物流运单</el-tag>
          <span v-else style="color: #bbb; font-size: 12px;">—</span>
        </template>
      </el-table-column>
      <el-table-column label="单号" width="130">
        <template #default="scope">
          <el-button
            v-if="scope.row.source_type === 'purchase_order'"
            link
            type="primary"
            size="small"
            @click="router.push({ path: '/purchase-orders', query: { keyword: scope.row.source_no } })"
          >{{ scope.row.source_no }}</el-button>
          <el-button
            v-else-if="scope.row.source_type === 'logistics_waybill'"
            link
            type="primary"
            size="small"
            @click="router.push({ path: '/logistics-waybills', query: { waybill_no: scope.row.source_no } })"
          >{{ scope.row.source_no }}</el-button>
          <span v-else style="color: #bbb; font-size: 12px;">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="amount" label="金额" width="115" sortable>
        <template #default="scope">
          <span :style="{ color: getAmountColor(scope.row), fontWeight: 600 }">¥{{ formatNumber(scope.row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column prop="created_by_name" label="创建人" width="80" align="center" />
      <el-table-column label="报销" width="75" align="center">
        <template #default="scope">
          <template v-if="scope.row.transaction_type === 'expense' && scope.row.account_type === 'personal'">
            <el-button
              v-if="scope.row.reimbursed"
              type="success"
              size="small"
              plain
              @click="toggleReimburse(scope.row)"
            >已报</el-button>
            <el-button
              v-else
              type="warning"
              size="small"
              plain
              @click="toggleReimburse(scope.row)"
            >未报</el-button>
          </template>
          <span v-else style="color: #ccc;">—</span>
        </template>
      </el-table-column>
      <el-table-column label="发票" width="75" align="center">
        <template #default="scope">
          <div v-if="scope.row.invoice_url" class="invoice-thumb" @click="previewInvoice(scope.row.invoice_url)">
            <img :src="scope.row.invoice_url" />
          </div>
          <el-tag v-else type="info" size="small">无</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="scope">
          <el-button link type="primary" size="small" @click="editRecord(scope.row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="deleteRecord(scope.row)">删除</el-button>
          <el-button link type="info" size="small" @click="openLogsDialog(scope.row)">日志</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper" v-if="totalRecords > 0">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        :total="totalRecords"
        @current-change="fetchRecords"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="520px"
      destroy-on-close
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item v-if="isEdit" label="记录类型">
          <el-tag :type="getTransactionTypeTag(form.transaction_type)" effect="dark" size="small">
            {{ getTransactionTypeLabel(form.transaction_type) }}
          </el-tag>
        </el-form-item>
        <el-form-item v-if="form.transaction_type === 'expense'" label="账目类型" prop="account_type">
          <el-radio-group v-model="form.account_type">
            <el-radio-button label="company">公账</el-radio-button>
            <el-radio-button label="personal">私账</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-else label="账目类型">
          <div style="color: #606266; font-size: 14px;">公账（收入和盘盈冲正默认计入公司账目）</div>
        </el-form-item>
        <el-form-item label="日期" prop="date">
          <el-date-picker
            v-model="form.date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-select
            v-model="form.category"
            placeholder="选择分类"
            style="width: 100%"
            :loading="categoriesLoading"
          >
            <el-option
              v-for="cat in formCategories"
              :key="cat.code"
              :label="cat.name"
              :value="cat.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number
            v-model="form.amount"
            :precision="2"
            :min="form.transaction_type === 'adjustment' ? undefined : 0"
            :step="10"
            style="width: 100%"
            controls-position="right"
            :placeholder="form.transaction_type === 'adjustment' ? '盘盈填正数，冲正填负数' : ''"
          />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            placeholder="请输入备注信息"
          />
        </el-form-item>
        <el-form-item v-if="form.source_type" label="数据来源">
          <div style="color: #e6a23c; font-size: 13px;">
            <span v-if="form.source_type === 'purchase_order'">采购单 {{ form.source_no }}（系统导入）</span>
            <span v-else-if="form.source_type === 'logistics_waybill'">物流运单 {{ form.source_no }}（系统导入）</span>
            <span v-else>{{ form.source_type }} {{ form.source_no }}（系统导入）</span>
          </div>
        </el-form-item>
        <el-form-item v-if="showReimbursed" label="报销状态">
          <el-checkbox v-model="form.reimbursed">已报销</el-checkbox>
        </el-form-item>
        <el-form-item label="发票/凭证">
          <el-checkbox v-model="form.has_invoice">已取得发票或凭证</el-checkbox>
        </el-form-item>
        <el-form-item v-if="form.has_invoice" label="上传图片">
          <input type="file" ref="invoiceInput" hidden @change="handleInvoiceUpload" accept="image/*" />
          <div class="invoice-upload-area" @click="triggerInvoiceUpload">
            <div v-if="!invoicePreviewUrl" class="invoice-placeholder">
              <div class="upload-icon">📎</div>
              <div class="upload-text">点击上传发票/凭证图片</div>
              <div class="upload-hint">支持 JPG、PNG 格式</div>
            </div>
            <div v-else class="invoice-preview-box">
              <img :src="invoicePreviewUrl" class="invoice-preview-img" @click.stop="previewInvoice(invoicePreviewUrl)" />
              <div class="invoice-actions">
                <span class="invoice-action-icon" @click.stop="previewInvoice(invoicePreviewUrl)" title="查看">🔍</span>
                <span class="invoice-action-icon remove" @click.stop="removeInvoice" title="移除">×</span>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <div v-if="isEdit && (form.created_by_name || form.updated_by_name)" class="edit-meta">
        <span v-if="form.created_by_name">创建人：{{ form.created_by_name }}</span>
        <span v-if="form.updated_by_name">修改人：{{ form.updated_by_name }}</span>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 操作日志弹窗 -->
    <el-dialog v-model="logsDialogVisible" title="操作日志" width="600px" destroy-on-close>
      <el-timeline v-if="expenseLogs.length > 0" v-loading="logsLoading">
        <el-timeline-item
          v-for="log in expenseLogs"
          :key="log.id"
          :type="logTypeColor(log.action)"
          :timestamp="log.created_at"
        >
          <div class="log-header">
            <el-tag :type="logTypeColor(log.action)" size="small">{{ logActionLabel(log.action) }}</el-tag>
            <span class="log-operator">{{ log.operator_name }}</span>
          </div>
          <div v-if="log.old_data" class="log-data">
            <div class="log-data-label">修改前：</div>
            <pre>{{ formatLogData(log.old_data) }}</pre>
          </div>
          <div v-if="log.new_data" class="log-data">
            <div class="log-data-label">{{ log.action === 'CREATE' ? '创建内容：' : '修改后：' }}</div>
            <pre>{{ formatLogData(log.new_data) }}</pre>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无操作日志" />
    </el-dialog>

    <!-- 发票大图预览 -->
    <div v-if="showInvoiceOverlay" class="image-overlay" @click="showInvoiceOverlay = false">
      <div class="overlay-content" @click.stop>
        <img :src="overlayInvoiceUrl" class="full-img" />
        <div class="overlay-actions">
          <a :href="overlayInvoiceUrl" target="_blank" class="overlay-btn">查看原图</a>
          <button class="overlay-btn close" @click="showInvoiceOverlay = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getTransactionList, getTransactionSummary, createTransaction, updateTransaction, deleteTransaction, toggleReimburseStatus, getTransactionLogs, getUserOptions, getTransactionCategories } from '@/services/api.js'
import { useListQuerySync } from '@/composables/useListQuerySync.js'

const transactionTypeMeta = {
  expense: { label: '支出', tagType: 'danger', amountColor: '#e74c3c' },
  income: { label: '收入', tagType: 'success', amountColor: '#27ae60' },
  adjustment: { label: '盘盈冲正', tagType: 'primary', amountColor: '#3498db' }
}

const getTransactionTypeLabel = (type) => transactionTypeMeta[type]?.label || type
const getTransactionTypeTag = (type) => transactionTypeMeta[type]?.tagType || 'info'
const getAmountColor = (row) => transactionTypeMeta[row.transaction_type]?.amountColor || '#333'

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0.00'
  return Number(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default {
  name: 'TransactionView',
  setup() {
    const router = useRouter()
    const loading = ref(false)
    const submitting = ref(false)
    const exporting = ref(false)
    const records = ref([])
    const total = ref(0)
    const dialogVisible = ref(false)
    const isEdit = ref(false)
    const formRef = ref(null)
    const invoiceInput = ref(null)
    const currentPage = ref(1)
    const pageSize = ref(20)
    const filterStartDate = ref('')
    const filterEndDate = ref('')
    const filterTransactionType = ref('')
    const filterCategory = ref('')
    const filterAccountType = ref('')
    const filterReimbursed = ref('')
    const filterCreatedBy = ref('')
    const filterSourceNo = ref('')
    const usersList = ref([])
    const categories = ref([])
    const categoriesLoading = ref(false)
    const invoicePreviewUrl = ref('')
    const invoiceBase64 = ref('')

    // 发票大图预览
    const showInvoiceOverlay = ref(false)
    const overlayInvoiceUrl = ref('')

    // 操作日志
    const logsDialogVisible = ref(false)
    const expenseLogs = ref([])
    const currentLogExpenseId = ref(null)
    const logsLoading = ref(false)

    const summary = ref({ total_count: 0, net_amount: 0, by_type: [] })
    const unreimbursedSummary = ref({ total_amount: 0, total_count: 0 })

    const form = reactive({
      id: null,
      transaction_type: 'expense',
      date: '',
      category: '',
      amount: 0,
      remark: '',
      account_type: 'company',
      reimbursed: false,
      has_invoice: false,
      invoice_url: '',
      created_by_name: '',
      updated_by_name: ''
    })

    const rules = {
      date: [{ required: true, message: '请选择日期', trigger: 'change' }],
      category: [{ required: true, message: '请选择分类', trigger: 'change' }],
      amount: [
        { required: true, message: '请输入金额', trigger: 'blur' },
        {
          validator: (rule, value, callback) => {
            if (form.transaction_type === 'adjustment') {
              if (value === 0) {
                callback(new Error('盘盈冲正金额不能为 0'))
              } else {
                callback()
              }
            } else if (value <= 0) {
              callback(new Error('支出/收入金额必须大于 0'))
            } else {
              callback()
            }
          },
          trigger: 'blur'
        }
      ],
      account_type: [{ required: true, message: '请选择账目类型', trigger: 'change' }]
    }

    const accountTypeLabel = computed(() => {
      return filterAccountType.value === 'company' ? '公账' : '私账'
    })

    const dialogTitle = computed(() => {
      const action = isEdit.value ? '编辑' : '新增'
      return `${action}${getTransactionTypeLabel(form.transaction_type)}记录`
    })

    const showReimbursed = computed(() => {
      return form.transaction_type === 'expense' && form.account_type === 'personal'
    })

    const filteredCategories = computed(() => {
      if (!filterTransactionType.value) return categories.value.filter(c => c.is_active !== false)
      return categories.value.filter(c =>
        c.is_active !== false && (c.type === filterTransactionType.value || c.type === 'all')
      )
    })

    const formCategories = computed(() => {
      return categories.value.filter(c =>
        c.is_active !== false && (c.type === form.transaction_type || c.type === 'all')
      )
    })

    // 统一错误处理
    const handleApiError = (err) => {
      const message = err.response?.data?.message || ''
      const status = err.response?.data?.status
      if (status === 'error' && message.includes('登录')) {
        ElMessage.error({ message: '请先登录', offset: window.innerHeight / 2 - 50 })
        router.push('/login')
        return true
      }
      const errorMsg = message || err.message || '请求失败'
      ElMessage.error({ message: errorMsg, offset: window.innerHeight / 2 - 50 })
      return false
    }

    // 分页/筛选状态与 URL query 双向同步
    const { initFromQuery, syncQuery, watchQuery } = useListQuerySync({
      page: { get: () => currentPage.value, set: v => currentPage.value = v, type: 'number', default: 1 },
      page_size: { get: () => pageSize.value, set: v => pageSize.value = v, type: 'number', default: 20 },
      start_date: { get: () => filterStartDate.value, set: v => filterStartDate.value = v },
      end_date: { get: () => filterEndDate.value, set: v => filterEndDate.value = v },
      transaction_type: { get: () => filterTransactionType.value, set: v => filterTransactionType.value = v },
      category: { get: () => filterCategory.value, set: v => filterCategory.value = v },
      account_type: { get: () => filterAccountType.value, set: v => filterAccountType.value = v },
      reimbursed: { get: () => filterReimbursed.value, set: v => filterReimbursed.value = v },
      created_by: { get: () => filterCreatedBy.value, set: v => filterCreatedBy.value = v, type: 'number' },
      source_no: { get: () => filterSourceNo.value, set: v => filterSourceNo.value = v }
    })

    // 统一后端数据字段名（兼容 camelCase / snake_case）
    const normalizeRecord = (row) => {
      // 后端返回的 date 可能是 HTTP 格式（如 "Tue, 21 Apr 2026 00:00:00 GMT"），统一转为 YYYY-MM-DD
      let formattedDate = row.date
      if (row.date && typeof row.date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        const d = new Date(row.date)
        if (!isNaN(d.getTime())) {
          formattedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
      }
      return {
        id: row.id,
        date: formattedDate,
        transaction_type: row.transaction_type || row.transactionType || 'expense',
        category: row.category,
        amount: Number(row.amount || 0),
        remark: row.remark || '',
        account_type: row.account_type || row.accountType || 'company',
        reimbursed: !!(row.reimbursed ?? false),
        has_invoice: !!(row.has_invoice ?? row.hasInvoice ?? false),
        invoice_url: row.invoice_url || row.invoiceUrl || row.invoice_image || row.invoiceImage || '',
        created_by_name: row.created_by_name || '',
        updated_by_name: row.updated_by_name || '',
        source_type: row.source_type || '',
        source_no: row.source_no || ''
      }
    }

    const getCategoryName = (code) => {
      const cat = categories.value.find(c => c.code === code)
      return cat ? cat.name : code
    }

    const getCategoryColor = (code) => {
      const cat = categories.value.find(c => c.code === code)
      return cat ? cat.color : '#bdc3c7'
    }

    // 从后端获取支出列表
    const fetchRecords = async () => {
      syncQuery()
      loading.value = true
      try {
        const params = {
          page: currentPage.value,
          page_size: pageSize.value
        }
        if (filterStartDate.value) params.start_date = filterStartDate.value
        if (filterEndDate.value) params.end_date = filterEndDate.value
        if (filterTransactionType.value) params.transaction_type = filterTransactionType.value
        if (filterCategory.value) params.category = filterCategory.value
        if (filterAccountType.value) params.account_type = filterAccountType.value
        if (filterReimbursed.value) params.reimbursed = filterReimbursed.value
        if (filterCreatedBy.value) params.created_by = filterCreatedBy.value
        if (filterSourceNo.value) params.source_no = filterSourceNo.value

        const res = await getTransactionList(params)
        if (res.data.status === 'success') {
          const list = res.data.data.list || []
          records.value = list.map(normalizeRecord)
          total.value = res.data.data.total || 0
          console.log('[ExpenseView] fetchRecords:', list)
        } else {
          records.value = []
          total.value = 0
        }
      } catch (err) {
        handleApiError(err)
        records.value = []
      } finally {
        loading.value = false
      }
    }

    // 导出当前筛选条件下的全部数据
    const exportData = async () => {
      exporting.value = true
      try {
        const params = {}
        if (filterStartDate.value) params.start_date = filterStartDate.value
        if (filterEndDate.value) params.end_date = filterEndDate.value
        if (filterTransactionType.value) params.transaction_type = filterTransactionType.value
        if (filterCategory.value) params.category = filterCategory.value
        if (filterAccountType.value) params.account_type = filterAccountType.value
        if (filterReimbursed.value) params.reimbursed = filterReimbursed.value
        if (filterCreatedBy.value) params.created_by = filterCreatedBy.value
        if (filterSourceNo.value) params.source_no = filterSourceNo.value

        const res = await getTransactionList(params)
        if (res.data.status !== 'success') {
          ElMessage.warning('导出失败')
          return
        }
        const list = (res.data.data.list || []).map(normalizeRecord)
        if (list.length === 0) {
          ElMessage.warning('没有数据可导出')
          return
        }

        const headers = ['日期', '类型', '账目类型', '分类', '来源类型', '来源单号', '金额', '备注', '报销状态', '发票', '发票链接', '创建人']
        const rows = list.map(r => [
          r.date,
          getTransactionTypeLabel(r.transaction_type),
          r.account_type === 'company' ? '公账' : '私账',
          getCategoryName(r.category),
          r.source_type === 'purchase_order' ? '采购单' : (r.source_type === 'logistics_waybill' ? '物流运单' : ''),
          r.source_no || '',
          r.amount,
          r.remark || '',
          r.account_type === 'personal' && r.transaction_type === 'expense' ? (r.reimbursed ? '已报销' : '未报销') : '—',
          r.has_invoice ? '有' : '无',
          r.invoice_url || '',
          r.created_by_name || ''
        ])

        // 转 CSV，加 BOM 让 Excel 正确识别中文
        const csvContent = '\uFEFF' + [headers, ...rows].map(row =>
          row.map(cell => {
            const str = String(cell ?? '').replace(/"/g, '""')
            return str.includes(',') || str.includes('\n') ? `"${str}"` : str
          }).join(',')
        ).join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        const dateStr = new Date().toISOString().slice(0, 10)
        link.download = `收支记录_${dateStr}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)
        ElMessage.success('导出成功')
      } catch (err) {
        handleApiError(err)
      } finally {
        exporting.value = false
      }
    }

    // 获取总记录数（用于分页）
    const totalRecords = computed(() => {
      return total.value
    })

    // 筛选后的记录（后端分页）
    const filteredRecords = computed(() => {
      return records.value
    })

    // 交易类型统计（从 summary API 提取）
    const typeStats = computed(() => {
      const result = { expense: null, income: null, adjustment: null }
      summary.value.by_type?.forEach(item => {
        if (result[item.transaction_type] !== undefined) {
          result[item.transaction_type] = item
        }
      })
      return result
    })

    // 收入分类汇总（用于收入总计卡片内部分类展示）
    const incomeCategoryItems = computed(() => {
      const items = (summary.value.by_category || [])
        .filter(item => item.transaction_type === 'income' && item.amount > 0)
        .map(item => {
          const cat = categories.value.find(c => c.code === item.category)
          return {
            category: item.category,
            name: cat?.name || item.category,
            value: Number(item.amount || 0),
            color: cat?.color || '#27ae60'
          }
        })
        .sort((a, b) => b.value - a.value)
      const total = Math.max(typeStats.value.income?.amount || 0, 0.01)
      return items.map(i => ({
        ...i,
        flex: Math.max(i.value / total, 0.05),
        percent: ((i.value / total) * 100).toFixed(1)
      }))
    })

    // 构建汇总接口专用参数：只取日期范围
    const buildSummaryParams = (extra = {}) => {
      const params = {}
      if (filterStartDate.value) params.start_date = filterStartDate.value
      if (filterEndDate.value) params.end_date = filterEndDate.value
      return { ...params, ...extra }
    }

    // 获取统计汇总（只受日期范围影响）
    const fetchSummary = async () => {
      try {
        const [summaryRes, unreimbursedRes] = await Promise.all([
          getTransactionSummary(buildSummaryParams()),
          getTransactionSummary(buildSummaryParams({ transaction_type: 'expense', account_type: 'personal', reimbursed: 'false' }))
        ])

        if (summaryRes.data.status === 'success') {
          summary.value = summaryRes.data.data
        }
        if (unreimbursedRes.data.status === 'success') {
          unreimbursedSummary.value = unreimbursedRes.data.data
        }
      } catch (err) {
        handleApiError(err)
      }
    }

    // 从统计卡片点击跳转筛选
    const applyFilter = (filters) => {
      filterTransactionType.value = filters.transaction_type || ''
      filterCategory.value = filters.category || ''
      filterAccountType.value = filters.account_type || ''
      filterReimbursed.value = filters.reimbursed !== undefined ? filters.reimbursed : ''
    }

    // 获取用户列表（创建人筛选用）
    const fetchUsers = async () => {
      try {
        const res = await getUserOptions()
        if (res.data.status === 'success') {
          usersList.value = res.data.data || []
        }
      } catch (err) {
        handleApiError(err)
      }
    }

    // 重置筛选
    const resetFilter = () => {
      filterStartDate.value = ''
      filterEndDate.value = ''
      filterTransactionType.value = ''
      filterCategory.value = ''
      filterAccountType.value = ''
      filterReimbursed.value = ''
      filterCreatedBy.value = ''
      filterSourceNo.value = ''
      currentPage.value = 1
      fetchRecords()
    }

    // 获取分类配置
    const fetchCategories = async () => {
      categoriesLoading.value = true
      try {
        const res = await getTransactionCategories()
        if (res.data.status === 'success') {
          categories.value = res.data.data || []
        }
      } catch (err) {
        handleApiError(err)
      } finally {
        categoriesLoading.value = false
      }
    }

    // 每页条数变化
    const handleSizeChange = (size) => {
      pageSize.value = size
      currentPage.value = 1
      fetchRecords()
    }

    // 打开新增弹窗
    const openAddDialog = (type = 'expense') => {
      isEdit.value = false
      form.id = null
      form.transaction_type = type
      form.date = new Date().toISOString().split('T')[0]
      form.category = ''
      form.amount = 0
      form.remark = ''
      // 收入和盘盈冲正默认公账且不可选
      form.account_type = type === 'expense' ? 'company' : 'company'
      form.reimbursed = false
      form.has_invoice = false
      form.invoice_url = ''
      invoicePreviewUrl.value = ''
      invoiceBase64.value = ''
      dialogVisible.value = true
    }

    // 编辑记录
    const editRecord = (row) => {
      isEdit.value = true
      Object.assign(form, { ...row })
      // 非支出记录强制公账（兼容旧数据）
      if (form.transaction_type !== 'expense') {
        form.account_type = 'company'
      }
      invoicePreviewUrl.value = row.invoice_url || ''
      invoiceBase64.value = ''
      dialogVisible.value = true
    }

    // 删除记录
    const deleteRecord = async (row) => {
      try {
        const typeLabel = getTransactionTypeLabel(row.transaction_type)
        const categoryName = getCategoryName(row.category)
        let msg = `确定删除 ${row.date} 的 ${categoryName} ${typeLabel} ¥${row.amount} 吗？`
        if (row.source_type === 'purchase_order') {
          msg += `\n\n⚠️ 该记录由采购单 ${row.source_no} 自动导入，删除后将失去关联。`
        } else if (row.source_type === 'logistics_waybill') {
          msg += `\n\n⚠️ 该记录由物流运单 ${row.source_no} 自动导入，删除后将失去关联。`
        }
        await ElMessageBox.confirm(
          msg,
          '确认删除',
          { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
        )
        await deleteTransaction(row.id)
        ElMessage.success('删除成功')
        fetchRecords()
        fetchSummary()
      } catch (err) {
        if (err !== 'cancel') handleApiError(err)
      }
    }

    // 切换报销状态
    const toggleReimburse = async (row) => {
      if (row.transaction_type !== 'expense') {
        ElMessage.warning('只有支出记录需要报销')
        return
      }
      try {
        await toggleReimburseStatus(row.id)
        const newStatus = !row.reimbursed
        row.reimbursed = newStatus
        fetchSummary()
        ElMessage.success(newStatus ? '已标记为已报销' : '已标记为未报销')
      } catch (err) {
        handleApiError(err)
      }
    }

    // 触发发票图片上传
    const triggerInvoiceUpload = () => {
      invoiceInput.value?.click()
    }

    // 处理发票图片上传
    const handleInvoiceUpload = (e) => {
      const file = e.target.files[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        ElMessage.warning('请上传图片文件')
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        ElMessage.warning('图片大小不能超过 10MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new Image()
        img.src = ev.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxWidth = 1024
          let width = img.width, height = img.height
          if (width > maxWidth) {
            height = (maxWidth / width) * height
            width = maxWidth
          }
          canvas.width = width
          canvas.height = height
          canvas.getContext('2d').drawImage(img, 0, 0, width, height)

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8)
          invoicePreviewUrl.value = compressedBase64
          invoiceBase64.value = compressedBase64.split(',')[1]
        }
      }
      reader.readAsDataURL(file)

      if (invoiceInput.value) {
        invoiceInput.value.value = ''
      }
    }

    // 移除发票图片
    const removeInvoice = () => {
      invoicePreviewUrl.value = ''
      invoiceBase64.value = ''
      form.invoice_url = ''
    }

    // 预览发票图片
    const previewInvoice = (url) => {
      overlayInvoiceUrl.value = url
      showInvoiceOverlay.value = true
    }

    // 打开操作日志弹窗
    const openLogsDialog = async (row) => {
      currentLogExpenseId.value = row.id
      logsDialogVisible.value = true
      expenseLogs.value = []
      await fetchExpenseLogs(row.id)
    }

    // 获取操作日志
    const fetchExpenseLogs = async (id) => {
      logsLoading.value = true
      try {
        const res = await getTransactionLogs(id)
        if (res.data.status === 'success') {
          expenseLogs.value = res.data.data || []
        } else {
          expenseLogs.value = []
        }
      } catch (err) {
        handleApiError(err)
        expenseLogs.value = []
      } finally {
        logsLoading.value = false
      }
    }

    // 日志类型颜色
    const logTypeColor = (action) => {
      const map = { CREATE: 'success', UPDATE: 'warning', DELETE: 'danger' }
      return map[action] || 'info'
    }

    // 日志类型中文
    const logActionLabel = (action) => {
      const map = { CREATE: '创建', UPDATE: '修改', DELETE: '删除' }
      return map[action] || action
    }

    // 日志字段中文映射
    const logFieldLabels = {
      id: 'ID',
      user_id: '用户ID',
      date: '日期',
      transaction_type: '记录类型',
      category: '分类',
      amount: '金额',
      remark: '备注',
      has_invoice: '发票/凭证',
      invoice_image: '发票图片',
      invoice_url: '发票图片',
      account_type: '账目类型',
      reimbursed: '报销状态',
      created_at: '创建时间',
      updated_at: '更新时间',
      created_by: '创建人',
      updated_by: '修改人',
      created_by_name: '创建人',
      updated_by_name: '修改人',
      source_type: '来源类型',
      source_no: '来源单号'
    }

    // 日志字段值友好展示
    const formatLogFieldValue = (key, value) => {
      if (value === null || value === undefined) return '—'
      if (key === 'has_invoice') return value ? '有' : '无'
      if (key === 'reimbursed') return value ? '已报销' : '未报销'
      if (key === 'transaction_type') return getTransactionTypeLabel(value)
      if (key === 'account_type') {
        const map = { company: '公账', personal: '私账' }
        return map[value] || value
      }
      if (key === 'amount') return `¥${Number(value).toFixed(2)}`
      return String(value)
    }

    // 格式化日志 JSON 数据
    const formatLogData = (data) => {
      if (!data) return ''
      try {
        const obj = typeof data === 'string' ? JSON.parse(data) : data
        if (typeof obj !== 'object' || obj === null) return String(obj)
        const lines = Object.entries(obj).map(([key, value]) => {
          const label = logFieldLabels[key] || key
          const displayValue = formatLogFieldValue(key, value)
          return `${label}：${displayValue}`
        })
        return lines.join('\n')
      } catch {
        return String(data)
      }
    }

    // 提交表单
    const submitForm = () => {
      formRef.value.validate(async (valid) => {
        if (!valid) return

        submitting.value = true
        try {
          const payload = {
            transaction_type: form.transaction_type,
            date: form.date,
            category: form.category,
            amount: form.amount,
            remark: form.remark,
            account_type: form.transaction_type === 'expense' ? form.account_type : 'company',
            reimbursed: showReimbursed.value ? form.reimbursed : false,
            has_invoice: form.has_invoice
          }

          if (form.has_invoice && invoiceBase64.value) {
            payload.invoice_image = invoiceBase64.value
          }

          if (isEdit.value) {
            await updateTransaction(form.id, payload)
            ElMessage.success('修改成功')
          } else {
            await createTransaction(payload)
            ElMessage.success('添加成功')
          }

          dialogVisible.value = false
          fetchRecords()
          fetchSummary()
        } catch (err) {
          handleApiError(err)
        } finally {
          submitting.value = false
        }
      })
    }

    // 日期范围变化时刷新列表和汇总
    watch([filterStartDate, filterEndDate], () => {
      currentPage.value = 1
      fetchRecords()
      fetchSummary()
    })

    // 其他筛选条件只刷新列表
    watch([filterTransactionType, filterCategory, filterAccountType, filterReimbursed, filterCreatedBy, filterSourceNo], () => {
      currentPage.value = 1
      fetchRecords()
    })

    // 切换类型时清空不匹配的分类筛选
    watch(filterTransactionType, () => {
      if (filterCategory.value) {
        const cat = categories.value.find(c => c.code === filterCategory.value)
        if (cat && cat.type !== filterTransactionType.value && cat.type !== 'all') {
          filterCategory.value = ''
        }
      }
    })

    // 弹窗内切换类型时清空分类
    watch(() => form.transaction_type, () => {
      if (form.category) {
        const cat = categories.value.find(c => c.code === form.category)
        if (cat && cat.type !== form.transaction_type && cat.type !== 'all') {
          form.category = ''
        }
      }
    })

    watchQuery(() => fetchRecords())

    onMounted(() => {
      initFromQuery()
      fetchCategories().then(() => {
        fetchRecords()
        fetchSummary()
      })
      fetchUsers()
    })

    return {
      loading,
      submitting,
      exporting,
      records,
      dialogVisible,
      isEdit,
      formRef,
      invoiceInput,
      form,
      rules,
      categories,
      categoriesLoading,
      filteredCategories,
      formCategories,
      filterStartDate,
      filterEndDate,
      filterTransactionType,
      filterCategory,
      filterAccountType,
      filterReimbursed,
      filterCreatedBy,
      filterSourceNo,
      usersList,
      currentPage,
      pageSize,
      total,
      totalRecords,
      filteredRecords,
      summary,
      unreimbursedSummary,
      typeStats,
      incomeCategoryItems,
      accountTypeLabel,
      dialogTitle,
      showReimbursed,
      invoicePreviewUrl,
      showInvoiceOverlay,
      overlayInvoiceUrl,
      logsDialogVisible,
      expenseLogs,
      logsLoading,
      getCategoryName,
      getCategoryColor,
      getTransactionTypeLabel,
      getTransactionTypeTag,
      getAmountColor,
      formatNumber,
      applyFilter,
      resetFilter,
      handleSizeChange,
      openAddDialog,
      editRecord,
      deleteRecord,
      toggleReimburse,
      triggerInvoiceUpload,
      handleInvoiceUpload,
      removeInvoice,
      previewInvoice,
      openLogsDialog,
      logTypeColor,
      logActionLabel,
      formatLogData,
      submitForm,
      fetchRecords,
      fetchUsers,
      fetchCategories,
      exportData,
      Plus,
      Search,
      router
    }
  }
}
</script>

<style scoped>
.expense-page {
  max-width: 1320px;
  margin: 0 auto;
  padding: 24px;
  overflow-x: hidden;
  min-width: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-actions {
  display: flex;
  gap: 10px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

/* 统计卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.stat-card.clickable {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.stat-label {
  font-size: 14px;
  color: #999;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
}

.stat-sub {
  font-size: 13px;
  color: #bbb;
  margin-top: 6px;
}

/* 收入总计卡片 */
.stat-card-income {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.income-category-treemap {
  display: flex;
  width: 100%;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 14px;
}

.income-treemap-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 42px;
  padding: 4px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  font-size: 11px;
  line-height: 1.2;
  transition: opacity 0.2s;
  cursor: pointer;
}

.income-treemap-item:hover {
  opacity: 0.85;
}

.income-treemap-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  font-weight: 500;
}

.income-treemap-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  font-size: 10px;
  margin-top: 2px;
}

.income-treemap-percent {
  font-size: 10px;
  opacity: 0.9;
}

/* 分类统计 */
.category-stats {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-item.clickable {
  cursor: pointer;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.category-item.clickable:hover {
  background: #f5f7fa;
}

.category-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
}

.category-tag {
  padding: 2px 10px;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
}

.month-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  min-width: 70px;
}

.category-count {
  font-size: 12px;
  color: #999;
  min-width: 50px;
}

.category-bar-wrapper {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.category-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.category-amount {
  min-width: 100px;
  text-align: right;
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

/* 筛选区域 */
.filter-section {
  background: #fff;
  border-radius: 12px;
  padding: 16px 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* 表格 */
:deep(.el-table) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

/* 发票缩略图 */
.invoice-thumb {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  cursor: zoom-in;
  border: 1px solid #e1e4e8;
  margin: 0 auto;
}

.invoice-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 发票上传区域 */
.invoice-upload-area {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  height: 140px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.3s;
}

.invoice-upload-area:hover {
  border-color: #409eff;
}

.invoice-placeholder {
  text-align: center;
  color: #999;
}

.upload-icon {
  font-size: 28px;
  margin-bottom: 6px;
}

.upload-text {
  font-size: 14px;
  color: #666;
}

.upload-hint {
  font-size: 12px;
  color: #bbb;
  margin-top: 4px;
}

.invoice-preview-box {
  position: relative;
  width: 100%;
  height: 100%;
}

.invoice-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: zoom-in;
}

.invoice-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 4px;
}

.invoice-action-icon {
  width: 24px;
  height: 24px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.invoice-action-icon:hover {
  background-color: rgba(0, 0, 0, 0.85);
}

.invoice-action-icon.remove {
  background-color: rgba(255, 77, 79, 0.85);
  font-size: 16px;
}

.invoice-action-icon.remove:hover {
  background-color: #ff4d4f;
}

/* 发票大图预览 */
.image-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(5px);
}

.overlay-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.full-img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.overlay-actions {
  margin-top: 20px;
  display: flex;
  gap: 15px;
}

.overlay-btn {
  padding: 10px 25px;
  border-radius: 20px;
  border: none;
  background: #409eff;
  color: white;
  cursor: pointer;
  font-weight: bold;
  transition: 0.3s;
  text-decoration: none;
  display: inline-block;
}

.overlay-btn.close {
  background: #909399;
}

.overlay-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.edit-meta {
  padding: 12px 20px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  display: flex;
  gap: 20px;
  margin-top: -8px;
  margin-bottom: 8px;
}

/* 操作日志 */
.log-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-weight: 500;
}

.log-operator {
  color: #606266;
  font-size: 13px;
}

.log-data {
  margin-top: 6px;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 10px;
}

.log-data-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.log-data pre {
  margin: 0;
  font-size: 12px;
  color: #606266;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

/* 响应式 */
@media (max-width: 768px) {
  .expense-page {
    padding: 12px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .page-title {
    font-size: 20px;
  }

  .stats-cards {
    grid-template-columns: 1fr;
  }

  .stat-value {
    font-size: 22px;
  }

  .category-item {
    flex-wrap: wrap;
  }

  .category-info {
    min-width: auto;
    flex: 1;
  }

  .category-bar-wrapper {
    width: 100%;
    order: 3;
  }

  .category-amount {
    min-width: auto;
    text-align: left;
    order: 2;
    flex: 1;
    margin-left: auto;
  }

  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-row > * {
    width: 100% !important;
  }

  .pagination-wrapper {
    justify-content: center;
  }

  :deep(.el-pagination) {
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  :deep(.el-dialog) {
    width: 92vw !important;
    max-width: 520px;
    margin: 0 auto !important;
    top: 5vh;
  }

  :deep(.el-dialog__body) {
    padding: 16px;
  }

  :deep(.el-form-item__label) {
    float: none !important;
    display: block !important;
    width: 100% !important;
    text-align: left !important;
    padding: 0 0 4px 0 !important;
    line-height: 1.4;
  }

  :deep(.el-form-item__content) {
    margin-left: 0 !important;
    line-height: 1.4;
  }

  .edit-meta {
    flex-direction: column;
    gap: 6px;
    padding: 10px 14px;
  }

  .log-data pre {
    max-height: 150px;
  }

  /* 表格在移动端横向滚动，不撑开页面 */
  :deep(.el-table) {
    width: 100%;
  }

  :deep(.el-table .el-button--small) {
    padding: 0 6px;
  }

  /* 移动端隐藏分类统计的笔数，节省空间 */
  .category-count {
    display: none;
  }
}
</style>