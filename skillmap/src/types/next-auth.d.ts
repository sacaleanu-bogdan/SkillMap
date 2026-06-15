import 'next-auth'
import 'next-auth/jwt'

// Extend NextAuth's built-in types so `session.user.role` and `token.role`
// are typed throughout the application without casting.
declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      role: 'admin' | 'user'
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'admin' | 'user'
  }
}
