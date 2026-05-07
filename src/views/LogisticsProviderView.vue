<template>
  <div class="provider-page">
    <div class="page-header">
      <h1 class="page-title">货代管理</h1>
      <p class="page-subtitle">管理货代信息，维护物流合作方档案</p>
    </div>

    <!-- 搜索和操作区域 -->
    <div class="search-card">
      <el-form :model="searchForm" :inline="true" class="search-form">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="名称/联系人/电话"
            clearable
            style="width: 200px"
          />
        </el-form-item>

        <el-form-item label="状态">
          <el-select
            v-model="searchForm.status"
            placeholder="选择状态"
            clearable
            style="width: 120px"
          >
            <el-option label="全部" value="" />
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
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
            新增货代
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 数据展示区域 -->
    <div class="content-card">
      <div class="card-header">
        <h3 class="section-title">货代列表</h3>
      </div>

      <el-table :data="providerList" v-loading="loading" stripe style="width: 100%">
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="name" label="货代名称" min-width="160" />
        <el-table-column prop="contact_person" label="联系人" width="100" />
        <el-table-column prop="phone" label="联系电话" width="130" />
        <el-table-column prop="wechat" label="微信" width="120" />
        <el-table-column prop="email" label="邮箱" min-width="160" show-overflow-tooltip />
        <el-table-column prop="address" label="地址" min-width="180" show-overflow-tooltip />
        <el-table-column prop="payment_terms" label="结算方式" width="100" />
        <el-table-column prop="default_route" label="默认线路" width="110" />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">
              {{ scope.row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
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
      :title="isEdit ? '编辑货代' : '新增货代'"
      width="560px"
      :destroy-on-close="true"
    >
      <el-form :model="formData" label-width="100px" :rules="formRules" ref="formRef">
        <el-form-item label="货代名称" prop="name">
          <el-input v-model="formData.name" placeholder="输入货代名称" />
        </el-form-item>
        <el-form-item label="联系人" prop="contact_person">
          <el-input v-model="formData.contact_person" placeholder="输入联系人姓名" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="formData.phone" placeholder="输入联系电话" />
        </el-form-item>
        <el-form-item label="微信" prop="wechat">
          <el-input v-model="formData.wechat" placeholder="输入微信" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="formData.email" placeholder="输入邮箱" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model="formData.address" type="textarea" :rows="2" placeholder="输入地址" />
        </el-form-item>
        <el-form-item label="结算方式" prop="payment_terms">
          <el-select v-model="formData.payment_terms" placeholder="选择结算方式" style="width: 100%">
            <el-option label="预付" value="预付" />
            <el-option label="到付" value="到付" />
            <el-option label="月结" value="月结" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认线路" prop="default_route">
          <el-input v-model="formData.default_route" placeholder="如：美森/盐田/空运等" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="输入备注" />
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
  getLogisticsProviders,
  createLogisticsProvider,
  updateLogisticsProvider,
  deleteLogisticsProvider
} from '@/services/api.js'

export default {
  name: 'LogisticsProviderView',
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
    const providerList = ref([])

    const searchForm = reactive({
      keyword: '',
      status: ''
    })

    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    const formData = reactive({
      id: null,
      name: '',
      contact_person: '',
      phone: '',
      wechat: '',
      email: '',
      address: '',
      payment_terms: '',
      default_route: '',
      remark: '',
      status: 1
    })

    const formRules = {
      name: [{ required: true, message: '请输入货代名称', trigger: 'blur' }]
    }

    const fetchList = async () => {
      loading.value = true
      try {
        const params = {
          page: pagination.page,
          page_size: pagination.page_size
        }
        if (searchForm.keyword) params.keyword = searchForm.keyword
        if (searchForm.status !== '') params.status = searchForm.status

        const response = await getLogisticsProviders(params)
        if (response.data.status === 'success') {
          const data = response.data.data || {}
          providerList.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取货代列表失败')
          providerList.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取货代列表失败:', error)
        ElMessage.error('获取货代列表失败: ' + (error.response?.data?.message || error.message))
        providerList.value = []
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
      searchForm.status = ''
      pagination.page = 1
      fetchList()
    }

    const resetForm = () => {
      formData.id = null
      formData.name = ''
      formData.contact_person = ''
      formData.phone = ''
      formData.wechat = ''
      formData.email = ''
      formData.address = ''
      formData.payment_terms = ''
      formData.default_route = ''
      formData.remark = ''
      formData.status = 1
    }

    const handleCreate = () => {
      isEdit.value = false
      resetForm()
      dialogVisible.value = true
    }

    const handleEdit = (row) => {
      isEdit.value = true
      formData.id = row.id
      formData.name = row.name || ''
      formData.contact_person = row.contact_person || ''
      formData.phone = row.phone || ''
      formData.wechat = row.wechat || ''
      formData.email = row.email || ''
      formData.address = row.address || ''
      formData.payment_terms = row.payment_terms || ''
      formData.default_route = row.default_route || ''
      formData.remark = row.remark || ''
      formData.status = row.status ?? 1
      dialogVisible.value = true
    }

    const handleDelete = (row) => {
      ElMessageBox.confirm(`确定删除货代 "${row.name}" 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await deleteLogisticsProvider(row.id)
          if (response.data.status === 'success') {
            ElMessage.success('删除成功')
            await fetchList()
          } else {
            ElMessage.error(response.data.message || '删除失败')
          }
        } catch (error) {
          console.error('删除货代失败:', error)
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
          name: formData.name,
          contact_person: formData.contact_person,
          phone: formData.phone,
          wechat: formData.wechat,
          email: formData.email,
          address: formData.address,
          payment_terms: formData.payment_terms,
          default_route: formData.default_route,
          remark: formData.remark,
          status: formData.status
        }

        let response
        if (isEdit.value) {
          response = await updateLogisticsProvider(formData.id, payload)
        } else {
          response = await createLogisticsProvider(payload)
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

    onMounted(() => {
      fetchList()
    })

    return {
      loading,
      submitLoading,
      dialogVisible,
      isEdit,
      formRef,
      providerList,
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
      handleSizeChange
    }
  }
}
</script>

<style scoped>
.provider-page {
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

/* 响应式 */
@media (max-width: 768px) {
  .provider-page {
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
