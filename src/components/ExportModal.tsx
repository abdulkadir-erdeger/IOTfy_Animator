import { Download, Film, Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { exportGif, exportVideo } from '../lib/exportMedia'
import type { Project } from '../types'
import { Modal } from './Modal'

export function ExportModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useLang()
  const [busy, setBusy] = useState<'gif' | 'video' | null>(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const run = async (kind: 'gif' | 'video') => {
    setBusy(kind)
    setError('')
    setProgress(t('exporting', { current: 1, total: project.frames.length }))
    try {
      const onProgress = (current: number, total: number) => {
        setProgress(t('exporting', { current, total }))
      }
      if (kind === 'gif') await exportGif(project, t('gifFile'), onProgress)
      else await exportVideo(project, t('videoFile'), onProgress)
      onClose()
    } catch {
      setError(t('exportError'))
    } finally {
      setBusy(null)
      setProgress('')
    }
  }

  return (
    <Modal title={t('export')} icon={<Download className="text-violet-600" size={20} />} onClose={onClose}>
      <p className="mb-3 text-sm font-semibold text-slate-600">{t('exportHint')}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void run('gif')}
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-100 px-3 py-4 text-sm font-extrabold text-emerald-900 touch-manipulation hover:bg-emerald-50 disabled:opacity-50"
        >
          <ImageIcon size={28} />
          GIF
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void run('video')}
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-sky-100 px-3 py-4 text-sm font-extrabold text-sky-900 touch-manipulation hover:bg-sky-50 disabled:opacity-50"
        >
          <Film size={28} />
          {t('video')}
        </button>
      </div>
      {progress && <p className="mt-3 text-center text-xs font-bold text-violet-700">{progress}</p>}
      {error && <p className="mt-3 text-center text-xs font-bold text-rose-600">{error}</p>}
    </Modal>
  )
}
