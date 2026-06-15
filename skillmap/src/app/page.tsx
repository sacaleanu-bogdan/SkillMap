import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { SkillGraph } from '@/components/graph/SkillGraph'
import { SidebarUserSection } from '@/components/ui/SidebarUserSection'

// Force dynamic — fetches session and /api/graph at request time
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/sign-in')

  const isAdmin = session.user.role === 'admin'

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-gray-800 bg-gray-900 px-3 py-6">
        <span className="px-3 mb-6 text-lg font-bold tracking-tight text-white">SkillMap</span>

        <nav className="flex flex-col gap-1 flex-1">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <span>⬡</span> Graph
          </Link>
          <Link
            href="/matrix"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <span>⊞</span> Skill Matrix
          </Link>
        </nav>

        <SidebarUserSection
          name={session.user.name}
          image={session.user.image}
          isAdmin={isAdmin}
        />
      </aside>

      {/* Graph canvas fills remaining space */}
      <main className="flex-1 overflow-hidden">
        <SkillGraph />
      </main>
    </div>
  )
}

