import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLang } from '../i18n/LanguageContext'

interface ModalProps {
  title: string
  icon?: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function Modal({ title, icon, onClose, children, wide = false }: ModalProps) {
  const { t } = useLang()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-3xl bg-white p-4 shadow-paper sm:p-5 ${wide ? 'max-w-md' : 'max-w-sm'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-base font-extrabold text-slate-800">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700 touch-manipulation"
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
