import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import GoogleSignInButton from '@/components/ui/GoogleSignInButton'
import DevSignInForm from '@/components/ui/DevSignInForm'

// Sign-in page — if already authenticated, redirect straight to the dashboard
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (session) redirect('/')

  const { callbackUrl } = await searchParams

  // Reject absolute or protocol-relative URLs to prevent open-redirect attacks (VULN-008)
  // Only allow relative paths that start with / and do not start with //
  function isSafeCallbackUrl(url: string | undefined): url is string {
    if (!url) return false
    try {
      new URL(url)   // throws for relative URLs — if it doesn't throw, it's absolute
      return false
    } catch {
      return url.startsWith('/') && !url.startsWith('//')
    }
  }
  const callback = isSafeCallbackUrl(callbackUrl) ? callbackUrl : '/'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-8 space-y-6 shadow-2xl">
        {/* Logo / title */}
        <div className="text-center space-y-1">
          <div className="text-3xl font-bold text-white tracking-tight">SkillMap</div>
          <p className="text-sm text-gray-500">Sign in to your organization</p>
        </div>

        {/* Google sign-in button — triggers NextAuth Google provider */}
        <GoogleSignInButton callbackUrl={callback} />

        {process.env.DEV_AUTH_ENABLED === 'true' && (
          <DevSignInForm callbackUrl={callback} />
        )}

        <p className="text-center text-xs text-gray-600">
          Access is restricted to organization members.
        </p>
      </div>
    </div>
  )
}
