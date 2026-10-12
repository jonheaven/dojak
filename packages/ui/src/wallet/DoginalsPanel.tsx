import { FormEvent, useEffect, useState } from 'react';

import {
  PopupDoginal,
  PopupDrc20,
  PopupDune,
  useWalletCore
} from './WalletCoreContext';

type Slice = 'dogs' | 'tokens';

function mediaKind(contentType: string): 'image' | 'video' | 'audio' | 'model' | 'text' | 'other' {
  const type = contentType.toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type.includes('gltf') || type.includes('model')) return 'model';
  if (type.startsWith('text/')) return 'text';
  return 'other';
}

function Media({ item, large }: { item: PopupDoginal; large?: boolean }) {
  const kind = mediaKind(item.contentType);
  if (kind === 'image' && item.contentUrl) {
    return <img src={item.contentUrl} alt="" />;
  }
  if (large && kind === 'video' && item.contentUrl) {
    return <video src={item.contentUrl} controls />;
  }
  if (large && kind === 'audio' && item.contentUrl) {
    return <audio src={item.contentUrl} controls />;
  }
  if (large && kind === 'model' && item.contentUrl) {
    return (
      <a className="dj-ghost" href={item.contentUrl} target="_blank" rel="noreferrer">
        Open 3D model
      </a>
    );
  }
  return <span className="dj-dog-fallback">{kind === 'other' ? 'Doginal' : kind}</span>;
}

export function DoginalsPanel(props: {
  onStatus: (message: string, tone?: 'ok' | 'error') => void;
}) {
  const wallet = useWalletCore();
  const [slice, setSlice] = useState<Slice>('dogs');
  const [sort, setSort] = useState<'num' | 'az' | 'safe'>('num');
  const [dogs, setDogs] = useState<PopupDoginal[]>([]);
  const [drc20, setDrc20] = useState<PopupDrc20[]>([]);
  const [dunes, setDunes] = useState<PopupDune[]>([]);
  const [selected, setSelected] = useState<PopupDoginal | null>(null);
  const [sendTo, setSendTo] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = async () => {
    const [nextDogs, tokens] = await Promise.all([
      wallet.listDoginals?.() ?? [],
      wallet.listTokens?.() ?? { drc20: [], dunes: [] }
    ]);
    setDogs(nextDogs);
    setDrc20(tokens.drc20);
    setDunes(tokens.dunes);
    setSelected((current) => nextDogs.find((row) => row.id === current?.id) ?? null);
    setLoaded(true);
  };

  useEffect(() => {
    void reload().catch((error: unknown) => {
      setLoaded(true);
      props.onStatus(error instanceof Error ? error.message : 'Could not load Doginals', 'error');
    });
  }, []);

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    try {
      props.onStatus(await work());
      await reload();
    } catch (error: unknown) {
      props.onStatus(error instanceof Error ? error.message : 'That did not go through', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (selected) {
    const doge = (selected.outputValue / 1e8).toFixed(4);
    return (
      <div className="dj-detail">
        <button type="button" className="dj-ghost" onClick={() => setSelected(null)}>
          Back to Doginals
        </button>
        <Media item={selected} large />
        <p className="dj-section-label">
          {selected.protected ? 'Protected · under 0.01 DOGE' : 'Unprotected · 0.01 DOGE or more'}
        </p>
        <p className="dj-tx-meta">
          #{selected.number ?? '—'} · {doge} DOGE · {selected.contentType || 'unknown'}
        </p>
        <button
          type="button"
          className="dj-primary"
          disabled={busy || selected.protected}
          onClick={() =>
            void run(async () => {
              const result = await wallet.protectDoginal?.(selected.id);
              if (!result) throw new Error('Protect is not available in this build.');
              return result.already ? 'Already on a coin under 0.01 DOGE.' : `Protected. ${result.txid}`;
            })
          }
        >
          {selected.protected ? 'Protected' : 'Protect'}
        </button>
        <form
          className="dj-main"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(async () => {
              const result = await wallet.sendDoginal?.(selected.id, sendTo.trim());
              if (!result?.txid) throw new Error('Send did not return a txid.');
              setSendTo('');
              return `Sent. ${result.txid}`;
            });
          }}
        >
          <label className="dj-field">
            <span>Send to</span>
            <input className="dj-input" value={sendTo} onChange={(event) => setSendTo(event.target.value)} placeholder="D..." />
          </label>
          <button className="dj-primary" type="submit" disabled={busy || !sendTo.trim()}>
            Send Doginal
          </button>
        </form>
        <form
          className="dj-main"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(async () => {
              await wallet.listDoginalForSale?.(selected.id, Number(price));
              setPrice('');
              return 'Listing sent.';
            });
          }}
        >
          <label className="dj-field">
            <span>List for sale (DOGE)</span>
            <input className="dj-input" value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" placeholder="100" />
          </label>
          <button className="dj-ghost" type="submit" disabled={busy || !price.trim()}>
            List for sale
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="dj-main">
      <div className="dj-seg-row">
        <button type="button" className={`dj-seg${slice === 'dogs' ? ' is-on' : ''}`} onClick={() => setSlice('dogs')}>
          Doginals
        </button>
        <button type="button" className={`dj-seg${slice === 'tokens' ? ' is-on' : ''}`} onClick={() => setSlice('tokens')}>
          Tokens
        </button>
      </div>
      {slice === 'dogs' ? (
        dogs.length === 0 ? (
          <p className="dj-empty">{loaded ? 'No Doginals on this address.' : 'Loading Doginals…'}</p>
        ) : (
          <div className="dj-seg-row">
            <button type="button" className={`dj-seg${sort === 'num' ? ' is-on' : ''}`} onClick={() => setSort('num')}>
              # 
            </button>
            <button type="button" className={`dj-seg${sort === 'az' ? ' is-on' : ''}`} onClick={() => setSort('az')}>
              A–Z
            </button>
            <button type="button" className={`dj-seg${sort === 'safe' ? ' is-on' : ''}`} onClick={() => setSort('safe')}>
              Protected
            </button>
          </div>
          <div className="dj-dog-grid">
            {[...dogs]
              .sort((a, b) => {
                if (sort === 'az') return a.id.localeCompare(b.id);
                if (sort === 'safe') return Number(b.protected) - Number(a.protected);
                return (a.number ?? 0) - (b.number ?? 0);
              })
              .map((item) => (
              <button key={item.id} type="button" className="dj-dog-card" onClick={() => setSelected(item)}>
                <Media item={item} />
                <span className="dj-dog-meta">{item.protected ? 'Protected' : 'Protect'}</span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="dj-panel">
          <p className="dj-section-label">DRC-20</p>
          {drc20.length === 0 ? <p className="dj-empty">No DRC-20 balances.</p> : null}
          {drc20.map((row) => (
            <div className="dj-tx" key={row.ticker}>
              <div className="dj-tx-copy">
                <p className="dj-tx-title">{row.ticker}</p>
                <p className="dj-tx-meta">
                  Available {row.available}
                  {row.transferable !== '0' ? ` · pending transfer ${row.transferable}` : ''}
                </p>
              </div>
            </div>
          ))}
          <p className="dj-section-label" style={{ marginTop: 12 }}>
            Dunes
          </p>
          {dunes.length === 0 ? <p className="dj-empty">No Dunes.</p> : null}
          {dunes.map((row) => (
            <div className="dj-tx" key={row.name}>
              <div className="dj-tx-copy">
                <p className="dj-tx-title">{row.name}</p>
                <p className="dj-tx-meta">{row.amount}</p>
              </div>
            </div>
          ))}
          <p className="dj-tx-meta">
            A pending DRC-20 transfer shows up here as a Doginal. Protect it, then send it. Dune sends with many
            recipients stay on dogecoin.dog, where the edict builder already matches the indexer.
          </p>
        </div>
      )}
    </div>
  );
}
