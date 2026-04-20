import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initAnalytics } from './utils/analytics'
import { initNewsTracker } from './utils/newsTracker'

// Initialize analytics before rendering
initAnalytics();
initNewsTracker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
