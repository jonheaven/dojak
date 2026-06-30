/** Shared surface + control classes for Charms tools embedded in host apps (web-com). Uses --ds-* from dojakweb-host.css. */

export const charmsPanelClass =
  'rounded-2xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-elevated)] p-6';

export const charmsPanelCompactClass =
  'rounded-2xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-elevated)] p-5';

export const charmsEyebrowClass =
  'text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--ds-accent-solid)]';

export const charmsTitleClass = 'mt-2 text-2xl font-bold text-[var(--ds-text)]';

export const charmsBodyClass = 'mt-2 max-w-2xl text-sm text-[var(--ds-text-muted)]';

export const charmsPrimaryBtnClass =
  'rounded-xl border border-[var(--ds-accent-border)] bg-[var(--ds-accent-solid)]/15 px-4 py-2 text-sm font-semibold text-[var(--ds-accent-solid)] transition hover:bg-[var(--ds-accent-solid)]/25';

export const charmsSecondaryBtnClass =
  'rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-panel)] px-4 py-2 text-sm font-semibold text-[var(--ds-text)] transition hover:border-[var(--ds-accent-border)] disabled:opacity-40';

export const charmsListItemClass =
  'flex items-center justify-between gap-3 rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-panel)] px-3 py-2';

export const charmsModalSecondaryBtnClass =
  'flex-1 rounded-lg border border-[var(--ds-border-strong)] bg-[var(--ds-panel)] px-4 py-2 text-[var(--ds-text)] transition hover:border-[var(--ds-accent-border)]';

export const charmsModalPrimaryBtnClass =
  'flex-1 rounded-lg border border-[var(--ds-accent-border)] bg-[var(--ds-accent-solid)] px-4 py-2 font-semibold text-[var(--ds-accent-foreground)] transition hover:bg-[var(--ds-accent-solid-hover)] disabled:cursor-not-allowed disabled:opacity-50';

export const charmsModalCardClass =
  'rounded-lg border border-[var(--ds-border-strong)] bg-[var(--ds-panel)] p-4';
