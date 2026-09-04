import type { FigurePose, Frame } from '../types'
import { uid } from './ids'
import { cloneFigure } from './figures'
import { lerp, lerpAngle } from './skeleton'

export function cloneFrame(frame: Frame): Frame {
  return {
    id: uid('frame'),
    figures: frame.figures.map(cloneFigure),
  }
}

export function interpolateFigures(
  from: FigurePose[],
  to: FigurePose[],
  t: number,
): FigurePose[] {
  return to.map((end) => {
    const start = from.find((figure) => figure.id === end.id)
    if (!start) return cloneFigure(end)
    return {
      ...cloneFigure(end),
      x: lerp(start.x, end.x, t),
      y: lerp(start.y, end.y, t),
      scale: lerp(start.scale, end.scale, t),
      rotation: lerpAngle(start.rotation, end.rotation, t),
      joints: end.joints.map((joint) => {
        const prev = start.joints.find((item) => item.id === joint.id)
        if (!prev) return { ...joint }
        return {
          ...joint,
          angle: lerpAngle(prev.angle, joint.angle, t),
          length: lerp(prev.length, joint.length, t),
        }
      }),
    }
  })
}

export function makeInbetweenFrames(from: Frame, to: Frame, count: number): Frame[] {
  if (count <= 0) return []
  return Array.from({ length: count }, (_, index) => ({
    id: uid('frame'),
    figures: interpolateFigures(from.figures, to.figures, (index + 1) / (count + 1)),
  }))
}
