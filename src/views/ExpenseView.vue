<template>
  <div class="expense-page">
    <div class="page-header">
      <h1 class="page-title">支出报销记账</h1>
      <div class="page-actions">
        <el-button @click="exportData" :loading="exporting">导出</el-button>
        <el-button type="primary" @click="openAddDialog" :icon="Plus">新增支出</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-label">公账本月</div>
        <div class="stat-value" style="color: #e74c3c;">¥{{ formatNumber(companyMonthTotal) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">私账本月</div>
        <div class="stat-value" style="color: #667eea;">¥{{ formatNumber(personalMonthTotal) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">私账未报销</div>
        <div class="stat-value" style="color: #f39c12;">¥{{ formatNumber(unreimbursedTotal) }}</div>
      </div>
    </div>

    <!-- 分类统计 -->
    <div class="category-stats" v-if="categoryStats.length > 0">
      <h3 class="section-title">分类统计（本月{{ filterAccountType ? ' · ' + accountTypeLabel : '' }}）</h3>
      <div class="category-list">
        <div v-for="item in categoryStats" :key="item.category" class="category-item">
          <div class="category-info">
            <span class="category-tag" :style="{ background: getCategoryColor(item.category) }">
              {{ item.category }}
            </span>
            <span class="category-count">{{ item.count }} 笔</span>
          </div>
          <div class="category-bar-wrapper">
            <div class="category-bar" :style="{ width: item.percentage + '%', background: getCategoryColor(item.category) }"></div>
          </div>
          <div class="category-amount">¥{{ formatNumber(item.amount) }}</div>
        </div>
      </div>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <div class="filter-row">
        <el-date-picker
          v-model="filterMonth"
          type="month"
          placeholder="选择月份"
          format="YYYY年MM月"
          value-format="YYYY-MM"
          clearable
          style="width: 180px"
        />
        <el-select v-model="filterCategory" placeholder="全部分类" clearable style="width: 140px">
          <el-option
            v-for="cat in categories"
            :key="cat.value"
            :label="cat.label"
            :value="cat.value"
          />
        </el-select>
        <el-select v-model="filterAccountType" placeholder="全部账目" clearable style="width: 120px">
          <el-option label="公账" value="company" />
          <el-option label="私账" value="personal" />
        </el-select>
        <el-select v-if="filterAccountType === 'personal'" v-model="filterReimbursed" placeholder="报销状态" clearable style="width: 120px">
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
        <el-button @click="resetFilter">重置</el-button>
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
      <el-table-column prop="date" label="日期" width="115" sortable />
      <el-table-column label="账目" width="90" align="center">
        <template #default="scope">
          <el-tag :type="scope.row.account_type === 'company' ? 'danger' : 'primary'" size="small" effect="dark">
            {{ scope.row.account_type === 'company' ? '公账' : '私账' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="分类" width="100">
        <template #default="scope">
          <el-tag :color="getCategoryColor(scope.row.category)" effect="dark" size="small">
            {{ scope.row.category }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="amount" label="金额" width="110" sortable>
        <template #default="scope">
          <span style="color: #e74c3c; font-weight: 600;">¥{{ formatNumber(scope.row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
      <el-table-column prop="created_by_name" label="创建人" width="90" align="center" />
      <el-table-column label="报销" width="80" align="center">
        <template #default="scope">
          <template v-if="scope.row.account_type === 'personal'">
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
      <el-table-column label="发票" width="80" align="center">
        <template #default="scope">
          <div v-if="scope.row.invoice_url" class="invoice-thumb" @click="previewInvoice(scope.row.invoice_url)">
            <img :src="scope.row.invoice_url" />
          </div>
          <el-tag v-else type="info" size="small">无</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
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
      :title="isEdit ? '编辑支出记录' : '新增支出记录'"
      width="520px"
      destroy-on-close
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="账目类型" prop="account_type">
          <el-radio-group v-model="form.account_type">
            <el-radio-button label="company">公账</el-radio-button>
            <el-radio-button label="personal">私账</el-radio-button>
          </el-radio-group>
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
          <el-select v-model="form.category" placeholder="选择分类" style="width: 100%">
            <el-option
              v-for="cat in categories"
              :key="cat.value"
              :label="cat.label"
              :value="cat.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number
            v-model="form.amount"
            :precision="2"
            :min="0"
            :step="10"
            style="width: 100%"
            controls-position="right"
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
        <el-form-item v-if="form.account_type === 'personal'" label="报销状态">
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
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getExpenseList, createExpense, updateExpense, deleteExpense, toggleReimburseStatus, getExpenseLogs, getExpenseUsers } from '@/services/api.js'

const categories = [
  { label: '采购/货值（进货、备货、头程前的货款）', value: '采购/货值', color: '#e74c3c' },
  { label: '物流/头程（国际物流、空海运、快递费）', value: '物流/头程', color: '#3498db' },
  { label: '平台费用（亚马逊/速卖通等佣金、月租、仓储费）', value: '平台费用', color: '#9b59b6' },
  { label: '广告/推广（站内广告、站外投放、测评/引流）', value: '广告/推广', color: '#f39c12' },
  { label: '办公/人力（员工工资、社保、办公室租金水电、办公用品）', value: '办公/人力', color: '#27ae60' },
  { label: '软件/工具（ERP、选品工具、插件、数据分析订阅费）', value: '软件/工具', color: '#1abc9c' },
  { label: '合规/杂费（VAT、商标专利、认证、财务/代理记账费）', value: '合规/杂费', color: '#e67e22' },
  { label: '其他（无法归类的小额支出）', value: '其他', color: '#95a5a6' }
]

const getCategoryColor = (category) => {
  const cat = categories.find(c => c.value === category)
  return cat ? cat.color : '#bdc3c7'
}

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0.00'
  return Number(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default {
  name: 'ExpenseView',
  setup() {
    const router = useRouter()
    const loading = ref(false)
    const submitting = ref(false)
    const exporting = ref(false)
    const records = ref([])
    const dialogVisible = ref(false)
    const isEdit = ref(false)
    const formRef = ref(null)
    const invoiceInput = ref(null)
    const currentPage = ref(1)
    const pageSize = ref(20)
    const filterMonth = ref('')
    const filterCategory = ref('')
    const filterAccountType = ref('')
    const filterReimbursed = ref('')
    const filterCreatedBy = ref('')
    const usersList = ref([])
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

    const form = reactive({
      id: null,
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
      amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
      account_type: [{ required: true, message: '请选择账目类型', trigger: 'change' }]
    }

    const accountTypeLabel = computed(() => {
      return filterAccountType.value === 'company' ? '公账' : '私账'
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
        category: row.category,
        amount: Number(row.amount || 0),
        remark: row.remark || '',
        account_type: row.account_type || row.accountType || 'company',
        reimbursed: !!(row.reimbursed ?? false),
        has_invoice: !!(row.has_invoice ?? row.hasInvoice ?? false),
        invoice_url: row.invoice_url || row.invoiceUrl || row.invoice_image || row.invoiceImage || '',
        created_by_name: row.created_by_name || '',
        updated_by_name: row.updated_by_name || ''
      }
    }

    // 从后端获取支出列表
    const fetchRecords = async () => {
      loading.value = true
      try {
        const params = {
          page: currentPage.value,
          page_size: pageSize.value
        }
        if (filterMonth.value) params.month = filterMonth.value
        if (filterCategory.value) params.category = filterCategory.value
        if (filterAccountType.value) params.account_type = filterAccountType.value
        if (filterReimbursed.value) params.reimbursed = filterReimbursed.value
        if (filterCreatedBy.value) params.created_by = filterCreatedBy.value

        const res = await getExpenseList(params)
        if (res.data.status === 'success') {
          const list = res.data.data.list || []
          records.value = list.map(normalizeRecord)
          console.log('[ExpenseView] fetchRecords:', list)
        } else {
          records.value = []
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
        if (filterMonth.value) params.month = filterMonth.value
        if (filterCategory.value) params.category = filterCategory.value
        if (filterAccountType.value) params.account_type = filterAccountType.value
        if (filterReimbursed.value) params.reimbursed = filterReimbursed.value
        if (filterCreatedBy.value) params.created_by = filterCreatedBy.value

        const res = await getExpenseList(params)
        if (res.data.status !== 'success') {
          ElMessage.warning('导出失败')
          return
        }
        const list = (res.data.data.list || []).map(normalizeRecord)
        if (list.length === 0) {
          ElMessage.warning('没有数据可导出')
          return
        }

        const headers = ['日期', '账目类型', '分类', '金额', '备注', '报销状态', '发票', '发票链接', '创建人']
        const rows = list.map(r => [
          r.date,
          r.account_type === 'company' ? '公账' : '私账',
          r.category,
          r.amount,
          r.remark || '',
          r.account_type === 'personal' ? (r.reimbursed ? '已报销' : '未报销') : '—',
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
        link.download = `支出记录_${dateStr}.csv`
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
      return records.value.length
    })

    // 筛选后的记录（后端分页）
    const filteredRecords = computed(() => {
      return records.value
    })

    // 本月记录
    const currentMonth = computed(() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })

    const currentMonthRecords = computed(() => {
      return records.value.filter(r => r.date && r.date.startsWith(currentMonth.value))
    })

    // 公账本月统计
    const companyMonthTotal = computed(() => {
      return currentMonthRecords.value
        .filter(r => r.account_type === 'company')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0)
    })

    // 私账本月统计
    const personalMonthTotal = computed(() => {
      return currentMonthRecords.value
        .filter(r => r.account_type === 'personal')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0)
    })

    // 私账未报销统计（不限本月，看全部未报销私账）
    const unreimbursedTotal = computed(() => {
      return records.value
        .filter(r => r.account_type === 'personal' && !r.reimbursed)
        .reduce((sum, r) => sum + Number(r.amount || 0), 0)
    })

    // 分类统计（当前筛选条件下）
    const categoryStats = computed(() => {
      let source = currentMonthRecords.value
      if (filterAccountType.value) {
        source = source.filter(r => r.account_type === filterAccountType.value)
      }
      const stats = {}
      let total = 0
      source.forEach(r => {
        const amount = Number(r.amount || 0)
        if (!stats[r.category]) {
          stats[r.category] = { category: r.category, amount: 0, count: 0 }
        }
        stats[r.category].amount += amount
        stats[r.category].count += 1
        total += amount
      })
      return Object.values(stats)
        .map(s => ({
          ...s,
          percentage: total > 0 ? Math.round((s.amount / total) * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount)
    })

    // 获取用户列表（创建人筛选用）
    const fetchUsers = async () => {
      try {
        const res = await getExpenseUsers()
        if (res.data.status === 'success') {
          usersList.value = res.data.data || []
        }
      } catch (err) {
        handleApiError(err)
      }
    }

    // 重置筛选
    const resetFilter = () => {
      filterMonth.value = ''
      filterCategory.value = ''
      filterAccountType.value = ''
      filterReimbursed.value = ''
      filterCreatedBy.value = ''
      currentPage.value = 1
      fetchRecords()
    }

    // 每页条数变化
    const handleSizeChange = (size) => {
      pageSize.value = size
      currentPage.value = 1
      fetchRecords()
    }

    // 打开新增弹窗
    const openAddDialog = () => {
      isEdit.value = false
      form.id = null
      form.date = new Date().toISOString().split('T')[0]
      form.category = ''
      form.amount = 0
      form.remark = ''
      form.account_type = 'company'
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
      invoicePreviewUrl.value = row.invoice_url || ''
      invoiceBase64.value = ''
      dialogVisible.value = true
    }

    // 删除记录
    const deleteRecord = async (row) => {
      try {
        await ElMessageBox.confirm(
          `确定删除 ${row.date} 的 ${row.category} 支出 ¥${row.amount} 吗？`,
          '确认删除',
          { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
        )
        await deleteExpense(row.id)
        ElMessage.success('删除成功')
        fetchRecords()
      } catch (err) {
        if (err !== 'cancel') handleApiError(err)
      }
    }

    // 切换报销状态
    const toggleReimburse = async (row) => {
      try {
        await toggleReimburseStatus(row.id)
        const newStatus = !row.reimbursed
        row.reimbursed = newStatus
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
        const res = await getExpenseLogs(id)
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
      updated_by_name: '修改人'
    }

    // 日志字段值友好展示
    const formatLogFieldValue = (key, value) => {
      if (value === null || value === undefined) return '—'
      if (key === 'has_invoice') return value ? '有' : '无'
      if (key === 'reimbursed') return value ? '已报销' : '未报销'
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
            date: form.date,
            category: form.category,
            amount: form.amount,
            remark: form.remark,
            account_type: form.account_type,
            reimbursed: form.account_type === 'personal' ? form.reimbursed : false,
            has_invoice: form.has_invoice
          }

          if (form.has_invoice && invoiceBase64.value) {
            payload.invoice_image = invoiceBase64.value
          }

          if (isEdit.value) {
            await updateExpense(form.id, payload)
            ElMessage.success('修改成功')
          } else {
            await createExpense(payload)
            ElMessage.success('添加成功')
          }

          dialogVisible.value = false
          fetchRecords()
        } catch (err) {
          handleApiError(err)
        } finally {
          submitting.value = false
        }
      })
    }

    // 筛选变化时自动刷新
    watch([filterMonth, filterCategory, filterAccountType, filterReimbursed, filterCreatedBy], () => {
      currentPage.value = 1
      fetchRecords()
    })

    onMounted(() => {
      fetchRecords()
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
      filterMonth,
      filterCategory,
      filterAccountType,
      filterReimbursed,
      filterCreatedBy,
      usersList,
      currentPage,
      pageSize,
      totalRecords,
      filteredRecords,
      companyMonthTotal,
      personalMonthTotal,
      unreimbursedTotal,
      categoryStats,
      accountTypeLabel,
      invoicePreviewUrl,
      showInvoiceOverlay,
      overlayInvoiceUrl,
      logsDialogVisible,
      expenseLogs,
      logsLoading,
      getCategoryColor,
      formatNumber,
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
      exportData,
      Plus
    }
  }
}
</script>

<style scoped>
.expense-page {
  max-width: 1200px;
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

.stat-label {
  font-size: 14px;
  color: #999;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
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
    width: 80px !important;
  }

  :deep(.el-form-item__content) {
    margin-left: 80px !important;
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