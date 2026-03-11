'use client'

import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Filter } from 'lucide-react'

interface ColumnFilterProps {
  label: string
  options: string[]
  selected: Set<string>
  isOpen: boolean
  onToggle: () => void
  onChange: (val: string) => void
  onClose: () => void
}

function FilterDropdown({
  options,
  selected,
  onChange,
  onClose,
  anchorRef,
}: {
  options: string[]
  selected: Set<string>
  onChange: (val: string) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLDivElement | null>
}) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', top: 0, left: 0, opacity: 0 })

  // アンカー位置を計算して fixed で配置
  useEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropH = Math.min(options.length * 36 + 8, 280)

    if (spaceBelow >= dropH || spaceBelow >= 80) {
      setStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        opacity: 1,
      })
    } else {
      // 上方向に開く
      setStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        top: 'auto',
        opacity: 1,
      })
    }
  }, [options.length, anchorRef])

  // 外クリック・スクロールで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    function handleScroll() { onClose() }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose, anchorRef])

  return createPortal(
    <div
      ref={dropdownRef}
      style={{ ...style, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-lg shadow-lg min-w-[160px] py-1 max-h-64 overflow-y-auto"
    >
      {options.map(opt => (
        <label
          key={opt}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
        >
          <input
            type="checkbox"
            checked={selected.has(opt)}
            onChange={() => onChange(opt)}
            className="accent-indigo-600 w-3.5 h-3.5"
          />
          {opt}
        </label>
      ))}
    </div>,
    document.body
  )
}

export function ColumnFilter({
  label,
  options,
  selected,
  isOpen,
  onToggle,
  onChange,
  onClose,
}: ColumnFilterProps) {
  const active = selected.size > 0
  const wrapperRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={wrapperRef} className="relative inline-flex items-center">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 text-xs rounded px-1.5 py-0.5 border transition-colors
          ${active
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
      >
        {active ? (
          <Filter className="w-3 h-3 fill-indigo-600 text-indigo-600" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-50" />
        )}
        {label}
        {active && (
          <span className="ml-0.5 text-[10px] bg-indigo-100 text-indigo-700 rounded-full px-1 font-semibold">
            {selected.size}
          </span>
        )}
      </button>
      {isOpen && (
        <FilterDropdown
          options={options}
          selected={selected}
          onChange={onChange}
          onClose={onClose}
          anchorRef={wrapperRef}
        />
      )}
    </div>
  )
}
