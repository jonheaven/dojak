import { useState } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import type { WalletTxInscriptionFace } from '../../lib/wallet-tx-enrichment';
import { isHtmlInscription, isTextishInscription } from '../../utils/inscription-text';
import { HtmlInscriptionThumb, TextInscriptionCardMedia } from './TextInscriptionPreview';

function faceItem(face: WalletTxInscriptionFace) {
  return {
    inscriptionId: face.inscriptionId,
    contentType: face.contentType,
    content: face.previewUrl,
    preview: face.previewUrl,
    contentBody: face.contentPreview,
  };
}

/** Square mark for a history row, or the inscription body inside the tx modal. */
export function WalletTxInscriptionPreview({
  face,
  compact = false,
}: {
  face: WalletTxInscriptionFace;
  compact?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const textual =
    Boolean(face.contentPreview) ||
    isTextishInscription(face.contentType) ||
    isHtmlInscription(face.contentType);
  const showImage = Boolean(face.previewUrl) && !textual && !imgFailed;

  if (compact) {
    if (showImage) {
      return (
        <img
          src={face.previewUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-lg object-cover"
          onError={() => setImgFailed(true)}
        />
      );
    }
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-amber-200">
        <DocumentTextIcon className="h-4 w-4" aria-hidden />
      </div>
    );
  }

  if (isHtmlInscription(face.contentType)) {
    return (
      <HtmlInscriptionThumb
        item={faceItem(face)}
        className="mx-auto h-40 w-40 overflow-hidden rounded-xl"
      />
    );
  }

  if (showImage) {
    return (
      <img
        src={face.previewUrl}
        alt={face.contentPreview || 'Inscription'}
        className="mx-auto max-h-48 w-full rounded-xl object-contain"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <TextInscriptionCardMedia
      item={faceItem(face)}
      className="mx-auto max-w-[16rem] rounded-xl"
    />
  );
}
