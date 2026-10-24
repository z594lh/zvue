/** 全站唯一业务名称入口；默认和人工覆盖都从后端同一字典读取，不复制中文映射。 */
import { reactive,shallowRef } from 'vue'
import { getBusinessDictionary } from '@/services/api'

export const dictionaryState=reactive({groups:[],entries:[],ready:false,warning:''})
const index=shallowRef(new Map())
let expires=0,pending=null

/** 命名空间隔离相同英文代码；枚举按注册规则忽略大小写，字段路径保持原样。 */
function indexKey(group,code){
  const sensitive=dictionaryState.groups.find(g=>g.code===group)?.case_sensitive!==false
  return group+'\0'+(sensitive?code:code.toLowerCase())
}

/** 安装完整共享快照，使用Map避免外部英文代码成为对象原型属性。 */
export function applyDictionary(snapshot){
  if(!Array.isArray(snapshot?.groups) || !Array.isArray(snapshot?.list))throw new Error('业务字典响应不完整')
  dictionaryState.groups=snapshot.groups;dictionaryState.entries=snapshot.list
  const values=new Map()
  for(const row of snapshot.list){
    values.set(indexKey(row.group,row.code),row)
    for(const alias of row.aliases || [])values.set(indexKey(row.group,alias),row)
  }
  index.value=values;dictionaryState.ready=true;dictionaryState.warning=snapshot.warning || '';expires=Date.now()+15000
}

/** 去重加载；只读失败保留上次字典并提示，不复制本地默认或阻断业务提交。 */
export async function loadBusinessDictionary(force=false){
  if(!localStorage.getItem('auth_token'))return
  if(pending)return pending
  if(!force && dictionaryState.ready && Date.now()<expires)return
  pending=(async()=>{
    try{const {data}=await getBusinessDictionary();applyDictionary(data.data)}
    catch{dictionaryState.warning='业务字典读取失败，未识别名称保留原代码；请刷新或联系管理员。'}
    finally{pending=null}
  })()
  return pending
}

/** 查询词条及解释；不对商品名称、关键词或任意文本做字符串替换。 */
export function dictionaryEntry(group,code){return typeof code==='string'?index.value.get(indexKey(group,code)):undefined}

/** 统一翻译原代码，未知值保留原文；fallback仅由调用方明确提供。 */
export function dictionaryLabel(group,code,fallback){return dictionaryEntry(group,code)?.label ?? fallback ?? code}

/** 为既有只读映射提供兼容接口；枚举允许列表显式限制为内置项。 */
export function dictionaryMap(group,builtinOnly=false){
  return new Proxy(Object.create(null),{
    get(_target,key){const row=dictionaryEntry(group,key);return row && (!builtinOnly || row.builtin)?row.label:undefined},
    ownKeys(){return dictionaryState.entries.filter(r=>r.group===group && (!builtinOnly || r.builtin)).map(r=>r.code)},
    getOwnPropertyDescriptor(_target,key){const row=dictionaryEntry(group,key);return row && (!builtinOnly || row.builtin)?{enumerable:true,configurable:true}:undefined}
  })
}

/** 保存后同一窗口立即共用新快照，其他标签页仅收到刷新通知，不存业务数据。 */
export function publishDictionary(snapshot){applyDictionary(snapshot);localStorage.setItem('business_dictionary_changed',String(Date.now()))}

/** 清理登录账户切换时的内存快照，避免持有前用户读权限下的配置状态。 */
export function clearDictionary(){index.value=new Map();dictionaryState.entries=[];dictionaryState.groups=[];dictionaryState.ready=false;expires=0}

window.addEventListener('storage',event=>{
  if(event.key==='business_dictionary_changed')loadBusinessDictionary(true)
  if(event.key==='auth_token' && !event.newValue)clearDictionary()
})
