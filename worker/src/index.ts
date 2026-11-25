import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  TREASURY_WALLET: string;
  TELEGRAM_BOT_TOKEN: string;
};

const STARS_ITEMS = [
  {
    id: 'sub_pro',
    title: 'PRO Trader (30 Days)',
    desc: 'Full trade history, PnL analytics & PRO badge',
    stars: 199,
    duration_days: 30,
  },
  {
    id: 'sub_elite',
    title: 'ELITE Trader (30 Days)',
    desc: 'All PRO perks + deep discipline diagnostics & ELITE crown',
    stars: 399,
    duration_days: 30,
  },
  {
    id: 'cosmetic_gold_frame',
    title: 'Golden Trader Frame',
    desc: 'Permanent golden highlight on Leaderboard & Profile',
    stars: 50,
    duration_days: null,
  },
  {
    id: 'cosmetic_founder_badge',
    title: 'Genesis Honor Badge',
    desc: 'Permanent Founder Shield on your Trader Profile',
    stars: 99,
    duration_days: null,
  },
  {
    id: 'reset_account',
    title: 'Account Reset Card',
    desc: 'Reset equity to $10,000 vUSDT & clear all losses/positions',
    stars: 49,
    duration_days: 0,
  },
];

const app = new Hono<{ Bindings: Bindings }>();
app.use('/api/*', cors());
app.onError((err, c) => c.json({ ok: false, error: err.message }, 500));

function getSeasonInfo() {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
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
  c.json({ ok: true, service: 'trade-arena', stars: true, time: Date.now() })
);

app.get('/api/market/sync', async (c) => {
  const count = await runMarketTick(c.env.DB);
  return c.json({ ok: true, updated: count });
});

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

// 玩家登录 + 持仓 + 交易员档案 + 今日挑战 + Stars 权益
// 每日连续签到阶梯奖励（100 -> 500 虚拟 USDT）
app.post('/api/checkin', async (c) => {
  const body = await c.req.json<{ telegram_id: string }>();
  if (!body.telegram_id) return c.json({ ok: false, error: 'Missing telegram_id' }, 400);

  const tgId = String(body.telegram_id);
  const now = Date.now();
  const today = getTodayStr();
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);

  const player = await c.env.DB.prepare('SELECT * FROM players WHERE telegram_id = ?')
    .bind(tgId)
    .first<any>();
  if (!player) return c.json({ ok: false, error: 'Player not found' }, 404);

  if (player.last_checkin_date === today) {
    return c.json({ ok: false, error: 'Already checked in today', last_checkin_date: today }, 409);
  }

  const streak = player.last_checkin_date === yesterday ? Number(player.checkin_streak || 0) + 1 : 1;
  const rewards = [100, 150, 200, 250, 300, 400, 500];
  const reward = rewards[Math.min(streak - 1, rewards.length - 1)];
  const newCoins = Number(player.coins || 0) + reward;

  await c.env.DB.prepare(
    'UPDATE players SET coins = ?, last_checkin_date = ?, checkin_streak = ?, updated_at = ? WHERE id = ?'
  ).bind(newCoins, today, streak, now, player.id).run();

  return c.json({ ok: true, reward, streak, coins: newCoins, last_checkin_date: today });
});

// 付费会员（PRO/ELITE）绑定专属 Bot
app.post('/api/bot/bind', async (c) => {
  const body = await c.req.json<{ telegram_id: string; bot_token: string }>();
  if (!body.telegram_id || !body.bot_token) {
    return c.json({ ok: false, error: 'Missing telegram_id or bot_token' }, 400);
  }

  const tgId = String(body.telegram_id);
  const token = String(body.bot_token).trim();
  const now = Date.now();

  const player = await c.env.DB.prepare('SELECT id FROM players WHERE telegram_id = ?')
    .bind(tgId)
    .first<any>();
  if (!player) return c.json({ ok: false, error: 'Player not found' }, 404);

  const sub = await c.env.DB.prepare(
    `SELECT id FROM stars_purchases
     WHERE player_id = ? AND item_id IN ('sub_pro', 'sub_elite')
       AND (expires_at IS NULL OR expires_at > ?)
     LIMIT 1`
  ).bind(player.id, now).first<any>();

  if (!sub) {
    return c.json({ ok: false, error: 'PRO or ELITE membership required' }, 403);
  }

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json<any>()).catch(() => null);
  if (!tgRes?.ok || !tgRes?.result?.username) {
    return c.json({ ok: false, error: 'Invalid Bot Token (Telegram getMe failed)' }, 400);
  }

  const botUsername = tgRes.result.username;
  await c.env.DB.prepare(
    'UPDATE players SET custom_bot_token = ?, custom_bot_username = ?, updated_at = ? WHERE id = ?'
  ).bind(token, botUsername, now, player.id).run();

  return c.json({ ok: true, bot_username: botUsername });
});

// 解绑专属 Bot
app.post('/api/bot/unbind', async (c) => {
  const body = await c.req.json<{ telegram_id: string }>();
  if (!body.telegram_id) return c.json({ ok: false, error: 'Missing telegram_id' }, 400);

  await c.env.DB.prepare(
    'UPDATE players SET custom_bot_token = NULL, custom_bot_username = NULL, updated_at = ? WHERE telegram_id = ?'
  ).bind(Date.now(), String(body.telegram_id)).run();

  return c.json({ ok: true });
});

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
       VALUES (?, ?, ?, ?, ${validReferrer ? 10500 : 10000}, ?, ?, ?, ?)`
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
    if (validReferrer) {
      await c.env.DB.prepare('UPDATE players SET coins = coins + 500, updated_at = ? WHERE id = ?')
        .bind(now, validReferrer.id).run();
    }
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
    { results: activeStars },
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
      `SELECT item_id, MAX(expires_at) as expires_at FROM stars_purchases
       WHERE player_id = ? AND (expires_at IS NULL OR expires_at > ?)
       GROUP BY item_id`
    ).bind(player.id, now).all<any>(),
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

  const activeSet = new Set(activeStars.map((s) => s.item_id));
  const isElite = activeSet.has('sub_elite');
  const isPro = isElite || activeSet.has('sub_pro');
  const entitlements = {
    is_pro: isPro,
    is_elite: isElite,
    has_gold_frame: activeSet.has('cosmetic_gold_frame'),
    has_founder_badge: activeSet.has('cosmetic_founder_badge'),
    active_items: Array.from(activeSet),
  };

  let recentTrades: any[] = [];
  if (isPro) {
    const { results } = await c.env.DB.prepare(
      `SELECT t.id, t.side, t.quantity, t.unit_price, t.total_coins, t.realized_pnl, t.created_at, c.symbol
       FROM trades t JOIN commodities c ON t.commodity_id = c.id
       WHERE t.player_id = ? ORDER BY t.created_at DESC LIMIT 20`
    ).bind(player.id).all<any>();
    recentTrades = results;
  }

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
      entitlements,
      recent_trades: recentTrades,
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

// Telegram Stars 商城列表
app.get('/api/stars/items', (c) => {
  return c.json({ ok: true, data: STARS_ITEMS });
});

// 创建 Telegram Stars 支付链接 (createInvoiceLink)
app.post('/api/stars/invoice', async (c) => {
  if (!c.env.TELEGRAM_BOT_TOKEN) {
    return c.json({ ok: false, error: 'Bot token not configured' }, 500);
  }
  const body = await c.req.json<{ telegram_id: string; item_id: string }>();
  const item = STARS_ITEMS.find((i) => i.id === body.item_id);
  if (!item) return c.json({ ok: false, error: 'Item not found' }, 404);

  const player = await c.env.DB.prepare('SELECT id FROM players WHERE telegram_id = ?')
    .bind(String(body.telegram_id))
    .first<any>();
  if (!player) return c.json({ ok: false, error: 'Player not found' }, 404);

  const payload = JSON.stringify({ player_id: player.id, item_id: item.id });
  const tgRes = await fetch(
    `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: item.title,
        description: item.desc,
        payload,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: item.title, amount: item.stars }],
      }),
    }
  );
  const tgJson = await tgRes.json<any>();
  if (!tgJson.ok || !tgJson.result) {
    return c.json({ ok: false, error: tgJson.description || 'Failed to create invoice' }, 500);
  }

  return c.json({ ok: true, data: { invoice_url: tgJson.result, item_id: item.id } });
});

// Telegram Bot Webhook：处理预检 (pre_checkout_query) 与付款成功发货 (successful_payment)
app.post('/api/telegram/webhook', async (c) => {
  const update = await c.req.json<any>();

  // 1. 收到付款前预检请求，必须在 10 秒内回复 ok: true
  if (update.pre_checkout_query) {
    await fetch(
      `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: update.pre_checkout_query.id,
          ok: true,
        }),
      }
    );
    return c.json({ ok: true });
  }

  // 2. 收到付款成功回调，写入 stars_purchases 账本
  const payment = update.message?.successful_payment;
  if (payment) {
    try {
      const meta = JSON.parse(payment.invoice_payload || '{}');
      const item = STARS_ITEMS.find((i) => i.id === meta.item_id);
      if (meta.player_id && item) {
        const now = Date.now();
        const expiresAt = item.duration_days ? now + item.duration_days * 86400000 : null;
        const chargeId = payment.telegram_payment_charge_id || `chg_${now}`;
        if (item.id === 'reset_account') {
          await c.env.DB.batch([
            c.env.DB.prepare('UPDATE players SET coins = 10000, updated_at = ? WHERE id = ?').bind(now, meta.player_id),
            c.env.DB.prepare('DELETE FROM holdings WHERE player_id = ?').bind(meta.player_id),
            c.env.DB.prepare('DELETE FROM trades WHERE player_id = ?').bind(meta.player_id),
          ]);
        }
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO stars_purchases (id, player_id, item_id, stars_amount, charge_id, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            `str_${crypto.randomUUID().slice(0, 10)}`,
            meta.player_id,
            item.id,
            Number(payment.total_amount || item.stars),
            chargeId,
            expiresAt,
            now
          )
          .run();
      }
    } catch {}
  }

  return c.json({ ok: true });
});

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

// 设置/清除持仓止盈止损 (TP/SL)
app.post('/api/holdings/tpsl', async (c) => {
  const body = await c.req.json<{
    telegram_id: string;
    commodity_id: string;
    tp_price?: number | null;
    sl_price?: number | null;
  }>();
  if (!body.telegram_id || !body.commodity_id) {
    return c.json({ ok: false, error: 'Missing parameters' }, 400);
  }

  const player = await c.env.DB.prepare('SELECT id FROM players WHERE telegram_id = ?')
    .bind(String(body.telegram_id))
    .first<any>();
  if (!player) return c.json({ ok: false, error: 'Player not found' }, 404);

  const tp = body.tp_price && Number(body.tp_price) > 0 ? Number(body.tp_price) : null;
  const sl = body.sl_price && Number(body.sl_price) > 0 ? Number(body.sl_price) : null;

  await c.env.DB.prepare(
    'UPDATE holdings SET tp_price = ?, sl_price = ?, updated_at = ? WHERE player_id = ? AND commodity_id = ?'
  ).bind(tp, sl, Date.now(), player.id, body.commodity_id).run();

  return c.json({ ok: true, tp_price: tp, sl_price: sl });
});

async function runTpSlAndBotAlerts(db: D1Database) {
  const now = Date.now();
  const { results: rows } = await db.prepare(`
    SELECT h.id, h.player_id, h.commodity_id, h.quantity, h.cost_basis, h.tp_price, h.sl_price, h.last_alert_at, h.leverage, h.margin_used, h.liq_price,
           c.symbol, c.price,
           p.telegram_id, p.custom_bot_token
    FROM holdings h
    JOIN commodities c ON h.commodity_id = c.id
    JOIN players p ON h.player_id = p.id
    WHERE h.quantity > 0.00000001
  `).all<any>();

  for (const r of rows) {
    const price = Number(r.price);
    const qty = Number(r.quantity);
    const cost = Number(r.cost_basis || price);
    const lev = Number(r.leverage || 1);
    const marginUsed = Number(r.margin_used || 0);
    const hitLiq = lev > 1 && r.liq_price && price <= Number(r.liq_price);
    const hitTp = r.tp_price && price >= Number(r.tp_price);
    const hitSl = r.sl_price && price <= Number(r.sl_price);

    if (hitLiq || hitTp || hitSl) {
      const pnl = hitLiq ? -marginUsed : (price - cost) * qty;
      const proceeds = hitLiq ? 0 : (lev > 1 ? Math.max(0, marginUsed + pnl) : qty * price);
      const reason = hitLiq ? `Liquidation (${lev}x)` : (hitTp ? 'Take Profit (TP)' : 'Stop Loss (SL)');
      const tradeId = `trd_${crypto.randomUUID().slice(0, 8)}`;

      await db.batch([
        db.prepare('UPDATE players SET coins = coins + ?, updated_at = ? WHERE id = ?').bind(proceeds, now, r.player_id),
        db.prepare('DELETE FROM holdings WHERE id = ?').bind(r.id),
        db.prepare(
          `INSERT INTO trades (id, idempotency_key, player_id, commodity_id, side, quantity, unit_price, fee, total_coins, realized_pnl, created_at)
           VALUES (?, ?, ?, ?, 'SELL', ?, ?, 0, ?, ?, ?)`
        ).bind(tradeId, `auto_${tradeId}`, r.player_id, r.commodity_id, qty, price, proceeds, pnl, now),
      ]);

      if (r.custom_bot_token) {
        const sign = pnl >= 0 ? '+' : '';
        const text = `🎯 ${reason} Triggered!\n${r.symbol} auto-closed @ $${price}\nPnL: ${sign}$${pnl.toFixed(2)} vUSDT`;
        await fetch(`https://api.telegram.org/bot${r.custom_bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: r.telegram_id, text }),
        }).catch(() => {});
      }
      continue;
    }

    if (r.custom_bot_token && cost > 0 && now - Number(r.last_alert_at || 0) > 3600000) {
      const pct = ((price - cost) / cost) * 100;
      if (Math.abs(pct) >= 5) {
        const icon = pct > 0 ? '🚀' : '⚠️';
        const sign = pct > 0 ? '+' : '';
        const text = `${icon} Price Alert: ${r.symbol} ${sign}${pct.toFixed(2)}%\nEntry: $${cost} → Now: $${price}`;
        await fetch(`https://api.telegram.org/bot${r.custom_bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: r.telegram_id, text }),
        }).catch(() => {});
        await db.prepare('UPDATE holdings SET last_alert_at = ? WHERE id = ?').bind(now, r.id).run();
      }
    }
  }
}

app.post('/api/trade', async (c) => {
  const body = await c.req.json<{
    telegram_id: string;
    commodity_id: string;
    side: 'BUY' | 'SELL';
    amount_usdt?: number;
    leverage?: number;
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
  const FEE_RATE = 0.001;

  if (body.side === 'BUY') {
    const lev = [1, 5, 10].includes(Number(body.leverage)) ? Number(body.leverage) : 1;
    if (lev > 1) {
      const sub = await c.env.DB.prepare(
        `SELECT id FROM stars_purchases
         WHERE player_id = ? AND item_id IN ('sub_pro', 'sub_elite')
           AND (expires_at IS NULL OR expires_at > ?)
         LIMIT 1`
      ).bind(player.id, now).first<any>();
      if (!sub) {
        return c.json({ ok: false, error: 'PRO or ELITE membership required for 5x/10x leverage' }, 403);
      }
    }

    const unitPrice = item.price * (1 + halfSpread);
    let qty = Number(body.quantity || 0);
    if (body.amount_usdt && body.amount_usdt > 0) {
      qty = (body.amount_usdt * lev) / (unitPrice * (1 + FEE_RATE));
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return c.json({ ok: false, error: 'Invalid buy amount' }, 400);
    }

    const subtotal = unitPrice * qty;
    const fee = Number((subtotal * FEE_RATE).toFixed(4));
    const margin = Number((subtotal / lev).toFixed(2));
    const totalCost = Number((margin + fee).toFixed(2));
    const liqPrice = lev > 1 ? Number((unitPrice * (1 - 0.9 / lev)).toFixed(6)) : null;

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
    if (lev > 1) {
      const newMargin = Number(((holding ? Number(holding.margin_used || 0) : 0) + margin).toFixed(2));
      await c.env.DB.prepare(
        'UPDATE holdings SET leverage = ?, margin_used = ?, liq_price = ? WHERE player_id = ? AND commodity_id = ?'
      ).bind(lev, newMargin, liqPrice, player.id, item.id).run();
    }
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
    const lev = Number(holding.leverage || 1);
    const closeRatio = ownedQty > 0 ? qty / ownedQty : 1;
    const releasedMargin = Number(holding.margin_used || 0) * closeRatio;
    const realizedPnl = Number(((unitPrice - Number(holding.cost_basis)) * qty - fee).toFixed(2));
    const netProceeds = lev > 1
      ? Math.max(0, Number((releasedMargin + realizedPnl).toFixed(2)))
      : Number((subtotal - fee).toFixed(2));

    const newCoins = Number((player.coins + netProceeds).toFixed(2));
    const newQty = ownedQty - qty < 1e-8 ? 0 : ownedQty - qty;

    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE players SET coins = ?, updated_at = ? WHERE id = ?').bind(newCoins, now, player.id),
      c.env.DB.prepare('UPDATE holdings SET quantity = ?, margin_used = ?, leverage = CASE WHEN ? = 0 THEN 1 ELSE leverage END, liq_price = CASE WHEN ? = 0 THEN NULL ELSE liq_price END, updated_at = ? WHERE id = ?').bind(newQty, Math.max(0, Number(holding.margin_used || 0) - releasedMargin), newQty, newQty, now, holding.id),
      c.env.DB.prepare(
        `INSERT INTO trades (id, idempotency_key, player_id, commodity_id, side, quantity, unit_price, fee, total_coins, realized_pnl, created_at)
         VALUES (?, ?, ?, ?, 'SELL', ?, ?, ?, ?, ?, ?)`
      ).bind(`trd_${crypto.randomUUID().slice(0, 8)}`, body.idempotency_key, player.id, item.id, qty, unitPrice, fee, netProceeds, realizedPnl, now),
    ]);

    return c.json({ ok: true, data: { side: 'SELL', qty, unitPrice, fee, netProceeds, realizedPnl, coins: newCoins } });
  }

  return c.json({ ok: false, error: 'Invalid side' }, 400);
});

app.get('/api/leaderboard', async (c) => {
  const dim = c.req.query('dim') || 'profit';
  const now = Date.now();
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.username, p.first_name, p.coins,
            COALESCE(h_agg.inventory_value, 0) AS inventory_value,
            (p.coins + COALESCE(h_agg.inventory_value, 0)) AS net_worth,
            COALESCE(t_agg.total_trades, 0) AS total_trades,
            COALESCE(t_agg.sell_trades, 0) AS sell_trades,
            COALESCE(t_agg.win_trades, 0) AS win_trades,
            COALESCE(c_agg.challenge_wins, 0) AS challenge_wins,
            COALESCE(s_agg.has_gold_frame, 0) AS has_gold_frame,
            COALESCE(s_agg.is_pro, 0) AS is_pro,
            COALESCE(s_agg.is_elite, 0) AS is_elite
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
     ) c_agg ON p.id = c_agg.player_id
     LEFT JOIN (
       SELECT player_id,
              MAX(CASE WHEN item_id = 'cosmetic_gold_frame' THEN 1 ELSE 0 END) AS has_gold_frame,
              MAX(CASE WHEN item_id IN ('sub_pro','sub_elite') THEN 1 ELSE 0 END) AS is_pro,
              MAX(CASE WHEN item_id = 'sub_elite' THEN 1 ELSE 0 END) AS is_elite
       FROM stars_purchases
       WHERE expires_at IS NULL OR expires_at > ?
       GROUP BY player_id
     ) s_agg ON p.id = s_agg.player_id`
  ).bind(now).all<any>();

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
    ctx.waitUntil((async () => { await runMarketTick(env.DB); await runTpSlAndBotAlerts(env.DB); })());
  },
};
