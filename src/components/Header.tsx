import { Download, FilePlus, FolderOpen, HelpCircle, PencilRuler, Save } from 'lucide-react'
import { useRef, useState } from 'react'
import logo from '../assets/logo.svg'
import { useLang } from '../i18n/LanguageContext'
import { downloadProject } from '../lib/project'
import { useAnimator } from '../state/AnimatorContext'
import type { Project } from '../types'
import { ExportModal } from './ExportModal'
import { HelpModal } from './HelpModal'
import { LanguageSwitch } from './LanguageSwitch'

const headerBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-2.5 py-2 text-sm font-bold shadow-sm touch-manipulation sm:px-3'

export function Header() {
  const { project, dispatch } = useAnimator()
  const { t } = useLang()
  const fileRef = useRef<HTMLInputElement>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const openFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Project
        if (!parsed.frames?.length) return
        dispatch({ type: 'load-project', project: parsed })
      } catch {
        window.alert(t('openError'))
      }
    }
    reader.readAsText(file)
  }

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b-2 border-violet-300/70 bg-violet-200 px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <img src={logo} alt="IOTfy Animator" className="h-9 w-9 shrink-0 sm:h-12 sm:w-12" />
        <div className="min-w-0">
          <h1 className="truncate text-base font-extrabold tracking-tight text-violet-950 sm:text-xl">
            IOTfy Animator
          </h1>
          <p className="hidden truncate text-xs font-semibold text-violet-800/80 sm:block">{t('tagline')}</p>
        </div>
      </div>

      <nav className="ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        <button
          type="button"
          className={`${headerBtn} bg-white/70 text-violet-900 ring-1 ring-white/80 hover:bg-white`}
          onClick={() => {
            if (window.confirm(t('newConfirm'))) dispatch({ type: 'new-project' })
          }}
        >
          <FilePlus size={16} />
          <span className="hidden sm:inline">{t('new')}</span>
        </button>
        <button
          type="button"
          className={`${headerBtn} bg-white/70 text-violet-900 ring-1 ring-white/80 hover:bg-white`}
          onClick={() => fileRef.current?.click()}
        >
          <FolderOpen size={16} />
          <span className="hidden sm:inline">{t('open')}</span>
        </button>
        <button
          type="button"
          className={`${headerBtn} bg-amber-200 text-amber-950 hover:bg-amber-100`}
          onClick={() => downloadProject(project, t('fileName'))}
        >
          <Save size={16} />
          <span className="hidden sm:inline">{t('save')}</span>
        </button>
        <button
          type="button"
          className={`${headerBtn} bg-violet-300 text-violet-950 hover:bg-violet-200`}
          onClick={() => dispatch({ type: 'open-builder', mode: 'new' })}
        >
          <PencilRuler size={16} />
          <span className="hidden sm:inline">{t('makeFigure')}</span>
        </button>
        <button
          type="button"
          className={`${headerBtn} bg-sky-200 text-sky-950 hover:bg-sky-100`}
          onClick={() => setShowExport(true)}
        >
          <Download size={16} />
          <span className="hidden sm:inline">{t('export')}</span>
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
      </nav>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) openFile(file)
          event.target.value = ''
        }}
      />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showExport && <ExportModal project={project} onClose={() => setShowExport(false)} />}
    </header>
  )
}
