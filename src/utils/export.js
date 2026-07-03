/**
 * 将数据导出为 CSV 文件
 * @param {string} filename 下载文件名（不需要后缀）
 * @param {Array<{key: string, label: string}>} columns 列配置
 * @param {Array<Object>} rows 数据行
 * @param {Function} [formatter] 可选的单元格格式化函数 (value, column, row) => string
 * @returns {boolean} 是否成功导出
 */
export const exportToCSV = (filename, columns, rows, formatter = null) => {
  if (!rows || rows.length === 0) return false

  const escapeCsv = (val) => {
    const str = val == null ? '' : String(val)
    return `"${str.replace(/"/g, '""')}"`
  }

  const headerLine = columns.map(col => escapeCsv(col.label)).join(',')
  const bodyLines = rows.map(row => {
    return columns.map(col => {
      const raw = row[col.key]
      const val = formatter ? formatter(raw, col, row) : raw
      return escapeCsv(val)
    }).join(',')
  })

  const csvContent = [headerLine, ...bodyLines].join('\n')
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return true
}
