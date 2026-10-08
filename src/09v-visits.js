// Visit counts (0.17.1, owner: "so we can see how many visitors we get"): Vercel Web Analytics, on the live site and its previews only.
// Its script is served by Vercel from our own domain once Web Analytics is enabled for the project (Vercel dashboard, Analytics).
// One page view per page load: the script counts a pushState to a new path, never our replaceState of the view into the hash (updateHash).
// It sets no cookies and stores nothing on the device; we send the path alone (no ?query, no #view), and nothing at all when the browser
// asks not to be tracked (Global Privacy Control, Do Not Track). The lab and the song review page are the owner's, so they are not counted.
// Off for one visit with ?flags=-analytics. See docs/SECURITY.md.
(() => {
  if (!FLAGS.analytics || LAB.on || REVIEW.on) return;
  const h = location.hostname;
  if (h !== 'gcdatlas.com' && !h.endsWith('.gcdatlas.com') && !h.endsWith('.vercel.app')) return;   // (a local server, a file or the claude.ai artifact has no script to load)
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  window.va = window.va || function(){ (window.vaq = window.vaq || []).push(arguments); };
  window.va('beforeSend', e => ({ ...e, url:String(e.url).split(/[?#]/)[0] }));
  const s = document.createElement('script');
  s.src = '/_vercel/insights/script.js';
  document.head.appendChild(s);
})();
