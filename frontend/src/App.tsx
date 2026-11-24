import { useEffect, useState } from 'react';
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

function TradeWarsApp() {
  const walletAddress = useTonAddress();
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.ready();
    tg?.expand();

    fetch(`${API_BASE}/api/market`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setCommodities(res.data || []);
        else setError('Failed to load market');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>⚔️ TON TRADE WARS</div>
          <div style={{ fontSize: 11, color: '#38bdf8' }}>TESTNET · HYBRID ECONOMY</div>
        </div>
        <TonConnectButton />
      </div>

      {/* Wallet & Balance Card */}
      <div style={{ background: '#131b31', border: '1px solid #1e293b', borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Wallet Status</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, wordBreak: 'break-all', color: walletAddress ? '#4ade80' : '#f59e0b' }}>
          {walletAddress ? `Connected: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : 'Not connected (Tap button above)'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid #1e293b' }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Game Coins (Off-chain)</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>10,000.00</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Mode</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>0 Gas · NPC Market</div>
          </div>
        </div>
      </div>

      {/* Market List */}
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📊 Live Commodity Market (NPC Quotes)</div>
      {loading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading market data...</div>}
      {error && <div style={{ color: '#f87171', fontSize: 13 }}>Error: {error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {commodities.map((c) => {
          const changePct = c.prev_price > 0 ? ((c.price - c.prev_price) / c.prev_price) * 100 : 0;
          return (
            <div key={c.id} style={{ background: '#131b31', border: '1px solid #1e293b', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.symbol} <span style={{ fontWeight: 400, fontSize: 12, color: '#94a3b8' }}>· {c.name}</span></div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>NPC Stock: {c.npc_stock} · Spread: {(c.spread_pct * 100).toFixed(0)}%</div>
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
  );
}

export default function App() {
  const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <TradeWarsApp />
    </TonConnectUIProvider>
  );
}
