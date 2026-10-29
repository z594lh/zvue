import { computed, ref } from 'vue'
import { TAB_CACHE_LIMIT, tabPolicy } from '@/config/workspaceTabs'

export const tabs=ref([]),pendingTabAction=ref(false)
export const navigationTarget=ref('')
export const excludedPaths=['/','/login','/403','/json','/company','/fanyi']
export const TabContext=Symbol('工作区页签实例')
const protections=new Map(),approved=new Set(),captures=new Map()
let sequence=0,clock=0
export const instanceName=id=>`WorkspaceTab_${id}`
export const cachedViews=computed(()=>tabs.value.filter(tab=>tab.resident).map(tab=>instanceName(tab.instanceId)))
export function currentTab(route){return tabs.value.find(tab=>tab.identity===tabPolicy(route).identity)}
export function registerProtection(id,value){protections.set(id,value);return()=>{if(protections.get(id)===value)protections.delete(id)}}
export function operationApproved(id){return approved.has(id)}
export function registerScrollCapture(id,capture){captures.set(id,capture);return()=>captures.delete(id)}
export function captureWorkspaceScroll(){for(const capture of captures.values())capture()}
function protectedTab(tab){try{const guard=protections.get(tab.instanceId);return guard?!!guard.protected():!tab.evictable}catch{return true}}
/** 仅回收非当前、无编辑/在途保护的冷缓存，保留标签。 */
export function trimCache(current){
  const residents=tabs.value.filter(tab=>tab.resident)
  const candidates=residents.filter(tab=>tab.id!==current?.id && !protectedTab(tab)).sort((a,b)=>a.used-b.used)
  while(residents.filter(tab=>tab.resident).length>TAB_CACHE_LIMIT && candidates.length)candidates.shift().resident=false
}
export function addTab(route){
  if(excludedPaths.includes(route.path))return
  const policy=tabPolicy(route)
  if(policy.group)tabs.value=tabs.value.filter(tab=>tab.group!==policy.group || tab.identity===policy.identity)
  let tab=currentTab(route)
  if(!tab){tabs.value.push({id:++sequence,instanceId:++sequence,identity:policy.identity,group:policy.group,path:route.path,fullPath:route.fullPath,title:route.meta?.title || route.name || route.path,query:route.query,resident:policy.cache,cacheable:policy.cache,evictable:policy.evictable,used:++clock,closable:true});tab=currentTab(route)}
  else{tab.fullPath=route.fullPath;tab.path=route.path;tab.query=route.query;tab.title=route.meta?.title || route.name || route.path;tab.used=++clock;if(!tab.resident && policy.cache){tab.instanceId=++sequence;tab.resident=true}}
  trimCache(tab);return tab
}
export function resetWorkspace(){tabs.value=[];approved.clear();protections.clear();captures.clear()}
export async function approveTabs(selected,action){for(const tab of selected){const protection=protections.get(tab.instanceId);if(protection && !await protection.confirm(action))return false}return true}
export async function withTabAction(action){if(pendingTabAction.value)return false;pendingTabAction.value=true;try{return await action()}finally{approved.clear();pendingTabAction.value=false}}
export function approveNavigation(selected){selected.forEach(tab=>approved.add(tab.instanceId))}
export function refreshInstance(tab){tab.instanceId=++sequence;tab.resident=tab.cacheable;tab.used=++clock}
