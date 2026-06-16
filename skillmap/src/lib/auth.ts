import { randomUUID } from 'crypto'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextAuthOptions } from 'next-auth'
import { runQuery } from '@/lib/neo4j'
import type { Role } from '@/types'

// Validate NEXTAUTH_SECRET is present and meets minimum entropy at module load time
// (VULN-013: fail fast rather than failing silently on first sign-in)
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    'NEXTAUTH_SECRET environment variable is not set. Generate one with: openssl rand -base64 32'
  )
}
if (Buffer.from(process.env.NEXTAUTH_SECRET, 'utf8').length < 32) {
  throw new Error('NEXTAUTH_SECRET must be at least 32 characters long.')
}

const VALID_ROLES: Role[] = ['admin', 'manager', 'employee']

// Emails listed in ADMIN_EMAILS (comma-separated) receive the admin role.
// All other authenticated Google users receive the user role.
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
)

export const authOptions: NextAuthOptions = {
  // Only enable verbose debug output in local development — never in production
  // (VULN-004: debug:true leaks JWT payloads and OAuth tokens to logs)
  debug: process.env.NODE_ENV === 'development',
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Dev-only: sign in as any existing Neo4j user by email — never active unless DEV_AUTH_ENABLED=true
    ...(process.env.DEV_AUTH_ENABLED === 'true'
      ? [
          CredentialsProvider({
            id: 'dev-impersonate',
            name: 'Dev Impersonate',
            credentials: {
              email: { label: 'Email', type: 'email' },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null
              const email = credentials.email.toLowerCase().trim()
              const rows = await runQuery<{ id: string; name: string; role: string }>(
                'MATCH (u:User {email: $email}) RETURN u.id AS id, u.name AS name, u.role AS role',
                { email }
              )
              if (rows.length === 0) return null
              const { id, name, role } = rows[0]
              return { id, name, email, role } as { id: string; name: string; email: string; role: string }
            },
          }),
        ]
      : []),
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
      const role = adminEmails.has(email) ? 'admin' : 'employee'
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
    // (VULN-001: preserve the full Role type — admin | manager | employee)
    jwt({ token, user, account }) {
      // On initial sign-in `user` is populated; afterwards only `token` is present
      if (user?.email) {
        if (account?.provider === 'dev-impersonate') {
          // Use the role returned directly from Neo4j; validate it before trusting
          const rawRole = (user as { role?: string }).role ?? 'employee'
          token.role = VALID_ROLES.includes(rawRole as Role) ? (rawRole as Role) : 'employee'
        } else {
          // Google sign-in: adminEmails whitelist bootstraps first-login admins;
          // everyone else is 'employee' until an admin promotes them via the UI
          token.role = adminEmails.has(user.email.toLowerCase()) ? 'admin' : 'employee'
        }
      }
      return token
    },

    session({ session, token }) {
      // Expose role on the client-visible session object
      if (session.user) {
        session.user.role = (token.role ?? 'employee') as Role
      }
      return session
    },
  },

  pages: {
    signIn: '/sign-in',
  },
}
