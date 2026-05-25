import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import BudgetTracker from './budget_tracker.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BudgetTracker />
  </StrictMode>,
)
