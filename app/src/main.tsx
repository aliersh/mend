import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Providers } from './providers'
import { ThemeProvider } from './theme/ThemeProvider'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </Providers>
    </BrowserRouter>
  </StrictMode>,
)
