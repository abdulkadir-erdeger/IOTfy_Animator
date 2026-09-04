import type { FigurePolygon, Joint } from '../types'

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`
}

export function cloneJoints(joints: Joint[]): Joint[] {
  return joints.map((joint) => ({ ...joint }))
}

export function clonePolygons(polygons: FigurePolygon[] | undefined): FigurePolygon[] {
  return (polygons ?? []).map((polygon) => ({ ...polygon, jointIds: [...polygon.jointIds] }))
}
