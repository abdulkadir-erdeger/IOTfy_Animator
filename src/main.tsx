import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { LanguageProvider } from './i18n/LanguageContext'
import { AnimatorProvider } from './state/AnimatorContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AnimatorProvider>
        <App />
      </AnimatorProvider>
    </LanguageProvider>
  </StrictMode>,
)

