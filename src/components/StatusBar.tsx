import { backgroundDisplayName, figureDisplayName, segmentKindName, useLang } from '../i18n/LanguageContext'
import { isJointDynamic, isJointVisible } from '../lib/segment'
import { computeWorldJoints } from '../lib/skeleton'
import { useAnimator } from '../state/AnimatorContext'

export function StatusBar() {
  const { project, selected, selection, zoom, dispatch, view, builderDraft } = useAnimator()
  const { t } = useLang()
  const figure = view === 'builder' ? builderDraft : selected
  const joint = figure?.joints.find((item) => item.id === selection.jointId)
  const world = figure ? computeWorldJoints(figure).find((item) => item.id === selection.jointId) : null
  const figureName = figure ? figureDisplayName(figure.templateId, figure.name, t) : ''
  const zOrder = figure && joint ? figure.joints.findIndex((item) => item.id === joint.id) + 1 : 0

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-rose-200/80 bg-rose-50/90 px-3 py-1.5 text-xs font-semibold text-rose-900/80 sm:gap-x-4 sm:px-4 sm:py-2">
      {view === 'builder' && figure ? (
        <span>{t('objectsCount', { n: figure.joints.length })}</span>
      ) : (
        <span className="hidden sm:inline">
          {t('bgLabel', { name: backgroundDisplayName(project.background.id, project.background.name, t) })}
        </span>
      )}
      {figure && view !== 'builder' && (
        <span className="truncate">
          {t('figureLabel', { name: figureName, x: Math.round(figure.x), y: Math.round(figure.y) })}
        </span>
      )}
      {joint && world && joint.parentId && (
        <span className="hidden md:inline">
          {t('builderStatus', {
            kind: segmentKindName(joint.kind, t),
            thickness: joint.thickness,
            length: joint.length.toFixed(1),
            angle: ((joint.angle * 180) / Math.PI).toFixed(1),
            motion: isJointDynamic(joint) ? t('motionDynamic') : t('motionStatic'),
            z: zOrder,
          })}
          {!isJointVisible(joint) ? ` · ${t('hidePart')}` : ''}
        </span>
      )}
      <label className="ml-auto flex min-h-10 items-center gap-2 sm:min-h-11">
        {t('zoom', { n: zoom })}
        <input
          type="range"
          min={60}
          max={160}
          value={zoom}
          className="h-10 w-24 sm:h-auto sm:w-28"
          onChange={(event) => dispatch({ type: 'set-zoom', value: Number(event.target.value) })}
        />
      </label>
    </footer>
  )
}
