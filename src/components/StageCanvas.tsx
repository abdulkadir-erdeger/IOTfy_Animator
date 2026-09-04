import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Background, FigurePose } from '../types'
import { clientToSvgPoint } from '../lib/pointer'
import { FigureLayer } from './FigureLayer'

interface StageCanvasProps {
  width: number
  height: number
  zoom: number
  background: Background
  figures: FigurePose[]
  onionFigures?: FigurePose[]
  showHandles: boolean
  selectedFigureId: string | null
  selectedJointId: string | null
  builder?: boolean
  onPointerEmpty?: () => void
  onFigurePointerDown?: (figureId: string) => void
  onJointPointerDown?: (figureId: string, jointId: string, event: PointerEvent) => void
  onPointerMove?: (x: number, y: number) => void
  onPointerUp?: () => void
}

function backgroundStyle(background: Background): CSSProperties {
  if (background.type === 'color') return { background: background.value }
  if (background.type === 'gradient') return { backgroundImage: background.value }
  return {
    backgroundImage: `url("${background.value}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
}

export function StageCanvas({
  width,
  height,
  zoom,
  background,
  figures,
  onionFigures = [],
  showHandles,
  selectedFigureId,
  selectedJointId,
  builder = false,
  onPointerEmpty,
  onFigurePointerDown,
  onJointPointerDown,
  onPointerMove,
  onPointerUp,
}: StageCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const [fit, setFit] = useState(1)

  const moveRef = useRef(onPointerMove)
  const upRef = useRef(onPointerUp)
  moveRef.current = onPointerMove
  upRef.current = onPointerUp

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => {
      const sx = Math.max(0, el.clientWidth - 24) / width
      const sy = Math.max(0, el.clientHeight - 24) / height
      setFit(Math.min(sx, sy, 1.35) || 1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [width, height])

  useEffect(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      if (!dragging.current) return
      event.preventDefault()
      const point = clientToSvgPoint(svgRef.current, event, width, height)
      moveRef.current?.(point.x, point.y)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      upRef.current?.()
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!dragging.current) return
      event.preventDefault()
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [width, height])

  const beginDrag = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragging.current = true
    try {
      svgRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // iOS Safari SVG capture can fail; window listeners still handle the drag.
    }
  }

  const sorted = [...figures].sort((a, b) => a.zOrder - b.zOrder)
  const scale = fit * (zoom / 100)

  return (
    <div ref={wrapRef} className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
      <div
        className="relative shrink-0 rounded-3xl shadow-paper"
        style={{
          width: width * scale,
          height: height * scale,
        }}
      >
        <div
          className="absolute inset-0 overflow-hidden rounded-3xl"
          style={backgroundStyle(background)}
        />
        {background.id === 'white' && (
          <div className="checker pointer-events-none absolute inset-0 rounded-3xl opacity-40" />
        )}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 h-full w-full touch-none rounded-3xl"
        >
          <rect
            width={width}
            height={height}
            fill="transparent"
            onPointerDown={(event) => {
              if (dragging.current) return
              event.preventDefault()
              onPointerEmpty?.()
            }}
          />
          <rect
            x="18"
            y="14"
            width={width - 36}
            height={height - 28}
            fill="none"
            stroke="rgba(15,23,42,0.18)"
            strokeDasharray="8 8"
            rx="12"
            pointerEvents="none"
          />
          {onionFigures.map((figure) => (
            <FigureLayer key={`onion-${figure.id}`} figure={figure} onion />
          ))}
          {sorted.map((figure) => (
            <FigureLayer
              key={figure.id}
              figure={figure}
              builder={builder}
              showHandles={showHandles}
              selected={figure.id === selectedFigureId}
              selectedJointId={figure.id === selectedFigureId ? selectedJointId : null}
              onFigurePointerDown={onFigurePointerDown}
              onJointPointerDown={(figureId, jointId, event) => {
                beginDrag(event)
                onJointPointerDown?.(figureId, jointId, event)
              }}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}
