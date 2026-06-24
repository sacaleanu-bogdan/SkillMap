'use client'

import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import type { User } from '@/types'

interface UserNodeData {
  label: string
  meta: User
}

// Custom React Flow node for User entities.
// Circular design with blue accent — source handle on the right connects to Skill nodes.
function UserNodeComponent({ data }: { data: UserNodeData }) {
  return (
    <>
      <div className="flex flex-col items-center justify-center w-28 h-28 rounded-full bg-blue-950 border-2 border-blue-500 shadow-lg shadow-blue-900/40 text-center px-2 cursor-pointer hover:border-blue-300 hover:shadow-blue-400/30 transition-colors">
        <span className="text-xs font-semibold text-blue-200 leading-tight line-clamp-2">
          {data.label}
        </span>
        {data.meta?.department && (
          <span className="text-[10px] text-blue-400 mt-1 leading-tight line-clamp-1">
            {data.meta.department}
          </span>
        )}
      </div>
      {/* Edges connect from this handle toward skill nodes */}
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !border-blue-700" />
    </>
  )
}

export const UserNode = memo(UserNodeComponent)
