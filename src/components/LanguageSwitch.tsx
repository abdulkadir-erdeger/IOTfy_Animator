import { useLang } from '../i18n/LanguageContext'

function TurkeyFlag() {
  return (
    <svg viewBox="0 0 36 24" className="h-5 w-8 rounded-[4px] shadow-sm sm:h-6 sm:w-9" aria-hidden>
      <rect width="36" height="24" rx="3" fill="#E30A17" />
      <circle cx="13" cy="12" r="6" fill="#fff" />
      <circle cx="15.2" cy="12" r="4.7" fill="#E30A17" />
      <path
        fill="#fff"
        d="M21.6 12 19.2 12.8 20.5 10.7 19.1 9.2 21.4 9.5 22.2 7.4 23 9.5 25.3 9.2 23.9 10.7 25.2 12.8 22.8 12 22.2 14.2z"
      />
    </svg>
  )
}

function UkFlag() {
  return (
    <svg viewBox="0 0 36 24" className="h-5 w-8 rounded-[4px] shadow-sm sm:h-6 sm:w-9" aria-hidden>
      <rect width="36" height="24" rx="3" fill="#012169" />
      <path d="M0 0 36 24M36 0 0 24" stroke="#fff" strokeWidth="5" />
      <path d="M0 0 36 24M36 0 0 24" stroke="#C8102E" strokeWidth="2.4" />
      <path d="M18 0v24M0 12h36" stroke="#fff" strokeWidth="8" />
      <path d="M18 0v24M0 12h36" stroke="#C8102E" strokeWidth="4.5" />
    </svg>
  )
}

export function LanguageSwitch() {
  const { lang, setLang, t } = useLang()

  return (
    <div
      className="flex shrink-0 items-center rounded-full bg-white/60 p-1 ring-1 ring-white/80"
      role="group"
      aria-label={t('language')}
    >
      <button
        type="button"
        onClick={() => setLang('tr')}
        title={t('langTr')}
        aria-label={t('langTr')}
        aria-pressed={lang === 'tr'}
        className={`flex min-h-10 items-center justify-center rounded-full px-1.5 touch-manipulation sm:min-h-9 ${
          lang === 'tr' ? 'bg-white shadow-sm ring-2 ring-violet-400' : 'opacity-70 hover:opacity-100'
        }`}
      >
        <TurkeyFlag />
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        title={t('langEn')}
        aria-label={t('langEn')}
        aria-pressed={lang === 'en'}
        className={`flex min-h-10 items-center justify-center rounded-full px-1.5 touch-manipulation sm:min-h-9 ${
          lang === 'en' ? 'bg-white shadow-sm ring-2 ring-violet-400' : 'opacity-70 hover:opacity-100'
        }`}
      >
        <UkFlag />
      </button>
    </div>
  )
}
