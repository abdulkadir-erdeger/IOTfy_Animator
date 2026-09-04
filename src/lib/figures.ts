import type { FigurePose, FigureTemplate, Joint } from '../types'
import { cloneJoints, uid } from './ids'

function j(
  id: string,
  parentId: string | null,
  length: number,
  angle: number,
  kind: Joint['kind'] = 'line',
  thickness = 7,
): Joint {
  return { id, parentId, length, angle, kind, thickness, visible: true, dynamic: true }
}

export const STICKMAN_JOINTS: Joint[] = [
  j('origin', null, 0, 0),
  j('torso', 'origin', 48, -Math.PI / 2, 'line', 8),
  j('head', 'torso', 26, 0, 'circle', 16),
  j('l-arm', 'torso', 32, 4.05, 'line', 7),
  j('l-fore', 'l-arm', 28, 0.18, 'line', 7),
  j('r-arm', 'torso', 32, 2.23, 'line', 7),
  j('r-fore', 'r-arm', 28, -0.18, 'line', 7),
  j('l-thigh', 'origin', 38, Math.PI * 0.78, 'line', 8),
  j('l-shin', 'l-thigh', 36, 0.16, 'line', 8),
  j('r-thigh', 'origin', 38, Math.PI * 0.22, 'line', 8),
  j('r-shin', 'r-thigh', 36, -0.16, 'line', 8),
]

export const STAR_JOINTS: Joint[] = [
  j('origin', null, 0, 0),
  j('arm-1', 'origin', 42, -Math.PI / 2, 'line', 8),
  j('arm-2', 'origin', 42, -Math.PI / 2 + (Math.PI * 2) / 5, 'line', 8),
  j('arm-3', 'origin', 42, -Math.PI / 2 + ((Math.PI * 2) / 5) * 2, 'line', 8),
  j('arm-4', 'origin', 42, -Math.PI / 2 + ((Math.PI * 2) / 5) * 3, 'line', 8),
  j('arm-5', 'origin', 42, -Math.PI / 2 + ((Math.PI * 2) / 5) * 4, 'line', 8),
]

export const DOG_JOINTS: Joint[] = [
  j('origin', null, 0, 0),
  j('body', 'origin', 54, 0, 'circle', 18),
  j('neck', 'origin', 28, -2.7, 'line', 8),
  j('head', 'neck', 22, -0.4, 'circle', 14),
  j('ear', 'head', 14, -1.8, 'line', 6),
  j('tail', 'origin', 36, -0.5, 'line', 6),
  j('fl-thigh', 'origin', 22, 1.9, 'line', 7),
  j('fl-shin', 'fl-thigh', 20, 0.35, 'line', 7),
  j('fr-thigh', 'body', 22, 1.7, 'line', 7),
  j('fr-shin', 'fr-thigh', 20, 0.4, 'line', 7),
  j('bl-thigh', 'origin', 24, 1.3, 'line', 7),
  j('bl-shin', 'bl-thigh', 22, 0.55, 'line', 7),
  j('br-thigh', 'origin', 24, 2.0, 'line', 7),
  j('br-shin', 'br-thigh', 22, 0.2, 'line', 7),
]

export const DEFAULT_TEMPLATES: FigureTemplate[] = [
  { id: 'stickman', name: 'Çubuk Çocuk', joints: cloneJoints(STICKMAN_JOINTS) },
  { id: 'star', name: 'Yıldız', joints: cloneJoints(STAR_JOINTS) },
  { id: 'dog', name: 'Köpek', joints: cloneJoints(DOG_JOINTS) },
]

export function createFigureFromTemplate(
  template: FigureTemplate,
  x: number,
  y: number,
  zOrder: number,
): FigurePose {
  return {
    id: uid('fig'),
    templateId: template.id,
    name: template.name,
    x,
    y,
    scale: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    color: '#111827',
    zOrder,
    joints: cloneJoints(template.joints),
  }
}

export function emptyFigure(x: number, y: number, zOrder: number): FigurePose {
  return {
    id: uid('fig'),
    templateId: 'custom',
    name: 'Yeni Figür',
    x,
    y,
    scale: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    color: '#111827',
    zOrder,
    joints: [j('origin', null, 0, 0)],
  }
}

export function cloneFigure(figure: FigurePose): FigurePose {
  return {
    ...figure,
    joints: cloneJoints(figure.joints),
  }
}
