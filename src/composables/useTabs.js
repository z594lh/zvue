import { computed } from 'vue'
import { isNavigationFailure, useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { tabs, cachedViews, pendingTabAction, excludedPaths, addTab, approveTabs, approveNavigation, withTabAction, refreshInstance, currentTab } from './workspace/tabState'

/** 先检查及导航，成功后提交；取消操作不删除页签或缓存。 */
export function useTabs(){
  const router=useRouter(),route=useRoute()
  const activePath=computed(()=>route.path),activeId=computed(()=>currentTab(route)?.id)
  const byPath=key=>tabs.value.find(tab=>typeof key==='number'?tab.id===key:tab.path===key)
  const perform=action=>withTabAction(action).catch(()=>{ElMessage.error('页签操作未完成，原页面已保留，请重试');return false})
  async function closeTabs(selected,preferred){
    if(!selected.length)return true
    return perform(async()=>{
      const originalRoute=route.fullPath
      if(!await approveTabs(selected,'close'))return false
      if(route.fullPath!==originalRoute || selected.some(tab=>!tabs.value.some(item=>item.id===tab.id)))return false
      const removed=new Set(selected.map(tab=>tab.id)),remaining=tabs.value.filter(tab=>!removed.has(tab.id)),active=currentTab(route)
      if(active && removed.has(active.id)){
        approveNavigation(selected)
        const original=tabs.value.findIndex(tab=>tab.id===active.id),target=preferred || remaining[Math.min(original,remaining.length-1)]
        const result=await router.push(target?.fullPath || '/')
        if(isNavigationFailure(result))return false
      }
      tabs.value=tabs.value.filter(tab=>!removed.has(tab.id));return true
    })
  }
  const removeTab=path=>{const tab=byPath(path);return closeTabs(tab?[tab]:[])}
  async function refreshTab(path){const tab=byPath(path);if(!tab)return false;return perform(async()=>{if(!await approveTabs([tab],'refresh'))return false;if(!tabs.value.some(item=>item.id===tab.id))return false;refreshInstance(tab);return true})}
  function moveTab(path,toIndex){const item=byPath(path),index=tabs.value.indexOf(item);if(index<0)return;const next=[...tabs.value],tab=next.splice(index,1)[0];next.splice(Math.max(0,Math.min(toIndex,next.length)),0,tab);tabs.value=next}
  function closeOther(path){const keep=byPath(path);return keep?closeTabs(tabs.value.filter(tab=>tab.id!==keep.id),keep):false}
  function closeRight(path){const index=tabs.value.indexOf(byPath(path));return index<0?false:closeTabs(tabs.value.slice(index+1),byPath(path))}
  function closeLeft(path){const index=tabs.value.indexOf(byPath(path));return index<0?false:closeTabs(tabs.value.slice(0,index),byPath(path))}
  const closeAll=()=>closeTabs([...tabs.value])
  return {tabs,cachedViews,pendingTabAction,activePath,activeId,excludedPaths,addTab,removeTab,refreshTab,closeOther,closeRight,closeLeft,closeAll,moveTab}
}
