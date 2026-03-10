import React from 'react';
import { useDojakWallet, formatDogeAmount } from './useDojakWallet';

const WalletExample: React.FC = () => {
  const {
    address,
    isConnected,
    isConnecting,
    balance,
    network,
    error,
    connect,
    disconnect,
    signVerificationMessage,
    sendDoge,
    isWalletAvailable
  } = useDojakWallet();

  const [verificationResult, setVerificationResult] = React.useState<any>(null);
  const [sendAmount, setSendAmount] = React.useState('0.1');
  const [recipientAddress, setRecipientAddress] = React.useState('');

  const handleConnect = async () => {
    const success = await connect();
    if (success) {
      console.log('Wallet connected successfully!');
    }
  };

  const handleVerify = async () => {
    const result = await signVerificationMessage();
    if (result) {
      setVerificationResult(result);
      console.log('Verification signature:', result);

      // In a real app, send this to your backend:
      // await submitWalletVerification(result);
    }
  };

  const handleSendDoge = async () => {
    if (!recipientAddress || !sendAmount) return;

    try {
      const satoshis = Math.floor(parseFloat(sendAmount) * 100000000);
      const txid = await sendDoge(recipientAddress, satoshis);
      alert(`Transaction sent! TXID: ${txid}`);
    } catch (error: any) {
      alert(`Transaction failed: ${error.message}`);
    }
  };

  if (!isWalletAvailable) {
    return (
      <div className="wallet-notice">
        <h2>Dojak Wallet Required</h2>
        <p>Please install the Dojak wallet extension.</p>
        <a
          href="https://github.com/dojak-wallet/extension"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download Dojak Wallet
        </a>
      </div>
    );
  }

  return (
    <div className="wallet">
      <h1>Launchpad dApp</h1>

      {!isConnected ? (
        <div className="connect-section">
          <h2>Connect Your Wallet</h2>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="connect-btn"
          >
            {isConnecting ? 'Connecting...' : 'Connect Dojak Wallet'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      ) : (
        <div className="wallet-dashboard">
          <div className="wallet-info">
            <h2>Wallet Connected</h2>
            <p><strong>Address:</strong> {address}</p>
            <p><strong>Network:</strong> {network}</p>
            {balance && (
              <div className="balance-info">
                <p><strong>Available Balance:</strong> {formatDogeAmount(balance.availableBalance)} DOGE</p>
                <p><strong>Total Balance:</strong> {formatDogeAmount(balance.totalBalance)} DOGE</p>
              </div>
            )}
            <button onClick={disconnect} className="disconnect-btn">
              Disconnect Wallet
            </button>
          </div>

          <div className="verification-section">
            <h3>Verify Wallet Ownership</h3>
            <button onClick={handleVerify} className="verify-btn">
              Sign Verification Message
            </button>
            {verificationResult && (
              <div className="verification-result">
                <h4>Verification Complete!</h4>
                <details>
                  <summary>View Details</summary>
                  <pre>{JSON.stringify(verificationResult, null, 2)}</pre>
                </details>
              </div>
            )}
          </div>

          <div className="transaction-section">
            <h3>Send DOGE (Test Transaction)</h3>
            <div className="send-form">
              <input
                type="text"
                placeholder="Recipient Address (P...)"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
              />
              <input
                type="number"
                step="0.00000001"
                placeholder="Amount (DOGE)"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
              />
              <button
                onClick={handleSendDoge}
                disabled={!recipientAddress || !sendAmount}
                className="send-btn"
              >
                Send DOGE
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .wallet {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
        }

        .connect-section, .wallet-dashboard {
          border: 1px solid #ddd;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }

        .connect-btn, .disconnect-btn, .verify-btn, .send-btn {
          background: #ff6600;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        }

        .connect-btn:hover, .verify-btn:hover, .send-btn:hover {
          background: #e55a00;
        }

        .disconnect-btn {
          background: #dc3545;
        }

        .disconnect-btn:hover {
          background: #c82333;
        }

        .error {
          color: #dc3545;
          margin-top: 10px;
        }

        .wallet-info p {
          margin: 5px 0;
        }

        .balance-info {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0;
        }

        .send-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .send-form input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .verification-result {
          margin-top: 10px;
          padding: 10px;
          background: #d4edda;
          border: 1px solid #c3e6cb;
          border-radius: 5px;
        }

        .verification-result pre {
          background: white;
          padding: 10px;
          border-radius: 3px;
          overflow-x: auto;
          font-size: 12px;
        }

        .wallet-notice {
          text-align: center;
          padding: 40px;
          border: 1px solid #ddd;
          border-radius: 8px;
        }

        .wallet-notice a {
          color: #ff6600;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
};

export default WalletExample;
