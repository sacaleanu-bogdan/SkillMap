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

// A skill criterion: user must have a skill at or above minLevel
export interface SkillCriterion {
  type: 'skill'
  skillNodeId: string  // React Flow node ID — "skill-<uuid>"
  skillLabel: string
  minLevel: SkillLevel
}

// A project criterion: user must be assigned to this project
export interface ProjectCriterion {
  type: 'project'
  projectId: string
  projectName: string
}

export type FilterCriterion = SkillCriterion | ProjectCriterion

interface Props {
  availableSkills: Array<{ id: string; label: string }>
  availableProjects: Array<{ id: string; name: string }>
  filters: FilterCriterion[]
  onChange: (filters: FilterCriterion[]) => void
}

export function FilterBar({ availableSkills, availableProjects, filters, onChange }: Props) {
  // Filter out already-used skills and projects
  const unusedSkills = availableSkills.filter(
    (s) => !filters.some((f) => f.type === 'skill' && f.skillNodeId === s.id)
  )
  const unusedProjects = availableProjects.filter(
    (p) => !filters.some((f) => f.type === 'project' && f.projectId === p.id)
  )

  const [filterType, setFilterType] = useState<'skill' | 'project'>('skill')
  const [pendingSkillId, setPendingSkillId] = useState('')
  const [pendingLevel, setPendingLevel] = useState<SkillLevel>('intermediate')
  const [pendingProjectId, setPendingProjectId] = useState('')

  // Keep pending values pointing at valid unused items as filters change
  useEffect(() => {
    if (!unusedSkills.some((s) => s.id === pendingSkillId)) {
      setPendingSkillId(unusedSkills[0]?.id ?? '')
    }
  }, [unusedSkills, pendingSkillId])

  useEffect(() => {
    if (!unusedProjects.some((p) => p.id === pendingProjectId)) {
      setPendingProjectId(unusedProjects[0]?.id ?? '')
    }
  }, [unusedProjects, pendingProjectId])

  function addFilter() {
    if (filterType === 'skill') {
      if (!pendingSkillId) return
      const skill = availableSkills.find((s) => s.id === pendingSkillId)
      if (!skill) return
      onChange([
        ...filters,
        { type: 'skill', skillNodeId: pendingSkillId, skillLabel: skill.label, minLevel: pendingLevel },
      ])
    } else {
      if (!pendingProjectId) return
      const project = availableProjects.find((p) => p.id === pendingProjectId)
      if (!project) return
      onChange([
        ...filters,
        { type: 'project', projectId: pendingProjectId, projectName: project.name },
      ])
    }
  }

  function removeFilter(index: number) {
    onChange(filters.filter((_, i) => i !== index))
  }

  const canAdd = filterType === 'skill' ? unusedSkills.length > 0 : unusedProjects.length > 0

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/95 backdrop-blur-sm px-4 py-2 shadow-2xl max-w-[90%]">
      {/* Label */}
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">
        Find
      </span>

      {/* Active filter chips */}
      {filters.map((f, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <span className="text-[10px] text-gray-600 font-medium uppercase mr-0.5">and</span>
          )}
          {f.type === 'skill' ? (
            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${LEVEL_STYLES[f.minLevel]}`}>
              <span>{f.skillLabel}</span>
              <span className="opacity-60">≥ {f.minLevel}</span>
              <button
                onClick={() => removeFilter(i)}
                className="opacity-50 hover:opacity-100 transition-opacity leading-none"
                aria-label={`Remove ${f.skillLabel} filter`}
              >×</button>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-700 bg-amber-900 text-amber-300 px-2.5 py-0.5 text-xs font-medium">
              <span>📁 {f.projectName}</span>
              <button
                onClick={() => removeFilter(i)}
                className="opacity-50 hover:opacity-100 transition-opacity leading-none"
                aria-label={`Remove ${f.projectName} filter`}
              >×</button>
            </span>
          )}
        </span>
      ))}

      {/* Add filter row */}
      {(unusedSkills.length > 0 || unusedProjects.length > 0) && (
        <div className="flex items-center gap-1.5">
          {filters.length > 0 && (
            <span className="text-[10px] text-gray-600 font-medium uppercase">and</span>
          )}

          {/* Filter type toggle */}
          <select
            className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'skill' | 'project')}
          >
            {unusedSkills.length > 0 && <option value="skill">Skill</option>}
            {unusedProjects.length > 0 && <option value="project">Project</option>}
          </select>

          {filterType === 'skill' && unusedSkills.length > 0 && (
            <>
              <select
                className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={pendingSkillId}
                onChange={(e) => setPendingSkillId(e.target.value)}
              >
                {unusedSkills.map((s) => (
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
            </>
          )}

          {filterType === 'project' && unusedProjects.length > 0 && (
            <select
              className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={pendingProjectId}
              onChange={(e) => setPendingProjectId(e.target.value)}
            >
              {unusedProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          {canAdd && (
            <button
              onClick={addFilter}
              className="rounded bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-xs font-medium text-white transition-colors"
            >
              + Add
            </button>
          )}
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

