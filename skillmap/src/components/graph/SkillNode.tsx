'use client'

import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import type { Skill } from '@/types'

interface SkillNodeData {
  label: string
  meta: Skill
}

// Custom React Flow node for Skill entities.
// Pill / rounded-rect design with green accent — target handle on the left
// receives edges from User nodes.
function SkillNodeComponent({ data }: { data: SkillNodeData }) {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-green-500 !border-green-700" />
      <div className="flex flex-col items-center justify-center min-w-[100px] max-w-[140px] px-3 py-2 rounded-xl bg-green-950 border-2 border-green-600 shadow-lg shadow-green-900/40 text-center">
        <span className="text-xs font-semibold text-green-200 leading-tight">
          {data.label}
        </span>
        {data.meta?.category && (
          <span className="text-[10px] text-green-500 mt-0.5 leading-tight">
            {data.meta.category}
          </span>
        )}
      </div>
    </>
  )
}

export const SkillNode = memo(SkillNodeComponent)
