import { useEffect, useId, useRef, useState } from 'react'

/** Draw only received prices, sized to the panel so labels remain readable. */
export function TradingPriceChart({ prices, times, label }: { prices: readonly number[]; times?: readonly number[]; label: string }) {
  const ref = useRef<SVGSVGElement>(null), fill = `price-${useId().replaceAll(':', '')}`
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => { if (entry && entry.contentRect.width > 0) setWidth(entry.contentRect.width) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const samples = prices.map((price, index) => ({ price, time: times?.[index] })).filter(sample => Number.isFinite(sample.price))
  const values = samples.map(sample => sample.price)
  if (!values.length) return null
  const low = Math.min(...values), high = Math.max(...values)
  const padding = (high - low || Math.max(Math.abs(high) * .0001, 1)) * .16
  const minimum = low - padding, maximum = high + padding
  const right = Math.max(80, width - 72), bottom = 194
  const firstTime = samples[0]!.time, lastTime = samples.at(-1)!.time
  const timed = firstTime != null && lastTime != null && lastTime > firstTime && samples.every(sample => Number.isFinite(sample.time))
  const points = samples.map((sample, i) => ({ x: 4 + (timed ? (sample.time! - firstTime!) / (lastTime! - firstTime!) : i / Math.max(1, values.length - 1)) * (right - 4), y: bottom - (sample.price - minimum) / (maximum - minimum) * 178 }))
  const path = points.map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`).join(' ')
  const last = points.at(-1)!
  return <svg ref={ref} viewBox={`0 0 ${width} 210`} className="qs-price-chart" role="img" aria-label={label}>
    <defs><linearGradient id={fill} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--qs-accent)" stopOpacity=".13"/><stop offset="1" stopColor="var(--qs-accent)" stopOpacity="0"/></linearGradient></defs>
    {[.15, .5, .85].map(ratio => <g key={ratio}><line x1="4" x2={right} y1={16 + ratio * 178} y2={16 + ratio * 178}/><text x={width - 2} y={20 + ratio * 178} textAnchor="end">{(maximum - ratio * (maximum - minimum)).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}</text></g>)}
    {points.length > 1 && <><path d={`${path}L${last.x},${bottom}H4Z`} fill={`url(#${fill})`}/><path className="qs-price-line" d={path}/></>}
    <circle cx={last.x} cy={last.y} r="3.5" fill="var(--qs-accent)"><title>最新 {values.at(-1)}</title></circle>
  </svg>
}
