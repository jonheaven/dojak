import { beforeEach, describe, expect, it } from 'vitest';

import { BrowserWallet, isPlaintextMigrationRequiredError } from './browser-wallet';
import { looksLikeSecureStorageEnvelope } from './secureStorage';
import type { SeedMaterial, WalletData } from '../types/wallet';

const DOGE_ADDR_RE = /^D[1-9A-HJ-NP-Za-km-z]{25,33}$/;
const WIF_RE = /^[Q6][1-9A-HJ-NP-Za-km-z]{51}$/;
const PASSWORD = 'S3cur3P@ssw0rd!';
const TEST_ITERATIONS = 50_000;

function localStorageDump(): string {
  const parts: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    parts.push(`${key}=${localStorage.getItem(key) ?? ''}`);
  }
  return parts.join('\n');
}

function assertNoPlaintextSecrets(wallet: WalletData & { mnemonic?: string }) {
  const dump = localStorageDump();
  if (wallet.mnemonic) {
    expect(dump).not.toContain(wallet.mnemonic);
  }
  expect(dump).not.toContain(wallet.privateKey);
  expect(localStorage.getItem(`wallet_mnemonic_${wallet.address}`)).toBeNull();
  expect(localStorage.getItem(`dojakweb_wallet_unencrypted_${wallet.address}`)).toBeNull();
  expect(localStorage.getItem('dojakweb_wallet')).toBeNull();
}

describe('BrowserWallet persist contract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generate + import refuse persist without a password', async () => {
    const storage = new BrowserWallet();
    const created = await BrowserWallet.generateWallet('mainnet');
    await expect(storage.saveWallet(created)).rejects.toThrow(/password/i);

    const imported = await BrowserWallet.importFromMnemonic(created.mnemonic!, '', 'mainnet');
    await expect(storage.saveWallet(imported)).rejects.toThrow(/password/i);
    expect(localStorage.getItem(`wallet_mnemonic_${created.address}`)).toBeNull();
    expect(localStorage.getItem(`dojakweb_wallet_unencrypted_${created.address}`)).toBeNull();
  });

  it('after save, localStorage has no mnemonic/WIF substrings', async () => {
    const storage = new BrowserWallet();
    const created = await BrowserWallet.generateWallet('mainnet');
    const seedMaterial: SeedMaterial = { mnemonic: created.mnemonic!, passphrase: '' };

    await storage.saveWallet(created, PASSWORD, { seedMaterial, pbkdf2Iterations: TEST_ITERATIONS });
    assertNoPlaintextSecrets(created);

    const listRaw = localStorage.getItem('dojakweb_wallets') ?? '';
    expect(listRaw).not.toContain('privateKey');
    expect(listRaw).not.toContain(created.privateKey);
    expect(listRaw).not.toContain(created.mnemonic!);
  });

  it('encrypted blob decrypts with password and fails with the wrong password', async () => {
    const storage = new BrowserWallet();
    const created = await BrowserWallet.generateWallet('mainnet');
    const seedMaterial: SeedMaterial = { mnemonic: created.mnemonic!, passphrase: '' };

    await storage.saveWallet(created, PASSWORD, { seedMaterial, pbkdf2Iterations: TEST_ITERATIONS });
    const loaded = await storage.loadWallet(PASSWORD, created.address);
    const rawRecord = localStorage.getItem(`dojakweb_wallet_encrypted_${created.address}`);
    const parsedRecord = JSON.parse(rawRecord || '{}') as { encrypted?: string };

    expect(loaded?.address).toBe(created.address);
    expect(loaded?.privateKey).toBe(created.privateKey);
    expect(looksLikeSecureStorageEnvelope(parsedRecord.encrypted || '')).toBe(true);
    await expect(storage.loadWallet('wrong-password', created.address)).rejects.toThrow();
  });

  it('migrates wallet_mnemonic_ + unencrypted blob, then signing works after unlock', async () => {
    const storage = new BrowserWallet();
    const created = await BrowserWallet.generateWallet('mainnet');

    localStorage.setItem(
      `dojakweb_wallet_unencrypted_${created.address}`,
      JSON.stringify({
        address: created.address,
        privateKey: created.privateKey,
        network: created.network,
        publicKey: created.publicKey,
        createdAt: created.createdAt,
        walletSource: created.walletSource,
      } satisfies WalletData),
    );
    localStorage.setItem(`wallet_mnemonic_${created.address}`, created.mnemonic!);
    localStorage.setItem(
      'dojakweb_wallet',
      JSON.stringify({
        address: created.address,
        privateKey: created.privateKey,
        network: created.network,
      }),
    );
    localStorage.setItem(
      'dojakweb_wallets',
      JSON.stringify([
        {
          address: created.address,
          network: created.network,
          privateKey: created.privateKey,
          encrypted: false,
        },
      ]),
    );
    localStorage.setItem('dojakweb_wallet_current', created.address);

    expect(BrowserWallet.hasPendingPlaintextMigration()).toBe(true);
    const listedBefore = await storage.listWallets();
    expect(JSON.stringify(listedBefore)).not.toContain('"privateKey"');
    expect(localStorage.getItem('dojakweb_wallets')).not.toContain('privateKey');
    await expect(storage.loadWallet(undefined, created.address)).rejects.toSatisfy(
      (error: unknown) => isPlaintextMigrationRequiredError(error) || /password/i.test(String(error)),
    );

    const migrated = await storage.migratePlaintextSecrets(PASSWORD, { pbkdf2Iterations: TEST_ITERATIONS });
    expect(migrated[0]?.address).toBe(created.address);
    expect(BrowserWallet.hasPendingPlaintextMigration()).toBe(false);
    assertNoPlaintextSecrets(created);

    const listed = await storage.listWallets();
    expect(JSON.stringify(listed)).not.toContain('privateKey');
    expect(listed.some((row) => (row as WalletData).privateKey)).toBe(false);

    const unlocked = await storage.loadWallet(PASSWORD, created.address);
    expect(unlocked?.privateKey).toBe(created.privateKey);
    const signature = await storage.signMessage('migrate-unlock', PASSWORD, created.address);
    expect(signature.length).toBeGreaterThan(40);
  });

  it('list JSON never includes privateKey after encrypted persist', async () => {
    const storage = new BrowserWallet();
    const created = await BrowserWallet.generateWallet('mainnet');
    await storage.saveWallet(created, PASSWORD, { pbkdf2Iterations: TEST_ITERATIONS });
    const listed = await storage.listWallets();
    expect(listed).toHaveLength(1);
    expect(listed[0].address).toMatch(DOGE_ADDR_RE);
    expect(JSON.stringify(listed)).not.toContain('privateKey');
    expect(JSON.stringify(listed)).not.toContain(created.privateKey);
    expect(localStorage.getItem('dojakweb_wallets')).not.toContain('privateKey');
  });

  it('does not persist WIF or mnemonic when generating a wallet', async () => {
    const created = await BrowserWallet.generateWallet('mainnet');
    expect(created.address).toMatch(DOGE_ADDR_RE);
    expect(created.privateKey).toMatch(WIF_RE);
    expect(created.mnemonic?.trim().split(/\s+/)).toHaveLength(12);
    expect(localStorage.getItem(`wallet_mnemonic_${created.address}`)).toBeNull();
    expect(localStorage.getItem(`dojakweb_wallet_unencrypted_${created.address}`)).toBeNull();
    expect(localStorageDump()).not.toContain(created.privateKey);
    expect(localStorageDump()).not.toContain(created.mnemonic!);
  });
});
