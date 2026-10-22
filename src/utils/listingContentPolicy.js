// 前端只使用服务端下发的数值，避免标题/亮点或字符/字节口径再次分叉；后端仍是最终校验。
export const listingCharCount = value => Array.from(value || '').length
export const listingByteCount = value => new TextEncoder().encode(value || '').length

// 检查一条的码点/字节界限；保留原文及超限内容，绝不自动截断。
export function listingRowErrors(value, rule = {}) {
  const errors = [], count = listingCharCount(value), bytes = listingByteCount(value)
  if (!String(value || '').trim()) errors.push('内容不能为空')
  if (rule.min_chars !== undefined && count < rule.min_chars) errors.push(`至少${rule.min_chars}字符`)
  if (rule.max_chars !== undefined && count > rule.max_chars) errors.push(`最多${rule.max_chars}字符，当前${count}`)
  if (rule.max_utf8_bytes !== undefined && bytes > rule.max_utf8_bytes) errors.push(`最多${rule.max_utf8_bytes}个UTF8字节，当前${bytes}（含空格）`)
  return errors
}

// 按原语言分别计条数；联动检查亮点所需的当前标题，不替用户修改其他字段。
export function listingDraftErrors(field, rows, snapshot) {
  const rule = snapshot?.fields?.[field]?.constraints
  if (!rule) return ['当前规范尚未读取，请重读后再保存']
  const messages = [], groups = new Map()
  const checks = snapshot.content_policy?.text_checks || {}
  rows.forEach((row, index) => {
    messages.push(...listingRowErrors(row.value, rule).map(text => `第${index + 1}条：${text}`))
    const language = row.language_tag || snapshot.default_language
    groups.set(language, (groups.get(language) || 0) + 1)
    const value = row.value || '', prefix = `第${index + 1}条：`
    const controlled = field === 'product_description' ? value.replaceAll('\n','') : value
    if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(controlled)) messages.push(prefix+'包含换行或不可见控制字符；仅描述允许换行')
    if (/<\s*[!/a-zA-Z][^>]*>/.test(value)) messages.push(prefix+'不能包含HTML或脚本')
    if (/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/u.test(value)) messages.push(prefix+'不能包含emoji或装饰符号')
    if (/https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value) || (checks.restricted_pattern && new RegExp(checks.restricted_pattern,'i').test(value))) messages.push(prefix+'不能包含外链、邮箱、促销或退款保证')
    if (field === 'item_name') {
      const brand = snapshot.content_policy?.brand
      const text = typeof brand==='string' && brand ? value.split(brand).join('') : value
      if (Array.from(checks.title_symbols || '').some(symbol=>text.includes(symbol))) messages.push(prefix+'含标题禁止符号')
      if (String(language).toLowerCase().startsWith('en')) {
        const words = value.toLowerCase().match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) || [], counts = new Map(), stop = new Set(checks.title_stop_words || [])
        words.forEach(word=>counts.set(word,(counts.get(word) || 0)+1))
        if ([...counts].some(([word,count])=>count>2 && !stop.has(word))) messages.push(prefix+'同一实词不得超过两次')
      }
    }
    if (field === 'bullet_point' && Array.from(checks.bullet_symbols || '').some(symbol=>value.includes(symbol))) messages.push(prefix+'包含五点禁止的特殊字符')
    if (['bullet_point','generic_keyword'].includes(field) && /\bB0[A-Z0-9]{8}\b/i.test(value)) messages.push(prefix+'不能填入ASIN编号')
    if (field === 'generic_keyword') {
      const words = value.toLowerCase().match(/[\p{L}\p{N}_]+(?:['’-][\p{L}\p{N}_]+)*/gu) || []
      if (words.length!==new Set(words).size) messages.push(prefix+'后台搜索词不要重复同一词')
    }
  })
  if (!rows.length) messages.push('内容不能为空，清除请使用“清除本项”')
  for (const [language, count] of groups) {
    if (count < rule.min_items || count > rule.max_items) messages.push(`${language}须为${rule.min_items}～${rule.max_items}条，当前${count}条`)
  }
  if (field === 'title_differentiation') {
    const titleLimit = snapshot.fields.item_name.constraints.max_chars
    for (const language of groups.keys()) {
      const titles = snapshot.fields.item_name.rows.filter(row => row.language_tag === language)
      if (!titles.length || titles.some(row => listingCharCount(row.value) > titleLimit)) messages.push(`请先把${language}当前标题改到${titleLimit}字符以内，再保存亮点`)
    }
  }
  return [...new Set(messages)]
}
