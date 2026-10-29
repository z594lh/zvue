import { inject, onBeforeUnmount, unref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { TabContext, operationApproved, registerProtection, tabs } from './tabState'
import { tabPolicy } from '@/config/workspaceTabs'

/** 业务页面声明草稿/在途状态，关闭、刷新和LRU复用同一判断。 */
export function useTabProtection({protected:isProtected,confirm,retainOnSwitch=()=>false}){
  const context=inject(TabContext,null)
  const remove=context?registerProtection(context.instanceId,{protected:()=>typeof isProtected==='function'?isProtected():unref(isProtected),confirm}):()=>{}
  // 退出登录后必须清除旧工作区，不能用编辑确认阻挡已结束的会话。
  onBeforeRouteLeave(to=>{
    if(to.path==='/login' || (context && operationApproved(context.instanceId)))return true
    const tab=context && tabs.value.find(item=>item.instanceId===context.instanceId),target=tabPolicy(to)
    // 行内编辑留在缓存时可直接切换；会被分组替换、无缓存或在途状态仍由业务检查。
    if(tab?.resident && retainOnSwitch() && !(tab.group && tab.group===target.group && tab.identity!==target.identity))return true
    return confirm('leave')
  })
  onBeforeUnmount(remove)
}
