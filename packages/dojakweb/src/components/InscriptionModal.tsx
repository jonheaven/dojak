import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, ArrowTopRightOnSquareIcon, CubeIcon } from '@heroicons/react/24/outline';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';
import { DogeCurrencyIcon } from './DogeCurrencyIcon';
import { dogexCdnContentUrl } from '../utils/api';

interface InscriptionData {
  address: string;
  content: string;
  contentBody: string;
  contentLength: number;
  contentType: string;
  genesisTransaction: string;
  inscriptionId: string;
  inscriptionNumber: number;
  output: string;
  outputValue: string;
  preview: string;
  timestamp: number;
  height: number;
  location: string;
}

interface InscriptionModalProps {
  inscriptionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const InscriptionModal: React.FC<InscriptionModalProps> = ({
  inscriptionId,
  isOpen,
  onClose
}) => {
  const { t } = useDojakwebI18n();
  const [inscription, setInscription] = useState<InscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corsSuggested, setCorsSuggested] = useState(false);

  const fetchInscriptionDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setCorsSuggested(false);

    try {
      console.log(`🔍 Fetching inscription details for: ${inscriptionId}`);

      let response;
      try {
        response = await fetch(`http://localhost:7070/api/inscriptions/${inscriptionId}`);
      } catch {
        console.log('📡 Local proxy not available, trying direct API...');
        response = await fetch(`https://api.doggy.market/inscriptions/${inscriptionId}`);
      }

      if (!response.ok) {
        throw new Error(t('inscriptionModal.error.fetch', { status: String(response.status) }));
      }

      const data = await response.json();
      console.log('📊 Inscription details:', data);

      setInscription(data);
    } catch (err: unknown) {
      console.error('❌ Failed to fetch inscription details:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const networkBlocked =
        msg.includes('CORS') ||
        msg.includes('Failed to fetch') ||
        msg.toLowerCase().includes('networkerror');
      if (networkBlocked) {
        setCorsSuggested(true);
        setError(t('inscriptionModal.error.cors'));
      } else {
        setError(msg || t('inscriptionModal.error.generic'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [inscriptionId, t]);

  useEffect(() => {
    if (isOpen && inscriptionId) {
      void fetchInscriptionDetails();
    }
  }, [isOpen, inscriptionId, fetchInscriptionDetails]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return t('inscriptionModal.size.zero');
    const k = 1024;
    const sizes = [
      t('inscriptionModal.size.bytes'),
      t('inscriptionModal.size.kb'),
      t('inscriptionModal.size.mb'),
      t('inscriptionModal.size.gb'),
    ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const resolveImageSrc = () => {
    if (!inscription) return '';
    const preview = inscription.preview?.trim();
    const content = inscription.content?.trim();
    const id = inscription.inscriptionId?.trim();
    if (preview) return preview;
    if (content) return content;
    if (id) return dogexCdnContentUrl(id);
    return '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-bg-secondary rounded-lg border border-border-primary shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border-primary">
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {t('inscriptionModal.title')}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {inscription
                ? `#${inscription.inscriptionNumber}`
                : t('inscriptionModal.loadingHash')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-primary rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="flex max-h-[calc(90vh-80px)]">
          <div className="w-1/2 p-6 border-r border-border-primary">
            {isLoading ? (
              <div className="w-full h-96 bg-bg-primary rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <CubeIcon className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                  <p className="text-text-secondary">{t('inscriptionModal.loadingBody')}</p>
                </div>
              </div>
            ) : error ? (
              <div className="w-full h-96 bg-red-900/20 border border-red-700/50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <p className="text-red-400 font-medium mb-2">{t('inscriptionModal.failedTitle')}</p>
                  <p className="text-red-300 text-sm mb-4">{error}</p>
                  {corsSuggested && (
                    <a
                      href={`https://doggy.market/inscription/${inscriptionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded-lg transition-colors text-sm"
                    >
                      <span>{t('inscriptionModal.viewDoggyMarket')}</span>
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ) : inscription ? (
              <div className="space-y-4">
                <div className="relative group">
                  {inscription.contentType?.startsWith('image/') ? (
                    <img
                      src={resolveImageSrc()}
                      alt={t('inscriptionModal.alt.content', { id: inscription.inscriptionId })}
                      className="w-full max-h-96 object-contain rounded-lg bg-bg-primary"
                      onError={(e) => {
                        const fallback = inscription.preview?.trim() || inscription.content?.trim();
                        if (fallback && e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback;
                          return;
                        }
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-96 bg-bg-primary rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <CubeIcon className="w-16 h-16 text-text-secondary mx-auto mb-4" />
                        <p className="text-text-secondary">{t('inscriptionModal.nonImage')}</p>
                        <p className="text-xs text-text-tertiary mt-1">
                          {inscription.contentType}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <a
                    href={`https://doggy.market/inscription/${inscription.inscriptionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded-lg transition-colors text-sm"
                  >
                    <span>{t('inscriptionModal.viewDoggyMarket')}</span>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : null}
          </div>

          <div className="w-1/2 p-6 overflow-y-auto">
            {inscription && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  {t('inscriptionModal.dataTitle')}
                </h3>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-text-primary mb-3 uppercase tracking-wide">
                      {t('inscriptionModal.section.basic')}
                    </h4>
                    <div className="space-y-2">
                      <DataRow label={t('inscriptionModal.label.id')} value={inscription.inscriptionId} copyable copyTitle={t('inscriptionModal.copyTitle')} onCopy={copyToClipboard} />
                      <DataRow label={t('inscriptionModal.label.number')} value={`#${inscription.inscriptionNumber}`} />
                      <DataRow label={t('inscriptionModal.label.address')} value={inscription.address} copyable copyTitle={t('inscriptionModal.copyTitle')} onCopy={copyToClipboard} />
                      <DataRow label={t('inscriptionModal.label.contentType')} value={inscription.contentType} />
                      <DataRow label={t('inscriptionModal.label.contentLength')} value={formatFileSize(inscription.contentLength)} />
                      <DataRow
                        label={t('inscriptionModal.label.outputValue')}
                        value={
                          <span className="inline-flex items-center gap-0.5">
                            <span>
                              {t('inscriptionModal.valueDoge', {
                                amount: String(parseInt(inscription.outputValue, 10) / 100000000),
                              })}
                            </span>
                            <DogeCurrencyIcon size="xs" className="opacity-90" />
                          </span>
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-text-primary mb-3 uppercase tracking-wide">
                      {t('inscriptionModal.section.blockchain')}
                    </h4>
                    <div className="space-y-2">
                      <DataRow label={t('inscriptionModal.label.genesisTx')} value={inscription.genesisTransaction} copyable copyTitle={t('inscriptionModal.copyTitle')} onCopy={copyToClipboard} />
                      <DataRow label={t('inscriptionModal.label.output')} value={inscription.output} copyable copyTitle={t('inscriptionModal.copyTitle')} onCopy={copyToClipboard} />
                      <DataRow label={t('inscriptionModal.label.location')} value={inscription.location} copyable copyTitle={t('inscriptionModal.copyTitle')} onCopy={copyToClipboard} />
                      <DataRow label={t('inscriptionModal.label.blockHeight')} value={inscription.height.toLocaleString()} />
                      <DataRow label={t('inscriptionModal.label.timestamp')} value={formatTimestamp(inscription.timestamp)} />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-text-primary mb-3 uppercase tracking-wide">
                      {t('inscriptionModal.section.links')}
                    </h4>
                    <div className="space-y-2">
                      <DataRow label={t('inscriptionModal.label.contentUrl')} value={inscription.content} copyable link copyTitle={t('inscriptionModal.copyTitle')} onCopy={copyToClipboard} />
                      <DataRow label={t('inscriptionModal.label.previewUrl')} value={inscription.preview} copyable link copyTitle={t('inscriptionModal.copyTitle')} onCopy={copyToClipboard} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DataRow: React.FC<{
  label: string;
  value: string | React.ReactNode;
  copyable?: boolean;
  link?: boolean;
  copyTitle?: string;
  onCopy?: (text: string) => void;
}> = ({ label, value, copyable, link, copyTitle, onCopy }) => {
  const stringValue = typeof value === 'string' ? value : '';
  return (
    <div className="flex items-start justify-between py-2 border-b border-border-primary/50 last:border-b-0">
      <span className="text-sm text-text-secondary font-medium min-w-0 flex-1 mr-4">
        {label}:
      </span>
      <div className="flex items-center space-x-2 min-w-0 flex-1">
        {link && typeof value === 'string' ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-400 hover:text-primary-300 truncate underline"
          >
            {value.length > 20 ? `${value.slice(0, 20)}...` : value}
          </a>
        ) : typeof value === 'string' ? (
          <span className="text-sm text-text-primary font-mono break-all">
            {value}
          </span>
        ) : (
          <span className="text-sm text-text-primary break-all">{value}</span>
        )}
        {copyable && copyTitle && onCopy && typeof value === 'string' && (
          <button
            type="button"
            onClick={() => onCopy(stringValue)}
            className="text-text-tertiary hover:text-text-secondary transition-colors ml-2 flex-shrink-0"
            title={copyTitle}
          >
            📋
          </button>
        )}
      </div>
    </div>
  );
};
