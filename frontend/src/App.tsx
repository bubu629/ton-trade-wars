import { useEffect, useState, useCallback } from 'react';
import { TonConnectUIProvider, TonConnectButton, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

const API_BASE = 'https://ton-trade-wars-api.zhangbanzhuan.workers.dev';
const BOT_USERNAME = 'TonTradeWarsbot';

type Lang = 'en' | 'zh';

const I18N = {
  en: {
    subtitleVip: '⚡ VIP 0% FEE',
    subtitleNormal: '0 GAS NPC MARKET',
    subtitleGenesis: ' · 🚀 GENESIS',
    netWorth: 'Net Worth (Coins)',
    cashAvailable: 'Cash Available',
    walletNotConnected: 'Wallet not connected',
    inviteBtn: '🎁 Invite (+2,000)',
    marketTitle: '📊 Live Commodities (1m Tick · Tap to Trade)',
    stock: 'Stock',
    owned: 'Owned',
    invTitle: '🎒 My Holdings',
    invEmpty: 'No holdings yet. Buy commodities in Market!',
    avgCost: 'Avg Cost',
    now: 'Now',
    storeTitle: '💎 TON Store (On-Chain Verified)',
    ownedActive: '✓ Owned & Active',
    payTon: (p: number) => `Pay ${p} TON`,
    confirmInWallet: 'Confirm in Wallet...',
    verifyingOnTon: 'Verifying on TON...',
    unlocked: (name: string) => `Unlocked ${name}!`,
    txPending: 'Tx sent! Waiting for TON confirmation, refresh in 1 min.',
    inviteTitle: '🎁 Invite Friends, Earn Coins',
    invited: 'Invited',
    inviteDesc1: 'Both you and your friend get ',
    inviteDescBold: '+2,000 Game Coins',
    inviteDesc2: ' instantly when they join.',
    shareTg: 'Share in Telegram',
    copyLink: 'Copy Link',
    linkCopied: 'Invite link copied! (+2,000 coins each)',
    shareText: '⚔️ Trade commodities & win on TON Trade Wars! Join with my link for +2,000 bonus coins:',
    rankTitle: '🏆 Global Leaderboard',
    cash: 'Cash',
    invShort: 'Inv',
    currentPrice: 'Current Price',
    buy: 'BUY',
    sell: 'SELL',
    quantity: 'Quantity',
    npcPrice: (side: 'BUY' | 'SELL') => `NPC ${side} Price (incl. spread)`,
    fee: 'Fee',
    vipFee: '0% VIP',
    totalCost: 'Total Cost',
    netReceive: 'Net Receive',
    processing: 'Processing...',
    confirmTrade: (side: 'BUY' | 'SELL', qty: number, sym: string) => `Confirm ${side} ${qty} ${sym}`,
    tradeOk: (side: 'BUY' | 'SELL', qty: number, sym: string, price: string) => `${side} ${qty} ${sym} @ ${price}`,
    navMarket: '📊 Market',
    navInv: '🎒 Inv',
    navStore: '💎 Store',
    navRank: '🏆 Rank',
  },
  zh: {
    subtitleVip: '⚡ VIP 免手续费',
    subtitleNormal: '0 Gas · NPC 模拟盘',
    subtitleGenesis: ' · 🚀 创世特权',
    netWorth: '总净值 (游戏金币)',
    cashAvailable: '可用金币',
    walletNotConnected: '未连接 TON 钱包',
    inviteBtn: '🎁 邀请好友 (+2,000)',
    marketTitle: '📊 实时行情 (每分钟波动 · 点击交易)',
    stock: '库存',
    owned: '持仓',
    invTitle: '🎒 我的持仓',
    invEmpty: '暂无持仓，去行情页低买高卖吧！',
    avgCost: '持仓均价',
    now: '现价',
    storeTitle: '💎 TON 商城 (链上自动核验)',
    ownedActive: '✓ 已拥有并生效',
    payTon: (p: number) => `支付 ${p} TON`,
    confirmInWallet: '请在钱包确认...',
    verifyingOnTon: '正在核验链上到账...',
    unlocked: (name: string) => `已解锁 ${name}！`,
    txPending: '转账已发出，等待链上确认，请 1 分钟后刷新。',
    inviteTitle: '🎁 邀请好友，双方领金币',
    invited: '已邀请',
    inviteDesc1: '好友通过你的专属链接进入游戏，双方立刻各得 ',
    inviteDescBold: '+2,000 游戏金币',
    inviteDesc2: '。',
    shareTg: '转发到 Telegram',
    copyLink: '复制邀请链接',
    linkCopied: '邀请链接已复制！（双方各得 2,000 金币）',
    shareText: '⚔️ 来玩 TON Trade Wars 模拟期货交易！点我的链接进入，双方各领 2,000 初始金币：',
    rankTitle: '🏆 全球富豪榜',
    cash: '现金',
    invShort: '持仓',
    currentPrice: '当前市价',
    buy: '买入',
    sell: '卖出',
    quantity: '交易数量',
    npcPrice: (side: 'BUY' | 'SELL') => `NPC ${side === 'BUY' ? '买入' : '卖出'}价 (含点差)`,
    fee: '手续费',
    vipFee: '0% VIP',
    totalCost: '预计花费',
    netReceive: '预计到手',
    processing: '交易处理中...',
    confirmTrade: (side: 'BUY' | 'SELL', qty: number, sym: string) => `确认${side === 'BUY' ? '买入' : '卖出'} ${qty} 份 ${sym}`,
    tradeOk: (side: 'BUY' | 'SELL', qty: number, sym: string, price: string) => `${side === 'BUY' ? '买入' : '卖出'}成功：${qty} ${sym} @ ${price}`,
    navMarket: '📊 行情',
    navInv: '🎒 持仓',
    navStore: '💎 商城',
    navRank: '🏆 排行',
  },
} as const;

const COMMODITY_ZH: Record<string, string> = {
  DATA: '数据矿石',
  ENERGY: '能源核心',
  FUEL: '聚变燃料',
  ALLOY: '稀有合金',
  CHIP: '量子芯片',
  CRYSTAL: '虚空水晶',
};

const STORE_ZH: Record<string, { name: string; desc: string }> = {
  item_vip_fee: {
    name: '⚡ 0% 手续费 VIP 通行证',
    desc: '永久免除所有买入/卖出订单的 0.5% 交易手续费',
  },
  item_whale_pack: {
    name: '💰 巨鲸资金包',
    desc: '立刻到账 +50,000 游戏金币，快速扩大交易仓位',
  },
  item_genesis_nft: {
    name: '🚀 创世交易员 NFT',
    desc: '单次买入上限翻倍（NPC 库存 20%）+ 创世专属标识',
  },
};

interface Commodity {
  id: string;
  symbol: string;
  name: string;
  price: number;
  prev_price: number;
  npc_stock: number;
  spread_pct: number;
  history?: number[];
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

interface StoreItem {
  id: string;
  name: string;
  desc: string;
  price_ton: number;
  amount_nano: string;
  repeatable: boolean;
}

function getInitialLang(): Lang {
  const saved = localStorage.getItem('tw_lang');
  if (saved === 'zh' || saved === 'en') return saved;
  const tgLang = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code || navigator.language || 'en';
  return String(tgLang).toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function Sparkline({ data, width = 72, height = 26, isUp }: { data: number[]; width?: number; height?: number; isUp: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const points = data
    .map((val, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = height - pad - ((val - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const color = isUp ? '#4ade80' : '#f87171';
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function getTelegramContext() {
  const tg = (window as any).Telegram?.WebApp;
  const tgUser = tg?.initDataUnsafe?.user;
  const startParam =
    tg?.initDataUnsafe?.start_param ||
    new URLSearchParams(window.location.search).get('startapp') ||
    '';
  const ref_by = startParam.startsWith('ref_') ? startParam.slice(4) : startParam || undefined;

  if (tgUser?.id) {
    return {
      telegram_id: String(tgUser.id),
      username: tgUser.username || '',
      first_name: tgUser.first_name || 'Trader',
      ref_by,
    };
  }
  let demoId = localStorage.getItem('tw_demo_uid');
  if (!demoId) {
    demoId = `demo_${Math.floor(100000 + Math.random() * 900000)}`;
    localStorage.setItem('tw_demo_uid', demoId);
  }
  return { telegram_id: demoId, username: 'web_tester', first_name: 'Web Trader', ref_by };
}

function TradeWarsApp() {
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const [tab, setTab] = useState<'market' | 'inventory' | 'store' | 'rank'>('market');
  const [player, setPlayer] = useState<Player | null>(null);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [ownedAssets, setOwnedAssets] = useState<string[]>([]);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<RankItem[]>([]);
  const [selected, setSelected] = useState<Commodity | null>(null);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyingStatus, setBuyingStatus] = useState<string>('');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const t = I18N[lang];

  const toggleLang = () => {
    const next: Lang = lang === 'en' ? 'zh' : 'en';
    setLang(next);
    localStorage.setItem('tw_lang', next);
  };

  const getCommodityName = (c: { symbol: string; name: string }) =>
    lang === 'zh' ? (COMMODITY_ZH[c.symbol] || c.name) : c.name;

  const getStoreMeta = (item: StoreItem) =>
    lang === 'zh' && STORE_ZH[item.id] ? STORE_ZH[item.id] : { name: item.name, desc: item.desc };

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    const user = getTelegramContext();
    try {
      const [mktRes, plrRes, storeRes] = await Promise.all([
        fetch(`${API_BASE}/api/market`).then((r) => r.json()),
        fetch(`${API_BASE}/api/player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...user, wallet_address: walletAddress || undefined }),
        }).then((r) => r.json()),
        fetch(`${API_BASE}/api/store`).then((r) => r.json()),
      ]);
      if (mktRes.ok) setCommodities(mktRes.data || []);
      if (plrRes.ok) {
        setPlayer(plrRes.data.player);
        setHoldings(plrRes.data.holdings || []);
        setOwnedAssets(plrRes.data.owned_assets || []);
        setReferralCount(plrRes.data.referral_count || 0);
      }
      if (storeRes.ok) setStoreItems(storeRes.data.items || []);
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

  const hasVip = ownedAssets.includes('item_vip_fee');
  const hasGenesis = ownedAssets.includes('item_genesis_nft');
  const inventoryValue = holdings.reduce((sum, h) => sum + h.quantity * h.price, 0);
  const netWorth = (player?.coins || 0) + inventoryValue;
  const inviteLink = player ? `https://t.me/${BOT_USERNAME}?startapp=ref_${player.telegram_id}` : '';

  const shareInvite = () => {
    if (!inviteLink) return;
    const text = encodeURIComponent(t.shareText);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${text}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast('ok', t.linkCopied);
    } catch {
      showToast('ok', inviteLink);
    }
  };

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
        showToast('ok', t.tradeOk(side, qty, selected.symbol, res.data.unitPrice.toFixed(2)));
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

  const buyStoreItem = async (item: StoreItem) => {
    if (!player || buyingId) return;
    if (!walletAddress) {
      tonConnectUI.openModal();
      return;
    }
    const meta = getStoreMeta(item);
    setBuyingId(item.id);
    setBuyingStatus(t.confirmInWallet);
    try {
      const orderRes = await fetch(`${API_BASE}/api/store/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: player.telegram_id,
          wallet_address: walletAddress,
          asset_id: item.id,
        }),
      }).then((r) => r.json());

      if (!orderRes.ok) {
        showToast('err', orderRes.error || 'Failed to create order');
        return;
      }

      const { order_id, treasury_wallet, amount_nano } = orderRes.data;
      const txResult = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: treasury_wallet, amount: amount_nano }],
      });

      setBuyingStatus(t.verifyingOnTon);
      let confirmed = false;
      for (let attempt = 0; attempt < 15; attempt++) {
        const confirmRes = await fetch(`${API_BASE}/api/store/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id, boc: txResult.boc }),
        }).then((r) => r.json());

        if (confirmRes.ok) {
          confirmed = true;
          showToast('ok', t.unlocked(meta.name));
          await loadAll();
          break;
        }
        if (!confirmRes.pending) {
          showToast('err', confirmRes.error || 'Verification failed');
          break;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }

      if (!confirmed) {
        showToast('err', t.txPending);
      }
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!/UserRejectsError|Rejected|cancel/i.test(msg)) {
        showToast('err', msg || 'Payment failed');
      }
    } finally {
      setBuyingId(null);
      setBuyingStatus('');
    }
  };

  const selectedHolding = selected ? holdings.find((h) => h.commodity_id === selected.id) : null;
  const estUnitPrice = selected
    ? Number((selected.price * (side === 'BUY' ? 1 + selected.spread_pct / 2 : 1 - selected.spread_pct / 2)).toFixed(2))
    : 0;
  const estSubtotal = estUnitPrice * qty;
  const estFee = hasVip ? 0 : Number((estSubtotal * 0.005).toFixed(2));
  const estTotal = side === 'BUY' ? estSubtotal + estFee : estSubtotal - estFee;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 14px 84px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: toast.type === 'ok' ? '#166534' : '#991b1b', color: '#fff',
          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          maxWidth: '90%', textAlign: 'center'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>⚔️ TON TRADE WARS</span>
            <button onClick={toggleLang} style={{
              background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
              borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer'
            }}>
              {lang === 'en' ? '中文' : 'EN'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 2 }}>
            {hasVip ? t.subtitleVip : t.subtitleNormal}{hasGenesis ? t.subtitleGenesis : ''}
          </div>
        </div>
        <TonConnectButton />
      </div>

      {/* Balance Card */}
      <div style={{ background: '#131b31', border: '1px solid #1e293b', borderRadius: 14, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.netWorth}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>{netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.cashAvailable}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>{(player?.coins || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e293b' }}>
          <span style={{ fontSize: 11, color: walletAddress ? '#4ade80' : '#f59e0b' }}>
            {walletAddress ? `TON: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : t.walletNotConnected}
          </span>
          <button onClick={shareInvite} style={{
            background: '#1e293b', color: '#38bdf8', border: '1px solid #334155', borderRadius: 8,
            padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer'
          }}>
            {t.inviteBtn}
          </button>
        </div>
      </div>

      {/* Tab: Market */}
      {tab === 'market' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#cbd5e1' }}>{t.marketTitle}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {commodities.map((c) => {
              const changePct = c.prev_price > 0 ? ((c.price - c.prev_price) / c.prev_price) * 100 : 0;
              const owned = holdings.find((h) => h.commodity_id === c.id)?.quantity || 0;
              const isUp = changePct >= 0;
              return (
                <div
                  key={c.id}
                  onClick={() => openTrade(c, 'BUY')}
                  style={{
                    background: '#131b31', border: '1px solid #1e293b', borderRadius: 12, padding: 12,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, cursor: 'pointer'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {c.symbol} <span style={{ fontWeight: 400, fontSize: 11, color: '#94a3b8' }}>· {getCommodityName(c)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                      {t.stock}: {c.npc_stock} · {t.owned}: <span style={{ color: owned > 0 ? '#38bdf8' : '#64748b', fontWeight: 600 }}>{owned}</span>
                    </div>
                  </div>
                  <Sparkline data={c.history || [c.prev_price, c.price]} isUp={isUp} />
                  <div style={{ textAlign: 'right', minWidth: 66 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.price.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: isUp ? '#4ade80' : '#f87171' }}>
                      {isUp ? '+' : ''}{changePct.toFixed(2)}%
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
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#cbd5e1' }}>{t.invTitle}</div>
          {holdings.length === 0 ? (
            <div style={{ background: '#131b31', borderRadius: 12, padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              {t.invEmpty}
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
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.avgCost}: {h.cost_basis.toFixed(2)} · {t.now}: {h.price.toFixed(2)}</div>
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

      {/* Tab: TON Store */}
      {tab === 'store' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#cbd5e1' }}>{t.storeTitle}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {storeItems.map((item) => {
              const meta = getStoreMeta(item);
              const isOwned = !item.repeatable && ownedAssets.includes(item.id);
              const isBusy = buyingId === item.id;
              return (
                <div key={item.id} style={{ background: '#131b31', border: '1px solid #1e293b', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{meta.name}</div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#38bdf8' }}>{item.price_ton} TON</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{meta.desc}</div>
                  <button
                    disabled={isOwned || isBusy}
                    onClick={() => buyStoreItem(item)}
                    style={{
                      width: '100%', padding: 11, borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: isOwned ? 'default' : 'pointer',
                      background: isOwned ? '#1e293b' : '#0ea5e9', color: isOwned ? '#4ade80' : '#0b1020', opacity: isBusy ? 0.6 : 1
                    }}
                  >
                    {isOwned ? t.ownedActive : isBusy ? buyingStatus : t.payTon(item.price_ton)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Leaderboard + Referral */}
      {tab === 'rank' && (
        <div>
          <div style={{ background: '#131b31', border: '1px solid #1e293b', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{t.inviteTitle}</div>
              <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>{t.invited}: {referralCount}</div>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
              {t.inviteDesc1}<strong style={{ color: '#f8fafc' }}>{t.inviteDescBold}</strong>{t.inviteDesc2}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={shareInvite} style={{
                padding: 10, borderRadius: 10, border: 'none', background: '#0ea5e9', color: '#0b1020', fontWeight: 700, fontSize: 12, cursor: 'pointer'
              }}>{t.shareTg}</button>
              <button onClick={copyInvite} style={{
                padding: 10, borderRadius: 10, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', fontWeight: 700, fontSize: 12, cursor: 'pointer'
              }}>{t.copyLink}</button>
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#cbd5e1' }}>{t.rankTitle}</div>
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
                    <div style={{ fontSize: 11, color: '#64748b' }}>{t.cash}: {r.coins.toFixed(0)} · {t.invShort}: {r.inventory_value.toFixed(0)}</div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{selected.symbol} · {getCommodityName(selected)}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18 }}>✕</button>
            </div>

            <div style={{ background: '#131b31', borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.currentPrice}</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{selected.price.toFixed(2)}</div>
              </div>
              <Sparkline
                data={selected.history || [selected.prev_price, selected.price]}
                width={150}
                height={36}
                isUp={selected.price >= selected.prev_price}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setSide('BUY')} style={{
                padding: 10, borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer',
                background: side === 'BUY' ? '#16a34a' : '#1e293b', color: '#fff'
              }}>{t.buy}</button>
              <button onClick={() => setSide('SELL')} style={{
                padding: 10, borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer',
                background: side === 'SELL' ? '#dc2626' : '#1e293b', color: '#fff'
              }}>{t.sell} ({t.owned}: {selectedHolding?.quantity || 0})</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>{t.quantity}</span>
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
                <span>{t.npcPrice(side)}</span><span>{estUnitPrice.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{t.fee} ({hasVip ? t.vipFee : '0.5%'})</span><span>{estFee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14, color: '#fff', paddingTop: 6, borderTop: '1px solid #334155' }}>
                <span>{side === 'BUY' ? t.totalCost : t.netReceive}</span><span>{estTotal.toFixed(2)}</span>
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
              {submitting ? t.processing : t.confirmTrade(side, qty, selected.symbol)}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0f172a', borderTop: '1px solid #1e293b',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', maxWidth: 480, margin: '0 auto'
      }}>
        {([
          ['market', t.navMarket],
          ['inventory', t.navInv],
          ['store', t.navStore],
          ['rank', t.navRank],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '14px 0', background: 'none', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
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
