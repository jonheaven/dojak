import { HDNodeWallet, Mnemonic } from 'ethers';

import { DOGEOS_DERIVATION_PATH } from '../constant/dogeos';

export function deriveDogeOsAddressFromMnemonic(mnemonic: string, derivationPath = DOGEOS_DERIVATION_PATH): string {
  const phrase = mnemonic.trim().toLowerCase();
  if (!phrase) throw new Error('Mnemonic is required');

  const seedMnemonic = Mnemonic.fromPhrase(phrase);
  const wallet = HDNodeWallet.fromMnemonic(seedMnemonic, derivationPath);
  return wallet.address;
}
