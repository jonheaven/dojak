import React from 'react';

interface ConfirmBannerProps {
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'amber' | 'sky' | 'rose';
  busy?: boolean;
}

const VARIANTS = {
  amber: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    text: 'text-amber-100',
    confirmBtn: 'border-amber-500/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/35',
  },
  sky: {
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/10',
    text: 'text-sky-100',
    confirmBtn: 'border-sky-500/50 bg-sky-500/20 text-sky-200 hover:bg-sky-500/35',
  },
  rose: {
    border: 'border-rose-500/40',
    bg: 'bg-rose-500/10',
    text: 'text-rose-100',
    confirmBtn: 'border-rose-500/50 bg-rose-500/20 text-rose-200 hover:bg-rose-500/35',
  },
};

export const ConfirmBanner: React.FC<ConfirmBannerProps> = ({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'amber',
  busy = false,
}) => {
  const v = VARIANTS[variant];
  return (
    <div className={`rounded-xl border ${v.border} ${v.bg} px-4 py-3 text-sm ${v.text}`}>
      <div className="leading-relaxed">{message}</div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`rounded-lg border ${v.confirmBtn} px-4 py-1.5 text-xs font-semibold disabled:opacity-50`}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/10 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
};
