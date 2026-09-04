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
import {
  addPolygon,
  colorBranch,
  colorPolygon,
  deletePolygon,
  deleteSegment,
  duplicateOnto,
  flipJoints,
  patchJoints,
  placeSegment,
  reorderJoints,
  rerootFigure,
  splitSegment,
} from '../lib/builderOps'
import { nextCap, nextFill, resolvedCap, resolvedFill, toggledKind } from '../lib/segment'
import { screenToLocal, updateJointFromPointer } from '../lib/skeleton'
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
  builderUndo: FigurePose[]
  builderRedo: FigurePose[]
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
  | { type: 'builder-new' }
  | { type: 'builder-undo' }
  | { type: 'builder-redo' }
  | { type: 'builder-rename'; name: string }
  | { type: 'builder-place-joint'; kind: Joint['kind']; parentId: string; x: number; y: number }
  | { type: 'builder-delete'; branch: boolean }
  | { type: 'builder-duplicate-onto'; parentId: string; branch: boolean; mirror: boolean }
  | { type: 'builder-patch'; patch: Partial<Joint>; branch: boolean }
  | { type: 'builder-toggle-kind'; branch: boolean }
  | { type: 'builder-cycle-fill'; branch: boolean }
  | { type: 'builder-cycle-cap'; branch: boolean }
  | { type: 'builder-nudge-thickness'; delta: number; branch: boolean }
  | { type: 'builder-set-origin' }
  | { type: 'builder-split' }
  | { type: 'builder-reorder'; direction: 'front' | 'back' | 'up' | 'down'; branch: boolean }
  | { type: 'builder-flip'; vertical: boolean; branch: boolean }
  | { type: 'builder-color'; color: string; branch: boolean }
  | { type: 'builder-add-polygon'; jointIds: string[] }
  | { type: 'builder-delete-polygon' }
  | { type: 'builder-move-origin'; x: number; y: number }
  | { type: 'builder-drag-joint'; jointId: string; x: number; y: number; checkpoint?: boolean }
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

function pushBuilderHistory(state: AnimatorState): AnimatorState {
  if (!state.builderDraft) return state
  return {
    ...state,
    builderUndo: [...state.builderUndo, cloneFigure(state.builderDraft)].slice(-60),
    builderRedo: [],
  }
}

function setBuilderDraft(
  state: AnimatorState,
  figure: FigurePose,
  extra?: Partial<Pick<AnimatorState, 'selection'>>,
): AnimatorState {
  return {
    ...pushBuilderHistory(state),
    builderDraft: figure,
    ...extra,
  }
}

function clearBuilder(state: AnimatorState, extra: Partial<AnimatorState> = {}): AnimatorState {
  return {
    ...state,
    view: 'studio',
    builderDraft: null,
    builderSourceId: null,
    builderUndo: [],
    builderRedo: [],
    ...extra,
  }
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
        builderUndo: [],
        builderRedo: [],
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
        builderUndo: [],
        builderRedo: [],
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
        builderUndo: [],
        builderRedo: [],
        selection: {
          figureId: source.id,
          jointId: source.joints[0]?.id ?? null,
          polygonId: null,
        },
      }
    }
    case 'close-builder':
      return clearBuilder(state, { selection: { ...state.selection, jointId: null, polygonId: null } })
    case 'builder-new': {
      if (!state.builderDraft) return state
      const source = emptyFigure(state.project.canvasWidth / 2, state.project.canvasHeight / 2, 1)
      return {
        ...pushBuilderHistory(state),
        builderDraft: source,
        builderSourceId: null,
        selection: { figureId: source.id, jointId: source.joints[0]?.id ?? null, polygonId: null },
      }
    }
    case 'builder-undo': {
      if (!state.builderDraft || state.builderUndo.length === 0) return state
      const previous = state.builderUndo[state.builderUndo.length - 1]
      return {
        ...state,
        builderDraft: previous,
        builderUndo: state.builderUndo.slice(0, -1),
        builderRedo: [...state.builderRedo, cloneFigure(state.builderDraft)].slice(-60),
        selection: {
          figureId: previous.id,
          jointId: previous.joints.some((joint) => joint.id === state.selection.jointId)
            ? state.selection.jointId
            : previous.joints[0]?.id ?? null,
          polygonId: null,
        },
      }
    }
    case 'builder-redo': {
      if (!state.builderDraft || state.builderRedo.length === 0) return state
      const next = state.builderRedo[state.builderRedo.length - 1]
      return {
        ...state,
        builderDraft: next,
        builderRedo: state.builderRedo.slice(0, -1),
        builderUndo: [...state.builderUndo, cloneFigure(state.builderDraft)].slice(-60),
        selection: {
          figureId: next.id,
          jointId: next.joints.some((joint) => joint.id === state.selection.jointId)
            ? state.selection.jointId
            : next.joints[0]?.id ?? null,
          polygonId: null,
        },
      }
    }
    case 'builder-place-joint': {
      if (!state.builderDraft) return state
      const local = screenToLocal(state.builderDraft, action.x, action.y)
      const placed = placeSegment(state.builderDraft, action.kind, action.parentId, local.x, local.y)
      if (!placed) return state
      return setBuilderDraft(state, placed.figure, {
        selection: { figureId: placed.figure.id, jointId: placed.jointId, polygonId: null },
      })
    }
    case 'builder-delete': {
      if (!state.builderDraft) return state
      if (state.selection.polygonId) {
        return setBuilderDraft(state, deletePolygon(state.builderDraft, state.selection.polygonId), {
          selection: { figureId: state.builderDraft.id, jointId: state.selection.jointId, polygonId: null },
        })
      }
      if (!state.selection.jointId) return state
      const next = deleteSegment(state.builderDraft, state.selection.jointId, action.branch)
      if (!next) return state
      const parentId = state.builderDraft.joints.find((joint) => joint.id === state.selection.jointId)?.parentId
      return setBuilderDraft(state, next, {
        selection: { figureId: next.id, jointId: parentId ?? next.joints[0]?.id ?? null, polygonId: null },
      })
    }
    case 'builder-duplicate-onto': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const copied = duplicateOnto(
        state.builderDraft,
        state.selection.jointId,
        action.parentId,
        action.branch,
        action.mirror,
      )
      if (!copied) return state
      return setBuilderDraft(state, copied.figure, {
        selection: { figureId: copied.figure.id, jointId: copied.jointId, polygonId: null },
      })
    }
    case 'builder-patch': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const next = patchJoints(state.builderDraft, state.selection.jointId, action.patch, action.branch)
      if (!next) return state
      return setBuilderDraft(state, next)
    }
    case 'builder-toggle-kind': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const target = state.builderDraft.joints.find((joint) => joint.id === state.selection.jointId)
      if (!target) return state
      const next = patchJoints(
        state.builderDraft,
        state.selection.jointId,
        { kind: toggledKind(target.kind) },
        action.branch,
      )
      if (!next) return state
      return setBuilderDraft(state, next)
    }
    case 'builder-cycle-fill': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const target = state.builderDraft.joints.find((joint) => joint.id === state.selection.jointId)
      if (!target) return state
      const next = patchJoints(
        state.builderDraft,
        state.selection.jointId,
        { fill: nextFill(resolvedFill(target)), kind: target.kind === 'ring' ? 'circle' : target.kind },
        action.branch,
      )
      if (!next) return state
      return setBuilderDraft(state, next)
    }
    case 'builder-cycle-cap': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const target = state.builderDraft.joints.find((joint) => joint.id === state.selection.jointId)
      if (!target) return state
      const next = patchJoints(
        state.builderDraft,
        state.selection.jointId,
        { cap: nextCap(resolvedCap(target)) },
        action.branch,
      )
      if (!next) return state
      return setBuilderDraft(state, next)
    }
    case 'builder-nudge-thickness': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const target = state.builderDraft.joints.find((joint) => joint.id === state.selection.jointId)
      if (!target) return state
      const next = patchJoints(
        state.builderDraft,
        state.selection.jointId,
        { thickness: Math.max(0, Math.min(40, target.thickness + action.delta)) },
        action.branch,
      )
      if (!next) return state
      return setBuilderDraft(state, next)
    }
    case 'builder-set-origin': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const next = rerootFigure(state.builderDraft, state.selection.jointId)
      if (!next) return state
      return setBuilderDraft(state, next, {
        selection: { figureId: next.id, jointId: state.selection.jointId, polygonId: null },
      })
    }
    case 'builder-split': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const split = splitSegment(state.builderDraft, state.selection.jointId)
      if (!split) return state
      return setBuilderDraft(state, split.figure, {
        selection: { figureId: split.figure.id, jointId: split.jointId, polygonId: null },
      })
    }
    case 'builder-reorder': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const next = reorderJoints(state.builderDraft, state.selection.jointId, action.direction, action.branch)
      if (!next) return state
      return setBuilderDraft(state, next)
    }
    case 'builder-flip': {
      if (!state.builderDraft || !state.selection.jointId) return state
      const next = flipJoints(state.builderDraft, state.selection.jointId, action.vertical, action.branch)
      if (!next) return state
      return setBuilderDraft(state, next)
    }
    case 'builder-color': {
      if (!state.builderDraft) return state
      if (state.selection.polygonId) {
        return setBuilderDraft(state, colorPolygon(state.builderDraft, state.selection.polygonId, action.color))
      }
      if (!state.selection.jointId) {
        return setBuilderDraft(state, { ...state.builderDraft, color: action.color })
      }
      const next = colorBranch(state.builderDraft, state.selection.jointId, action.color, action.branch)
      if (!next) return state
      return setBuilderDraft(state, next)
    }
    case 'builder-add-polygon': {
      if (!state.builderDraft) return state
      const next = addPolygon(state.builderDraft, action.jointIds)
      if (!next) return state
      const polygonId = next.polygons?.[next.polygons.length - 1]?.id ?? null
      return setBuilderDraft(state, next, {
        selection: { figureId: next.id, jointId: state.selection.jointId, polygonId },
      })
    }
    case 'builder-delete-polygon': {
      if (!state.builderDraft || !state.selection.polygonId) return state
      return setBuilderDraft(state, deletePolygon(state.builderDraft, state.selection.polygonId), {
        selection: { figureId: state.builderDraft.id, jointId: state.selection.jointId, polygonId: null },
      })
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
      const base = action.checkpoint ? pushBuilderHistory(state) : state
      const draft = base.builderDraft
      if (!draft) return state
      const local = screenToLocal(draft, action.x, action.y)
      return {
        ...base,
        builderDraft: {
          ...draft,
          joints: updateJointFromPointer(draft.joints, action.jointId, local.x, local.y, false),
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
        polygons: (draft.polygons ?? []).map((polygon) => ({ ...polygon, jointIds: [...polygon.jointIds] })),
      }
      const templates = [...state.project.templates, template]
      if (state.builderSourceId) {
        const updated = mapCurrentFigures(
          { ...state, project: { ...state.project, templates } },
          (figures) =>
            figures.map((figure) =>
              figure.id === state.builderSourceId
                ? {
                    ...figure,
                    joints: draft.joints.map((joint) => ({ ...joint })),
                    polygons: template.polygons,
                    name: draft.name,
                    color: draft.color,
                  }
                : figure,
            ),
        )
        return clearBuilder(updated, { selection: { figureId: state.builderSourceId, jointId: null } })
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
      return clearBuilder(next, { selection: { figureId: placed.id, jointId: null } })
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
  builderUndo: [],
  builderRedo: [],
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
