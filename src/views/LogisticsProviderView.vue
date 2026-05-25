<template>
  <div class="provider-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><Van /></el-icon>
          货代管理
        </h1>
        <p class="page-subtitle">管理货代信息，维护物流合作方档案</p>
      </div>
      <div class="header-actions">
        <el-button type="success" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          新增货代
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <el-input
          v-model="searchForm.keyword"
          placeholder="名称/联系人/电话"
          clearable
          style="width: 220px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
          style="width: 120px"
        >
          <el-option label="全部" value="" />
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
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
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-button type="primary" size="small" :loading="batchLoading" :disabled="batchStatusValue === ''" @click="handleBatchStatus">
          批量修改状态
        </el-button>
        <el-button size="small" @click="tableRef?.clearSelection?.()">取消选择</el-button>
      </div>

      <el-table
        ref="tableRef"
        :data="providerList"
        v-loading="loading"
        style="width: 100%"
        height="calc(100vh - 260px)"
        row-class-name="provider-row"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        :cell-style="{padding:'10px 0'}"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="name" label="货代名称" min-width="160">
          <template #default="scope">
            <span style="font-weight:600;color:#1a1a2e;">{{ scope.row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="contact_person" label="联系人" width="100">
          <template #default="scope">
            <span style="color:#555;">{{ scope.row.contact_person }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="联系电话" width="130">
          <template #default="scope">
            <span style="font-family:monospace;font-size:12px;color:#888;">{{ scope.row.phone }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="wechat" label="微信" width="120">
          <template #default="scope">
            <span style="color:#888;font-size:13px;">{{ scope.row.wechat }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="160" show-overflow-tooltip>
          <template #default="scope">
            <span style="color:#555;font-size:13px;">{{ scope.row.email }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="address" label="地址" min-width="180" show-overflow-tooltip>
          <template #default="scope">
            <span style="color:#888;font-size:13px;">{{ scope.row.address }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="payment_terms" label="结算方式" width="100" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.payment_terms" size="small" effect="plain">{{ scope.row.payment_terms }}</el-tag>
            <span v-else style="color:#bbb;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="default_route" label="默认线路" width="110">
          <template #default="scope">
            <span style="color:#888;font-size:13px;">{{ scope.row.default_route }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.status === 1" type="success" size="small" effect="dark" round>启用</el-tag>
            <el-tag v-else type="danger" size="small" effect="dark" round>禁用</el-tag>
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
      :title="isEdit ? '编辑货代' : '新增货代'"
      width="560px"
      :destroy-on-close="true"
      align-center
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
import { Search, Refresh, Plus, Van } from '@element-plus/icons-vue'
import {
  getLogisticsProviders,
  createLogisticsProvider,
  updateLogisticsProvider,
  deleteLogisticsProvider,
  batchUpdateLogisticsProviderStatus
} from '@/services/api.js'

export default {
  name: 'LogisticsProviderView',
  components: {
    Search,
    Refresh,
    Plus,
    Van
  },
  setup() {
    const loading = ref(false)
    const submitLoading = ref(false)
    const dialogVisible = ref(false)
    const isEdit = ref(false)
    const formRef = ref(null)
    const tableRef = ref(null)
    const providerList = ref([])
    const selectedRows = ref([])
    const batchStatusValue = ref('')
    const batchLoading = ref(false)

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
        const response = await batchUpdateLogisticsProviderStatus({
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

    onMounted(() => {
      fetchList()
    })

    return {
      loading,
      submitLoading,
      dialogVisible,
      isEdit,
      formRef,
      tableRef,
      providerList,
      selectedRows,
      batchStatusValue,
      batchLoading,
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
      handleSelectionChange,
      handleBatchStatus
    }
  }
}
</script>

<style scoped>
.provider-page {
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
:deep(.provider-row:hover) { background-color: #fafbff !important; }

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

/* 分页 */
.pagination-wrap {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .provider-page {
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
