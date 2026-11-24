import { useEffect, useState, useCallback } from 'react';
import { TonConnectUIProvider, TonConnectButton, useTonAddress } from '@tonconnect/ui-react';

const API_BASE = 'https://ton-trade-wars-api.zhangbanzhuan.workers.dev';

interface Commodity {
  id: string;
  symbol: string;
  name: string;
  price: number;
  prev_price: number;
  npc_stock: number;
  spread_pct: number;
}

interface Holding {
  commodity_id: string;
  symbol: string;
  name: string;
  quantity: number;
  cost_basis: number;
  price: number;
}

interface Player {
  id: string;
  telegram_id: string;
  username?: string;
  first_name?: string;
  coins: number;
  wallet_address?: string;
}

interface RankItem {
  id: string;
  username?: string;
  first_name?: string;
  coins: number;
  inventory_value: number;
  net_worth: number;
}

function getTelegramUser() {
  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  if (tgUser?.id) {
    return {
      telegram_id: String(tgUser.id),
      username: tgUser.username || '',
      first_name: tgUser.first_name || 'Trader',
    };
  }
  let demoId = localStorage.getItem('tw_demo_uid');
  if (!demoId) {
    demoId = `demo_${Math.floor(100000 + Math.random() * 900000)}`;
    localStorage.setItem('tw_demo_uid', demoId);
  }
  return { telegram_id: demoId, username: 'web_tester', first_name: 'Web Trader' };
}

function TradeWarsApp() {
  const walletAddress = useTonAddress();
  const [tab, setTab] = useState<'market' | 'inventory' | 'rank'>('market');
  const [player, setPlayer] = useState<Player | null>(null);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [leaderboard, setLeaderboard] = useState<RankItem[]>([]);
  const [selected, setSelected] = useState<Commodity | null>(null);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAll = useCallback(async () => {
    const user = getTelegramUser();
    try {
      const [mktRes, plrRes] = await Promise.all([
        fetch(`${API_BASE}/api/market`).then((r) => r.json()),
        fetch(`${API_BASE}/api/player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...user, wallet_address: walletAddress || undefined }),
        }).then((r) => r.json()),
      ]);
      if (mktRes.ok) setCommodities(mktRes.data || []);
      if (plrRes.ok) {
        setPlayer(plrRes.data.player);
        setHoldings(plrRes.data.holdings || []);
      }
    } catch (e: any) {
      showToast('err', e.message || 'Network error');
    }
  }, [walletAddress]);

  const loadRank = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`).then((r) => r.json());
      if (res.ok) setLeaderboard(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.ready();
    tg?.expand();
    loadAll();
    const timer = setInterval(loadAll, 30000);
    return () => clearInterval(timer);
  }, [loadAll]);

  useEffect(() => {
    if (tab === 'rank') loadRank();
  }, [tab, loadRank]);

  const inventoryValue = holdings.reduce((sum, h) => sum + h.quantity * h.price, 0);
  const netWorth = (player?.coins || 0) + inventoryValue;

  const openTrade = (item: Commodity, defaultSide: 'BUY' | 'SELL' = 'BUY') => {
    setSelected(item);
    setSide(defaultSide);
    setQty(1);
  };

  const executeTrade = async () => {
    if (!selected || !player || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: player.telegram_id,
          commodity_id: selected.id,
          side,
          quantity: qty,
          idempotency_key: `${player.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        }),
      }).then((r) => r.json());

      if (res.ok) {
        showToast('ok', `${side} ${qty} ${selected.symbol} @ ${res.data.unitPrice.toFixed(2)}`);
        setSelected(null);
        await loadAll();
      } else {
        showToast('err', res.error || 'Trade failed');
      }
    } catch (e: any) {
      showToast('err', e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedHolding = selected ? holdings.find((h) => h.commodity_id === selected.id) : null;
  const estUnitPrice = selected
    ? Number((selected.price * (side === 'BUY' ? 1 + selected.spread_pct / 2 : 1 - selected.spread_pct / 2)).toFixed(2))
    : 0;
  const estSubtotal = estUnitPrice * qty;
  const estFee = Number((estSubtotal * 0.005).toFixed(2));
  const estTotal = side === 'BUY' ? estSubtotal + estFee : estSubtotal - estFee;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 14px 84px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: toast.type === 'ok' ? '#166534' : '#991b1b', color: '#fff',
          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>⚔️ TON TRADE WARS</div>
          <div style={{ fontSize: 11, color: '#38bdf8' }}>TESTNET · 0 GAS NPC MARKET</div>
        </div>
        <TonConnectButton />
      </div>

      {/* Balance Card */}
      <div style={{ background: '#131b31', border: '1px solid #1e293b', borderRadius: 14, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Net Worth (Coins)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>{netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Cash Available</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>{(player?.coins || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: walletAddress ? '#4ade80' : '#f59e0b', marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e293b' }}>
          {walletAddress ? `TON Wallet: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : 'Wallet not connected (Optional for off-chain trading)'}
        </div>
      </div>

      {/* Tab: Market */}
      {tab === 'market' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#cbd5e1' }}>📊 Live Commodities (Tap to Trade)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {commodities.map((c) => {
              const changePct = c.prev_price > 0 ? ((c.price - c.prev_price) / c.prev_price) * 100 : 0;
              const owned = holdings.find((h) => h.commodity_id === c.id)?.quantity || 0;
              return (
                <div
                  key={c.id}
                  onClick={() => openTrade(c, 'BUY')}
                  style={{
                    background: '#131b31', border: '1px solid #1e293b', borderRadius: 12, padding: 12,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {c.symbol} <span style={{ fontWeight: 400, fontSize: 12, color: '#94a3b8' }}>· {c.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                      NPC Stock: {c.npc_stock} · Owned: <span style={{ color: owned > 0 ? '#38bdf8' : '#64748b', fontWeight: 600 }}>{owned}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.price.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: changePct >= 0 ? '#4ade80' : '#f87171' }}>
                      {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Inventory */}
      {tab === 'inventory' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#cbd5e1' }}>🎒 My Holdings</div>
          {holdings.length === 0 ? (
            <div style={{ background: '#131b31', borderRadius: 12, padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              No holdings yet. Buy commodities in Market!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {holdings.map((h) => {
                const pnl = (h.price - h.cost_basis) * h.quantity;
                const pnlPct = h.cost_basis > 0 ? ((h.price - h.cost_basis) / h.cost_basis) * 100 : 0;
                const item = commodities.find((c) => c.id === h.commodity_id);
                return (
                  <div
                    key={h.commodity_id}
                    onClick={() => item && openTrade(item, 'SELL')}
                    style={{
                      background: '#131b31', border: '1px solid #1e293b', borderRadius: 12, padding: 12,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{h.symbol} <span style={{ color: '#38bdf8', fontSize: 13 }}>x{h.quantity}</span></div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Avg Cost: {h.cost_basis.toFixed(2)} · Now: {h.price.toFixed(2)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{(h.quantity * h.price).toFixed(2)}</div>
                      <div style={{ fontSize: 11, color: pnl >= 0 ? '#4ade80' : '#f87171' }}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Leaderboard */}
      {tab === 'rank' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#cbd5e1' }}>🏆 Global Leaderboard</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leaderboard.map((r, idx) => (
              <div key={r.id} style={{
                background: '#131b31', border: '1px solid #1e293b', borderRadius: 12, padding: '10px 12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 24, fontWeight: 800, color: idx < 3 ? '#facc15' : '#64748b' }}>#{idx + 1}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.first_name || r.username || 'Trader'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Cash: {r.coins.toFixed(0)} · Inv: {r.inventory_value.toFixed(0)}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#4ade80' }}>{r.net_worth.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }} onClick={() => setSelected(null)}>
          <div style={{
            width: '100%', maxWidth: 480, background: '#0f172a', borderTop: '1px solid #334155',
            borderRadius: '18px 18px 0 0', padding: 18
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{selected.symbol} · {selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18 }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setSide('BUY')} style={{
                padding: 10, borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer',
                background: side === 'BUY' ? '#16a34a' : '#1e293b', color: '#fff'
              }}>BUY</button>
              <button onClick={() => setSide('SELL')} style={{
                padding: 10, borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer',
                background: side === 'SELL' ? '#dc2626' : '#1e293b', color: '#fff'
              }}>SELL (Owned: {selectedHolding?.quantity || 0})</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Quantity</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {[1, 5, 10, 25].map((n) => (
                  <button key={n} onClick={() => setQty(n)} style={{
                    padding: '6px 10px', borderRadius: 8, border: '1px solid #334155', cursor: 'pointer',
                    background: qty === n ? '#38bdf8' : '#1e293b', color: qty === n ? '#0b1020' : '#f1f5f9', fontWeight: 700
                  }}>{n}</button>
                ))}
              </div>
            </div>

            <div style={{ background: '#1e293b', borderRadius: 10, padding: 12, fontSize: 12, color: '#cbd5e1', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>NPC {side} Price (incl. spread)</span><span>{estUnitPrice.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Fee (0.5%)</span><span>{estFee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14, color: '#fff', paddingTop: 6, borderTop: '1px solid #334155' }}>
                <span>{side === 'BUY' ? 'Total Cost' : 'Net Receive'}</span><span>{estTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              disabled={submitting}
              onClick={executeTrade}
              style={{
                width: '100%', padding: 13, borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                background: side === 'BUY' ? '#22c55e' : '#ef4444', color: '#0b1020', opacity: submitting ? 0.6 : 1
              }}
            >
              {submitting ? 'Processing...' : `Confirm ${side} ${qty} ${selected.symbol}`}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0f172a', borderTop: '1px solid #1e293b',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', maxWidth: 480, margin: '0 auto'
      }}>
        {([
          ['market', '📊 Market'],
          ['inventory', '🎒 Inventory'],
          ['rank', '🏆 Rank'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '14px 0', background: 'none', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            color: tab === key ? '#38bdf8' : '#64748b'
          }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl} actionsConfiguration={{ twaReturnUrl: 'https://t.me/TonTradeWarsbot' }}>
      <TradeWarsApp />
    </TonConnectUIProvider>
  );
}
