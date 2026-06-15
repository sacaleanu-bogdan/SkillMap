import Link from 'next/link'
import type { User, Skill, SkillLevel } from '@/types'

// Color scheme for each proficiency level badge
const LEVEL_STYLES: Record<SkillLevel, string> = {
  beginner: 'bg-gray-700 text-gray-300',
  intermediate: 'bg-blue-900 text-blue-300',
  advanced: 'bg-green-900 text-green-300',
  expert: 'bg-violet-900 text-violet-300',
}

interface Props {
  users: User[]
  skills: Skill[]
  // levelMap[userId][skillId] = level (undefined means no relationship)
  levelMap: Record<string, Record<string, SkillLevel>>
}

export function SkillMatrix({ users, skills, levelMap }: Props) {
  if (users.length === 0 || skills.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No data yet — add users and skills in the{' '}
        <Link href="/manage" className="text-blue-400 hover:underline">Manage</Link>{' '}
        tab to populate the matrix.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-900 border-b border-gray-800">
            <th className="px-4 py-3 text-left text-gray-400 font-medium w-48">
              User / Skill
            </th>
            {skills.map((s) => (
              <th
                key={s.id}
                className="px-4 py-3 text-center text-gray-300 font-medium whitespace-nowrap"
              >
                <div>{s.name}</div>
                <div className="text-xs text-gray-500 font-normal">{s.category}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u, idx) => (
            <tr
              key={u.id}
              className={idx % 2 === 0 ? 'bg-gray-950' : 'bg-gray-900/50'}
            >
              <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-gray-500">{u.department} · {u.seniority}</div>
              </td>
              {skills.map((s) => {
                const level = levelMap[u.id]?.[s.id]
                return (
                  <td key={s.id} className="px-4 py-3 text-center">
                    {level ? (
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${LEVEL_STYLES[level]}`}>
                        {level}
                      </span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
