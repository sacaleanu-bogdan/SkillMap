'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/types'

const INPUT =
  'w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

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

  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [seniority, setSeniority] = useState('')
  const [education, setEducation] = useState<string[]>([])
  const [certifications, setCertifications] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])

  // Load the current user's profile when the modal opens
  useEffect(() => {
    fetch('/api/users/me')
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? `Failed to load profile (${res.status})`)
        }
        return res.json() as Promise<User>
      })
      .then((user) => {
        setUserId(user.id)
        setName(user.name)
        setDepartment(user.department)
        setSeniority(user.seniority)
        setEducation(user.education ?? [])
        setCertifications(user.certifications ?? [])
        setLanguages(user.languages ?? [])
      })
      .catch((err: Error) => setProfileError(err.message))
      .finally(() => setLoadingProfile(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')

    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, department, seniority, education, certifications, languages }),
    })

    if (!res.ok) {
      const data = await res.json()
      setSubmitError(data.error ?? 'Failed to save profile')
      return
    }

    // Signal the graph canvas to refetch without a full page reload
    window.dispatchEvent(new CustomEvent('skillmap:profile-updated'))
    startTransition(() => {
      router.refresh()
      onClose()
    })
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl max-h-[90vh] flex flex-col">
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
