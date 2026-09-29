import { useEffect, useRef } from 'react'
import markup from './life-garden/garden.html?raw'
import { mountLifeGarden } from './life-garden/app.mjs'
import './life-garden/garden.css'

/** A local simulation. Mounting never connects a trading account or starts its runtime. */
export function LifeGarden() {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = container.current
    if (!root) return
    root.innerHTML = markup
    const dispose = mountLifeGarden(root)
    return () => { dispose(); root.replaceChildren() }
  }, [])
  return <div ref={container} id="qs-life-garden" aria-label="生命花园" />
}
