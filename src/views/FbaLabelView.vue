<template>
  <div class="fba-label-page">
    <div class="page-header">
      <h1 class="page-title">FNSKU 标签打印</h1>
    </div>

    <div class="content-wrapper">
      <!-- 表单区域 -->
      <div class="form-card">
        <h3 class="section-title">标签信息</h3>
        <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
          <el-form-item label="选择 SKU" prop="selected_sku">
            <el-select
              v-model="form.selected_sku"
              placeholder="请选择产品 SKU"
              clearable
              filterable
              style="width: 100%"
              @change="handleSkuChange"
            >
              <el-option
                v-for="item in productList"
                :key="item.seller_sku"
                :label="item.seller_sku + (item.product_name ? ' - ' + item.product_name : '')"
                :value="item.seller_sku"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="FNSKU">
            <el-input v-model="form.fnsku" disabled />
          </el-form-item>
          <el-form-item label="SKU 编码">
            <el-input v-model="form.sku" disabled />
          </el-form-item>
          <el-form-item label="产品名称">
            <el-input v-model="form.product_name" disabled />
          </el-form-item>
          <el-form-item label="额外信息">
            <el-input v-model="form.extra_info" disabled />
          </el-form-item>

          <el-form-item label="标签尺寸">
            <div class="size-inputs">
              <el-input-number
                v-model="form.width_mm"
                :min="20"
                :max="100"
                :step="5"
                controls-position="right"
                style="width: 120px"
              />
              <span class="size-separator">mm</span>
              <span class="size-separator">×</span>
              <el-input-number
                v-model="form.height_mm"
                :min="15"
                :max="80"
                :step="5"
                controls-position="right"
                style="width: 120px"
              />
              <span class="size-separator">mm</span>
            </div>
            <div class="size-hint">默认 70mm × 40mm</div>
          </el-form-item>
          <el-form-item label="打印数量" prop="quantity">
            <el-input-number
              v-model="form.quantity"
              :min="1"
              :max="1000"
              :step="1"
              controls-position="right"
              style="width: 140px"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              @click="submitForm"
              :loading="generating"
              :icon="Printer"
              size="large"
            >
              生成标签
            </el-button>
            <el-button @click="resetForm" size="large">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 生成结果区域 -->
      <div v-if="generatedLabel" class="result-card">
        <h3 class="section-title">生成结果</h3>
        <div class="result-content">
          <div class="result-info">
            <div class="result-item">
              <span class="result-label">文件名：</span>
              <span class="result-value">{{ generatedLabel.file_name }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">状态：</span>
              <el-tag type="success" size="small">生成成功</el-tag>
            </div>
          </div>
          <div class="result-actions">
            <el-button type="primary" @click="openPdf" :icon="View">
              查看 / 下载 PDF
            </el-button>
            <el-button @click="copyUrl" :icon="DocumentCopy">
              复制链接
            </el-button>
          </div>
          <!-- PDF 预览 -->
          <div class="pdf-preview">
            <iframe
              v-if="generatedLabel.url"
              :src="generatedLabel.url"
              class="pdf-iframe"
              frameborder="0"
            ></iframe>
          </div>
        </div>
      </div>
    </div>

    <!-- 历史记录 -->
    <div v-if="history.length > 0" class="history-card">
      <h3 class="section-title">最近生成记录</h3>
      <el-table :data="history" stripe style="width: 100%">
        <el-table-column prop="fnsku" label="FNSKU" width="140" />
        <el-table-column prop="product_name" label="产品名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="sku" label="SKU" width="120" />
        <el-table-column prop="size" label="尺寸" width="100" align="center" />
        <el-table-column prop="quantity" label="数量" width="80" align="center" />
        <el-table-column prop="time" label="生成时间" width="160" />
        <el-table-column label="操作" width="120" align="center">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="reopenHistory(scope.row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Printer, View, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { generateFbaLabel, getProducts } from '@/services/api.js'

export default {
  name: 'FbaLabelView',
  setup() {
    const router = useRouter()
    const formRef = ref(null)
    const generating = ref(false)
    const generatedLabel = ref(null)
    const history = ref([])
    const productList = ref([])

    const form = reactive({
      selected_sku: '',
      fnsku: '',
      product_name: '',
      sku: '',
      extra_info: '',
      width_mm: 70,
      height_mm: 40,
      quantity: 1
    })

    const rules = {
      selected_sku: [{ required: true, message: '请选择 SKU', trigger: 'change' }]
    }

    const handleSkuChange = (sku) => {
      if (!sku) {
        form.fnsku = ''
        form.sku = ''
        form.product_name = ''
        form.extra_info = ''
        return
      }
      const product = productList.value.find(item => item.seller_sku === sku)
      if (product) {
        form.fnsku = product.fnsku || ''
        form.sku = product.seller_sku || ''
        form.product_name = product.declare_name_en || product.product_name || ''
        form.extra_info = product.model || ''
      }
    }

    const fetchProducts = async () => {
      try {
        const response = await getProducts({ status: 1, page_size: 9999 })
        if (response.data.status === 'success') {
          productList.value = response.data.data?.list || []
        }
      } catch (error) {
        console.error('获取产品列表失败:', error)
      }
    }

    // 统一错误处理
    const handleApiError = (err) => {
      const message = err.response?.data?.message || ''
      const status = err.response?.data?.status
      if (status === 'error' && message.includes('登录')) {
        ElMessage.error({ message: '请先登录', offset: window.innerHeight / 2 - 50 })
        router.push('/login')
        return true
      }
      const errorMsg = message || err.message || '请求失败'
      ElMessage.error({ message: errorMsg, offset: window.innerHeight / 2 - 50 })
      return false
    }

    // 提交表单生成标签
    const submitForm = () => {
      formRef.value.validate(async (valid) => {
        if (!valid) return

        generating.value = true
        generatedLabel.value = null

        try {
          const payload = {
            fnsku: form.fnsku.trim(),
            product_name: form.product_name.trim(),
            sku: form.sku.trim(),
            width_mm: form.width_mm,
            height_mm: form.height_mm
          }
          if (form.extra_info.trim()) {
            payload.extra_info = form.extra_info.trim()
          }

          const res = await generateFbaLabel(payload)
          if (res.data.status === 'success') {
            generatedLabel.value = res.data.data
            ElMessage.success(res.data.message || '标签生成成功')

            // 添加到历史记录
            addToHistory(payload)
          } else {
            ElMessage.error(res.data.message || '标签生成失败')
          }
        } catch (err) {
          handleApiError(err)
        } finally {
          generating.value = false
        }
      })
    }

    // 添加到历史记录
    const addToHistory = (payload) => {
      const now = new Date()
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const item = {
        fnsku: payload.fnsku,
        product_name: payload.product_name,
        sku: payload.sku,
        size: `${payload.width_mm}×${payload.height_mm}mm`,
        quantity: form.quantity,
        time: timeStr,
        url: generatedLabel.value?.url,
        file_name: generatedLabel.value?.file_name
      }
      history.value.unshift(item)
      if (history.value.length > 10) {
        history.value = history.value.slice(0, 10)
      }
      localStorage.setItem('fba_label_history', JSON.stringify(history.value))
    }

    // 重置表单
    const resetForm = () => {
      formRef.value?.resetFields()
      form.selected_sku = ''
      form.fnsku = ''
      form.sku = ''
      form.product_name = ''
      form.extra_info = ''
      form.width_mm = 70
      form.height_mm = 40
      form.quantity = 1
      generatedLabel.value = null
    }

    // 打开 PDF
    const openPdf = () => {
      if (generatedLabel.value?.url) {
        window.open(generatedLabel.value.url, '_blank')
      }
    }

    // 复制链接
    const copyUrl = async () => {
      if (!generatedLabel.value?.url) return
      try {
        await navigator.clipboard.writeText(generatedLabel.value.url)
        ElMessage.success('链接已复制到剪贴板')
      } catch {
        // 降级方案
        const input = document.createElement('input')
        input.value = generatedLabel.value.url
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
        ElMessage.success('链接已复制到剪贴板')
      }
    }

    // 从历史记录重新打开
    const reopenHistory = (row) => {
      if (row.url) {
        window.open(row.url, '_blank')
      }
    }

    // 加载历史记录
    onMounted(() => {
      const saved = localStorage.getItem('fba_label_history')
      if (saved) {
        try {
          history.value = JSON.parse(saved)
        } catch {
          history.value = []
        }
      }
      fetchProducts()
    })

    return {
      formRef,
      form,
      rules,
      generating,
      generatedLabel,
      history,
      productList,
      submitForm,
      resetForm,
      openPdf,
      copyUrl,
      reopenHistory,
      handleSkuChange,
      Printer,
      View,
      DocumentCopy
    }
  }
}
</script>

<style scoped>
.fba-label-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.content-wrapper {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

@media (min-width: 900px) {
  .content-wrapper {
    grid-template-columns: 1fr 1fr;
  }
}

.form-card,
.result-card,
.history-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.result-card {
  align-self: start;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
}

.size-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.size-separator {
  color: #666;
  font-size: 14px;
  white-space: nowrap;
}

.size-hint {
  font-size: 12px;
  color: #999;
  margin-top: 6px;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-info {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 14px 16px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.result-item:last-child {
  margin-bottom: 0;
}

.result-label {
  font-size: 13px;
  color: #666;
  min-width: 60px;
}

.result-value {
  font-size: 13px;
  color: #333;
  font-weight: 500;
  word-break: break-all;
}

.result-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pdf-preview {
  border: 1px solid #e1e4e8;
  border-radius: 8px;
  overflow: hidden;
  min-height: 300px;
}

.pdf-iframe {
  width: 100%;
  height: 400px;
  display: block;
}

.history-card {
  margin-top: 24px;
}

/* 响应式 */
@media (max-width: 768px) {
  .fba-label-page {
    padding: 12px;
  }

  .page-title {
    font-size: 20px;
  }

  .form-card,
  .result-card,
  .history-card {
    padding: 16px;
  }

  .size-inputs {
    flex-wrap: wrap;
  }

  .result-actions {
    flex-direction: column;
  }

  .result-actions .el-button {
    width: 100%;
    margin-left: 0 !important;
  }

  .pdf-iframe {
    height: 300px;
  }
}
</style>
