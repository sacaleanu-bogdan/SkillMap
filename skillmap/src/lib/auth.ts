import { randomUUID } from 'crypto'
import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions } from 'next-auth'
import { runQuery } from '@/lib/neo4j'

// Emails listed in ADMIN_EMAILS (comma-separated) receive the admin role.
// All other authenticated Google users receive the user role.
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
)

export const authOptions: NextAuthOptions = {
  debug: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // Runs once per sign-in. Creates the User node in Neo4j on first login;
    // subsequent logins are no-ops (MERGE on googleId guarantees idempotency).
    // MERGE key is the immutable Google OAuth `sub` claim (providerAccountId), NOT the email,
    // so a user can never get a duplicate node regardless of concurrent callbacks or email changes.
    async signIn({ user, account }) {
      if (!user.email || !account?.providerAccountId) return true
      const email = user.email.toLowerCase().trim()
      const googleId = account.providerAccountId
      const role = adminEmails.has(email) ? 'admin' : 'user'
      try {
        // Migration step: assign googleId to any user created before this fix (matched by email).
        // Safe no-op for users that already have a googleId set.
        await runQuery(
          `MATCH (u:User {email: $email}) WHERE u.googleId IS NULL SET u.googleId = $googleId`,
          { email, googleId }
        )
        // Primary upsert keyed on googleId — impossible to create a duplicate
        // even under concurrent sign-in callbacks (backed by a DB uniqueness constraint).
        await runQuery(
          `MERGE (u:User {googleId: $googleId})
           ON CREATE SET
             u.id            = $id,
             u.name          = $name,
             u.email         = $email,
             u.department    = '',
             u.seniority     = '',
             u.role          = $role,
             u.education     = [],
             u.certifications= [],
             u.languages     = []
           ON MATCH SET
             u.name  = $name,
             u.email = $email,
             u.role  = $role`,
          { googleId, id: randomUUID(), name: user.name ?? email, email, role }
        )
      } catch (err) {
        // Log but do not block sign-in if the DB is temporarily unavailable
        console.error('[NextAuth] Failed to upsert user in Neo4j:', err)
      }
      return true
    },

    // Persist role in the JWT so it's available on every request without a DB lookup
    jwt({ token, user }) {
      // On initial sign-in `user` is populated; afterwards only `token` is present
      if (user?.email) {
        token.role = adminEmails.has(user.email.toLowerCase()) ? 'admin' : 'user'
      }
      return token
    },

    session({ session, token }) {
      // Expose role on the client-visible session object
      if (session.user) {
        session.user.role = token.role as 'admin' | 'user'
      }
      return session
    },
  },

  pages: {
    signIn: '/sign-in',
  },
}
