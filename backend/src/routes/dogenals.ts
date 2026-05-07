import { Hono } from 'hono';

const router = new Hono();

// Placeholder for Dogenals API endpoints
// TODO: Implement indexer for DRC-20, Universal DRC-20, ÐMP, etc.

router.get('/tokens', (c) => {
  // Return list of Dogenals tokens
  return c.json({ tokens: [] });
});

router.get('/listings', (c) => {
  // Return ÐMP listings
  return c.json({ listings: [] });
});

export default router;
