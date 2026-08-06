<template>
  <div class="transaction-category-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><Collection /></el-icon>
          账目类别管理
        </h1>
        <p class="page-subtitle">管理收支记账的分类、颜色、排序及启用状态</p>
      </div>
      <div class="header-actions">
        <el-button type="success" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          新增分类
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <el-select
          v-model="searchForm.type"
          placeholder="全部分类类型"
          clearable
          style="width: 160px"
          @change="handleSearch"
        >
          <el-option label="支出" value="expense" />
          <el-option label="收入" value="income" />
          <el-option label="盘盈冲正" value="adjustment" />
          <el-option label="通用" value="all" />
        </el-select>
        <el-input
          v-model="searchForm.keyword"
          placeholder="编码/名称"
          clearable
          style="width: 220px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
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
      <el-table
        :data="categoryList"
        v-loading="loading"
        style="width: 100%"
        height="calc(100vh - 296px)"
        row-class-name="category-row"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        :cell-style="{padding:'10px 0'}"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="code" label="编码" min-width="140" show-overflow-tooltip />
        <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="110" align="center">
          <template #default="scope">
            <el-tag :type="typeTag(scope.row.type)" size="small" effect="dark">
              {{ typeLabel(scope.row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="color" label="颜色" width="90" align="center">
          <template #default="scope">
            <div class="color-swatch" :style="{ background: scope.row.color || '#95a5a6' }"></div>
          </template>
        </el-table-column>
        <el-table-column prop="sort_order" label="排序" width="80" align="center" />
        <el-table-column prop="is_active" label="状态" width="90" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.is_active ? 'success' : 'info'" size="small" effect="light">
              {{ scope.row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ scope.row.created_at }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="160" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ scope.row.updated_at }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="scope">
            <el-button type="primary" text size="small" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button
              :type="scope.row.is_active ? 'warning' : 'success'"
              text
              size="small"
              @click="handleToggleActive(scope.row)"
            >
              {{ scope.row.is_active ? '停用' : '启用' }}
            </el-button>
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
      :title="isEdit ? '编辑分类' : '新增分类'"
      width="520px"
      :destroy-on-close="true"
      :close-on-click-modal="false"
      align-center
    >
      <el-form :model="formData" label-width="100px" :rules="formRules" ref="formRef">
        <el-form-item label="分类编码" prop="code">
          <el-input v-model="formData.code" placeholder="如 dining" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="formData.name" placeholder="如 餐饮" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="formData.type">
            <el-radio-button label="expense">支出</el-radio-button>
            <el-radio-button label="income">收入</el-radio-button>
            <el-radio-button label="adjustment">盘盈冲正</el-radio-button>
            <el-radio-button label="all">通用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="颜色">
          <div class="color-picker-row">
            <el-color-picker v-model="formData.color" show-alpha />
            <el-input v-model="formData.color" placeholder="#95a5a6" style="width: 150px; margin-left: 12px;" />
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="formData.sort_order" :min="0" :step="1" style="width: 160px" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="formData.is_active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Collection } from '@element-plus/icons-vue'
import {
  getTransactionCategoryList,
  getTransactionCategoryDetail,
  createTransactionCategory,
  updateTransactionCategory,
  deleteTransactionCategory
} from '@/services/api.js'

export default {
  name: 'TransactionCategoryView',
  components: {
    Search,
    Refresh,
    Plus,
    Collection
  },
  setup() {
    const loading = ref(false)
    const submitLoading = ref(false)
    const dialogVisible = ref(false)
    const isEdit = ref(false)
    const formRef = ref(null)
    const categoryList = ref([])

    const searchForm = reactive({
      type: '',
      keyword: ''
    })

    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    const formData = reactive({
      id: null,
      code: '',
      name: '',
      type: 'expense',
      color: '#95a5a6',
      sort_order: 0,
      is_active: true
    })

    const formRules = {
      code: [
        { required: true, message: '请输入分类编码', trigger: 'blur' },
        { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线', trigger: 'blur' }
      ],
      name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
      type: [{ required: true, message: '请选择类型', trigger: 'change' }]
    }

    const typeMap = {
      expense: { label: '支出', tag: 'danger' },
      income: { label: '收入', tag: 'success' },
      adjustment: { label: '盘盈冲正', tag: 'primary' },
      all: { label: '通用', tag: 'info' }
    }

    const typeLabel = (type) => typeMap[type]?.label || type
    const typeTag = (type) => typeMap[type]?.tag || 'info'

    const fetchList = async () => {
      loading.value = true
      try {
        const params = {
          page: pagination.page,
          page_size: pagination.page_size
        }
        if (searchForm.type) params.type = searchForm.type
        if (searchForm.keyword) params.keyword = searchForm.keyword

        const response = await getTransactionCategoryList(params)
        if (response.data.status === 'success') {
          const data = response.data.data || {}
          categoryList.value = (data.list || []).map(normalizeRow)
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取分类列表失败')
          categoryList.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取分类列表失败:', error)
        ElMessage.error('获取分类列表失败: ' + (error.response?.data?.message || error.message))
        categoryList.value = []
        pagination.total = 0
      } finally {
        loading.value = false
      }
    }

    const normalizeRow = (row) => ({
      ...row,
      is_active: !!row.is_active
    })

    const handleSearch = () => {
      pagination.page = 1
      fetchList()
    }

    const resetSearch = () => {
      searchForm.type = ''
      searchForm.keyword = ''
      pagination.page = 1
      fetchList()
    }

    const resetForm = () => {
      formData.id = null
      formData.code = ''
      formData.name = ''
      formData.type = 'expense'
      formData.color = '#95a5a6'
      formData.sort_order = 0
      formData.is_active = true
    }

    const handleCreate = () => {
      isEdit.value = false
      resetForm()
      dialogVisible.value = true
    }

    const handleEdit = async (row) => {
      isEdit.value = true
      try {
        const response = await getTransactionCategoryDetail(row.id)
        if (response.data.status === 'success') {
          const data = response.data.data || {}
          formData.id = data.id
          formData.code = data.code || ''
          formData.name = data.name || ''
          formData.type = data.type || 'expense'
          formData.color = data.color || '#95a5a6'
          formData.sort_order = data.sort_order ?? 0
          formData.is_active = data.is_active !== false && data.is_active !== 0
          dialogVisible.value = true
        } else {
          ElMessage.error(response.data.message || '获取分类详情失败')
        }
      } catch (error) {
        console.error('获取分类详情失败:', error)
        ElMessage.error('获取分类详情失败: ' + (error.response?.data?.message || error.message))
      }
    }

    const handleToggleActive = (row) => {
      const next = !row.is_active
      const action = next ? '启用' : '停用'
      ElMessageBox.confirm(`确定${action}分类 "${row.name || row.code}" 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const payload = {
            name: row.name,
            type: row.type,
            color: row.color,
            sort_order: row.sort_order,
            is_active: next
          }
          const response = await updateTransactionCategory(row.id, payload)
          if (response.data.status === 'success') {
            ElMessage.success(`${action}成功`)
            await fetchList()
          } else {
            ElMessage.error(response.data.message || `${action}失败`)
          }
        } catch (error) {
          console.error(`${action}分类失败:`, error)
          ElMessage.error(`${action}失败: ` + (error.response?.data?.message || error.message))
        }
      }).catch(() => {})
    }

    const handleDelete = (row) => {
      ElMessageBox.confirm(`确定删除分类 "${row.name || row.code}" 吗？<br><span style="color:#999;font-size:12px;">若已被交易记录引用则无法删除</span>`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: true
      }).then(async () => {
        try {
          const response = await deleteTransactionCategory(row.id)
          if (response.data.status === 'success') {
            ElMessage.success('删除成功')
            await fetchList()
          } else {
            ElMessage.error(response.data.message || '删除失败')
          }
        } catch (error) {
          console.error('删除分类失败:', error)
          ElMessage.error('删除失败: ' + (error.response?.data?.message || error.message))
        }
      }).catch(() => {})
    }

    const handleSubmit = async () => {
      const valid = await formRef.value?.validate().catch(() => false)
      if (!valid) return

      submitLoading.value = true
      try {
        const payload = {
          code: formData.code,
          name: formData.name,
          type: formData.type,
          color: formData.color,
          sort_order: formData.sort_order,
          is_active: formData.is_active
        }

        let response
        if (isEdit.value) {
          response = await updateTransactionCategory(formData.id, payload)
        } else {
          response = await createTransactionCategory(payload)
        }

        if (response.data.status === 'success') {
          ElMessage.success(isEdit.value ? '编辑成功' : '新增成功')
          dialogVisible.value = false
          await fetchList()
        } else {
          ElMessage.error(response.data.message || (isEdit.value ? '编辑失败' : '新增失败'))
        }
      } catch (error) {
        console.error('提交分类失败:', error)
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

    onMounted(() => {
      fetchList()
    })

    return {
      loading,
      submitLoading,
      dialogVisible,
      isEdit,
      formRef,
      categoryList,
      searchForm,
      pagination,
      formData,
      formRules,
      typeLabel,
      typeTag,
      handleSearch,
      resetSearch,
      handleCreate,
      handleEdit,
      handleToggleActive,
      handleDelete,
      handleSubmit,
      handlePageChange,
      handleSizeChange
    }
  }
}
</script>

<style scoped>
.transaction-category-page {
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
:deep(.category-row:hover) { background-color: #fafbff !important; }

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  margin: 0 auto;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
}

.color-picker-row {
  display: flex;
  align-items: center;
}

/* 分页 */
.pagination-wrap {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .transaction-category-page {
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
}
</style>
