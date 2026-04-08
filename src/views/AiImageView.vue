<template>
  <div class="ai-image-page">
    <AiImageGenerator />
  </div>
</template>

<script>
import AiImageGenerator from '@/components/AiImageGenerator.vue'

export default {
  name: 'AiImageView',
  components: {
    AiImageGenerator
  }
}
</script>