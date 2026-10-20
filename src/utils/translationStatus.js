// 后台补译状态统一展示；页面不发起翻译请求。
export function translationStatus(row) {
  if(row?.translation)return row.translation
  return ({pending:'待翻译',running:'翻译中',retry:'稍后重试',blocked:'翻译服务待处理',failed:'翻译暂未完成',unavailable:'翻译未初始化',skipped:'—'})[row?.translation_status] || '待翻译'
}
export function translationTip(row) {
  if(row?.translation_source==='baidu')return '百度机器翻译 · 后台批量补译，供参考'
  if(row?.translation_source==='source')return '来源文件提供的译文'
  return '后台计划任务补译完整词组，页面访问不会触发翻译；可稍后重读本地数据'
}
