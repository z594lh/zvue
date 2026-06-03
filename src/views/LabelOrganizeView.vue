<template>
  <div class="label-organize-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><Box /></el-icon>
          箱唛助手
        </h1>
        <p class="page-subtitle">根据入库计划ID自动下载、裁剪并整理所有货件箱唛</p>
      </div>
    </div>

    <!-- 新建任务 -->
    <div class="form-card">
      <h3 class="section-title">新建整理任务</h3>
      <el-form :model="taskForm" ref="taskFormRef" label-width="100px" :rules="taskRules">
        <div class="task-form-body">
          <!-- 左侧表单字段 -->
          <div class="task-form-fields">
            <el-form-item label="选择店铺" prop="shop_id" style="width:200px;margin-bottom:0;">
              <el-select
                v-model="taskForm.shop_id"
                placeholder="选择店铺"
                clearable
                style="width:100%"
                @change="handleShopChange"
              >
                <el-option
                  v-for="shop in shopList"
                  :key="shop.id"
                  :label="shop.shop_name"
                  :value="shop.id"
                />
                <el-option value="__refresh__" label="🔄 刷新店铺列表" />
              </el-select>
            </el-form-item>

            <el-form-item label="入库计划" prop="inbound_plan_id" style="width:550px;margin-bottom:0;">
              <el-select
                v-model="taskForm.inbound_plan_id"
                placeholder="请选择入库计划"
                clearable
                filterable
                style="width:100%"
                :disabled="!taskForm.shop_id || inboundPlansLoading"
                :loading="inboundPlansLoading"
              >
                <el-option
                  v-for="plan in inboundPlans"
                  :key="plan.inbound_plan_id"
                  :label="plan.inbound_plan_id + (plan.name ? ' - ' + plan.name : '')"
                  :value="plan.inbound_plan_id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="裁剪配置" required style="width:290px;margin-bottom:0;">
              <el-select v-model="taskForm.crop_preset" placeholder="默认 10×10" style="width:100%">
                <el-option label="默认 (10×15 → 10×10)" value="default" />
                <el-option label="完整保留 (10×15)" value="full" />
              </el-select>
            </el-form-item>

            <el-form-item label="货代" style="width:200px;margin-bottom:0;">
              <el-select
                v-model="taskForm.logistics_provider_id"
                placeholder="选择货代"
                clearable
                style="width:100%"
                :loading="logisticsProvidersLoading"
              >
                <el-option
                  v-for="provider in logisticsProviders"
                  :key="provider.id"
                  :label="provider.name"
                  :value="provider.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="货代箱唛" style="width:340px;margin-bottom:0;">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                <el-upload
                  ref="uploadRef"
                  v-model:file-list="cargoAgentFileList"
                  :auto-upload="false"
                  :limit="1"
                  accept=".zip"
                  :show-file-list="false"
                  style="display:inline-block;flex-shrink:0;"
                >
                  <el-button
                    type="info"
                    plain
                    size="default"
                    :icon="Upload"
                    :disabled="submitting"
                  >
                    {{ cargoAgentFileList.length ? '已选择' : '上传ZIP' }}
                  </el-button>
                </el-upload>
                <span
                  v-if="cargoAgentFileList.length"
                  style="font-size:12px;color:#409eff;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                  :title="cargoAgentFileList[0].name"
                >
                  {{ cargoAgentFileList[0].name }}
                </span>
                <el-icon
                  v-if="cargoAgentFileList.length"
                  style="cursor:pointer;color:#909399;font-size:14px;flex-shrink:0;"
                  @click.stop="clearCargoAgentFile"
                >
                  <CircleClose />
                </el-icon>
              </div>
            </el-form-item>
          </div>

          <!-- 右侧提交按钮 -->
          <div class="task-form-submit">
            <el-button
              type="primary"
              :loading="submitting"
              @click="handleCreateTask"
              :icon="Plus"
              size="large"
              style="width:120px;"
            >
              提交任务
            </el-button>
          </div>
        </div>
      </el-form>
    </div>

    <!-- 任务列表 -->
    <div class="table-card">
      <div class="table-header">
        <h3 class="section-title">任务列表</h3>
        <div class="table-actions">
          <el-select
            v-model="filterInboundPlanId"
            placeholder="全部入库计划"
            clearable
            filterable
            style="width:260px"
            @change="handleFilterChange"
          >
            <el-option label="全部" value="" />
            <el-option
              v-for="plan in inboundPlans"
              :key="plan.inbound_plan_id"
              :label="(plan.name || plan.inbound_plan_id) + (plan.created_at ? ' | ' + formatDate(plan.created_at) : '')"
              :value="plan.inbound_plan_id"
            />
          </el-select>
          <el-select
            v-model="filterStatus"
            placeholder="全部状态"
            clearable
            style="width:140px"
            @change="handleFilterChange"
          >
            <el-option label="全部" value="" />
            <el-option label="待执行" value="pending" />
            <el-option label="执行中" value="running" />
            <el-option label="已完成" value="completed" />
            <el-option label="已失败" value="failed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
          <el-button plain @click="fetchTasks" :loading="loading">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </div>
      </div>

      <el-table
        :data="tasks"
        v-loading="loading"
        style="width: 100%"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        :cell-style="{padding:'10px 0'}"
        row-class-name="task-row"
      >
        <el-table-column prop="inbound_plan_id" label="入库计划ID" min-width="220" show-overflow-tooltip>
          <template #default="scope">
            <span style="font-family:monospace;font-size:13px;color:#333;">{{ scope.row.inbound_plan_id }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="logistics_provider_id" label="货代" width="120" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.logistics_provider_id != null" size="small" effect="plain" type="info">
              {{ logisticsProviders.find(p => String(p.id) === String(scope.row.logistics_provider_id))?.name || scope.row.logistics_provider_id }}
            </el-tag>
            <span v-else style="color:#bbb;">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="110" align="center">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small" effect="dark" round>
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="progress" label="进度" width="140" align="center">
          <template #default="scope">
            <el-progress
              :percentage="scope.row.progress || 0"
              :status="getProgressStatus(scope.row.status)"
              :stroke-width="12"
              style="width:120px;"
            />
          </template>
        </el-table-column>

        <el-table-column prop="message" label="消息" min-width="180" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.message" style="color:#e74c3c;font-size:12px;">{{ scope.row.message }}</span>
            <span v-else style="color:#bbb;">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="created_at" label="创建时间" width="170" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ formatDate(scope.row.created_at) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="completed_at" label="完成时间" width="170" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ formatDate(scope.row.completed_at) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="expired_at" label="过期时间" width="170" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ formatDate(scope.row.expired_at) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'completed' && scope.row.download_url"
              type="primary"
              link
              size="small"
              :icon="Download"
              @click="handleDownload(scope.row)"
            >
              下载
            </el-button>
            <el-button
              v-if="scope.row.status === 'pending'"
              type="warning"
              link
              size="small"
              :icon="CircleClose"
              @click="handleCancel(scope.row)"
            >
              取消
            </el-button>
            <el-button
              v-if="['completed','failed','cancelled'].includes(scope.row.status)"
              type="success"
              link
              size="small"
              :icon="RefreshRight"
              @click="handleRetry(scope.row)"
            >
              重试
            </el-button>
            <el-button
              type="danger"
              link
              size="small"
              :icon="Delete"
              @click="handleDelete(scope.row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          :hide-on-single-page="false"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Box,
  Plus,
  Refresh,
  RefreshRight,
  Download,
  Delete,
  CircleClose,
  Upload
} from '@element-plus/icons-vue'
import { useShopCache } from '@/composables/useShopCache'
import {
  createLabelOrganizeTask,
  getLabelOrganizeTasks,
  getLabelOrganizeTaskDetail,
  downloadLabelOrganizeResult,
  deleteLabelOrganizeTask,
  cancelLabelOrganizeTask,
  retryLabelOrganizeTask,
  getInboundPlanOptions,
  getLogisticsProviderOptions
} from '@/services/api.js'

export default {
  name: 'LabelOrganizeView',
  components: {
    Box,
    CircleClose
  },
  setup() {
    const { shopList, fetchShopList, refreshShopList, defaultShopId } = useShopCache()
    const loading = ref(false)
    const submitting = ref(false)
    const tasks = ref([])
    const filterStatus = ref('')
    const filterInboundPlanId = ref('')
    const taskFormRef = ref(null)
    const pollTimers = ref(new Map())
    const inboundPlans = ref([])
    const inboundPlansLoading = ref(false)
    const logisticsProviders = ref([])
    const logisticsProvidersLoading = ref(false)
    const cargoAgentFileList = ref([])
    const uploadRef = ref(null)

    const taskForm = reactive({
      shop_id: null,
      inbound_plan_id: '',
      crop_preset: 'default',
      logistics_provider_id: null
    })

    const taskRules = {
      shop_id: [{ required: true, message: '请选择店铺', trigger: 'change' }],
      inbound_plan_id: [{ required: true, message: '请输入入库计划ID', trigger: 'blur' }]
    }

    const pagination = reactive({
      page: 1,
      page_size: 10,
      total: 0
    })

    // 获取入库计划列表
    const fetchInboundPlans = async () => {
      if (!taskForm.shop_id) {
        inboundPlans.value = []
        return
      }
      inboundPlansLoading.value = true
      try {
        const response = await getInboundPlanOptions()
        if (response.data.status === 'success') {
          inboundPlans.value = response.data.data || []
        }
      } catch (error) {
        console.error('获取入库计划列表失败:', error)
      } finally {
        inboundPlansLoading.value = false
      }
    }

    // 获取货代列表
    const fetchLogisticsProviders = async () => {
      logisticsProvidersLoading.value = true
      try {
        const response = await getLogisticsProviderOptions()
        if (response.data.status === 'success') {
          logisticsProviders.value = response.data.data || []
        }
      } catch (error) {
        console.error('获取货代列表失败:', error)
      } finally {
        logisticsProvidersLoading.value = false
      }
    }

    // 获取任务列表
    const fetchTasks = async () => {
      if (!taskForm.shop_id) {
        tasks.value = []
        pagination.total = 0
        return
      }

      loading.value = true
      try {
        const params = {
          shop_id: taskForm.shop_id,
          page: pagination.page,
          page_size: pagination.page_size
        }
        if (filterStatus.value) {
          params.status = filterStatus.value
        }
        if (filterInboundPlanId.value) {
          params.inbound_plan_id = filterInboundPlanId.value
        }

        const response = await getLabelOrganizeTasks(params)
        if (response.data.status === 'success') {
          const data = response.data.data || {}
          tasks.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 10

          // 启动/停止轮询
          syncPolling()
        } else {
          ElMessage.error(response.data.message || '获取任务列表失败')
        }
      } catch (error) {
        console.error('获取任务列表失败:', error)
        ElMessage.error('获取任务列表失败')
      } finally {
        loading.value = false
      }
    }

    // 同步轮询状态
    const syncPolling = () => {
      const activeStatuses = ['pending', 'running']
      const activeTaskIds = new Set()

      tasks.value.forEach(task => {
        if (activeStatuses.includes(task.status)) {
          activeTaskIds.add(task.id)
          if (!pollTimers.value.has(task.id)) {
            startPolling(task.id)
          }
        }
      })

      // 停止对已完成的任务轮询
      pollTimers.value.forEach((timer, taskId) => {
        if (!activeTaskIds.has(taskId)) {
          clearInterval(timer)
          pollTimers.value.delete(taskId)
        }
      })
    }

    // 启动单个任务轮询
    const startPolling = (taskId) => {
      if (pollTimers.value.has(taskId)) return

      const timer = setInterval(async () => {
        try {
          const response = await getLabelOrganizeTaskDetail(taskId)
          if (response.data.status === 'success') {
            const task = response.data.data
            // 更新列表中对应任务
            const index = tasks.value.findIndex(t => t.id === taskId)
            if (index !== -1) {
              tasks.value[index] = { ...tasks.value[index], ...task }
            }

            // 如果任务已结束，停止轮询
            if (['completed', 'failed', 'cancelled'].includes(task.status)) {
              clearInterval(pollTimers.value.get(taskId))
              pollTimers.value.delete(taskId)
              // 如果是完成状态，刷新一下获取 download_url
              if (task.status === 'completed') {
                fetchTasks()
              }
            }
          }
        } catch (error) {
          console.error('轮询任务进度失败:', error)
        }
      }, 3000)

      pollTimers.value.set(taskId, timer)
    }

    // 停止所有轮询
    const stopAllPolling = () => {
      pollTimers.value.forEach((timer) => {
        clearInterval(timer)
      })
      pollTimers.value.clear()
    }

    // 清货代箱唛文件
    const clearCargoAgentFile = () => {
      cargoAgentFileList.value = []
      if (uploadRef.value) {
        uploadRef.value.clearFiles()
      }
    }

    // 创建任务
    const handleCreateTask = () => {
      taskFormRef.value.validate(async (valid) => {
        if (!valid) return

        submitting.value = true
        try {
          // 校验：上传了箱唛必须选择货代
          if (cargoAgentFileList.value.length > 0 && !taskForm.logistics_provider_id) {
            ElMessage.warning('上传了货代箱唛，必须选择货代')
            submitting.value = false
            return
          }

          const formData = new FormData()
          formData.append('shop_id', String(taskForm.shop_id))
          formData.append('inbound_plan_id', taskForm.inbound_plan_id.trim())

          const cropConfig = taskForm.crop_preset === 'default'
            ? { x_ratio: [0, 1], y_ratio: [0, 0.667] }
            : { x_ratio: [0, 1], y_ratio: [0, 1] }
          formData.append('crop_config', JSON.stringify(cropConfig))

          if (cargoAgentFileList.value.length > 0 && cargoAgentFileList.value[0].raw) {
            formData.append('cargo_agent_zip', cargoAgentFileList.value[0].raw)
          }

          if (taskForm.logistics_provider_id) {
            formData.append('logistics_provider_id', String(taskForm.logistics_provider_id))
          }

          const response = await createLabelOrganizeTask(formData)
          if (response.data.status === 'success') {
            ElMessage.success(response.data.message || '任务已提交')
            taskForm.inbound_plan_id = ''
            taskForm.logistics_provider_id = null
            clearCargoAgentFile()
            pagination.page = 1
            fetchTasks()
          } else {
            ElMessage.error(response.data.message || '任务提交失败')
          }
        } catch (error) {
          console.error('创建任务失败:', error)
          ElMessage.error('创建任务失败: ' + (error.response?.data?.message || error.message))
        } finally {
          submitting.value = false
        }
      })
    }

    // 下载结果
    const handleDownload = async (row) => {
      try {
        const response = await downloadLabelOrganizeResult(row.id)
        const blob = new Blob([response.data], { type: 'application/zip' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${row.inbound_plan_id}_labels.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        ElMessage.success('开始下载')
      } catch (error) {
        console.error('下载失败:', error)
        ElMessage.error('下载失败')
      }
    }

    // 取消任务
    const handleCancel = async (row) => {
      try {
        await ElMessageBox.confirm('确定要取消该任务吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        const response = await cancelLabelOrganizeTask(row.id)
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '任务已取消')
          fetchTasks()
        } else {
          ElMessage.error(response.data.message || '取消失败')
        }
      } catch (error) {
        if (error === 'cancel') return
        console.error('取消任务失败:', error)
        ElMessage.error('取消任务失败: ' + (error.response?.data?.message || error.message))
      }
    }

    // 删除任务
    const handleDelete = async (row) => {
      try {
        await ElMessageBox.confirm('确定要删除该任务吗？相关文件也会被清理。', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        const response = await deleteLabelOrganizeTask(row.id)
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '任务已删除')
          // 停止该任务的轮询
          if (pollTimers.value.has(row.id)) {
            clearInterval(pollTimers.value.get(row.id))
            pollTimers.value.delete(row.id)
          }
          fetchTasks()
        } else {
          ElMessage.error(response.data.message || '删除失败')
        }
      } catch (error) {
        if (error === 'cancel') return
        console.error('删除任务失败:', error)
        ElMessage.error('删除任务失败: ' + (error.response?.data?.message || error.message))
      }
    }

    // 重试任务
    const handleRetry = async (row) => {
      try {
        const response = await retryLabelOrganizeTask(row.id)
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '任务已重新提交')
          fetchTasks()
        } else {
          ElMessage.error(response.data.message || '重试失败')
        }
      } catch (error) {
        console.error('重试任务失败:', error)
        ElMessage.error('重试任务失败: ' + (error.response?.data?.message || error.message))
      }
    }

    // 筛选变化
    const handleFilterChange = () => {
      pagination.page = 1
      fetchTasks()
    }

    // 分页变化
    const handlePageChange = (page) => {
      pagination.page = page
      fetchTasks()
    }

    // 每页数量变化
    const handleSizeChange = (size) => {
      pagination.page_size = size
      pagination.page = 1
      fetchTasks()
    }

    // 状态样式
    const getStatusType = (status) => {
      const typeMap = {
        pending: 'info',
        running: 'primary',
        completed: 'success',
        failed: 'danger',
        cancelled: 'warning'
      }
      return typeMap[status] || 'info'
    }

    const getStatusText = (status) => {
      const textMap = {
        pending: '待执行',
        running: '执行中',
        completed: '已完成',
        failed: '已失败',
        cancelled: '已取消'
      }
      return textMap[status] || status
    }

    const getProgressStatus = (status) => {
      if (status === 'failed') return 'exception'
      if (status === 'completed') return 'success'
      return ''
    }

    // 切换店铺
    const handleShopChange = async (val) => {
      if (val === '__refresh__') {
        await refreshShopList()
        taskForm.shop_id = defaultShopId()
      }
      taskForm.inbound_plan_id = ''
      taskForm.logistics_provider_id = null
      filterInboundPlanId.value = ''
      pagination.page = 1
      await fetchInboundPlans()
      fetchTasks()
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return dateString.replace('T', ' ')
    }

    onMounted(async () => {
      await fetchShopList()
      fetchLogisticsProviders()
      if (shopList.value.length > 0) {
        taskForm.shop_id = defaultShopId()
        await fetchInboundPlans()
        fetchTasks()
      }
    })

    onUnmounted(() => {
      stopAllPolling()
    })

    return {
      shopList,
      loading,
      submitting,
      tasks,
      filterStatus,
      filterInboundPlanId,
      inboundPlans,
      inboundPlansLoading,
      logisticsProviders,
      logisticsProvidersLoading,
      taskForm,
      taskFormRef,
      taskRules,
      pagination,
      fetchTasks,
      handleCreateTask,
      handleDownload,
      handleCancel,
      handleDelete,
      handleRetry,
      handleShopChange,
      handleFilterChange,
      handlePageChange,
      handleSizeChange,
      getStatusType,
      getStatusText,
      getProgressStatus,
      formatDate,
      fetchInboundPlans,
      fetchLogisticsProviders,
      cargoAgentFileList,
      uploadRef,
      clearCargoAgentFile,
      Plus,
      Refresh,
      RefreshRight,
      Download,
      Delete,
      CircleClose,
      Upload
    }
  }
}
</script>

<style scoped>
.label-organize-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
}

.page-subtitle {
  font-size: 14px;
  color: #888;
  margin: 0;
}

.form-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.task-form-body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.task-form-fields {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 16px 12px;
  align-items: flex-start;
}

.task-form-submit {
  display: flex;
  align-items: center;
  padding-top: 32px;
  flex-shrink: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0 0 20px 0;
}

.table-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.table-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 响应式 */
@media (max-width: 768px) {
  .label-organize-page {
    padding: 12px;
  }

  .page-title {
    font-size: 20px;
  }

  .task-form-body {
    flex-direction: column;
  }

  .task-form-submit {
    padding-top: 0;
    width: 100%;
    justify-content: flex-end;
  }

  .table-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>
