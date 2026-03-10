import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Load environment variables
dotenv.config();

import { errorHandler } from './middleware/errorHandler.js';
import { faucetRouter } from './routes/faucet.js';

const app = new Hono();

// Global middleware
app.use('*', cors({
  origin: ['chrome-extension://*', 'http://localhost:*', 'https://wzrd.dog'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use('*', logger());
app.use('*', errorHandler);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.route('/api/v1/faucet', faucetRouter);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Dojak API',
    version: '1.0.0',
    description: 'Official Dojak Wallet API Server',
    endpoints: {
      health: '/health',
      faucet: '/api/v1/faucet'
    }
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  }, 404);
});

const port = parseInt(process.env.PORT || '3001');

console.log(`🚀 Dojak API Server starting on port ${port}`);
console.log(`📚 API Documentation: http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port
});
