import { startXOverlay } from './inject';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startXOverlay, { once: true });
} else {
  startXOverlay();
}
