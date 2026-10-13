import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { UpdateBanner } from './components/UpdateBanner'
import { setupAppAutoUpdate } from './lib/appUpdate'

// Tự chuyển sang bản mới sau mỗi lần deploy — xem lib/appUpdate.ts.
setupAppAutoUpdate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateBanner />
  </StrictMode>,
)
