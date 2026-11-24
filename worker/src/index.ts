import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  TREASURY_WALLET: string;
};

const STORE_ITEMS = [
  {
    id: 'item_vip_fee',
    name: '⚡ 0% Fee VIP Pass',
    desc: 'Permanent 0% trading fee on all BUY/SELL orders',
    price_ton: 0.1,
    amount_nano: '100000000',
    repeatable: false,
  },
  {
    id: 'item_whale_pack',
    name: '💰 Whale Capital Pack',
    desc: 'Instant +50,000 Game Coins to dominate the market',
    price_ton: 0.2,
    amount_nano: '200000000',
    repeatable: true,
  },
  {
    id: 'item_genesis_nft',
    name: '🚀 Genesis Trader NFT',
    desc: '2x Max Order Limit + Founder Badge',
    price_ton: 0.5,
    amount_nano: '500000000',
    repeatable: false,
  },
];

const app = new Hono<{ Bindings: Bindings }>();
app.use('/api/*', cors());
app.onError((err, c) => c.json({ ok: false, error: err.message }, 500));

function getSeasonInfo() {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  // 固定每周一 00:00 UTC 切换赛季
  const epochMonday = Date.UTC(2026, 10, 23, 0, 0, 0);
  const diff = Math.max(0, now - epochMonday);
  const seasonNumber = Math.floor(diff / weekMs) + 1;
  const endsAt = epochMonday + seasonNumber * weekMs;
  const daysLeft = Math.max(1, Math.ceil((endsAt - now) / (24 * 60 * 60 * 1000)));
  return { season_number: seasonNumber, days_left: daysLeft, ends_at: endsAt };
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'trade-arena', network: 'ton', time: Date.now() })
);

// 手动/首次触发同步真实行情
app.get('/api/market/sync', async (c) => {
  const count = await runMarketTick(c.env.DB);
  return c.json({ ok: true, updated: count });
});

// 20 币种实时行情 + 最近 20 个历史价格点
app.get('/api/market', async (c) => {
  const { results: commodities } = await c.env.DB.prepare(
    'SELECT * FROM commodities ORDER BY id ASC'
  ).all<any>();
  const { results: histRows } = await c.env.DB.prepare(
    `SELECT commodity_id, price FROM (
       SELECT commodity_id, price, recorded_at,
              ROW_NUMBER() OVER (PARTITION BY commodity_id ORDER BY recorded_at DESC) AS rn
       FROM price_history
     ) WHERE rn <= 20 ORDER BY recorded_at ASC`
  ).all<any>();

  const histMap: Record<string, number[]> = {};
  for (const r of histRows) {
    if (!histMap[r.commodity_id]) histMap[r.commodity_id] = [];
    histMap[r.commodity_id].push(r.price);
  }

  const orderList = [
    'BTC','ETH','TON','SOL','BNB','XRP','DOGE','ADA','TRX','AVAX',
    'LINK','SUI','DOT','BCH','LTC','NEAR','UNI','APT','PEPE','NOT'
  ];

  const data = commodities
    .map((item) => {
      const h = histMap[item.id] || [];
      const history = h.length >= 2 ? h : [item.prev_price, item.price];
      return { ...item, history };
    })
    .sort((a, b) => orderList.indexOf(a.symbol) - orderList.indexOf(b.symbol));

  return c.json({ ok: true, data, season: getSeasonInfo() });
});

// 玩家登录 + 持仓 + 交易员档案 + 今日挑战
app.post('/api/player', async (c) => {
  const body = await c.req.json<{
    telegram_id: string;
    username?: string;
    first_name?: string;
    wallet_address?: string;
    ref_by?: string;
  }>();

  if (!body.telegram_id) return c.json({ ok: false, error: 'Missing telegram_id' }, 400);

  const tgId = String(body.telegram_id);
  const now = Date.now();
  let player = await c.env.DB.prepare('SELECT * FROM players WHERE telegram_id = ?')
    .bind(tgId)
    .first<any>();

  if (!player) {
    const id = `plr_${crypto.randomUUID().slice(0, 8)}`;
    let validReferrer: any = null;
    if (body.ref_by && String(body.ref_by) !== tgId) {
      validReferrer = await c.env.DB.prepare('SELECT id, telegram_id FROM players WHERE telegram_id = ?')
        .bind(String(body.ref_by))
        .first<any>();
    }
    await c.env.DB.prepare(
      `INSERT INTO players (id, telegram_id, username, first_name, coins, wallet_address, referred_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 10000, ?, ?, ?, ?)`
    )
      .bind(
        id,
        tgId,
        body.username || null,
        body.first_name || 'Trader',
        body.wallet_address || null,
        validReferrer ? validReferrer.telegram_id : null,
        now,
        now
      )
      .run();
    player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<any>();
  } else if (body.wallet_address && body.wallet_address !== player.wallet_address) {
    await c.env.DB.prepare('UPDATE players SET wallet_address = ?, updated_at = ? WHERE id = ?')
      .bind(body.wallet_address, now, player.id)
      .run();
    player.wallet_address = body.wallet_address;
  }

  const today = getTodayStr();
  const [
    { results: holdings },
    { results: perks },
    refRow,
    tradeStats,
    todayChallenge,
    challengeWins,
  ] = await Promise.all([
    c.env.DB.prepare(
      `SELECT h.commodity_id, h.quantity, h.cost_basis, c.symbol, c.name, c.price
       FROM holdings h
       JOIN commodities c ON h.commodity_id = c.id
       WHERE h.player_id = ? AND h.quantity > 0.00000001`
    ).bind(player.id).all<any>(),
    c.env.DB.prepare(
      `SELECT DISTINCT asset_id FROM ton_txs WHERE player_id = ? AND status = 'CONFIRMED'`
    ).bind(player.id).all<any>(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM players WHERE referred_by = ?')
      .bind(tgId)
      .first<any>(),
    c.env.DB.prepare(
      `SELECT
         COUNT(*) as total_trades,
         SUM(CASE WHEN side = 'SELL' THEN 1 ELSE 0 END) as sell_trades,
         SUM(CASE WHEN side = 'SELL' AND realized_pnl > 0 THEN 1 ELSE 0 END) as win_trades,
         COALESCE(SUM(CASE WHEN side = 'SELL' THEN realized_pnl ELSE 0 END), 0) as total_realized_pnl,
         COALESCE(SUM(CASE WHEN side = 'SELL' AND realized_pnl > 0 THEN realized_pnl ELSE 0 END), 0) as gross_profit,
         COALESCE(ABS(SUM(CASE WHEN side = 'SELL' AND realized_pnl < 0 THEN realized_pnl ELSE 0 END)), 0) as gross_loss
       FROM trades WHERE player_id = ?`
    ).bind(player.id).first<any>(),
    c.env.DB.prepare(
      'SELECT * FROM daily_challenges WHERE player_id = ? AND challenge_date = ?'
    ).bind(player.id, today).first<any>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as wins FROM daily_challenges WHERE player_id = ? AND status = 'WON'`
    ).bind(player.id).first<any>(),
  ]);

  const totalTrades = Number(tradeStats?.total_trades || 0);
  const sellTrades = Number(tradeStats?.sell_trades || 0);
  const winTrades = Number(tradeStats?.win_trades || 0);
  const winRate = sellTrades > 0 ? Number(((winTrades / sellTrades) * 100).toFixed(1)) : 0;
  const grossProfit = Number(tradeStats?.gross_profit || 0);
  const grossLoss = Number(tradeStats?.gross_loss || 0);
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 9.99 : 0;
  const disciplineScore = Math.min(
    100,
    Math.round(50 + Math.min(25, totalTrades * 2) + (winRate * 0.15) + Number(challengeWins?.wins || 0) * 5)
  );

  return c.json({
    ok: true,
    data: {
      player,
      holdings,
      owned_assets: perks.map((p) => p.asset_id),
      referral_count: refRow?.cnt || 0,
      season: getSeasonInfo(),
      profile: {
        total_trades: totalTrades,
        sell_trades: sellTrades,
        win_trades: winTrades,
        win_rate: winRate,
        total_realized_pnl: Number((tradeStats?.total_realized_pnl || 0).toFixed(2)),
        profit_factor: profitFactor,
        discipline_score: disciplineScore,
        challenge_wins: Number(challengeWins?.wins || 0),
      },
      today_challenge: todayChallenge || null,
    },
  });
});

// 每日涨跌挑战提交（免费参与，1 小时后自动结算）
app.post('/api/challenge', async (c) => {
  const body = await c.req.json<{
    telegram_id: string;
    direction: 'UP' | 'DOWN';
    commodity_id?: string;
  }>();

  if (!body.telegram_id || !['UP', 'DOWN'].includes(body.direction)) {
    return c.json({ ok: false, error: 'Invalid challenge request' }, 400);
  }

  const player = await c.env.DB.prepare('SELECT id FROM players WHERE telegram_id = ?')
    .bind(String(body.telegram_id))
    .first<any>();
  if (!player) return c.json({ ok: false, error: 'Player not found' }, 404);

  const commodityId = body.commodity_id || 'cmd_btc';
  const item = await c.env.DB.prepare('SELECT id, symbol, price FROM commodities WHERE id = ?')
    .bind(commodityId)
    .first<any>();
  if (!item) return c.json({ ok: false, error: 'Asset not found' }, 404);

  const today = getTodayStr();
  const existing = await c.env.DB.prepare(
    'SELECT id FROM daily_challenges WHERE player_id = ? AND challenge_date = ?'
  ).bind(player.id, today).first();
  if (existing) return c.json({ ok: false, error: 'Already submitted today' }, 409);

  const id = `chl_${crypto.randomUUID().slice(0, 8)}`;
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO daily_challenges (id, player_id, challenge_date, commodity_id, direction, entry_price, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`
  ).bind(id, player.id, today, item.id, body.direction, item.price, now).run();

  return c.json({
    ok: true,
    data: { id, challenge_date: today, commodity_id: item.id, symbol: item.symbol, direction: body.direction, entry_price: item.price, status: 'PENDING' },
  });
});

// 支持按 USDT 金额（amount_usdt）或按数量（quantity）进行小数份额买卖
app.post('/api/trade', async (c) => {
  const body = await c.req.json<{
    telegram_id: string;
    commodity_id: string;
    side: 'BUY' | 'SELL';
    amount_usdt?: number;
    quantity?: number;
    sell_pct?: number;
    idempotency_key: string;
  }>();

  if (!body.telegram_id || !body.commodity_id || !body.idempotency_key) {
    return c.json({ ok: false, error: 'Invalid trade parameters' }, 400);
  }

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
  if (!item) return c.json({ ok: false, error: 'Asset not found' }, 404);

  const now = Date.now();
  const halfSpread = (item.spread_pct || 0.002) / 2;
  const FEE_RATE = 0.001; // 0.1% 模拟撮合手续费（公平竞技，所有人一致）

  if (body.side === 'BUY') {
    const unitPrice = item.price * (1 + halfSpread);
    let qty = Number(body.quantity || 0);
    if (body.amount_usdt && body.amount_usdt > 0) {
      qty = body.amount_usdt / (unitPrice * (1 + FEE_RATE));
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return c.json({ ok: false, error: 'Invalid buy amount' }, 400);
    }

    const subtotal = unitPrice * qty;
    const fee = Number((subtotal * FEE_RATE).toFixed(4));
    const totalCost = Number((subtotal + fee).toFixed(2));

    if (totalCost < 1) return c.json({ ok: false, error: 'Min order is 1 USDT' }, 400);
    if (player.coins + 0.01 < totalCost) {
      return c.json({ ok: false, error: 'Insufficient Virtual USDT' }, 400);
    }

    const holding = await c.env.DB.prepare(
      'SELECT * FROM holdings WHERE player_id = ? AND commodity_id = ?'
    ).bind(player.id, item.id).first<any>();

    const newCoins = Math.max(0, Number((player.coins - totalCost).toFixed(2)));
    const batch = [
      c.env.DB.prepare('UPDATE players SET coins = ?, updated_at = ? WHERE id = ?').bind(newCoins, now, player.id),
      c.env.DB.prepare(
        `INSERT INTO trades (id, idempotency_key, player_id, commodity_id, side, quantity, unit_price, fee, total_coins, realized_pnl, created_at)
         VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?, 0, ?)`
      ).bind(`trd_${crypto.randomUUID().slice(0, 8)}`, body.idempotency_key, player.id, item.id, qty, unitPrice, fee, totalCost, now),
    ];

    if (holding) {
      const totalQty = Number(holding.quantity) + qty;
      const newCostBasis = ((Number(holding.quantity) * Number(holding.cost_basis)) + subtotal) / totalQty;
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
    ).bind(player.id, item.id).first<any>();

    if (!holding || Number(holding.quantity) <= 0.00000001) {
      return c.json({ ok: false, error: 'No position to sell' }, 400);
    }

    const ownedQty = Number(holding.quantity);
    let qty = Number(body.quantity || 0);
    if (body.sell_pct && body.sell_pct > 0) {
      qty = body.sell_pct >= 100 ? ownedQty : ownedQty * (body.sell_pct / 100);
    } else if (body.amount_usdt && body.amount_usdt > 0) {
      qty = Math.min(ownedQty, body.amount_usdt / (item.price * (1 - halfSpread)));
    }
    if (!Number.isFinite(qty) || qty <= 0 || qty > ownedQty * 1.0001) {
      return c.json({ ok: false, error: 'Insufficient position to sell' }, 400);
    }
    if (qty > ownedQty) qty = ownedQty;

    const unitPrice = item.price * (1 - halfSpread);
    const subtotal = unitPrice * qty;
    const fee = Number((subtotal * FEE_RATE).toFixed(4));
    const netProceeds = Number((subtotal - fee).toFixed(2));
    const realizedPnl = Number(((unitPrice - Number(holding.cost_basis)) * qty - fee).toFixed(2));

    const newCoins = Number((player.coins + netProceeds).toFixed(2));
    const newQty = ownedQty - qty < 1e-8 ? 0 : ownedQty - qty;

    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE players SET coins = ?, updated_at = ? WHERE id = ?').bind(newCoins, now, player.id),
      c.env.DB.prepare('UPDATE holdings SET quantity = ?, updated_at = ? WHERE id = ?').bind(newQty, now, holding.id),
      c.env.DB.prepare(
        `INSERT INTO trades (id, idempotency_key, player_id, commodity_id, side, quantity, unit_price, fee, total_coins, realized_pnl, created_at)
         VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?, ?, ?, ?)`
      ).bind(`trd_${crypto.randomUUID().slice(0, 8)}`, body.idempotency_key, player.id, item.id, qty, unitPrice, fee, netProceeds, realizedPnl, now),
    ]);

    return c.json({ ok: true, data: { side: 'SELL', qty, unitPrice, fee, netProceeds, realizedPnl, coins: newCoins } });
  }

  return c.json({ ok: false, error: 'Invalid side' }, 400);
});

app.get('/api/store', (c) => {
  return c.json({
    ok: true,
    data: {
      treasury_wallet: c.env.TREASURY_WALLET,
      items: STORE_ITEMS,
    },
  });
});

// 4 维度赛季排行榜：profit | risk | discipline | consistency
app.get('/api/leaderboard', async (c) => {
  const dim = c.req.query('dim') || 'profit';
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.username, p.first_name, p.coins,
            COALESCE(h_agg.inventory_value, 0) AS inventory_value,
            (p.coins + COALESCE(h_agg.inventory_value, 0)) AS net_worth,
            COALESCE(t_agg.total_trades, 0) AS total_trades,
            COALESCE(t_agg.sell_trades, 0) AS sell_trades,
            COALESCE(t_agg.win_trades, 0) AS win_trades,
            COALESCE(c_agg.challenge_wins, 0) AS challenge_wins
     FROM players p
     LEFT JOIN (
       SELECT h.player_id, SUM(h.quantity * c.price) AS inventory_value
       FROM holdings h JOIN commodities c ON h.commodity_id = c.id
       WHERE h.quantity > 0.00000001
       GROUP BY h.player_id
     ) h_agg ON p.id = h_agg.player_id
     LEFT JOIN (
       SELECT player_id,
              COUNT(*) AS total_trades,
              SUM(CASE WHEN side = 'SELL' THEN 1 ELSE 0 END) AS sell_trades,
              SUM(CASE WHEN side = 'SELL' AND realized_pnl > 0 THEN 1 ELSE 0 END) AS win_trades
       FROM trades GROUP BY player_id
     ) t_agg ON p.id = t_agg.player_id
     LEFT JOIN (
       SELECT player_id, COUNT(*) AS challenge_wins
       FROM daily_challenges WHERE status = 'WON'
       GROUP BY player_id
     ) c_agg ON p.id = c_agg.player_id`
  ).all<any>();

  const enriched = results.map((r) => {
    const roiPct = Number((((r.net_worth - 10000) / 10000) * 100).toFixed(2));
    const winRate = r.sell_trades > 0 ? Number(((r.win_trades / r.sell_trades) * 100).toFixed(1)) : 0;
    const cashRatio = r.net_worth > 0 ? r.coins / r.net_worth : 1;
    const riskScore = Number((roiPct * (0.5 + 0.5 * cashRatio) + winRate * 0.2).toFixed(1));
    const disciplineScore = Math.min(
      100,
      Math.round(50 + Math.min(25, r.total_trades * 2) + winRate * 0.15 + r.challenge_wins * 5)
    );
    const consistencyScore = Number((winRate * 0.7 + Math.min(30, r.win_trades * 3)).toFixed(1));
    return {
      ...r,
      roi_pct: roiPct,
      win_rate: winRate,
      risk_score: riskScore,
      discipline_score: disciplineScore,
      consistency_score: consistencyScore,
    };
  });

  enriched.sort((a, b) => {
    if (dim === 'risk') return b.risk_score - a.risk_score;
    if (dim === 'discipline') return b.discipline_score - a.discipline_score;
    if (dim === 'consistency') return b.consistency_score - a.consistency_score;
    return b.net_worth - a.net_worth;
  });

  return c.json({ ok: true, dim, season: getSeasonInfo(), data: enriched.slice(0, 20) });
});

async function fetchLivePrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  // 1. 优先使用 Binance 公开行情镜像（无地区封锁）
  try {
    const res = await fetch('https://data-api.binance.vision/api/v3/ticker/price');
    if (res.ok) {
      const list = await res.json<Array<{ symbol: string; price: string }>>();
      const set = new Set(symbols.map((s) => `${s}USDT`));
      for (const item of list) {
        if (set.has(item.symbol)) {
          const sym = item.symbol.replace(/USDT$/, '');
          const p = Number(item.price);
          if (Number.isFinite(p) && p > 0) prices[sym] = p;
        }
      }
    }
  } catch {}

  // 2. 如果有缺失，用 OKX 公开行情接口兜底
  if (Object.keys(prices).length < symbols.length) {
    try {
      const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
      if (res.ok) {
        const json = await res.json<{ data?: Array<{ instId: string; last: string }> }>();
        for (const item of json.data || []) {
          if (item.instId.endsWith('-USDT')) {
            const sym = item.instId.replace(/-USDT$/, '');
            if (!prices[sym] && symbols.includes(sym)) {
              const p = Number(item.last);
              if (Number.isFinite(p) && p > 0) prices[sym] = p;
            }
          }
        }
      }
    } catch {}
  }
  return prices;
}

async function runMarketTick(db: D1Database): Promise<number> {
  const { results } = await db.prepare('SELECT * FROM commodities').all<any>();
  const symbols = results.map((r) => r.symbol);
  const livePrices = await fetchLivePrices(symbols);
  const now = Date.now();
  const batch: D1PreparedStatement[] = [];
  let updated = 0;

  for (const item of results) {
    const live = livePrices[item.symbol];
    if (!live || live <= 0) continue;
    updated++;
    batch.push(
      db.prepare('UPDATE commodities SET prev_price = ?, price = ?, updated_at = ? WHERE id = ?')
        .bind(item.price, live, now, item.id),
      db.prepare('INSERT INTO price_history (commodity_id, price, recorded_at) VALUES (?, ?, ?)')
        .bind(item.id, live, now)
    );
  }

  // 自动结算已满 1 小时的每日涨跌挑战
  const { results: pendingChallenges } = await db.prepare(
    `SELECT dc.*, c.symbol FROM daily_challenges dc
     JOIN commodities c ON dc.commodity_id = c.id
     WHERE dc.status = 'PENDING' AND dc.created_at <= ?`
  ).bind(now - 3600000).all<any>();

  for (const ch of pendingChallenges) {
    const settlePrice = livePrices[ch.symbol];
    if (!settlePrice) continue;
    const isUp = settlePrice >= ch.entry_price;
    const won = (ch.direction === 'UP' && isUp) || (ch.direction === 'DOWN' && !isUp);
    batch.push(
      db.prepare('UPDATE daily_challenges SET settle_price = ?, status = ? WHERE id = ?')
        .bind(settlePrice, won ? 'WON' : 'LOST', ch.id)
    );
  }

  batch.push(db.prepare('DELETE FROM price_history WHERE recorded_at < ?').bind(now - 86400000));
  if (batch.length > 0) await db.batch(batch);
  return updated;
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(runMarketTick(env.DB));
  },
};
