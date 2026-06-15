'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { User, Skill, SkillLevel, Role } from '@/types'
import { EditUserModal } from './EditUserModal'
import { EditSkillModal } from './EditSkillModal'

const INPUT =
  'w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert']
const ROLES: Role[] = ['employee', 'manager', 'admin']

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

interface Props {
  users: User[]
  skills: Skill[]
}

export function ManagePanel({ users, skills }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'users' | 'skills'>('users')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Form state — add user
  const [newUser, setNewUser] = useState({
    name: '', email: '', department: '', seniority: '', role: 'employee' as Role,
  })
  const [education, setEducation] = useState<string[]>([])
  const [certifications, setCertifications] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [shortDescription, setShortDescription] = useState('')
  const [projects, setProjects] = useState<string[]>([])

  // Pending skill assignments for the new user (assigned after creation)
  const [pendingSkills, setPendingSkills] = useState<{ skillId: string; level: SkillLevel }[]>([])
  const [pendingSkillId, setPendingSkillId] = useState(skills[0]?.id ?? '')
  const [pendingSkillLevel, setPendingSkillLevel] = useState<SkillLevel>('intermediate')

  // Keep pendingSkillId in sync if skills list changes and current value is empty
  useEffect(() => {
    setPendingSkillId(prev => prev === '' && skills.length > 0 ? skills[0].id : prev)
  }, [skills])

  // Form state — add skill
  const [newSkill, setNewSkill] = useState({ name: '', category: '', icon: '' })

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function postJSON(url: string, body: unknown): Promise<boolean> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErrorMsg(data.error ?? 'Request failed')
      return false
    }
    return true
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newUser, education, certifications, languages, shortDescription, projects }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErrorMsg(data.error ?? 'Request failed')
      return
    }
    const created = await res.json()
    // POST each pending skill assignment now that we have the user id
    for (const { skillId, level } of pendingSkills) {
      await fetch(`/api/users/${created.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, level }),
      })
    }
    setNewUser({ name: '', email: '', department: '', seniority: '', role: 'employee' })
    setEducation([])
    setCertifications([])
    setLanguages([])
    setShortDescription('')
    setProjects([])
    setPendingSkills([])
    refresh()
  }

  async function handleAddSkill(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    const ok = await postJSON('/api/skills', {
      name: newSkill.name,
      category: newSkill.category,
      ...(newSkill.icon ? { icon: newSkill.icon } : {}),
    })
    if (!ok) return
    setNewSkill({ name: '', category: '', icon: '' })
    refresh()
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-md bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-800">
        {(['users', 'skills'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setErrorMsg('') }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'users' ? `Users (${users.length})` : `Skills (${skills.length})`}
          </button>
        ))}
      </div>

      {/* ── Users tab ─────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-8">

          {/* Add User form */}
          <form
            onSubmit={handleAddUser}
            className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3"
          >
            <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Add User</h2>
            <input
              className={INPUT} placeholder="Full name" required
              value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
            <input
              className={INPUT} placeholder="Email" type="email" required
              value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <input
              className={INPUT} placeholder="Department" required
              value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
            />
            <input
              className={INPUT} placeholder="Seniority (e.g. Senior)" required
              value={newUser.seniority} onChange={(e) => setNewUser({ ...newUser, seniority: e.target.value })}
            />
            <select
              className={INPUT}
              value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
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
            <MultiEntryField
              label="Projects (optional)"
              placeholder="e.g. SkillMap internal dashboard"
              entries={projects}
              onAdd={(v) => setProjects([...projects, v])}
              onRemove={(i) => setProjects(projects.filter((_, idx) => idx !== i))}
            />

            {/* Inline skill assignment */}
            {skills.length > 0 && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs text-gray-400">Skills (optional)</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={pendingSkillId}
                    onChange={(e) => setPendingSkillId(e.target.value)}
                  >
                    {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select
                    className="rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={pendingSkillLevel}
                    onChange={(e) => setPendingSkillLevel(e.target.value as SkillLevel)}
                  >
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!pendingSkillId) return
                      if (pendingSkills.some((p) => p.skillId === pendingSkillId)) return
                      setPendingSkills([...pendingSkills, { skillId: pendingSkillId, level: pendingSkillLevel }])
                    }}
                    className="rounded bg-gray-700 hover:bg-gray-600 px-3 py-2 text-sm text-gray-200 transition-colors"
                  >
                    +
                  </button>
                </div>
                {pendingSkills.length > 0 && (
                  <div className="space-y-1">
                    {pendingSkills.map((p) => {
                      const sk = skills.find((s) => s.id === p.skillId)
                      return (
                        <div key={p.skillId} className="flex items-center justify-between rounded bg-gray-800/60 border border-gray-700/60 px-3 py-1.5">
                          <span className="text-xs text-gray-300">{sk?.name ?? p.skillId}</span>
                          <div className="flex items-center gap-2">
                            <select
                              className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200 focus:outline-none"
                              value={p.level}
                              onChange={(e) => setPendingSkills(pendingSkills.map((x) =>
                                x.skillId === p.skillId ? { ...x, level: e.target.value as SkillLevel } : x
                              ))}
                            >
                              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => setPendingSkills(pendingSkills.filter((x) => x.skillId !== p.skillId))}
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
              </div>
            )}

            <button
              type="submit" disabled={isPending}
              className="w-full rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              Add User
            </button>
          </form>

          {/* User list */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              All Users ({users.length})
            </h2>
            {users.length === 0 ? (
              <p className="text-sm text-gray-500">No users yet.</p>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-200">{u.name}</div>
                      <div className="text-xs text-gray-500">
                        {u.email} · {u.department} · {u.seniority} ·{' '}
                        <span className="capitalize">{u.role}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingUser(u)}
                      className="ml-4 shrink-0 rounded bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs text-gray-200 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Skills tab ────────────────────────────────────────── */}
      {activeTab === 'skills' && (
        <div className="space-y-8">

          {/* Add Skill form */}
          <form
            onSubmit={handleAddSkill}
            className="max-w-sm rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3"
          >
            <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Add Skill</h2>
            <input
              className={INPUT} placeholder="Skill name" required
              value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
            />
            <input
              className={INPUT} placeholder="Category (e.g. Frontend)" required
              value={newSkill.category} onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
            />
            <input
              className={INPUT} placeholder="Icon (optional, e.g. 🐍 or a URL)"
              value={newSkill.icon} onChange={(e) => setNewSkill({ ...newSkill, icon: e.target.value })}
            />
            <button
              type="submit" disabled={isPending}
              className="w-full rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              Add Skill
            </button>
          </form>

          {/* Skill list */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              All Skills ({skills.length})
            </h2>
            {skills.length === 0 ? (
              <p className="text-sm text-gray-500">No skills yet.</p>
            ) : (
              <div className="space-y-2">
                {skills.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-200">
                        {s.icon ? `${s.icon} ${s.name}` : s.name}
                      </div>
                      <div className="text-xs text-gray-500">{s.category}</div>
                    </div>
                    <button
                      onClick={() => setEditingSkill(s)}
                      className="ml-4 shrink-0 rounded bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs text-gray-200 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit modals */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          skills={skills}
          onClose={() => setEditingUser(null)}
          onSaved={() => { setEditingUser(null); refresh() }}
        />
      )}
      {editingSkill && (
        <EditSkillModal
          skill={editingSkill}
          onClose={() => setEditingSkill(null)}
          onSaved={() => { setEditingSkill(null); refresh() }}
        />
      )}
    </div>
  )
}
