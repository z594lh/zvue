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

        <el-form-item label="SP-API Refresh Token" prop="sp_refresh_token">
          <template #label>
            <el-tooltip placement="top">
              <template #content>
                <div style="max-width: 320px">
                  在亚马逊开发者控制台或授权应用中获取，<br>用于调用 SP-API 接口，<br>格式为一串很长的字符串，<br>建议通过【应用 & 服务 > 管理您的应用】授权后复制
                </div>
              </template>
              <span>SP-API Refresh Token <el-icon style="vertical-align: middle"><QuestionFilled /></el-icon></span>
            </el-tooltip>
          </template>
          <el-input
            v-model="formData.sp_refresh_token"
            type="textarea"
            :rows="3"
            :placeholder="isEdit ? '如需更换 Token 请在此处填写，留空则保持原值不变' : '亚马逊 SP-API Refresh Token（很长的字符串）'"
          />
          <div class="form-tip" v-if="isEdit">
            <el-icon><InfoFilled /></el-icon>
            出于安全考虑，系统不会回显已有的 Refresh Token。如需更新请手动填写，留空则保留原值。
          </div>
        </el-form-item>

        <!-- 广告 API 授权（仅编辑已有店铺时可用） -->
        <el-form-item v-if="isEdit" label="广告 API">
          <div class="ads-box">
            <div v-if="!formData.ads_refresh_token" class="ads-status">
              <span class="ads-dot ads-dot--off"></span>
              <span class="ads-text">未授权</span>
              <el-button type="primary" size="small" :loading="adsAuthLoading" @click="handleAuthorizeAds">
                授权广告 API
              </el-button>
            </div>
            <div v-else class="ads-status ads-status--on">
              <div class="ads-row">
                <span class="ads-dot ads-dot--on"></span>
                <span class="ads-text">已授权</span>
              </div>
              <div class="ads-row ads-row--detail">
                <span class="ads-label">Refresh Token：</span>
                <span class="ads-value">{{ maskToken(formData.ads_refresh_token) }}</span>
              </div>
              <div class="ads-row ads-row--detail">
                <span class="ads-label">Profile ID：</span>
                <span class="ads-value">{{ formData.ads_profile_id || '未设置' }}</span>
              </div>
              <div class="ads-row">
                <el-button size="small" :loading="adsAuthLoading" @click="handleAuthorizeAds">重新授权</el-button>
                <el-button size="small" :loading="adsProfilesLoading" @click="openAdsProfiles">查看账户列表</el-button>
                <el-button size="small" :loading="adsCheckLoading" @click="handleCheckAdsStatus">刷新状态</el-button>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item v-if="isEdit && formData.credential_group_id" label="凭证组 ID">
          <span class="ads-value">{{ formData.credential_group_id }}</span>
          <span class="form-tip">（只读，供排查使用）</span>
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

    <!-- 广告 API 授权链接对话框 -->
    <el-dialog v-model="adsAuthVisible" title="广告 API 授权" width="560px">
      <div class="ads-auth-dialog">
        <p class="ads-auth-tip">
          请复制以下链接，粘贴到 <strong>紫鸟浏览器</strong>（已登录 Amazon 卖家账号）中打开，
          完成授权后关闭页面返回系统，点击下方「我已授权，检查状态」即可。
        </p>
        <el-input
          v-model="adsAuthUrl"
          type="textarea"
          :rows="4"
          readonly
        />
        <div class="ads-auth-actions">
          <el-button type="primary" :icon="CopyDocument" @click="copyAuthUrl">复制链接</el-button>
          <span class="form-tip">链接 30 分钟内有效</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="adsAuthVisible = false">关闭</el-button>
        <el-button type="success" :loading="adsCheckLoading" @click="handleCheckAdsStatus">
          我已授权，检查状态
        </el-button>
      </template>
    </el-dialog>

    <!-- 广告账户列表对话框 -->
    <el-dialog v-model="adsProfilesVisible" title="选择广告账户 (Profile)" width="640px">
      <el-table
        :data="adsProfiles"
        v-loading="adsProfilesLoading"
        highlight-current-row
        @current-change="row => { if (row) selectedProfileId = String(row.profileId) }"
      >
        <el-table-column width="50">
          <template #default="scope">
            <el-radio v-model="selectedProfileId" :label="String(scope.row.profileId)">
              <span></span>
            </el-radio>
          </template>
        </el-table-column>
        <el-table-column prop="profileId" label="Profile ID" min-width="140" />
        <el-table-column prop="countryCode" label="国家" width="80" align="center" />
        <el-table-column label="账户名称" min-width="160" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.accountInfo?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="类型" width="90" align="center">
          <template #default="scope">{{ scope.row.accountInfo?.type || '-' }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="adsProfilesVisible = false">取消</el-button>
        <el-button type="primary" :loading="adsProfileSaving" :disabled="!selectedProfileId" @click="handleSaveProfile">
          保存所选 Profile
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, QuestionFilled, InfoFilled, CopyDocument } from '@element-plus/icons-vue'
import {
  getAllShops,
  getShop,
  createShop,
  updateShop,
  deleteShop,
  setDefaultShop,
  getAdsAuthorizeUrl,
  getAdsProfiles,
  setAdsProfile
} from '@/services/api.js'
import { useShopCache } from '@/composables/useShopCache'

export default {
  name: 'ShopView',
  components: {
    Plus,
    QuestionFilled,
    InfoFilled
  },
  setup() {
    const loading = ref(false)
    const shopList = ref([])
    const dialogVisible = ref(false)
    const submitLoading = ref(false)
    const isEdit = ref(false)
    const currentId = ref(null)
    const formRef = ref(null)
    const { notifyShopChanged } = useShopCache()

    const formData = reactive({
      shop_name: '',
      seller_id: '',
      sp_refresh_token: '',
      marketplace_id: '',
      region: '',
      is_default: 0,
      credential_group_id: null,
      ads_refresh_token: '',
      ads_profile_id: ''
    })

    // 广告 API 授权相关状态
    const adsAuthVisible = ref(false)
    const adsAuthUrl = ref('')
    const adsAuthLoading = ref(false)
    const adsCheckLoading = ref(false)
    const adsProfilesVisible = ref(false)
    const adsProfiles = ref([])
    const adsProfilesLoading = ref(false)
    const selectedProfileId = ref('')
    const adsProfileSaving = ref(false)

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
      sp_refresh_token: [{ required: true, message: '请输入 SP-API Refresh Token', trigger: 'blur' }],
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
    const openDialog = async (row = null) => {
      isEdit.value = !!row
      if (row) {
        currentId.value = row.id
        formData.shop_name = row.shop_name || ''
        formData.seller_id = row.seller_id || ''
        formData.sp_refresh_token = ''
        formData.marketplace_id = row.marketplace_id || ''
        formData.region = row.region || ''
        formData.is_default = row.is_default || 0
        formData.credential_group_id = row.credential_group_id || null
        formData.ads_refresh_token = ''
        formData.ads_profile_id = ''
        dialogVisible.value = true
        await loadShopDetail(row.id)
      } else {
        currentId.value = null
        resetForm()
        dialogVisible.value = true
      }
    }

    // 拉取店铺详情，回填凭证组与广告授权字段
    const loadShopDetail = async (id) => {
      try {
        const response = await getShop(id)
        if (response.data.status === 'success' && response.data.data) {
          const detail = response.data.data
          formData.credential_group_id = detail.credential_group_id ?? formData.credential_group_id
          formData.ads_refresh_token = detail.ads_refresh_token || ''
          formData.ads_profile_id = detail.ads_profile_id || ''
        }
      } catch (error) {
        console.error('获取店铺详情失败:', error)
      }
    }

    // 重置表单
    const resetForm = () => {
      formData.shop_name = ''
      formData.seller_id = ''
      formData.sp_refresh_token = ''
      formData.marketplace_id = ''
      formData.region = ''
      formData.is_default = 0
      formData.credential_group_id = null
      formData.ads_refresh_token = ''
      formData.ads_profile_id = ''
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
            marketplace_id: formData.marketplace_id,
            region: formData.region,
            is_default: formData.is_default
          }

          if (formData.credential_group_id) {
            payload.credential_group_id = formData.credential_group_id
          }

          // 编辑模式下，sp_refresh_token 留空则不传给后端，避免覆盖原值
          if (!isEdit.value || formData.sp_refresh_token) {
            payload.sp_refresh_token = formData.sp_refresh_token
          }

          let response
          if (isEdit.value && currentId.value) {
            response = await updateShop(currentId.value, payload)
          } else {
            response = await createShop(payload)
          }

          if (response.data.status === 'success') {
            ElMessage.success(isEdit.value ? '店铺更新成功' : '店铺创建成功')
            notifyShopChanged()
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
          notifyShopChanged()
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
          notifyShopChanged()
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

    // 脱敏显示 token
    const maskToken = (token) => {
      if (!token) return ''
      if (token.length <= 8) return '●●●●'
      return `${token.slice(0, 4)}●●●●${token.slice(-4)}`
    }

    // 获取广告 API 授权链接
    const handleAuthorizeAds = async () => {
      if (!currentId.value) return
      adsAuthLoading.value = true
      try {
        const response = await getAdsAuthorizeUrl(currentId.value)
        if (response.data.status === 'success' && response.data.data) {
          adsAuthUrl.value = response.data.data.authorize_url || ''
          adsAuthVisible.value = true
        } else {
          ElMessage.error(response.data.message || '获取授权链接失败')
        }
      } catch (error) {
        console.error('获取授权链接失败:', error)
        ElMessage.error('获取授权链接失败: ' + (error.response?.data?.message || error.message))
      } finally {
        adsAuthLoading.value = false
      }
    }

    // 复制授权链接
    const copyAuthUrl = async () => {
      if (!adsAuthUrl.value) return
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(adsAuthUrl.value)
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = adsAuthUrl.value
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }
        ElMessage.success('链接已复制，请粘贴到紫鸟浏览器中打开')
      } catch (error) {
        console.error('复制失败:', error)
        ElMessage.error('复制失败，请手动选择复制')
      }
    }

    // 检查授权状态（重新拉取店铺详情）
    const handleCheckAdsStatus = async () => {
      if (!currentId.value) return
      adsCheckLoading.value = true
      try {
        await loadShopDetail(currentId.value)
        if (formData.ads_refresh_token) {
          ElMessage.success('授权成功，已获取广告 Refresh Token')
          adsAuthVisible.value = false
        } else {
          ElMessage.warning('尚未检测到授权，请确认已在紫鸟浏览器中完成授权后再试')
        }
      } finally {
        adsCheckLoading.value = false
      }
    }

    // 打开广告账户列表
    const openAdsProfiles = async () => {
      if (!currentId.value) return
      adsProfilesLoading.value = true
      try {
        const response = await getAdsProfiles(currentId.value)
        if (response.data.status === 'success') {
          adsProfiles.value = response.data.data || []
          selectedProfileId.value = formData.ads_profile_id || ''
          adsProfilesVisible.value = true
        } else {
          ElMessage.error(response.data.message || '获取广告账户列表失败')
        }
      } catch (error) {
        console.error('获取广告账户列表失败:', error)
        ElMessage.error('获取广告账户列表失败: ' + (error.response?.data?.message || error.message))
      } finally {
        adsProfilesLoading.value = false
      }
    }

    // 保存选中的 profile
    const handleSaveProfile = async () => {
      if (!currentId.value || !selectedProfileId.value) return
      adsProfileSaving.value = true
      try {
        const response = await setAdsProfile({
          shop_id: currentId.value,
          profile_id: selectedProfileId.value
        })
        if (response.data.status === 'success') {
          ElMessage.success('Profile 已保存')
          formData.ads_profile_id = selectedProfileId.value
          adsProfilesVisible.value = false
        } else {
          ElMessage.error(response.data.message || '保存失败')
        }
      } catch (error) {
        console.error('保存 Profile 失败:', error)
        ElMessage.error('保存 Profile 失败: ' + (error.response?.data?.message || error.message))
      } finally {
        adsProfileSaving.value = false
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
      formatDate,
      CopyDocument,
      adsAuthVisible,
      adsAuthUrl,
      adsAuthLoading,
      adsCheckLoading,
      adsProfilesVisible,
      adsProfiles,
      adsProfilesLoading,
      selectedProfileId,
      adsProfileSaving,
      maskToken,
      handleAuthorizeAds,
      copyAuthUrl,
      handleCheckAdsStatus,
      openAdsProfiles,
      handleSaveProfile
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

.ads-box {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
}

.ads-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ads-status--on {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.ads-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ads-row--detail {
  font-size: 13px;
}

.ads-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.ads-dot--off {
  background: #c0c4cc;
}

.ads-dot--on {
  background: #67c23a;
}

.ads-text {
  font-size: 13px;
  color: #606266;
}

.ads-label {
  color: #909399;
}

.ads-value {
  color: #303133;
  word-break: break-all;
}

.ads-auth-dialog .ads-auth-tip {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
}

.ads-auth-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
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
