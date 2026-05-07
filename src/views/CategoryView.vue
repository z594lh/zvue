<template>
  <div class="category-page">
    <div class="page-header">
      <h1 class="page-title">类目维护</h1>
      <p class="page-subtitle">管理产品分类与佣金比例</p>
    </div>

    <!-- 搜索和操作区域 -->
    <div class="search-card">
      <el-form :model="searchForm" :inline="true" class="search-form">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="分类名称/中文名"
            clearable
            style="width: 200px"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSearch" :loading="loading">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetSearch">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
          <el-button type="success" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新增类目
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 数据展示区域 -->
    <div class="content-card">
      <div class="card-header">
        <h3 class="section-title">类目列表</h3>
      </div>

      <el-table :data="categoryList" v-loading="loading" stripe style="width: 100%">
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="category" label="分类名称（EN）" min-width="160" show-overflow-tooltip />
        <el-table-column prop="category_cn" label="分类名称（CN）" min-width="140" show-overflow-tooltip />
        <el-table-column prop="commission_rate" label="佣金比例" width="120" align="center">
          <template #default="scope">
            {{ formatPercent(scope.row.commission_rate) }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" align="center" />
        <el-table-column prop="updated_at" label="更新时间" width="160" align="center" />
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="scope">
            <el-button type="primary" link @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
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
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
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
    Plus
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
  max-width: 1400px;
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

.search-card,
.content-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;
}

.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.input-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  display: block;
}

/* 响应式 */
@media (max-width: 768px) {
  .category-page {
    padding: 12px;
  }

  .page-title {
    font-size: 24px;
  }

  .search-card,
  .content-card {
    padding: 16px;
  }

  .search-form {
    flex-direction: column;
    align-items: stretch;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .pagination-container {
    text-align: center;
  }
}
</style>
