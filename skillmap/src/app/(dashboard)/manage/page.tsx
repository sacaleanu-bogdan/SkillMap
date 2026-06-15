import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { ManagePanel } from '@/components/ui/ManagePanel'
import type { User, Skill } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ManagePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/sign-in')
  if (session.user.role !== 'admin') redirect('/matrix')

  const [users, skills] = await Promise.all([
    runQuery<User>(
      `MATCH (u:User)
       RETURN u.id AS id, u.name AS name, u.email AS email,
              u.department AS department, u.seniority AS seniority, u.role AS role,
              u.education AS education, u.certifications AS certifications,
              u.languages AS languages
       ORDER BY u.name`
    ),
    runQuery<Skill>(
      `MATCH (s:Skill)
       RETURN s.id AS id, s.name AS name, s.category AS category, s.icon AS icon
       ORDER BY s.name`
    ),
  ])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Manage</h1>
      <ManagePanel users={users} skills={skills} />
    </div>
  )
}
