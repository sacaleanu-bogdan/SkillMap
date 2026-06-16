'use client'

import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import type { Project } from '@/types'

interface ProjectNodeData {
  label: string
  meta: Project
}

// Custom React Flow node for Project entities.
// Amber / orange design — target handle on the left receives edges from User nodes.
function ProjectNodeComponent({ data }: { data: ProjectNodeData }) {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !border-amber-700" />
      <div className="flex flex-col items-center justify-center min-w-[100px] max-w-[160px] px-3 py-2 rounded-xl bg-amber-950 border-2 border-amber-600 shadow-lg shadow-amber-900/40 text-center">
        <span className="text-xs font-semibold text-amber-200 leading-tight">
          {data.label}
        </span>
        {data.meta?.description && (
          <span className="text-[10px] text-amber-500 mt-0.5 leading-tight truncate w-full">
            {data.meta.description}
          </span>
        )}
        <span className="text-[9px] text-amber-700 mt-0.5">project</span>
      </div>
    </>
  )
}

export const ProjectNode = memo(ProjectNodeComponent)
