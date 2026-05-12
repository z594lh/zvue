<template>
  <div class="pdf-tools-container">
    <div class="header">
      <h1>PDF 裁剪与拆分工具</h1>
      <div class="header-actions">
        <el-button type="primary" @click="uploadPdf" :loading="loading">上传PDF文件</el-button>
      </div>
    </div>

    <div class="main-content">
      <!-- 左侧页面列表 -->
      <div class="page-list-panel">
        <div class="panel-title">页面列表 ({{ pages.length }}页)</div>
        <div class="pages">
          <div
            v-for="(page, index) in pages"
            :key="index"
            class="page-item"
            :class="{ active: currentPage === index }"
            @click="selectPage(index)"
          >
            <img :src="page.thumbnail" :alt="`页面 ${index + 1}`" @error="$event.target.style.display='none'" />
            <span>第 {{ index + 1 }} 页</span>
          </div>
        </div>
      </div>

      <!-- 中间预览区域 -->
      <div class="editor-area">
        <div class="canvas-wrapper" ref="canvasWrapper" v-if="currentPdf">
          <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>
          <canvas ref="overlayCanvas" class="overlay-canvas"></canvas>
        </div>
        <div class="welcome-message" v-else>
          <el-empty description="请上传PDF文件开始裁剪或拆分">
            <el-button type="primary" @click="uploadPdf" :loading="loading">上传PDF文件</el-button>
          </el-empty>
        </div>
      </div>

      <!-- 右侧操作面板 -->
      <div class="operation-panel">
        <el-card v-if="currentPdf">
          <template #header>
            <div class="card-header">裁剪设置</div>
          </template>
          <div class="tool-row" style="margin-bottom: 10px;">
            <span style="font-size: 12px; color: #606266;">裁剪模式:</span>
            <el-select v-model="cropMode" size="small" style="width: 120px; margin-left: 4px;">
              <el-option label="自由裁剪" value="free" />
              <el-option label="1:1 (10:10)" value="10:10" />
              <el-option label="2:3 (10:15)" value="10:15" />
            </el-select>
          </div>
          <p class="hint-text">
            拖拽红色虚线框调整裁剪区域，四角可拉伸
          </p>
          <el-button @click="toggleAddCrop" :type="currentPageHasCrop ? 'danger' : 'primary'" size="small" style="width: 100%; margin-bottom: 8px;">
            {{ currentPageHasCrop ? '清除裁剪框' : '添加裁剪框' }}
          </el-button>
          <el-button @click="applyCropToAllPages" size="small" style="width: 100%; margin-bottom: 8px;" :disabled="!pageCropData[currentPage]">
            裁剪框应用到所有页面
          </el-button>
          <el-button @click="clearAllCropBoxes" size="small" style="width: 100%; margin-bottom: 8px;">
            清除所有页面裁剪框
          </el-button>
          <el-button @click="alignCropWidth" size="small" style="width: 100%; margin-bottom: 8px;">
            宽度填满页面
          </el-button>
          <el-button @click="alignCropHeight" size="small" style="width: 100%;">
            高度填满页面
          </el-button>
        </el-card>

        <el-card style="margin-top: 15px;" v-if="currentPdf">
          <template #header>
            <div class="card-header">导出</div>
          </template>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <el-button @click="exportCroppedPdf" type="success" size="small" style="width: 100%;">
              导出裁剪后PDF
            </el-button>
            <el-button @click="exportSplitPdf" type="warning" size="small" style="width: 100%;">
              拆分所有页面
            </el-button>
            <el-button @click="exportCropAndSplit" type="primary" size="small" style="width: 100%;">
              裁剪且拆分
            </el-button>
          </div>
        </el-card>
      </div>
    </div>

    <input type="file" ref="fileInput" @change="handleFileUpload" accept=".pdf" style="display: none" />
  </div>
</template>

<script>
/* eslint-disable */
import { ref, shallowRef, nextTick, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Canvas, Rect } from 'fabric'
import { editPdf, splitPdf } from '@/services/api.js'

export default {
  name: 'PdfToolsView',
  setup() {
    const fileInput = ref(null)
    const pdfCanvas = ref(null)
    const overlayCanvas = ref(null)

    const loading = ref(false)
    const currentPdf = shallowRef(null)
    const pages = shallowRef([])
    const currentPage = ref(-1)
    const fabricCanvas = shallowRef(null)
    const originalPdfFile = shallowRef(null)
    const pageCropData = ref({})
    const cropMode = ref('10:10')

    const allPagesHaveCrop = computed(() => {
      if (!pages.value.length) return false
      return pages.value.every((_, i) => !!pageCropData.value[i])
    })

    const currentPageHasCrop = computed(() => {
      return !!pageCropData.value[currentPage.value]
    })

    watch(cropMode, (newMode) => {
      if (!fabricCanvas.value || newMode === 'free') return
      const cropObj = fabricCanvas.value.getObjects().find(o => o.dataType === 'cropbox')
      if (!cropObj) return
      const [rw, rh] = newMode.split(':').map(Number)
      const targetRatio = rw / rh
      const currentWidth = cropObj.width * cropObj.scaleX
      const targetHeight = currentWidth / targetRatio
      cropObj.set({ scaleY: targetHeight / cropObj.height })
      cropObj.setCoords()
      fabricCanvas.value.renderAll()
      saveCurrentCropData()
    })

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve()
        const s = document.createElement('script')
        s.src = src
        s.onload = resolve
        s.onerror = () => reject(new Error(`加载失败: ${src}`))
        document.head.appendChild(s)
      })
    }

    const uploadPdf = () => fileInput.value.click()

    const handleFileUpload = async (event) => {
      const file = event.target.files[0]
      if (!file || file.type !== 'application/pdf') {
        ElMessage.warning('请选择 PDF 文件')
        return
      }
      await processPdfFile(file)
    }

    const processPdfFile = async (file) => {
      loading.value = true
      originalPdfFile.value = file
      pageCropData.value = {}
      currentPage.value = -1

      try {
        const arrayBuffer = await file.arrayBuffer()

        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js')
        const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib
        if (!pdfjsLib) throw new Error('PDF.js 加载失败')

        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'

        const pdf = await pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: window.location.origin + '/cmaps/',
          cMapPacked: true,
          useSystemFonts: true
        }).promise

        currentPdf.value = pdf
        pages.value = []

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const thumbViewport = page.getViewport({ scale: 0.3 })
          const canvas = document.createElement('canvas')
          canvas.width = thumbViewport.width
          canvas.height = thumbViewport.height
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: thumbViewport }).promise

          pages.value.push({
            page,
            thumbnail: canvas.toDataURL('image/png'),
            pageNum: i,
            viewportScale: 1.5,
            width: page.view[2],
            height: page.view[3]
          })
        }

        if (pages.value.length > 0) {
          await nextTick()
          selectPage(0)
        }
      } catch (error) {
        console.error('PDF加载错误:', error)
        ElMessage.error('PDF加载失败: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    const selectPage = async (index) => {
      if (!pages.value[index]) return
      saveCurrentCropData()
      currentPage.value = index

      try {
        const pageData = pages.value[index]
        const page = pageData.page
        const scale = pageData.viewportScale || 1.5
        const viewport = page.getViewport({ scale })

        pdfCanvas.value.width = viewport.width
        pdfCanvas.value.height = viewport.height
        const ctx = pdfCanvas.value.getContext('2d')
        ctx.clearRect(0, 0, viewport.width, viewport.height)
        await page.render({ canvasContext: ctx, viewport }).promise

        initFabricCanvas(viewport.width, viewport.height)
        loadCropBox(index)
      } catch (error) {
        console.error('页面渲染错误:', error)
        ElMessage.error('页面渲染失败')
      }
    }

    const initFabricCanvas = (width, height) => {
      if (fabricCanvas.value) {
        fabricCanvas.value.clear()
        fabricCanvas.value.setDimensions({ width, height })
        const container = fabricCanvas.value.wrapperEl || fabricCanvas.value.getElement().parentElement
        if (container) {
          container.style.width = width + 'px'
          container.style.height = height + 'px'
        }
        return
      }
      if (!overlayCanvas.value) return

      fabricCanvas.value = new Canvas(overlayCanvas.value, {
        width,
        height,
        backgroundColor: 'transparent',
        preserveObjectStacking: true
      })
      fabricCanvas.value.uniformScaling = false

      const container = fabricCanvas.value.wrapperEl || fabricCanvas.value.getElement().parentElement
      if (container) {
        container.style.position = 'absolute'
        container.style.top = '0'
        container.style.left = '0'
        container.style.width = width + 'px'
        container.style.height = height + 'px'
      }

      fabricCanvas.value.on('object:modified', saveCurrentCropData)
      fabricCanvas.value.on('object:scaling', (e) => {
        if (e.target.dataType !== 'cropbox') return
        if (cropMode.value === 'free') return
        const [rw, rh] = cropMode.value.split(':').map(Number)
        const targetRatio = rw / rh
        const obj = e.target
        const currentWidth = obj.width * obj.scaleX
        const targetHeight = currentWidth / targetRatio
        obj.scaleY = targetHeight / obj.height
        obj.setCoords()
      })
    }

    const saveCurrentCropData = () => {
      if (currentPage.value < 0 || !fabricCanvas.value) return
      const cropObj = fabricCanvas.value.getObjects().find(o => o.dataType === 'cropbox')
      if (cropObj) {
        pageCropData.value[currentPage.value] = {
          left: cropObj.left,
          top: cropObj.top,
          width: cropObj.width * cropObj.scaleX,
          height: cropObj.height * cropObj.scaleY
        }
      }
    }

    const loadCropBox = (index) => {
      const data = pageCropData.value[index]
      if (!data || !fabricCanvas.value) return

      const rect = new Rect({
        left: data.left,
        top: data.top,
        width: data.width,
        height: data.height,
        fill: 'transparent',
        stroke: '#f56c6c',
        strokeWidth: 2,
        strokeDashArray: [8, 4],
        selectable: true,
        hasControls: true,
        hasBorders: true,
        originX: 'left',
        originY: 'top',
        dataType: 'cropbox'
      })
      fabricCanvas.value.add(rect)
      fabricCanvas.value.setActiveObject(rect)
      fabricCanvas.value.renderAll()
    }

    const addCropBox = () => {
      if (!fabricCanvas.value || !pdfCanvas.value) return
      const old = fabricCanvas.value.getObjects().find(o => o.dataType === 'cropbox')
      if (old) fabricCanvas.value.remove(old)

      const pw = pdfCanvas.value.width
      const ph = pdfCanvas.value.height
      // 默认宽度填满PDF，高度按比例
      let w = pw
      let h = ph
      if (cropMode.value !== 'free') {
        const [rw, rh] = cropMode.value.split(':').map(Number)
        h = w / (rw / rh)
        // 如果高度超出页面，按页面高度反推宽度
        if (h > ph) {
          h = ph
          w = h * (rw / rh)
        }
      }
      const left = 0
      const top = 0

      const rect = new Rect({
        left,
        top,
        width: w,
        height: h,
        fill: 'transparent',
        stroke: '#f56c6c',
        strokeWidth: 2,
        strokeDashArray: [8, 4],
        selectable: true,
        hasControls: true,
        hasBorders: true,
        originX: 'left',
        originY: 'top',
        dataType: 'cropbox'
      })
      fabricCanvas.value.add(rect)
      fabricCanvas.value.setActiveObject(rect)
      fabricCanvas.value.renderAll()
      saveCurrentCropData()
    }

    const clearAllCropBoxes = () => {
      pageCropData.value = {}
      if (fabricCanvas.value) {
        const old = fabricCanvas.value.getObjects().find(o => o.dataType === 'cropbox')
        if (old) {
          fabricCanvas.value.remove(old)
          fabricCanvas.value.renderAll()
        }
      }
      ElMessage.success('已清除所有页面裁剪框')
    }

    const applyCropToAllPages = () => {
      const currentCrop = pageCropData.value[currentPage.value]
      if (!currentCrop) {
        ElMessage.warning('当前页面没有裁剪框')
        return
      }
      for (let i = 0; i < pages.value.length; i++) {
        if (i === currentPage.value) continue
        pageCropData.value[i] = {
          left: currentCrop.left,
          top: currentCrop.top,
          width: currentCrop.width,
          height: currentCrop.height
        }
      }
      ElMessage.success('已应用到所有页面')
    }

    const clearCropBox = () => {
      if (!fabricCanvas.value) return
      const old = fabricCanvas.value.getObjects().find(o => o.dataType === 'cropbox')
      if (old) {
        fabricCanvas.value.remove(old)
        fabricCanvas.value.renderAll()
      }
      delete pageCropData.value[currentPage.value]
    }

    const toggleAddCrop = () => {
      if (currentPageHasCrop.value) {
        clearCropBox()
        ElMessage.success('已清除当前页裁剪框')
      } else {
        addCropBox()
      }
    }

    const downloadBlob = (blob, filename) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }

    const alignCropWidth = () => {
      if (!fabricCanvas.value || !pdfCanvas.value) return
      const cropObj = fabricCanvas.value.getObjects().find(o => o.dataType === 'cropbox')
      if (!cropObj) {
        ElMessage.warning('请先添加裁剪框')
        return
      }
      const pw = pdfCanvas.value.width
      let newHeight = cropObj.height * cropObj.scaleY
      if (cropMode.value !== 'free') {
        const [rw, rh] = cropMode.value.split(':').map(Number)
        newHeight = pw / (rw / rh)
      }
      cropObj.set({ left: 0, width: pw, height: newHeight, scaleX: 1, scaleY: 1 })
      cropObj.setCoords()
      fabricCanvas.value.renderAll()
      saveCurrentCropData()
      ElMessage.success('宽度已填满页面')
    }

    const alignCropHeight = () => {
      if (!fabricCanvas.value || !pdfCanvas.value) return
      const cropObj = fabricCanvas.value.getObjects().find(o => o.dataType === 'cropbox')
      if (!cropObj) {
        ElMessage.warning('请先添加裁剪框')
        return
      }
      const ph = pdfCanvas.value.height
      let newWidth = cropObj.width * cropObj.scaleX
      if (cropMode.value !== 'free') {
        const [rw, rh] = cropMode.value.split(':').map(Number)
        newWidth = ph * (rw / rh)
      }
      cropObj.set({ top: 0, width: newWidth, height: ph, scaleX: 1, scaleY: 1 })
      cropObj.setCoords()
      fabricCanvas.value.renderAll()
      saveCurrentCropData()
      ElMessage.success('高度已填满页面')
    }

    const exportCroppedPdf = async () => {
      if (!originalPdfFile.value) {
        ElMessage.warning('请先上传PDF文件')
        return
      }
      saveCurrentCropData()

      const operations = []
      for (let i = 0; i < pages.value.length; i++) {
        const crop = pageCropData.value[i]
        if (crop) {
          const p = pages.value[i]
          const scale = p.viewportScale || 1.5
          operations.push({
            type: 'crop',
            page: i,
            bbox: [crop.left, crop.top, crop.width, crop.height],
            scale
          })
        }
      }

      if (operations.length === 0) {
        ElMessage.warning('没有设置裁剪区域')
        return
      }

      try {
        ElMessage.info('正在裁剪PDF...')
        const res = await editPdf(originalPdfFile.value, operations)
        const filename = res.headers['content-disposition']?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)?.[1]?.replace(/['"]/g, '') || '裁剪后.pdf'
        downloadBlob(new Blob([res.data], { type: 'application/pdf' }), filename)
        ElMessage.success('裁剪导出成功')
      } catch (e) {
        console.error(e)
        ElMessage.error('导出失败: ' + e.message)
      }
    }

    const exportCropAndSplit = async () => {
      if (!originalPdfFile.value) {
        ElMessage.warning('请先上传PDF文件')
        return
      }
      saveCurrentCropData()

      const operations = []
      for (let i = 0; i < pages.value.length; i++) {
        const crop = pageCropData.value[i]
        if (crop) {
          const p = pages.value[i]
          const scale = p.viewportScale || 1.5
          operations.push({
            type: 'crop',
            page: i,
            bbox: [crop.left, crop.top, crop.width, crop.height],
            scale
          })
        }
      }

      if (operations.length === 0) {
        ElMessage.warning('没有设置裁剪区域')
        return
      }

      try {
        ElMessage.info('正在裁剪并拆分...')
        const cropRes = await editPdf(originalPdfFile.value, operations)
        const croppedFile = new File([cropRes.data], 'cropped.pdf', { type: 'application/pdf' })

        const totalPages = pages.value.length
        const pageIndices = Array.from({ length: totalPages }, (_, i) => i)
        const splitRes = await splitPdf(croppedFile, pageIndices)
        downloadBlob(new Blob([splitRes.data], { type: 'application/zip' }), '裁剪拆分.zip')
        ElMessage.success('裁剪拆分导出成功')
      } catch (e) {
        console.error(e)
        ElMessage.error('导出失败: ' + e.message)
      }
    }

    const exportSplitPdf = async () => {
      if (!originalPdfFile.value) {
        ElMessage.warning('请先上传PDF文件')
        return
      }
      try {
        ElMessage.info('正在拆分页面...')
        const totalPages = pages.value.length
        const pageIndices = Array.from({ length: totalPages }, (_, i) => i)
        const res = await splitPdf(originalPdfFile.value, pageIndices)
        downloadBlob(new Blob([res.data], { type: 'application/zip' }), '拆分页面.zip')
        ElMessage.success('拆分导出成功')
      } catch (e) {
        console.error(e)
        ElMessage.error('拆分失败: ' + e.message)
      }
    }

    return {
      fileInput,
      pdfCanvas,
      overlayCanvas,
      loading,
      currentPdf,
      pages,
      currentPage,
      pageCropData,
      cropMode,
      uploadPdf,
      handleFileUpload,
      selectPage,
      addCropBox,
      currentPageHasCrop,
      allPagesHaveCrop,
      alignCropWidth,
      alignCropHeight,
      applyCropToAllPages,
      clearAllCropBoxes,
      toggleAddCrop,
      exportCroppedPdf,
      exportCropAndSplit,
      exportSplitPdf
    }
  }
}
</script>

<style scoped>
.pdf-tools-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f7fa;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.header h1 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧页面列表 */
.page-list-panel {
  width: 180px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-title {
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #e4e7ed;
}

.pages {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.page-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  margin-bottom: 8px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.page-item:hover {
  background: #f5f7fa;
}

.page-item.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.page-item img {
  width: 100%;
  border-radius: 2px;
  border: 1px solid #dcdfe6;
  background: #fff;
}

.page-item span {
  margin-top: 4px;
  font-size: 12px;
  color: #606266;
}

/* 中间预览区域 */
.editor-area {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  overflow: auto;
  background: #f5f7fa;
}

.canvas-wrapper {
  position: relative;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  background: #fff;
}

.pdf-canvas {
  display: block;
}

.overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
}

.welcome-message {
  text-align: center;
}

/* 右侧操作面板 */
.operation-panel {
  width: 220px;
  background: #fff;
  border-left: 1px solid #e4e7ed;
  padding: 16px;
  overflow-y: auto;
}

.card-header {
  font-weight: 600;
  font-size: 14px;
}

.hint-text {
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
  line-height: 1.5;
}
</style>
