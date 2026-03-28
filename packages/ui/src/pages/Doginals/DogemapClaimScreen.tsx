import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { getDogIndexerClient } from '@dojak/core/background/service/providers/dogIndexer';
import { Button, Column, Content, Header, Input, Layout, Row, Text } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import { FeeRateBar } from '@dojak/ui/components/FeeRateBar';
import { useNavigate } from '@dojak/ui/pages/MainRoute';
import { useWallet } from '@dojak/ui/utils';

export default function DogemapClaimScreen() {
  const { state } = useLocation();
  const props = state as { blockNumber?: number | string } | undefined;

  const navigate = useNavigate();
  const wallet = useWallet();
  const tools = useTools();

  const [blockInput, setBlockInput] = useState(props?.blockNumber?.toString() ?? '');
  const [feeRate, setFeeRate] = useState(5);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'available' | 'claimed' | 'future' | 'unknown' | null>(null);
  const [claimedBy, setClaimedBy] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const blockNumber = parseInt(blockInput, 10);
  const isValidBlock = !isNaN(blockNumber) && blockNumber >= 0 && blockInput !== '';

  // Fetch the current chain tip once on mount so we can enforce the
  // Bitmap/Dogemap spec rule: claimed_block <= block_height_of_inscription_tx.
  // Future-block claims are void — the indexer will never index them.
  useEffect(() => {
    const indexer = getDogIndexerClient();
    indexer.ping().then((alive) => {
      if (!alive) return;
      return indexer.getCurrentBlockHeight();
    }).then((h) => {
      if (h !== undefined) setCurrentHeight(h);
    }).catch(() => { /* offline — will warn in UI */ });
  }, []);

  // Debounced indexer check whenever the block number changes
  useEffect(() => {
    if (!isValidBlock) {
      setClaimStatus(null);
      setClaimedBy(null);
      return;
    }
    const timer = setTimeout(() => checkBlock(blockNumber), 600);
    return () => clearTimeout(timer);
  }, [blockInput, currentHeight]);

  async function checkBlock(n: number) {
    setChecking(true);
    setClaimStatus(null);
    setClaimedBy(null);
    setError('');
    try {
      // Bitmap/Dogemap spec: the block being claimed must already exist.
      // An inscription claiming block N is void if N > chain tip at inscription time.
      if (currentHeight !== null && n > currentHeight) {
        setClaimStatus('future');
        return;
      }

      const indexer = getDogIndexerClient();
      const alive = await indexer.ping();
      if (!alive) {
        setClaimStatus('unknown');
        return;
      }
      const entry = await indexer.getDogemapEntry(n);
      if (entry && entry.claimed && entry.ownerInscriptionId) {
        setClaimStatus('claimed');
        setClaimedBy(entry.ownerInscriptionId);
      } else {
        setClaimStatus('available');
      }
    } catch {
      setClaimStatus('unknown');
    } finally {
      setChecking(false);
    }
  }

  async function handleClaim() {
    if (!isValidBlock || claimStatus === 'claimed' || claimStatus === 'future') return;
    setSubmitting(true);
    setError('');
    try {
      const content = `${blockNumber}.dogemap`;
      const result = await wallet.createDoginalInscription(content, feeRate);
      tools.toastSuccess(`Block ${blockNumber} claim submitted!`);
      navigate('TxSuccessScreen', { txid: result?.txid ?? '' });
    } catch (e: any) {
      setError(e.message || 'Failed to create inscription');
      setSubmitting(false);
    }
  }

  const canClaim =
    isValidBlock &&
    claimStatus !== 'claimed' &&
    claimStatus !== 'future' &&
    !submitting &&
    !checking &&
    feeRate > 0;

  return (
    <Layout>
      <Header
        onBack={() => window.history.go(-1)}
        title="Claim Dogemap Block"
      />
      <Content>
        <Column gap="lg">
          {/* Info card */}
          <Column
            px="md"
            py="md"
            style={{
              backgroundColor: 'rgba(255, 107, 53, 0.1)',
              borderRadius: 12,
              border: '1px solid rgba(255, 107, 53, 0.3)'
            }}
          >
            <Text text="🏞️ What is a Dogemap?" preset="bold" size="md" />
            <Text
              text="Each Dogecoin block can be claimed as a piece of virtual land. Claims are first-come, first-served by inscription order. Only already-mined blocks are valid — future block claims are void per the Dogemap spec."
              color="textDim"
              size="sm"
              wrap
            />
          </Column>

          {/* Block number input */}
          <Column gap="sm">
            <Text text="Block Number" color="textDim" />
            <Input
              preset="amount"
              placeholder="e.g. 5000000"
              value={blockInput}
              onAmountInputChange={(val) => {
                setBlockInput(val.replace(/[^0-9]/g, ''));
              }}
            />

            {/* Availability status */}
            {checking && (
              <Text text="Checking availability…" color="textDim" size="sm" />
            )}
            {!checking && claimStatus === 'available' && (
              <Row itemsCenter gap="sm">
                <Text text="✓" style={{ color: '#28a745' }} />
                <Text text={`Block ${blockNumber} is available to claim`} size="sm" style={{ color: '#28a745' }} />
              </Row>
            )}
            {!checking && claimStatus === 'claimed' && (
              <Column gap="zero">
                <Row itemsCenter gap="sm">
                  <Text text="✗" style={{ color: '#dc3545' }} />
                  <Text text={`Block ${blockNumber} is already claimed`} size="sm" style={{ color: '#dc3545' }} />
                </Row>
                {claimedBy && (
                  <Text
                    text={`Owner inscription: ${claimedBy.slice(0, 12)}…${claimedBy.slice(-8)}`}
                    color="textDim"
                    size="xs"
                  />
                )}
              </Column>
            )}
            {!checking && claimStatus === 'future' && (
              <Column gap="zero">
                <Row itemsCenter gap="sm">
                  <Text text="⚠" style={{ color: '#fd7e14' }} />
                  <Text text={`Block ${blockNumber} hasn't been mined yet`} size="sm" style={{ color: '#fd7e14' }} />
                </Row>
                <Text
                  text="Per the Dogemap spec, claims on future blocks are void — the indexer will never honour them. Wait for the block to be mined first."
                  color="textDim"
                  size="xs"
                  wrap
                />
                {currentHeight !== null && (
                  <Text
                    text={`Current chain tip: block ${currentHeight.toLocaleString()}`}
                    color="textDim"
                    size="xs"
                  />
                )}
              </Column>
            )}
            {!checking && claimStatus === 'unknown' && (
              <Text
                text="Indexer offline — availability unknown. You can still attempt to claim."
                color="textDim"
                size="sm"
              />
            )}
          </Column>

          {/* Preview of what will be inscribed */}
          {isValidBlock && (
            <Column gap="sm">
              <Text text="Inscription content" color="textDim" />
              <Row
                justifyCenter
                itemsCenter
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  borderRadius: 8
                }}
              >
                <Text
                  text={`${blockNumber}.dogemap`}
                  preset="bold"
                  size="lg"
                  style={{ fontFamily: 'monospace' }}
                />
              </Row>
            </Column>
          )}

          {/* Fee rate */}
          <Column gap="sm">
            <Text text="Fee Rate" color="textDim" />
            <FeeRateBar onChange={setFeeRate} />
          </Column>

          {error && <Text text={error} color="error" />}

          <Button
            disabled={!canClaim}
            preset="primary"
            text={submitting ? 'Submitting…' : 'Claim Block'}
            onClick={handleClaim}
          />
        </Column>
      </Content>
    </Layout>
  );
}
