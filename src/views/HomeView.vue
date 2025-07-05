<template>
  <div id="app">
    <!-- 这里是当前组件的内容 -->
    <TencentTranslator />

  </div>
</template>

<script>
import TencentTranslator from '@/components/TencentTranslator.vue'

export default {
  name: 'app',
  components: {
    TencentTranslator
  }
}
</script>