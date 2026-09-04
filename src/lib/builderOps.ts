import type { FigurePolygon, FigurePose, Joint, SegmentKind } from '../types'
import { uid } from './ids'
import { addLengthForKind, isJointDynamic } from './segment'
import { collectAncestors, collectDescendants, computeLocalMap, computeWorldJoints } from './skeleton'

export function figurePolygons(figure: FigurePose): FigurePolygon[] {
  return figure.polygons ?? []
}

export function objectCount(figure: FigurePose): number {
  return figure.joints.length + figurePolygons(figure).length
}

export function opIds(joints: Joint[], jointId: string, branch: boolean): string[] {
  if (!branch) return [jointId]
  return [...collectDescendants(joints, jointId)]
}

export function prunePolygons(polygons: FigurePolygon[], remaining: Set<string>): FigurePolygon[] {
  return polygons
    .map((polygon) => ({
      ...polygon,
      jointIds: polygon.jointIds.filter((id) => remaining.has(id)),
    }))
    .filter((polygon) => polygon.jointIds.length >= 3)
}

export function polygonsOnBranch(polygons: FigurePolygon[], branchIds: Set<string>): FigurePolygon[] {
  return polygons.filter((polygon) => polygon.jointIds.every((id) => branchIds.has(id)))
}

function rebuildAngles(joints: Joint[], positions: Map<string, { x: number; y: number }>): Joint[] {
  const byId = new Map(joints.map((joint) => [joint.id, joint]))
  const worldAngle = new Map<string, number>()
  const order: Joint[] = []
  const seen = new Set<string>()

  const visit = (id: string) => {
    if (seen.has(id)) return
    const joint = byId.get(id)
    if (!joint) return
    if (joint.parentId) visit(joint.parentId)
    seen.add(id)
    order.push(joint)
  }
  joints.forEach((joint) => visit(joint.id))

  const next = new Map<string, Joint>()
  for (const joint of order) {
    if (!joint.parentId) {
      worldAngle.set(joint.id, 0)
      next.set(joint.id, { ...joint, length: 0, angle: 0 })
      continue
    }
    const parent = positions.get(joint.parentId)
    const child = positions.get(joint.id)
    if (!parent || !child) {
      next.set(joint.id, { ...joint })
      continue
    }
    const dx = child.x - parent.x
    const dy = child.y - parent.y
    const parentAngle = worldAngle.get(joint.parentId) ?? 0
    const abs = Math.atan2(dy, dx)
    worldAngle.set(joint.id, abs)
    next.set(joint.id, {
      ...joint,
      length: Math.max(8, Math.hypot(dx, dy)),
      angle: abs - parentAngle,
    })
  }
  return joints.map((joint) => next.get(joint.id) ?? joint)
}

export function makeSegment(
  parent: Joint | undefined,
  kind: SegmentKind,
  length: number,
  angle: number,
): Joint {
  const preset = addLengthForKind(kind)
  return {
    id: uid('joint'),
    parentId: parent?.id ?? null,
    length,
    angle,
    kind,
    thickness: preset.thickness,
    visible: true,
    dynamic: parent ? isJointDynamic(parent) : true,
    fill: kind === 'ring' ? 'clear' : kind === 'circle' || kind === 'hex' ? 'solid' : undefined,
    cap: kind === 'line' || kind === 'double' ? 'round' : undefined,
  }
}

export function placeSegment(
  figure: FigurePose,
  kind: SegmentKind,
  parentId: string,
  localX: number,
  localY: number,
): { figure: FigurePose; jointId: string } | null {
  const parent = figure.joints.find((joint) => joint.id === parentId)
  if (!parent) return null
  const locals = computeLocalMap(figure.joints)
  const parentPos = locals.get(parentId) ?? { x: 0, y: 0, angle: 0 }
  const dx = localX - parentPos.x
  const dy = localY - parentPos.y
  const joint = makeSegment(parent, kind, Math.max(8, Math.hypot(dx, dy)), Math.atan2(dy, dx) - parentPos.angle)
  return {
    figure: { ...figure, joints: [...figure.joints, joint] },
    jointId: joint.id,
  }
}

export function deleteSegment(figure: FigurePose, jointId: string, branch: boolean): FigurePose | null {
  const target = figure.joints.find((joint) => joint.id === jointId)
  if (!target?.parentId) return null
  const polygons = figurePolygons(figure)

  if (branch) {
    const removeIds = collectDescendants(figure.joints, target.id)
    const remaining = new Set(figure.joints.filter((joint) => !removeIds.has(joint.id)).map((joint) => joint.id))
    return {
      ...figure,
      joints: figure.joints.filter((joint) => !removeIds.has(joint.id)),
      polygons: prunePolygons(polygons, remaining),
    }
  }

  const remaining = new Set(
    figure.joints.filter((joint) => joint.id !== target.id).map((joint) => joint.id),
  )
  return {
    ...figure,
    joints: figure.joints
      .filter((joint) => joint.id !== target.id)
      .map((joint) => (joint.parentId === target.id ? { ...joint, parentId: target.parentId } : joint)),
    polygons: prunePolygons(polygons, remaining),
  }
}

export function duplicateOnto(
  figure: FigurePose,
  jointId: string,
  parentId: string,
  branch: boolean,
  mirror: boolean,
): { figure: FigurePose; jointId: string } | null {
  const target = figure.joints.find((joint) => joint.id === jointId)
  const parent = figure.joints.find((joint) => joint.id === parentId)
  if (!target?.parentId || !parent) return null

  if (!branch) {
    const copy: Joint = {
      ...target,
      id: uid('joint'),
      parentId,
      angle: mirror ? -target.angle : target.angle,
    }
    return {
      figure: { ...figure, joints: [...figure.joints, copy] },
      jointId: copy.id,
    }
  }

  const ids = collectDescendants(figure.joints, target.id)
  const remap = new Map<string, string>()
  ids.forEach((id) => remap.set(id, uid('joint')))
  const copies = figure.joints
    .filter((joint) => ids.has(joint.id))
    .map((joint) => ({
      ...joint,
      id: remap.get(joint.id)!,
      parentId: joint.id === target.id ? parentId : remap.get(joint.parentId ?? '') ?? parentId,
      angle: mirror ? -joint.angle : joint.angle,
    }))
  const extraPolygons = polygonsOnBranch(figurePolygons(figure), ids).map((polygon) => ({
    ...polygon,
    id: uid('poly'),
    jointIds: polygon.jointIds.map((id) => remap.get(id)!),
  }))
  return {
    figure: {
      ...figure,
      joints: [...figure.joints, ...copies],
      polygons: [...figurePolygons(figure), ...extraPolygons],
    },
    jointId: remap.get(target.id)!,
  }
}

export function patchJoints(
  figure: FigurePose,
  jointId: string,
  patch: Partial<Joint>,
  branch: boolean,
): FigurePose | null {
  const target = figure.joints.find((joint) => joint.id === jointId)
  if (!target?.parentId) return null
  const ids = new Set(opIds(figure.joints, jointId, branch))
  return {
    ...figure,
    joints: figure.joints.map((joint) =>
      ids.has(joint.id) ? { ...joint, ...patch, id: joint.id, parentId: joint.parentId } : joint,
    ),
  }
}

export function colorBranch(
  figure: FigurePose,
  jointId: string,
  color: string,
  branch: boolean,
): FigurePose | null {
  const target = figure.joints.find((joint) => joint.id === jointId)
  if (!target) return null
  if (!target.parentId && !branch) {
    return { ...figure, color }
  }
  const ids = new Set(opIds(figure.joints, jointId, branch))
  const polygons = figurePolygons(figure).map((polygon) =>
    branch && polygon.jointIds.every((id) => ids.has(id)) ? { ...polygon, color } : polygon,
  )
  return {
    ...figure,
    joints: figure.joints.map((joint) => (ids.has(joint.id) ? { ...joint, color } : joint)),
    polygons,
  }
}

export function splitSegment(figure: FigurePose, jointId: string): { figure: FigurePose; jointId: string } | null {
  const target = figure.joints.find((joint) => joint.id === jointId)
  if (!target?.parentId) return null
  const mid: Joint = {
    ...target,
    id: uid('joint'),
    parentId: target.parentId,
    length: Math.max(8, target.length / 2),
  }
  const tail: Joint = {
    ...target,
    parentId: mid.id,
    length: Math.max(8, target.length / 2),
    angle: 0,
  }
  return {
    figure: {
      ...figure,
      joints: figure.joints.map((joint) => (joint.id === target.id ? tail : joint)).concat(mid),
    },
    jointId: mid.id,
  }
}

export function rerootFigure(figure: FigurePose, newOriginId: string): FigurePose | null {
  const target = figure.joints.find((joint) => joint.id === newOriginId)
  if (!target) return null
  const locals = computeLocalMap(figure.joints)
  const originPos = locals.get(newOriginId)
  if (!originPos) return null

  const shifted = new Map<string, { x: number; y: number }>()
  locals.forEach((point, id) => {
    shifted.set(id, { x: point.x - originPos.x, y: point.y - originPos.y })
  })

  const path = collectAncestors(figure.joints, newOriginId)
  const parentOf = new Map(figure.joints.map((joint) => [joint.id, joint.parentId]))
  for (let index = 0; index < path.length - 1; index += 1) {
    parentOf.set(path[index + 1], path[index])
  }
  parentOf.set(newOriginId, null)

  const reparented = figure.joints.map((joint) => ({
    ...joint,
    parentId: parentOf.get(joint.id) ?? null,
  }))
  const world = computeWorldJoints(figure).find((joint) => joint.id === newOriginId)
  return {
    ...figure,
    x: world?.x ?? figure.x,
    y: world?.y ?? figure.y,
    joints: rebuildAngles(reparented, shifted).map((joint) =>
      joint.id === newOriginId ? { ...joint, parentId: null, length: 0, angle: 0 } : joint,
    ),
  }
}

export function reorderJoints(
  figure: FigurePose,
  jointId: string,
  direction: 'front' | 'back' | 'up' | 'down',
  branch: boolean,
): FigurePose | null {
  const ids = opIds(figure.joints, jointId, branch)
  const joints = [...figure.joints]
  if (direction === 'front') {
    const moved = ids.map((id) => joints.find((joint) => joint.id === id)!).filter(Boolean)
    const rest = joints.filter((joint) => !ids.includes(joint.id))
    return { ...figure, joints: [...rest, ...moved] }
  }
  if (direction === 'back') {
    const origin = joints.filter((joint) => !joint.parentId)
    const moved = ids.map((id) => joints.find((joint) => joint.id === id)!).filter(Boolean)
    const rest = joints.filter((joint) => joint.parentId && !ids.includes(joint.id))
    return { ...figure, joints: [...origin, ...moved, ...rest] }
  }
  const index = joints.findIndex((joint) => joint.id === jointId)
  if (index <= 0) return null
  const swapWith = direction === 'up' ? index + 1 : index - 1
  if (swapWith <= 0 || swapWith >= joints.length) return { ...figure }
  const next = [...joints]
  ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
  return { ...figure, joints: next }
}

export function flipJoints(
  figure: FigurePose,
  jointId: string,
  vertical: boolean,
  branch: boolean,
): FigurePose | null {
  const target = figure.joints.find((joint) => joint.id === jointId)
  if (!target?.parentId) return null
  const ids = new Set(opIds(figure.joints, jointId, branch))
  return {
    ...figure,
    joints: figure.joints.map((joint) => {
      if (!ids.has(joint.id)) return joint
      return { ...joint, angle: vertical ? Math.PI - joint.angle : -joint.angle }
    }),
  }
}

export function addPolygon(figure: FigurePose, jointIds: string[]): FigurePose | null {
  if (jointIds.length < 3) return null
  const unique = jointIds.filter((id, index) => jointIds.indexOf(id) === index)
  if (unique.length < 3) return null
  const maxZ = figurePolygons(figure).reduce((max, polygon) => Math.max(max, polygon.zOrder ?? 0), 0)
  const polygon: FigurePolygon = {
    id: uid('poly'),
    jointIds: unique,
    zOrder: maxZ + 1,
  }
  return { ...figure, polygons: [...figurePolygons(figure), polygon] }
}

export function deletePolygon(figure: FigurePose, polygonId: string): FigurePose {
  return {
    ...figure,
    polygons: figurePolygons(figure).filter((polygon) => polygon.id !== polygonId),
  }
}

export function colorPolygon(figure: FigurePose, polygonId: string, color: string): FigurePose {
  return {
    ...figure,
    polygons: figurePolygons(figure).map((polygon) =>
      polygon.id === polygonId ? { ...polygon, color } : polygon,
    ),
  }
}
