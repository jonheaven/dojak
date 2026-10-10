export function formatDoge(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  if (!Number.isFinite(parsed)) return '0.00';
  return parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

export function formatUsd(value: number) {
  if (!Number.isFinite(value)) return '$0.00';
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export function relativeTime(timestamp?: number) {
  if (!timestamp) return '';
  const delta = Math.max(0, Date.now() - timestamp);
  const mins = Math.round(delta / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
