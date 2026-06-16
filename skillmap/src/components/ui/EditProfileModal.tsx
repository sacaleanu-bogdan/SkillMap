'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { User, Skill, Project, SkillLevel } from '@/types'

const INPUT =
  'w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert']

// Reusable multi-entry list field (education, certifications, languages)
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
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

interface UserSkill {
  skillId: string
  name: string
  category: string
  level: SkillLevel
}

interface Props {
  onClose: () => void
}

export function EditProfileModal({ onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [userId, setUserId] = useState('')

  // Basic profile fields
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [seniority, setSeniority] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [education, setEducation] = useState<string[]>([])
  const [certifications, setCertifications] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])

  // Projects
  const [userProjectIds, setUserProjectIds] = useState<string[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [projectPicker, setProjectPicker] = useState('')

  // Skills
  const [userSkills, setUserSkills] = useState<UserSkill[]>([])
  const [originalSkillIds, setOriginalSkillIds] = useState<Set<string>>(new Set())
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [skillPicker, setSkillPicker] = useState('')
  const [skillPickerLevel, setSkillPickerLevel] = useState<SkillLevel>('intermediate')

  // Load the current user's profile + skills + available projects/skills when the modal opens
  useEffect(() => {
    async function load() {
      try {
        const [meRes, projectsRes, skillsRes] = await Promise.all([
          fetch('/api/users/me'),
          fetch('/api/projects'),
          fetch('/api/skills'),
        ])

        if (!meRes.ok) {
          const d = await meRes.json()
          throw new Error(d.error ?? `Failed to load profile (${meRes.status})`)
        }

        const user = await meRes.json() as User
        setUserId(user.id)
        setName(user.name)
        setDepartment(user.department)
        setSeniority(user.seniority)
        setShortDescription(user.shortDescription ?? '')
        setEducation(user.education ?? [])
        setCertifications(user.certifications ?? [])
        setLanguages(user.languages ?? [])
        setUserProjectIds(user.projects ?? [])

        if (projectsRes.ok) setAllProjects(await projectsRes.json())
        if (skillsRes.ok) setAllSkills(await skillsRes.json())

        // Load user's current skills
        const userSkillsRes = await fetch(`/api/users/${user.id}/skills`)
        if (userSkillsRes.ok) {
          const skills = await userSkillsRes.json() as UserSkill[]
          setUserSkills(skills)
          setOriginalSkillIds(new Set(skills.map((s) => s.skillId)))
        }
      } catch (err: unknown) {
        setProfileError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoadingProfile(false)
      }
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')

    // 1. Save profile fields (including updated projects list)
    const profileRes = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, department, seniority, shortDescription,
        education, certifications, languages,
        projects: userProjectIds,
      }),
    })

    if (!profileRes.ok) {
      const data = await profileRes.json()
      setSubmitError(data.error ?? 'Failed to save profile')
      return
    }

    // 2. Sync skills: add/update new or changed entries, delete removed ones
    const newSkillIds = new Set(userSkills.map((s) => s.skillId))

    // POST for every skill currently in the list (MERGE handles add + level update)
    const upserts = userSkills.map((s) =>
      fetch(`/api/users/${userId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: s.skillId, level: s.level }),
      })
    )

    // DELETE skills that were in the original list but are no longer
    const deletions = [...originalSkillIds]
      .filter((id) => !newSkillIds.has(id))
      .map((skillId) =>
        fetch(`/api/users/${userId}/skills?skillId=${encodeURIComponent(skillId)}`, {
          method: 'DELETE',
        })
      )

    await Promise.all([...upserts, ...deletions])

    window.dispatchEvent(new CustomEvent('skillmap:profile-updated'))
    startTransition(() => {
      router.refresh()
      onClose()
    })
  }

  // Derived: skills not yet added by the user
  const availableSkillsToAdd = allSkills.filter(
    (s) => !userSkills.some((us) => us.skillId === s.id)
  )

  // Derived: projects not yet assigned to the user
  const availableProjectsToAdd = allProjects.filter(
    (p) => !userProjectIds.includes(p.id)
  )

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Edit Profile</h2>
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
          {loadingProfile ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading profile…</p>
          ) : profileError ? (
            <div className="rounded-md bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
              {profileError}
              {profileError.includes('not found') && (
                <p className="mt-1 text-xs text-red-400">
                  Your account has not been added to the system yet. Ask an admin to create your profile.
                </p>
              )}
            </div>
          ) : (
            <form id="edit-profile-form" onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <div className="rounded-md bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
                  {submitError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs text-gray-400">Full Name</label>
                <input
                  className={INPUT}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-gray-400">Department</label>
                <input
                  className={INPUT}
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Engineering"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-gray-400">Seniority</label>
                <input
                  className={INPUT}
                  required
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value)}
                  placeholder="e.g. Senior"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-gray-400">Short Description (optional)</label>
                <textarea
                  className={`${INPUT} resize-none`}
                  rows={2}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Brief summary of your background and expertise"
                />
              </div>

              {/* ── Projects ─────────────────────────────────── */}
              <div className="space-y-1.5">
                <label className="block text-xs text-gray-400">Projects</label>

                {/* Current projects */}
                {userProjectIds.length > 0 && (
                  <div className="space-y-1">
                    {userProjectIds.map((pid) => {
                      const proj = allProjects.find((p) => p.id === pid)
                      return (
                        <div key={pid} className="flex items-center justify-between rounded bg-amber-950/60 border border-amber-800/50 px-3 py-1.5">
                          <span className="text-xs text-amber-200">{proj?.name ?? pid}</span>
                          <button
                            type="button"
                            onClick={() => setUserProjectIds(userProjectIds.filter((x) => x !== pid))}
                            className="text-amber-700 hover:text-red-400 transition-colors text-xs leading-none"
                            aria-label="Remove project"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add project picker */}
                {availableProjectsToAdd.length > 0 && (
                  <div className="flex gap-1.5">
                    <select
                      className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={projectPicker}
                      onChange={(e) => setProjectPicker(e.target.value)}
                    >
                      <option value="">— add project —</option>
                      {availableProjectsToAdd.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!projectPicker}
                      onClick={() => {
                        if (!projectPicker) return
                        setUserProjectIds([...userProjectIds, projectPicker])
                        setProjectPicker('')
                      }}
                      className="rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-2.5 py-1.5 text-xs text-gray-200 transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}
                {allProjects.length === 0 && (
                  <p className="text-xs text-gray-600">No projects defined yet.</p>
                )}
              </div>

              {/* ── Skills ───────────────────────────────────── */}
              <div className="space-y-1.5">
                <label className="block text-xs text-gray-400">Skills</label>

                {/* Current skills with inline level editing */}
                {userSkills.length > 0 && (
                  <div className="space-y-1">
                    {userSkills.map((us) => (
                      <div key={us.skillId} className="flex items-center gap-2 rounded bg-green-950/50 border border-green-800/50 px-3 py-1.5">
                        <span className="flex-1 text-xs text-green-200 truncate">{us.name}</span>
                        <select
                          className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200 focus:outline-none"
                          value={us.level}
                          onChange={(e) =>
                            setUserSkills(userSkills.map((s) =>
                              s.skillId === us.skillId
                                ? { ...s, level: e.target.value as SkillLevel }
                                : s
                            ))
                          }
                        >
                          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => setUserSkills(userSkills.filter((s) => s.skillId !== us.skillId))}
                          className="text-green-700 hover:text-red-400 transition-colors text-xs leading-none shrink-0"
                          aria-label="Remove skill"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add skill picker */}
                {availableSkillsToAdd.length > 0 && (
                  <div className="flex gap-1.5">
                    <select
                      className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={skillPicker}
                      onChange={(e) => setSkillPicker(e.target.value)}
                    >
                      <option value="">— add skill —</option>
                      {availableSkillsToAdd.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select
                      className="rounded bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-200 focus:outline-none"
                      value={skillPickerLevel}
                      onChange={(e) => setSkillPickerLevel(e.target.value as SkillLevel)}
                    >
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <button
                      type="button"
                      disabled={!skillPicker}
                      onClick={() => {
                        const skill = allSkills.find((s) => s.id === skillPicker)
                        if (!skill) return
                        setUserSkills([...userSkills, {
                          skillId: skill.id,
                          name: skill.name,
                          category: skill.category,
                          level: skillPickerLevel,
                        }])
                        setSkillPicker('')
                      }}
                      className="rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-2.5 py-1.5 text-xs text-gray-200 transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}
                {allSkills.length === 0 && (
                  <p className="text-xs text-gray-600">No skills defined yet.</p>
                )}
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
            </form>
          )}
        </div>

        {/* Footer */}
        {!loadingProfile && !profileError && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-profile-form"
              disabled={isPending}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
