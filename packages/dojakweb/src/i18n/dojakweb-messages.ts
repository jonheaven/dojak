import { MODAL_EN_FLAT } from './modal-en-flat';
import { MODAL_JA_FLAT } from './modal-ja-flat';
import { WALLET_UI_EN_FLAT } from './wallet-ui-en-flat';
import { WALLET_UI_JA_FLAT } from './wallet-ui-ja-flat';

export type DojakwebBundleLocale = 'en' | 'ja';

export interface MsgTree {
  [key: string]: string | MsgTree;
}

function nestFlatMessages(flat: Record<string, string>): MsgTree {
  const root: MsgTree = {};
  for (const [flatKey, value] of Object.entries(flat)) {
    const parts = flatKey.split('.');
    let cur: MsgTree = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) {
        (cur as Record<string, string | MsgTree>)[p] = value;
      } else {
        const next = (cur as Record<string, MsgTree>)[p];
        if (!next || typeof next === 'string') {
          (cur as Record<string, MsgTree>)[p] = {};
        }
        cur = (cur as Record<string, MsgTree>)[p];
      }
    }
  }
  return root;
}

const en: MsgTree = {
  wallet: {
    connect: 'Connect wallet',
    openConnectedAria: 'Open connected wallet',
    connecting: 'Connecting',
    quickPicker: {
      title: 'Wallets',
      openAria: 'Choose a wallet',
      openWallet: 'Open wallet',
      hint: 'Gold ring is the active wallet. Green is connected — tap to switch, × to disconnect.',
      other: 'Other',
      otherHint: 'Install an extension or connect a hardware wallet. USB/serial permission is only requested when you tap one.',
      getWallet: 'Get {name}',
      disconnectAria: 'Disconnect {name}',
      short: {
        browser: 'Local',
        mydoge: 'MyDoge',
        dojak: 'Dojak',
        spookydoge: 'Spooky',
        dogesoft: 'Doge Soft',
        ledger: 'Ledger',
        dogewatch: 'Watch',
      },
    },
    connectionModal: {
      eyebrow: 'Wallet connection',
      title: 'Choose a wallet',
      subtitle: 'Pick how you want to sign Dogecoin transactions for this dApp.',
      footer:
        'Your keys never leave your device. Local browser wallets use encrypted storage; hardware wallets keep keys off-device.',
      close: 'Close',
      categoryInternal: 'Internal',
      categoryExternal: 'External',
      categoryHardware: 'Hardware',
    },
    options: {
      browser: {
        title: 'Local Browser Wallet',
        subtitleHas: 'Open your encrypted browser wallet, backup flows, or HD accounts.',
        subtitleNew: 'Create or import a local browser wallet with secure encrypted storage.',
        available: 'Wallet available',
        create: 'Create wallet',
      },
      dojak: {
        title: 'Browser Extension: Dojak',
        subtitleOk: 'Native Dogecoin and Doginals extension flow.',
        subtitleInstall: 'Install the Dojak extension to continue.',
        detected: 'Detected',
        install: 'Install',
      },
      mydoge: {
        title: 'Browser Extension: MyDoge',
        subtitleOk: 'Connect with the MyDoge browser extension.',
        subtitleInstall: 'Install MyDoge to unlock browser-extension access.',
        detected: 'Detected',
        install: 'Install',
      },
      spookydoge: {
        title: 'Browser Extension: Spooky Doge',
        subtitleOk: 'Connect with Spooky Doge (window.dogecoin) used by sus.dog.',
        subtitleInstall: 'Install/enable the Spooky Doge extension to continue.',
        preferred: 'Preferred',
        detected: 'Detected',
        install: 'Install',
      },
      dogesoft: {
        title: 'Browser Extension: Doge Soft',
        subtitleOk: 'Connect with Doge Soft — phone signs, browser relays (window.dogesoft).',
        subtitleInstall: 'Install the Doge Soft extension and pair your phone to continue.',
        detected: 'Detected',
        install: 'Install',
      },
      ledger: {
        title: 'Hardware Wallet: Ledger',
        subtitle: 'Most secure: hardware-backed signing over WebUSB.',
        webusbReady: 'WebUSB ready',
        webusbRequired: 'WebUSB required',
      },
      dogewatch: {
        title: 'Hardware Wallet: Dogewatch',
        subtitle: 'Sign on your LilyGo watch — USB + confirm on device.',
        serialReady: 'Web Serial ready',
        serialRequired: 'Web Serial required (Chrome / Edge)',
      },
    },
  },
  settings: {
    display: {
      tab: 'Display',
      language: 'Language',
      currency: 'Preferred currency',
      hint: 'Uses the same browser storage as your site when you sync locale via Dojakweb host keys.',
      en: 'English',
      ja: '日本語',
    },
  },
  ...nestFlatMessages(MODAL_EN_FLAT),
  ...nestFlatMessages(WALLET_UI_EN_FLAT),
};

const ja: MsgTree = {
  wallet: {
    connect: 'ウォレット接続',
    openConnectedAria: '接続済みウォレットを開く',
    connecting: '接続中',
    quickPicker: {
      title: 'ウォレット',
      openAria: 'ウォレットを選択',
      openWallet: 'ウォレットを開く',
      hint: '金色の枠がアクティブ。緑は接続済み — タップで切替、× で切断。',
      other: 'その他',
      otherHint: '拡張機能のインストールやハードウェア接続はここから。USB / シリアル許可はタップしたときだけ聞きます。',
      getWallet: '{name} を入手',
      disconnectAria: '{name} を切断',
      short: {
        browser: 'ローカル',
        mydoge: 'MyDoge',
        dojak: 'Dojak',
        spookydoge: 'Spooky',
        dogesoft: 'Doge Soft',
        ledger: 'Ledger',
        dogewatch: 'Watch',
      },
    },
    connectionModal: {
      eyebrow: 'ウォレット接続',
      title: 'ウォレットを選択',
      subtitle: 'この dApp の Dogecoin トランザクションに署名する方法を選びます。',
      footer:
        '秘密鍵がデバイス外に出ることはありません。ブラウザウォレットは暗号化ストレージを使用し、ハードウェアウォレットはオンデバイスで鍵を保持します。',
      close: '閉じる',
      categoryInternal: '内蔵',
      categoryExternal: '拡張機能',
      categoryHardware: 'ハードウェア',
    },
    options: {
      browser: {
        title: 'ローカルブラウザウォレット',
        subtitleHas: '暗号化されたブラウザウォレット、バックアップ、HD アカウントを開きます。',
        subtitleNew: '安全な暗号化ストレージでローカルウォレットを作成またはインポートします。',
        available: 'ウォレットあり',
        create: 'ウォレット作成',
      },
      dojak: {
        title: 'ブラウザ拡張: Dojak',
        subtitleOk: 'Dogecoin と Doginals のネイティブ拡張フロー。',
        subtitleInstall: '続行するには Dojak 拡張をインストールしてください。',
        detected: '検出済み',
        install: 'インストール',
      },
      mydoge: {
        title: 'ブラウザ拡張: MyDoge',
        subtitleOk: 'MyDoge ブラウザ拡張で接続します。',
        subtitleInstall: 'ブラウザ拡張アクセスには MyDoge をインストールしてください。',
        detected: '検出済み',
        install: 'インストール',
      },
      spookydoge: {
        title: 'ブラウザ拡張: Spooky Doge',
        subtitleOk: 'Spooky Doge（window.dogecoin、sus.dog で使用）で接続します。',
        subtitleInstall: '続行するには Spooky Doge 拡張を有効化してください。',
        preferred: '推奨',
        detected: '検出済み',
        install: 'インストール',
      },
      dogesoft: {
        title: 'ブラウザ拡張: Doge Soft',
        subtitleOk: 'Doge Soft で接続 — 電話で署名、ブラウザが中継（window.dogesoft）。',
        subtitleInstall: '続行するには Doge Soft 拡張をインストールし、電話とペアリングしてください。',
        detected: '検出済み',
        install: 'インストール',
      },
      ledger: {
        title: 'ハードウェアウォレット: Ledger',
        subtitle: '最も安全: WebUSB 経由のハードウェア署名。',
        webusbReady: 'WebUSB 準備OK',
        webusbRequired: 'WebUSB が必要',
      },
      dogewatch: {
        title: 'ハードウェアウォレット: Dogewatch',
        subtitle: 'LilyGo ウォッチで署名 — USB 接続後、本体で承認。',
        serialReady: 'Web Serial 準備OK',
        serialRequired: 'Web Serial が必要（Chrome / Edge）',
      },
    },
  },
  settings: {
    display: {
      tab: '表示',
      language: '言語',
      currency: '表示通貨',
      hint: 'Dojakweb のホスト用キーで同期すると、同じブラウザ上のサイトと設定を共有します。',
      en: 'English',
      ja: '日本語',
    },
  },
  ...nestFlatMessages(MODAL_JA_FLAT),
  ...nestFlatMessages(WALLET_UI_JA_FLAT),
};

function applyVars(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

function lookup(messages: MsgTree, key: string): string {
  const parts = key.split('.');
  let current: string | MsgTree = messages;
  for (const part of parts) {
    if (typeof current !== 'object' || current == null || !(part in current)) {
      return key;
    }
    current = current[part] as string | MsgTree;
  }
  return typeof current === 'string' ? current : key;
}

export const dojakwebMessagesByLocale: Record<DojakwebBundleLocale, MsgTree> = {
  en,
  ja,
};

export function dojakwebT(
  locale: DojakwebBundleLocale,
  key: string,
  vars?: Record<string, string | number>
): string {
  let localized = lookup(dojakwebMessagesByLocale[locale], key);
  if (localized === key) {
    localized = lookup(dojakwebMessagesByLocale.en, key);
  }
  return applyVars(localized, vars);
}
