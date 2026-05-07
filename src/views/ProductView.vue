<template>
  <div class="product-page">
    <div class="page-header">
      <h1 class="page-title">产品维护</h1>
      <p class="page-subtitle">管理产品信息，维护SKU与申报资料</p>
    </div>

    <!-- 搜索和操作区域 -->
    <div class="search-card">
      <el-form :model="searchForm" :inline="true" class="search-form">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="SKU/产品名称/品牌/ASIN"
            clearable
            style="width: 220px"
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

        <el-form-item label="分类">
          <el-select
            v-model="searchForm.category_id"
            placeholder="选择分类"
            clearable
            style="width: 160px"
          >
            <el-option
              v-for="item in categoryList"
              :key="item.id"
              :label="item.category_cn || item.category"
              :value="item.id"
            />
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
            新增产品
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 数据展示区域 -->
    <div class="content-card">
      <div class="card-header">
        <h3 class="section-title">产品列表</h3>
      </div>

      <el-table :data="productList" v-loading="loading" stripe style="width: 100%">
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="seller_sku" label="卖家SKU" min-width="140" show-overflow-tooltip />
        <el-table-column prop="product_name" label="产品名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="declare_name_cn" label="申报中文名" min-width="140" show-overflow-tooltip />
        <el-table-column prop="declare_name_en" label="申报英文名" min-width="160" show-overflow-tooltip />
        <el-table-column prop="brand" label="品牌" min-width="100" show-overflow-tooltip />
        <el-table-column prop="model" label="型号" min-width="100" show-overflow-tooltip />
        <el-table-column prop="asin" label="ASIN" min-width="120" show-overflow-tooltip />
        <el-table-column prop="fnsku" label="FNSKU" min-width="120" show-overflow-tooltip />
        <el-table-column prop="weight_kg" label="重量(kg)" width="100" align="center" />
        <el-table-column prop="category_name" label="分类" width="120" align="center" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">
              {{ scope.row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
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
      :title="isEdit ? '编辑产品' : '新增产品'"
      width="920px"
      :destroy-on-close="true"
      :close-on-click-modal="false"
      class="product-dialog"
    >
      <el-form :model="formData" label-width="110px" :rules="formRules" ref="formRef">
        <!-- 基础信息 -->
        <el-divider content-position="left">基础信息</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="卖家SKU" prop="seller_sku">
              <el-input v-model="formData.seller_sku" placeholder="输入卖家SKU" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品名称" prop="product_name">
              <el-input v-model="formData.product_name" placeholder="输入产品名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="申报中文名">
              <el-input v-model="formData.declare_name_cn" placeholder="输入申报中文名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="申报英文名">
              <el-input v-model="formData.declare_name_en" placeholder="输入申报英文名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="品牌">
              <el-input v-model="formData.brand" placeholder="输入品牌" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="型号">
              <el-input v-model="formData.model" placeholder="输入型号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用途">
              <el-input v-model="formData.purpose" placeholder="输入用途" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="中文材质">
              <el-input v-model="formData.material_cn" placeholder="输入中文材质" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="英文材质">
              <el-input v-model="formData.material_en" placeholder="输入英文材质" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类">
              <el-select
                v-model="formData.category_id"
                placeholder="选择分类"
                clearable
                style="width: 100%"
              >
                <el-option
                  v-for="item in categoryList"
                  :key="item.id"
                  :label="item.category_cn || item.category"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 图片信息 -->
        <el-divider content-position="left">图片信息</el-divider>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="主图">
              <el-upload
                v-model:file-list="mainImageFileList"
                action="#"
                :auto-upload="false"
                list-type="picture-card"
                :limit="1"
                :on-preview="handlePictureCardPreview"
                :class="['upload-main', { 'hide-upload': mainImageFileList.length >= 1 }]"
              >
                <el-icon><Plus /></el-icon>
              </el-upload>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="多图">
              <el-upload
                v-model:file-list="imageFilesList"
                action="#"
                :auto-upload="false"
                list-type="picture-card"
                :multiple="true"
                :on-preview="handlePictureCardPreview"
                class="upload-gallery"
              >
                <el-icon><Plus /></el-icon>
              </el-upload>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 海关与物流 -->
        <el-divider content-position="left">海关与物流</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="申报货值">
              <el-input-number
                v-model="formData.declare_value"
                :precision="2"
                :min="0"
                :controls="false"
                placeholder="单个产品申报货值"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="币种">
              <el-input v-model="formData.currency" placeholder="如 USD" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="海关编码">
              <el-input v-model="formData.hs_code" placeholder="输入海关编码" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品重量(kg)">
              <el-input-number
                v-model="formData.weight_kg"
                :precision="3"
                :min="0"
                :controls="false"
                placeholder="产品重量(kg)"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品尺寸(cm)">
              <el-input v-model="formData.dimensions_cm" placeholder="长*宽*高，如 10*5*3" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否带电">
              <el-radio-group v-model="formData.is_electric">
                <el-radio :label="1">是</el-radio>
                <el-radio :label="0">否</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否带磁">
              <el-radio-group v-model="formData.is_magnetic">
                <el-radio :label="1">是</el-radio>
                <el-radio :label="0">否</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 亚马逊信息 -->
        <el-divider content-position="left">亚马逊信息</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="ASIN">
              <el-input v-model="formData.asin" placeholder="输入ASIN" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="FNSKU">
              <el-input v-model="formData.fnsku" placeholder="输入FNSKU" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="亚马逊内部ID">
              <el-input v-model="formData.amazon_internal_id" placeholder="输入亚马逊内部编码ID" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 税务信息 -->
        <el-divider content-position="left">税务信息</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="VAT号码">
              <el-input v-model="formData.vat_number" placeholder="输入VAT号码" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="EORI号码">
              <el-input v-model="formData.eori_number" placeholder="输入EORI号码" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 其他 -->
        <el-divider content-position="left">其他</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="销售链接">
              <el-input v-model="formData.sales_url" placeholder="输入销售链接" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="formData.status">
                <el-radio :label="1">启用</el-radio>
                <el-radio :label="0">禁用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="输入备注" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览 -->
    <el-dialog v-model="previewVisible" width="600px" append-to-body>
      <img :src="previewImageUrl" style="width: 100%; display: block;" />
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import {
  getProducts,
  createProductWithFiles,
  updateProductWithFiles,
  deleteProduct,
  getProductCategories
} from '@/services/api.js'

export default {
  name: 'ProductView',
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
    const productList = ref([])

    // 图片上传
    const mainImageFileList = ref([])
    const imageFilesList = ref([])
    const previewVisible = ref(false)
    const previewImageUrl = ref('')

    const searchForm = reactive({
      keyword: '',
      status: '',
      category_id: ''
    })

    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    const formData = reactive({
      id: null,
      seller_sku: '',
      product_name: '',
      declare_name_cn: '',
      declare_name_en: '',
      remark: '',
      status: 1,
      category_id: '',

      // 材质信息
      material_cn: '',
      material_en: '',

      // 产品属性
      purpose: '',
      brand: '',
      model: '',

      // 申报价值
      declare_value: null,
      currency: 'USD',

      // 海关信息
      hs_code: '',
      is_electric: 0,
      is_magnetic: 0,

      // 亚马逊信息
      amazon_internal_id: '',
      asin: '',
      fnsku: '',

      // 税务信息
      vat_number: '',
      eori_number: '',

      // 其他
      sales_url: '',
      weight_kg: null,
      dimensions_cm: ''
    })

    const formRules = {
      seller_sku: [
        { required: true, message: '请输入卖家SKU', trigger: 'blur' },
        { max: 100, message: '最多100个字符', trigger: 'blur' }
      ],
      product_name: [
        { required: true, message: '请输入产品名称', trigger: 'blur' }
      ]
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
        if (searchForm.category_id !== '') params.category_id = searchForm.category_id

        const response = await getProducts(params)
        if (response.data.status === 'success') {
          const data = response.data.data || {}
          productList.value = data.list || []
          pagination.total = data.total || 0
          pagination.page = data.page || 1
          pagination.page_size = data.page_size || 20
        } else {
          ElMessage.error(response.data.message || '获取产品列表失败')
          productList.value = []
          pagination.total = 0
        }
      } catch (error) {
        console.error('获取产品列表失败:', error)
        ElMessage.error('获取产品列表失败: ' + (error.response?.data?.message || error.message))
        productList.value = []
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
      searchForm.category_id = ''
      pagination.page = 1
      fetchList()
    }

    const resetForm = () => {
      formData.id = null
      formData.seller_sku = ''
      formData.product_name = ''
      formData.declare_name_cn = ''
      formData.declare_name_en = ''
      formData.remark = ''
      formData.status = 1
      formData.category_id = ''

      formData.material_cn = ''
      formData.material_en = ''
      formData.purpose = ''
      formData.brand = ''
      formData.model = ''
      formData.declare_value = null
      formData.currency = 'USD'
      formData.hs_code = ''
      formData.is_electric = 0
      formData.is_magnetic = 0
      formData.amazon_internal_id = ''
      formData.asin = ''
      formData.fnsku = ''
      formData.vat_number = ''
      formData.eori_number = ''
      formData.sales_url = ''
      formData.weight_kg = null
      formData.dimensions_cm = ''

      mainImageFileList.value = []
      imageFilesList.value = []
    }

    const handleCreate = () => {
      isEdit.value = false
      resetForm()
      dialogVisible.value = true
    }

    const handleEdit = (row) => {
      isEdit.value = true
      formData.id = row.id
      formData.seller_sku = row.seller_sku || ''
      formData.product_name = row.product_name || ''
      formData.declare_name_cn = row.declare_name_cn || ''
      formData.declare_name_en = row.declare_name_en || ''
      formData.remark = row.remark || ''
      formData.status = row.status ?? 1
      formData.category_id = row.category_id ?? ''

      formData.material_cn = row.material_cn || ''
      formData.material_en = row.material_en || ''
      formData.purpose = row.purpose || ''
      formData.brand = row.brand || ''
      formData.model = row.model || ''
      formData.declare_value = row.declare_value != null ? Number(row.declare_value) : null
      formData.currency = row.currency || 'USD'
      formData.hs_code = row.hs_code || ''
      formData.is_electric = row.is_electric ?? 0
      formData.is_magnetic = row.is_magnetic ?? 0
      formData.amazon_internal_id = row.amazon_internal_id || ''
      formData.asin = row.asin || ''
      formData.fnsku = row.fnsku || ''
      formData.vat_number = row.vat_number || ''
      formData.eori_number = row.eori_number || ''
      formData.sales_url = row.sales_url || ''
      formData.weight_kg = row.weight_kg != null ? Number(row.weight_kg) : null
      formData.dimensions_cm = row.dimensions_cm || ''

      // 回显已有图片
      mainImageFileList.value = row.image_url ? [{ name: 'main', url: row.image_url }] : []
      try {
        const urls = row.image_urls ? JSON.parse(row.image_urls) : []
        imageFilesList.value = Array.isArray(urls)
          ? urls.filter(u => u).map((url, idx) => ({ name: `img_${idx}`, url }))
          : []
      } catch {
        imageFilesList.value = []
      }

      dialogVisible.value = true
    }

    const handleDelete = (row) => {
      ElMessageBox.confirm(`确定删除产品 "${row.product_name || row.seller_sku}" 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await deleteProduct(row.id)
          if (response.data.status === 'success') {
            ElMessage.success('删除成功')
            await fetchList()
          } else {
            ElMessage.error(response.data.message || '删除失败')
          }
        } catch (error) {
          console.error('删除产品失败:', error)
          ElMessage.error('删除失败: ' + (error.response?.data?.message || error.message))
        }
      }).catch(() => {})
    }

    const handleSubmit = async () => {
      const valid = await formRef.value?.validate().catch(() => false)
      if (!valid) return

      submitLoading.value = true
      try {
        // 构建 FormData，文本字段 + 文件一起提交
        const fd = new FormData()
        fd.append('seller_sku', formData.seller_sku)
        fd.append('product_name', formData.product_name)
        fd.append('declare_name_cn', formData.declare_name_cn || '')
        fd.append('declare_name_en', formData.declare_name_en || '')
        fd.append('remark', formData.remark || '')
        fd.append('status', formData.status)
        fd.append('category_id', formData.category_id != null ? formData.category_id : '')
        fd.append('material_cn', formData.material_cn || '')
        fd.append('material_en', formData.material_en || '')
        fd.append('purpose', formData.purpose || '')
        fd.append('brand', formData.brand || '')
        fd.append('model', formData.model || '')
        fd.append('declare_value', formData.declare_value != null ? formData.declare_value : '')
        fd.append('currency', formData.currency || 'USD')
        fd.append('hs_code', formData.hs_code || '')
        fd.append('is_electric', formData.is_electric)
        fd.append('is_magnetic', formData.is_magnetic)
        fd.append('amazon_internal_id', formData.amazon_internal_id || '')
        fd.append('asin', formData.asin || '')
        fd.append('fnsku', formData.fnsku || '')
        fd.append('vat_number', formData.vat_number || '')
        fd.append('eori_number', formData.eori_number || '')
        fd.append('sales_url', formData.sales_url || '')
        fd.append('weight_kg', formData.weight_kg != null ? formData.weight_kg : '')
        fd.append('dimensions_cm', formData.dimensions_cm || '')

        // 主图：新上传的文件
        mainImageFileList.value.forEach(file => {
          if (file.raw) {
            fd.append('main_image', file.raw)
          }
        })
        // 多图：新上传的文件
        imageFilesList.value.forEach(file => {
          if (file.raw) {
            fd.append('images', file.raw)
          }
        })

        // 编辑时，保留的已有图片 URL 告诉后端
        if (isEdit.value) {
          const existingMain = mainImageFileList.value
            .filter(f => f.url && !f.raw)
            .map(f => f.url)
          const existingGallery = imageFilesList.value
            .filter(f => f.url && !f.raw)
            .map(f => f.url)
          fd.append('existing_image_url', existingMain[0] || '')
          fd.append('existing_image_urls', JSON.stringify(existingGallery))
        }

        let response
        if (isEdit.value) {
          response = await updateProductWithFiles(formData.id, fd)
        } else {
          response = await createProductWithFiles(fd)
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

    const handlePictureCardPreview = (uploadFile) => {
      previewImageUrl.value = uploadFile.url || uploadFile.thumbUrl
      previewVisible.value = true
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

    const categoryList = ref([])

    const fetchCategories = async () => {
      try {
        const response = await getProductCategories()
        if (response.data.status === 'success') {
          categoryList.value = response.data.data?.list || []
        }
      } catch (error) {
        console.error('获取产品分类失败:', error)
      }
    }

    onMounted(() => {
      fetchList()
      fetchCategories()
    })

    return {
      loading,
      submitLoading,
      dialogVisible,
      isEdit,
      formRef,
      productList,
      searchForm,
      pagination,
      formData,
      formRules,
      mainImageFileList,
      imageFilesList,
      previewVisible,
      previewImageUrl,
      categoryList,
      handleSearch,
      resetSearch,
      handleCreate,
      handleEdit,
      handleDelete,
      handleSubmit,
      handlePictureCardPreview,
      handlePageChange,
      handleSizeChange
    }
  }
}
</script>

<style scoped>
.product-page {
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

/* 对话框样式 */
:deep(.product-dialog .el-dialog__body) {
  padding-top: 10px;
  padding-bottom: 10px;
  max-height: 70vh;
  overflow-y: auto;
}

/* upload 样式 */
:deep(.upload-main .el-upload--picture-card) {
  width: 120px;
  height: 120px;
}

:deep(.upload-main .el-upload-list__item) {
  width: 120px;
  height: 120px;
}

:deep(.upload-main.hide-upload .el-upload--picture-card) {
  display: none;
}

:deep(.upload-gallery .el-upload--picture-card) {
  width: 100px;
  height: 100px;
}

:deep(.upload-gallery .el-upload-list__item) {
  width: 100px;
  height: 100px;
}

/* 响应式 */
@media (max-width: 768px) {
  .product-page {
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
