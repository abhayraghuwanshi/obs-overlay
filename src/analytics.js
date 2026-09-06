/**
 * Google Analytics 4 (gtag.js), loaded directly — no Tag Manager.
 *
 * Loaded from main.jsx instead of a hardcoded <script> in index.html so we can
 * skip the loads that aren't real visits: OBS renders the overlay in a headless
 * browser source that reloads on every scene switch, which would otherwise
 * drown the landing-page numbers in fake sessions.
 *
 * The measurement ID comes from VITE_GA_ID at build time (Vercel → Settings →
 * Environment Variables), falling back to the one property we ship with.
 * Set VITE_GA_ID to empty in an environment (e.g. previews) to disable it.
 */

const GA_ID = import.meta.env.VITE_GA_ID ?? 'G-8C9W0F5GJ3';

// Only the OBS browser source is worth excluding — it carries ?obs= and
// reloads on every scene switch, which would otherwise drown the real numbers
// in fake sessions. A ?room= link is still a person opening the editor (the
// creator, or someone they shared it with), so that counts.
function isOverlayLoad() {
    const q = new URLSearchParams(window.location.search);
    return q.has('obs');
}

export function initAnalytics() {
    if (!GA_ID || typeof window === 'undefined' || isOverlayLoad()) return;

    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments) }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
}

// Custom event helper — GA4 takes these for free, unlike Vercel's (Pro-only)
// custom events. Safe to call before/without init; it just no-ops.
export function track(name, params) {
    window.gtag?.('event', name, params);
}
