'use client'

import Image from 'next/image'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { EditProfileModal } from './EditProfileModal'

interface Props {
  name: string | null | undefined
  image: string | null | undefined
  isAdmin: boolean
}

export function SidebarUserSection({ name, image, isAdmin }: Props) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <div className="border-t border-gray-800 pt-4 mt-4 space-y-1">
        {/* Avatar + name + role badge */}
        <div className="px-3 py-2 flex items-center gap-2">
          {image && (
            <Image
              src={image}
              alt={name ?? 'avatar'}
              width={28}
              height={28}
              className="rounded-full shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-200 truncate">{name}</p>
            <span
              className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${
                isAdmin ? 'bg-violet-900 text-violet-300' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {isAdmin ? 'Admin' : 'User'}
            </span>
          </div>
        </div>

        {/* Edit profile */}
        <button
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors text-left"
        >
          ✎ Edit Profile
        </button>

        {/* Sign out — uses POST-based signOut() to prevent GET-based CSRF (VULN-009) */}
        <button
          onClick={() => signOut({ callbackUrl: '/sign-in' })}
          className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors text-left"
        >
          ↪ Sign out
        </button>
      </div>

      {editOpen && <EditProfileModal onClose={() => setEditOpen(false)} />}
    </>
  )
}
