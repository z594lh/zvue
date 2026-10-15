// 仅按原广告金额判断ACOS；不把无销售或缺数据伪装成有效0%。
function amount(value) {
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function advertisingAcos(spendValue, salesValue) {
  const spend = amount(spendValue), sales = amount(salesValue)
  const base = 'ACOS＝广告花费÷广告销售额×100%，分母不是总销量。'
  const unavailable = (note, tone, tip) => ({ value: null, text: '—', note, tone, tip: base + tip })
  if (spend === null || sales === null) return unavailable('数据不完整', 'muted', '广告花费或广告销售额缺失/无效，暂不能计算，不能当作0%。')
  if (sales === 0) {
    return spend > 0
      ? unavailable('有花费无广告销售', 'danger', '本期已产生广告花费，但暂未记录广告销售额，无法计算ACOS，不代表效率好；近期广告数据可能延迟回补。')
      : unavailable('无广告花费', 'muted', '本期广告花费和广告销售额均为0，没有可计算的比率，不代表投放高效。')
  }
  const value = spend / sales * 100
  if (!Number.isFinite(value)) return unavailable('数据异常', 'muted', '金额比值异常，暂不能计算。')
  return {
    value, text: value.toFixed(2) + '%', note: spend === 0 ? '无广告花费' : '',
    tone: value > 50 ? 'danger' : value > 30 ? 'warning' : 'success',
    tip: base + (spend === 0
      ? '本期有广告销售额、记录的广告花费为0，因此0%是有效比率；不保证没有后续费用回补。'
      : '按本行/所选范围的广告总花费÷广告总销售额计算，不直接平均各SKU比率。颜色仅为阅读参考，是否盈利还需结合产品利润空间。')
  }
}
