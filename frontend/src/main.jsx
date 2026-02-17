import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css' // Global styles + Catppuccin theme (must load BEFORE LCARS overrides)
import App from './App'
import { ThemeProvider } from './themes/lcars/ThemeProvider' // LCARS CSS imports come after index.css

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
