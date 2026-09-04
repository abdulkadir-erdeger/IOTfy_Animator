export type SegmentKind = 'line' | 'circle' | 'ring' | 'hex' | 'double'
export type CircleFill = 'solid' | 'white' | 'clear'
export type LineCap = 'round' | 'square'

export interface Joint {
  id: string
  parentId: string | null
  length: number
  angle: number
  kind: SegmentKind
  thickness: number
  visible?: boolean
  dynamic?: boolean
  fill?: CircleFill
  cap?: LineCap
  color?: string
  opacity?: number
}

export interface FigurePolygon {
  id: string
  jointIds: string[]
  color?: string
  opacity?: number
  zOrder?: number
}

export interface FigurePose {
  id: string
  templateId: string
  name: string
  x: number
  y: number
  scale: number
  rotation: number
  flipX: boolean
  flipY: boolean
  color: string
  zOrder: number
  joints: Joint[]
  polygons?: FigurePolygon[]
}

export interface Frame {
  id: string
  figures: FigurePose[]
}

export interface FigureTemplate {
  id: string
  name: string
  joints: Joint[]
  polygons?: FigurePolygon[]
}

export interface Background {
  id: string
  name: string
  type: 'color' | 'gradient' | 'image'
  value: string
}

export interface Project {
  frames: Frame[]
  templates: FigureTemplate[]
  fps: number
  loop: boolean
  background: Background
  canvasWidth: number
  canvasHeight: number
}

export interface Selection {
  figureId: string | null
  jointId: string | null
  polygonId?: string | null
}

export interface WorldJoint {
  id: string
  parentId: string | null
  x: number
  y: number
  parentX: number
  parentY: number
  worldAngle: number
  kind: SegmentKind
  thickness: number
  length: number
  visible: boolean
  dynamic: boolean
  fill: CircleFill
  cap: LineCap
  color: string | null
  opacity: number
}

export type AppView = 'studio' | 'builder'
