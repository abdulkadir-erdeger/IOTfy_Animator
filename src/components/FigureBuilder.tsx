import {
  BringToFront,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal,
  HelpCircle,
  Lock,
  Palette,
  Save,
  SendToBack,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import logo from '../assets/logo.svg'
import { useLang } from '../i18n/LanguageContext'
import { isJointDynamic, isJointVisible } from '../lib/segment'
import { useAnimator } from '../state/AnimatorContext'
import type { SegmentKind } from '../types'
import { ColorPickerModal } from './ColorPickerModal'
import { HelpModal } from './HelpModal'
import { LanguageSwitch } from './LanguageSwitch'
import { StageCanvas } from './StageCanvas'
import { StatusBar } from './StatusBar'

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

function RingGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <circle cx="13" cy="13" r="8" stroke="currentColor" strokeWidth="3" />
    </svg>
  )
}

function LineGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <line x1="5" y1="20" x2="21" y2="6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="5" cy="20" r="3" fill="#ef4444" />
      <circle cx="21" cy="6" r="3" fill="#ef4444" />
    </svg>
  )
}

function HexGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <polygon points="13,3 22,8.5 22,17.5 13,23 4,17.5 4,8.5" fill="currentColor" />
    </svg>
  )
}

function DoubleGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <line x1="5" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="5" y1="17" x2="21" y2="17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function CircleGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <circle cx="13" cy="13" r="8" fill="currentColor" />
    </svg>
  )
}

const ADD_TOOLS: { kind: SegmentKind; label: 'ring' | 'line' | 'hex' | 'doubleLine' | 'ball'; icon: ReactNode }[] = [
  { kind: 'ring', label: 'ring', icon: <RingGlyph /> },
  { kind: 'line', label: 'line', icon: <LineGlyph /> },
  { kind: 'hex', label: 'hex', icon: <HexGlyph /> },
  { kind: 'double', label: 'doubleLine', icon: <DoubleGlyph /> },
  { kind: 'circle', label: 'ball', icon: <CircleGlyph /> },
]

export function FigureBuilder() {
  const { builderDraft, selection, zoom, project, dispatch } = useAnimator()
  const { t } = useLang()
  const drag = useRef<{ jointId: string; origin: boolean } | null>(null)
  const [showColor, setShowColor] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  if (!builderDraft) return null

  const selectedJoint = builderDraft.joints.find((joint) => joint.id === selection.jointId)
  const canEdit = Boolean(selectedJoint?.parentId)
  const hidden = selectedJoint ? !isJointVisible(selectedJoint) : false
  const locked = selectedJoint ? !isJointDynamic(selectedJoint) : false
  const angleDeg = Math.round(((selectedJoint?.angle ?? 0) * 180) / Math.PI)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b-2 border-violet-300/70 bg-violet-200 px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
        <img src={logo} alt="IOTfy Animator" className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-violet-950 sm:text-lg">{t('builderTitle')}</h2>
          <p className="text-xs font-semibold text-violet-800/80">
            {t('objectsCount', { n: builderDraft.joints.length })}
            <span className="hidden sm:inline"> · {t('builderSubhint')}</span>
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
            onClick={() => dispatch({ type: 'close-builder' })}
          >
            <Undo2 size={16} />
            <span className="hidden sm:inline">{t('cancel')}</span>
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
        <aside className="order-last flex w-full shrink-0 flex-row gap-3 overflow-x-auto border-t-2 border-violet-200 bg-rose-50/70 p-2 sm:p-3 lg:order-none lg:w-56 lg:flex-col lg:overflow-y-auto lg:border-r-2 lg:border-t-0 xl:w-60">
          <section className="min-w-[188px] shrink-0 rounded-3xl bg-sky-100/80 p-3 lg:min-w-0">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-800">{t('add')}</p>
            <div className="grid grid-cols-2 gap-2">
              {ADD_TOOLS.map((tool) => (
                <ToolButton
                  key={tool.kind}
                  label={t(tool.label)}
                  onClick={() => dispatch({ type: 'builder-add-joint', kind: tool.kind })}
                >
                  {tool.icon}
                  {t(tool.label)}
                </ToolButton>
              ))}
            </div>
          </section>

          <section className="min-w-[220px] shrink-0 rounded-3xl bg-rose-100/80 p-3 lg:min-w-0">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-rose-800">{t('edit')}</p>
            <div className="grid grid-cols-4 gap-2">
              <ToolButton
                label={t('deletePart')}
                disabled={!canEdit}
                onClick={() => dispatch({ type: 'builder-delete-joint' })}
              >
                <Trash2 size={18} className="text-rose-700" />
              </ToolButton>
              <ToolButton
                label={t('duplicatePart')}
                disabled={!canEdit}
                onClick={() => dispatch({ type: 'builder-duplicate-joint' })}
              >
                <Copy size={18} />
              </ToolButton>
              <ToolButton
                label={t('flipPart')}
                disabled={!canEdit}
                onClick={() => dispatch({ type: 'builder-flip-joint' })}
              >
                <FlipHorizontal size={18} />
              </ToolButton>
              <ToolButton
                label={hidden ? t('showPart') : t('hidePart')}
                disabled={!canEdit}
                active={hidden}
                onClick={() => dispatch({ type: 'builder-patch-joint', patch: { visible: hidden } })}
              >
                {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
              </ToolButton>
              <ToolButton
                label={locked ? t('unlockPart') : t('lockPart')}
                disabled={!canEdit}
                active={locked}
                onClick={() => dispatch({ type: 'builder-patch-joint', patch: { dynamic: locked } })}
              >
                {locked ? <Lock size={18} /> : <Unlock size={18} />}
              </ToolButton>
              <ToolButton
                label={t('partFront')}
                disabled={!canEdit}
                onClick={() => dispatch({ type: 'builder-reorder-joint', direction: 'front' })}
              >
                <BringToFront size={18} />
              </ToolButton>
              <ToolButton
                label={t('partBack')}
                disabled={!canEdit}
                onClick={() => dispatch({ type: 'builder-reorder-joint', direction: 'back' })}
              >
                <SendToBack size={18} />
              </ToolButton>
              <ToolButton label={t('figureColor')} onClick={() => setShowColor(true)}>
                <span className="relative flex items-center justify-center">
                  <Palette size={18} />
                  <span
                    className="absolute -bottom-0.5 -right-1 h-2.5 w-2.5 rounded-full border border-white"
                    style={{ background: builderDraft.color }}
                  />
                </span>
              </ToolButton>
            </div>

            <label className="mt-3 block text-xs font-bold text-slate-600">
              {t('thickness', { n: selectedJoint?.thickness ?? 7 })}
              <input
                type="range"
                min={3}
                max={28}
                disabled={!canEdit}
                value={selectedJoint?.thickness ?? 7}
                onChange={(event) =>
                  dispatch({ type: 'builder-patch-joint', patch: { thickness: Number(event.target.value) } })
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
                disabled={!canEdit}
                value={Math.round(selectedJoint?.length ?? 40)}
                onChange={(event) =>
                  dispatch({ type: 'builder-patch-joint', patch: { length: Number(event.target.value) } })
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
                disabled={!canEdit}
                value={angleDeg}
                onChange={(event) =>
                  dispatch({
                    type: 'builder-patch-joint',
                    patch: { angle: (Number(event.target.value) * Math.PI) / 180 },
                  })
                }
                className="mt-1 w-full"
              />
            </label>
          </section>

          <p className="min-w-[180px] shrink-0 rounded-2xl bg-amber-100/80 p-3 text-xs font-semibold leading-5 text-amber-900 lg:min-w-0">
            {t('builderTip')}
          </p>
        </aside>

        <StageCanvas
          width={project.canvasWidth}
          height={project.canvasHeight}
          zoom={zoom}
          background={{ id: 'white', name: t('bgWhite'), type: 'color', value: '#ffffff' }}
          figures={[builderDraft]}
          showHandles
          builder
          selectedFigureId={builderDraft.id}
          selectedJointId={selection.jointId}
          onFigurePointerDown={() => undefined}
          onJointPointerDown={(_figureId, jointId) => {
            const joint = builderDraft.joints.find((item) => item.id === jointId)
            drag.current = { jointId, origin: !joint?.parentId }
            dispatch({ type: 'select', selection: { figureId: builderDraft.id, jointId } })
          }}
          onPointerMove={(x, y) => {
            if (!drag.current) return
            if (drag.current.origin) {
              dispatch({ type: 'builder-move-origin', x, y })
            } else {
              dispatch({ type: 'builder-drag-joint', jointId: drag.current.jointId, x, y })
            }
          }}
          onPointerUp={() => {
            drag.current = null
          }}
        />
      </div>
      <StatusBar />
      {showColor && (
        <ColorPickerModal
          color={builderDraft.color}
          onSelect={(color) => dispatch({ type: 'builder-color', color })}
          onClose={() => setShowColor(false)}
        />
      )}
      {showHelp && <HelpModal variant="builder" onClose={() => setShowHelp(false)} />}
    </div>
  )
}
