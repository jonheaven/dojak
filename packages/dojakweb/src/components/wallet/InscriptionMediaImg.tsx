'use client';

import { useEffect, useMemo, useState } from 'react';
import { inscriptionContentCandidates } from '../../lib/inscription-media';

type Props = {
  inscriptionId?: string | null;
  content?: string | null;
  preview?: string | null;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
};

/** NFT thumb that falls through Doggy CDN / MyDoge when dogex /api/indexer is 530. */
export function InscriptionMediaImg({
  inscriptionId,
  content,
  preview,
  alt = '',
  className,
  loading = 'lazy',
}: Props) {
  const urls = useMemo(
    () => inscriptionContentCandidates({ inscriptionId, content, preview }),
    [inscriptionId, content, preview],
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
  }, [inscriptionId, content, preview]);
  const src = urls[Math.min(i, Math.max(0, urls.length - 1))] || '';
  if (!src) {
    return <div className={className} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        setI((n) => (n + 1 < urls.length ? n + 1 : n));
      }}
    />
  );
}
