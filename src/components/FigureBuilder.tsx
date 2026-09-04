import {
  BringToFront,
  CircleDot,
  Copy,
  Eye,
  EyeOff,
  FilePlus,
  FlipHorizontal,
  GitBranch,
  HelpCircle,
  Lock,
  Minus,
  Palette,
  Plus,
  Redo2,
  Save,
  Scissors,
  SendToBack,
  Spline,
  Square,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import logo from '../assets/logo.svg'
import { useLang } from '../i18n/LanguageContext'
import { figurePolygons, objectCount } from '../lib/builderOps'
import { isCircleLike, isJointDynamic, isJointVisible, isLineLike, resolvedCap, resolvedFill } from '../lib/segment'
import { collectDescendants } from '../lib/skeleton'
import { useAnimator } from '../state/AnimatorContext'
import type { SegmentKind } from '../types'
import { ColorPickerModal } from './ColorPickerModal'
import { HelpModal } from './HelpModal'
import { LanguageSwitch } from './LanguageSwitch'
import { StageCanvas } from './StageCanvas'
import { StatusBar } from './StatusBar'

type BuilderTool =
  | { type: 'idle' }
  | { type: 'add'; kind: SegmentKind; parentId: string | null }
  | { type: 'polygon'; jointIds: string[] }
  | { type: 'duplicate'; mirror: boolean }

const CANVAS_COLORS = ['#ffffff', '#fef3c7', '#e0f2fe', '#d1fae5', '#111827']
const BG_KEY = 'iotfy-builder-canvas-bg'

function ToolButton({
  label,
  disabled,
  active,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-bold leading-tight touch-manipulation disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-violet-200 text-violet-950 ring-2 ring-violet-400'
          : 'bg-white/80 text-slate-700 shadow-sm ring-1 ring-slate-200/80 hover:bg-white'
      }`}
    >
      {children}
    </button>
  )
}

function LineGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden>
      <line x1="5" y1="20" x2="21" y2="6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="5" cy="20" r="3" fill="#ef4444" />
      <circle cx="21" cy="6" r="3" fill="#ef4444" />
    </svg>
  )
}

function CircleGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden>
      <circle cx="13" cy="13" r="8" fill="currentColor" />
    </svg>
  )
}

function RingGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden>
      <circle cx="13" cy="13" r="8" stroke="currentColor" strokeWidth="3" />
    </svg>
  )
}

function HexGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden>
      <polygon points="13,3 22,8.5 22,17.5 13,23 4,17.5 4,8.5" fill="currentColor" />
    </svg>
  )
}

function DoubleGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden>
      <line x1="5" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="5" y1="17" x2="21" y2="17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const ADD_TOOLS: { kind: SegmentKind; label: 'ball' | 'line' | 'ring' | 'hex' | 'doubleLine'; icon: ReactNode }[] = [
  { kind: 'circle', label: 'ball', icon: <CircleGlyph /> },
  { kind: 'line', label: 'line', icon: <LineGlyph /> },
  { kind: 'ring', label: 'ring', icon: <RingGlyph /> },
  { kind: 'hex', label: 'hex', icon: <HexGlyph /> },
  { kind: 'double', label: 'doubleLine', icon: <DoubleGlyph /> },
]

export function FigureBuilder() {
  const { builderDraft, selection, zoom, project, dispatch, builderUndo, builderRedo } = useAnimator()
  const { t } = useLang()
  const drag = useRef<{ jointId: string; origin: boolean } | null>(null)
  const didCheckpoint = useRef(false)
  const [tool, setTool] = useState<BuilderTool>({ type: 'idle' })
  const [showColor, setShowColor] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [colorTarget, setColorTarget] = useState<'paint' | 'canvas'>('paint')
  const [preview, setPreview] = useState(false)
  const [highlight, setHighlight] = useState(false)
  const [showStatic, setShowStatic] = useState(true)
  const [branchOn, setBranchOn] = useState(false)
  const [shift, setShift] = useState(false)
  const [canvasBg, setCanvasBg] = useState(() => {
    try {
      return localStorage.getItem(BG_KEY) || '#ffffff'
    } catch {
      return '#ffffff'
    }
  })

  const branch = branchOn || shift
  const toolActive = tool.type !== 'idle'

  useEffect(() => {
    try {
      localStorage.setItem(BG_KEY, canvasBg)
    } catch {
      // ignore
    }
  }, [canvasBg])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setShift(true)
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (event.key === 'Escape') {
        setTool({ type: 'idle' })
        return
      }
      if (event.key === ' ' || (event.ctrlKey && event.key.toLowerCase() === 'p')) {
        event.preventDefault()
        setPreview((value) => !value)
      }
      if (event.key === 'F12') {
        event.preventDefault()
        setHighlight((value) => !value)
      }
      if (event.key === 'F10') {
        event.preventDefault()
        setShowStatic((value) => !value)
      }
      if (event.key === 'F9') {
        event.preventDefault()
        setCanvasBg((value) => {
          const index = CANVAS_COLORS.indexOf(value)
          return CANVAS_COLORS[(index + 1) % CANVAS_COLORS.length]
        })
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) dispatch({ type: 'builder-redo' })
        else dispatch({ type: 'builder-undo' })
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        dispatch({ type: 'builder-redo' })
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setShift(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [dispatch])

  if (!builderDraft) return null

  const selectedJoint = builderDraft.joints.find((joint) => joint.id === selection.jointId)
  const selectedPolygon = figurePolygons(builderDraft).find((polygon) => polygon.id === selection.polygonId)
  const canEdit = Boolean(selectedJoint?.parentId) || Boolean(selectedPolygon)
  const hidden = selectedJoint ? !isJointVisible(selectedJoint) : false
  const locked = selectedJoint ? !isJointDynamic(selectedJoint) : false
  const angleDeg = Math.round(((selectedJoint?.angle ?? 0) * 180) / Math.PI)
  const branchIds =
    branch && selectedJoint ? [...collectDescendants(builderDraft.joints, selectedJoint.id)] : []
  const paintColor = selectedPolygon?.color || selectedJoint?.color || builderDraft.color

  const toggleAdd = (kind: SegmentKind) => {
    if (tool.type === 'add' && tool.kind === kind) {
      setTool({ type: 'idle' })
      return
    }
    setTool({ type: 'add', kind, parentId: selectedJoint?.id ?? null })
  }

  const modeHint =
    tool.type === 'add' && !tool.parentId
      ? t('pickPivot')
      : tool.type === 'add'
        ? t('placeHint')
        : tool.type === 'polygon'
          ? t('polygonHint')
          : tool.type === 'duplicate'
            ? t('duplicateHint')
            : t('builderSubhint')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b-2 border-violet-300/70 bg-violet-200 px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
        <img src={logo} alt="IOTfy Animator" className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-violet-950 sm:text-lg">{t('builderTitle')}</h2>
          <p className="text-xs font-semibold text-violet-800/80">
            {t('objectsCount', { n: objectCount(builderDraft) })}
            <span className="hidden sm:inline"> · {modeHint}</span>
          </p>
        </div>
        <input
          value={builderDraft.name}
          onChange={(event) => dispatch({ type: 'builder-rename', name: event.target.value })}
          className="min-h-11 w-28 rounded-2xl border-2 border-white/70 bg-white/80 px-3 py-2 text-sm font-bold text-slate-700 outline-none select-text focus:border-violet-300 sm:w-40"
          placeholder={t('figureName')}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-sm font-bold text-violet-900 ring-1 ring-white/80 touch-manipulation"
            onClick={() => {
              if (window.confirm(t('newFigureConfirm'))) dispatch({ type: 'builder-new' })
            }}
          >
            <FilePlus size={16} />
            <span className="hidden sm:inline">{t('builderNew')}</span>
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white/70 px-3 text-violet-900 ring-1 ring-white/80 touch-manipulation disabled:opacity-40"
            disabled={builderUndo.length === 0}
            title={t('undo')}
            onClick={() => dispatch({ type: 'builder-undo' })}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white/70 px-3 text-violet-900 ring-1 ring-white/80 touch-manipulation disabled:opacity-40"
            disabled={builderRedo.length === 0}
            title={t('redo')}
            onClick={() => dispatch({ type: 'builder-redo' })}
          >
            <Redo2 size={16} />
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-sm font-bold text-violet-900 ring-1 ring-white/80 touch-manipulation"
            onClick={() => dispatch({ type: 'close-builder' })}
          >
            <span className="hidden sm:inline">{t('cancel')}</span>
            <span className="sm:hidden">✕</span>
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-violet-300 px-3 py-2 text-sm font-bold text-violet-950 touch-manipulation hover:bg-violet-200"
            onClick={() => dispatch({ type: 'save-builder' })}
          >
            <Save size={16} />
            <span className="hidden sm:inline">{t('save')}</span>
          </button>
          <LanguageSwitch />
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/70 text-violet-800 touch-manipulation hover:bg-white"
            title={t('tip')}
            onClick={() => setShowHelp(true)}
          >
            <HelpCircle size={22} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="order-last flex w-full shrink-0 flex-row gap-3 overflow-x-auto border-t-2 border-violet-200 bg-rose-50/70 p-2 sm:p-3 lg:order-none lg:w-60 lg:flex-col lg:overflow-y-auto lg:border-r-2 lg:border-t-0 xl:w-64">
          <section className="min-w-[200px] shrink-0 rounded-3xl bg-sky-100/80 p-3 lg:min-w-0">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-800">{t('add')}</p>
            <div className="grid grid-cols-3 gap-2">
              {ADD_TOOLS.map((item) => (
                <ToolButton
                  key={item.kind}
                  label={t(item.label)}
                  active={tool.type === 'add' && tool.kind === item.kind}
                  onClick={() => toggleAdd(item.kind)}
                >
                  {item.icon}
                  {t(item.label)}
                </ToolButton>
              ))}
              <ToolButton
                label={t('polygon')}
                active={tool.type === 'polygon'}
                onClick={() => {
                  if (tool.type === 'polygon') {
                    if (tool.jointIds.length >= 3) {
                      dispatch({ type: 'builder-add-polygon', jointIds: tool.jointIds })
                    }
                    setTool({ type: 'idle' })
                    return
                  }
                  setTool({ type: 'polygon', jointIds: [] })
                }}
              >
                <Spline size={18} />
                {t('polygon')}
              </ToolButton>
            </div>
          </section>

          <section className="min-w-[240px] shrink-0 rounded-3xl bg-rose-100/80 p-3 lg:min-w-0">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-rose-800">{t('edit')}</p>
            <div className="grid grid-cols-4 gap-2">
              <ToolButton
                label={t('duplicatePart')}
                disabled={!selectedJoint?.parentId}
                active={tool.type === 'duplicate'}
                onClick={() =>
                  setTool((current) =>
                    current.type === 'duplicate' ? { type: 'idle' } : { type: 'duplicate', mirror: shift },
                  )
                }
              >
                <Copy size={18} />
              </ToolButton>
              <ToolButton
                label={t('changeKind')}
                disabled={!selectedJoint?.parentId}
                onClick={() => dispatch({ type: 'builder-toggle-kind', branch })}
              >
                <CircleDot size={18} />
              </ToolButton>
              <ToolButton
                label={`${t('circleFill')} (${selectedJoint ? t(resolvedFill(selectedJoint) === 'solid' ? 'fillSolid' : resolvedFill(selectedJoint) === 'white' ? 'fillWhite' : 'fillClear') : t('fillSolid')})`}
                disabled={!selectedJoint || !isCircleLike(selectedJoint.kind)}
                onClick={() => dispatch({ type: 'builder-cycle-fill', branch })}
              >
                <RingGlyph />
              </ToolButton>
              <ToolButton
                label={`${t('endCap')} (${selectedJoint && resolvedCap(selectedJoint) === 'square' ? t('capSquare') : t('capRound')})`}
                disabled={!selectedJoint || !isLineLike(selectedJoint.kind)}
                onClick={() => dispatch({ type: 'builder-cycle-cap', branch })}
              >
                <Square size={18} />
              </ToolButton>
              <ToolButton
                label={t('thinner')}
                disabled={!selectedJoint?.parentId}
                onClick={() => dispatch({ type: 'builder-nudge-thickness', delta: shift ? -5 : -1, branch })}
              >
                <Minus size={18} />
              </ToolButton>
              <ToolButton
                label={t('thicker')}
                disabled={!selectedJoint?.parentId}
                onClick={() => dispatch({ type: 'builder-nudge-thickness', delta: shift ? 5 : 1, branch })}
              >
                <Plus size={18} />
              </ToolButton>
              <ToolButton
                label={locked ? t('unlockPart') : t('lockPart')}
                disabled={!selectedJoint?.parentId}
                active={locked}
                onClick={() => dispatch({ type: 'builder-patch', patch: { dynamic: locked }, branch })}
              >
                {locked ? <Lock size={18} /> : <Unlock size={18} />}
              </ToolButton>
              <ToolButton
                label={t('setOrigin')}
                disabled={!selectedJoint}
                onClick={() => dispatch({ type: 'builder-set-origin' })}
              >
                <span className="h-3 w-3 rounded-full bg-amber-400" />
              </ToolButton>
              <ToolButton
                label={t('splitPart')}
                disabled={!selectedJoint?.parentId}
                onClick={() => dispatch({ type: 'builder-split' })}
              >
                <Scissors size={18} />
              </ToolButton>
              <ToolButton
                label={t('deletePart')}
                disabled={!canEdit}
                onClick={() => dispatch({ type: 'builder-delete', branch })}
              >
                <Trash2 size={18} className="text-rose-700" />
              </ToolButton>
              <ToolButton
                label={t('figureColor')}
                onClick={() => {
                  setColorTarget('paint')
                  setShowColor(true)
                }}
              >
                <span className="relative flex items-center justify-center">
                  <Palette size={18} />
                  <span
                    className="absolute -bottom-0.5 -right-1 h-2.5 w-2.5 rounded-full border border-white"
                    style={{ background: paintColor }}
                  />
                </span>
              </ToolButton>
              <ToolButton
                label={t('flipPart')}
                disabled={!selectedJoint?.parentId}
                onClick={() => dispatch({ type: 'builder-flip', vertical: shift, branch })}
              >
                <FlipHorizontal size={18} />
              </ToolButton>
              <ToolButton
                label={t('partFront')}
                disabled={!selectedJoint?.parentId}
                onClick={() =>
                  dispatch({ type: 'builder-reorder', direction: shift ? 'up' : 'front', branch })
                }
              >
                <BringToFront size={18} />
              </ToolButton>
              <ToolButton
                label={t('partBack')}
                disabled={!selectedJoint?.parentId}
                onClick={() =>
                  dispatch({ type: 'builder-reorder', direction: shift ? 'down' : 'back', branch })
                }
              >
                <SendToBack size={18} />
              </ToolButton>
              <ToolButton
                label={hidden ? t('showPart') : t('hidePart')}
                disabled={!selectedJoint?.parentId}
                active={hidden}
                onClick={() => dispatch({ type: 'builder-patch', patch: { visible: hidden }, branch })}
              >
                {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
              </ToolButton>
            </div>

            <label className="mt-3 block text-xs font-bold text-slate-600">
              {t('thickness', { n: selectedJoint?.thickness ?? 7 })}
              <input
                type="range"
                min={0}
                max={28}
                disabled={!selectedJoint?.parentId}
                value={selectedJoint?.thickness ?? 7}
                onChange={(event) =>
                  dispatch({
                    type: 'builder-patch',
                    patch: { thickness: Number(event.target.value) },
                    branch,
                  })
                }
                className="mt-1 w-full"
              />
            </label>
            <label className="mt-2 block text-xs font-bold text-slate-600">
              {t('length', { n: Math.round(selectedJoint?.length ?? 40) })}
              <input
                type="range"
                min={8}
                max={120}
                disabled={!selectedJoint?.parentId}
                value={Math.round(selectedJoint?.length ?? 40)}
                onChange={(event) =>
                  dispatch({
                    type: 'builder-patch',
                    patch: { length: Number(event.target.value) },
                    branch,
                  })
                }
                className="mt-1 w-full"
              />
            </label>
            <label className="mt-2 block text-xs font-bold text-slate-600">
              {t('angle', { n: angleDeg })}
              <input
                type="range"
                min={-180}
                max={180}
                disabled={!selectedJoint?.parentId}
                value={angleDeg}
                onChange={(event) =>
                  dispatch({
                    type: 'builder-patch',
                    patch: { angle: (Number(event.target.value) * Math.PI) / 180 },
                    branch,
                  })
                }
                className="mt-1 w-full"
              />
            </label>
          </section>

          <section className="min-w-[200px] shrink-0 rounded-3xl bg-amber-100/80 p-3 lg:min-w-0">
            <div className="grid grid-cols-4 gap-2">
              <ToolButton label={t('branchMode')} active={branch} onClick={() => setBranchOn((value) => !value)}>
                <GitBranch size={18} />
              </ToolButton>
              <ToolButton label={t('preview')} active={preview} onClick={() => setPreview((value) => !value)}>
                {preview ? <EyeOff size={18} /> : <Eye size={18} />}
              </ToolButton>
              <ToolButton
                label={t('highlightSel')}
                active={highlight}
                onClick={() => setHighlight((value) => !value)}
              >
                <Spline size={18} />
              </ToolButton>
              <ToolButton
                label={t('showStatic')}
                active={showStatic}
                onClick={() => setShowStatic((value) => !value)}
              >
                <Lock size={16} />
              </ToolButton>
            </div>
            <button
              type="button"
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white/80 text-xs font-bold text-slate-700 ring-1 ring-amber-100 touch-manipulation"
              onClick={() => {
                setColorTarget('canvas')
                setShowColor(true)
              }}
            >
              <span className="h-4 w-4 rounded-full border" style={{ background: canvasBg }} />
              {t('canvasBg')}
            </button>
            <p className="mt-2 text-xs font-semibold leading-5 text-amber-900">{t('builderTip')}</p>
          </section>
        </aside>

        <StageCanvas
          width={project.canvasWidth}
          height={project.canvasHeight}
          zoom={zoom}
          background={{ id: 'builder', name: t('canvasBg'), type: 'color', value: canvasBg }}
          figures={[builderDraft]}
          showHandles={!preview}
          builder
          lockDrag={toolActive}
          highlight={highlight}
          branchIds={branchIds}
          polygonDraft={tool.type === 'polygon' ? tool.jointIds : []}
          showStaticHandles={showStatic}
          selectedFigureId={builderDraft.id}
          selectedJointId={selection.jointId}
          selectedPolygonId={selection.polygonId ?? null}
          onFigurePointerDown={() => undefined}
          onPolygonPointerDown={(_figureId, polygonId) => {
            if (toolActive) return
            dispatch({
              type: 'select',
              selection: { figureId: builderDraft.id, jointId: selection.jointId, polygonId },
            })
          }}
          onSegmentPointerDown={(_figureId, jointId) => {
            if (toolActive) return
            dispatch({
              type: 'select',
              selection: { figureId: builderDraft.id, jointId, polygonId: null },
            })
          }}
          onJointPointerDown={(_figureId, jointId) => {
            const joint = builderDraft.joints.find((item) => item.id === jointId)
            if (tool.type === 'add') {
              setTool({ ...tool, parentId: jointId })
              dispatch({
                type: 'select',
                selection: { figureId: builderDraft.id, jointId, polygonId: null },
              })
              return
            }
            if (tool.type === 'polygon') {
              const ids = tool.jointIds
              if (ids.length >= 3 && ids[0] === jointId) {
                dispatch({ type: 'builder-add-polygon', jointIds: ids })
                setTool({ type: 'idle' })
                return
              }
              if (ids[ids.length - 1] !== jointId) setTool({ type: 'polygon', jointIds: [...ids, jointId] })
              return
            }
            if (tool.type === 'duplicate') {
              dispatch({
                type: 'builder-duplicate-onto',
                parentId: jointId,
                branch,
                mirror: tool.mirror || shift,
              })
              setTool({ type: 'idle' })
              return
            }
            drag.current = { jointId, origin: !joint?.parentId }
            didCheckpoint.current = false
            dispatch({
              type: 'select',
              selection: { figureId: builderDraft.id, jointId, polygonId: null },
            })
          }}
          onPointerEmpty={(x, y) => {
            if (tool.type === 'add' && tool.parentId) {
              dispatch({ type: 'builder-place-joint', kind: tool.kind, parentId: tool.parentId, x, y })
            }
          }}
          onPointerMove={(x, y) => {
            if (!drag.current || toolActive) return
            if (drag.current.origin) {
              dispatch({ type: 'builder-move-origin', x, y })
            } else {
              dispatch({
                type: 'builder-drag-joint',
                jointId: drag.current.jointId,
                x,
                y,
                checkpoint: !didCheckpoint.current,
              })
              didCheckpoint.current = true
            }
          }}
          onPointerUp={() => {
            drag.current = null
            didCheckpoint.current = false
          }}
        />
      </div>
      <StatusBar />
      {showColor && (
        <ColorPickerModal
          color={colorTarget === 'canvas' ? canvasBg : paintColor}
          onSelect={(color) => {
            if (colorTarget === 'canvas') setCanvasBg(color)
            else dispatch({ type: 'builder-color', color, branch })
          }}
          onClose={() => setShowColor(false)}
        />
      )}
      {showHelp && <HelpModal variant="builder" onClose={() => setShowHelp(false)} />}
    </div>
  )
}
