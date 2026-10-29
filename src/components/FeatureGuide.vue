<template>
  <span ref="anchor" class="feature-guide-anchor" @click="dismiss">
    <FeatureGuidePopover :visible="visible" :placement="placement" :title="title" :description="description" :suppressed="suppressed" @suppress="suppress" @dismiss="dismiss">
      <template #reference><span class="feature-guide-trigger"><slot :visible="visible" /></span></template>
    </FeatureGuidePopover>
  </span>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import FeatureGuidePopover from './FeatureGuidePopover.vue'

const props = defineProps({
  featureKey: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  placement: { type: String, default: 'bottom-start' }
})
const emit = defineEmits(['dismiss'])
const anchor = ref(null), inView = ref(false), closed = ref(false), suppressed = ref(true), active = ref(true)
const storageKey = `erp-feature-guide:${props.featureKey}`
const visible = computed(() => props.enabled && active.value && inView.value && !closed.value && !suppressed.value)
let observer

/** 点击入口或“知道了”仅关闭本次引导，由页面记住以免翻页后重复提示。 */
function dismiss() { closed.value = true; emit('dismiss') }

/** 沿图片编辑机制在当前浏览器保存偏好，两个新功能分别记录，不改业务配置。 */
function suppress(checked) {
  suppressed.value = checked
  try { if (checked) localStorage.setItem(storageKey, '1'); else localStorage.removeItem(storageKey) }
  catch { ElMessage.warning('浏览器未允许保存提醒设置，下次可能仍会提示') }
  if (checked) dismiss()
}

/** 同浏览器其他标签关闭提醒时同步隐藏，清理存储不影响业务。 */
function syncPreference(event) {
  if (event.key === storageKey || event.key === null) suppressed.value = event.newValue === '1'
}

onMounted(() => {
  try { suppressed.value = localStorage.getItem(storageKey) === '1' } catch { suppressed.value = false }
  window.addEventListener('storage', syncPreference)
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(entries => { inView.value = !!entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.8 }, { threshold: [0, 0.8, 1] })
    if (anchor.value) observer.observe(anchor.value)
  }
})
onActivated(() => { active.value = true })
onDeactivated(() => { active.value = false })
onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener('storage', syncPreference) })
</script>

<style scoped>
.feature-guide-anchor,.feature-guide-trigger{display:inline-flex;align-items:center;vertical-align:middle}
</style>
