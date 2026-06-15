import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// NextAuth v4 catch-all route handler for App Router
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
