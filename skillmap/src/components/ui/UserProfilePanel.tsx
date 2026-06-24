'use client'

import { useEffect, useState } from 'react'
import type { Role, User } from '@/types'

interface SkillEntry {
  name: string
  category: string
  years: number
}

interface ProjectEntry {
  name: string
  status: 'current' | 'previous'
  contribution?: string
}

interface ExtendedProfile {
  education: string[]
  certifications: string[]
  languages: string[]
  shortDescription: string
  department?: string
  seniority?: string
  email?: string
  role?: string
}

interface Props {
  userId: string
  meta: User
  skills: SkillEntry[]
  projects: ProjectEntry[]
  onClose: () => void
  /** When true, an Edit Profile button is shown in the footer. */
  canEdit?: boolean
  /** Called with the full user object when the Edit button is clicked. */
  onEdit?: (user: User) => void
}

// Returns initials from a full name (up to 2 characters)
function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// Badge color based on years of experience (mirrors SkillMatrix thresholds)
function yearsBadgeClass(years: number): string {
  if (years >= 10) return 'bg-violet-900 text-violet-300 border border-violet-700'
  if (years >= 5) return 'bg-green-900 text-green-300 border border-green-700'
  if (years >= 2) return 'bg-blue-900 text-blue-300 border border-blue-700'
  return 'bg-gray-700 text-gray-300 border border-gray-600'
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  )
}

export function UserProfilePanel({ userId, meta, skills, projects, onClose, canEdit, onEdit }: Props) {
  const [extended, setExtended] = useState<ExtendedProfile | null>(null)
  const [loadingExt, setLoadingExt] = useState(true)

  useEffect(() => {
    setLoadingExt(true)
    setExtended(null)
    fetch(`/api/users/${userId}`)
      .then((r) => r.json())
      .then((data) => setExtended({
        education: data.education ?? [],
        certifications: data.certifications ?? [],
        languages: data.languages ?? [],
        shortDescription: data.shortDescription ?? '',
        department: data.department,
        seniority: data.seniority,
        email: data.email,
        role: data.role,
      }))
      .catch(() => setExtended({ education: [], certifications: [], languages: [], shortDescription: '' }))
      .finally(() => setLoadingExt(false))
  }, [userId])

  const currentProjects = projects.filter((p) => p.status === 'current')
  const previousProjects = projects.filter((p) => p.status === 'previous')

  return (
    // Backdrop — identical structure to EditProfileModal
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl max-h-[90vh] flex flex-col">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Identity row */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-950 border-2 border-blue-500 flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-blue-200">{initials(meta.name)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-white leading-tight">{meta.name}</p>
              <p className="text-sm text-gray-400">{meta.seniority}</p>
              {meta.department && (
                <p className="text-xs text-blue-400">{meta.department}</p>
              )}
            </div>
          </div>

          {/* Short description */}
          {loadingExt ? (
            <p className="text-xs text-gray-600 animate-pulse">Loading…</p>
          ) : extended?.shortDescription ? (
            <p className="text-sm text-gray-300 leading-relaxed">{extended.shortDescription}</p>
          ) : null}

          {/* Skills */}
          {skills.length > 0 && (
            <Section title="Skills">
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span
                    key={s.name}
                    title={s.category}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${yearsBadgeClass(s.years)}`}
                  >
                    {s.name}
                    <span className="opacity-70 font-normal">{s.years}yr</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Projects */}
          {(currentProjects.length > 0 || previousProjects.length > 0) && (
            <Section title="Projects">
              {currentProjects.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-amber-500 uppercase tracking-wide">Currently allocated on</p>
                  {currentProjects.map((p) => (
                    <div key={p.name} className="rounded bg-amber-950/40 border border-amber-800/40 px-3 py-2 space-y-1">
                      <p className="text-xs font-medium text-amber-200">{p.name}</p>
                      {p.contribution && (
                        <p className="text-[11px] text-gray-400 leading-snug">{p.contribution}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {previousProjects.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Previously allocated on</p>
                  {previousProjects.map((p) => (
                    <div key={p.name} className="rounded bg-gray-800/60 border border-gray-700/60 px-3 py-2 space-y-1">
                      <p className="text-xs text-gray-400">{p.name}</p>
                      {p.contribution && (
                        <p className="text-[11px] text-gray-500 leading-snug">{p.contribution}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Extended profile fields (fetched) */}
          {!loadingExt && extended && (
            <>
              {extended.education.length > 0 && (
                <Section title="Education">
                  <ul className="space-y-1">
                    {extended.education.map((e, i) => (
                      <li key={i} className="text-xs text-gray-300 leading-snug">{e}</li>
                    ))}
                  </ul>
                </Section>
              )}

              {extended.certifications.length > 0 && (
                <Section title="Certifications">
                  <div className="flex flex-wrap gap-1.5">
                    {extended.certifications.map((c, i) => (
                      <span key={i} className="rounded bg-gray-800 border border-gray-700 px-2.5 py-0.5 text-xs text-gray-300">
                        {c}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {extended.languages.length > 0 && (
                <Section title="Languages">
                  <div className="flex flex-wrap gap-1.5">
                    {extended.languages.map((l, i) => (
                      <span key={i} className="rounded bg-gray-800 border border-gray-700 px-2.5 py-0.5 text-xs text-gray-300">
                        {l}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
          {canEdit && onEdit && (
            <button
              type="button"
              disabled={!extended}
              onClick={() => {
                if (!extended) return
                onEdit({
                  ...meta,
                  email: extended.email ?? meta.email ?? '',
                  department: extended.department ?? meta.department ?? '',
                  seniority: extended.seniority ?? meta.seniority ?? '',
                  role: ((extended.role as Role | undefined) ?? meta.role ?? 'employee') as Role,
                  education: extended.education,
                  certifications: extended.certifications,
                  languages: extended.languages,
                  shortDescription: extended.shortDescription,
                })
              }}
              className="rounded-lg px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
