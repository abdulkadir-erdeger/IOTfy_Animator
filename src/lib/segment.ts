import type { CircleFill, Joint, LineCap, SegmentKind } from '../types'

export function isJointVisible(joint: Joint): boolean {
  return joint.visible !== false
}

export function isJointDynamic(joint: Joint): boolean {
  return joint.dynamic !== false
}

export function segmentRadius(joint: { thickness: number; length: number }): number {
  return Math.max(joint.thickness, joint.length * 0.42)
}

export function hexPointList(cx: number, cy: number, radius: number): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
  })
}

export function hexPoints(cx: number, cy: number, radius: number): string {
  return hexPointList(cx, cy, radius)
    .map((point) => `${point.x},${point.y}`)
    .join(' ')
}

export function parallelOffset(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number,
): { ax1: number; ay1: number; ax2: number; ay2: number; bx1: number; by1: number; bx2: number; by2: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * offset
  const ny = (dx / len) * offset
  return {
    ax1: x1 + nx,
    ay1: y1 + ny,
    ax2: x2 + nx,
    ay2: y2 + ny,
    bx1: x1 - nx,
    by1: y1 - ny,
    bx2: x2 - nx,
    by2: y2 - ny,
  }
}

export function addLengthForKind(kind: SegmentKind): { length: number; thickness: number; angle: number } {
  if (kind === 'circle') return { length: 24, thickness: 16, angle: -Math.PI / 3 }
  if (kind === 'ring') return { length: 26, thickness: 6, angle: -Math.PI / 3 }
  if (kind === 'hex') return { length: 24, thickness: 16, angle: -Math.PI / 4 }
  if (kind === 'double') return { length: 42, thickness: 5, angle: -Math.PI / 5 }
  return { length: 40, thickness: 7, angle: -Math.PI / 3 }
}

export function resolvedFill(joint: Joint): CircleFill {
  if (joint.kind === 'ring') return joint.fill ?? 'clear'
  return joint.fill ?? 'solid'
}

export function resolvedCap(joint: Joint): LineCap {
  return joint.cap ?? 'round'
}

export function nextFill(fill: CircleFill): CircleFill {
  if (fill === 'solid') return 'white'
  if (fill === 'white') return 'clear'
  return 'solid'
}

export function nextCap(cap: LineCap): LineCap {
  return cap === 'round' ? 'square' : 'round'
}

export function toggledKind(kind: SegmentKind): SegmentKind {
  if (kind === 'line' || kind === 'double') return 'circle'
  return 'line'
}

export function isCircleLike(kind: SegmentKind): boolean {
  return kind === 'circle' || kind === 'ring' || kind === 'hex'
}

export function isLineLike(kind: SegmentKind): boolean {
  return kind === 'line' || kind === 'double'
}

export function segmentColor(figureColor: string, joint: { color?: string | null }): string {
  return joint.color || figureColor
}
