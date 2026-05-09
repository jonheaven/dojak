'use client';

import { Fragment, useId, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useWalletStore } from '@/stores/walletStore';
import type { DojakwebTranslate } from '@/contexts/DojakwebLocaleContext';
import { Switch } from '@/components/ui/switch';

interface DogeosEcosystemSettingsProps {
  t: DojakwebTranslate;
  /** When false, DogeOS toggles are disabled (extensions / hardware). */
  canUseDogeosFromSeed: boolean;
}

export function DogeosEcosystemSettings({ t, canUseDogeosFromSeed }: DogeosEcosystemSettingsProps) {
  const dogeosEnabled = useWalletStore((s) => s.dogeosEnabled);
  const pureDogeosMode = useWalletStore((s) => s.pureDogeosMode);
  const dogeosEverUsed = useWalletStore((s) => s.dogeosEverUsed);
  const setDogeosEnabled = useWalletStore((s) => s.setDogeosEnabled);
  const setPureDogeosMode = useWalletStore((s) => s.setPureDogeosMode);

  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const enableId = useId();
  const enableDescId = useId();
  const pureId = useId();
  const pureDescId = useId();

  const rowClass =
    'flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-left transition hover:border-white/20';

  const requestSetDogeosEnabled = (next: boolean) => {
    if (!canUseDogeosFromSeed && next) return;
    if (!next && dogeosEnabled && dogeosEverUsed) {
      setConfirmDisableOpen(true);
      return;
    }
    setDogeosEnabled(next);
  };

  const confirmDisable = () => {
    setDogeosEnabled(false);
    setConfirmDisableOpen(false);
  };

  return (
    <div className="space-y-4">
      {!canUseDogeosFromSeed ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          {t('modal.dogeos.localWalletOnly')}
        </p>
      ) : null}

      <div className={rowClass}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white" id={enableId}>
            {t('modal.dogeos.enableTitle')}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/55" id={enableDescId}>
            {t('modal.dogeos.enableDesc')}
          </p>
        </div>
        <Switch
          checked={dogeosEnabled}
          onCheckedChange={requestSetDogeosEnabled}
          disabled={!canUseDogeosFromSeed}
          aria-labelledby={enableId}
          aria-describedby={enableDescId}
        />
      </div>

      {dogeosEnabled ? (
        <div className={rowClass}>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white" id={pureId}>
              {t('modal.dogeos.pureTitle')}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-white/55" id={pureDescId}>
              {t('modal.dogeos.pureDesc')}
            </p>
          </div>
          <Switch
            checked={pureDogeosMode}
            onCheckedChange={setPureDogeosMode}
            aria-labelledby={pureId}
            aria-describedby={pureDescId}
          />
        </div>
      ) : null}

      <Transition appear show={confirmDisableOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[10001]" onClose={() => setConfirmDisableOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md rounded-xl border border-white/15 bg-zinc-950 p-5 shadow-2xl">
                  <Dialog.Title className="text-lg font-bold text-white">{t('modal.dogeos.disableWarnTitle')}</Dialog.Title>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{t('modal.dogeos.disableWarnBody')}</p>
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                      onClick={() => setConfirmDisableOpen(false)}
                    >
                      {t('modal.dogeos.cancel')}
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30"
                      onClick={confirmDisable}
                    >
                      {t('modal.dogeos.disableConfirm')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
