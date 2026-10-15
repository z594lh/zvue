<template>
  <el-tooltip :content="state.tip" placement="top" :show-after="150" :popper-style="{maxWidth:'360px',lineHeight:'1.7'}">
    <span class="advertising-acos" :class="`acos-${state.tone}`" tabindex="0">
      <strong class="acos-number">{{ state.text }}</strong>
      <small v-if="state.note" class="acos-note">{{ state.note }}</small>
    </span>
  </el-tooltip>
</template>

<script setup>
import { computed } from 'vue'
import { advertisingAcos } from '@/services/advertisingAcos.js'
const props = defineProps({ spend: {type:[String,Number],default:null}, sales: {type:[String,Number],default:null} })
const state = computed(() => advertisingAcos(props.spend, props.sales))
</script>

<style scoped>
.advertising-acos{display:inline-block;max-width:100%;line-height:1.5;cursor:help}
.acos-number{font-size:inherit;font-weight:600}
.acos-note{display:block;white-space:normal;font-size:11px;font-weight:500}
.acos-danger{color:#dc2626}
.acos-warning{color:#b45309}
.acos-success{color:#15803d}
.acos-muted{color:#8793a5}
</style>
