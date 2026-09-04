import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translations, type Lang, type TranslationKey } from './translations'

type Vars = Record<string, string | number>

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey, vars?: Vars) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)
const STORAGE_KEY = 'iotfy-animator-lang'

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''))
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'en' || saved === 'tr') return saved
    } catch {
      // ignore
    }
    return 'tr'
  })

  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => interpolate(translations[lang][key], vars),
    }),
    [lang],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('LanguageProvider gerekli')
  return ctx
}

const KNOWN_DEFAULT_NAMES = new Set([
  'Çubuk Çocuk',
  'Stick Kid',
  'Yıldız',
  'Star',
  'Köpek',
  'Dog',
  'Yeni Figür',
  'New Figure',
])

export function figureDisplayName(templateId: string, fallback: string, t: LanguageContextValue['t']) {
  const isDefault = KNOWN_DEFAULT_NAMES.has(fallback)
  if (templateId === 'stickman' && (isDefault || !fallback)) return t('tplStickman')
  if (templateId === 'star' && (isDefault || !fallback)) return t('tplStar')
  if (templateId === 'dog' && (isDefault || !fallback)) return t('tplDog')
  if (templateId === 'custom' && (isDefault || !fallback)) return t('newFigure')
  return fallback
}

export function backgroundDisplayName(id: string, fallback: string, t: LanguageContextValue['t']) {
  if (id === 'white') return t('bgWhite')
  if (id === 'sky') return t('bgSky')
  if (id === 'sunset') return t('bgSunset')
  if (id === 'space') return t('bgSpace')
  if (id === 'class') return t('bgClass')
  return fallback
}

export function segmentKindName(kind: string, t: LanguageContextValue['t']) {
  if (kind === 'circle') return t('kindCircle')
  if (kind === 'ring') return t('kindRing')
  if (kind === 'hex') return t('kindHex')
  if (kind === 'double') return t('kindDouble')
  if (kind === 'polygon') return t('kindPolygon')
  return t('kindLine')
}
