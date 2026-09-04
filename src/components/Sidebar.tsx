import {
  FlipHorizontal,
  FlipVertical,
  ImagePlus,
  Palette,
  Pause,
  Pencil,
  Play,
  Scan,
  Trash2,
  UserRoundPlus,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { figureDisplayName, backgroundDisplayName, useLang } from '../i18n/LanguageContext'
import { BACKGROUNDS } from '../lib/project'
import { useAnimator, usePlayback } from '../state/AnimatorContext'
import { ColorPickerModal } from './ColorPickerModal'
import { IconButton } from './IconButton'
import { FigureLayer } from './FigureLayer'

export function Sidebar() {
  const { project, selected, dispatch } = useAnimator()
  const { toggle } = usePlayback()
  const playing = useAnimator().playing
  const { t } = useLang()
  const [showFigures, setShowFigures] = useState(false)
  const [showBg, setShowBg] = useState(false)
  const [showColor, setShowColor] = useState(false)
  const imageRef = useRef<HTMLInputElement>(null)

  const popover =
    'absolute bottom-full left-0 right-0 z-30 mb-2 max-h-56 space-y-2 overflow-y-auto rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-violet-100 lg:bottom-auto lg:top-full lg:mb-0 lg:mt-2'

  return (
    <aside className="order-last flex w-full shrink-0 flex-row gap-3 overflow-x-auto border-t-2 border-violet-200/80 bg-rose-50/70 p-2 sm:p-3 lg:order-none lg:h-full lg:w-56 lg:flex-col lg:overflow-y-auto lg:border-r-2 lg:border-t-0 xl:w-60">
      <section className="min-w-[188px] shrink-0 rounded-3xl bg-sky-100/80 p-3 lg:min-w-0">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-sky-800">{t('play')}</p>
        <div className="flex items-center gap-2">
          <IconButton label={playing ? t('stop') : t('play')} tone="mint" onClick={toggle}>
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          </IconButton>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={project.loop}
              onChange={(event) => dispatch({ type: 'set-loop', value: event.target.checked })}
              className="h-5 w-5 accent-sky-400"
            />
            {t('loop')}
          </label>
        </div>
        <label className="mt-3 block text-xs font-bold text-slate-600">
          {t('speed', { fps: project.fps })}
          <input
            type="range"
            min={2}
            max={16}
            value={project.fps}
            onChange={(event) => dispatch({ type: 'set-fps', value: Number(event.target.value) })}
            className="mt-1 w-full"
          />
        </label>
      </section>

      <section className="relative min-w-[188px] shrink-0 rounded-3xl bg-amber-100/70 p-3 lg:min-w-0">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-amber-800">{t('stage')}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/80 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-amber-100 touch-manipulation hover:bg-white"
            onClick={() => {
              setShowBg((value) => !value)
              setShowFigures(false)
            }}
          >
            <ImagePlus size={18} />
            {t('background')}
          </button>
          <button
            type="button"
            className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/80 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-amber-100 touch-manipulation hover:bg-white"
            onClick={() => {
              setShowFigures((value) => !value)
              setShowBg(false)
            }}
          >
            <UserRoundPlus size={18} />
            {t('addFigure')}
          </button>
        </div>

        {showBg && (
          <div className={popover}>
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-bold hover:bg-amber-50"
                onClick={() => {
                  dispatch({ type: 'set-background', background: bg })
                  setShowBg(false)
                }}
              >
                <span
                  className="h-6 w-6 rounded-md border border-slate-200"
                  style={bg.type === 'color' ? { background: bg.value } : { backgroundImage: bg.value }}
                />
                {backgroundDisplayName(bg.id, bg.name, t)}
              </button>
            ))}
            <button
              type="button"
              className="w-full rounded-xl bg-violet-50 px-2 py-2 text-xs font-bold"
              onClick={() => imageRef.current?.click()}
            >
              {t('uploadImage')}
            </button>
          </div>
        )}

        {showFigures && (
          <div className={popover}>
            {project.templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-bold hover:bg-sky-50"
                onClick={() => {
                  dispatch({ type: 'add-figure', templateId: template.id })
                  setShowFigures(false)
                }}
              >
                <span className="h-10 w-10 overflow-hidden rounded-lg bg-slate-50">
                  <svg viewBox="0 0 80 80" className="h-full w-full">
                    <FigureLayer
                      figure={{
                        id: template.id,
                        templateId: template.id,
                        name: template.name,
                        x: 40,
                        y: 48,
                        scale: 0.45,
                        rotation: 0,
                        flipX: false,
                        flipY: false,
                        color: '#111827',
                        zOrder: 1,
                        joints: template.joints,
                      }}
                    />
                  </svg>
                </span>
                {figureDisplayName(template.id, template.name, t)}
              </button>
            ))}
          </div>
        )}
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              dispatch({
                type: 'set-background',
                background: {
                  id: 'image',
                  name: file.name,
                  type: 'image',
                  value: String(reader.result),
                },
              })
              setShowBg(false)
            }
            reader.readAsDataURL(file)
            event.target.value = ''
          }}
        />
      </section>

      <section className="min-w-[200px] shrink-0 rounded-3xl bg-rose-100/80 p-3 lg:min-w-0">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-rose-800">{t('figure')}</p>
        <div className="grid grid-cols-4 gap-1.5">
          <IconButton label={t('deleteFigure')} tone="berry" size="sm" disabled={!selected} onClick={() => dispatch({ type: 'delete-figure' })}>
            <Trash2 size={14} />
          </IconButton>
          <IconButton
            label={t('editFigure')}
            tone="grape"
            size="sm"
            disabled={!selected}
            onClick={() => dispatch({ type: 'open-builder', mode: 'edit' })}
          >
            <Pencil size={14} />
          </IconButton>
          <IconButton label={t('center')} tone="sky" size="sm" disabled={!selected} onClick={() => dispatch({ type: 'center-figure' })}>
            <Scan size={14} />
          </IconButton>
          <IconButton label={t('flipH')} tone="sun" size="sm" disabled={!selected} onClick={() => dispatch({ type: 'flip-figure', axis: 'x' })}>
            <FlipHorizontal size={14} />
          </IconButton>
          <IconButton label={t('flipV')} tone="sun" size="sm" disabled={!selected} onClick={() => dispatch({ type: 'flip-figure', axis: 'y' })}>
            <FlipVertical size={14} />
          </IconButton>
          <IconButton label={t('front')} tone="white" size="sm" disabled={!selected} onClick={() => dispatch({ type: 'reorder-figure', direction: 'front' })}>
            <span className="text-[10px] font-black">{t('front')}</span>
          </IconButton>
          <IconButton label={t('back')} tone="white" size="sm" disabled={!selected} onClick={() => dispatch({ type: 'reorder-figure', direction: 'back' })}>
            <span className="text-[10px] font-black">{t('back')}</span>
          </IconButton>
          <IconButton
            label={t('pickColor')}
            tone="white"
            size="sm"
            disabled={!selected}
            onClick={() => setShowColor(true)}
          >
            <span className="relative inline-flex">
              <Palette size={14} />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white"
                style={{ background: selected?.color ?? '#111827' }}
              />
            </span>
          </IconButton>
        </div>

        <label className="mt-3 block text-xs font-bold text-slate-600">
          {t('size', { n: selected ? Math.round(selected.scale * 100) : 100 })}
          <input
            type="range"
            min={40}
            max={220}
            disabled={!selected}
            value={selected ? Math.round(selected.scale * 100) : 100}
            onChange={(event) =>
              selected &&
              dispatch({
                type: 'update-figure',
                figureId: selected.id,
                patch: { scale: Number(event.target.value) / 100 },
              })
            }
            className="mt-1 w-full"
          />
        </label>
      </section>

      <button
        type="button"
        onClick={() => dispatch({ type: 'add-frame' })}
        className="mt-0 min-h-14 min-w-[132px] shrink-0 rounded-3xl bg-violet-300 px-3 py-4 text-center text-sm font-extrabold text-violet-950 shadow-pop transition touch-manipulation hover:bg-violet-200 active:translate-y-1 active:shadow-none sm:text-base lg:mt-auto"
      >
        {t('addFrame')}
      </button>
      {showColor && selected && (
        <ColorPickerModal
          color={selected.color}
          onSelect={(color) =>
            dispatch({ type: 'update-figure', figureId: selected.id, patch: { color } })
          }
          onClose={() => setShowColor(false)}
        />
      )}
    </aside>
  )
}
