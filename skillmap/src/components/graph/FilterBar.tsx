'use client'

import { useState, useEffect } from 'react'
import type { SkillLevel } from '@/types'

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert']

const LEVEL_STYLES: Record<SkillLevel, string> = {
  beginner: 'bg-gray-700 text-gray-300 border-gray-600',
  intermediate: 'bg-blue-900 text-blue-300 border-blue-700',
  advanced: 'bg-green-900 text-green-300 border-green-700',
  expert: 'bg-violet-900 text-violet-300 border-violet-700',
}

export interface FilterCriterion {
  skillNodeId: string  // React Flow node ID — "skill-<uuid>"
  skillLabel: string   // Human-readable skill name for display
  minLevel: SkillLevel // Minimum required level (inclusive)
}

interface Props {
  availableSkills: Array<{ id: string; label: string }>
  filters: FilterCriterion[]
  onChange: (filters: FilterCriterion[]) => void
}

export function FilterBar({ availableSkills, filters, onChange }: Props) {
  // Skills not yet covered by an active filter
  const unfiltered = availableSkills.filter(
    (s) => !filters.some((f) => f.skillNodeId === s.id)
  )

  const [pendingSkillId, setPendingSkillId] = useState(unfiltered[0]?.id ?? '')
  const [pendingLevel, setPendingLevel] = useState<SkillLevel>('intermediate')

  // Keep pendingSkillId pointing at a valid unfiltered skill as filters change
  useEffect(() => {
    if (!unfiltered.some((s) => s.id === pendingSkillId)) {
      setPendingSkillId(unfiltered[0]?.id ?? '')
    }
  }, [unfiltered, pendingSkillId])

  function addFilter() {
    if (!pendingSkillId) return
    const skill = availableSkills.find((s) => s.id === pendingSkillId)
    if (!skill) return
    onChange([
      ...filters,
      { skillNodeId: pendingSkillId, skillLabel: skill.label, minLevel: pendingLevel },
    ])
  }

  function removeFilter(skillNodeId: string) {
    onChange(filters.filter((f) => f.skillNodeId !== skillNodeId))
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-sm px-4 py-2 shadow-2xl max-w-[90%]">
      {/* Label */}
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">
        Find
      </span>

      {/* Active filter chips */}
      {filters.map((f, i) => (
        <span key={f.skillNodeId} className="flex items-center gap-1">
          {/* AND connector between chips */}
          {i > 0 && (
            <span className="text-[10px] text-gray-600 font-medium uppercase mr-0.5">and</span>
          )}
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${LEVEL_STYLES[f.minLevel]}`}
          >
            <span>{f.skillLabel}</span>
            <span className="opacity-60">≥ {f.minLevel}</span>
            <button
              onClick={() => removeFilter(f.skillNodeId)}
              className="opacity-50 hover:opacity-100 transition-opacity leading-none"
              aria-label={`Remove ${f.skillLabel} filter`}
            >
              ×
            </button>
          </span>
        </span>
      ))}

      {/* Add filter row — hidden when all skills are already in use */}
      {unfiltered.length > 0 && (
        <div className="flex items-center gap-1.5">
          {filters.length > 0 && (
            <span className="text-[10px] text-gray-600 font-medium uppercase">and</span>
          )}
          <select
            className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={pendingSkillId}
            onChange={(e) => setPendingSkillId(e.target.value)}
          >
            {unfiltered.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <select
            className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={pendingLevel}
            onChange={(e) => setPendingLevel(e.target.value as SkillLevel)}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>≥ {l}</option>
            ))}
          </select>
          <button
            onClick={addFilter}
            className="rounded bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-xs font-medium text-white transition-colors"
          >
            + Add
          </button>
        </div>
      )}

      {/* Clear all button */}
      {filters.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors shrink-0 ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
