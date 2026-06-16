import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { runQuery } from '@/lib/neo4j'
import { ManagePanel } from '@/components/ui/ManagePanel'
import type { User, Skill, Project } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ManagePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/sign-in')
  if (session.user.role !== 'admin') redirect('/matrix')

  const [users, skills, projects] = await Promise.all([
    runQuery<User>(
      `MATCH (u:User)
       RETURN u.id AS id, u.name AS name, u.email AS email,
              u.department AS department, u.seniority AS seniority, u.role AS role,
              u.education AS education, u.certifications AS certifications,
              u.languages AS languages, u.shortDescription AS shortDescription,
              u.projects AS projects
       ORDER BY u.name`
    ),
    runQuery<Skill>(
      `MATCH (s:Skill)
       RETURN s.id AS id, s.name AS name, s.category AS category, s.icon AS icon
       ORDER BY s.name`
    ),
    runQuery<Project>(
      `MATCH (p:Project)
       RETURN p.id AS id, p.name AS name, p.description AS description
       ORDER BY p.name`
    ),
  ])

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-hidden">
      <h1 className="text-2xl font-bold text-white shrink-0">Manage</h1>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ManagePanel users={users} skills={skills} projects={projects} />
      </div>
    </div>
  )
}
