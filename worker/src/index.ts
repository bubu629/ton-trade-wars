import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();
app.use('/api/*', cors());

app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'ton-trade-wars', network: 'testnet', time: Date.now() })
);

app.get('/api/market', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM commodities ORDER BY price ASC').all();
  return c.json({ ok: true, data: results });
});

export default app;
