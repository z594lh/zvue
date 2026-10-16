<template>
  <NegativePanel v-bind="$attrs" />
</template>

<script setup>
// 两级复用同一套否定交互，默认仍为广告组级。
import NegativePanel from '@/components/cpc/NegativePanel.vue'
</script>
