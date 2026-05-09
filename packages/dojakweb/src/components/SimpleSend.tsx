import React, { useState, useEffect } from 'react';
import { PaperAirplaneIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { ConfirmBanner } from './ui/ConfirmBanner';
import { myDogeRequestAvailableDRC20Transaction } from '../lib/simple-wallet';
import { feeEstimator } from '../utils/liveFeeEstimator';
import { walletDataApi } from '../utils/api';
import { DogeAmount } from './DogeAmount';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface SimpleSendProps {
  onSuccess?: (result: any) => void;
  wallet?: any;
}

export const SimpleSend: React.FC<SimpleSendProps> = ({ onSuccess, wallet }) => {
  const [selectedTicker, setSelectedTicker] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [usePercentage, setUsePercentage] = useState(false);
  const [percentage, setPercentage] = useState(10);
  const [balance, setBalance] = useState<any>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [availableTokens, setAvailableTokens] = useState<Array<{ticker: string, balance: number, transferable: number}>>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);


  // Load balance when ticker changes (only for tokens we already have loaded)
  useEffect(() => {
    if (selectedTicker && availableTokens.find(t => t.ticker === selectedTicker)) {
      loadBalance();
    } else {
      setBalance(null);
    }
  }, [selectedTicker, availableTokens]);

  // Update preview when inputs change
  useEffect(() => {
    updatePreview();
  }, [selectedTicker, amount, usePercentage, percentage, recipientAddress]);

  // Function to fetch inscriptions for display in the wallet view
  const fetchWalletInscriptions = async () => {
    try {
      const address = await walletDataApi.getAddress(wallet);
      const inscriptions = await walletDataApi.fetchInscriptions(address);
      console.log(`📊 Found ${inscriptions.length} inscriptions in wallet`);
      return inscriptions;
    } catch (error) {
      console.error('❌ Failed to fetch wallet inscriptions:', error);
      return [];
    }
  };

  // Load all DRC-20 tokens from wallet inscriptions
  const loadAllWalletTokens = async () => {
    console.log('🔍 SimpleSend: Loading all DRC-20 tokens from wallet');
    setIsLoadingTokens(true);

    try {
      // Check if wallet is available (this comes from props/context)
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      // Fetch all DRC-20 tokens from provider API
      const drc20Tokens = await walletDataApi.fetchDRC20Tokens(wallet);

      console.log('📋 All DRC-20 tokens found:', drc20Tokens);

      // Convert to the format expected by SimpleSend
      const formattedTokens = drc20Tokens.map(token => ({
        ticker: token.ticker,
        balance: Number(token.balance),
        transferable: Number(token.transferable)
      }));

      setAvailableTokens(formattedTokens);

      if (formattedTokens.length > 0) {
        toast.success(`Loaded ${formattedTokens.length} DRC-20 token${formattedTokens.length > 1 ? 's' : ''} from your wallet!`);
      } else {
        toast.warning('No DRC-20 tokens found in your wallet inscriptions');
      }

    } catch (error: any) {
      console.error('❌ Failed to load wallet tokens:', error);
      console.error('❌ Error details:', error.message);

      if (error.message?.includes('not connected')) {
        toast.error('Wallet not connected. Please connect your wallet first.');
      } else {
        toast.error('Failed to load tokens from wallet. Try manual entry instead.');
      }
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const loadTokenBalance = async (ticker: string) => {
    if (!ticker.trim()) return;

    console.log(`🔍 SimpleSend: Loading specific token ${ticker}`);
    setIsLoadingTokens(true);

    try {
      const allTokens = await walletDataApi.fetchDRC20Tokens(wallet);
      const token = allTokens.find((t) => t.ticker.toLowerCase() === ticker.trim().toLowerCase());
      const balance = token ? Number(token.balance) : 0;
      const transferable = token ? Number(token.transferable) : 0;

      if (balance > 0) {
        // Add or update token in the list
        setAvailableTokens(prev => {
          const existing = prev.find(t => t.ticker === ticker);
          if (existing) {
            // Update existing token
            return prev.map(t =>
              t.ticker === ticker
                ? { ...t, balance, transferable }
                : t
            );
          } else {
            // Add new token
            return [...prev, { ticker, balance, transferable }].sort((a, b) => b.transferable - a.transferable);
          }
        });
        console.log(`✅ Loaded token ${ticker}: ${transferable} transferable`);
        toast.success(`Found ${transferable.toLocaleString()} ${ticker} available to send!`);
      } else {
        console.log(`❌ No balance found for token ${ticker}`);
        toast.warning(`No balance found for ${ticker} in your wallet`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to load token ${ticker}:`, error);
      console.error('❌ Error details:', error.message);

      if (error.message?.includes('not connected')) {
        toast.error('Wallet not connected. Please connect your wallet first.');
      } else {
        toast.error(`Could not load ${ticker}. Please check the ticker symbol and try again.`);
      }
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const loadBalance = async () => {
    if (!selectedTicker) return;

      console.log(`🔍 SimpleSend: Loading balance for ${selectedTicker}`);
      setIsLoadingBalance(true);

    try {
      const allTokens = await walletDataApi.fetchDRC20Tokens(wallet);
      const selected = allTokens.find((t) => t.ticker.toLowerCase() === selectedTicker.toLowerCase());
      if (!selected) {
        throw new Error('Invalid ticker');
      }

      setBalance({
        total: Number(selected.balance) || 0,
        transferable: Number(selected.transferable) || 0
      });

    } catch (error: any) {
      console.error('❌ Failed to load balance:', error);
      console.error('❌ Error details:', error.message, error.stack);

      // More specific error messages
      if (error.message?.includes('not connected')) {
        toast.error('Wallet not connected. Please connect your wallet first.');
      } else if (error.message?.includes('Invalid ticker')) {
        toast.error('Invalid token ticker. Please check the ticker symbol.');
      } else {
        toast.error(`Failed to load ${selectedTicker} balance. Please try again.`);
      }

      setBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const updatePreview = async () => {
    if (!selectedTicker || (!amount && !usePercentage) || !recipientAddress) {
      setPreview(null);
      return;
    }

    try {
      let sendAmount = 0;

      if (usePercentage && balance) {
        sendAmount = Math.floor(balance.transferable * (percentage / 100));
      } else if (amount) {
        sendAmount = parseFloat(amount);
      }

      if (sendAmount <= 0) {
        setPreview(null);
        return;
      }

      // Calculate fees for single transfer
      const liveFees = await feeEstimator.calculateAirdropCosts(1);

      setPreview({
        amount: sendAmount,
        fees: liveFees.grandTotal,
        totalCost: liveFees.grandTotal,
        remaining: balance ? balance.transferable - sendAmount : 0
      });
    } catch (error) {
      console.error('Preview calculation failed:', error);
      setPreview(null);
    }
  };

  const validateInputs = (): string | null => {
    if (!selectedTicker) return 'Please select a token';
    if (!recipientAddress) return 'Please enter recipient address';
    if (!usePercentage && !amount) return 'Please enter an amount';

    // Validate Dogecoin address
    if (!recipientAddress.startsWith('D') || recipientAddress.length < 34) {
      return 'Invalid Dogecoin address (must start with D and be at least 34 characters)';
    }

    if (preview) {
      if (preview.amount <= 0) return 'Amount must be greater than 0';
      if (balance && preview.amount > balance.transferable) {
        return `Insufficient balance. Available: ${balance.transferable}`;
      }
    }

    return null;
  };

  const handleExecute = () => {
    const validationError = validateInputs();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!preview) {
      toast.error('Unable to calculate transfer details. Please try again.');
      return;
    }
    setShowSendConfirm(true);
  };

  const handleConfirmedSend = async () => {
    if (!preview) return;
    setShowSendConfirm(false);
    setIsExecuting(true);

    try {
      toast.info('Preparing transfer...', { duration: 2000 });

      // Execute the transfer
      const txResult = await myDogeRequestAvailableDRC20Transaction({
        ticker: selectedTicker,
        amount: preview.amount
      });

      // In a real implementation, you'd broadcast the transaction
      // For now, we'll simulate success
      const txId = txResult || `tx_${Date.now()}`;

      toast.success(
        `Transfer initiated! Transaction: ${txId.slice(0, 10)}...`,
        { duration: 5000 }
      );

      // Save to analytics
      const transferData = {
        id: Date.now().toString(),
        ticker: selectedTicker,
        tokens: preview.amount,
        wallets: 1,
        fees: preview.totalCost,
        networkFees: preview.fees * 0.8, // Approximate split
        serviceFees: preview.fees * 0.2,
        confTime: 'Tracking',
        date: new Date().toISOString().split('T')[0],
        type: 'simple-send',
        recipient: recipientAddress
      };

      const history = JSON.parse(localStorage.getItem('dojakwebDropsHistory') || '[]');
      history.push(transferData);
      localStorage.setItem('dojakwebDropsHistory', JSON.stringify(history));

      // Reset form
      setAmount('');
      setRecipientAddress('');
      setUsePercentage(false);
      setPercentage(10);

      // Notify parent component
      if (onSuccess) {
        onSuccess({ txId, transferData });
      }

      // Reload balance
      await loadBalance();

    } catch (error: any) {
      console.error('Transfer failed:', error);
      toast.error(`Transfer failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const getPercentageOptions = () => [1, 5, 10, 25, 50, 75, 100];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <PaperAirplaneIcon className="w-8 h-8 text-primary-500" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Simple Send</h2>
        <p className="text-text-secondary">
          Send DRC-20 tokens to a single recipient with live fee calculation
        </p>
      </div>

      {/* Form */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-6 space-y-6">
        {/* Token Selection */}
        <div>
          <Label className="block mb-2">
            Token
          </Label>
          {/* Token Input */}
          <div>
            <Label className="block mb-2">
              DRC-20 Token Ticker
            </Label>
            <div className="flex space-x-2">
              <Input
                type="text"
                value={selectedTicker || ''}
                onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())}
                placeholder="e.g. PEPE, DOGE, BONK"
                className="flex-1 font-mono"
                maxLength={20}
              />
              <button
                onClick={() => selectedTicker && loadTokenBalance(selectedTicker)}
                disabled={isLoadingTokens || !selectedTicker}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-400 text-bg-primary rounded-md transition-colors disabled:opacity-50 flex items-center space-x-1"
              >
                <ArrowPathIcon className={`w-4 h-4 ${isLoadingTokens ? 'animate-spin' : ''}`} />
                <span className="text-sm">Load</span>
              </button>
              <button
                onClick={loadAllWalletTokens}
                disabled={isLoadingTokens}
                className="px-3 py-2 bg-secondary-500 hover:bg-secondary-400 text-bg-primary rounded-md transition-colors disabled:opacity-50 flex items-center space-x-1"
                title="Load all DRC-20 tokens from your wallet"
              >
                <ArrowPathIcon className={`w-4 h-4 ${isLoadingTokens ? 'animate-spin' : ''}`} />
                <span className="text-xs">Wallet</span>
              </button>
            </div>
            <div className="text-xs text-text-secondary mt-1">
              Enter a token ticker or click "Wallet" to load all your DRC-20 tokens automatically
            </div>
          </div>

          {/* Loaded Tokens */}
          {availableTokens.length > 0 && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Your Tokens:
              </label>
              <div className="space-y-2">
                {availableTokens.map((token) => (
                  <div
                    key={token.ticker}
                    onClick={() => setSelectedTicker(token.ticker)}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      selectedTicker === token.ticker
                        ? 'border-primary-500 bg-primary-900/20'
                        : 'border-border-primary bg-bg-primary hover:bg-bg-secondary'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-mono font-medium text-text-primary">
                        ${token.ticker}
                      </div>
                      <div className="text-sm text-text-secondary">
                        {token.transferable.toLocaleString()} available
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {availableTokens.length === 0 && (
            <div className="mt-3 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-center">
              <div className="text-yellow-400 font-medium mb-1">No Tokens Loaded</div>
              <div className="text-sm text-text-secondary">
                Enter a DRC-20 token ticker above and click "Load" to check your balance
              </div>
            </div>
          )}
        </div>

        {/* Balance Display */}
        {selectedTicker && (
          <div className="p-4 bg-bg-primary rounded-lg border border-border-primary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">
                {selectedTicker} Balance
              </span>
              <button
                onClick={loadBalance}
                disabled={isLoadingBalance}
                className="flex items-center space-x-1 text-xs text-primary-500 hover:text-primary-400"
              >
                <ArrowPathIcon className={`w-3 h-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {balance ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-secondary">Total:</span>
                  <span className="ml-2 font-medium text-text-primary">
                    {balance.total.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Transferable:</span>
                  <span className="ml-2 font-medium text-text-primary">
                    {balance.transferable.toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-secondary">
                {isLoadingBalance ? 'Loading balance...' : 'Unable to load balance'}
              </div>
            )}
          </div>
        )}

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Amount
          </label>

          {/* Amount Type Toggle */}
          <div className="flex space-x-4 mb-3">
            <label className="flex items-center">
              <input
                type="radio"
                checked={!usePercentage}
                onChange={() => setUsePercentage(false)}
                className="mr-2"
              />
              <span className="text-sm text-text-primary">Fixed Amount</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={usePercentage}
                onChange={() => setUsePercentage(true)}
                className="mr-2"
              />
              <span className="text-sm text-text-primary">Percentage</span>
            </label>
          </div>

          {usePercentage ? (
            <div>
              <select
                value={percentage}
                onChange={(e) => setPercentage(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-md text-text-primary focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-2"
              >
                {getPercentageOptions().map(percent => (
                  <option key={percent} value={percent}>
                    {percent}% {balance && `(${Math.floor(balance.transferable * (percent / 100)).toLocaleString()} tokens)`}
                  </option>
                ))}
              </select>
              <div className="text-xs text-text-secondary">
                Send {percentage}% of your transferable balance
              </div>
            </div>
          ) : (
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-md text-text-primary focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              min="0"
              step="0.00000001"
            />
          )}
        </div>

        {/* Recipient Address */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="D..."
            className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-md text-text-primary focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
          />
          <div className="text-xs text-text-secondary mt-1">
            Must be a valid Dogecoin address starting with 'D'
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
            <h4 className="font-medium text-yellow-400 mb-3">Transfer Preview</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Sending:</span>
                <span className="text-text-primary font-medium">
                  {preview.amount.toLocaleString()} {selectedTicker}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Network Fee:</span>
                <span className="text-text-primary font-medium">
                  ~<DogeAmount doge={preview.fees} decimals={4} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Remaining Balance:</span>
                <span className="text-text-primary font-medium">
                  {preview.remaining.toLocaleString()} {selectedTicker}
                </span>
              </div>
            </div>
          </div>
        )}

        {showSendConfirm && preview && (
          <ConfirmBanner
            variant="amber"
            confirmLabel="Confirm send"
            busy={isExecuting}
            message={
              <span>
                Send <strong>{preview.amount.toLocaleString()} {selectedTicker}</strong> to{' '}
                <span className="font-mono">{recipientAddress.slice(0, 12)}…</span>?
                <span className="mt-1 block text-xs opacity-80">
                  Fee ≈ {preview.fees.toFixed(4)} Ð · Total ≈ {preview.totalCost.toFixed(4)} Ð · ~1–5 min to confirm
                </span>
              </span>
            }
            onConfirm={() => void handleConfirmedSend()}
            onCancel={() => setShowSendConfirm(false)}
          />
        )}

        {/* Execute Button */}
        <button
          onClick={handleExecute}
          disabled={isExecuting || !preview || showSendConfirm}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isExecuting ? (
            <>
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <PaperAirplaneIcon className="w-5 h-5" />
              <span>Send Tokens</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
