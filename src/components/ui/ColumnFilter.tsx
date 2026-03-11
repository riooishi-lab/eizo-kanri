'use client'

import { useRef, useEffect } from 'react'
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
}: {
  options: string[]
  selected: Set<string>
  onChange: (val: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[160px] py-1"
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
    </div>
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

  return (
    <div className="relative inline-flex items-center">
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
        />
      )}
    </div>
  )
}
