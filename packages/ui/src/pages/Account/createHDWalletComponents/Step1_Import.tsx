import { useEffect, useMemo, useState } from 'react';

import { OW_HD_PATH } from '@dojak/core/constant';
import { AddressType, RestoreWalletType } from '@dojak/core/types';
import { Button, Column, Radio, RadioGroup, Row, Text } from '@dojak/ui/components';
import { useTools } from '@dojak/ui/components/ActionComponent';
import { FooterButtonContainer } from '@dojak/ui/components/FooterButtonContainer';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import {
  ContextData,
  TabType,
  UpdateContextDataParams,
  WordsType
} from '@dojak/ui/pages/Account/createHDWalletComponents/types';
import { useNavigate } from '@dojak/ui/pages/MainRoute';
import { useCreateAccountCallback } from '@dojak/ui/state/global/hooks';
import { validateMnemonic } from '@dojak/ui/utils/bitcoin-utils';
import { t as tStatic } from '@unisat/i18n';

import '../../../pages/wallet-surfaces.css';

const getWords12Item = () => ({
  key: WordsType.WORDS_12,
  label: tStatic('12_words'),
  count: 12
});

const getWords24Item = () => ({
  key: WordsType.WORDS_24,
  label: tStatic('24_words'),
  count: 24
});

function wordCountFor(wordsType: WordsType, allows24: boolean) {
  return wordsType === WordsType.WORDS_24 && allows24 ? 24 : 12;
}

export function Step1_Import({
  contextData,
  updateContextData
}: {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}) {
  const [draft, setDraft] = useState(contextData.mnemonics || '');
  const [disabled, setDisabled] = useState(true);
  const { t } = useI18n();

  const wordsItems = useMemo(() => {
    if (
      contextData.restoreWalletType === RestoreWalletType.OW ||
      contextData.restoreWalletType === RestoreWalletType.XVERSE
    ) {
      return [getWords12Item()];
    }
    return [getWords12Item(), getWords24Item()];
  }, [contextData.restoreWalletType]);

  const allows24 = wordsItems.length > 1;
  const expectedCount = wordCountFor(contextData.wordsType, allows24);
  const [keys, setKeys] = useState<string[]>(() => new Array(expectedCount).fill(''));

  const applyPhrase = (raw: string, wordsType = contextData.wordsType) => {
    setDraft(raw);
    const parts = raw.trim() ? raw.trim().split(/\s+/) : [];
    let nextType = wordsType;
    if (allows24 && parts.length > 12) {
      nextType = WordsType.WORDS_24;
    }
    if (nextType !== contextData.wordsType) {
      updateContextData({ wordsType: nextType });
    }
    const count = wordCountFor(nextType, allows24);
    const next = new Array(count).fill('');
    parts.slice(0, count).forEach((word, index) => {
      next[index] = word.toLowerCase();
    });
    setKeys(next);
  };

  useEffect(() => {
    const hasEmpty = keys.some((key) => key === '');
    const mnemonic = keys.join(' ');
    setDisabled(hasEmpty || !validateMnemonic(mnemonic));
  }, [keys]);

  const createAccount = useCreateAccountCallback();
  const navigate = useNavigate();
  const tools = useTools();

  const onNext = async () => {
    try {
      const mnemonics = keys.join(' ');
      if (contextData.restoreWalletType === RestoreWalletType.OW) {
        await createAccount(mnemonics, OW_HD_PATH, '', AddressType.P2PKH, 1);
        navigate('MainScreen');
      } else {
        updateContextData({ mnemonics, tabType: TabType.STEP3 });
      }
    } catch (e) {
      tools.toastError((e as Error).message);
    }
  };

  const filled = keys.filter((key) => key !== '').length;

  return (
    <Column gap="lg">
      <Text text={t('secret_recovery_phrase')} preset="title-bold" textCenter />
      <Text text="Paste the 12 or 24 words from your backup. They stay on this device." preset="sub" textCenter />

      {wordsItems.length > 1 ? (
        <Row justifyCenter>
          <RadioGroup
            onChange={(value) => {
              const wordsType = value as WordsType;
              updateContextData({ wordsType });
              applyPhrase('', wordsType);
            }}
            value={contextData.wordsType}
          >
            {wordsItems.map((item) => (
              <Radio key={item.key} value={item.key}>
                {item.label}
              </Radio>
            ))}
          </RadioGroup>
        </Row>
      ) : null}

      <textarea
        className="dj-seed"
        value={draft}
        autoFocus
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="word1 word2 word3 …"
        onChange={(event) => applyPhrase(event.target.value)}
        onKeyDown={(event) => {
          if (!disabled && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void onNext();
          }
        }}
      />
      <div className={`dj-seed-meta${disabled ? '' : ' is-ok'}`}>
        <span>
          {filled} / {expectedCount} words
        </span>
        <span>{disabled ? 'Check the phrase' : 'Phrase looks valid'}</span>
      </div>

      <FooterButtonContainer>
        <Button disabled={disabled} text={t('continue')} preset="primary" onClick={() => void onNext()} />
      </FooterButtonContainer>
    </Column>
  );
}
