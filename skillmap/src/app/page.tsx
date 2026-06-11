import Link from 'next/link'
import { SkillGraph } from '@/components/graph/SkillGraph'

// Force dynamic — SkillGraph fetches /api/graph at request time
export const dynamic = 'force-dynamic'

// Root page: renders the full dashboard shell (sidebar + graph canvas).
// This file takes priority over (dashboard)/page.tsx for the / route
// because non-grouped pages win over route-group pages in Next.js.
export default function HomePage() {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col gap-1 border-r border-gray-800 bg-gray-900 px-3 py-6">
        <span className="px-3 mb-4 text-lg font-bold tracking-tight text-white">
          SkillMap
        </span>
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
      </aside>

      {/* Graph canvas fills remaining space */}
      <main className="flex-1 overflow-hidden">
        <SkillGraph />
      </main>
    </div>
  )
}
