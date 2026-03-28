// Backend wallet verification example for BorkStarter
// This shows how to verify Dojak wallet signatures on your server

const bitcoin = require('bitcoinjs-lib');

// Verify Dojak wallet signature (ECDSA)
function verifyDojakSignature(address, message, signature) {
  try {
    // For ECDSA signatures from Dojak
    // Note: This is a simplified example. In production, use a proper crypto library

    // Remove any prefix/suffix that might be added
    const cleanSignature = signature.replace(/^0x/, '');

    // Basic validation - in production you'd use bitcoinjs-lib or similar
    // to properly verify the signature against the address

    // For now, this is a placeholder - implement proper verification
    // using the same library that Dojak uses internally

    console.log('Verifying signature for:', { address, message, signature });

    // Placeholder return - implement actual verification
    return true; // Replace with actual verification logic

  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

// Express.js route example
app.post('/api/verify-wallet', async (req, res) => {
  try {
    const { address, message, signature, timestamp } = req.body;

    // Validate required fields
    if (!address || !message || !signature) {
      return res.status(400).json({
        error: 'Missing required fields: address, message, signature'
      });
    }

    // Verify address format (Dogecoin P2PKH addresses)
    if (!address.startsWith('P') || address.length !== 34) {
      return res.status(400).json({
        error: 'Invalid Dogecoin address format'
      });
    }

    // Verify message format
    const expectedPrefix = 'Verify wallet ownership for BorkStarter';
    if (!message.startsWith(expectedPrefix)) {
      return res.status(400).json({
        error: 'Invalid verification message format'
      });
    }

    // Check timestamp (prevent replay attacks)
    const now = Date.now();
    const messageTimestamp = parseInt(message.split('Timestamp: ')[1]?.split('\\n')[0]);

    if (!messageTimestamp || Math.abs(now - messageTimestamp) > 300000) { // 5 minutes
      return res.status(400).json({
        error: 'Verification message expired or invalid timestamp'
      });
    }

    // Verify the signature
    const isValid = verifyDojakSignature(address, message, signature);

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid signature'
      });
    }

    // Check if user already exists or create new user
    let user = await User.findOne({ walletAddress: address });

    if (!user) {
      user = new User({
        walletAddress: address,
        verifiedAt: new Date(),
        lastLoginAt: new Date()
      });
    } else {
      user.lastLoginAt = new Date();
    }

    await user.save();

    // Generate session token
    const sessionToken = generateSessionToken(user);

    res.json({
      success: true,
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        verifiedAt: user.verifiedAt
      },
      token: sessionToken
    });

  } catch (error) {
    console.error('Wallet verification error:', error);
    res.status(500).json({
      error: 'Internal server error during verification'
    });
  }
});

// Middleware to verify authenticated requests
function requireWalletAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  try {
    const decoded = verifySessionToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Protected route example
app.get('/api/user/profile', requireWalletAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({
    walletAddress: user.walletAddress,
    // Other user data...
  });
});

// Launchpad interaction example
app.post('/api/launchpad/participate', requireWalletAuth, async (req, res) => {
  const { projectId, amount } = req.body;

  // Verify user has sufficient balance (you might want to check on-chain)
  // This is where you'd integrate with your DOGE balance checking

  const participation = new LaunchParticipation({
    userId: req.user.id,
    projectId,
    amount,
    walletAddress: req.user.walletAddress,
    status: 'pending'
  });

  await participation.save();

  res.json({
    success: true,
    participationId: participation._id
  });
});

module.exports = { verifyDojakSignature };

// Note: For production implementation, you should:

// 1. Use proper cryptographic libraries for signature verification
// 2. Implement rate limiting to prevent abuse
// 3. Store verification attempts for audit trails
// 4. Use HTTPS for all wallet communication
// 5. Implement proper session management
// 6. Add comprehensive input validation
// 7. Monitor for suspicious activity patterns

// Example using bitcoinjs-lib for proper verification (you'll need to adapt this):
/*
const bitcoin = require('bitcoinjs-lib');

function verifyBIP322Signature(address, message, signature) {
  try {
    // Decode the address to get the public key hash
    const decoded = bitcoin.address.fromBase58Check(address);
    const pubKeyHash = decoded.hash;

    // Create the message to verify
    const messageToVerify = Buffer.from(message);

    // Decode the signature
    const sigBuffer = Buffer.from(signature, 'hex');

    // Verify using bitcoin message verification
    // Note: This is simplified - actual BIP322 verification is more complex
    return bitcoin.message.verify(message, address, signature);
  } catch (error) {
    console.error('BIP322 verification failed:', error);
    return false;
  }
}
*/
