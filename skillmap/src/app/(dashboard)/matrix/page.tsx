import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { SkillMatrix } from '@/components/ui/SkillMatrix'
import type { User, Skill, SkillLevel } from '@/types'

// Force dynamic rendering — this page calls Neo4j at request time,
// so it must never be statically prerendered during `next build`.
export const dynamic = 'force-dynamic'

// Server component — fetches users, skills, and all HAS_SKILL relationships
// directly from Neo4j and passes them to the client SkillMatrix component.
export default async function MatrixPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/sign-in')

  const [users, skills, relationships] = await Promise.all([
    runQuery<User>(
      `MATCH (u:User)
       RETURN u.id AS id, u.name AS name, u.email AS email,
              u.department AS department, u.seniority AS seniority, u.role AS role
       ORDER BY u.name`
    ),
    runQuery<Skill>(
      `MATCH (s:Skill)
       RETURN s.id AS id, s.name AS name, s.category AS category, s.icon AS icon
       ORDER BY s.name`
    ),
    runQuery<{ userId: string; skillId: string; level: SkillLevel }>(
      `MATCH (u:User)-[r:HAS_SKILL]->(s:Skill)
       RETURN u.id AS userId, s.id AS skillId, r.level AS level`
    ),
  ])

  // Build a lookup map: levelMap[userId][skillId] = level
  const levelMap: Record<string, Record<string, SkillLevel>> = {}
  for (const rel of relationships) {
    if (!levelMap[rel.userId]) levelMap[rel.userId] = {}
    levelMap[rel.userId][rel.skillId] = rel.level
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Skill Matrix</h1>
      <SkillMatrix users={users} skills={skills} levelMap={levelMap} />
    </div>
  )
}
