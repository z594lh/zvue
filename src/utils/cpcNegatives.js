// 两层共用的请求身份；广告 ID 使用字符串，避免长整数精度丢失。
export function negativeContext(props) {
  const value = {
    shop_id: props.shopId,
    campaign_id: String(props.campaignId || ''),
    scope: props.scope
  }
  if (props.scope === 'group') value.ad_group_id = String(props.adGroupId || '')
  return value
}

export function negativePayload(context, item) {
  const result = { ...item, campaignId: context.campaign_id, state: 'ENABLED' }
  if (context.scope === 'group') result.adGroupId = context.ad_group_id
  return result
}

export function negativeResponse(response) {
  const body = response?.data || {}
  if (!['success', 'partial'].includes(body.status)) {
    const details = (body.data?.errors || []).map(e => `第 ${e.index + 1} 条：${e.message}`).join('；')
    throw new Error(body.message || details || '操作失败，请同步核实')
  }
  return body.data || {}
}

export function negativeError(error) {
  const body = error?.response?.data
  return body?.message || (body?.data?.errors || []).map(e => `第 ${e.index + 1} 条：${e.message}`).join('；') ||
    error?.message || '请求失败，请同步核实后再操作'
}
