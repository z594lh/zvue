<template>
  <ChangeHistory scope="group" :shop-id="shopId" :campaign-id="campaignId" :ad-group-id="adGroupId" />
</template>

<script setup>
/* eslint-disable no-undef */
import ChangeHistory from '@/components/cpc/ChangeHistory.vue'
defineProps({
  shopId: { type: [Number, String], default: null },
  campaignId: { type: [Number, String], required: true },
  adGroupId: { type: [Number, String], required: true }
})
</script>
