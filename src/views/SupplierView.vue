<template>
  <div class="supplier-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><OfficeBuilding /></el-icon>
          供应商管理
        </h1>
        <p class="page-subtitle">管理供应商信息，维护合作方档案</p>
      </div>
      <div class="header-actions">
        <el-button type="success" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          新增供应商
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
        :data="supplierList"
        v-loading="loading"
        style="width: 100%"
        height="calc(100vh - 296px)"
        row-class-name="supplier-row"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        :cell-style="{padding:'10px 0'}"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="name" label="供应商名称" min-width="160">
          <template #default="scope">
            <span style="font-weight:600;color:#1a1a2e;">{{ scope.row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="shop_address" label="店铺地址" min-width="160" show-overflow-tooltip>
          <template #default="scope">
            <a
              v-if="scope.row.shop_address"
              :href="scope.row.shop_address"
              target="_blank"
              class="shop-link"
            >{{ scope.row.shop_address }}</a>
            <span v-else style="color:#888;font-size:13px;">—</span>
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
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="scope">
            <span style="color:#888;font-size:13px;">{{ scope.row.remark }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.status === 1" type="success" size="small" effect="dark" round>启用</el-tag>
            <el-tag v-else type="danger" size="small" effect="dark" round>禁用</el-tag>
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
      :title="isEdit ? '编辑供应商' : '新增供应商'"
      width="520px"
      :destroy-on-close="true"
      align-center
    >
      <el-form :model="formData" label-width="100px" :rules="formRules" ref="formRef">
        <el-form-item label="供应商名称" prop="name">
          <el-input v-model="formData.name" placeholder="输入供应商名称" />
        </el-form-item>
        <el-form-item label="联系人" prop="contact_person">
          <el-input v-model="formData.contact_person" placeholder="输入联系人姓名" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="formData.phone" placeholder="输入联系电话" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="formData.email" placeholder="输入邮箱" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model="formData.address" type="textarea" :rows="2" placeholder="输入地址" />
        </el-form-item>
        <el-form-item label="店铺地址" prop="shop_address">
          <el-input v-model="formData.shop_address" type="textarea" :rows="2" placeholder="亚马逊美国站店铺链接/备注" />
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
import { useListQuerySync } from '@/composables/useListQuerySync.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, OfficeBuilding } from '@element-plus/icons-vue'
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  batchUpdateSupplierStatus
} from '@/services/api.js'

export default {
  name: 'SupplierView',
  components: {
    Search,
    Refresh,
    Plus,
    OfficeBuilding
  },
  setup() {
    const loading = ref(false)
    const submitLoading = ref(false)
    const dialogVisible = ref(false)
    const isEdit = ref(false)
    const formRef = ref(null)
    const tableRef = ref(null)
    const supplierList = ref([])
    const selectedRows = ref([])
    const batchStatusValue = ref('')
    const batchLoading = ref(false)

    const searchForm = reactive({
      keyword: '',
      status: ''
    })

    const { initFromQuery, syncQuery, watchQuery } = useListQuerySync({
      page: { get: () => pagination.page, set: v => pagination.page = v, type: 'number', default: 1 },
      page_size: { get: () => pagination.page_size, set: v => pagination.page_size = v, type: 'number', default: 20 },
      keyword: { get: () => searchForm.keyword, set: v => searchForm.keyword = v },
      status: { get: () => searchForm.status, set: v => searchForm.status = v }
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
      email: '',
      address: '',
      shop_address: '',
      remark: '',
      status: 1
    })

    const formRules = {
      name: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }]
    }

    const fetchList = async () => {
      syncQuery()
      loading.value = true
      try {
        const params = {
          page: pagination.page,
          page_size: pagination.page_size
        }
        if (searchForm.keyword) params.keyword = searchForm.keyword
        if (searchForm.status !== '') params.status = searchForm.status

        const response = await getSuppliers(params)
        if (response.data.status === 'success') {
          const data = response.data.data || {}
          supplierList.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取供应商列表失败')
          supplierList.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取供应商列表失败:', error)
        ElMessage.error('获取供应商列表失败: ' + (error.response?.data?.message || error.message))
        supplierList.value = []
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
      formData.email = ''
      formData.address = ''
      formData.shop_address = ''
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
      formData.email = row.email || ''
      formData.address = row.address || ''
      formData.shop_address = row.shop_address || ''
      formData.remark = row.remark || ''
      formData.status = row.status ?? 1
      dialogVisible.value = true
    }

    const handleDelete = (row) => {
      ElMessageBox.confirm(`确定删除供应商 "${row.name}" 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await deleteSupplier(row.id)
          if (response.data.status === 'success') {
            ElMessage.success('删除成功')
            await fetchList()
          } else {
            ElMessage.error(response.data.message || '删除失败')
          }
        } catch (error) {
          console.error('删除供应商失败:', error)
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
          email: formData.email,
          address: formData.address,
          shop_address: formData.shop_address,
          remark: formData.remark,
          status: formData.status
        }

        let response
        if (isEdit.value) {
          response = await updateSupplier(formData.id, payload)
        } else {
          response = await createSupplier(payload)
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
        const response = await batchUpdateSupplierStatus({
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

    watchQuery(() => fetchList())

    onMounted(() => {
      initFromQuery()
      fetchList()
    })

    return {
      loading,
      submitLoading,
      dialogVisible,
      isEdit,
      formRef,
      tableRef,
      supplierList,
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
.supplier-page {
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
:deep(.supplier-row:hover) { background-color: #fafbff !important; }

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

.shop-link {
  color: #409eff;
  font-size: 13px;
  text-decoration: none;
}
.shop-link:hover {
  text-decoration: underline;
}

/* 分页 */
.pagination-wrap {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .supplier-page {
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
