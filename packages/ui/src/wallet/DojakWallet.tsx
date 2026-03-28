import { FormEvent, useMemo, useState } from 'react';

import { dogecoinKeyrings } from '@dojak/core';

import { useWalletCore } from './WalletCoreContext';

export function DojakWallet() {
  const walletCore = useWalletCore();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<string>('0.00000000');
  const [status, setStatus] = useState<string>('Ready');

  const keyringLabel = useMemo(() => {
    return dogecoinKeyrings?.DogecoinKeyringService ? 'Dogecoin keyring connected' : 'Keyring unavailable';
  }, []);

  const refreshBalance = async () => {
    if (!walletCore.getBalance) {
      setStatus('No balance adapter connected');
      return;
    }
    const nextBalance = await walletCore.getBalance();
    setBalance(nextBalance?.amount?.toString?.() ?? '0.00000000');
    setStatus('Balance updated');
  };

  const onSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!walletCore.sendDogecoin) {
      setStatus('No send adapter connected');
      return;
    }
    const response = await walletCore.sendDogecoin({
      to,
      amount: Number(amount || '0')
    });
    setStatus(`Transaction queued: ${response.txid}`);
    setTo('');
    setAmount('');
  };

  return (
    <main className="wallet-safe-area min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-[402px] flex-col gap-4 px-4 py-4">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Dojak Wallet</p>
          <h1 className="text-xl font-semibold">Dogecoin</h1>
          <p className="mt-1 text-sm text-zinc-400">{keyringLabel}</p>
        </header>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Balance</p>
          <p className="mt-2 text-3xl font-semibold">{balance} DOGE</p>
          <button
            type="button"
            onClick={refreshBalance}
            className="mt-4 rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-zinc-900">
            Refresh
          </button>
        </article>

        <form onSubmit={onSend} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Send</p>
          <label className="mt-3 block text-sm text-zinc-300">
            To
            <input
              required
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              placeholder="D..."
            />
          </label>
          <label className="mt-3 block text-sm text-zinc-300">
            Amount
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              placeholder="0.00"
            />
          </label>
          <button type="submit" className="mt-4 w-full rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white">
            Send DOGE
          </button>
        </form>

        <nav className="mt-auto grid grid-cols-4 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2 text-xs text-zinc-300">
          {['Home', 'Send', 'Receive', 'Settings'].map((tab) => (
            <button key={tab} type="button" className="rounded-lg px-2 py-2 hover:bg-zinc-800">
              {tab}
            </button>
          ))}
        </nav>

        <p className="text-center text-xs text-zinc-500">{status}</p>
      </section>
    </main>
  );
}

export default DojakWallet;
