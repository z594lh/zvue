<template>
  <CreationWizard :key="String(route.params.id)" :campaign-id="String(route.params.id)" />
</template>

<script setup>
import { useRoute } from 'vue-router'
import CreationWizard from '@/components/cpc/CreationWizard.vue'
const route = useRoute()
</script>
