import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();
app.use('/api/*', cors());

// 1. 健康检查
app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'ton-trade-wars', network: 'testnet', time: Date.now() })
);

// 2. 获取市场行情
app.get('/api/market', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM commodities ORDER BY price ASC').all();
  return c.json({ ok: true, data: results });
});

// 3. 登录/获取玩家资料与持仓
app.post('/api/player', async (c) => {
  const body = await c.req.json<{
    telegram_id: string;
    username?: string;
    first_name?: string;
    wallet_address?: string;
  }>();

  if (!body.telegram_id) return c.json({ ok: false, error: 'Missing telegram_id' }, 400);

  const now = Date.now();
  let player = await c.env.DB.prepare('SELECT * FROM players WHERE telegram_id = ?')
    .bind(String(body.telegram_id))
    .first<any>();

  if (!player) {
    const id = `plr_${crypto.randomUUID().slice(0, 8)}`;
    await c.env.DB.prepare(
      `INSERT INTO players (id, telegram_id, username, first_name, coins, wallet_address, created_at, updated_at)
       VALUES (?, ?, ?, ?, 10000, ?, ?, ?)`
    )
      .bind(id, String(body.telegram_id), body.username || null, body.first_name || 'Trader', body.wallet_address || null, now, now)
      .run();
    player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<any>();
  } else if (body.wallet_address && body.wallet_address !== player.wallet_address) {
    await c.env.DB.prepare('UPDATE players SET wallet_address = ?, updated_at = ? WHERE id = ?')
      .bind(body.wallet_address, now, player.id)
      .run();
    player.wallet_address = body.wallet_address;
  }

  const { results: holdings } = await c.env.DB.prepare(
    `SELECT h.commodity_id, h.quantity, h.cost_basis, c.symbol, c.name, c.price
     FROM holdings h
     JOIN commodities c ON h.commodity_id = c.id
     WHERE h.player_id = ? AND h.quantity > 0`
  )
    .bind(player.id)
    .all();

  return c.json({ ok: true, data: { player, holdings } });
});

// 4. 买入 / 卖出交易引擎
app.post('/api/trade', async (c) => {
  const body = await c.req.json<{
    telegram_id: string;
    commodity_id: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    idempotency_key: string;
  }>();

  const qty = Math.floor(Number(body.quantity));
  if (!body.telegram_id || !body.commodity_id || !body.idempotency_key || qty <= 0) {
    return c.json({ ok: false, error: 'Invalid trade parameters' }, 400);
  }

  // 防重复提交
  const existingTx = await c.env.DB.prepare('SELECT id FROM trades WHERE idempotency_key = ?')
    .bind(body.idempotency_key)
    .first();
  if (existingTx) return c.json({ ok: false, error: 'Duplicate trade request' }, 409);

  const player = await c.env.DB.prepare('SELECT * FROM players WHERE telegram_id = ?')
    .bind(String(body.telegram_id))
    .first<any>();
  if (!player) return c.json({ ok: false, error: 'Player not found' }, 404);

  const item = await c.env.DB.prepare('SELECT * FROM commodities WHERE id = ?')
    .bind(body.commodity_id)
    .first<any>();
  if (!item) return c.json({ ok: false, error: 'Commodity not found' }, 404);

  const now = Date.now();
  const halfSpread = item.spread_pct / 2;
  const FEE_RATE = 0.005; // 0.5% 交易手续费

  if (body.side === 'BUY') {
    const maxBuy = Math.max(1, Math.floor(item.npc_stock * 0.1));
    if (qty > maxBuy) {
      return c.json({ ok: false, error: `Max buy limit is ${maxBuy} (10% of NPC stock)` }, 400);
    }

    const unitPrice = Number((item.price * (1 + halfSpread)).toFixed(2));
    const subtotal = unitPrice * qty;
    const fee = Number((subtotal * FEE_RATE).toFixed(2));
    const totalCost = Number((subtotal + fee).toFixed(2));

    if (player.coins < totalCost) {
      return c.json({ ok: false, error: 'Insufficient Game Coins' }, 400);
    }

    const holding = await c.env.DB.prepare(
      'SELECT * FROM holdings WHERE player_id = ? AND commodity_id = ?'
    )
      .bind(player.id, item.id)
      .first<any>();

    const newCoins = Number((player.coins - totalCost).toFixed(2));
    const newStock = item.npc_stock - qty;

    const batch = [
      c.env.DB.prepare('UPDATE players SET coins = ?, updated_at = ? WHERE id = ?').bind(newCoins, now, player.id),
      c.env.DB.prepare('UPDATE commodities SET npc_stock = ?, updated_at = ? WHERE id = ?').bind(newStock, now, item.id),
      c.env.DB.prepare(
        `INSERT INTO trades (id, idempotency_key, player_id, commodity_id, side, quantity, unit_price, fee, total_coins, created_at)
         VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?, ?)`
      ).bind(`trd_${crypto.randomUUID().slice(0, 8)}`, body.idempotency_key, player.id, item.id, qty, unitPrice, fee, totalCost, now),
    ];

    if (holding) {
      const totalQty = holding.quantity + qty;
      const newCostBasis = Number((((holding.quantity * holding.cost_basis) + subtotal) / totalQty).toFixed(2));
      batch.push(
        c.env.DB.prepare('UPDATE holdings SET quantity = ?, cost_basis = ?, updated_at = ? WHERE id = ?')
          .bind(totalQty, newCostBasis, now, holding.id)
      );
    } else {
      batch.push(
        c.env.DB.prepare(
          'INSERT INTO holdings (id, player_id, commodity_id, quantity, cost_basis, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(`hld_${crypto.randomUUID().slice(0, 8)}`, player.id, item.id, qty, unitPrice, now)
      );
    }

    await c.env.DB.batch(batch);
    return c.json({ ok: true, data: { side: 'BUY', qty, unitPrice, fee, totalCost, coins: newCoins } });
  }

  if (body.side === 'SELL') {
    const holding = await c.env.DB.prepare(
      'SELECT * FROM holdings WHERE player_id = ? AND commodity_id = ?'
    )
      .bind(player.id, item.id)
      .first<any>();

    if (!holding || holding.quantity < qty) {
      return c.json({ ok: false, error: 'Insufficient inventory to sell' }, 400);
    }

    const unitPrice = Number((item.price * (1 - halfSpread)).toFixed(2));
    const subtotal = unitPrice * qty;
    const fee = Number((subtotal * FEE_RATE).toFixed(2));
    const netProceeds = Number((subtotal - fee).toFixed(2));

    const newCoins = Number((player.coins + netProceeds).toFixed(2));
    const newQty = holding.quantity - qty;
    const newStock = item.npc_stock + qty;

    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE players SET coins = ?, updated_at = ? WHERE id = ?').bind(newCoins, now, player.id),
      c.env.DB.prepare('UPDATE commodities SET npc_stock = ?, updated_at = ? WHERE id = ?').bind(newStock, now, item.id),
      c.env.DB.prepare('UPDATE holdings SET quantity = ?, updated_at = ? WHERE id = ?').bind(newQty, now, holding.id),
      c.env.DB.prepare(
        `INSERT INTO trades (id, idempotency_key, player_id, commodity_id, side, quantity, unit_price, fee, total_coins, created_at)
         VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?, ?, ?)`
      ).bind(`trd_${crypto.randomUUID().slice(0, 8)}`, body.idempotency_key, player.id, item.id, qty, unitPrice, fee, netProceeds, now),
    ]);

    return c.json({ ok: true, data: { side: 'SELL', qty, unitPrice, fee, netProceeds, coins: newCoins } });
  }

  return c.json({ ok: false, error: 'Invalid side' }, 400);
});

// 5. 排行榜（按总净值排序）
app.get('/api/leaderboard', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.username, p.first_name, p.coins,
            COALESCE(SUM(h.quantity * c.price), 0) AS inventory_value,
            (p.coins + COALESCE(SUM(h.quantity * c.price), 0)) AS net_worth
     FROM players p
     LEFT JOIN holdings h ON p.id = h.player_id AND h.quantity > 0
     LEFT JOIN commodities c ON h.commodity_id = c.id
     GROUP BY p.id
     ORDER BY net_worth DESC
     LIMIT 20`
  ).all();

  return c.json({ ok: true, data: results });
});

// 6. 定时行情波动引擎（每 5 分钟执行）
async function runMarketTick(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM commodities').all<any>();
  const now = Date.now();
  const basePrices: Record<string, number> = {
    ENERGY: 120,
    ALLOY: 240,
    CHIP: 580,
    DATA: 75,
    FUEL: 160,
    CRYSTAL: 950,
  };

  const batch = results.map((item) => {
    const base = basePrices[item.symbol] || item.price;
    // 随机波动 (-6% ~ +6%) + 10% 均值回归拉力
    const randomShock = (Math.random() - 0.5) * 0.12;
    const meanReversion = ((base - item.price) / base) * 0.1;
    const nextPrice = Math.max(base * 0.4, Math.min(base * 2.5, item.price * (1 + randomShock + meanReversion)));
    const roundedPrice = Number(nextPrice.toFixed(2));
    // 缓慢补充 NPC 库存
    const nextStock = Math.min(2000, item.npc_stock + Math.floor(Math.random() * 20));

    return db
      .prepare('UPDATE commodities SET prev_price = ?, price = ?, npc_stock = ?, updated_at = ? WHERE id = ?')
      .bind(item.price, roundedPrice, nextStock, now, item.id);
  });

  if (batch.length > 0) await db.batch(batch);
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(runMarketTick(env.DB));
  },
};
