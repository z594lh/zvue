<template>
  <div id="app">
    <!-- 这里是当前组件的内容 -->
    <JsonFormatter />

  </div>
</template>

<script>
import JsonFormatter from '@/components/JsonFormatter.vue'

export default {
  name: 'app',
  components: {
    JsonFormatter
  }
}
</script>