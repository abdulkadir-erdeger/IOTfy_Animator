import { useEffect } from 'react'
import { FigureBuilder } from './components/FigureBuilder'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { Studio } from './components/Studio'
import { useLang } from './i18n/LanguageContext'
import { useAnimator } from './state/AnimatorContext'

export default function App() {
  const { view, playing, currentFrameIndex, project, dispatch } = useAnimator()
  const { t } = useLang()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (view === 'builder') return
      if (event.code === 'Space') {
        event.preventDefault()
        dispatch({ type: 'set-playing', value: !playing })
      }
      if (event.code === 'ArrowLeft') {
        dispatch({ type: 'set-frame', index: currentFrameIndex - 1 })
      }
      if (event.code === 'ArrowRight') {
        dispatch({ type: 'set-frame', index: currentFrameIndex + 1 })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, currentFrameIndex, dispatch, view])

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 select-none flex-col overflow-hidden bg-gradient-to-br from-sky-100 via-violet-50 to-rose-100">
      {view === 'studio' ? (
        <>
          <Header />
          <Studio />
          <StatusBar />
        </>
      ) : (
        <FigureBuilder />
      )}
      <p className="sr-only">{t('srFrames', { n: project.frames.length, fps: project.fps })}</p>
    </div>
  )
}
