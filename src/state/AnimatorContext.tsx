import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type {
  AppView,
  Background,
  FigurePose,
  FigureTemplate,
  Joint,
  Project,
  Selection,
} from '../types'
import { cloneFigure, createFigureFromTemplate, emptyFigure } from '../lib/figures'
import { cloneFrame, makeInbetweenFrames } from '../lib/interpolate'
import { addLengthForKind } from '../lib/segment'
import { collectDescendants, screenToLocal, updateJointFromPointer } from '../lib/skeleton'
import { createDefaultProject, loadProject, saveProject } from '../lib/project'
import { uid } from '../lib/ids'

interface AnimatorState {
  hydrated: boolean
  project: Project
  currentFrameIndex: number
  selection: Selection
  playing: boolean
  zoom: number
  inbetweens: number
  view: AppView
  builderDraft: FigurePose | null
  builderSourceId: string | null
}

type Action =
  | { type: 'hydrate'; project: Project }
  | { type: 'new-project' }
  | { type: 'load-project'; project: Project }
  | { type: 'set-frame'; index: number }
  | { type: 'add-frame' }
  | { type: 'delete-frame' }
  | { type: 'duplicate-frame' }
  | { type: 'move-frame'; from: number; to: number }
  | { type: 'fill-inbetweens' }
  | { type: 'set-inbetweens'; value: number }
  | { type: 'set-fps'; value: number }
  | { type: 'set-loop'; value: boolean }
  | { type: 'set-playing'; value: boolean }
  | { type: 'play-next' }
  | { type: 'set-zoom'; value: number }
  | { type: 'set-background'; background: Background }
  | { type: 'select'; selection: Selection }
  | { type: 'add-figure'; templateId: string }
  | { type: 'delete-figure' }
  | { type: 'update-figure'; figureId: string; patch: Partial<FigurePose> }
  | { type: 'move-origin'; figureId: string; x: number; y: number }
  | { type: 'drag-joint'; figureId: string; jointId: string; x: number; y: number; lockLength: boolean }
  | { type: 'center-figure' }
  | { type: 'flip-figure'; axis: 'x' | 'y' }
  | { type: 'reorder-figure'; direction: 'front' | 'back' }
  | { type: 'open-builder'; mode: 'new' | 'edit' }
  | { type: 'close-builder' }
  | { type: 'set-builder-draft'; figure: FigurePose }
  | { type: 'builder-add-joint'; kind: Joint['kind'] }
  | { type: 'builder-delete-joint' }
  | { type: 'builder-duplicate-joint' }
  | { type: 'builder-patch-joint'; patch: Partial<Joint> }
  | { type: 'builder-reorder-joint'; direction: 'front' | 'back' }
  | { type: 'builder-flip-joint' }
  | { type: 'builder-color'; color: string }
  | { type: 'builder-thickness'; value: number }
  | { type: 'builder-move-origin'; x: number; y: number }
  | { type: 'builder-drag-joint'; jointId: string; x: number; y: number }
  | { type: 'builder-rename'; name: string }
  | { type: 'save-builder' }

function currentFrame(state: AnimatorState) {
  return state.project.frames[state.currentFrameIndex]
}

function mapCurrentFigures(
  state: AnimatorState,
  mapper: (figures: FigurePose[]) => FigurePose[],
): AnimatorState {
  const frames = state.project.frames.map((frame, index) =>
    index === state.currentFrameIndex
      ? { ...frame, figures: mapper(frame.figures.map(cloneFigure)) }
      : frame,
  )
  return { ...state, project: { ...state.project, frames } }
}

function selectedFigure(state: AnimatorState): FigurePose | undefined {
  const frame = currentFrame(state)
  return frame?.figures.find((figure) => figure.id === state.selection.figureId)
}

function reducer(state: AnimatorState, action: Action): AnimatorState {
  switch (action.type) {
    case 'hydrate':
    case 'load-project':
      return {
        ...state,
        hydrated: true,
        project: action.project,
        currentFrameIndex: 0,
        selection: { figureId: action.project.frames[0]?.figures[0]?.id ?? null, jointId: null },
        playing: false,
        view: 'studio',
        builderDraft: null,
        builderSourceId: null,
      }
    case 'new-project': {
      const project = createDefaultProject()
      return {
        ...state,
        project,
        currentFrameIndex: 0,
        selection: { figureId: project.frames[0].figures[0].id, jointId: null },
        playing: false,
        view: 'studio',
        builderDraft: null,
      }
    }
    case 'set-frame':
      return {
        ...state,
        currentFrameIndex: Math.max(0, Math.min(action.index, state.project.frames.length - 1)),
        playing: false,
        selection: { ...state.selection, jointId: null },
      }
    case 'add-frame': {
      const frame = currentFrame(state)
      if (!frame) return state
      const copy = cloneFrame(frame)
      const frames = [...state.project.frames]
      frames.splice(state.currentFrameIndex + 1, 0, copy)
      return {
        ...state,
        project: { ...state.project, frames },
        currentFrameIndex: state.currentFrameIndex + 1,
        playing: false,
      }
    }
    case 'delete-frame': {
      if (state.project.frames.length <= 1) return state
      const frames = state.project.frames.filter((_, index) => index !== state.currentFrameIndex)
      const nextIndex = Math.min(state.currentFrameIndex, frames.length - 1)
      return {
        ...state,
        project: { ...state.project, frames },
        currentFrameIndex: nextIndex,
        playing: false,
      }
    }
    case 'duplicate-frame': {
      const frame = currentFrame(state)
      if (!frame) return state
      const frames = [...state.project.frames]
      frames.splice(state.currentFrameIndex + 1, 0, cloneFrame(frame))
      return {
        ...state,
        project: { ...state.project, frames },
        currentFrameIndex: state.currentFrameIndex + 1,
      }
    }
    case 'move-frame': {
      const { from, to } = action
      if (from === to) return state
      if (from < 0 || to < 0 || from >= state.project.frames.length || to >= state.project.frames.length) {
        return state
      }
      const frames = [...state.project.frames]
      const [moved] = frames.splice(from, 1)
      frames.splice(to, 0, moved)
      let current = state.currentFrameIndex
      if (current === from) current = to
      else if (from < current && to >= current) current -= 1
      else if (from > current && to <= current) current += 1
      return {
        ...state,
        project: { ...state.project, frames },
        currentFrameIndex: current,
        playing: false,
      }
    }
    case 'fill-inbetweens': {
      const from = currentFrame(state)
      const to = state.project.frames[state.currentFrameIndex + 1]
      if (!from || !to || state.inbetweens <= 0) return state
      const tweens = makeInbetweenFrames(from, to, state.inbetweens)
      const frames = [...state.project.frames]
      frames.splice(state.currentFrameIndex + 1, 0, ...tweens)
      return { ...state, project: { ...state.project, frames } }
    }
    case 'set-inbetweens':
      return { ...state, inbetweens: Math.max(0, Math.min(12, action.value)) }
    case 'set-fps':
      return { ...state, project: { ...state.project, fps: Math.max(1, Math.min(24, action.value)) } }
    case 'set-loop':
      return { ...state, project: { ...state.project, loop: action.value } }
    case 'set-playing':
      return { ...state, playing: action.value }
    case 'play-next': {
      const last = state.project.frames.length - 1
      if (state.currentFrameIndex >= last) {
        if (state.project.loop) return { ...state, currentFrameIndex: 0 }
        return { ...state, playing: false }
      }
      return { ...state, currentFrameIndex: state.currentFrameIndex + 1 }
    }
    case 'set-zoom':
      return { ...state, zoom: Math.max(50, Math.min(200, action.value)) }
    case 'set-background':
      return { ...state, project: { ...state.project, background: action.background } }
    case 'select':
      return { ...state, selection: action.selection }
    case 'add-figure': {
      const template =
        state.project.templates.find((item) => item.id === action.templateId) ??
        state.project.templates[0]
      if (!template) return state
      const frame = currentFrame(state)
      const zOrder = (frame?.figures.reduce((max, figure) => Math.max(max, figure.zOrder), 0) ?? 0) + 1
      const figure = createFigureFromTemplate(
        template,
        state.project.canvasWidth / 2 + (Math.random() * 40 - 20),
        state.project.canvasHeight * 0.62,
        zOrder,
      )
      return {
        ...mapCurrentFigures(state, (figures) => [...figures, figure]),
        selection: { figureId: figure.id, jointId: null },
      }
    }
    case 'delete-figure': {
      if (!state.selection.figureId) return state
      const id = state.selection.figureId
      return {
        ...mapCurrentFigures(state, (figures) => figures.filter((figure) => figure.id !== id)),
        selection: { figureId: null, jointId: null },
      }
    }
    case 'update-figure':
      return mapCurrentFigures(state, (figures) =>
        figures.map((figure) =>
          figure.id === action.figureId ? { ...figure, ...action.patch } : figure,
        ),
      )
    case 'move-origin':
      return mapCurrentFigures(state, (figures) =>
        figures.map((figure) =>
          figure.id === action.figureId ? { ...figure, x: action.x, y: action.y } : figure,
        ),
      )
    case 'drag-joint':
      return mapCurrentFigures(state, (figures) =>
        figures.map((figure) => {
          if (figure.id !== action.figureId) return figure
          const target = figure.joints.find((joint) => joint.id === action.jointId)
          if (target && target.dynamic === false) return figure
          const local = screenToLocal(figure, action.x, action.y)
          return {
            ...figure,
            joints: updateJointFromPointer(
              figure.joints,
              action.jointId,
              local.x,
              local.y,
              action.lockLength,
            ),
          }
        }),
      )
    case 'center-figure': {
      const figure = selectedFigure(state)
      if (!figure) return state
      return mapCurrentFigures(state, (figures) =>
        figures.map((item) =>
          item.id === figure.id
            ? { ...item, x: state.project.canvasWidth / 2, y: state.project.canvasHeight / 2 }
            : item,
        ),
      )
    }
    case 'flip-figure': {
      const figure = selectedFigure(state)
      if (!figure) return state
      return mapCurrentFigures(state, (figures) =>
        figures.map((item) =>
          item.id === figure.id
            ? action.axis === 'x'
              ? { ...item, flipX: !item.flipX }
              : { ...item, flipY: !item.flipY }
            : item,
        ),
      )
    }
    case 'reorder-figure': {
      const figure = selectedFigure(state)
      if (!figure) return state
      return mapCurrentFigures(state, (figures) => {
        const zs = figures.map((item) => item.zOrder)
        const nextZ =
          action.direction === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - 1
        return figures.map((item) =>
          item.id === figure.id ? { ...item, zOrder: nextZ } : item,
        )
      })
    }
    case 'open-builder': {
      const selected = selectedFigure(state)
      const source =
        action.mode === 'edit' && selected
          ? cloneFigure(selected)
          : emptyFigure(state.project.canvasWidth / 2, state.project.canvasHeight / 2, 1)
      return {
        ...state,
        view: 'builder',
        playing: false,
        builderDraft: source,
        builderSourceId: action.mode === 'edit' && selected ? selected.id : null,
        selection: {
          figureId: source.id,
          jointId: source.joints[0]?.id ?? null,
        },
      }
    }
    case 'close-builder':
      return {
        ...state,
        view: 'studio',
        builderDraft: null,
        builderSourceId: null,
        selection: { ...state.selection, jointId: null },
      }
    case 'set-builder-draft':
      return { ...state, builderDraft: action.figure }
    case 'builder-add-joint': {
      if (!state.builderDraft) return state
      const parentId =
        state.selection.jointId &&
        state.builderDraft.joints.some((joint) => joint.id === state.selection.jointId)
          ? state.selection.jointId
          : state.builderDraft.joints[0]?.id
      if (!parentId) return state
      const preset = addLengthForKind(action.kind)
      const joint: Joint = {
        id: uid('joint'),
        parentId,
        length: preset.length,
        angle: preset.angle,
        kind: action.kind,
        thickness: preset.thickness,
        visible: true,
        dynamic: true,
      }
      const figure = {
        ...state.builderDraft,
        joints: [...state.builderDraft.joints, joint],
      }
      return {
        ...state,
        builderDraft: figure,
        selection: { figureId: figure.id, jointId: joint.id },
      }
    }
    case 'builder-delete-joint': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const target = state.builderDraft.joints.find((joint) => joint.id === state.selection.jointId)
      if (!target?.parentId) return state
      const removeIds = collectDescendants(state.builderDraft.joints, target.id)
      return {
        ...state,
        builderDraft: {
          ...state.builderDraft,
          joints: state.builderDraft.joints.filter((joint) => !removeIds.has(joint.id)),
        },
        selection: { figureId: state.builderDraft.id, jointId: target.parentId },
      }
    }
    case 'builder-duplicate-joint': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const target = state.builderDraft.joints.find((joint) => joint.id === state.selection.jointId)
      if (!target?.parentId) return state
      const copy: Joint = {
        ...target,
        id: uid('joint'),
        angle: target.angle + 0.4,
      }
      const figure = {
        ...state.builderDraft,
        joints: [...state.builderDraft.joints, copy],
      }
      return {
        ...state,
        builderDraft: figure,
        selection: { figureId: figure.id, jointId: copy.id },
      }
    }
    case 'builder-patch-joint': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const target = state.builderDraft.joints.find((joint) => joint.id === state.selection.jointId)
      if (!target?.parentId) return state
      return {
        ...state,
        builderDraft: {
          ...state.builderDraft,
          joints: state.builderDraft.joints.map((joint) =>
            joint.id === state.selection.jointId ? { ...joint, ...action.patch, id: joint.id, parentId: joint.parentId } : joint,
          ),
        },
      }
    }
    case 'builder-reorder-joint': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const joints = [...state.builderDraft.joints]
      const index = joints.findIndex((joint) => joint.id === state.selection.jointId)
      if (index <= 0) return state
      const [moved] = joints.splice(index, 1)
      if (action.direction === 'front') joints.push(moved)
      else joints.splice(1, 0, moved)
      return {
        ...state,
        builderDraft: { ...state.builderDraft, joints },
      }
    }
    case 'builder-flip-joint': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const target = state.builderDraft.joints.find((joint) => joint.id === state.selection.jointId)
      if (!target?.parentId) return state
      return {
        ...state,
        builderDraft: {
          ...state.builderDraft,
          joints: state.builderDraft.joints.map((joint) =>
            joint.id === state.selection.jointId ? { ...joint, angle: -joint.angle } : joint,
          ),
        },
      }
    }
    case 'builder-color': {
      if (!state.builderDraft) return state
      return { ...state, builderDraft: { ...state.builderDraft, color: action.color } }
    }
    case 'builder-thickness': {
      if (!state.builderDraft || !state.selection.jointId) return state
      return {
        ...state,
        builderDraft: {
          ...state.builderDraft,
          joints: state.builderDraft.joints.map((joint) =>
            joint.id === state.selection.jointId ? { ...joint, thickness: action.value } : joint,
          ),
        },
      }
    }
    case 'builder-move-origin': {
      if (!state.builderDraft) return state
      return {
        ...state,
        builderDraft: { ...state.builderDraft, x: action.x, y: action.y },
      }
    }
    case 'builder-drag-joint': {
      if (!state.builderDraft) return state
      const local = screenToLocal(state.builderDraft, action.x, action.y)
      return {
        ...state,
        builderDraft: {
          ...state.builderDraft,
          joints: updateJointFromPointer(
            state.builderDraft.joints,
            action.jointId,
            local.x,
            local.y,
            false,
          ),
        },
      }
    }
    case 'builder-rename': {
      if (!state.builderDraft) return state
      return { ...state, builderDraft: { ...state.builderDraft, name: action.name } }
    }
    case 'save-builder': {
      if (!state.builderDraft) return state
      const draft = state.builderDraft
      const template: FigureTemplate = {
        id: uid('tpl'),
        name: draft.name || 'Yeni Figür',
        joints: draft.joints.map((joint) => ({ ...joint })),
      }
      const templates = [...state.project.templates, template]
      if (state.builderSourceId) {
        const updated = mapCurrentFigures(
          { ...state, project: { ...state.project, templates } },
          (figures) =>
            figures.map((figure) =>
              figure.id === state.builderSourceId
                ? { ...figure, joints: draft.joints.map((joint) => ({ ...joint })), name: draft.name }
                : figure,
            ),
        )
        return {
          ...updated,
          view: 'studio',
          builderDraft: null,
          builderSourceId: null,
          selection: { figureId: state.builderSourceId, jointId: null },
        }
      }
      const frame = currentFrame(state)
      const zOrder = (frame?.figures.reduce((max, figure) => Math.max(max, figure.zOrder), 0) ?? 0) + 1
      const placed = createFigureFromTemplate(
        template,
        state.project.canvasWidth / 2,
        state.project.canvasHeight * 0.62,
        zOrder,
      )
      const next = mapCurrentFigures(
        { ...state, project: { ...state.project, templates } },
        (figures) => [...figures, placed],
      )
      return {
        ...next,
        view: 'studio',
        builderDraft: null,
        builderSourceId: null,
        selection: { figureId: placed.id, jointId: null },
      }
    }
    default:
      return state
  }
}

const initialState: AnimatorState = {
  hydrated: false,
  project: createDefaultProject(),
  currentFrameIndex: 0,
  selection: { figureId: null, jointId: null },
  playing: false,
  zoom: 100,
  inbetweens: 0,
  view: 'studio',
  builderDraft: null,
  builderSourceId: null,
}

interface AnimatorContextValue extends AnimatorState {
  dispatch: Dispatch<Action>
  frame: Project['frames'][number] | undefined
  selected: FigurePose | undefined
}

const AnimatorContext = createContext<AnimatorContextValue | null>(null)

export function AnimatorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    dispatch({ type: 'hydrate', project: loadProject() })
  }, [])

  useEffect(() => {
    if (!state.hydrated) return
    saveProject(state.project)
  }, [state.project, state.hydrated])

  const value = useMemo<AnimatorContextValue>(() => {
    const frame = state.project.frames[state.currentFrameIndex]
    const selected =
      state.view === 'builder'
        ? state.builderDraft ?? undefined
        : frame?.figures.find((figure) => figure.id === state.selection.figureId)
    return { ...state, dispatch, frame, selected }
  }, [state])

  return <AnimatorContext.Provider value={value}>{children}</AnimatorContext.Provider>
}

export function useAnimator() {
  const ctx = useContext(AnimatorContext)
  if (!ctx) throw new Error('AnimatorProvider gerekli')
  return ctx
}

export function usePlayback() {
  const { playing, project, dispatch } = useAnimator()

  useEffect(() => {
    if (!playing) return
    const interval = 1000 / project.fps
    const id = window.setInterval(() => {
      dispatch({ type: 'play-next' })
    }, interval)
    return () => window.clearInterval(id)
  }, [playing, project.fps, dispatch])

  const toggle = useCallback(() => {
    dispatch({ type: 'set-playing', value: !playing })
  }, [dispatch, playing])

  return { toggle }
}
