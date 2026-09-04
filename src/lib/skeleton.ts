import type { FigurePose, Joint, WorldJoint } from '../types'

export function computeWorldJoints(figure: FigurePose): WorldJoint[] {
  const byId = new Map(figure.joints.map((joint) => [joint.id, joint]))
  const local = new Map<string, { x: number; y: number; angle: number }>()

  const resolve = (id: string): { x: number; y: number; angle: number } => {
    const cached = local.get(id)
    if (cached) return cached

    const joint = byId.get(id)
    if (!joint) return { x: 0, y: 0, angle: 0 }

    if (!joint.parentId) {
      const origin = { x: 0, y: 0, angle: 0 }
      local.set(id, origin)
      return origin
    }

    const parent = resolve(joint.parentId)
    const angle = parent.angle + joint.angle
    const point = {
      x: parent.x + Math.cos(angle) * joint.length,
      y: parent.y + Math.sin(angle) * joint.length,
      angle,
    }
    local.set(id, point)
    return point
  }

  figure.joints.forEach((joint) => resolve(joint.id))

  const rot = figure.rotation
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)

  return figure.joints.map((joint) => {
    const point = local.get(joint.id) ?? { x: 0, y: 0, angle: 0 }
    let x = point.x * figure.scale
    let y = point.y * figure.scale
    if (figure.flipX) x = -x
    if (figure.flipY) y = -y
    const worldX = figure.x + x * cos - y * sin
    const worldY = figure.y + x * sin + y * cos

    const parentPoint = joint.parentId
      ? local.get(joint.parentId) ?? { x: 0, y: 0, angle: 0 }
      : { x: 0, y: 0, angle: 0 }
    let px = parentPoint.x * figure.scale
    let py = parentPoint.y * figure.scale
    if (figure.flipX) px = -px
    if (figure.flipY) py = -py

    return {
      id: joint.id,
      parentId: joint.parentId,
      x: worldX,
      y: worldY,
      parentX: joint.parentId ? figure.x + px * cos - py * sin : worldX,
      parentY: joint.parentId ? figure.y + px * sin + py * cos : worldY,
      worldAngle: point.angle,
      kind: joint.kind,
      thickness: joint.thickness * figure.scale,
      length: joint.length * figure.scale,
      visible: joint.visible !== false,
      dynamic: joint.dynamic !== false,
    }
  })
}

export function screenToLocal(
  figure: FigurePose,
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  let x = screenX - figure.x
  let y = screenY - figure.y
  const cos = Math.cos(-figure.rotation)
  const sin = Math.sin(-figure.rotation)
  const rx = x * cos - y * sin
  const ry = x * sin + y * cos
  x = rx
  y = ry
  if (figure.flipX) x = -x
  if (figure.flipY) y = -y
  const scale = figure.scale || 1
  return { x: x / scale, y: y / scale }
}

export function updateJointFromPointer(
  joints: Joint[],
  jointId: string,
  localX: number,
  localY: number,
  lockLength: boolean,
): Joint[] {
  const byId = new Map(joints.map((joint) => [joint.id, joint]))
  const target = byId.get(jointId)
  if (!target?.parentId) return joints

  const parentWorld = localPosition(joints, target.parentId)
  const dx = localX - parentWorld.x
  const dy = localY - parentWorld.y
  const parentAngle = localPosition(joints, target.parentId).angle
  const worldAngle = Math.atan2(dy, dx)
  const length = lockLength ? target.length : Math.max(8, Math.hypot(dx, dy))

  return joints.map((joint) =>
    joint.id === jointId
      ? { ...joint, angle: worldAngle - parentAngle, length }
      : joint,
  )
}

function localPosition(
  joints: Joint[],
  id: string,
): { x: number; y: number; angle: number } {
  const byId = new Map(joints.map((joint) => [joint.id, joint]))
  const walk = (jointId: string): { x: number; y: number; angle: number } => {
    const joint = byId.get(jointId)
    if (!joint || !joint.parentId) return { x: 0, y: 0, angle: 0 }
    const parent = walk(joint.parentId)
    const angle = parent.angle + joint.angle
    return {
      x: parent.x + Math.cos(angle) * joint.length,
      y: parent.y + Math.sin(angle) * joint.length,
      angle,
    }
  }
  return walk(id)
}

export function collectDescendants(joints: Joint[], jointId: string): Set<string> {
  const ids = new Set<string>([jointId])
  let added = true
  while (added) {
    added = false
    for (const joint of joints) {
      if (joint.parentId && ids.has(joint.parentId) && !ids.has(joint.id)) {
        ids.add(joint.id)
        added = true
      }
    }
  }
  return ids
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return a + diff * t
}
