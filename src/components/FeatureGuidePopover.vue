<template>
  <el-popover :visible="visible" :placement="placement" :width="width" popper-class="feature-guide-popover feature-guide-warning" :popper-options="popperOptions">
    <template #reference><span class="feature-guide-trigger"><slot name="reference" /></span></template>
    <div class="feature-guide-copy" role="note"><strong>{{ title }}</strong><p>{{ description }}</p></div>
    <div class="feature-guide-actions" @click.stop>
      <el-checkbox :model-value="suppressed" @change="value => emit('suppress',value)">不再提醒</el-checkbox>
      <div class="feature-guide-buttons"><el-button text type="primary" size="small" @click="emit('dismiss')">知道了</el-button><slot name="actions" /></div>
    </div>
  </el-popover>
</template>

<script setup>
// 统一功能引导外观；显隐条件、偏好键和业务快捷操作由调用方保持。
defineProps({visible:{type:Boolean,default:false},suppressed:{type:Boolean,default:false},title:{type:String,required:true},description:{type:String,required:true},placement:{type:String,default:'bottom-start'},width:{type:Number,default:280}})
const emit=defineEmits(['dismiss','suppress'])
const popperOptions={modifiers:[{name:'preventOverflow',options:{altAxis:true,tether:false,padding:12}}]}
</script>

<style scoped>
.feature-guide-trigger{display:inline-flex;align-items:center;vertical-align:middle}.feature-guide-copy strong{color:#79551b;font-size:14px}.feature-guide-copy p{margin:8px 0 12px;font-size:12px;color:#806d4d;white-space:pre-line;line-height:1.8}.feature-guide-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.feature-guide-actions :deep(.el-checkbox__label){font-size:12px}.feature-guide-buttons{display:flex;align-items:center;gap:6px}.feature-guide-buttons :deep(.el-button+.el-button){margin-left:0}
</style>
<style>
/* 所有功能引导气泡共用淡黄色外观及箭头；普通提示、数据预览弹层不受影响。 */
.el-popover.feature-guide-popover{background:#fff9e8;border:1px solid #efdb9f;box-shadow:0 5px 18px #7f632018;max-width:calc(100vw - 24px)}.feature-guide-popover .el-popper__arrow:before{background:#fff9e8;border-color:#efdb9f}
</style>
