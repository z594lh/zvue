// 以店铺本地最新 SKU 日报为截止日，默认展示含截止日在内的15天。
export function recentPerformanceDates(latestDate, timezone, now=new Date()) {
  const validLatest=typeof latestDate==='string' && /^\d{4}-\d{2}-\d{2}$/.test(latestDate)
    && !Number.isNaN(Date.parse(`${latestDate}T12:00:00Z`))
    && new Date(`${latestDate}T12:00:00Z`).toISOString().slice(0,10)===latestDate
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:timezone || 'Asia/Shanghai'}).format(now)
  const anchor=validLatest ? latestDate : today
  const shift=days=>{
    const date=new Date(`${anchor}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate()+days)
    return date.toISOString().slice(0,10)
  }
  // 没有本地日报时，退回站点最近15个已经结束的业务日。
  return validLatest ? [shift(-14),latestDate] : [shift(-15),shift(-1)]
}
