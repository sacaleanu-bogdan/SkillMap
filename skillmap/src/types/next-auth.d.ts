import 'next-auth'
import 'next-auth/jwt'
import type { Role } from '@/types'

// Extend NextAuth's built-in types so `session.user.role` and `token.role`
// are typed throughout the application without casting.
declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      role: Role
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role
  }
}
