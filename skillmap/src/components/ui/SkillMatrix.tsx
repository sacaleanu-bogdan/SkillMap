'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { User, Skill, SkillLevel, Project } from '@/types'

// Badge color based on years of experience thresholds
function levelStyle(years: SkillLevel): string {
  if (years >= 10) return 'bg-violet-900 text-violet-300'
  if (years >= 5) return 'bg-green-900 text-green-300'
  if (years >= 2) return 'bg-blue-900 text-blue-300'
  return 'bg-gray-700 text-gray-300'
}

interface Props {
  users: User[]
  skills: Skill[]
  projects: Project[]
  // levelMap[userId][skillId] = level (undefined means no relationship)
  levelMap: Record<string, Record<string, SkillLevel>>
}

export function SkillMatrix({ users, skills, projects, levelMap }: Props) {
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')

  // Fast project name lookup
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects]
  )

  // Filter users by free-text (name or project name) and/or project dropdown
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      const assignments = u.projectAssignments ?? []

      if (projectFilter) {
        if (!assignments.some((pa) => pa.projectId === projectFilter)) return false
      }

      if (q) {
        const nameMatch = u.name.toLowerCase().includes(q)
        const projectMatch = assignments.some((pa) =>
          (projectById.get(pa.projectId) ?? '').toLowerCase().includes(q)
        )
        if (!nameMatch && !projectMatch) return false
      }

      return true
    })
  }, [users, search, projectFilter, projectById])

  if (users.length === 0 || skills.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No data yet — add users and skills in the{' '}
        <Link href="/manage" className="text-blue-400 hover:underline">Manage</Link>{' '}
        tab to populate the matrix.
      </p>
    )
  }

  const isFiltering = search.trim().length > 0 || projectFilter !== ''

  return (
    <div className="space-y-4">
      {/* ── Search / filter bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Text search */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 min-w-[240px]">
          <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users or projects…"
            className="bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none flex-1"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-gray-600 hover:text-gray-400 transition-colors text-base leading-none"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Project filter dropdown */}
        {projects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {/* Active filter summary */}
        {isFiltering && (
          <span className="text-xs text-gray-500">
            {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
        )}
        {isFiltering && (
          <button
            onClick={() => { setSearch(''); setProjectFilter('') }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Matrix table ────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-900 border-b border-gray-800">
              <th className="px-4 py-3 text-left text-gray-400 font-medium w-48 sticky left-0 bg-gray-900">
                User
              </th>
              {skills.map((s) => (
                <th
                  key={s.id}
                  className="px-4 py-3 text-center text-gray-300 font-medium whitespace-nowrap"
                >
                  <div>{s.name}</div>
                  <div className="text-xs text-gray-500 font-normal">{s.category}</div>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-gray-400 font-medium whitespace-nowrap min-w-[180px]">
                Projects
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={skills.length + 2}
                  className="px-4 py-8 text-center text-gray-600 text-sm"
                >
                  No users match your search.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, idx) => {
                const assignments = u.projectAssignments ?? []
                const currentProjects = assignments
                  .filter((pa) => pa.status === 'current')
                  .map((pa) => ({ id: pa.projectId, name: projectById.get(pa.projectId) ?? pa.projectId, contribution: pa.contribution }))
                const previousProjects = assignments
                  .filter((pa) => pa.status === 'previous')
                  .map((pa) => ({ id: pa.projectId, name: projectById.get(pa.projectId) ?? pa.projectId, contribution: pa.contribution }))

                return (
                  <tr
                    key={u.id}
                    className={idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/50'}
                  >
                    {/* User identity */}
                    <td className="px-4 py-3 text-gray-200 whitespace-nowrap sticky left-0 bg-inherit">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.department} · {u.seniority}</div>
                    </td>

                    {/* Skill level cells */}
                    {skills.map((s) => {
                      const level = levelMap[u.id]?.[s.id]
                      return (
                        <td key={s.id} className="px-4 py-3 text-center">
                          {level !== undefined ? (
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${levelStyle(level)}`}>
                              {level}yr
                            </span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                      )
                    })}

                    {/* Projects cell */}
                    <td className="px-4 py-3 align-top">
                      {currentProjects.length === 0 && previousProjects.length === 0 ? (
                        <span className="text-gray-700 text-xs">—</span>
                      ) : (
                        <div className="flex flex-col gap-1 items-start">
                          {currentProjects.map((p) => (
                            <span
                              key={p.id}
                              title={p.contribution ?? undefined}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-900/60 text-amber-300 border border-amber-700/50 whitespace-nowrap"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                              {p.name}
                            </span>
                          ))}
                          {previousProjects.map((p) => (
                            <span
                              key={p.id}
                              title={p.contribution ?? undefined}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 whitespace-nowrap"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                              {p.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
