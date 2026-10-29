// 只维护当前窗口内存，不恢复整页刷新前或已关闭的页签。
export const TAB_CACHE_LIMIT = 12
/** 默认按路径共用；详情参数自然区分，特殊页面可声明查询身份或分组。 */
export function tabPolicy(route) {
  const policy=route.meta?.tabPolicy || {}
  const identity=policy.queryKeys?.length ? route.path+'?'+policy.queryKeys.map(key=>`${encodeURIComponent(key)}=${encodeURIComponent(String(route.query[key] || ''))}`).join('&') : route.path
  return {identity,group:policy.group || '',cache:policy.cache!==false,evictable:policy.evictable===true}
}
