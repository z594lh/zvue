<template>
  <keep-alive :include="cachedViews"><component :is="frame" :key="frameKey" :view="component" /></keep-alive>
</template>
<script setup>
import { computed, defineComponent, h, markRaw, nextTick, onActivated, onBeforeUnmount, onDeactivated, provide, ref, watch } from 'vue'
import { TabContext, addTab, cachedViews, currentTab, excludedPaths, instanceName, registerScrollCapture, resetWorkspace, tabs } from '@/composables/workspace/tabState'
const props=defineProps({component:{type:[Object,Function],default:null},route:{type:Object,required:true}})
const frames=new Map()
const passthrough=markRaw(defineComponent({name:'WorkspaceUncached',props:['view'],setup(frameProps){return()=>frameProps.view}}))
/** 包装组件给每个实例独立身份，通过公开include淘汰，不读Vue私有缓存。 */
function makeFrame(tab){
  const instanceId=tab.instanceId
  return markRaw(defineComponent({name:instanceName(instanceId),props:['view'],setup(frameProps){
    const root=ref(null),positions=new Map();let active=false,stamp=0,saved=null
    provide(TabContext,{id:tab.id,instanceId,active:computed(()=>currentTab(props.route)?.instanceId===instanceId)})
    const capture=()=>{if(active){saved={x:window.scrollX,y:window.scrollY};for(const element of positions.keys())if(!root.value?.contains(element))positions.delete(element)}}
    const removeCapture=registerScrollCapture(instanceId,capture)
    const record=event=>{if(active && event.target instanceof Element)positions.set(event.target,{x:event.target.scrollLeft,y:event.target.scrollTop})}
    onActivated(async()=>{active=true;const version=++stamp;await nextTick();requestAnimationFrame(()=>{if(!active || version!==stamp)return;for(const [element,value]of positions)if(root.value?.contains(element)){element.scrollLeft=value.x;element.scrollTop=value.y}window.scrollTo({left:saved?.x || 0,top:saved?.y || 0,behavior:'instant'})})})
    onDeactivated(()=>{active=false;stamp++})
    onBeforeUnmount(()=>{active=false;stamp++;positions.clear();removeCapture()})
    // 用实例props冻结当前VNode；不能用读取全局当前页面的动态slot，否则失活页面也会被替换。
    return()=>h('div',{ref:root,class:'workspace-tab-frame',onScrollCapture:record},[frameProps.view])
  }}))
}
watch(()=>props.route.fullPath,()=>{if(props.route.path==='/login')resetWorkspace();addTab(props.route)},{immediate:true,flush:'sync'})
const tab=computed(()=>currentTab(props.route))
const frameKey=computed(()=>tab.value?.instanceId || props.route.path)
const frame=computed(()=>{if(excludedPaths.includes(props.route.path) || !tab.value)return passthrough;const id=tab.value.instanceId;if(!frames.has(id))frames.set(id,makeFrame(tab.value));return frames.get(id)})
watch(()=>tabs.value.map(tab=>tab.resident?tab.instanceId:null),()=>{const live=new Set(tabs.value.filter(tab=>tab.resident).map(tab=>tab.instanceId));for(const id of frames.keys())if(!live.has(id))frames.delete(id)},{flush:'post'})
</script>
