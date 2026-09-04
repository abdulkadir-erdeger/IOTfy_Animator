import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'sky' | 'mint' | 'sun' | 'berry' | 'grape' | 'ink' | 'white'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const tones: Record<NonNullable<IconButtonProps['tone']>, string> = {
  sky: 'bg-sky-200 text-sky-900 hover:bg-sky-100',
  mint: 'bg-emerald-200 text-emerald-900 hover:bg-emerald-100',
  sun: 'bg-amber-200 text-amber-900 hover:bg-amber-100',
  berry: 'bg-rose-200 text-rose-800 hover:bg-rose-100',
  grape: 'bg-violet-200 text-violet-800 hover:bg-violet-100',
  ink: 'bg-slate-700 text-white hover:bg-slate-600',
  white: 'bg-white/80 text-slate-700 hover:bg-white',
}

const sizes: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-11 w-11 sm:h-9 sm:w-9',
  md: 'h-12 w-12 sm:h-11 sm:w-11',
  lg: 'h-14 w-14',
}

export function IconButton({
  label,
  tone = 'white',
  size = 'md',
  className = '',
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-2xl border-2 border-slate-800/10 shadow-sm transition touch-manipulation active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
