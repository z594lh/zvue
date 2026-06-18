<template>
  <div class="waybill-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <el-icon size="28" style="margin-right:8px;vertical-align:middle;color:#667eea;"><MapLocation /></el-icon>
          货代运单管理
        </h1>
        <p class="page-subtitle">管理货代运单，跟踪物流运输状态与费用</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="handleImportClick">
          <el-icon><UploadFilled /></el-icon>
          导入运单
        </el-button>
        <el-button type="success" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          新增运单
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group">
        <el-input
          v-model="searchForm.waybill_no"
          placeholder="货代运单号"
          clearable
          style="width: 180px"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select
          v-model="searchForm.provider_id"
          placeholder="货代"
          clearable
          filterable
          style="width: 160px"
        >
          <el-option
            v-for="p in providerOptions"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </el-select>
        <el-select
          v-model="searchForm.transport_type"
          placeholder="运输方式"
          clearable
          style="width: 130px"
        >
          <el-option label="全部" value="" />
          <el-option label="海运" :value="1" />
          <el-option label="空运" :value="2" />
          <el-option label="快递" :value="3" />
          <el-option label="铁路" :value="4" />
          <el-option label="卡航" :value="5" />
        </el-select>
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
          style="width: 120px"
        >
          <el-option label="全部" value="" />
          <el-option label="待发货" :value="0" />
          <el-option label="运输中" :value="1" />
          <el-option label="已到港" :value="2" />
          <el-option label="已清关" :value="3" />
          <el-option label="已入仓" :value="4" />
          <el-option label="已完成" :value="5" />
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
        <el-select v-model="batchStatusValue" placeholder="修改状态" style="width: 130px" size="small">
          <el-option label="待发货" :value="0" />
          <el-option label="运输中" :value="1" />
          <el-option label="已到港" :value="2" />
          <el-option label="已清关" :value="3" />
          <el-option label="已入仓" :value="4" />
          <el-option label="已完成" :value="5" />
        </el-select>
        <el-button type="primary" size="small" :loading="batchLoading" :disabled="batchStatusValue === ''" @click="handleBatchStatus">
          批量修改状态
        </el-button>
        <el-button size="small" @click="tableRef?.clearSelection?.()">取消选择</el-button>
      </div>

      <el-table
        ref="tableRef"
        :data="waybillList"
        v-loading="loading"
        style="width: 100%"
        height="calc(100vh - 296px)"
        row-class-name="waybill-row"
        :header-cell-style="{background:'#f8f9fa',color:'#555',fontWeight:600}"
        :cell-style="{padding:'10px 0'}"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="waybill_no" label="运单号" width="150">
          <template #default="scope">
            <span style="font-family:monospace;font-size:13px;font-weight:500;color:#1a1a2e;">{{ scope.row.waybill_no }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="provider_name" label="货代" width="130">
          <template #default="scope">
            <span style="font-weight:500;color:#1a1a2e;">{{ scope.row.provider_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="shipment_id" label="亚马逊货件" width="120" show-overflow-tooltip>
          <template #default="scope">
            <span style="font-family:monospace;font-size:12px;color:#888;">{{ scope.row.shipment_id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="货件SKU" min-width="280">
          <template #default="scope">
            <div class="sku-items" v-if="scope.row.items && scope.row.items.length > 0">
              <div v-for="(item, idx) in scope.row.items" :key="idx" class="sku-item">
                <span class="sku-code">{{ item.seller_sku }}</span>
                <span v-if="item.product_name" class="sku-name"> - {{ item.product_name }}</span>
                <span class="sku-qty"> x{{ item.quantity }}</span>
              </div>
            </div>
            <span v-else style="color:#ccc;">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small" effect="dark" round>
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="transport_type" label="运输方式" width="80" align="center">
          <template #default="scope">
            <el-tag size="small" effect="plain">{{ getTransportTypeText(scope.row.transport_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="destination_warehouse" label="目的仓库" width="100">
          <template #default="scope">
            <el-tag v-if="scope.row.destination_warehouse" size="small" effect="plain" type="info">{{ scope.row.destination_warehouse }}</el-tag>
            <span v-else style="color:#bbb;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="route_name" label="线路" width="120">
          <template #default="scope">
            <span style="color:#888;font-size:13px;">{{ scope.row.route_name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_cartons" label="箱数" width="80" align="right">
          <template #default="scope">
            <span class="qty-total">{{ scope.row.total_cartons }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_cost_cny" label="总费用" width="110" align="right">
          <template #default="scope">
            <span class="amount-total">{{ formatAmount(scope.row.total_cost_cny) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_weight_kg" label="重量(kg)" width="100" align="right">
          <template #default="scope">
            <span style="color:#555;font-size:13px;">{{ scope.row.total_weight_kg }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_volume_cbm" label="体积(m³)" width="100" align="right">
          <template #default="scope">
            <span style="color:#555;font-size:13px;">{{ scope.row.total_volume_cbm }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="departure_port" label="起运港" width="100">
          <template #default="scope">
            <span style="color:#888;font-size:13px;">{{ scope.row.departure_port }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="destination_port" label="目的港" width="100">
          <template #default="scope">
            <span style="color:#888;font-size:13px;">{{ scope.row.destination_port }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="ship_date" label="发货日期" width="110" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ scope.row.ship_date }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="eta_date" label="预计到港" width="110" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ scope.row.eta_date }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="arrival_date" label="实际到港" width="110" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ scope.row.arrival_date }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="delivery_date" label="实际入仓" width="110" align="center">
          <template #default="scope">
            <span style="font-size:12px;color:#888;font-family:monospace;">{{ scope.row.delivery_date }}</span>
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

    <!-- 导入运单对话框 -->
    <el-dialog v-model="importDialogVisible" title="导入运单" width="460px" align-center :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="货代" required>
          <el-select
            v-model="importProviderId"
            placeholder="选择货代"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="p in providerOptions"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文件" required>
          <el-upload
            ref="uploadRef"
            drag
            action="#"
            :auto-upload="false"
            :on-change="handleImportFileChange"
            :limit="1"
            accept=".xlsx,.xls"
            style="width: 100%"
          >
            <el-icon class="el-icon--upload" size="40"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖拽文件到此处或 <em>点击上传</em></div>
            <template #tip>
              <div class="el-upload__tip">支持 .xlsx / .xls 格式</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitImport" :loading="importLoading">确定导入</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑运单' : '新增运单'"
      width="720px"
      :destroy-on-close="true"
      :close-on-click-modal="false"
      align-center
    >
      <el-form :model="formData" label-width="100px" :rules="formRules" ref="formRef" v-loading="editLoading">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="货代" prop="provider_id">
              <el-select
                v-model="formData.provider_id"
                placeholder="选择货代"
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="p in providerOptions"
                  :key="p.id"
                  :label="p.name"
                  :value="p.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="亚马逊货件" prop="shipment_id">
              <el-select
                v-model="formData.shipment_id"
                placeholder="选择货件（WORKING/SHIPPED）"
                clearable
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="s in shipmentOptions"
                  :key="s.shipment_id"
                  :label="`${s.shipment_id}${s.shipment_name ? ' - ' + s.shipment_name : ''}${s.destination_fulfillment_center_id ? ' [' + s.destination_fulfillment_center_id + ']' : ''}`"
                  :value="s.shipment_id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="运单号" prop="waybill_no">
              <el-input v-model="formData.waybill_no" placeholder="货代给的单号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="运输方式" prop="transport_type">
              <el-select v-model="formData.transport_type" placeholder="选择运输方式" style="width: 100%">
                <el-option label="海运" :value="1" />
                <el-option label="空运" :value="2" />
                <el-option label="快递" :value="3" />
                <el-option label="铁路" :value="4" />
                <el-option label="卡航" :value="5" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="线路名称" prop="route_name">
              <el-input v-model="formData.route_name" placeholder="如：美森正班/盐田EMC" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="formData.status" placeholder="选择状态" style="width: 100%">
                <el-option label="待发货" :value="0" />
                <el-option label="运输中" :value="1" />
                <el-option label="已到港" :value="2" />
                <el-option label="已清关" :value="3" />
                <el-option label="已入仓" :value="4" />
                <el-option label="已完成" :value="5" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="起运港" prop="departure_port">
              <el-input v-model="formData.departure_port" placeholder="起运港" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目的港" prop="destination_port">
              <el-input v-model="formData.destination_port" placeholder="目的港" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="目的仓库" prop="destination_warehouse">
              <el-input v-model="formData.destination_warehouse" placeholder="亚马逊仓库代码" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="追踪链接" prop="tracking_url">
              <el-input v-model="formData.tracking_url" placeholder="货代追踪链接" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="总重量(kg)" prop="total_weight_kg">
              <el-input-number
                v-model="formData.total_weight_kg"
                :min="0"
                :precision="3"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="体积(m³)" prop="total_volume_cbm">
              <el-input-number
                v-model="formData.total_volume_cbm"
                :min="0"
                :precision="3"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="总箱数" prop="total_cartons">
              <el-input-number
                v-model="formData.total_cartons"
                :min="0"
                :precision="0"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="运费" prop="freight_cost_cny">
              <el-input-number
                v-model="formData.freight_cost_cny"
                :min="0"
                :precision="2"
                style="width: 100%"
                @change="calcTotalCost"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="税费" prop="tax_cost_cny">
              <el-input-number
                v-model="formData.tax_cost_cny"
                :min="0"
                :precision="2"
                style="width: 100%"
                @change="calcTotalCost"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="杂费" prop="misc_cost_cny">
              <el-input-number
                v-model="formData.misc_cost_cny"
                :min="0"
                :precision="2"
                style="width: 100%"
                @change="calcTotalCost"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="总费用" prop="total_cost_cny">
              <el-input-number
                v-model="formData.total_cost_cny"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="每公斤单价" prop="cost_per_kg">
              <el-input-number
                v-model="formData.cost_per_kg"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="发货日期" prop="ship_date">
              <el-date-picker
                v-model="formData.ship_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预计到港" prop="eta_date">
              <el-date-picker
                v-model="formData.eta_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="实际到港" prop="arrival_date">
              <el-date-picker
                v-model="formData.arrival_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="实际入仓" prop="delivery_date">
              <el-date-picker
                v-model="formData.delivery_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

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
import { Search, Refresh, Plus, MapLocation, UploadFilled } from '@element-plus/icons-vue'
import {
  getLogisticsProviderOptions,
  getLogisticsWaybills,
  createLogisticsWaybill,
  updateLogisticsWaybill,
  deleteLogisticsWaybill,
  batchUpdateLogisticsWaybillStatus,
  getShipmentOptions,
  importLogisticsWaybills
} from '@/services/api.js'

export default {
  name: 'LogisticsWaybillView',
  components: {
    Search,
    Refresh,
    Plus,
    MapLocation,
    UploadFilled
  },
  setup() {
    const loading = ref(false)
    const submitLoading = ref(false)
    const editLoading = ref(false)
    const dialogVisible = ref(false)
    const importDialogVisible = ref(false)
    const importLoading = ref(false)
    const isEdit = ref(false)
    const formRef = ref(null)
    const tableRef = ref(null)
    const waybillList = ref([])
    const selectedRows = ref([])
    const batchStatusValue = ref('')
    const batchLoading = ref(false)
    const providerOptions = ref([])
    const shipmentOptions = ref([])
    const importProviderId = ref(null)
    const importFile = ref(null)
    const uploadRef = ref(null)

    const { initFromQuery, syncQuery, watchQuery } = useListQuerySync({
      page: { get: () => pagination.page, set: v => pagination.page = v, type: 'number', default: 1 },
      page_size: { get: () => pagination.page_size, set: v => pagination.page_size = v, type: 'number', default: 20 },
      waybill_no: { get: () => searchForm.waybill_no, set: v => searchForm.waybill_no = v },
      provider_id: { get: () => searchForm.provider_id, set: v => searchForm.provider_id = v ? Number(v) : null, type: 'number' },
      transport_type: { get: () => searchForm.transport_type, set: v => searchForm.transport_type = v },
      status: { get: () => searchForm.status, set: v => searchForm.status = v }
    })

    const searchForm = reactive({
      waybill_no: '',
      provider_id: null,
      transport_type: '',
      status: ''
    })

    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    const formData = reactive({
      id: null,
      waybill_no: '',
      provider_id: null,
      shipment_id: '',
      transport_type: null,
      route_name: '',
      departure_port: '',
      destination_port: '',
      destination_warehouse: '',
      total_weight_kg: 0,
      total_volume_cbm: 0,
      total_cartons: 0,
      freight_cost_cny: 0,
      tax_cost_cny: 0,
      misc_cost_cny: 0,
      total_cost_cny: 0,
      cost_per_kg: 0,
      status: 0,
      ship_date: '',
      eta_date: '',
      arrival_date: '',
      delivery_date: '',
      tracking_url: '',
      remark: ''
    })

    const formRules = {
      provider_id: [{ required: true, message: '请选择货代', trigger: 'change' }],
      shipment_id: [{ required: true, message: '请选择货件', trigger: 'change' }]
    }

    const fetchProviderOptions = async () => {
      try {
        const response = await getLogisticsProviderOptions()
        if (response.data.status === 'success') {
          providerOptions.value = response.data.data || []
        }
      } catch (error) {
        console.error('获取货代列表失败:', error)
      }
    }

    const fetchShipmentOptions = async () => {
      try {
        const response = await getShipmentOptions()
        if (response.data.status === 'success') {
          shipmentOptions.value = response.data.data || []
        } else {
          shipmentOptions.value = []
        }
      } catch (error) {
        console.error('获取可用货件列表失败:', error)
        shipmentOptions.value = []
      }
    }

    const fetchList = async () => {
      syncQuery()
      loading.value = true
      try {
        const params = {
          page: pagination.page,
          page_size: pagination.page_size
        }
        if (searchForm.waybill_no) params.waybill_no = searchForm.waybill_no
        if (searchForm.provider_id) params.provider_id = searchForm.provider_id
        if (searchForm.transport_type !== '') params.transport_type = searchForm.transport_type
        if (searchForm.status !== '') params.status = searchForm.status

        const response = await getLogisticsWaybills(params)
        if (response.data.status === 'success') {
          const data = response.data.data || {}
          waybillList.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取运单列表失败')
          waybillList.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取运单列表失败:', error)
        ElMessage.error('获取运单列表失败: ' + (error.response?.data?.message || error.message))
        waybillList.value = []
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
      searchForm.waybill_no = ''
      searchForm.provider_id = null
      searchForm.transport_type = ''
      searchForm.status = ''
      pagination.page = 1
      fetchList()
    }

    const resetForm = () => {
      formData.id = null
      formData.waybill_no = ''
      formData.provider_id = null
      formData.shipment_id = ''
      formData.transport_type = null
      formData.route_name = ''
      formData.departure_port = ''
      formData.destination_port = ''
      formData.destination_warehouse = ''
      formData.total_weight_kg = 0
      formData.total_volume_cbm = 0
      formData.total_cartons = 0
      formData.freight_cost_cny = 0
      formData.tax_cost_cny = 0
      formData.misc_cost_cny = 0
      formData.total_cost_cny = 0
      formData.cost_per_kg = 0
      formData.status = 0
      formData.ship_date = ''
      formData.eta_date = ''
      formData.arrival_date = ''
      formData.delivery_date = ''
      formData.tracking_url = ''
      formData.remark = ''
    }

    const handleCreate = () => {
      isEdit.value = false
      resetForm()
      fetchShipmentOptions()
      dialogVisible.value = true
    }

    const handleEdit = async (row) => {
      isEdit.value = true
      resetForm()
      editLoading.value = true
      dialogVisible.value = true
      formData.id = row.id
      formData.waybill_no = row.waybill_no || ''
      formData.provider_id = row.provider_id
      formData.shipment_id = row.shipment_id || ''
      formData.transport_type = row.transport_type ?? null
      formData.route_name = row.route_name || ''
      formData.departure_port = row.departure_port || ''
      formData.destination_port = row.destination_port || ''
      formData.destination_warehouse = row.destination_warehouse || ''
      formData.total_weight_kg = row.total_weight_kg || 0
      formData.total_volume_cbm = row.total_volume_cbm || 0
      formData.total_cartons = row.total_cartons || 0
      formData.freight_cost_cny = row.freight_cost_cny || 0
      formData.tax_cost_cny = row.tax_cost_cny || 0
      formData.misc_cost_cny = row.misc_cost_cny || 0
      formData.total_cost_cny = row.total_cost_cny || 0
      formData.cost_per_kg = row.cost_per_kg || 0
      formData.status = row.status ?? 0
      formData.ship_date = row.ship_date || ''
      formData.eta_date = row.eta_date || ''
      formData.arrival_date = row.arrival_date || ''
      formData.delivery_date = row.delivery_date || ''
      formData.tracking_url = row.tracking_url || ''
      formData.remark = row.remark || ''
      await fetchShipmentOptions()
      editLoading.value = false
    }

    const handleDelete = (row) => {
      ElMessageBox.confirm(`确定删除该运单吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await deleteLogisticsWaybill(row.id)
          if (response.data.status === 'success') {
            ElMessage.success('删除成功')
            await fetchList()
          } else {
            ElMessage.error(response.data.message || '删除失败')
          }
        } catch (error) {
          console.error('删除运单失败:', error)
          ElMessage.error('删除失败: ' + (error.response?.data?.message || error.message))
        }
      }).catch(() => {})
    }

    const calcTotalCost = () => {
      formData.total_cost_cny = Number(formData.freight_cost_cny || 0)
        + Number(formData.tax_cost_cny || 0)
        + Number(formData.misc_cost_cny || 0)
    }

    const handleSubmit = async () => {
      const valid = await formRef.value?.validate().catch(() => false)
      if (!valid) return

      submitLoading.value = true
      try {
        const payload = {
          waybill_no: formData.waybill_no,
          provider_id: formData.provider_id,
          shipment_id: formData.shipment_id || null,
          transport_type: formData.transport_type,
          route_name: formData.route_name,
          departure_port: formData.departure_port,
          destination_port: formData.destination_port,
          destination_warehouse: formData.destination_warehouse,
          total_weight_kg: formData.total_weight_kg,
          total_volume_cbm: formData.total_volume_cbm,
          total_cartons: formData.total_cartons,
          freight_cost_cny: formData.freight_cost_cny,
          tax_cost_cny: formData.tax_cost_cny,
          misc_cost_cny: formData.misc_cost_cny,
          total_cost_cny: formData.total_cost_cny,
          cost_per_kg: formData.cost_per_kg,
          status: formData.status,
          ship_date: formData.ship_date,
          eta_date: formData.eta_date,
          arrival_date: formData.arrival_date,
          delivery_date: formData.delivery_date,
          tracking_url: formData.tracking_url,
          remark: formData.remark
        }

        let response
        if (isEdit.value) {
          response = await updateLogisticsWaybill(formData.id, payload)
        } else {
          response = await createLogisticsWaybill(payload)
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

    const handleImportClick = () => {
      importDialogVisible.value = true
      importProviderId.value = null
      importFile.value = null
      uploadRef.value?.clearFiles?.()
    }

    const handleImportFileChange = (file) => {
      importFile.value = file.raw
    }

    const submitImport = async () => {
      if (!importProviderId.value) {
        ElMessage.warning('请选择货代')
        return
      }
      if (!importFile.value) {
        ElMessage.warning('请选择要导入的 Excel 文件')
        return
      }
      importLoading.value = true
      try {
        const fd = new FormData()
        fd.append('file', importFile.value)
        fd.append('provider_id', importProviderId.value)
        const response = await importLogisticsWaybills(fd)
        if (response.data.status === 'success') {
          ElMessage.success(response.data.message || '导入成功')
          importDialogVisible.value = false
          await fetchList()
        } else {
          ElMessage.error(response.data.message || '导入失败')
        }
      } catch (error) {
        console.error('导入失败:', error)
        ElMessage.error('导入失败: ' + (error.response?.data?.message || error.message))
      } finally {
        importLoading.value = false
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
        const response = await batchUpdateLogisticsWaybillStatus({
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

    const getTransportTypeText = (type) => {
      const map = { 1: '海运', 2: '空运', 3: '快递', 4: '铁路', 5: '卡航' }
      return map[type] || type
    }

    const getStatusType = (status) => {
      const map = { 0: 'info', 1: 'primary', 2: 'warning', 3: 'success', 4: 'success', 5: 'success' }
      return map[status] || 'info'
    }

    const getStatusText = (status) => {
      const map = { 0: '待发货', 1: '运输中', 2: '已到港', 3: '已清关', 4: '已入仓', 5: '已完成' }
      return map[status] || status
    }

    watchQuery(() => fetchList())

    onMounted(() => {
      initFromQuery()
      fetchProviderOptions()
      fetchShipmentOptions()
      fetchList()
    })

    return {
      loading,
      submitLoading,
      editLoading,
      dialogVisible,
      importDialogVisible,
      importLoading,
      isEdit,
      formRef,
      tableRef,
      uploadRef,
      waybillList,
      selectedRows,
      batchStatusValue,
      batchLoading,
      providerOptions,
      shipmentOptions,
      searchForm,
      pagination,
      formData,
      formRules,
      importProviderId,
      importFile,
      handleSearch,
      resetSearch,
      handleCreate,
      handleEdit,
      handleDelete,
      handleSubmit,
      handleImportClick,
      handleImportFileChange,
      submitImport,
      handlePageChange,
      handleSizeChange,
      handleSelectionChange,
      handleBatchStatus,
      formatAmount,
      getTransportTypeText,
      getStatusType,
      getStatusText,
      calcTotalCost
    }
  }
}
</script>

<style scoped>
.waybill-page {
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
:deep(.waybill-row:hover) { background-color: #fafbff !important; }

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

.qty-total { color: #1a1a2e; font-weight: 700; font-size: 14px; }

.sku-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}
.sku-item {
  font-size: 12px;
  line-height: 1.5;
}
.sku-code {
  color: #1a1a2e;
  font-family: monospace;
  font-weight: 500;
}
.sku-name {
  color: #666;
}
.sku-qty {
  color: #909399;
  font-family: monospace;
}

/* 分页 */
.pagination-wrap {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .waybill-page {
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
