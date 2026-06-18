<template>
  <div class="category-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><CollectionTag /></el-icon>
          类目维护
        </h1>
        <p class="page-subtitle">管理产品分类与佣金比例</p>
      </div>
      <div class="header-actions">
        <el-button type="success" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          新增类目
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <el-input
          v-model="searchForm.keyword"
          placeholder="分类名称/中文名"
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
        <el-table-column prop="category" label="分类名称（EN）" min-width="160" show-overflow-tooltip>
          <template #default="scope">
            <span style="font-weight:500;color:#1a1a2e;">{{ scope.row.category }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="category_cn" label="分类名称（CN）" min-width="140" show-overflow-tooltip>
          <template #default="scope">
            <span style="color:#555;">{{ scope.row.category_cn }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="commission_rate" label="佣金比例" width="120" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.commission_rate != null" type="warning" size="small" effect="dark" round>
              {{ formatPercent(scope.row.commission_rate) }}
            </el-tag>
            <span v-else style="color:#bbb;">-</span>
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
      :title="isEdit ? '编辑类目' : '新增类目'"
      width="520px"
      :destroy-on-close="true"
      :close-on-click-modal="false"
      align-center
    >
      <el-form :model="formData" label-width="110px" :rules="formRules" ref="formRef">
        <el-form-item label="英文名称" prop="category">
          <el-input v-model="formData.category" placeholder="如 Baby Products" />
        </el-form-item>
        <el-form-item label="中文名称" prop="category_cn">
          <el-input v-model="formData.category_cn" placeholder="如 婴儿用品" />
        </el-form-item>
        <el-form-item label="佣金比例" prop="commission_rate">
          <el-input-number
            v-model="formData.commission_rate"
            :min="0"
            :max="1"
            :precision="2"
            :step="0.01"
            style="width: 100%"
          />
          <span class="input-hint">如 0.08 = 8%</span>
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
import { Search, Refresh, Plus, CollectionTag } from '@element-plus/icons-vue'
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} from '@/services/api.js'

export default {
  name: 'CategoryView',
  components: {
    Search,
    Refresh,
    Plus,
    CollectionTag
  },
  setup() {
    const loading = ref(false)
    const submitLoading = ref(false)
    const dialogVisible = ref(false)
    const isEdit = ref(false)
    const formRef = ref(null)
    const categoryList = ref([])

    const searchForm = reactive({
      keyword: ''
    })

    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    const formData = reactive({
      id: null,
      category: '',
      category_cn: '',
      commission_rate: 0.08
    })

    const formRules = {
      category: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
      commission_rate: [{ required: true, message: '请输入佣金比例', trigger: 'change' }]
    }

    const fetchList = async () => {
      loading.value = true
      try {
        const params = {
          page: pagination.page,
          page_size: pagination.page_size
        }
        if (searchForm.keyword) params.keyword = searchForm.keyword

        const response = await getCategories(params)
        if (response.data.status === 'success') {
          const data = response.data.data || {}
          categoryList.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取类目列表失败')
          categoryList.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取类目列表失败:', error)
        ElMessage.error('获取类目列表失败: ' + (error.response?.data?.message || error.message))
        categoryList.value = []
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
      pagination.page = 1
      fetchList()
    }

    const resetForm = () => {
      formData.id = null
      formData.category = ''
      formData.category_cn = ''
      formData.commission_rate = 0.08
    }

    const handleCreate = () => {
      isEdit.value = false
      resetForm()
      dialogVisible.value = true
    }

    const handleEdit = async (row) => {
      isEdit.value = true
      try {
        const response = await getCategory(row.id)
        if (response.data.status === 'success') {
          const data = response.data.data || {}
          formData.id = data.id
          formData.category = data.category || ''
          formData.category_cn = data.category_cn || ''
          formData.commission_rate = data.commission_rate ?? 0.08
          dialogVisible.value = true
        } else {
          ElMessage.error(response.data.message || '获取类目详情失败')
        }
      } catch (error) {
        console.error('获取类目详情失败:', error)
        ElMessage.error('获取类目详情失败: ' + (error.response?.data?.message || error.message))
      }
    }

    const handleDelete = (row) => {
      ElMessageBox.confirm(`确定删除类目 "${row.category_cn || row.category}" 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await deleteCategory(row.id)
          if (response.data.status === 'success') {
            ElMessage.success('删除成功')
            await fetchList()
          } else {
            ElMessage.error(response.data.message || '删除失败')
          }
        } catch (error) {
          console.error('删除类目失败:', error)
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
          category: formData.category,
          category_cn: formData.category_cn,
          commission_rate: formData.commission_rate
        }

        let response
        if (isEdit.value) {
          response = await updateCategory(formData.id, payload)
        } else {
          response = await createCategory(payload)
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

    const formatPercent = (val) => {
      if (val == null) return '-'
      return (Number(val) * 100).toFixed(0) + '%'
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
      handleSearch,
      resetSearch,
      handleCreate,
      handleEdit,
      handleDelete,
      handleSubmit,
      handlePageChange,
      handleSizeChange,
      formatPercent
    }
  }
}
</script>

<style scoped>
.category-page {
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

/* 分页 */
.pagination-wrap {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
}

.input-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  display: block;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .category-page {
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
