import { Copy, GripHorizontal, Plus, Trash2 } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { FigureLayer } from './FigureLayer'
import { IconButton } from './IconButton'
import { useAnimator } from '../state/AnimatorContext'

export function Timeline() {
  const { project, currentFrameIndex, inbetweens, dispatch } = useAnimator()
  const { t } = useLang()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const drag = useRef<{ pointerId: number; lastTo: number } | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  const indexFromX = (clientX: number) => {
    const hits = itemRefs.current
    for (let i = 0; i < hits.length; i += 1) {
      const el = hits[i]
      if (!el) continue
      const box = el.getBoundingClientRect()
      if (clientX >= box.left && clientX <= box.right) return i
    }
    const first = hits[0]?.getBoundingClientRect()
    const last = hits[hits.length - 1]?.getBoundingClientRect()
    if (first && clientX < first.left) return 0
    if (last && clientX > last.right) return hits.length - 1
    return null
  }

  const autoScroll = (clientX: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const box = scroller.getBoundingClientRect()
    const edge = 48
    if (clientX < box.left + edge) scroller.scrollLeft -= 18
    if (clientX > box.right - edge) scroller.scrollLeft += 18
  }

  const startReorder = (index: number, event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, lastTo: index }
    setDraggingIndex(index)
    dispatch({ type: 'set-frame', index })
  }

  const onReorderMove = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return
    event.preventDefault()
    autoScroll(event.clientX)
    const over = indexFromX(event.clientX)
    if (over === null || over === drag.current.lastTo) return
    dispatch({ type: 'move-frame', from: drag.current.lastTo, to: over })
    drag.current.lastTo = over
    setDraggingIndex(over)
  }

  const endReorder = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return
    drag.current = null
    setDraggingIndex(null)
  }

  return (
    <section className="shrink-0 border-b-2 border-emerald-200/80 bg-emerald-50/80 px-2 py-2 backdrop-blur sm:px-4 sm:py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
        <IconButton
          label={t('deleteFrame')}
          tone="berry"
          size="sm"
          onClick={() => dispatch({ type: 'delete-frame' })}
          disabled={project.frames.length <= 1}
        >
          <Trash2 size={16} />
        </IconButton>
        <IconButton
          label={t('copyFrame')}
          tone="sky"
          size="sm"
          onClick={() => dispatch({ type: 'duplicate-frame' })}
        >
          <Copy size={16} />
        </IconButton>
        <p className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 sm:text-sm">
          {t('frameOf', { current: currentFrameIndex + 1, total: project.frames.length })}
        </p>
        <p className="hidden text-xs font-semibold text-emerald-800/80 md:block">{t('reorderHint')}</p>
        <div className="ml-auto flex items-center gap-1.5 rounded-2xl bg-white/70 px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
          <span className="text-xs font-bold text-emerald-800 sm:text-sm">{t('inbetweens')}</span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-emerald-800 shadow-sm touch-manipulation sm:h-7 sm:w-7"
            onClick={() => dispatch({ type: 'set-inbetweens', value: inbetweens - 1 })}
          >
            −
          </button>
          <span className="w-5 text-center text-sm font-black sm:w-6">{inbetweens}</span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-emerald-800 shadow-sm touch-manipulation sm:h-7 sm:w-7"
            onClick={() => dispatch({ type: 'set-inbetweens', value: inbetweens + 1 })}
          >
            +
          </button>
          <button
            type="button"
            className="min-h-10 rounded-full bg-emerald-300 px-3 py-1 text-xs font-bold text-emerald-950 touch-manipulation disabled:opacity-40 sm:min-h-0"
            disabled={inbetweens <= 0 || currentFrameIndex >= project.frames.length - 1}
            onClick={() => dispatch({ type: 'fill-inbetweens' })}
          >
            {t('fill')}
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        {project.frames.map((frame, index) => {
          const active = index === currentFrameIndex
          const dragging = draggingIndex === index
          return (
            <div key={frame.id} className="flex items-center gap-2">
              <div
                ref={(node) => {
                  itemRefs.current[index] = node
                }}
                className={`relative h-16 w-[104px] shrink-0 overflow-hidden rounded-2xl border-4 bg-white transition sm:h-[76px] sm:w-[128px] ${
                  active ? 'border-violet-300 shadow-md' : 'border-emerald-100'
                } ${dragging ? 'scale-95 opacity-80' : ''}`}
              >
                <button
                  type="button"
                  aria-label={t('dragFrame', { n: index + 1 })}
                  className="absolute inset-x-0 top-0 z-10 flex h-6 items-center justify-center bg-violet-400/70 text-white touch-none sm:h-7"
                  onPointerDown={(event) => startReorder(index, event)}
                  onPointerMove={onReorderMove}
                  onPointerUp={endReorder}
                  onPointerCancel={endReorder}
                >
                  <GripHorizontal size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'set-frame', index })}
                  className="absolute inset-0 touch-manipulation"
                >
                  <svg viewBox={`0 0 ${project.canvasWidth} ${project.canvasHeight}`} className="h-full w-full">
                    <rect width={project.canvasWidth} height={project.canvasHeight} fill="#fff" />
                    {frame.figures.map((figure) => (
                      <FigureLayer key={figure.id} figure={figure} />
                    ))}
                  </svg>
                  <span className="absolute bottom-1 right-1 rounded-full bg-slate-900/70 px-1.5 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                </button>
              </div>
              {index < project.frames.length - 1 && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 sm:h-2.5 sm:w-2.5" />
              )}
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => dispatch({ type: 'add-frame' })}
          className="flex h-16 w-14 shrink-0 items-center justify-center rounded-2xl border-4 border-dashed border-violet-300 bg-violet-50 text-violet-400 touch-manipulation hover:bg-violet-100 sm:h-[76px] sm:w-[72px]"
          title={t('addFrame')}
        >
          <Plus size={28} />
        </button>
      </div>
    </section>
  )
}
