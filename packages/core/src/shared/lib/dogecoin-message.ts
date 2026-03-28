const MAGIC_BYTES = Buffer.from('Dogecoin Signed Message:\n');

type DogecoinNetwork = 'mainnet' | 'testnet';

type DogecoinMessageDeps = {
  Address: any;
  PrivateKey: any;
  Networks: any;
  BufferWriter: any;
  ECDSA: any;
  Signature: any;
  sha256sha256: (value: Buffer) => Buffer;
};

let depsPromise: Promise<DogecoinMessageDeps> | null = null;

function unwrapModule<T>(module: T): any {
  return (module as any).default || (module as any);
}

async function getDogecoinMessageDeps(): Promise<DogecoinMessageDeps> {
  if (!depsPromise) {
    depsPromise = (async () => {
      const [bitcoreModule, bufferWriterModule, ecdsaModule, signatureModule, hashModule] = await Promise.all([
        import('bitcore-lib-doge'),
        import('bitcore-lib-doge/lib/encoding/bufferwriter'),
        import('bitcore-lib-doge/lib/crypto/ecdsa'),
        import('bitcore-lib-doge/lib/crypto/signature'),
        import('bitcore-lib-doge/lib/crypto/hash')
      ]);

      const bitcore = unwrapModule(bitcoreModule);

      return {
        Address: bitcore.Address,
        PrivateKey: bitcore.PrivateKey,
        Networks: bitcore.Networks,
        BufferWriter: unwrapModule(bufferWriterModule),
        ECDSA: unwrapModule(ecdsaModule),
        Signature: unwrapModule(signatureModule),
        sha256sha256: (hashModule as any).sha256sha256
      };
    })();
  }

  return depsPromise;
}

function setDefaultNetwork(Networks: any, network: DogecoinNetwork) {
  Networks.defaultNetwork = network === 'testnet' ? Networks.testnet : Networks.mainnet;
}

function magicHash(message: string, BufferWriter: any, sha256sha256: (value: Buffer) => Buffer): Buffer {
  const prefix1 = BufferWriter.varintBufNum(MAGIC_BYTES.length);
  const messageBuffer = Buffer.from(message);
  const prefix2 = BufferWriter.varintBufNum(messageBuffer.length);
  return sha256sha256(Buffer.concat([prefix1, MAGIC_BYTES, prefix2, messageBuffer]));
}

export async function signDogecoinMessage(
  message: string,
  privateKeyHex: string,
  network: DogecoinNetwork = 'mainnet'
): Promise<string> {
  const { PrivateKey, Networks, BufferWriter, ECDSA, sha256sha256 } = await getDogecoinMessageDeps();

  setDefaultNetwork(Networks, network);

  const privateKey = new PrivateKey(privateKeyHex);
  const hash = magicHash(message, BufferWriter, sha256sha256);
  const signature = ECDSA.sign(hash, privateKey, { randomK: false });

  ECDSA.calci(hash, signature, privateKey.toPublicKey());

  return signature.toCompact().toString('base64');
}

export async function verifyDogecoinMessage(
  address: string,
  message: string,
  signatureValue: string,
  network: DogecoinNetwork = 'mainnet'
): Promise<boolean> {
  try {
    const { Address, Networks, BufferWriter, ECDSA, Signature, sha256sha256 } = await getDogecoinMessageDeps();

    setDefaultNetwork(Networks, network);

    const targetAddress = Address.fromString(address);
    const signature = Signature.fromCompact(Buffer.from(signatureValue, 'base64'));
    const hash = magicHash(message, BufferWriter, sha256sha256);
    const publicKey = ECDSA.recoverPublicKey(hash, signature);
    const signatureAddress = Address.fromPublicKey(publicKey, targetAddress.network);

    if (targetAddress.toString() !== signatureAddress.toString()) {
      return false;
    }

    return ECDSA.verify(hash, signature, publicKey);
  } catch {
    return false;
  }
}
