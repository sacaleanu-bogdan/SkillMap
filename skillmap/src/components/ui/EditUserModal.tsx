'use client'

import { useState, useEffect, useTransition } from 'react'
import type { User, Skill, Project, SkillLevel, Role } from '@/types'

const INPUT =
  'w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

const ROLES: Role[] = ['employee', 'manager', 'admin']
const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert']

function MultiEntryField({
  label,
  placeholder,
  entries,
  onAdd,
  onRemove,
}: {
  label: string
  placeholder: string
  entries: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-gray-400">{label}</label>
      <div className="flex gap-1.5">
        <input
          className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <button
          type="button"
          onClick={add}
          className="rounded bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 text-xs text-gray-200 transition-colors"
        >
          +
        </button>
      </div>
      {entries.map((entry, i) => (
        <div
          key={i}
          className="flex items-start gap-1.5 rounded bg-gray-800/60 border border-gray-700/60 px-2.5 py-1.5"
        >
          <span className="flex-1 text-xs text-gray-300 leading-snug break-all">{entry}</span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="shrink-0 text-gray-600 hover:text-red-400 transition-colors text-xs leading-none mt-0.5"
            aria-label="Remove entry"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

interface SkillAssignment {
  skillId: string
  level: SkillLevel
}

interface Props {
  user: User
  skills: Skill[]
  projects: Project[]
  onClose: () => void
  onSaved: () => void
}

export function EditUserModal({ user, skills, projects, onClose, onSaved }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name, setName] = useState(user.name)
  const [department, setDepartment] = useState(user.department)
  const [seniority, setSeniority] = useState(user.seniority)
  const [role, setRole] = useState<Role>(user.role)
  const [education, setEducation] = useState<string[]>(user.education ?? [])
  const [certifications, setCertifications] = useState<string[]>(user.certifications ?? [])
  const [languages, setLanguages] = useState<string[]>(user.languages ?? [])
  const [shortDescription, setShortDescription] = useState(user.shortDescription ?? '')
  const [selectedProjects, setSelectedProjects] = useState<string[]>(user.projects ?? [])
  const [projectPicker, setProjectPicker] = useState('')

  // Skill assignments
  const [assignments, setAssignments] = useState<SkillAssignment[]>([])
  const [loadingSkills, setLoadingSkills] = useState(true)
  const [pickerSkillId, setPickerSkillId] = useState('')
  const [pickerLevel, setPickerLevel] = useState<SkillLevel>('intermediate')

  // Load existing skill assignments for this user
  useEffect(() => {
    fetch(`/api/users/${user.id}/skills`)
      .then((r) => r.json())
      .then((data: { skillId: string; level: SkillLevel }[]) => {
        setAssignments(data.map((d) => ({ skillId: d.skillId, level: d.level })))
      })
      .catch(() => {})
      .finally(() => setLoadingSkills(false))
  }, [user.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Save profile fields
    const profileRes = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, department, seniority, role, education, certifications, languages, shortDescription, projects: selectedProjects }),
    })
    if (!profileRes.ok) {
      const data = await profileRes.json().catch(() => ({}))
      setError(data.error ?? 'Failed to save changes')
      return
    }

    // Save each skill assignment (MERGE on the server so safe to resend)
    for (const { skillId, level } of assignments) {
      await fetch(`/api/users/${user.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, level }),
      })
    }

    startTransition(() => onSaved())
  }

  const availableToAdd = skills.filter((s) => !assignments.some((a) => a.skillId === s.id))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Edit User</h2>
            <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <form id="edit-user-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs text-gray-400">Full Name</label>
              <input className={INPUT} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-gray-400">Department</label>
              <input className={INPUT} required value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Engineering" />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-gray-400">Seniority</label>
              <input className={INPUT} required value={seniority} onChange={(e) => setSeniority(e.target.value)} placeholder="e.g. Senior" />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-gray-400">Role</label>
              <select className={INPUT} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <MultiEntryField
              label="Education (optional)"
              placeholder="2019 – 2023: MIT, Computer Science / AI"
              entries={education}
              onAdd={(v) => setEducation([...education, v])}
              onRemove={(i) => setEducation(education.filter((_, idx) => idx !== i))}
            />
            <MultiEntryField
              label="Certifications (optional)"
              placeholder="AWS Solutions Architect"
              entries={certifications}
              onAdd={(v) => setCertifications([...certifications, v])}
              onRemove={(i) => setCertifications(certifications.filter((_, idx) => idx !== i))}
            />
            <MultiEntryField
              label="Languages (optional)"
              placeholder="English"
              entries={languages}
              onAdd={(v) => setLanguages([...languages, v])}
              onRemove={(i) => setLanguages(languages.filter((_, idx) => idx !== i))}
            />

            <div className="space-y-1">
              <label className="block text-xs text-gray-400">Short Description (optional)</label>
              <textarea
                className={`${INPUT} resize-none`}
                placeholder="Brief summary of the employee's background and expertise"
                rows={3}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
              />
            </div>
            {/* Projects dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-400">Projects (optional)</label>
              {selectedProjects.length > 0 && (
                <div className="space-y-1">
                  {selectedProjects.map((pid) => {
                    const proj = projects.find((p) => p.id === pid)
                    return (
                      <div key={pid} className="flex items-center justify-between rounded bg-gray-800/60 border border-gray-700/60 px-3 py-1.5">
                        <span className="text-xs text-gray-300 flex-1">{proj?.name ?? pid}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = selectedProjects.filter((x) => x !== pid)
                            setSelectedProjects(next)
                            if (!projectPicker) {
                              setProjectPicker(pid)
                            }
                          }}
                          className="text-gray-600 hover:text-red-400 transition-colors text-xs"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              {projects.filter((p) => !selectedProjects.includes(p.id)).length > 0 && (
                <div className="flex gap-1.5">
                  <select
                    className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={projectPicker}
                    onChange={(e) => setProjectPicker(e.target.value)}
                  >
                    <option value="">— select project —</option>
                    {projects
                      .filter((p) => !selectedProjects.includes(p.id))
                      .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                    }
                  </select>
                  <button
                    type="button"
                    disabled={!projectPicker}
                    onClick={() => {
                      if (!projectPicker) return
                      setSelectedProjects([...selectedProjects, projectPicker])
                      const remaining = projects.filter((p) => !selectedProjects.includes(p.id) && p.id !== projectPicker)
                      setProjectPicker(remaining[0]?.id ?? '')
                    }}
                    className="rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-2.5 py-1.5 text-xs text-gray-200 transition-colors"
                  >
                    +
                  </button>
                </div>
              )}
              {projects.length === 0 && (
                <p className="text-xs text-gray-500">No projects yet. Create one in the Projects tab first.</p>
              )}
            </div>

            {/* Skill assignments */}
            {skills.length > 0 && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs text-gray-400">Skills</label>

                {loadingSkills ? (
                  <p className="text-xs text-gray-500">Loading…</p>
                ) : (
                  <>
                    {/* Existing assignments */}
                    {assignments.length > 0 && (
                      <div className="space-y-1">
                        {assignments.map((a) => {
                          const sk = skills.find((s) => s.id === a.skillId)
                          return (
                            <div key={a.skillId} className="flex items-center justify-between rounded bg-gray-800/60 border border-gray-700/60 px-3 py-1.5">
                              <span className="text-xs text-gray-300 flex-1">{sk?.name ?? a.skillId}</span>
                              <div className="flex items-center gap-2">
                                <select
                                  className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200 focus:outline-none"
                                  value={a.level}
                                  onChange={(e) => setAssignments(assignments.map((x) =>
                                    x.skillId === a.skillId ? { ...x, level: e.target.value as SkillLevel } : x
                                  ))}
                                >
                                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => setAssignments(assignments.filter((x) => x.skillId !== a.skillId))}
                                  className="text-gray-600 hover:text-red-400 transition-colors text-xs"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Add new skill picker */}
                    {availableToAdd.length > 0 && (
                      <div className="flex gap-2">
                        <select
                          className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={pickerSkillId}
                          onChange={(e) => setPickerSkillId(e.target.value)}
                        >
                          <option value="">— select skill —</option>
                          {availableToAdd.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select
                          className="rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={pickerLevel}
                          onChange={(e) => setPickerLevel(e.target.value as SkillLevel)}
                        >
                          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <button
                          type="button"
                          disabled={!pickerSkillId}
                          onClick={() => {
                            if (!pickerSkillId) return
                            setAssignments([...assignments, { skillId: pickerSkillId, level: pickerLevel }])
                            // Move picker to next available skill
                            const remaining = availableToAdd.filter((s) => s.id !== pickerSkillId)
                            setPickerSkillId(remaining[0]?.id ?? '')
                          }}
                          className="rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-3 py-2 text-sm text-gray-200 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="rounded bg-gray-700 hover:bg-gray-600 px-4 py-2 text-sm text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            form="edit-user-form"
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}


