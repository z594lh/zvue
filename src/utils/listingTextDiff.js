// 纯文本差异，不解释HTML；前值未知、选择器不同及局部删除不强行作整字段比较。
function values(value) {
  if (value == null) return []
  if (typeof value === 'string') return [{value}]
  return Array.isArray(value) && value.every(row => row && typeof row.value === 'string') ? value : null
}
const selector = row => JSON.stringify(Object.entries(row || {}).filter(([key]) => key !== 'value').sort(([a], [b]) => a.localeCompare(b)))
export function textDiffEntries(changes = []) {
  const entries = []
  for (const change of changes) {
    if (change.kind !== 'text' || !change.before_known || change.action === 'omitted' || (change.path && change.path.split('/').length !== 3)) continue
    if (change.submitted_operations?.some(op => op.op === 'delete' && op.value != null)) continue
    const before = values(change.before), after = values(change.after)
    if (!before || !after || (before.length && after.length && before.some((row, i) => after[i] && selector(row) !== selector(after[i])))) continue
    for (let i = 0; i < Math.max(before.length, after.length, 1); i++) {
      entries.push({field: change.field, label: `${change.label || change.field || '文本'}${Math.max(before.length, after.length) > 1 || change.field === 'bullet_point' ? ` · 第${i + 1}条` : ''}`, before: before[i]?.value || '', after: after[i]?.value || ''})
    }
  }
  return entries
}

const tokens = value => value.match(/[A-Za-z0-9_]+|\s+|[^\s]/gu) || []
// 两端先剥离一致部分，仅在有界中段做LCS。极端长文退化为中段替换，不丢文本或阻塞界面。
export function textDiffSegments(before, after) {
  const a = tokens(before), b = tokens(after), parts = []
  const push = (type, text) => { if (!text) return; const last = parts[parts.length - 1]; if (last?.type === type) last.text += text; else parts.push({type, text}) }
  let first = 0, endA = a.length, endB = b.length
  while (first < endA && first < endB && a[first] === b[first]) first++
  while (endA > first && endB > first && a[endA - 1] === b[endB - 1]) { endA--; endB-- }
  push('equal', a.slice(0, first).join(''))
  const n = endA - first, m = endB - first
  if (!n || !m || n * m > 400000) { push('remove', a.slice(first, endA).join('')); push('add', b.slice(first, endB).join('')) }
  else {
    const table = Array.from({length: n + 1}, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) table[i][j] = a[first + i] === b[first + j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    let i = 0, j = 0
    while (i < n || j < m) {
      if (i < n && j < m && a[first + i] === b[first + j]) { push('equal', a[first + i]); i++; j++ }
      else if (i < n && (j === m || table[i + 1][j] >= table[i][j + 1])) { push('remove', a[first + i]); i++ }
      else { push('add', b[first + j]); j++ }
    }
  }
  push('equal', a.slice(endA).join(''))
  return parts
}

function contextText(text, index, length, expanded) {
  const chars = Array.from(text)
  if (expanded || chars.length <= 140) return text
  const head = index ? 55 : 0, tail = index < length - 1 ? 55 : 0
  return `${chars.slice(0, head).join('')} …（省略${chars.length - head - tail}字未变内容）… ${tail ? chars.slice(-tail).join('') : ''}`
}
export function textDiffRows(entry, expanded = false) {
  const segments = textDiffSegments(entry.before, entry.after)
  if (entry.before === entry.after) return [{type: 'equal', parts: [{text: '文本内容未变化（可能仅属性标签调整）', changed: false}]}]
  return ['remove', 'add'].filter(type => type === 'remove' ? !!entry.before : !!entry.after).map(type => ({type, parts: segments.flatMap((part, index) => part.type !== 'equal' && part.type !== type ? [] : [{text: part.type === 'equal' ? contextText(part.text, index, segments.length, expanded) : part.text, changed: part.type === type}])}))
}
export const diffRowText = row => `${row.type === 'remove' ? '−' : row.type === 'add' ? '+' : '='} ${row.parts.map(part => part.text).join('')}`

export function operationTextSummary(operation) {
  if (operation.kind === 'ads') return operation.display?.summary || operation.summary
  const fields = new Set(textDiffEntries(operation.text_changes).map(entry => entry.field))
  if (!fields.size || !Array.isArray(operation.change_summaries)) return operation.summary
  return operation.change_summaries.filter(item => !fields.has(item.field)).map(item => item.text).join('\n')
}
