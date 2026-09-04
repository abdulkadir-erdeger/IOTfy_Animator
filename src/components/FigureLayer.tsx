import type { PointerEvent } from 'react'
import type { FigurePose } from '../types'
import { isCoarsePointer } from '../lib/pointer'
import { hexPoints, parallelOffset, segmentRadius } from '../lib/segment'
import { computeWorldJoints } from '../lib/skeleton'

interface FigureLayerProps {
  figure: FigurePose
  onion?: boolean
  showHandles?: boolean
  selected?: boolean
  selectedJointId?: string | null
  builder?: boolean
  onJointPointerDown?: (figureId: string, jointId: string, event: PointerEvent) => void
  onFigurePointerDown?: (figureId: string) => void
}

export function FigureLayer({
  figure,
  onion = false,
  showHandles = false,
  selected = false,
  selectedJointId = null,
  builder = false,
  onJointPointerDown,
  onFigurePointerDown,
}: FigureLayerProps) {
  const world = computeWorldJoints(figure)
  const color = onion ? '#94a3b8' : figure.color
  const hit = isCoarsePointer() ? 28 : 18

  return (
    <g
      onPointerDown={(event) => {
        if (onion) return
        event.stopPropagation()
        onFigurePointerDown?.(figure.id)
      }}
      style={{ cursor: onion ? 'default' : 'pointer' }}
    >
      {world.map((joint) => {
        if (!joint.parentId) return null
        if (!joint.visible && !builder) return null
        const hidden = !joint.visible
        const opacity = onion ? 0.32 : hidden ? 0.22 : 1
        const radius = segmentRadius(joint)
        const offset = Math.max(3, joint.thickness * 0.55)
        const twin = parallelOffset(joint.parentX, joint.parentY, joint.x, joint.y, offset)

        return (
          <g key={`seg-${joint.id}`} opacity={opacity}>
            <line
              x1={joint.parentX}
              y1={joint.parentY}
              x2={joint.x}
              y2={joint.y}
              stroke="transparent"
              strokeWidth={Math.max(joint.thickness, hit)}
              strokeLinecap="round"
            />
            {joint.kind === 'double' ? (
              <>
                <line x1={twin.ax1} y1={twin.ay1} x2={twin.ax2} y2={twin.ay2} stroke={color} strokeWidth={joint.thickness} strokeLinecap="round" pointerEvents="none" />
                <line x1={twin.bx1} y1={twin.by1} x2={twin.bx2} y2={twin.by2} stroke={color} strokeWidth={joint.thickness} strokeLinecap="round" pointerEvents="none" />
              </>
            ) : joint.kind === 'ring' ? (
              <>
                <line x1={joint.parentX} y1={joint.parentY} x2={joint.x} y2={joint.y} stroke={color} strokeWidth={Math.max(3, joint.thickness * 0.55)} strokeLinecap="round" pointerEvents="none" />
                <circle cx={joint.x} cy={joint.y} r={radius} fill="none" stroke={color} strokeWidth={Math.max(3, joint.thickness)} pointerEvents="none" />
              </>
            ) : joint.kind === 'hex' ? (
              <>
                <line x1={joint.parentX} y1={joint.parentY} x2={joint.x} y2={joint.y} stroke={color} strokeWidth={Math.max(3, joint.thickness * 0.45)} strokeLinecap="round" pointerEvents="none" />
                <polygon points={hexPoints(joint.x, joint.y, radius)} fill={color} pointerEvents="none" />
              </>
            ) : joint.kind === 'circle' ? (
              <>
                <line x1={joint.parentX} y1={joint.parentY} x2={joint.x} y2={joint.y} stroke={color} strokeWidth={joint.thickness} strokeLinecap="round" pointerEvents="none" />
                <circle cx={joint.x} cy={joint.y} r={radius} fill={color} pointerEvents="none" />
              </>
            ) : (
              <line
                x1={joint.parentX}
                y1={joint.parentY}
                x2={joint.x}
                y2={joint.y}
                stroke={color}
                strokeWidth={joint.thickness}
                strokeLinecap="round"
                pointerEvents="none"
              />
            )}
          </g>
        )
      })}

      {showHandles &&
        world.map((joint) => {
          const hidden = !joint.visible
          if (hidden && !builder) return null
          const isOrigin = !joint.parentId
          const isSelected = selectedJointId === joint.id
          const fill = isOrigin
            ? '#f59e0b'
            : isSelected
              ? '#ef4444'
              : builder
                ? '#38bdf8'
                : joint.dynamic
                  ? '#ef4444'
                  : '#94a3b8'
          const radius = isOrigin ? 10 : isSelected ? 9 : 8
          return (
            <g key={`h-${joint.id}`} opacity={hidden ? 0.4 : 1}>
              <circle
                cx={joint.x}
                cy={joint.y}
                r={hit}
                fill="transparent"
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onJointPointerDown?.(figure.id, joint.id, event)
                }}
                style={{ cursor: 'grab', touchAction: 'none' }}
              />
              <circle
                cx={joint.x}
                cy={joint.y}
                r={radius}
                fill={fill}
                stroke={isSelected || (selected && isOrigin) ? '#fff' : 'rgba(15,23,42,0.25)'}
                strokeWidth={isSelected ? 3 : 1.5}
                style={{
                  filter: isSelected ? 'drop-shadow(0 0 6px rgba(244,63,94,0.55))' : undefined,
                  pointerEvents: 'none',
                }}
              />
            </g>
          )
        })}
    </g>
  )
}
