import type { TableHTMLAttributes } from 'react'

export default function FlyTable({ resizeStorageKey, ...props }: TableHTMLAttributes<HTMLTableElement> & { resizeStorageKey: string }) {
  return <div className="fv-native-table" data-table={resizeStorageKey}><table {...props} /></div>
}
