import React, { useState } from 'react';
import { toast } from 'sonner';
import { useBrowserWallet } from '../contexts/BrowserWalletContext';
import { useDuneWalletConnection } from '../hooks/useDuneWalletConnection';
import { signAndBroadcastInscription } from '../lib/dogetag/inscribe';
import { buildDmtClaimPayload } from '../lib/dune-dmt';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (txid: string) => void;
}

/**
 * Inscribes `p:dunes op:dmt-claim`. Does not touch etch / open-mint / edict builders.
 */
export const DuneDmtClaimModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { address, connected } = useDuneWalletConnection();
  const browser = useBrowserWallet();
  const [tick, setTick] = useState('BITS');
  const [blk, setBlk] = useState('');
  const [elem, setElem] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setError(null);
    setBusy(false);
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (!connected || !address) {
      setError('Connect the local browser wallet first.');
      return;
    }
    const wif = browser.wallet?.privateKey;
    if (!wif) {
      setError('Unlock Local Browser Wallet to sign the claim inscription.');
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = buildDmtClaimPayload({
        tick,
        blk,
        elemInscriptionId: elem || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid claim');
      return;
    }
    setBusy(true);
    try {
      const r = await signAndBroadcastInscription({
        text: JSON.stringify(payload),
        fromAddress: address,
        privateKeyWIF: wif,
        contentType: 'application/json',
        metaprotocol: 'dunes',
      });
      toast.success(`Claim inscribed ${r.inscriptionId}`);
      onSuccess?.(r.revealTxid);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim broadcast failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Claim DMT Ðune ($BITS)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-text-secondary">
          Amount = nBits of the claimed header. The reveal UTXO receives a normal Ðune
          balance — send it with Send, not a transfer inscription. Existing etch/mint
          is unchanged.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Tick</Label>
            <Input value={tick} onChange={(e) => setTick(e.target.value)} className="font-mono" />
          </div>
          <div>
            <Label>Block height</Label>
            <Input
              value={blk}
              onChange={(e) => setBlk(e.target.value)}
              placeholder="6124069"
              className="font-mono"
            />
          </div>
          <div>
            <Label>Element id (recommended)</Label>
            <Input
              value={elem}
              onChange={(e) => setElem(e.target.value)}
              placeholder="<txid>i0"
              className="font-mono"
            />
          </div>
        </div>
        {error ? (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="w-full rounded bg-primary-500 px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {busy ? 'Inscribing…' : 'Inscribe dmt-claim'}
        </button>
      </DialogContent>
    </Dialog>
  );
};
