// 亏损回收比例由后端按未舍入金额分档；低回收深红，高回收浅红。
const recoveryTones = [
  ['#991b1b', '#ffffff'], ['#b91c1c', '#ffffff'], ['#c92727', '#ffffff'],
  ['#fca5a5', '#7f1d1d'], ['#fdb4b4', '#7f1d1d'], ['#fecaca', '#7f1d1d'],
  ['#fdd5d5', '#7f1d1d'], ['#fee2e2', '#7f1d1d'], ['#ffe8e8', '#7f1d1d'],
  ['#fff1f2', '#7f1d1d']
]

export function recoveryToneStyle(decision) {
  const band = decision?.recovery_band
  if (decision?.code !== 'recoverable' || !Number.isInteger(band) || band < 0 || band > 9) return {}
  const [background, color] = recoveryTones[band]
  return {
    '--el-tag-bg-color': background, '--el-tag-border-color': background,
    '--el-tag-text-color': color, '--el-color-error': color,
    '--el-color-error-light-9': background
  }
}
