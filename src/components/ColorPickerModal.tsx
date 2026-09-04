import { Palette, X } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

export const COLOR_PALETTE = [
  '#111827',
  '#4b5563',
  '#9ca3af',
  '#e5e7eb',
  '#ffffff',
  '#7f1d1d',
  '#dc2626',
  '#f87171',
  '#fecaca',
  '#9a3412',
  '#ea580c',
  '#fb923c',
  '#fdba74',
  '#a16207',
  '#ca8a04',
  '#facc15',
  '#fde047',
  '#166534',
  '#16a34a',
  '#4ade80',
  '#bbf7d0',
  '#0f766e',
  '#14b8a6',
  '#5eead4',
  '#1d4ed8',
  '#2563eb',
  '#60a5fa',
  '#bfdbfe',
  '#6d28d9',
  '#7c3aed',
  '#c4b5fd',
  '#9d174d',
  '#db2777',
  '#f9a8d4',
  '#78350f',
  '#92400e',
  '#d6d3d1',
]

interface ColorPickerModalProps {
  color: string
  onSelect: (color: string) => void
  onClose: () => void
}

export function ColorPickerModal({ color, onSelect, onClose }: ColorPickerModalProps) {
  const { t } = useLang()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-paper"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-violet-600" />
            <h3 className="text-base font-extrabold text-slate-800">{t('pickColor')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-700 touch-manipulation"
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-7 gap-2">
          {COLOR_PALETTE.map((swatch) => {
            const active = swatch.toLowerCase() === color.toLowerCase()
            return (
              <button
                key={swatch}
                type="button"
                onClick={() => onSelect(swatch)}
                className={`h-9 w-9 rounded-full border-2 touch-manipulation ${
                  active ? 'border-slate-900 ring-2 ring-violet-300' : 'border-white'
                }`}
                style={{ background: swatch, boxShadow: '0 1px 4px rgba(15,23,42,0.18)' }}
                aria-label={swatch}
              />
            )
          })}
        </div>

        <label className="mt-1 flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl bg-violet-50 p-2 ring-1 ring-violet-100">
          <input
            type="color"
            value={/^#([0-9a-f]{6})$/i.test(color) ? color : '#111827'}
            onChange={(event) => onSelect(event.target.value)}
            className="h-12 w-14 cursor-pointer rounded-xl border-0 bg-transparent p-0"
          />
          <span className="text-sm font-bold text-violet-900">
            {t('customColor')}
            <span className="mt-0.5 block font-mono text-xs uppercase text-violet-700">{color}</span>
          </span>
        </label>
      </div>
    </div>
  )
}
