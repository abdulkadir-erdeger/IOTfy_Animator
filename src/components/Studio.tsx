import { useRef } from 'react'
import { Sidebar } from './Sidebar'
import { StageCanvas } from './StageCanvas'
import { Timeline } from './Timeline'
import { useAnimator } from '../state/AnimatorContext'

export function Studio() {
  const { project, frame, currentFrameIndex, selection, playing, zoom, dispatch } = useAnimator()
  const drag = useRef<{ figureId: string; jointId: string; origin: boolean } | null>(null)

  const onionFigures =
    currentFrameIndex > 0 ? project.frames[currentFrameIndex - 1]?.figures ?? [] : []

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Timeline />
        <StageCanvas
          width={project.canvasWidth}
          height={project.canvasHeight}
          zoom={zoom}
          background={project.background}
          figures={frame?.figures ?? []}
          onionFigures={playing ? [] : onionFigures}
          showHandles={!playing}
          selectedFigureId={selection.figureId}
          selectedJointId={selection.jointId}
          onPointerEmpty={() => dispatch({ type: 'select', selection: { figureId: null, jointId: null } })}
          onFigurePointerDown={(figureId) =>
            dispatch({ type: 'select', selection: { figureId, jointId: null } })
          }
          onJointPointerDown={(figureId, jointId) => {
            const figure = frame?.figures.find((item) => item.id === figureId)
            const joint = figure?.joints.find((item) => item.id === jointId)
            const isOrigin = !joint?.parentId
            const locked = joint?.dynamic === false && !isOrigin
            drag.current = locked ? null : { figureId, jointId, origin: isOrigin }
            dispatch({ type: 'select', selection: { figureId, jointId } })
          }}
          onPointerMove={(x, y) => {
            if (!drag.current) return
            if (drag.current.origin) {
              dispatch({ type: 'move-origin', figureId: drag.current.figureId, x, y })
            } else {
              dispatch({
                type: 'drag-joint',
                figureId: drag.current.figureId,
                jointId: drag.current.jointId,
                x,
                y,
                lockLength: true,
              })
            }
          }}
          onPointerUp={() => {
            drag.current = null
          }}
        />
      </div>
    </div>
  )
}
