import { BrowserWallet } from '../lib/browser-wallet';
import type { IntentPayload, MarketplaceSigner } from '../types/wallet';

export class BrowserWalletSigner implements MarketplaceSigner {
  mode = 'local_browser_wallet' as const;

  private readonly wallet: BrowserWallet;
  private password?: string;
  private connectedAddress: string | null = null;

  constructor(wallet?: BrowserWallet, password?: string) {
    this.wallet = wallet ?? new BrowserWallet();
    this.password = password;
  }

  setPassword(password?: string): void {
    this.password = password;
  }

  async connect(): Promise<{ address: string }> {
    const loaded = await this.wallet.loadWallet(this.password);
    if (!loaded) {
      throw new Error('No browser wallet available. Create or import a wallet first.');
    }
    this.connectedAddress = loaded.address;
    return { address: loaded.address };
  }

  async disconnect(): Promise<void> {
    this.connectedAddress = null;
  }

  async getAddress(): Promise<string | null> {
    return this.connectedAddress;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.connectedAddress) {
      await this.connect();
    }
    return this.wallet.signMessage(message, this.password, this.connectedAddress ?? undefined);
  }

  async signPSBT(psbtBase64: string): Promise<string> {
    if (!this.connectedAddress) {
      await this.connect();
    }
    return this.wallet.signPSBT(psbtBase64, undefined, this.password, this.connectedAddress ?? undefined);
  }

  async signIntent<T extends Record<string, unknown>>(intent: T): Promise<string> {
    if (!this.connectedAddress) {
      await this.connect();
    }
    const signed = await this.wallet.signIntent(
      intent as unknown as IntentPayload,
      this.password,
      this.connectedAddress ?? undefined
    );
    return signed.signature;
  }
}
