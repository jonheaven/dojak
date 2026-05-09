import React, { useEffect, useRef } from 'react';
import { useLiveActivity } from '../contexts/LiveActivityContext';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useConnectedWalletAddress } from '../wallet/getConnectedWalletAddress';
import { SentinelStatus } from '../contexts/LiveActivityContext';
import { getEnv } from '../utils/env';

interface SentinelConnectorProps {
  websocketUrl?: string;
  enabled?: boolean;
}

export const SentinelConnector: React.FC<SentinelConnectorProps> = ({
  websocketUrl = 'ws://localhost:7071',
  enabled = getEnv('VITE_ENABLE_LIVE_ACTIVITY', 'false') === 'true' // Allow override via env var
}) => {
  const { network, marketplace, mint, transfer, updateSentinelStatus } = useLiveActivity();
  const { playSound } = useSoundEffects();
  const connectedAddress = useConnectedWalletAddress();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

  const connect = () => {
    try {
      updateSentinelStatus(prev => ({
        connectionAttempts: prev.connectionAttempts + 1
      }));

      const ws = new WebSocket(websocketUrl);
      wsRef.current = ws;

        ws.onopen = () => {
          console.log('🔗 Connected to Doginals Sentinel for live activity');
          updateSentinelStatus({
            isConnected: true,
            errorMessage: undefined
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Check if this is a sentinel event (has a known event type)
            const validTypes = ['market-sale', 'inscription-mint', 'inscription-transfer', 'doge-domain', 'dogemap', 'dogetag', 'dogetag-witness', 'dogetag-witness-transfer'];
            if (validTypes.includes(data.type)) {
              const now = Date.now();

              // Update last activity timestamp
              updateSentinelStatus({
                lastActivity: now
              });

              // Throttle activity to prevent spam (max 1 per 3 seconds)
              if (now - lastActivityRef.current < 3000) return;
              lastActivityRef.current = now;

              // Check if this event involves the connected user
              const address = connectedAddress;
              const isPersonal =
                address &&
                (
                  data.buyer?.toLowerCase() === address.toLowerCase() ||
                  data.seller?.toLowerCase() === address.toLowerCase() ||
                  data.to?.toLowerCase() === address.toLowerCase() ||
                  data.from?.toLowerCase() === address.toLowerCase()
                );

              // Create drawer data for detailed view
              const drawerData = {
                type: data.type,
                inscriptionId: data.inscriptionId,
                txid: data.txid,
                domain: data.domain,
                dogemapBlock: data.block,
                ticker: data.ticker,
                price: data.price,
                buyer: data.buyer,
                seller: data.seller,
                from: data.from,
                to: data.to,
                contentKnown: data.contentKnown,
                collection: data.collection,
                doginalDogId: data.doginalDogId,
                doginalDogTraits: data.doginalDogTraits,
                doginalDogRank: data.doginalDogRank,
                // Witness Dogetag specific fields
                text: data.text,
                isTransferable: data.isTransferable,
                isDoginal: data.isDoginal,
                satpoint: data.satpoint,
                source: data.source,
                hex: data.hex
              };

              // Generate engaging live activity messages
              showLiveActivityForEvent(data, Boolean(isPersonal), drawerData);
            }
          } catch (error) {
            console.warn('Failed to parse sentinel message:', error);
          }
        };

        ws.onclose = () => {
          console.log('🔌 Disconnected from Doginals Sentinel');
          updateSentinelStatus({
            isConnected: false
          });
          // Auto-reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };

        ws.onerror = (error) => {
          // Only log WebSocket errors in development
          if (process.env.NODE_ENV === 'development') {
            console.warn('Sentinel WebSocket error (service may not be running):', error);
          }
          updateSentinelStatus({
            isConnected: false,
            errorMessage: 'WebSocket connection failed'
          });
        };
      } catch (error) {
        // Only log connection failures in development
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            'Failed to connect to sentinel (service may not be running):',
            error instanceof Error ? error.message : error,
          );
        }
        // Retry connection after longer delay
        reconnectTimeoutRef.current = setTimeout(connect, 10000);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [websocketUrl, enabled, connectedAddress]);

  const showLiveActivityForEvent = (evt: any, isPersonal: boolean = false, drawerData?: any) => {
    // Play sound effects
    if (isPersonal) {
      playSound('personal');
    } else {
      switch (evt.type) {
        case "market-sale":
          playSound('marketplace');
          break;
        case "doge-domain":
          playSound('domain');
          break;
        case "dogemap":
          playSound('dogemap');
          break;
        case "inscription-transfer":
          playSound('transfer');
          break;
        case "inscription-mint":
          playSound('mint');
          break;
        case "dogetag":
          playSound('mint'); // OP_RETURN Dogetags use mint sound
          break;
        case "dogetag-witness":
          playSound('mint'); // Witness Dogetags use mint sound
          break;
        case "dogetag-witness-transfer":
          playSound('transfer'); // Transfers use transfer sound
          break;
      }
    }

    // Show toast
    switch (evt.type) {
      case "market-sale":
        marketplace(evt.message || `Inscription sold for ${evt.price || 'unknown'} Ð!`, isPersonal, drawerData);
        break;

      case "inscription-mint":
        mint(evt.message || 'New inscription minted on Dogecoin!', isPersonal, drawerData);
        break;

      case "inscription-transfer":
        transfer(evt.message || 'Inscription transferred between wallets', isPersonal, drawerData);
        break;

      case "doge-domain":
        network(evt.message || `New Doge Domain Registered: ${evt.domain || 'unknown'}`, isPersonal, drawerData);
        break;

      case "dogemap":
        network(evt.message || `New Dogemap Created: ${evt.dogemap || 'unknown'}`, isPersonal, drawerData);
        break;

      case "dogetag":
        mint(evt.message || 'New DogeTag:tx created!', isPersonal, drawerData);
        break;

      case "dogetag-witness":
        mint(evt.message || 'New Dogetag minted!', isPersonal, drawerData);
        break;

      case "dogetag-witness-transfer":
        transfer(evt.message || 'Dogetag transferred', isPersonal, drawerData);
        break;

      default:
        // Fallback for any other event types
        network(evt.message || `Network activity: ${evt.type?.replace('-', ' ') || 'unknown'}`, isPersonal, drawerData);
    }
  };

  // This component doesn't render anything visible
  return null;
};
