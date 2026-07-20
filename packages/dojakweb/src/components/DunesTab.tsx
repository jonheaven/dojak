import React, { useState } from 'react';
import { PlusIcon, ArrowUpIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';
import type { DuneHolding } from '../utils/api';
import { DuneDeployModal } from './DuneDeployModal';
import { DuneMintModal } from './DuneMintModal';
import { DuneSendModal } from './DuneSendModal';

interface Props {
  dunes: DuneHolding[] | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const DunesTab: React.FC<Props> = ({ dunes, isLoading, error, onRefresh }) => {
  const { t } = useDojakwebI18n();

  const [deployOpen, setDeployOpen]     = useState(false);
  const [mintOpen, setMintOpen]         = useState(false);
  const [sendOpen, setSendOpen]         = useState(false);
  const [activeDune, setActiveDune]     = useState<DuneHolding | undefined>(undefined);
  const [mintDuneName, setMintDuneName] = useState<string | undefined>(undefined);

  const openMint = (holding?: DuneHolding) => {
    setMintDuneName(holding?.dune ?? holding?.ticker ?? undefined);
    setMintOpen(true);
  };

  const openSend = (holding: DuneHolding) => {
    setActiveDune(holding);
    setSendOpen(true);
  };

  const handleSuccess = () => {
    setTimeout(onRefresh, 2000);
  };

  const WHITE = 'THE•WHITE•DOGE';
  const MANIFESTO = 'DOGENALS•OVER•DOGINALS';
  const [deployName, setDeployName] = useState(WHITE);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 p-4 text-sm">
        <p className="font-medium text-[#FCD34D]">{t('walletPage.dunes.heroBannerTitle')}</p>
        <p className="mt-1 text-xs text-text-secondary">{t('walletPage.dunes.heroBannerBody')}</p>
        <p className="mt-2 text-xs text-text-secondary">
          Dual Era 2 flagships: <span className="font-mono text-text-primary">{MANIFESTO}</span> (manifesto) +{' '}
          <span className="font-mono text-text-primary">{WHITE}</span> (liquidity / come-home).
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setDeployName(WHITE);
              setDeployOpen(true);
            }}
            className="text-xs font-medium text-[#FCD34D] hover:underline"
          >
            Etch {WHITE}
          </button>
          <button
            type="button"
            onClick={() => {
              setDeployName(MANIFESTO);
              setDeployOpen(true);
            }}
            className="text-xs font-medium text-[#FCD34D] hover:underline"
          >
            Etch {MANIFESTO}
          </button>
          <a
            href="https://dogenals.com/come-home"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-text-secondary hover:text-primary-500 hover:underline"
          >
            Come home (SOL→Doge) →
          </a>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setDeployName(WHITE);
            setDeployOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary text-xs hover:border-primary-500 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Deploy New Ðune
        </button>
        <button
          type="button"
          onClick={() => {
            setMintDuneName(WHITE);
            setMintOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border border-primary-500/40 rounded text-text-primary text-xs hover:border-primary-500 transition-colors"
          title={WHITE}
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Mint {WHITE}
        </button>
        <button
          type="button"
          onClick={() => {
            setMintDuneName(MANIFESTO);
            setMintOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary text-xs hover:border-primary-500 transition-colors"
          title={MANIFESTO}
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Mint manifesto
        </button>
        <button
          type="button"
          onClick={() => openMint()}
          className="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border border-border-primary rounded text-text-primary text-xs hover:border-primary-500 transition-colors"
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Mint
        </button>
      </div>

      {/* Holdings list */}
      {dunes?.length ? (
        dunes.map((dune, index) => {
          const name = dune.dune ?? dune.ticker ?? t('walletPage.dunes.fallbackName');
          const balance = Number(dune.balance || dune.amount || 0).toLocaleString();
          return (
            <div
              key={`${name}-${index}`}
              className="bg-bg-secondary rounded-lg p-4 border border-border-primary"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-text-primary font-mono truncate">{name}</h3>
                  {dune.symbol && (
                    <p className="text-xs text-text-secondary">{dune.symbol}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm text-text-primary tabular-nums">{balance}</span>
                  <button
                    type="button"
                    onClick={() => openMint(dune)}
                    title="Mint more"
                    className="p-1.5 rounded border border-border-primary text-text-secondary hover:text-primary-500 hover:border-primary-500 transition-colors"
                  >
                    <SparklesIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openSend(dune)}
                    title="Send"
                    className="p-1.5 rounded border border-border-primary text-text-secondary hover:text-primary-500 hover:border-primary-500 transition-colors"
                  >
                    <ArrowUpIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      ) : !isLoading && !error ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-text-secondary text-sm">{t('walletPage.dunes.empty')}</p>
          <button
            type="button"
            onClick={() => setDeployOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Deploy Your First Ðune
          </button>
        </div>
      ) : null}

      {error && <p className="text-center py-8 text-yellow-400 text-sm">{error}</p>}

      <DuneDeployModal
        isOpen={deployOpen}
        onClose={() => setDeployOpen(false)}
        initialName={deployName}
        onSuccess={handleSuccess}
      />
      <DuneMintModal
        isOpen={mintOpen}
        onClose={() => setMintOpen(false)}
        duneName={mintDuneName}
        onSuccess={handleSuccess}
      />
      <DuneSendModal
        isOpen={sendOpen}
        onClose={() => { setSendOpen(false); setActiveDune(undefined); }}
        holding={activeDune}
        onSuccess={handleSuccess}
      />
    </div>
  );
};
