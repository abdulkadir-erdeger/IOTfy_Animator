import { HelpCircle } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import { Modal } from './Modal'

export function HelpModal({
  onClose,
  variant = 'studio',
}: {
  onClose: () => void
  variant?: 'studio' | 'builder'
}) {
  const { t } = useLang()

  const items =
    variant === 'builder'
      ? [
          { color: '#38bdf8', text: t('helpBuilderAdd') },
          { color: '#f59e0b', text: t('helpBuilderHandles') },
          { color: '#8b5cf6', text: t('helpBuilderEdit') },
        ]
      : [
          { color: '#f59e0b', text: t('helpMove') },
          { color: '#ef4444', text: t('helpPose') },
          { color: '#34d399', text: t('helpReorder') },
          { color: '#8b5cf6', text: t('helpPlay') },
          { color: '#38bdf8', text: t('helpExport') },
        ]

  return (
    <Modal title={t('tip')} icon={<HelpCircle className="text-violet-600" size={20} />} onClose={onClose} wide>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.color}
            className="flex items-start gap-3 rounded-2xl bg-violet-50 px-3 py-2.5 text-sm font-semibold leading-5 text-slate-700"
          >
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: item.color }} />
            {item.text}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
