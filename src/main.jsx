import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { getRoom, usageUrl } from './config'
import { initAnalytics } from './analytics'

// Per-room usage ping (once per page load) into our own KV. This is separate
// from GA: the home page reads these counts back to show per-room stats, which
// GA can't serve to the client.
// A stable per-browser id (localStorage) lets the server tally unique visitors
// without any personal data. Fire-and-forget; never blocks the app.
try {
    let uid = localStorage.getItem('ov_uid')
    if (!uid) { uid = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2)); localStorage.setItem('ov_uid', uid) }
    fetch(usageUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: getRoom(), uid }),
        keepalive: true,
    }).catch(() => {})
} catch { /* localStorage blocked / SSR — skip */ }

initAnalytics()

createRoot(document.getElementById('root')).render(<App />)

