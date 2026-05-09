import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useConnectedWalletAddress } from '../wallet/getConnectedWalletAddress';
import { useDoginals } from '../hooks/useDoginals';

interface DogePFPSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPFP: (inscriptionId: string | null) => void;
  currentPFP?: string | null;
  walletDrawerHost?: HTMLElement | null;
  nestInWalletDrawer?: boolean;
}

export const DogePFPSelector: React.FC<DogePFPSelectorProps> = ({
  isOpen,
  onClose,
  onSelectPFP,
  currentPFP,
  walletDrawerHost = null,
  nestInWalletDrawer = false,
}) => {
  const nest = Boolean(nestInWalletDrawer && walletDrawerHost);
  const connectedAddress = useConnectedWalletAddress();
  const { doginals, loading, error } = useDoginals(connectedAddress || '');
  const [selectedInscription, setSelectedInscription] = useState<string | null>(currentPFP || null);

  useEffect(() => {
    setSelectedInscription(currentPFP || null);
  }, [currentPFP]);

  const handleSelect = () => {
    onSelectPFP(selectedInscription);
    onClose();
  };

  const handleClear = () => {
    setSelectedInscription(null);
    onSelectPFP(null);
    onClose();
  };

  // Filter for image-type inscriptions that could work as PFPs
  const pfpCandidates = doginals.filter(doginal =>
    doginal.contentType?.startsWith('image/') &&
    doginal.contentLength &&
    doginal.contentLength < 100000 // Under 100KB for reasonable PFP size
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        portalContainer={nest ? walletDrawerHost : null}
        nestedInDrawer={nest}
        className={cn(
          'max-w-2xl max-h-[80vh] overflow-y-auto',
          nest && 'max-h-full min-h-0 max-w-none rounded-none p-6 sm:rounded-none'
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🖼️ Select DogePFP
          </DialogTitle>
          <DialogDescription>
            Choose a Doginal to use as your profile picture. Only image inscriptions under 100KB are shown.
          </DialogDescription>
        </DialogHeader>

        <div className={cn('space-y-4', nest && 'flex min-h-0 flex-1 flex-col overflow-hidden')}>
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-2"></div>
              <p className="text-text-secondary">Loading your Doginals...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-400">Failed to load Doginals: {error}</p>
            </div>
          )}

          {!loading && !error && pfpCandidates.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🐕</div>
              <p className="text-text-secondary mb-2">No suitable Doginals found</p>
              <p className="text-xs text-text-tertiary">
                You need image inscriptions under 100KB to use as profile pictures.
              </p>
            </div>
          )}

          {!loading && !error && pfpCandidates.length > 0 && (
            <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-3', nest && 'min-h-0 flex-1 overflow-y-auto')}>
              {pfpCandidates.map((doginal) => (
                <div
                  key={doginal.inscriptionId}
                  className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                    selectedInscription === doginal.inscriptionId
                      ? 'border-yellow-400 bg-yellow-400/10'
                      : 'border-border-primary hover:border-yellow-400/50'
                  }`}
                  onClick={() => setSelectedInscription(doginal.inscriptionId)}
                >
                  {doginal.previewUrl ? (
                    <img
                      src={doginal.previewUrl}
                      alt={`Inscription #${doginal.inscriptionNumber}`}
                      className="w-full aspect-square object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-bg-secondary rounded-md flex items-center justify-center">
                      <span className="text-2xl">🖼️</span>
                    </div>
                  )}

                  {selectedInscription === doginal.inscriptionId && (
                    <div className="absolute inset-0 bg-yellow-400/20 rounded-md flex items-center justify-center">
                      <div className="bg-yellow-400 text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                        ✓
                      </div>
                    </div>
                  )}

                  <div className="p-2">
                    <div className="text-xs font-medium text-text-primary truncate">
                      #{doginal.inscriptionNumber}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {doginal.contentType?.split('/')[1]?.toUpperCase()}
                    </div>
                    {doginal.collection && (
                      <Badge variant="outline" className="text-xs mt-1">
                        {doginal.collection}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <div className="flex gap-3">
            <Button
              onClick={handleSelect}
              disabled={!selectedInscription && selectedInscription !== currentPFP}
              className="flex-1"
            >
              {selectedInscription ? 'Set as DogePFP' : 'Select an Image'}
            </Button>

            {currentPFP && (
              <Button
                variant="outline"
                onClick={handleClear}
                className="flex-1"
              >
                Clear PFP
              </Button>
            )}

            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>

          <div className="text-xs text-text-tertiary text-center">
            DogePFP is stored locally and only visible in Dojakweb interfaces.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};