/**
 * Dogewatch hardware wallet over Web Serial (USB).
 * Protocol: docs/DOJAKWATCH_SIGNING.md in the dogewatch repo.
 */

interface DogewatchSerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
}

interface DogewatchSerialNavigator extends Navigator {
  serial: {
    requestPort: () => Promise<DogewatchSerialPort>;
    getPorts: () => Promise<DogewatchSerialPort[]>;
  };
}

export interface DogewatchAccount {
  address: string;
  walletId: string | null;
  unlocked: boolean;
  deviceVersion: string | null;
}

export interface DogewatchPingResult {
  ok: boolean;
  device?: string;
  protocol?: number;
  version?: string;
  wallet?: boolean;
  unlocked?: boolean;
  address?: string;
  wallet_id?: string;
  exportSession?: boolean;
  error?: string;
}

export type DogewatchLinkStatus =
  | 'unsupported'
  | 'idle'
  | 'authorized'
  | 'offline'
  | 'no_wallet'
  | 'locked'
  | 'ready';

export interface DogewatchProbeSnapshot {
  serialSupported: boolean;
  authorizedPorts: number;
  status: DogewatchLinkStatus;
  ping: DogewatchPingResult | null;
  checkedAt: number;
}

type JsonRecord = Record<string, unknown>;
type SignResultKey = 'signed' | 'signature';

export class DogewatchWallet {
  private port: DogewatchSerialPort | null = null;
  private lineReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readBuffer = '';
  private account: DogewatchAccount | null = null;

  static async isSupported(): Promise<boolean> {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /** Previously authorized Web Serial ports (user must grant once via connect). */
  static async authorizedPortCount(): Promise<number> {
    if (!(await DogewatchWallet.isSupported())) {
      return 0;
    }
    const serial = (navigator as DogewatchSerialNavigator).serial;
    const ports = await serial.getPorts();
    return ports.length;
  }

  /** Lightweight USB probe — does not require an unlocked wallet. */
  static async probeLink(options?: { promptUser?: boolean }): Promise<DogewatchProbeSnapshot> {
    const serialSupported = await DogewatchWallet.isSupported();
    const checkedAt = Date.now();
    if (!serialSupported) {
      return {
        serialSupported: false,
        authorizedPorts: 0,
        status: 'unsupported',
        ping: null,
        checkedAt,
      };
    }

    const authorizedPorts = await DogewatchWallet.authorizedPortCount();
    if (authorizedPorts === 0 && !options?.promptUser) {
      return {
        serialSupported: true,
        authorizedPorts: 0,
        status: 'idle',
        ping: null,
        checkedAt,
      };
    }

    const client = new DogewatchWallet();
    const ping = await client.pingStatus({ promptUser: options?.promptUser ?? false });
    await client.disconnect();

    let status: DogewatchLinkStatus = 'offline';
    if (ping.ok) {
      if (!ping.wallet) {
        status = 'no_wallet';
      } else if (!ping.unlocked) {
        status = 'locked';
      } else {
        status = 'ready';
      }
    } else if (authorizedPorts > 0) {
      status = 'authorized';
    }

    return {
      serialSupported: true,
      authorizedPorts: Math.max(authorizedPorts, options?.promptUser ? 1 : 0),
      status,
      ping,
      checkedAt,
    };
  }

  getAccount(): DogewatchAccount | null {
    return this.account;
  }

  /** Ping device over USB (works when wallet is locked — use for diagnostics). */
  async pingStatus(options?: { promptUser?: boolean }): Promise<DogewatchPingResult> {
    try {
      await this.ensureOpen(options?.promptUser ?? false);
      const ping = await this.sendCommand({ cmd: 'ping' });
      return {
        ok: Boolean(ping.ok),
        device: ping.device != null ? String(ping.device) : undefined,
        protocol: typeof ping.protocol === 'number' ? ping.protocol : undefined,
        version: ping.version != null ? String(ping.version) : undefined,
        wallet: Boolean(ping.wallet),
        unlocked: Boolean(ping.unlocked),
        address: ping.address != null ? String(ping.address) : undefined,
        wallet_id: ping.wallet_id != null ? String(ping.wallet_id) : undefined,
        exportSession: Boolean(ping.exportSession),
        error: ping.error != null ? String(ping.error) : undefined,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async fetchAddress(): Promise<string> {
    await this.ensureOpen(false);
    const resp = await this.sendCommand({ cmd: 'get_address' });
    if (!resp.ok) {
      throw new Error(String(resp.error || 'get_address failed'));
    }
    const address = String(resp.address || '');
    if (!address) {
      throw new Error('Dogewatch did not return an address');
    }
    return address;
  }

  async connect(options?: { promptUser?: boolean }): Promise<DogewatchAccount> {
    const promptUser = options?.promptUser ?? true;
    await this.ensureOpen(promptUser);

    const ping = await this.sendCommand({ cmd: 'ping' });
    if (!ping.ok) {
      throw new Error(String(ping.error || 'Dogewatch did not respond'));
    }
    if (!ping.wallet) {
      throw new Error('No wallet on Dogewatch — create one on the watch first');
    }
    if (!ping.unlocked) {
      throw new Error('Unlock Dogewatch with your PIN before connecting');
    }

    const account: DogewatchAccount = {
      address: String(ping.address || ''),
      walletId: ping.wallet_id != null ? String(ping.wallet_id) : null,
      unlocked: true,
      deviceVersion: ping.version != null ? String(ping.version) : null,
    };

    if (!account.address) {
      throw new Error('Dogewatch did not return an address');
    }

    this.account = account;
    return account;
  }

  async signPsbt(psbtHex: string): Promise<string> {
    if (!psbtHex || psbtHex.length < 16) {
      throw new Error('PSBT hex is required');
    }

    if (!this.account) {
      await this.connect({ promptUser: false });
    }

    const req = await this.sendCommand({ cmd: 'request_sign', psbt: psbtHex }, 15000);
    if (!req.ok) {
      throw new Error(String(req.error || 'Sign request failed'));
    }

    const requestId = String(req.request_id || '');
    if (!requestId) {
      throw new Error('Dogewatch did not return a request_id');
    }

    return this.pollSignResult(requestId, 'signed', 'Transaction rejected on Dogewatch');
  }

  /** Dogecoin signed-message (base64 compact). Used for Ð𝕏 VerifyDogenal challenges. */
  async signMessage(message: string): Promise<string> {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error('Message is required');
    }
    if (trimmed.length > 384) {
      throw new Error('Message is too long for Dogewatch');
    }

    if (!this.account) {
      await this.connect({ promptUser: false });
    }

    const req = await this.sendCommand(
      { cmd: 'request_sign_message', message: trimmed },
      15000
    );
    if (!req.ok) {
      throw new Error(String(req.error || 'Message sign request failed'));
    }

    const requestId = String(req.request_id || '');
    if (!requestId) {
      throw new Error('Dogewatch did not return a request_id');
    }

    return this.pollSignResult(requestId, 'signature', 'Message rejected on Dogewatch');
  }

  async disconnect(): Promise<void> {
    if (this.lineReader) {
      try {
        await this.lineReader.cancel();
      } catch {
        // Ignore reader cancel failures during teardown.
      }
      try {
        this.lineReader.releaseLock();
      } catch {
        // Reader may already be released.
      }
      this.lineReader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // Ignore close failures during disconnect.
      }
    }

    this.port = null;
    this.readBuffer = '';
    this.account = null;
  }

  private async pollSignResult(
    requestId: string,
    resultKey: SignResultKey,
    rejectLabel: string
  ): Promise<string> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const asyncResult = await this.tryReadAsyncSignResult(requestId, resultKey, rejectLabel);
      if (asyncResult) {
        return asyncResult;
      }

      const status = await this.sendCommand(
        { cmd: 'sign_status', request_id: requestId },
        5000
      );

      if (status.status === 'pending') {
        await sleep(400);
        continue;
      }

      if (status.ok && status[resultKey]) {
        return String(status[resultKey]);
      }

      throw new Error(String(status.error || rejectLabel));
    }

    throw new Error('Timed out waiting for approval on Dogewatch');
  }

  private async ensureOpen(promptUser: boolean): Promise<void> {
    if (this.port?.readable && this.port?.writable) {
      return;
    }

    if (!('serial' in navigator)) {
      throw new Error('Web Serial is not supported in this browser (use Chrome or Edge)');
    }

    const serial = (navigator as DogewatchSerialNavigator).serial;
    if (!this.port) {
      if (promptUser) {
        this.port = await serial.requestPort();
      } else {
        const ports = await serial.getPorts();
        if (!ports.length) {
          throw new Error(
            'No authorized Dogewatch port — connect USB and choose Dogewatch in the wallet picker'
          );
        }
        this.port = ports[0];
      }
    }

    if (!this.port) {
      throw new Error('Could not open Dogewatch serial port');
    }

    if (!this.port.readable || !this.port.writable) {
      await this.port.open({ baudRate: 115200 });
    }

    this.readBuffer = '';
    if (this.port.readable) {
      this.lineReader = this.port.readable.getReader();
    }
  }

  private async sendCommand(payload: JsonRecord, timeoutMs = 8000): Promise<JsonRecord> {
    await this.ensureOpen(false);
    if (!this.port?.writable) {
      throw new Error('Dogewatch serial port is not writable');
    }

    const encoder = new TextEncoder();
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(encoder.encode(`${JSON.stringify(payload)}\n`));
    } finally {
      writer.releaseLock();
    }

    const line = await this.readLine(timeoutMs);
    return JSON.parse(line) as JsonRecord;
  }

  private async tryReadAsyncSignResult(
    requestId: string,
    resultKey: SignResultKey,
    rejectLabel: string
  ): Promise<string | null> {
    const line = await this.readLine(150, false);
    if (!line) {
      return null;
    }

    let parsed: JsonRecord;
    try {
      parsed = JSON.parse(line) as JsonRecord;
    } catch {
      return null;
    }

    if (parsed.cmd !== 'sign_result' || String(parsed.request_id || '') !== requestId) {
      return null;
    }

    if (parsed.ok && parsed[resultKey]) {
      return String(parsed[resultKey]);
    }

    throw new Error(String(parsed.error || rejectLabel));
  }

  private async readLine(timeoutMs: number, required = true): Promise<string> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const nl = this.readBuffer.indexOf('\n');
      if (nl >= 0) {
        const line = this.readBuffer.slice(0, nl).trim();
        this.readBuffer = this.readBuffer.slice(nl + 1);
        if (line.length > 0) {
          return line;
        }
        continue;
      }

      if (!this.lineReader) {
        break;
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        break;
      }

      const readPromise = this.lineReader.read();
      const result = await Promise.race([
        readPromise,
        sleep(Math.min(remaining, 50)).then(() => ({ value: undefined, done: false as const })),
      ]);

      if (result.value) {
        this.readBuffer += new TextDecoder().decode(result.value);
      }
      if (result.done) {
        break;
      }
    }

    if (required) {
      throw new Error('No response from Dogewatch (timeout)');
    }
    return '';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
