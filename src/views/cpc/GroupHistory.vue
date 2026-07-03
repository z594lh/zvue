<template>
  <div class="group-section">
    <el-empty description="历史记录功能开发中" />
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true },
  adGroupId: { type: [Number, String], required: true }
})
</script>

<style scoped>
.group-section { background: #fff; padding: 40px 0; }
</style>
