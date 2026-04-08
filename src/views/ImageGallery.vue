<template>
  <div class="ai-image-page">
    <GalleryList />
  </div>
</template>

<script>
// 这里的路径必须和你的硬盘文件名大小写完全一致
import GalleryList from '@/components/GalleryList.vue'

export default {
  name: 'ImageGalleryView', // 视图的名字
  components: {
    GalleryList // 注册新名字
  }
}
</script>