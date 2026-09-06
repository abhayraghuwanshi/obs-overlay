/**
 * Google Tag Manager.
 *
 * Loaded from main.jsx instead of a hardcoded <script> in index.html so we can
 * skip the loads that aren't real visits: OBS renders the overlay in a headless
 * browser source that reloads on every scene switch, which would otherwise
 * drown the landing-page numbers in fake sessions.
 *
 * GA4 (and anything else) is configured inside the GTM container itself, not
 * here — this file only injects the container.
 *
 * The container ID comes from VITE_GTM_ID at build time (Vercel → Settings →
 * Environment Variables), falling back to the one container we ship with.
 * Set VITE_GTM_ID to empty in an environment (e.g. previews) to disable it.
 */

const GTM_ID = import.meta.env.VITE_GTM_ID ?? 'GTM-NMBCB3RF';

// Only the OBS browser source is worth excluding — it carries ?obs= and
// reloads on every scene switch, which would otherwise drown the real numbers
// in fake sessions. A ?room= link is still a person opening the editor (the
// creator, or someone they shared it with), so that counts.
function isOverlayLoad() {
    const q = new URLSearchParams(window.location.search);
    return q.has('obs');
}

export function initAnalytics() {
    if (!GTM_ID || typeof window === 'undefined' || isOverlayLoad()) return;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.appendChild(s);
}

// Custom event helper — push straight to the dataLayer GTM reads, so any tag
// configured in the container (GA4, ads, etc.) can pick it up. Safe to call
// before/without init; it just accumulates in an array nobody drains.
export function track(name, params) {
    window.dataLayer?.push({ event: name, ...params });
}
