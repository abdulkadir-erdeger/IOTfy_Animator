import type { PointerEvent } from 'react'
import type { FigurePose } from '../types'
import { figurePolygons } from '../lib/builderOps'
import { isCoarsePointer } from '../lib/pointer'
import { hexPoints, parallelOffset, segmentColor, segmentRadius } from '../lib/segment'
import { collectAncestors, computeWorldJoints } from '../lib/skeleton'

interface FigureLayerProps {
  figure: FigurePose
  onion?: boolean
  showHandles?: boolean
  selected?: boolean
  selectedJointId?: string | null
  selectedPolygonId?: string | null
  builder?: boolean
  highlight?: boolean
  branchIds?: string[]
  polygonDraft?: string[]
  showStaticHandles?: boolean
  onJointPointerDown?: (figureId: string, jointId: string, event: PointerEvent) => void
  onSegmentPointerDown?: (figureId: string, jointId: string, event: PointerEvent) => void
  onPolygonPointerDown?: (figureId: string, polygonId: string, event: PointerEvent) => void
  onFigurePointerDown?: (figureId: string) => void
}

export function FigureLayer({
  figure,
  onion = false,
  showHandles = false,
  selected = false,
  selectedJointId = null,
  selectedPolygonId = null,
  builder = false,
  highlight = false,
  branchIds = [],
  polygonDraft = [],
  showStaticHandles = true,
  onJointPointerDown,
  onSegmentPointerDown,
  onPolygonPointerDown,
  onFigurePointerDown,
}: FigureLayerProps) {
  const world = computeWorldJoints(figure)
  const byId = new Map(world.map((joint) => [joint.id, joint]))
  const hit = isCoarsePointer() ? 28 : 18
  const pathIds = selectedJointId && highlight ? collectAncestors(figure.joints, selectedJointId) : []
  const branch = new Set(branchIds)
  const draftPoints = polygonDraft
    .map((id) => byId.get(id))
    .filter((joint): joint is NonNullable<typeof joint> => Boolean(joint))

  return (
    <g
      onPointerDown={(event) => {
        if (onion) return
        event.stopPropagation()
        onFigurePointerDown?.(figure.id)
      }}
      style={{ cursor: onion ? 'default' : 'pointer' }}
    >
      {figurePolygons(figure).map((polygon) => {
        const points = polygon.jointIds
          .map((id) => byId.get(id))
          .filter((joint): joint is NonNullable<typeof joint> => Boolean(joint))
        if (points.length < 3) return null
        const fill = onion ? '#94a3b8' : polygon.color || figure.color
        const active = selectedPolygonId === polygon.id
        return (
          <polygon
            key={polygon.id}
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill={fill}
            fillOpacity={onion ? 0.18 : (polygon.opacity ?? 0.85) * (active ? 1 : 0.9)}
            stroke={active ? '#38bdf8' : 'none'}
            strokeWidth={active ? 3 : 0}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onPolygonPointerDown?.(figure.id, polygon.id, event)
            }}
          />
        )
      })}

      {draftPoints.length >= 2 && (
        <polyline
          points={draftPoints.map((point) => `${point.x},${point.y}`).join(' ')}
          fill={draftPoints.length >= 3 ? 'rgba(56,189,248,0.25)' : 'none'}
          stroke="#38bdf8"
          strokeWidth={3}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}

      {highlight &&
        pathIds.slice(0, -1).map((id, index) => {
          const from = byId.get(id)
          const to = byId.get(pathIds[index + 1])
          if (!from || !to) return null
          return (
            <line
              key={`path-${id}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#38bdf8"
              strokeWidth={4}
              strokeLinecap="round"
              pointerEvents="none"
            />
          )
        })}

      {world.map((joint) => {
        if (!joint.parentId) return null
        if (!joint.visible && !builder) return null
        const hidden = !joint.visible
        const zero = joint.thickness <= 0
        if (zero && !builder) return null
        const isSelected = selectedJointId === joint.id
        const onPath = pathIds.includes(joint.id)
        const color = onion
          ? '#94a3b8'
          : highlight && (isSelected || onPath)
            ? '#38bdf8'
            : segmentColor(figure.color, joint)
        const opacity = onion ? 0.32 : hidden ? 0.22 : joint.opacity
        const radius = segmentRadius(joint)
        const offset = Math.max(3, Math.max(joint.thickness, 2) * 0.55)
        const twin = parallelOffset(joint.parentX, joint.parentY, joint.x, joint.y, offset)
        const cap = joint.cap
        const strokeW = zero ? 1.5 : joint.thickness
        const dash = zero ? '5 4' : undefined

        return (
          <g key={`seg-${joint.id}`} opacity={opacity}>
            <line
              x1={joint.parentX}
              y1={joint.parentY}
              x2={joint.x}
              y2={joint.y}
              stroke="transparent"
              strokeWidth={Math.max(joint.thickness, hit)}
              strokeLinecap={cap}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onSegmentPointerDown?.(figure.id, joint.id, event)
              }}
            />
            {joint.kind === 'double' ? (
              <>
                <line x1={twin.ax1} y1={twin.ay1} x2={twin.ax2} y2={twin.ay2} stroke={color} strokeWidth={strokeW} strokeLinecap={cap} strokeDasharray={dash} pointerEvents="none" />
                <line x1={twin.bx1} y1={twin.by1} x2={twin.bx2} y2={twin.by2} stroke={color} strokeWidth={strokeW} strokeLinecap={cap} strokeDasharray={dash} pointerEvents="none" />
              </>
            ) : joint.kind === 'hex' ? (
              <>
                <line x1={joint.parentX} y1={joint.parentY} x2={joint.x} y2={joint.y} stroke={color} strokeWidth={Math.max(2, strokeW * 0.45)} strokeLinecap={cap} strokeDasharray={dash} pointerEvents="none" />
                <polygon points={hexPoints(joint.x, joint.y, radius)} fill={joint.fill === 'clear' ? 'none' : joint.fill === 'white' ? '#ffffff' : color} stroke={color} strokeWidth={joint.fill === 'clear' || joint.fill === 'white' ? Math.max(2, strokeW) : 0} pointerEvents="none" />
              </>
            ) : joint.kind === 'circle' || joint.kind === 'ring' ? (
              <>
                <line x1={joint.parentX} y1={joint.parentY} x2={joint.x} y2={joint.y} stroke={color} strokeWidth={joint.kind === 'ring' || joint.fill === 'clear' ? Math.max(2, strokeW * 0.55) : strokeW} strokeLinecap={cap} strokeDasharray={dash} pointerEvents="none" />
                <circle
                  cx={joint.x}
                  cy={joint.y}
                  r={radius}
                  fill={joint.fill === 'clear' ? 'none' : joint.fill === 'white' ? '#ffffff' : color}
                  stroke={joint.fill === 'solid' ? 'none' : color}
                  strokeWidth={joint.fill === 'solid' ? 0 : Math.max(2, strokeW)}
                  pointerEvents="none"
                />
              </>
            ) : (
              <line
                x1={joint.parentX}
                y1={joint.parentY}
                x2={joint.x}
                y2={joint.y}
                stroke={color}
                strokeWidth={strokeW}
                strokeLinecap={cap}
                strokeDasharray={dash}
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
          const inBranch = branch.has(joint.id)
          if (!isOrigin && !joint.dynamic && !showStaticHandles && !isSelected && !inBranch && builder) return null
          const fill = isOrigin
            ? '#f59e0b'
            : isSelected
              ? joint.dynamic
                ? '#ef4444'
                : '#b91c1c'
              : inBranch
                ? '#ef4444'
                : builder
                  ? joint.dynamic
                    ? '#38bdf8'
                    : '#94a3b8'
                  : joint.dynamic
                    ? '#ef4444'
                    : '#94a3b8'
          const radius = isOrigin ? 10 : isSelected || inBranch ? 9 : 8
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
