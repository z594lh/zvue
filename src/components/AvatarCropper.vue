<template>
  <el-dialog
    v-model="dialogVisible"
    title="裁剪头像"
    width="520px"
    :close-on-click-modal="false"
    destroy-on-close
    @closed="handleClose"
  >
    <div class="cropper-container">
      <div class="cropper-wrapper">
        <img ref="cropperImage" :src="imageSrc" class="cropper-img" />
      </div>
      <div class="cropper-preview-wrapper">
        <div class="preview-label">预览</div>
        <div ref="previewBox" class="preview-circle"></div>
      </div>
    </div>

    <div class="cropper-toolbar">
      <el-button size="small" @click="rotate(-90)">
        <span class="icon">↺</span> 左转
      </el-button>
      <el-button size="small" @click="rotate(90)">
        <span class="icon">↻</span> 右转
      </el-button>
      <el-button size="small" @click="zoom(0.1)">
        <span class="icon">+</span> 放大
      </el-button>
      <el-button size="small" @click="zoom(-0.1)">
        <span class="icon">−</span> 缩小
      </el-button>
      <el-button size="small" @click="reset">
        <span class="icon">⟲</span> 重置
      </el-button>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleConfirm">
        确认
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'

export default {
  name: 'AvatarCropper',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    imageSrc: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue', 'confirm', 'cancel'],
  setup(props, { emit }) {
    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val)
    })

    const cropperImage = ref(null)
    const previewBox = ref(null)
    const cropper = ref(null)
    const loading = ref(false)

    const initCropper = () => {
      if (!cropperImage.value || !props.imageSrc) return

      if (cropper.value) {
        cropper.value.destroy()
        cropper.value = null
      }

      cropper.value = new Cropper(cropperImage.value, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        preview: previewBox.value || undefined,
        minContainerWidth: 280,
        minContainerHeight: 280
      })
    }

    const rotate = (deg) => {
      cropper.value?.rotate(deg)
    }

    const zoom = (ratio) => {
      cropper.value?.zoom(ratio)
    }

    const reset = () => {
      cropper.value?.reset()
    }

    const handleConfirm = () => {
      if (!cropper.value) return
      loading.value = true

      const canvas = cropper.value.getCroppedCanvas({
        width: 400,
        height: 400,
        fillColor: '#fff',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      })

      canvas.toBlob(
        (blob) => {
          loading.value = false
          if (blob) {
            emit('confirm', blob)
            dialogVisible.value = false
          }
        },
        'image/jpeg',
        0.92
      )
    }

    const handleClose = () => {
      if (cropper.value) {
        cropper.value.destroy()
        cropper.value = null
      }
      emit('cancel')
    }

    watch(() => props.imageSrc, (val) => {
      if (val && dialogVisible.value) {
        nextTick(() => {
          initCropper()
        })
      }
    })

    watch(() => props.modelValue, (val) => {
      if (val && props.imageSrc) {
        nextTick(() => {
          initCropper()
        })
      }
    })

    onUnmounted(() => {
      if (cropper.value) {
        cropper.value.destroy()
        cropper.value = null
      }
    })

    return {
      dialogVisible,
      cropperImage,
      previewBox,
      loading,
      rotate,
      zoom,
      reset,
      handleConfirm,
      handleClose
    }
  }
}
</script>

<style scoped>
.cropper-container {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.cropper-wrapper {
  flex: 1;
  height: 320px;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
}

.cropper-img {
  display: block;
  max-width: 100%;
}

.cropper-preview-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 120px;
  flex-shrink: 0;
}

.preview-label {
  font-size: 13px;
  color: #666;
}

.preview-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 2px solid #e0e0e0;
  background: #f5f5f5;
  overflow: hidden;
}

.cropper-toolbar {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.cropper-toolbar .icon {
  margin-right: 4px;
  font-size: 14px;
}

/* 让 cropper 在容器里正常显示 */
:deep(.cropper-container-cropperjs) {
  width: 100%;
  height: 100%;
}

:deep(.cropper-crop-box) {
  border-radius: 0;
}

/* 响应式 */
@media (max-width: 600px) {
  .cropper-container {
    flex-direction: column;
    align-items: center;
  }

  .cropper-wrapper {
    width: 100%;
    height: 280px;
  }

  .cropper-preview-wrapper {
    flex-direction: row;
    width: 100%;
    justify-content: center;
  }
}
</style>
