import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { ThemeProvider } from './theme/ThemeProvider'
import { DensityProvider } from './layouts/DensityContext'

import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <DensityProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </DensityProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
