import { useEffect, useState, useCallback } from 'react';
import { TonConnectUIProvider, TonConnectButton, useTonAddress } from '@tonconnect/ui-react';

const API_BASE = 'https://ton-trade-wars-api.zhangbanzhuan.workers.dev';
const BOT_USERNAME = 'TonTradeWarsbot';

type Lang = 'en' | 'zh';
type RankDim = 'profit' | 'risk' | 'discipline' | 'consistency';

const I18N = {
  en: {
    brand: '⚔️ TRADE ARENA',
    seasonTag: (n: number, d: number) => `SEASON #${n} · ${d}D LEFT`,
    netWorth: 'Total Equity (vUSDT)',
    cashAvailable: 'Available vUSDT',
    roi: 'Season ROI',
    searchPlaceholder: 'Search 20 coins (BTC, TON, SOL...)',
    challengeTitle: '🎯 Daily Market Challenge (Free)',
    challengeDesc: 'Predict BTC direction in 1 hour to earn Discipline Score & Badges',
    btnUp: '📈 Bullish (UP)',
    btnDown: '📉 Bearish (DOWN)',
    challengePending: (dir: string, p: string) => `Picked ${dir} @ $${p} · Auto-settles in 1h`,
    challengeWon: (p: string) => `✅ Won! Settled @ $${p}`,
    challengeLost: (p: string) => `❌ Missed · Settled @ $${p}`,
    marketTitle: '📊 Live Markets (20 Coins · 1m Sync)',
    owned: 'Pos',
    posTitle: '🎒 Open Positions',
    posEmpty: 'No open positions. Tap any coin in Markets to trade!',
    avgCost: 'Avg Entry',
    now: 'Mark',
    arenaTitle: '🏆 Season Leaderboard',
    dimProfit: 'Profit',
    dimRisk: 'Risk',
    dimDiscipline: 'Discipline',
    dimConsistency: 'Stability',
    profileTitle: '👤 Trader Profile',
    winRate: 'Win Rate',
    profitFactor: 'Profit Factor',
    realizedPnl: 'Realized PnL',
    totalTrades: 'Total Trades',
    disciplineScore: 'Discipline Score',
    challengeWins: 'Challenge Wins',
    badgesTitle: '🏅 Achievements & Badges',
    badgeFirst: '🎯 First Trade',
    badgePro: '🔥 Active Trader (10+)',
    badgeWin: '⚡ Challenge Winner',
    badgeDisc: '🛡️ Discipline Master',
    inviteTitle: '🤝 Invite Traders',
    invited: 'Invited',
    shareTg: 'Share in Telegram',
    copyLink: 'Copy Link',
    linkCopied: 'Invite link copied!',
    shareText: '⚔️ Join Trade Arena! Free 10,000 vUSDT to compete in 7-day crypto trading seasons:',
    currentPrice: 'Live Price',
    buy: 'BUY',
    sell: 'SELL',
    buyAmount: 'Order Amount (vUSDT)',
    sellPct: 'Close Position (%)',
    estQty: 'Est. Quantity',
    fee: 'Sim Fee (0.1%)',
    estTotal: 'Est. Value',
    processing: 'Executing...',
    confirmBuy: (amt: number, sym: string) => `Buy $${amt.toFixed(0)} ${sym}`,
    confirmSell: (pct: number, sym: string) => `Sell ${pct}% ${sym}`,
    navMarket: '📊 Market',
    navPos: '🎒 Positions',
    navArena: '🏆 Arena',
    navProfile: '👤 Profile',
  },
  zh: {
    brand: '⚔️ TRADE ARENA',
    seasonTag: (n: number, d: number) => `第 ${n} 赛季 · 剩余 ${d} 天`,
    netWorth: '总资产净值 (虚拟 USDT)',
    cashAvailable: '可用余额',
    roi: '本季收益率',
    searchPlaceholder: '搜索 20 个热门币种 (BTC, TON, SOL...)',
    challengeTitle: '🎯 每日市场挑战 (免费参与)',
    challengeDesc: '预测 BTC 未来 1 小时涨跌，赢取交易纪律分与荣誉勋章',
    btnUp: '📈 看涨 UP',
    btnDown: '📉 看跌 DOWN',
    challengePending: (dir: string, p: string) => `已选 ${dir === 'UP' ? '看涨' : '看跌'} @ $${p} · 1小时后自动结算`,
    challengeWon: (p: string) => `✅ 预测成功！结算价 $${p}`,
    challengeLost: (p: string) => `❌ 未命中 · 结算价 $${p}`,
    marketTitle: '📊 实时模拟盘 (20 热门币 · 每分钟同步)',
    owned: '持仓',
    posTitle: '🎒 当前持仓',
    posEmpty: '暂无持仓，去行情页挑选币种开单吧！',
    avgCost: '开仓均价',
    now: '现价',
    arenaTitle: '🏆 赛季 4 维度排行榜',
    dimProfit: '收益率',
    dimRisk: '风控',
    dimDiscipline: '纪律',
    dimConsistency: '稳定性',
    profileTitle: '👤 交易员个人档案',
    winRate: '胜率',
    profitFactor: '盈亏比',
    realizedPnl: '已实现盈亏',
    totalTrades: '总交易笔数',
    disciplineScore: '交易纪律分',
    challengeWins: '挑战胜场',
    badgesTitle: '🏅 成就与荣誉勋章',
    badgeFirst: '🎯 首次成交',
    badgePro: '🔥 活跃交易员 (10+)',
    badgeWin: '⚡ 每日挑战胜者',
    badgeDisc: '🛡️ 纪律大师',
    inviteTitle: '🤝 邀请好友参赛',
    invited: '已邀请',
    shareTg: '转发到 Telegram',
    copyLink: '复制邀请链接',
    linkCopied: '邀请链接已复制！',
    shareText: '⚔️ 来 Trade Arena 参加 7 天虚拟加密交易赛季！免费领 10,000 虚拟 USDT 冲榜：',
    currentPrice: '实时市价',
    buy: '买入',
    sell: '卖出平仓',
    buyAmount: '买入金额 (vUSDT)',
    sellPct: '卖出仓位比例 (%)',
    estQty: '预计数量',
    fee: '模拟手续费 (0.1%)',
    estTotal: '预计金额',
    processing: '撮合中...',
    confirmBuy: (amt: number, sym: string) => `买入 $${amt.toFixed(0)} ${sym}`,
    confirmSell: (pct: number, sym: string) => `卖出 ${pct}% ${sym}`,
    navMarket: '📊 行情',
    navPos: '🎒 持仓',
    navArena: '🏆 赛季榜',
    navProfile: '👤 档案',
  },
} as const;

interface Commodity {
  id: string;
  symbol: string;
  name: string;
  price: number;
  prev_price: number;
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

interface ProfileStats {
  total_trades: number;
  sell_trades: number;
  win_trades: number;
  win_rate: number;
  total_realized_pnl: number;
  profit_factor: number;
  discipline_score: number;
  challenge_wins: number;
}

interface DailyChallenge {
  id: string;
  challenge_date: string;
  commodity_id: string;
  direction: 'UP' | 'DOWN';
  entry_price: number;
  settle_price?: number;
  status: 'PENDING' | 'WON' | 'LOST';
}

interface SeasonInfo {
  season_number: number;
  days_left: number;
}

interface RankItem {
  id: string;
  username?: string;
  first_name?: string;
  net_worth: number;
  roi_pct: number;
  win_rate: number;
  risk_score: number;
  discipline_score: number;
  consistency_score: number;
  total_trades: number;
}

function fmtPrice(p: number): string {
  if (!Number.isFinite(p)) return '0.00';
  if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(8);
}

function fmtQty(q: number): string {
  if (q >= 1000) return q.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (q >= 1) return q.toFixed(4);
  return q.toFixed(6);
}

function getInitialLang(): Lang {
  const saved = localStorage.getItem('tw_lang');
  if (saved === 'zh' || saved === 'en') return saved;
  const tgLang = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code || navigator.language || 'en';
  return String(tgLang).toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function Sparkline({ data, width = 64, height = 24, isUp }: { data: number[]; width?: number; height?: number; isUp: boolean }) {
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
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline fill="none" stroke={isUp ? '#4ade80' : '#f87171'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
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

function TradeArenaApp() {
  const walletAddress = useTonAddress();
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const [tab, setTab] = useState<'market' | 'positions' | 'arena' | 'profile'>('market');
  const [rankDim, setRankDim] = useState<RankDim>('profit');
  const [search, setSearch] = useState('');

  const [player, setPlayer] = useState<Player | null>(null);
  const [season, setSeason] = useState<SeasonInfo>({ season_number: 1, days_left: 7 });
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [todayChallenge, setTodayChallenge] = useState<DailyChallenge | null>(null);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<RankItem[]>([]);

  const [selected, setSelected] = useState<Commodity | null>(null);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [buyUsd, setBuyUsd] = useState<number>(500);
  const [sellPct, setSellPct] = useState<number>(100);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const t = I18N[lang];

  const toggleLang = () => {
    const next: Lang = lang === 'en' ? 'zh' : 'en';
    setLang(next);
    localStorage.setItem('tw_lang', next);
  };

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const loadAll = useCallback(async () => {
    const user = getTelegramContext();
    try {
      const [mktRes, plrRes] = await Promise.all([
        fetch(`${API_BASE}/api/market`).then((r) => r.json()),
        fetch(`${API_BASE}/api/player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...user, wallet_address: walletAddress || undefined }),
        }).then((r) => r.json()),
      ]);
      if (mktRes.ok) {
        setCommodities(mktRes.data || []);
        if (mktRes.season) setSeason(mktRes.season);
      }
      if (plrRes.ok) {
        setPlayer(plrRes.data.player);
        setHoldings(plrRes.data.holdings || []);
        setProfile(plrRes.data.profile || null);
        setTodayChallenge(plrRes.data.today_challenge || null);
        setReferralCount(plrRes.data.referral_count || 0);
        if (plrRes.data.season) setSeason(plrRes.data.season);
      }
    } catch (e: any) {
      showToast('err', e.message || 'Network error');
    }
  }, [walletAddress]);

  const loadRank = useCallback(async (dim: RankDim) => {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard?dim=${dim}`).then((r) => r.json());
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
    if (tab === 'arena') loadRank(rankDim);
  }, [tab, rankDim, loadRank]);

  const inventoryValue = holdings.reduce((sum, h) => sum + h.quantity * h.price, 0);
  const netWorth = (player?.coins || 0) + inventoryValue;
  const roiPct = ((netWorth - 10000) / 10000) * 100;
  const inviteLink = player ? `https://t.me/${BOT_USERNAME}?startapp=ref_${player.telegram_id}` : '';

  const shareInvite = () => {
    if (!inviteLink) return;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(t.shareText)}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank');
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

  const submitChallenge = async (direction: 'UP' | 'DOWN') => {
    if (!player || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: player.telegram_id, direction, commodity_id: 'cmd_btc' }),
      }).then((r) => r.json());
      if (res.ok) {
        showToast('ok', t.challengePending(direction, fmtPrice(res.data.entry_price)));
        await loadAll();
      } else {
        showToast('err', res.error || 'Failed');
      }
    } catch (e: any) {
      showToast('err', e.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const openTrade = (item: Commodity, defaultSide: 'BUY' | 'SELL' = 'BUY') => {
    setSelected(item);
    setSide(defaultSide);
    setBuyUsd(Math.min(500, Math.max(100, Math.floor((player?.coins || 1000) / 2))));
    setSellPct(100);
  };

  const executeTrade = async () => {
    if (!selected || !player || submitting) return;
    setSubmitting(true);
    try {
      const payload: any = {
        telegram_id: player.telegram_id,
        commodity_id: selected.id,
        side,
        idempotency_key: `${player.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
      if (side === 'BUY') payload.amount_usdt = buyUsd;
      else payload.sell_pct = sellPct;

      const res = await fetch(`${API_BASE}/api/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.ok) {
        const pnlStr = side === 'SELL' && res.data.realizedPnl !== undefined
          ? ` (PnL: ${res.data.realizedPnl >= 0 ? '+' : ''}$${res.data.realizedPnl.toFixed(2)})`
          : '';
        showToast('ok', `${side} ${fmtQty(res.data.qty)} ${selected.symbol} @ $${fmtPrice(res.data.unitPrice)}${pnlStr}`);
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

  const filteredCoins = commodities.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });

  const selectedHolding = selected ? holdings.find((h) => h.commodity_id === selected.id) : null;
  const estExecPrice = selected
    ? selected.price * (side === 'BUY' ? 1 + (selected.spread_pct || 0.002) / 2 : 1 - (selected.spread_pct || 0.002) / 2)
    : 0;
  const estOrderValue = side === 'BUY'
    ? buyUsd
    : (selectedHolding ? selectedHolding.quantity * (sellPct / 100) * estExecPrice : 0);
  const estQty = estExecPrice > 0 ? estOrderValue / estExecPrice : 0;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 14px 86px' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: toast.type === 'ok' ? '#166534' : '#991b1b', color: '#fff',
          padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
          maxWidth: '92%', textAlign: 'center'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 0.4 }}>{t.brand}</span>
            <button onClick={toggleLang} style={{
              background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
              borderRadius: 6, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer'
            }}>
              {lang === 'en' ? '中文' : 'EN'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700, marginTop: 2 }}>
            {t.seasonTag(season.season_number, season.days_left)}
          </div>
        </div>
        <TonConnectButton />
      </div>

      {/* Equity Card */}
      <div style={{ background: 'linear-gradient(135deg, #131b31 0%, #0f172a 100%)', border: '1px solid #1e293b', borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.netWorth}</div>
            <div style={{ fontSize: 23, fontWeight: 800, color: '#f8fafc' }}>
              ${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.roi}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: roiPct >= 0 ? '#4ade80' : '#f87171' }}>
              {roiPct >= 0 ? '+' : ''}{roiPct.toFixed(2)}%
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e293b', fontSize: 11 }}>
          <span style={{ color: '#94a3b8' }}>{t.cashAvailable}: <strong style={{ color: '#4ade80' }}>${(player?.coins || 0).toFixed(2)}</strong></span>
          <span style={{ color: '#94a3b8' }}>{t.disciplineScore}: <strong style={{ color: '#38bdf8' }}>{profile?.discipline_score ?? 50}/100</strong></span>
        </div>
      </div>

      {/* Tab: Market */}
      {tab === 'market' && (
        <div>
          {/* Daily Challenge Card */}
          <div style={{ background: '#131b31', border: '1px solid #1e3a5f', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', marginBottom: 4 }}>{t.challengeTitle}</div>
            {!todayChallenge ? (
              <>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>{t.challengeDesc}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button disabled={submitting} onClick={() => submitChallenge('UP')} style={{
                    padding: '9px 0', borderRadius: 9, border: 'none', background: '#166534', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer'
                  }}>{t.btnUp}</button>
                  <button disabled={submitting} onClick={() => submitChallenge('DOWN')} style={{
                    padding: '9px 0', borderRadius: 9, border: 'none', background: '#991b1b', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer'
                  }}>{t.btnDown}</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 700, color: todayChallenge.status === 'WON' ? '#4ade80' : todayChallenge.status === 'LOST' ? '#f87171' : '#facc15' }}>
                {todayChallenge.status === 'PENDING'
                  ? t.challengePending(todayChallenge.direction, fmtPrice(todayChallenge.entry_price))
                  : todayChallenge.status === 'WON'
                    ? t.challengeWon(fmtPrice(todayChallenge.settle_price || todayChallenge.entry_price))
                    : t.challengeLost(fmtPrice(todayChallenge.settle_price || todayChallenge.entry_price))}
              </div>
            )}
          </div>

          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
              border: '1px solid #1e293b', background: '#0f172a', color: '#f8fafc', fontSize: 12, marginBottom: 10
            }}
          />

          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#94a3b8' }}>{t.marketTitle}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredCoins.map((c) => {
              const changePct = c.prev_price > 0 ? ((c.price - c.prev_price) / c.prev_price) * 100 : 0;
              const owned = holdings.find((h) => h.commodity_id === c.id);
              const isUp = changePct >= 0;
              return (
                <div
                  key={c.id}
                  onClick={() => openTrade(c, 'BUY')}
                  style={{
                    background: '#131b31', border: '1px solid #1e293b', borderRadius: 12, padding: '10px 12px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, cursor: 'pointer'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>
                      {c.symbol} <span style={{ fontWeight: 400, fontSize: 11, color: '#94a3b8' }}>{c.name}</span>
                    </div>
                    {owned && (
                      <div style={{ fontSize: 10, color: '#38bdf8', marginTop: 2 }}>
                        {t.owned}: {fmtQty(owned.quantity)} (${(owned.quantity * c.price).toFixed(2)})
                      </div>
                    )}
                  </div>
                  <Sparkline data={c.history || [c.prev_price, c.price]} isUp={isUp} />
                  <div style={{ textAlign: 'right', minWidth: 74 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>${fmtPrice(c.price)}</div>
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

      {/* Tab: Positions */}
      {tab === 'positions' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#cbd5e1' }}>{t.posTitle}</div>
          {holdings.length === 0 ? (
            <div style={{ background: '#131b31', borderRadius: 12, padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              {t.posEmpty}
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
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{h.symbol} <span style={{ color: '#38bdf8', fontSize: 12 }}>{fmtQty(h.quantity)}</span></div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.avgCost}: ${fmtPrice(h.cost_basis)} · {t.now}: ${fmtPrice(h.price)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>${(h.quantity * h.price).toFixed(2)}</div>
                      <div style={{ fontSize: 11, color: pnl >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: 4-Dimension Season Leaderboard */}
      {tab === 'arena' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#cbd5e1' }}>{t.arenaTitle}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
            {([
              ['profit', t.dimProfit],
              ['risk', t.dimRisk],
              ['discipline', t.dimDiscipline],
              ['consistency', t.dimConsistency],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setRankDim(key)} style={{
                padding: '8px 4px', borderRadius: 9, border: '1px solid #334155', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: rankDim === key ? '#0ea5e9' : '#131b31', color: rankDim === key ? '#0b1020' : '#cbd5e1'
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leaderboard.map((r, idx) => {
              let mainVal = `${r.roi_pct >= 0 ? '+' : ''}${r.roi_pct.toFixed(2)}%`;
              if (rankDim === 'risk') mainVal = `${r.risk_score} pts`;
              if (rankDim === 'discipline') mainVal = `${r.discipline_score}/100`;
              if (rankDim === 'consistency') mainVal = `${r.consistency_score} pts`;
              return (
                <div key={r.id} style={{
                  background: '#131b31', border: '1px solid #1e293b', borderRadius: 12, padding: '10px 12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 24, fontWeight: 800, color: idx < 3 ? '#facc15' : '#64748b' }}>#{idx + 1}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.first_name || r.username || 'Trader'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        ${r.net_worth.toFixed(0)} · {t.winRate} {r.win_rate}% · {r.total_trades}T
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#4ade80' }}>{mainVal}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Trader Profile */}
      {tab === 'profile' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#cbd5e1' }}>{t.profileTitle}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              [t.winRate, `${profile?.win_rate ?? 0}%`, '#38bdf8'],
              [t.profitFactor, `${profile?.profit_factor ?? 0}`, '#facc15'],
              [t.realizedPnl, `${(profile?.total_realized_pnl ?? 0) >= 0 ? '+' : ''}$${(profile?.total_realized_pnl ?? 0).toFixed(2)}`, (profile?.total_realized_pnl ?? 0) >= 0 ? '#4ade80' : '#f87171'],
              [t.totalTrades, `${profile?.total_trades ?? 0}`, '#f8fafc'],
              [t.disciplineScore, `${profile?.discipline_score ?? 50}/100`, '#38bdf8'],
              [t.challengeWins, `${profile?.challenge_wins ?? 0}`, '#4ade80'],
            ].map(([label, val, col]) => (
              <div key={label} style={{ background: '#131b31', border: '1px solid #1e293b', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: col, marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Badges */}
          <div style={{ background: '#131b31', border: '1px solid #1e293b', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{t.badgesTitle}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: t.badgeFirst, unlocked: (profile?.total_trades ?? 0) >= 1 },
                { label: t.badgePro, unlocked: (profile?.total_trades ?? 0) >= 10 },
                { label: t.badgeWin, unlocked: (profile?.challenge_wins ?? 0) >= 1 },
                { label: t.badgeDisc, unlocked: (profile?.discipline_score ?? 0) >= 75 },
              ].map((b) => (
                <span key={b.label} style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: b.unlocked ? '#1e3a5f' : '#0f172a',
                  color: b.unlocked ? '#38bdf8' : '#475569',
                  border: `1px solid ${b.unlocked ? '#38bdf8' : '#1e293b'}`
                }}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* Invite */}
          <div style={{ background: '#131b31', border: '1px solid #1e293b', borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{t.inviteTitle}</div>
              <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>{t.invited}: {referralCount}</div>
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
        </div>
      )}

      {/* Trade Modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 50,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }} onClick={() => setSelected(null)}>
          <div style={{
            width: '100%', maxWidth: 480, background: '#0f172a', borderTop: '1px solid #334155',
            borderRadius: '18px 18px 0 0', padding: 18
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{selected.symbol} · {selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18 }}>✕</button>
            </div>

            <div style={{ background: '#131b31', borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.currentPrice}</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>${fmtPrice(selected.price)}</div>
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
              }}>{t.sell} ({selectedHolding ? fmtQty(selectedHolding.quantity) : '0'})</button>
            </div>

            {side === 'BUY' ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{t.buyAmount}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                  {[100, 500, 1000, 2500].map((amt) => (
                    <button key={amt} onClick={() => setBuyUsd(amt)} style={{
                      padding: '8px 0', borderRadius: 8, border: '1px solid #334155', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                      background: buyUsd === amt ? '#38bdf8' : '#1e293b', color: buyUsd === amt ? '#0b1020' : '#f1f5f9'
                    }}>${amt}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{t.sellPct}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} onClick={() => setSellPct(pct)} style={{
                      padding: '8px 0', borderRadius: 8, border: '1px solid #334155', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                      background: sellPct === pct ? '#f87171' : '#1e293b', color: sellPct === pct ? '#0b1020' : '#f1f5f9'
                    }}>{pct}%</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: '#1e293b', borderRadius: 10, padding: 12, fontSize: 12, color: '#cbd5e1', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{t.estQty}</span><span>{fmtQty(estQty)} {selected.symbol}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{t.fee}</span><span>${(estOrderValue * 0.001).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14, color: '#fff', paddingTop: 6, borderTop: '1px solid #334155' }}>
                <span>{t.estTotal}</span><span>${estOrderValue.toFixed(2)}</span>
              </div>
            </div>

            <button
              disabled={submitting || estOrderValue <= 0}
              onClick={executeTrade}
              style={{
                width: '100%', padding: 13, borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                background: side === 'BUY' ? '#22c55e' : '#ef4444', color: '#0b1020', opacity: submitting || estOrderValue <= 0 ? 0.5 : 1
              }}
            >
              {submitting ? t.processing : (side === 'BUY' ? t.confirmBuy(buyUsd, selected.symbol) : t.confirmSell(sellPct, selected.symbol))}
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
          ['positions', t.navPos],
          ['arena', t.navArena],
          ['profile', t.navProfile],
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
      <TradeArenaApp />
    </TonConnectUIProvider>
  );
}
