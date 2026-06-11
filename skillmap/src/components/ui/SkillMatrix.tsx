'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { User, Skill, SkillLevel, Role } from '@/types'

// Color scheme for each proficiency level badge
const LEVEL_STYLES: Record<SkillLevel, string> = {
  beginner: 'bg-gray-700 text-gray-300',
  intermediate: 'bg-blue-900 text-blue-300',
  advanced: 'bg-green-900 text-green-300',
  expert: 'bg-violet-900 text-violet-300',
}

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert']
const ROLES: Role[] = ['employee', 'manager', 'admin']

// Shared input class to avoid repetition
const INPUT = 'w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

// Reusable multi-entry list field (education, certifications, languages)
function MultiEntryField({
  label, placeholder, entries, onAdd, onRemove,
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
        <div key={i} className="flex items-start gap-1.5 rounded bg-gray-800/60 border border-gray-700/60 px-2.5 py-1.5">
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

interface Props {
  users: User[]
  skills: Skill[]
  // levelMap[userId][skillId] = level (undefined means no relationship)
  levelMap: Record<string, Record<string, SkillLevel>>
}

export function SkillMatrix({ users, skills, levelMap }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state — add user
  const [newUser, setNewUser] = useState({
    name: '', email: '', department: '', seniority: '', role: 'employee' as Role,
  })
  const [education, setEducation] = useState<string[]>([])
  const [certifications, setCertifications] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])

  // Form state — add skill
  const [newSkill, setNewSkill] = useState({ name: '', category: '' })

  // Form state — assign skill to user
  const [assignment, setAssignment] = useState({
    userId: users[0]?.id ?? '',
    skillId: skills[0]?.id ?? '',
    level: 'intermediate' as SkillLevel,
  })

  const [errorMsg, setErrorMsg] = useState('')

  // Refresh server component data after a successful mutation
  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newUser, education, certifications, languages }),
    })
    if (!res.ok) {
      const data = await res.json()
      setErrorMsg(data.error ?? 'Failed to create user')
      return
    }
    setNewUser({ name: '', email: '', department: '', seniority: '', role: 'employee' })
    setEducation([])
    setCertifications([])
    setLanguages([])
    refresh()
  }

  async function handleAddSkill(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    const res = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSkill),
    })
    if (!res.ok) {
      const data = await res.json()
      setErrorMsg(data.error ?? 'Failed to create skill')
      return
    }
    setNewSkill({ name: '', category: '' })
    refresh()
  }

  async function handleAssignSkill(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    const res = await fetch(`/api/users/${assignment.userId}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: assignment.skillId, level: assignment.level }),
    })
    if (!res.ok) {
      const data = await res.json()
      setErrorMsg(data.error ?? 'Failed to assign skill')
      return
    }
    refresh()
  }

  return (
    <div className="space-y-8">
      {/* Error banner */}
      {errorMsg && (
        <div className="rounded-md bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Skill matrix table */}
      {users.length === 0 || skills.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No data yet — add users and skills below to populate the matrix.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="px-4 py-3 text-left text-gray-400 font-medium w-48">
                  User / Skill
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
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr
                  key={u.id}
                  className={idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/50'}
                >
                  <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.department} · {u.seniority}</div>
                  </td>
                  {skills.map((s) => {
                    const level = levelMap[u.id]?.[s.id]
                    return (
                      <td key={s.id} className="px-4 py-3 text-center">
                        {level ? (
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${LEVEL_STYLES[level]}`}>
                            {level}
                          </span>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Management forms */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">

        {/* Add user form */}
        <form
          onSubmit={handleAddUser}
          className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
            Add User
          </h2>
          <input
            className={INPUT}
            placeholder="Full name" required
            value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
          />
          <input
            className={INPUT}
            placeholder="Email" type="email" required
            value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
          />
          <input
            className={INPUT}
            placeholder="Department" required
            value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
          />
          <input
            className={INPUT}
            placeholder="Seniority (e.g. senior)" required
            value={newUser.seniority} onChange={(e) => setNewUser({ ...newUser, seniority: e.target.value })}
          />
          <select
            className={INPUT}
            value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* Optional profile fields */}
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

          <button
            type="submit" disabled={isPending}
            className="w-full rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white transition-colors"
          >
            Add User
          </button>
        </form>

        {/* Add skill form */}
        <form
          onSubmit={handleAddSkill}
          className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
            Add Skill
          </h2>
          <input
            className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Skill name" required
            value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
          />
          <input
            className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Category (e.g. Frontend)" required
            value={newSkill.category} onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
          />
          <button
            type="submit" disabled={isPending}
            className="w-full rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white transition-colors"
          >
            Add Skill
          </button>
        </form>

        {/* Assign skill to user form */}
        <form
          onSubmit={handleAssignSkill}
          className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
            Assign Skill
          </h2>
          {users.length === 0 || skills.length === 0 ? (
            <p className="text-xs text-gray-500">Add at least one user and one skill first.</p>
          ) : (
            <>
              <select
                className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={assignment.userId}
                onChange={(e) => setAssignment({ ...assignment, userId: e.target.value })}
              >
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select
                className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={assignment.skillId}
                onChange={(e) => setAssignment({ ...assignment, skillId: e.target.value })}
              >
                {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select
                className="w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={assignment.level}
                onChange={(e) => setAssignment({ ...assignment, level: e.target.value as SkillLevel })}
              >
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button
                type="submit" disabled={isPending}
                className="w-full rounded bg-violet-700 hover:bg-violet-600 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white transition-colors"
              >
                Assign
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
