'use client'

import { useState, useTransition } from 'react'
import type { Skill } from '@/types'

const INPUT =
  'w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

interface Props {
  skill: Skill
  onClose: () => void
  onSaved: () => void
}

export function EditSkillModal({ skill, onClose, onSaved }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name, setName] = useState(skill.name)
  const [category, setCategory] = useState(skill.category)
  const [icon, setIcon] = useState(skill.icon ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch(`/api/skills/${skill.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, icon: icon || undefined }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to save changes')
      return
    }
    startTransition(() => onSaved())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Edit Skill</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form id="edit-skill-form" onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-900/40 border border-red-700 px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Skill Name</label>
            <input className={INPUT} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Skill name" />
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Category</label>
            <input className={INPUT} required value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Frontend" />
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Icon (optional)</label>
            <input className={INPUT} value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. 🐍 or a URL" />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="rounded bg-gray-700 hover:bg-gray-600 px-4 py-2 text-sm text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            form="edit-skill-form"
            type="submit"
            disabled={isPending}
            className="rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
