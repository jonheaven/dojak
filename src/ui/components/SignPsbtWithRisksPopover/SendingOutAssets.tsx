import BigNumber from 'bignumber.js';

import { CharmsBalance, DecodedPsbt, DuneBalance, Inscription } from '@/shared/types';
import { useI18n } from '@/ui/hooks/useI18n';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { colors } from '@/ui/theme/colors';

import { Column } from '../Column';
import { Icon } from '../Icon';
import InscriptionPreview from '../InscriptionPreview';
import { Popover } from '../Popover';
import { Row } from '../Row';
import { Text } from '../Text';

export const SendingOutAssets = ({ decodedPsbt, onClose }: { decodedPsbt: DecodedPsbt; onClose: () => void }) => {
  const currentAccount = useCurrentAccount();
  const { t } = useI18n();

  const inscriptionMap: {
    [key: string]: {
      data: Inscription;
      from: string;
      to: string;
    };
  } = {};
  for (const id in decodedPsbt.inscriptions) {
    inscriptionMap[id] = {
      data: decodedPsbt.inscriptions[id],
      from: '',
      to: ''
    };
  }

  const arc20BalanceIn: {
    [key: string]: number;
  } = {};

  const arc20BalanceOut: {
    [key: string]: number;
  } = {};

  const drc20BalanceIn: {
    [key: string]: BigNumber;
  } = {};

  const drc20BalanceOut: {
    [key: string]: BigNumber;
  } = {};

  const dunesBalanceIn: {
    [key: string]: BigNumber;
  } = {};

  const dunesBalanceOut: {
    [key: string]: BigNumber;
  } = {};

  const CharmsBalanceIn: {
    [key: string]: BigNumber;
  } = {};

  const CharmsBalanceOut: {
    [key: string]: BigNumber;
  } = {};

  decodedPsbt.inputInfos.forEach((inputInfo) => {
    inputInfo.inscriptions.forEach((ins) => {
      inscriptionMap[ins.inscriptionId].from = inputInfo.address;
      if (inputInfo.address === currentAccount?.address) {
        const info = decodedPsbt.inscriptions[ins.inscriptionId];
        if (info.drc20) {
          const ticker = info.drc20.tick;
          drc20BalanceIn[ticker] = drc20BalanceIn[ticker] || BigNumber(0);
          drc20BalanceIn[ticker] = drc20BalanceIn[ticker].plus(new BigNumber(info.drc20.amt));
        }
      }
    });
    if (inputInfo.address === currentAccount?.address) {
      inputInfo.dunes?.forEach((dune) => {
        const key = dune.duneid;
        dunesBalanceIn[key] = dunesBalanceIn[key] || BigNumber(0);
        dunesBalanceIn[key] = dunesBalanceIn[key].plus(new BigNumber(dune.amount));
      });

      inputInfo.Charms?.forEach((charm) => {
        const key = charm.charmsid;
        CharmsBalanceIn[key] = CharmsBalanceIn[key] || BigNumber(0);
        CharmsBalanceIn[key] = CharmsBalanceIn[key].plus(new BigNumber(charm.amount));
      });
    }
  });

  decodedPsbt.outputInfos.forEach((outputInfo) => {
    outputInfo.inscriptions.forEach((ins) => {
      inscriptionMap[ins.inscriptionId].to = outputInfo.address;
      if (outputInfo.address === currentAccount?.address) {
        const info = decodedPsbt.inscriptions[ins.inscriptionId];
        if (info.drc20) {
          const ticker = info.drc20.tick;
          drc20BalanceOut[ticker] = drc20BalanceOut[ticker] || BigNumber(0);
          drc20BalanceOut[ticker] = drc20BalanceOut[ticker].plus(new BigNumber(info.drc20.amt));
        }
      }
    });

    if (outputInfo.address === currentAccount?.address) {
      outputInfo.dunes?.forEach((dune) => {
        const key = rune.duneid;
        dunesBalanceOut[key] = dunesBalanceOut[key] || BigNumber(0);
        dunesBalanceOut[key] = dunesBalanceOut[key].plus(new BigNumber(dune.amount));
      });

      outputInfo.Charms?.forEach((charm) => {
        const key = charm.charmsid;
        CharmsBalanceOut[key] = CharmsBalanceOut[key] || BigNumber(0);
        CharmsBalanceOut[key] = CharmsBalanceOut[key].plus(new BigNumber(charm.amount));
      });
    }
  });

  // only show the inscriptions that are from current account
  const inscriptions = Object.keys(inscriptionMap)
    .map((id) => {
      return inscriptionMap[id];
    })
    .filter((v) => {
      if (v.from === currentAccount.address && v.to !== currentAccount.address) {
        return true;
      } else {
        return false;
      }
    });

  const arc20BalanceChanged: { [key: string]: number } = {};
  for (const id in arc20BalanceIn) {
    arc20BalanceChanged[id] = (arc20BalanceOut[id] || 0) - arc20BalanceIn[id];
  }

  const arc20List = Object.keys(arc20BalanceChanged)
    .filter((ticker) => arc20BalanceChanged[ticker] < 0) // Only show assets being sent out
    .map((ticker) => {
      return {
        ticker: ticker,
        amount: Math.abs(arc20BalanceChanged[ticker]) // Show absolute value
      };
    });

  const drc20BalanceChanged: { [key: string]: BigNumber } = {};
  for (const id in drc20BalanceIn) {
    drc20BalanceChanged[id] = (drc20BalanceOut[id] || BigNumber(0)).minus(drc20BalanceIn[id]);
  }

  const drc20List = Object.keys(drc20BalanceChanged)
    .filter((ticker) => drc20BalanceChanged[ticker].isNegative()) // Only show assets being sent out
    .map((ticker) => {
      return {
        ticker: ticker,
        amount: drc20BalanceChanged[ticker].abs().toString() // Show absolute value
      };
    });

  const dunesBalanceChanged: { [key: string]: { change: BigNumber; rune: DuneBalance } } = {};
  for (const id in dunesBalanceIn) {
    const change = (dunesBalanceOut[id] || BigNumber(0)).minus(dunesBalanceIn[id]);
    if (change.isNegative()) {
      // Only show assets being sent out (negative change)
      // Find the rune info from either input or output
      let runeInfo: DuneBalance | undefined;
      for (const inputInfo of decodedPsbt.inputInfos) {
        const found = inputInfo.dunes?.find((r) => r.duneid === id);
        if (found) {
          runeInfo = found;
          break;
        }
      }
      if (!runeInfo) {
        for (const outputInfo of decodedPsbt.outputInfos) {
          const found = outputInfo.dunes?.find((r) => r.duneid === id);
          if (found) {
            runeInfo = found;
            break;
          }
        }
      }
      if (duneInfo) {
        dunesBalanceChanged[id] = { change, rune: runeInfo };
      }
    }
  }

  const dunesList = Object.keys(dunesBalanceChanged).map((duneid) => {
    const { change, rune } = dunesBalanceChanged[duneid];
    return {
      duneid: duneid,
      rune: rune,
      amount: change.abs().toString() // Show absolute value
    };
  });

  const CharmsBalanceChanged: { [key: string]: { change: BigNumber; charm: CharmsBalance } } = {};
  for (const id in CharmsBalanceIn) {
    const change = (CharmsBalanceOut[id] || BigNumber(0)).minus(CharmsBalanceIn[id]);
    if (change.isNegative()) {
      // Only show assets being sent out (negative change)
      // Find the charm info from either input or output
      let charmInfo: CharmsBalance | undefined;
      for (const inputInfo of decodedPsbt.inputInfos) {
        const found = inputInfo.Charms?.find((a) => a.charmsid === id);
        if (found) {
          charmInfo = found;
          break;
        }
      }
      if (!charmInfo) {
        for (const outputInfo of decodedPsbt.outputInfos) {
          const found = outputInfo.Charms?.find((a) => a.charmsid === id);
          if (found) {
            charmInfo = found;
            break;
          }
        }
      }
      if (charmInfo) {
        CharmsBalanceChanged[id] = { change, charm: charmInfo };
      }
    }
  }

  console.log(dunesBalanceIn, dunesBalanceOut, dunesBalanceChanged);
  const CharmsList = Object.keys(CharmsBalanceChanged).map((charmsid) => {
    const { change, charm } = CharmsBalanceChanged[charmsid];
    return {
      charmsid: charmsid,
      charm: charm,
      amount: change.abs().toString() // Show absolute value
    };
  });

  console.log(dunesList, CharmsList);

  return (
    <Popover>
      <Column justifyCenter itemsCenter>
        <Row fullX justifyBetween>
          <Row />
          <Text text={t('sending_out_assets')} preset="bold" />
          <Icon
            icon="close"
            onClick={() => {
              onClose();
            }}
          />
        </Row>

        <Row fullX style={{ borderBottomWidth: 1, borderColor: colors.border }} />
        {inscriptions.length > 0 ? (
          <Column fullX>
            <Text text={`${t('inscriptions')}:`}></Text>
            <Row
              justifyBetween
              fullX
              px="md"
              py="xl"
              style={{
                backgroundColor: '#1e1a1e',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#442326'
              }}
              overflowX
            >
              {inscriptions.map((inscription, index) => {
                return (
                  <InscriptionPreview key={'inscription_sending_' + index} data={inscription.data} preset="small" />
                );
              })}
            </Row>
          </Column>
        ) : null}

        {arc20List.length > 0 ? (
          <Column fullX>
            <Text text={`${t('arc20')}:`} mt="md"></Text>
            {arc20List.map((burn, index) => {
              return (
                <Row
                  key={'arc20_sending_' + index}
                  justifyBetween
                  fullX
                  px="md"
                  py="xl"
                  style={{
                    backgroundColor: '#1e1a1e',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#442326'
                  }}
                >
                  <Row>
                    <Text text={burn.ticker} />
                  </Row>

                  <Text text={burn.amount} />
                </Row>
              );
            })}
          </Column>
        ) : null}

        {drc20List.length > 0 ? (
          <Column fullX>
            <Text text={'drc20:'} mt="md"></Text>
            {drc20List.map((burn, index) => {
              return (
                <Row
                  key={'drc20_sending_' + index}
                  justifyBetween
                  fullX
                  px="md"
                  py="xl"
                  style={{
                    backgroundColor: '#1e1a1e',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#442326'
                  }}
                >
                  <Row>
                    <Text text={burn.ticker} />
                  </Row>

                  <Text text={burn.amount} />
                </Row>
              );
            })}
          </Column>
        ) : null}

        {dunesList.length > 0 ? (
          <Column fullX>
            <Text text={`${t('dunes')}:`} mt="md"></Text>
            {dunesList.map((duneItem, index) => {
              return (
                <Row
                  key={'dunes_sending_' + index}
                  justifyBetween
                  fullX
                  px="md"
                  py="xl"
                  style={{
                    backgroundColor: '#1e1a1e',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#442326'
                  }}
                >
                  <Row>
                    <Text text={duneItem.rune.spacedDune || duneItem.rune.dune} />
                    {duneItem.dune.symbol && <Text text={` (${duneItem.dune.symbol})`} />}
                  </Row>

                  <Text
                    text={new BigNumber(duneItem.amount).div(Math.pow(10, runeItem.rune.divisibility)).toString()}
                  />
                </Row>
              );
            })}
          </Column>
        ) : null}

        {CharmsList.length > 0 ? (
          <Column fullX>
            <Text text={'Charms:'} mt="md"></Text>
            {CharmsList.map((charmItem, index) => {
              return (
                <Row
                  key={'Charms_sending_' + index}
                  justifyBetween
                  fullX
                  px="md"
                  py="xl"
                  style={{
                    backgroundColor: '#1e1a1e',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#442326'
                  }}
                >
                  <Row>
                    <Text text={charmItem.charm.name || charmItem.charm.symbol} />
                    {charmItem.charm.symbol && charmItem.charm.name !== charmItem.charm.symbol && (
                      <Text text={` (${charmItem.charm.symbol})`} />
                    )}
                  </Row>

                  <Text
                    text={new BigNumber(charmItem.amount).div(Math.pow(10, charmItem.charm.divisibility)).toString()}
                  />
                </Row>
              );
            })}
          </Column>
        ) : null}
      </Column>
    </Popover>
  );
};
