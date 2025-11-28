import { Inscription } from '@/shared/types';
import { useI18n } from '@/ui/hooks/useI18n';
import { useDoginalsWebsite } from '@/ui/state/settings/hooks';

import { Text } from '../Text';

export function AccordingInscription({ inscription }: { inscription: Inscription }) {
  const doginalsWebsite = useDoginalsWebsite();
  const { t } = useI18n();
  return (
    <Text
      text={`${t('by_inscription')} #${inscription.inscriptionNumber} ${
        inscription.utxoConfirmation == 0 ? t('unconfirmed_inscription') : ''
      }`}
      preset="link"
      onClick={() => {
        window.open(`${doginalsWebsite}/inscription/${inscription.inscriptionId}`);
      }}
    />
  );
}
