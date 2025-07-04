<template>
  <div id="app">
    <tencent-translator /> <!-- 使用 kebab-case 形式 -->
  </div>
</template>

<script>
import TencentTranslator from './components/TencentTranslator.vue'

export default {
  name: 'App',
  components: {
    TencentTranslator
  }
}
</script>