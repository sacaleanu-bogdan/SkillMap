'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

export default function DevSignInForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('dev-impersonate', {
      email: email.trim().toLowerCase(),
      callbackUrl,
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError('No user found with that email. Create the user via the admin panel first.')
    } else if (result?.url) {
      // Only navigate to same-origin relative paths to prevent open-redirect (VULN-008)
      const target = result.url
      const isSafe = target.startsWith('/') && !target.startsWith('//')
      window.location.href = isSafe ? target : '/'
    }
  }

  return (
    <div className="space-y-3 border-t border-gray-800 pt-4">
      <p className="text-xs text-yellow-500/80 font-medium uppercase tracking-wide text-center">
        Dev only — impersonate user
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="email"
          required
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg border border-yellow-700 bg-yellow-900/30 px-4 py-3 text-sm font-medium text-yellow-300 hover:bg-yellow-900/50 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign in as this user'}
        </button>
      </form>
    </div>
  )
}
