<template>
  <div class="shop-page">
    <div class="page-header">
      <h1 class="page-title">店铺管理</h1>
      <p class="page-subtitle">管理亚马逊店铺配置，支持多店铺切换</p>
    </div>

    <!-- 操作栏 -->
    <div class="search-card">
      <div class="search-form">
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增店铺
        </el-button>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="content-card">
      <div class="card-header">
        <h3 class="section-title">店铺列表</h3>
      </div>

      <el-table :data="shopList" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="70" align="center" />

        <el-table-column prop="shop_name" label="店铺名称" min-width="160" show-overflow-tooltip />

        <el-table-column prop="seller_id" label="Seller ID" min-width="140" show-overflow-tooltip />

        <el-table-column prop="marketplace_id" label="Marketplace ID" width="150" show-overflow-tooltip />

        <el-table-column prop="region" label="区域" width="80" align="center">
          <template #default="scope">
            <el-tag :type="getRegionType(scope.row.region)" size="small">
              {{ scope.row.region?.toUpperCase() || '-' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="is_default" label="默认" width="80" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.is_default === 1" type="success" size="small">默认</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.status === 1" type="success" size="small">启用</el-tag>
            <el-tag v-else type="info" size="small">禁用</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="created_at" label="创建时间" width="160" align="center">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="openDialog(scope.row)">
              编辑
            </el-button>
            <el-button
              v-if="scope.row.is_default !== 1 && scope.row.status === 1"
              type="success"
              link
              size="small"
              @click="handleSetDefault(scope.row)"
            >
              设为默认
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(scope.row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑店铺' : '新增店铺'"
      width="600px"
      :destroy-on-close="true"
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
        class="shop-form"
      >
        <el-form-item label="店铺名称" prop="shop_name">
          <el-input v-model="formData.shop_name" placeholder="如：美国主店" />
        </el-form-item>

        <el-form-item label="Seller ID" prop="seller_id">
          <template #label>
            <el-tooltip placement="top">
              <template #content>
                <div style="max-width: 280px">
                  登录亚马逊卖家后台，在【设置 > 账户信息 > 卖家记号】中查看，<br>通常以 A 开头，如 A1B2C3D4E5F6G7
                </div>
              </template>
              <span>Seller ID <el-icon style="vertical-align: middle"><QuestionFilled /></el-icon></span>
            </el-tooltip>
          </template>
          <el-input v-model="formData.seller_id" placeholder="如：A1B2C3D4E5F6G7" />
        </el-form-item>

        <el-form-item label="Refresh Token" prop="refresh_token">
          <template #label>
            <el-tooltip placement="top">
              <template #content>
                <div style="max-width: 320px">
                  在亚马逊开发者控制台或授权应用中获取，<br>用于调用 SP-API 接口，<br>格式为一串很长的字符串，<br>建议通过【应用 & 服务 > 管理您的应用】授权后复制
                </div>
              </template>
              <span>Refresh Token <el-icon style="vertical-align: middle"><QuestionFilled /></el-icon></span>
            </el-tooltip>
          </template>
          <el-input
            v-model="formData.refresh_token"
            type="textarea"
            :rows="3"
            placeholder="亚马逊 SP-API Refresh Token（很长的字符串）"
          />
        </el-form-item>

        <el-form-item label="Marketplace ID" prop="marketplace_id">
          <template #label>
            <el-tooltip placement="top">
              <template #content>
                <div style="max-width: 280px">
                  登录卖家后台，点击右上角站点切换下拉，<br>当前所在站点的 Marketplace ID 会自动显示在 URL 中，<br>或在【设置 > 账户信息 > 商城】中查看
                </div>
              </template>
              <span>Marketplace ID <el-icon style="vertical-align: middle"><QuestionFilled /></el-icon></span>
            </el-tooltip>
          </template>
          <el-select
            v-model="formData.marketplace_id"
            placeholder="选择站点"
            style="width: 100%"
            @change="onMarketplaceChange"
          >
            <el-option-group label="北美 (na)">
              <el-option v-for="item in marketplaceOptions.na" :key="item.id" :label="item.label" :value="item.id" />
            </el-option-group>
            <el-option-group label="欧洲 (eu)">
              <el-option v-for="item in marketplaceOptions.eu" :key="item.id" :label="item.label" :value="item.id" />
            </el-option-group>
            <el-option-group label="远东 (fe)">
              <el-option v-for="item in marketplaceOptions.fe" :key="item.id" :label="item.label" :value="item.id" />
            </el-option-group>
          </el-select>
        </el-form-item>

        <el-form-item label="区域" prop="region">
          <template #label>
            <el-tooltip placement="top">
              <template #content>
                <div style="max-width: 260px">
                  根据 Marketplace ID 自动关联：<br>
                  na = 北美（美/加/墨/巴西）<br>
                  eu = 欧洲（英/德/法/意/西等）<br>
                  fe = 远东（日/澳/印/阿联酋等）
                </div>
              </template>
              <span>区域 <el-icon style="vertical-align: middle"><QuestionFilled /></el-icon></span>
            </el-tooltip>
          </template>
          <el-select v-model="formData.region" placeholder="选择区域" style="width: 100%">
            <el-option label="北美 (na)" value="na" />
            <el-option label="欧洲 (eu)" value="eu" />
            <el-option label="远东 (fe)" value="fe" />
          </el-select>
        </el-form-item>

        <el-form-item label="设为默认">
          <el-switch v-model="formData.is_default" :active-value="1" :inactive-value="0" />
          <span class="form-tip">开启后自动取消其他店铺的默认状态</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, QuestionFilled } from '@element-plus/icons-vue'
import {
  getAllShops,
  createShop,
  updateShop,
  deleteShop,
  setDefaultShop
} from '@/services/api.js'

export default {
  name: 'ShopView',
  components: {
    Plus,
    QuestionFilled
  },
  setup() {
    const loading = ref(false)
    const shopList = ref([])
    const dialogVisible = ref(false)
    const submitLoading = ref(false)
    const isEdit = ref(false)
    const currentId = ref(null)
    const formRef = ref(null)

    const formData = reactive({
      shop_name: '',
      seller_id: '',
      refresh_token: '',
      marketplace_id: '',
      region: '',
      is_default: 0
    })

    const marketplaceOptions = {
      na: [
        { id: 'ATVPDKIKX0DER', label: '美国 (US)' },
        { id: 'A2EUQ1WTGCTBG2', label: '加拿大 (CA)' },
        { id: 'A1AM78C64UM0Y8', label: '墨西哥 (MX)' },
        { id: 'A2Q3Y263D00KWC', label: '巴西 (BR)' }
      ],
      eu: [
        { id: 'A1F83G8C2ARO7P', label: '英国 (UK)' },
        { id: 'A1PA6795UKMFR9', label: '德国 (DE)' },
        { id: 'A13V1IB3VIYZZH', label: '法国 (FR)' },
        { id: 'APJ6JRA9NG5V4', label: '意大利 (IT)' },
        { id: 'A1RKKUPIHCS9HS', label: '西班牙 (ES)' },
        { id: 'A1805IZSGTT6HS', label: '荷兰 (NL)' },
        { id: 'A2NODRKZP88ZB9', label: '瑞典 (SE)' },
        { id: 'A17E79C6D8DWNP', label: '波兰 (PL)' }
      ],
      fe: [
        { id: 'A1VC38T7YXB528', label: '日本 (JP)' },
        { id: 'A19VAU5U5O7RUS', label: '澳大利亚 (AU)' },
        { id: 'A21TJRUUN4KGV', label: '印度 (IN)' },
        { id: 'A39IBJ37TRP1C6', label: '阿联酋 (AE)' },
        { id: 'A2VIGQ35RCS4UG', label: '沙特阿拉伯 (SA)' },
        { id: 'A1C3SOZRARQ6R3', label: '新加坡 (SG)' }
      ]
    }

    const marketplaceToRegion = (marketplaceId) => {
      for (const region of ['na', 'eu', 'fe']) {
        if (marketplaceOptions[region].some(m => m.id === marketplaceId)) {
          return region
        }
      }
      return ''
    }

    const onMarketplaceChange = (val) => {
      const region = marketplaceToRegion(val)
      if (region) {
        formData.region = region
      }
    }

    const formRules = {
      shop_name: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }],
      seller_id: [{ required: true, message: '请输入 Seller ID', trigger: 'blur' }],
      refresh_token: [{ required: true, message: '请输入 Refresh Token', trigger: 'blur' }],
      marketplace_id: [{ required: true, message: '请选择 Marketplace ID', trigger: 'change' }],
      region: [{ required: true, message: '请选择区域', trigger: 'change' }]
    }

    // 获取店铺列表
    const fetchShopList = async () => {
      loading.value = true
      try {
        const response = await getAllShops()
        if (response.data.status === 'success') {
          shopList.value = response.data.data || []
        } else {
          ElMessage.error(response.data.message || '获取店铺列表失败')
        }
      } catch (error) {
        console.error('获取店铺列表失败:', error)
        ElMessage.error('获取店铺列表失败: ' + (error.response?.data?.message || error.message))
      } finally {
        loading.value = false
      }
    }

    // 打开对话框
    const openDialog = (row = null) => {
      isEdit.value = !!row
      if (row) {
        currentId.value = row.id
        formData.shop_name = row.shop_name || ''
        formData.seller_id = row.seller_id || ''
        formData.refresh_token = row.refresh_token || ''
        formData.marketplace_id = row.marketplace_id || ''
        formData.region = row.region || ''
        formData.is_default = row.is_default || 0
      } else {
        currentId.value = null
        resetForm()
      }
      dialogVisible.value = true
    }

    // 重置表单
    const resetForm = () => {
      formData.shop_name = ''
      formData.seller_id = ''
      formData.refresh_token = ''
      formData.marketplace_id = ''
      formData.region = ''
      formData.is_default = 0
      if (formRef.value) {
        formRef.value.resetFields()
      }
    }

    // 提交表单
    const handleSubmit = async () => {
      if (!formRef.value) return
      await formRef.value.validate(async (valid) => {
        if (!valid) return

        submitLoading.value = true
        try {
          const payload = {
            shop_name: formData.shop_name,
            seller_id: formData.seller_id,
            refresh_token: formData.refresh_token,
            marketplace_id: formData.marketplace_id,
            region: formData.region,
            is_default: formData.is_default
          }

          let response
          if (isEdit.value && currentId.value) {
            response = await updateShop(currentId.value, payload)
          } else {
            response = await createShop(payload)
          }

          if (response.data.status === 'success') {
            ElMessage.success(isEdit.value ? '店铺更新成功' : '店铺创建成功')
            dialogVisible.value = false
            await fetchShopList()
          } else {
            ElMessage.error(response.data.message || '操作失败')
          }
        } catch (error) {
          console.error('保存店铺失败:', error)
          ElMessage.error('保存店铺失败: ' + (error.response?.data?.message || error.message))
        } finally {
          submitLoading.value = false
        }
      })
    }

    // 设为默认
    const handleSetDefault = async (row) => {
      try {
        await ElMessageBox.confirm(
          `确定将 "${row.shop_name}" 设为默认店铺吗？`,
          '提示',
          { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
        )
        const response = await setDefaultShop(row.id)
        if (response.data.status === 'success') {
          ElMessage.success('默认店铺设置成功')
          await fetchShopList()
        } else {
          ElMessage.error(response.data.message || '设置失败')
        }
      } catch (error) {
        if (error === 'cancel') return
        console.error('设为默认失败:', error)
        ElMessage.error('设为默认失败: ' + (error.response?.data?.message || error.message))
      }
    }

    // 删除店铺
    const handleDelete = async (row) => {
      try {
        await ElMessageBox.confirm(
          `确定删除店铺 "${row.shop_name}" 吗？删除后该店铺将变为禁用状态。`,
          '警告',
          { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
        )
        const response = await deleteShop(row.id)
        if (response.data.status === 'success') {
          ElMessage.success('店铺删除成功')
          await fetchShopList()
        } else {
          ElMessage.error(response.data.message || '删除失败')
        }
      } catch (error) {
        if (error === 'cancel') return
        console.error('删除店铺失败:', error)
        ElMessage.error('删除店铺失败: ' + (error.response?.data?.message || error.message))
      }
    }

    // 区域标签样式
    const getRegionType = (region) => {
      const map = { na: 'primary', eu: 'success', fe: 'warning' }
      return map[region] || 'info'
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return dateString.replace('T', ' ')
    }

    onMounted(() => {
      fetchShopList()
    })

    return {
      loading,
      shopList,
      dialogVisible,
      submitLoading,
      isEdit,
      formRef,
      formData,
      formRules,
      marketplaceOptions,
      onMarketplaceChange,
      fetchShopList,
      openDialog,
      resetForm,
      handleSubmit,
      handleSetDefault,
      handleDelete,
      getRegionType,
      formatDate
    }
  }
}
</script>

<style scoped>
.shop-page {
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

.shop-form .form-tip {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}

/* 响应式 */
@media (max-width: 768px) {
  .shop-page {
    padding: 12px;
  }

  .page-title {
    font-size: 24px;
  }

  .search-card,
  .content-card {
    padding: 16px;
  }
}
</style>
