import { Hono } from 'hono';

const router = new Hono();

/** This process is not a chain index. Balances and listings live on dogex. */
router.all('/*', (c) =>
  c.json(
    {
      error: 'not_an_indexer',
      indexer: 'https://dogex.command.dog',
    },
    404,
  ),
);

export default router;
