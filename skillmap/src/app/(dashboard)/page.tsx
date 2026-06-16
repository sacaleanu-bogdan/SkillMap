import { SkillGraph } from '@/components/graph/SkillGraph'

// Force dynamic — fetches /api/graph at request time
export const dynamic = 'force-dynamic'

// Graph page — layout and auth are handled by (dashboard)/layout.tsx
export default function GraphPage() {
  return (
    <div className="w-full h-full overflow-hidden">
      <SkillGraph />
    </div>
  )
}
