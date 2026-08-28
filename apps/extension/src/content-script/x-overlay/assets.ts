/** Compact Dogecoin Ð mark for the X.com overlay (not the full illustrator dump). */
export const DOGE_COIN_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="dogeGold" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F6E27A"/>
      <stop offset="0.45" stop-color="#C2A633"/>
      <stop offset="1" stop-color="#8A7318"/>
    </linearGradient>
  </defs>
  <circle cx="16" cy="16" r="15.2" fill="url(#dogeGold)"/>
  <circle cx="16" cy="16" r="13.1" fill="#B8962A"/>
  <circle cx="16" cy="16" r="12.2" fill="#C2A633"/>
  <path fill="#FFF8DC" d="M12.4 8.2h5.35c3.15 0 5.15 1.55 5.15 4.05 0 1.62-.92 2.9-2.45 3.48 1.78.48 2.92 1.88 2.92 3.78 0 2.78-2.22 4.47-5.78 4.47H12.4V8.2zm2.35 2.05v4.22h2.55c1.72 0 2.72-.78 2.72-2.12s-1-2.1-2.72-2.1h-2.55zm0 6.18V21.7h2.92c1.92 0 3.05-.88 3.05-2.42s-1.13-2.4-3.05-2.4H14.75z"/>
  <rect fill="#FFF8DC" x="8.4" y="14.35" width="15.2" height="1.7" rx="0.45"/>
</svg>`;

export const OVERLAY_CSS = `
:host {
  all: initial;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.dj-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34.75px;
  height: 34.75px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 999px;
  position: relative;
  color: inherit;
  transition: transform 120ms ease, background 120ms ease;
}
.dj-btn:hover {
  background: rgba(194, 166, 51, 0.14);
  transform: translateY(-0.5px);
}
.dj-btn:focus-visible {
  outline: 2px solid #C2A633;
  outline-offset: 2px;
}
.dj-btn[data-state="busy"] {
  opacity: 0.65;
  pointer-events: none;
}
.dj-icon {
  width: 18.75px;
  height: 18.75px;
  display: block;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.28));
}
.dj-btn[data-state="unlinked"] .dj-icon {
  opacity: 0.72;
  filter: grayscale(0.35) drop-shadow(0 1px 1px rgba(0,0,0,0.28));
}
.dj-btn[data-state="unreachable"] .dj-icon {
  opacity: 0.45;
  filter: grayscale(0.8);
}
.dj-dot {
  position: absolute;
  right: 5px;
  bottom: 5px;
  width: 7px;
  height: 7px;
  border-radius: 99px;
  box-shadow: 0 0 0 1.5px var(--dj-surface, #15202b);
}
.dj-btn[data-state="linked"] .dj-dot { background: #17BF63; }
.dj-btn[data-state="unlinked"] .dj-dot { background: #FFAD1F; }
.dj-btn[data-state="unreachable"] .dj-dot { background: #78828a; }
.dj-btn[data-state="idle"] .dj-dot { display: none; }
.dj-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #0f1419;
  color: #e7e9ea;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.2;
  padding: 6px 9px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  z-index: 4;
}
.dj-btn:hover .dj-tip,
.dj-btn:focus-visible .dj-tip { opacity: 1; }
.dj-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 12px 0 8px;
  border-radius: 999px;
  border: 1px solid rgba(194, 166, 51, 0.45);
  background: rgba(194, 166, 51, 0.12);
  color: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  margin-left: 8px;
  transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
}
.dj-chip:hover {
  background: rgba(194, 166, 51, 0.16);
  border-color: #C2A633;
  transform: translateY(-0.5px);
}
.dj-chip .dj-icon { width: 16px; height: 16px; }
.dj-chip[data-state="linked"] {
  border-color: rgba(23, 191, 99, 0.5);
}
`;
