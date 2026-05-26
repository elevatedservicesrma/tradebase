/* ═══════════════════════════════════════════════
   TRADEBASE — PAPER TRADING ENGINE v1.0
   Full simulated brokerage experience
═══════════════════════════════════════════════ */
(function () {
'use strict';

/* ── CONFIG ── */
const CFG = {
  KEY: 'tb_paper_v2',
  TICK: 3000,
  SPREAD_BPS: 5,
  SLIP_BPS: 2,
  MAX_HIST: 500,
  VOL: { stocks:.001, indices:.0005, commodities:.0008, forex:.0003, crypto:.002 },
};

/* ── TRADABLE UNIVERSE ── */
const UNI = [
  { s:'AAPL',   n:'Apple Inc.',       c:'stocks',      bp:227.82 },
  { s:'MSFT',   n:'Microsoft',        c:'stocks',      bp:419.50 },
  { s:'NVDA',   n:'NVIDIA Corp.',     c:'stocks',      bp:875.40 },
  { s:'TSLA',   n:'Tesla Inc.',       c:'stocks',      bp:182.63 },
  { s:'AMZN',   n:'Amazon.com',       c:'stocks',      bp:195.80 },
  { s:'META',   n:'Meta Platforms',   c:'stocks',      bp:528.20 },
  { s:'GOOGL',  n:'Alphabet',         c:'stocks',      bp:162.40 },
  { s:'JPM',    n:'JPMorgan Chase',   c:'stocks',      bp:245.60 },
  { s:'SPY',    n:'S&P 500 ETF',      c:'indices',     bp:548.90 },
  { s:'QQQ',    n:'NASDAQ-100 ETF',   c:'indices',     bp:462.15 },
  { s:'DIA',    n:'Dow Jones ETF',    c:'indices',     bp:421.30 },
  { s:'IWM',    n:'Russell 2000',     c:'indices',     bp:207.40 },
  { s:'GLD',    n:'Gold (GLD)',       c:'commodities', bp:242.30 },
  { s:'SLV',    n:'Silver (SLV)',     c:'commodities', bp:31.42  },
  { s:'USO',    n:'Crude Oil (USO)',  c:'commodities', bp:76.40  },
  { s:'UNG',    n:'Nat Gas (UNG)',    c:'commodities', bp:12.84  },
  { s:'EUR/USD',n:'Euro / Dollar',    c:'forex',       bp:1.0842 },
  { s:'GBP/USD',n:'Pound / Dollar',   c:'forex',       bp:1.2740 },
  { s:'USD/JPY',n:'Dollar / Yen',     c:'forex',       bp:151.82 },
  { s:'AUD/USD',n:'Aussie / Dollar',  c:'forex',       bp:0.6524 },
  { s:'BTC',    n:'Bitcoin',          c:'crypto',      bp:87420  },
  { s:'ETH',    n:'Ethereum',         c:'crypto',      bp:3480   },
  { s:'SOL',    n:'Solana',           c:'crypto',      bp:178.40 },
  { s:'XRP',    n:'XRP',              c:'crypto',      bp:0.6240 },
];
const AMAP = {}; UNI.forEach(a => AMAP[a.s] = a);

/* ── STATE ── */
let acct = null;
let prices = {};
let panel = 'pt-dash';
let selAsset = null;
let orderSide = 'buy';
let orderType = 'market';
let tickTimer = null;
let ready = false;
let assetFilter = '';

/* ══════════════════════════════════
   PERSISTENCE
══════════════════════════════════ */
function save() { if (acct) localStorage.setItem(CFG.KEY, JSON.stringify(acct)); }
function load() { try { return JSON.parse(localStorage.getItem(CFG.KEY)); } catch { return null; } }

function makeAcct(bal, cur, commOn, commAmt, commType) {
  return {
    startBal: bal, cash: bal, currency: cur || 'USD',
    commOn: commOn || false, commAmt: commAmt || 0, commType: commType || 'per-trade',
    positions: {}, pending: [], trades: [], orders: [],
    created: Date.now(), peak: bal,
    equity: [{ t: Date.now(), v: bal }],
  };
}

/* ══════════════════════════════════
   PRICE ENGINE
══════════════════════════════════ */
function initPrices() { UNI.forEach(a => { prices[a.s] = a.bp; }); }

function tick() {
  UNI.forEach(a => {
    const v = CFG.VOL[a.c] || .001;
    prices[a.s] = Math.max(0.0001, prices[a.s] + prices[a.s] * v * (Math.random() - .5) * 2);
  });
  if (acct) {
    checkPending();
    if (Math.random() < .1) {
      const val = acctValue();
      acct.equity.push({ t: Date.now(), v: val });
      if (val > acct.peak) acct.peak = val;
      if (acct.equity.length > 500) acct.equity = acct.equity.slice(-500);
      save();
    }
  }
  if (ready) renderPanel();
}

function price(s) { return prices[s] || 0; }
function bid(s) { return price(s) * (1 - CFG.SPREAD_BPS / 10000); }
function ask(s) { return price(s) * (1 + CFG.SPREAD_BPS / 10000); }

/* ══════════════════════════════════
   ACCOUNT MATH
══════════════════════════════════ */
function posValue() {
  let t = 0;
  for (const s in acct.positions) { const p = acct.positions[s]; if (p.qty > 0) t += p.qty * price(s); }
  return t;
}
function acctValue() { return acct ? acct.cash + posValue() : 0; }
function totalPL() { return acctValue() - acct.startBal; }
function totalPLPct() { return (totalPL() / acct.startBal) * 100; }

function unrealPL() {
  let t = 0;
  for (const s in acct.positions) {
    const p = acct.positions[s];
    if (p.qty > 0) t += (price(s) - p.avg) * p.qty;
  }
  return t;
}
function realPL() {
  return acct.trades.filter(t => t.side === 'sell').reduce((s, t) => s + (t.pl || 0), 0);
}

function posPL(s) {
  const p = acct.positions[s];
  if (!p || !p.qty) return { pl: 0, pct: 0 };
  return { pl: (price(s) - p.avg) * p.qty, pct: ((price(s) - p.avg) / p.avg) * 100 };
}

/* ══════════════════════════════════
   ORDER ENGINE
══════════════════════════════════ */
function genId() { return 'o' + Date.now().toString(36) + Math.random().toString(36).substr(2,4); }

function commission(qty) {
  if (!acct.commOn) return 0;
  return acct.commType === 'per-share' ? qty * acct.commAmt : acct.commAmt;
}

function placeOrder(sym, side, type, qty, lim) {
  qty = parseFloat(qty);
  if (!AMAP[sym] || isNaN(qty) || qty <= 0) return { ok: false, err: 'Invalid order' };
  const comm = commission(qty);

  if (type === 'market') {
    const p = side === 'buy' ? ask(sym) : bid(sym);
    const slip = p * (CFG.SLIP_BPS / 10000) * (side === 'buy' ? 1 : -1);
    return execTrade(sym, side, qty, p + slip, comm, 'market');
  }

  lim = parseFloat(lim);
  if (isNaN(lim) || lim <= 0) return { ok: false, err: 'Invalid limit price' };

  if (side === 'buy' && lim >= ask(sym)) return execTrade(sym, side, qty, ask(sym), comm, 'limit');
  if (side === 'sell' && lim <= bid(sym)) return execTrade(sym, side, qty, bid(sym), comm, 'limit');

  const ord = { id: genId(), sym, side, type: 'limit', qty, lim, comm, status: 'pending', at: Date.now() };
  acct.pending.push(ord);
  acct.orders.push({ ...ord });
  save();
  return { ok: true, msg: 'Limit order placed — ' + sym };
}

function execTrade(sym, side, qty, p, comm, oType) {
  const cost = qty * p + comm;
  if (side === 'buy') {
    if (cost > acct.cash) return { ok: false, err: 'Insufficient funds ($' + fmt(cost) + ' needed, $' + fmt(acct.cash) + ' available)' };
    acct.cash -= cost;
    const pos = acct.positions[sym] || { qty: 0, avg: 0 };
    const nq = pos.qty + qty;
    pos.avg = (pos.qty * pos.avg + qty * p) / nq;
    pos.qty = nq;
    acct.positions[sym] = pos;
    const tr = { id: genId(), sym, side, qty, price: p, total: cost, comm, oType, at: Date.now(), pl: 0 };
    acct.trades.push(tr);
    acct.orders.push({ ...tr, status: 'filled' });
  } else {
    const pos = acct.positions[sym];
    if (!pos || pos.qty < qty) return { ok: false, err: 'Not enough shares (own ' + (pos ? pos.qty : 0) + ')' };
    const pl = (p - pos.avg) * qty - comm;
    acct.cash += qty * p - comm;
    pos.qty -= qty;
    if (pos.qty <= 0) delete acct.positions[sym]; else pos.totalCost = pos.qty * pos.avg;
    const tr = { id: genId(), sym, side, qty, price: p, total: qty * p, comm, oType, at: Date.now(), pl };
    acct.trades.push(tr);
    acct.orders.push({ ...tr, status: 'filled' });
  }
  if (acct.trades.length > CFG.MAX_HIST) acct.trades = acct.trades.slice(-CFG.MAX_HIST);
  save();
  return { ok: true, msg: side.toUpperCase() + ' ' + qty + ' ' + sym + ' @ $' + fmt(p) };
}

function checkPending() {
  const rm = [];
  acct.pending.forEach((o, i) => {
    let fill = false;
    if (o.side === 'buy' && ask(o.sym) <= o.lim) fill = true;
    if (o.side === 'sell' && bid(o.sym) >= o.lim) fill = true;
    if (fill) {
      const r = execTrade(o.sym, o.side, o.qty, o.lim, o.comm, 'limit');
      if (r.ok) {
        rm.push(i);
        const hi = acct.orders.findIndex(x => x.id === o.id);
        if (hi >= 0) acct.orders[hi].status = 'filled';
        toast(r.msg, 'success');
      }
    }
  });
  rm.reverse().forEach(i => acct.pending.splice(i, 1));
  if (rm.length) save();
}

function cancelOrd(id) {
  const i = acct.pending.findIndex(o => o.id === id);
  if (i < 0) return;
  acct.pending.splice(i, 1);
  const hi = acct.orders.findIndex(o => o.id === id);
  if (hi >= 0) acct.orders[hi].status = 'cancelled';
  save();
  toast('Order cancelled', 'info');
}

function closePos(sym) {
  const p = acct.positions[sym];
  if (!p || p.qty <= 0) return;
  const r = placeOrder(sym, 'sell', 'market', p.qty);
  if (r.ok) toast(r.msg, 'success'); else toast(r.err, 'error');
}

/* ══════════════════════════════════
   ANALYTICS
══════════════════════════════════ */
function analytics() {
  const sells = acct.trades.filter(t => t.side === 'sell');
  const wins = sells.filter(t => t.pl > 0);
  const losses = sells.filter(t => t.pl < 0);
  return {
    val: acctValue(), cash: acct.cash, totalPL: totalPL(), totalPct: totalPLPct(),
    unreal: unrealPL(), real: realPL(),
    trades: acct.trades.length, closed: sells.length,
    posCount: Object.keys(acct.positions).filter(s => acct.positions[s].qty > 0).length,
    winRate: sells.length ? (wins.length / sells.length * 100) : 0,
    avgWin: wins.length ? wins.reduce((s, t) => s + t.pl, 0) / wins.length : 0,
    avgLoss: losses.length ? Math.abs(losses.reduce((s, t) => s + t.pl, 0) / losses.length) : 0,
    best: sells.length ? sells.reduce((b, t) => t.pl > b.pl ? t : b, sells[0]) : null,
    worst: sells.length ? sells.reduce((w, t) => t.pl < w.pl ? t : w, sells[0]) : null,
    maxDD: acct.peak > 0 ? Math.max(0, ((acct.peak - acctValue()) / acct.peak) * 100) : 0,
    pf: losses.length && losses.reduce((s,t) => s + t.pl, 0) !== 0
      ? wins.reduce((s,t) => s + t.pl, 0) / Math.abs(losses.reduce((s,t) => s + t.pl, 0)) : 0,
  };
}

/* ══════════════════════════════════
   HELPERS
══════════════════════════════════ */
function fmt(n, d) {
  d = d !== undefined ? d : 2;
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function cur(n) { return (n < 0 ? '-$' : '$') + fmt(Math.abs(n)); }
function cls(n) { return n >= 0 ? 'up' : 'down'; }
function sign(n) { return n >= 0 ? '+' : ''; }
function ago(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'Just now'; if (d < 3600) return Math.floor(d/60)+'m ago';
  if (d < 86400) return Math.floor(d/3600)+'h ago'; return Math.floor(d/86400)+'d ago';
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

/* ══════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════ */
function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'pt-toast pt-toast-' + (type || 'success');
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('vis'));
  setTimeout(() => { el.classList.remove('vis'); setTimeout(() => el.remove(), 300); }, 3000);
}

/* ══════════════════════════════════
   UI — SETUP MODAL
══════════════════════════════════ */
function renderSetup() {
  const c = document.getElementById('pt-content');
  c.innerHTML = `
  <div class="pt-setup-wrap">
    <div class="pt-setup">
      <div class="pt-setup-icon"><i data-lucide="wallet" class="icon icon-xl"></i></div>
      <h2>Set Up Paper Trading Account</h2>
      <p class="pt-setup-sub">Choose your starting balance and preferences. You can reset anytime.</p>

      <label class="pt-label">Starting Balance</label>
      <div class="pt-bal-grid" id="bal-grid">
        <button class="pt-bal-btn" data-amt="10000">$10,000</button>
        <button class="pt-bal-btn" data-amt="25000">$25,000</button>
        <button class="pt-bal-btn active" data-amt="50000">$50,000</button>
        <button class="pt-bal-btn" data-amt="100000">$100,000</button>
        <button class="pt-bal-btn" data-amt="250000">$250,000</button>
        <button class="pt-bal-btn" data-amt="500000">$500,000</button>
      </div>
      <label class="pt-label" style="margin-top:8px;">Or enter custom amount</label>
      <input type="number" id="custom-bal" class="pt-input" placeholder="e.g. 75000" min="100" step="1000"/>

      <label class="pt-label">Account Currency</label>
      <select id="acct-cur" class="pt-input">
        <option value="USD" selected>USD — US Dollar</option>
        <option value="EUR">EUR — Euro</option>
        <option value="GBP">GBP — British Pound</option>
        <option value="CAD">CAD — Canadian Dollar</option>
        <option value="AUD">AUD — Australian Dollar</option>
        <option value="JPY">JPY — Japanese Yen</option>
      </select>

      <label class="pt-label">Commission Settings</label>
      <div class="pt-comm-row">
        <label class="pt-toggle-label">
          <input type="checkbox" id="comm-toggle"/> Enable commissions
        </label>
      </div>
      <div id="comm-fields" style="display:none;margin-top:8px;">
        <div class="pt-comm-row">
          <select id="comm-type" class="pt-input" style="flex:1;">
            <option value="per-trade">Per trade (flat fee)</option>
            <option value="per-share">Per share/unit</option>
          </select>
          <input type="number" id="comm-amt" class="pt-input" placeholder="Amount" min="0" step="0.01" style="flex:1;"/>
        </div>
      </div>

      <button class="pt-btn-primary pt-btn-lg" id="start-btn">Start Trading</button>
    </div>
  </div>`;

  let selectedBal = 50000;

  c.querySelectorAll('.pt-bal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      c.querySelectorAll('.pt-bal-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedBal = parseInt(btn.dataset.amt);
      document.getElementById('custom-bal').value = '';
    });
  });

  document.getElementById('comm-toggle').addEventListener('change', function() {
    document.getElementById('comm-fields').style.display = this.checked ? 'flex' : 'none';
  });

  document.getElementById('custom-bal').addEventListener('input', function() {
    if (this.value) {
      c.querySelectorAll('.pt-bal-btn').forEach(b => b.classList.remove('active'));
      selectedBal = parseFloat(this.value);
    }
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('start-btn').addEventListener('click', () => {
    const bal = selectedBal || 50000;
    if (bal < 100) { toast('Minimum balance is $100', 'error'); return; }
    const cur = document.getElementById('acct-cur').value;
    const commOn = document.getElementById('comm-toggle').checked;
    const commType = document.getElementById('comm-type').value;
    const commAmt = parseFloat(document.getElementById('comm-amt').value) || 0;
    acct = makeAcct(bal, cur, commOn, commAmt, commType);
    save();
    ready = true;
    panel = 'pt-dash';
    renderNav();
    renderPanel();
    toast('Paper trading account created with ' + cur + ' ' + fmt(bal) + '!', 'success');
  });
}

/* ══════════════════════════════════
   UI — SUB NAVIGATION
══════════════════════════════════ */
function renderNav() {
  const nav = document.getElementById('pt-nav');
  if (!nav) return;
  const tabs = [
    { id:'pt-dash', icon:'<i data-lucide="layout-dashboard" class="icon icon-sm"></i>', label:'Dashboard' },
    { id:'pt-trade', icon:'<i data-lucide="arrow-up-down" class="icon icon-sm"></i>', label:'Trade' },
    { id:'pt-port', icon:'<i data-lucide="briefcase" class="icon icon-sm"></i>', label:'Portfolio' },
    { id:'pt-hist', icon:'<i data-lucide="clipboard-list" class="icon icon-sm"></i>', label:'History' },
    { id:'pt-stats', icon:'<i data-lucide="trending-up" class="icon icon-sm"></i>', label:'Analytics' },
    { id:'pt-settings', icon:'<i data-lucide="settings" class="icon icon-sm"></i>', label:'Settings' },
  ];
  nav.innerHTML = tabs.map(t =>
    `<button class="pt-tab${panel === t.id ? ' active' : ''}" data-panel="${t.id}">
      <span class="pt-tab-icon">${t.icon}</span>${t.label}
    </button>`
  ).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showPanel(id) {
  panel = id;
  renderNav();
  renderPanel();
}

/* ══════════════════════════════════
   UI — PANEL ROUTER
══════════════════════════════════ */
function renderPanel() {
  if (!acct) { renderSetup(); return; }
  const fns = {
    'pt-dash': renderDash,
    'pt-trade': renderTrade,
    'pt-port': renderPort,
    'pt-hist': renderHist,
    'pt-stats': renderStats,
    'pt-settings': renderSettings,
  };
  (fns[panel] || renderDash)();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ══════════════════════════════════
   UI — DASHBOARD
══════════════════════════════════ */
function renderDash() {
  const a = analytics();
  const positions = Object.keys(acct.positions).filter(s => acct.positions[s].qty > 0);
  const recent = acct.trades.slice(-5).reverse();

  const c = document.getElementById('pt-content');
  c.innerHTML = `
  <div class="pt-stat-grid pt-stat-grid-4">
    <div class="pt-card pt-stat-card">
      <div class="pt-stat-label">Account Value</div>
      <div class="pt-stat-value">${cur(a.val)}</div>
      <div class="pt-stat-sub ${cls(a.totalPL)}">${sign(a.totalPct)}${fmt(a.totalPct)}% all time</div>
    </div>
    <div class="pt-card pt-stat-card">
      <div class="pt-stat-label">Cash Balance</div>
      <div class="pt-stat-value">${cur(a.cash)}</div>
      <div class="pt-stat-sub">${fmt((a.cash / a.val) * 100)}% of portfolio</div>
    </div>
    <div class="pt-card pt-stat-card">
      <div class="pt-stat-label">Unrealized P&L</div>
      <div class="pt-stat-value ${cls(a.unreal)}">${sign(a.unreal)}${cur(a.unreal)}</div>
      <div class="pt-stat-sub">${a.posCount} open position${a.posCount !== 1 ? 's' : ''}</div>
    </div>
    <div class="pt-card pt-stat-card">
      <div class="pt-stat-label">Realized P&L</div>
      <div class="pt-stat-value ${cls(a.real)}">${sign(a.real)}${cur(a.real)}</div>
      <div class="pt-stat-sub">${a.closed} closed trade${a.closed !== 1 ? 's' : ''}</div>
    </div>
  </div>

  <div class="pt-dash-grid">
    <div class="pt-card">
      <div class="pt-card-title">Open Positions</div>
      ${positions.length === 0 ? '<p class="pt-empty">No open positions. Go to <strong>Trade</strong> to place your first order.</p>' :
      `<div class="pt-table-wrap"><table class="pt-table">
        <thead><tr><th>Symbol</th><th>Qty</th><th>Avg Cost</th><th>Price</th><th>Value</th><th>P&L</th><th></th></tr></thead>
        <tbody>${positions.map(s => {
          const p = acct.positions[s]; const pl = posPL(s);
          return `<tr>
            <td><strong>${s}</strong><span class="pt-sub">${AMAP[s]?.n || ''}</span></td>
            <td>${p.qty}</td>
            <td>${cur(p.avg)}</td>
            <td>${cur(price(s))}</td>
            <td>${cur(p.qty * price(s))}</td>
            <td class="${cls(pl.pl)}"><strong>${sign(pl.pl)}${cur(pl.pl)}</strong><br/><small>${sign(pl.pct)}${fmt(pl.pct)}%</small></td>
            <td><button class="pt-btn-sm pt-btn-sell" data-action="close" data-sym="${s}">Close</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`}
    </div>

    <div class="pt-card">
      <div class="pt-card-title">Recent Activity</div>
      ${recent.length === 0 ? '<p class="pt-empty">No trades yet.</p>' :
      `<div class="pt-activity">${recent.map(t => `
        <div class="pt-activity-row">
          <div class="pt-activity-side pt-side-${t.side}">${t.side.toUpperCase()}</div>
          <div class="pt-activity-info">
            <strong>${t.qty} ${t.sym}</strong> @ ${cur(t.price)}
            ${t.pl ? `<span class="${cls(t.pl)}">${sign(t.pl)}${cur(t.pl)}</span>` : ''}
          </div>
          <div class="pt-activity-time">${ago(t.at)}</div>
        </div>`).join('')}
      </div>`}
      ${acct.pending.length > 0 ? `
      <div class="pt-card-title" style="margin-top:16px;">Pending Orders (${acct.pending.length})</div>
      <div class="pt-activity">${acct.pending.map(o => `
        <div class="pt-activity-row">
          <div class="pt-activity-side pt-side-${o.side}">${o.side.toUpperCase()}</div>
          <div class="pt-activity-info">
            <strong>${o.qty} ${o.sym}</strong> limit @ ${cur(o.lim)}
          </div>
          <button class="pt-btn-sm pt-btn-cancel" data-action="cancel-order" data-id="${o.id}">Cancel</button>
        </div>`).join('')}
      </div>` : ''}
    </div>
  </div>

  <div class="pt-card">
    <div class="pt-card-title">Equity Curve</div>
    <canvas id="pt-equity-canvas" height="180" style="width:100%;"></canvas>
  </div>`;

  drawEquity();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ══════════════════════════════════
   UI — TRADE PANEL
══════════════════════════════════ */
function renderTrade() {
  const c = document.getElementById('pt-content');
  const filtered = assetFilter
    ? UNI.filter(a => a.s.toLowerCase().includes(assetFilter) || a.n.toLowerCase().includes(assetFilter))
    : UNI;

  const sel = selAsset ? AMAP[selAsset] : null;
  const curPrice = sel ? price(sel.s) : 0;
  const curBid = sel ? bid(sel.s) : 0;
  const curAsk = sel ? ask(sel.s) : 0;
  const existingPos = sel && acct.positions[sel.s] ? acct.positions[sel.s] : null;

  c.innerHTML = `
  <div class="pt-trade-layout">
    <div class="pt-card pt-asset-panel">
      <div class="pt-card-title">Select Asset</div>
      <input type="text" class="pt-input pt-asset-search" id="pt-asset-search" placeholder="Search assets..." value="${assetFilter}"/>
      <div class="pt-asset-list" id="pt-asset-list">
        ${filtered.map(a => {
          const p = prices[a.s]; const ch = ((p - a.bp) / a.bp) * 100;
          return `<div class="pt-asset-item${selAsset === a.s ? ' selected' : ''}" data-action="select-asset" data-sym="${a.s}">
            <div class="pt-asset-item-left">
              <strong>${a.s}</strong>
              <span class="pt-sub">${a.n}</span>
            </div>
            <div class="pt-asset-item-right">
              <span class="pt-asset-price">${cur(p)}</span>
              <span class="pt-asset-chg ${cls(ch)}">${sign(ch)}${fmt(ch)}%</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="pt-card pt-order-panel">
      ${!sel ? '<div class="pt-empty-lg">Select an asset from the list to place an order</div>' : `
      <div class="pt-order-header">
        <div>
          <h3 class="pt-order-sym">${sel.s}</h3>
          <span class="pt-sub">${sel.n} · ${sel.c}</span>
        </div>
        <div class="pt-order-price-display">
          <div class="pt-price-big">${cur(curPrice)}</div>
          <div class="pt-price-spread">Bid: ${cur(curBid)} · Ask: ${cur(curAsk)}</div>
        </div>
      </div>

      ${existingPos ? `<div class="pt-existing-pos">Currently holding <strong>${existingPos.qty}</strong> shares · Avg cost <strong>${cur(existingPos.avg)}</strong> · P&L <span class="${cls(posPL(sel.s).pl)}">${sign(posPL(sel.s).pl)}${cur(posPL(sel.s).pl)}</span></div>` : ''}

      <div class="pt-side-toggle" id="side-toggle">
        <button class="pt-side-btn pt-side-buy${orderSide === 'buy' ? ' active' : ''}" data-action="set-side" data-side="buy">Buy</button>
        <button class="pt-side-btn pt-side-sell${orderSide === 'sell' ? ' active' : ''}" data-action="set-side" data-side="sell">Sell</button>
      </div>

      <div class="pt-type-toggle" id="type-toggle">
        <button class="pt-type-btn${orderType === 'market' ? ' active' : ''}" data-action="set-type" data-type="market">Market Order</button>
        <button class="pt-type-btn${orderType === 'limit' ? ' active' : ''}" data-action="set-type" data-type="limit">Limit Order</button>
      </div>

      <div class="pt-form-group">
        <label class="pt-label">Quantity</label>
        <input type="number" id="pt-qty" class="pt-input" placeholder="Number of shares" min="0.001" step="any" value="${document.getElementById('pt-qty')?.value || ''}"/>
      </div>

      ${orderType === 'limit' ? `
      <div class="pt-form-group">
        <label class="pt-label">Limit Price</label>
        <input type="number" id="pt-lim" class="pt-input" placeholder="Limit price" min="0.001" step="any" value="${document.getElementById('pt-lim')?.value || ''}"/>
      </div>` : ''}

      <div class="pt-order-summary" id="pt-summary"></div>

      <button class="pt-btn-primary pt-btn-lg pt-btn-${orderSide}" id="pt-place-btn">
        ${orderSide === 'buy' ? 'Buy' : 'Sell'} ${sel.s}
      </button>
      `}
    </div>
  </div>`;

  // Preserve and attach input listeners
  const qtyInput = document.getElementById('pt-qty');
  const limInput = document.getElementById('pt-lim');
  const searchInput = document.getElementById('pt-asset-search');

  if (typeof lucide !== 'undefined') lucide.createIcons();

  if (qtyInput) qtyInput.addEventListener('input', updateSummary);
  if (limInput) limInput.addEventListener('input', updateSummary);
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      assetFilter = this.value.toLowerCase().trim();
      renderTrade();
      const si = document.getElementById('pt-asset-search');
      if (si) { si.focus(); si.setSelectionRange(si.value.length, si.value.length); }
    });
  }
  updateSummary();
}

function updateSummary() {
  const el = document.getElementById('pt-summary');
  if (!el || !selAsset) return;
  const qty = parseFloat(document.getElementById('pt-qty')?.value) || 0;
  const limEl = document.getElementById('pt-lim');
  const p = orderType === 'limit' && limEl ? (parseFloat(limEl.value) || 0) : (orderSide === 'buy' ? ask(selAsset) : bid(selAsset));
  if (!qty || !p) { el.innerHTML = ''; return; }
  const comm = commission(qty);
  const total = qty * p + (orderSide === 'buy' ? comm : -comm);
  el.innerHTML = `
    <div class="pt-summary-row"><span>Price</span><span>${cur(p)}</span></div>
    <div class="pt-summary-row"><span>Quantity</span><span>${qty}</span></div>
    ${comm > 0 ? `<div class="pt-summary-row"><span>Commission</span><span>${cur(comm)}</span></div>` : ''}
    <div class="pt-summary-row pt-summary-total"><span>Estimated ${orderSide === 'buy' ? 'Cost' : 'Proceeds'}</span><span>${cur(total)}</span></div>
    ${orderSide === 'buy' ? `<div class="pt-summary-row"><span>Cash After</span><span>${cur(acct.cash - total)}</span></div>` : ''}
  `;
}

/* ══════════════════════════════════
   UI — PORTFOLIO
══════════════════════════════════ */
function renderPort() {
  const positions = Object.keys(acct.positions).filter(s => acct.positions[s].qty > 0);
  const c = document.getElementById('pt-content');
  const totalVal = posValue();
  c.innerHTML = `
  <div class="pt-stat-grid pt-stat-grid-3">
    <div class="pt-card pt-stat-card">
      <div class="pt-stat-label">Portfolio Value</div>
      <div class="pt-stat-value">${cur(totalVal)}</div>
    </div>
    <div class="pt-card pt-stat-card">
      <div class="pt-stat-label">Unrealized P&L</div>
      <div class="pt-stat-value ${cls(unrealPL())}">${sign(unrealPL())}${cur(unrealPL())}</div>
    </div>
    <div class="pt-card pt-stat-card">
      <div class="pt-stat-label">Positions</div>
      <div class="pt-stat-value">${positions.length}</div>
    </div>
  </div>

  <div class="pt-card">
    <div class="pt-card-title">Holdings</div>
    ${positions.length === 0 ? '<p class="pt-empty">No holdings. Place a trade to build your portfolio.</p>' :
    `<div class="pt-table-wrap"><table class="pt-table">
      <thead><tr><th>Symbol</th><th>Name</th><th>Qty</th><th>Avg Cost</th><th>Price</th><th>Market Value</th><th>P&L ($)</th><th>P&L (%)</th><th>Allocation</th><th></th></tr></thead>
      <tbody>${positions.map(s => {
        const p = acct.positions[s]; const pl = posPL(s); const val = p.qty * price(s);
        const alloc = totalVal > 0 ? (val / totalVal) * 100 : 0;
        return `<tr>
          <td><strong>${s}</strong></td>
          <td class="pt-sub">${AMAP[s]?.n || ''}</td>
          <td>${p.qty}</td>
          <td>${cur(p.avg)}</td>
          <td>${cur(price(s))}</td>
          <td>${cur(val)}</td>
          <td class="${cls(pl.pl)}"><strong>${sign(pl.pl)}${cur(pl.pl)}</strong></td>
          <td class="${cls(pl.pct)}">${sign(pl.pct)}${fmt(pl.pct)}%</td>
          <td>${fmt(alloc)}%</td>
          <td><button class="pt-btn-sm pt-btn-sell" data-action="close" data-sym="${s}">Close</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`}
  </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ══════════════════════════════════
   UI — HISTORY
══════════════════════════════════ */
function renderHist() {
  const trades = acct.trades.slice().reverse();
  const orders = acct.orders.slice().reverse().slice(0, 50);
  const c = document.getElementById('pt-content');
  c.innerHTML = `
  <div class="pt-hist-tabs">
    <button class="pt-htab active" data-action="hist-tab" data-tab="trades">Trade History (${acct.trades.length})</button>
    <button class="pt-htab" data-action="hist-tab" data-tab="orders">Order Log (${acct.orders.length})</button>
    <button class="pt-htab" data-action="hist-tab" data-tab="pending">Pending (${acct.pending.length})</button>
  </div>

  <div class="pt-card" id="htab-trades">
    ${trades.length === 0 ? '<p class="pt-empty">No trades yet.</p>' :
    `<div class="pt-table-wrap"><table class="pt-table">
      <thead><tr><th>Date</th><th>Side</th><th>Symbol</th><th>Qty</th><th>Price</th><th>Total</th><th>Comm.</th><th>P&L</th></tr></thead>
      <tbody>${trades.slice(0, 100).map(t => `<tr>
        <td class="pt-sub">${fmtDate(t.at)}</td>
        <td><span class="pt-side-badge pt-side-${t.side}">${t.side.toUpperCase()}</span></td>
        <td><strong>${t.sym}</strong></td>
        <td>${t.qty}</td>
        <td>${cur(t.price)}</td>
        <td>${cur(t.total)}</td>
        <td>${t.comm > 0 ? cur(t.comm) : '—'}</td>
        <td class="${cls(t.pl)}">${t.side === 'sell' ? sign(t.pl) + cur(t.pl) : '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`}
  </div>

  <div class="pt-card" id="htab-orders" style="display:none;">
    ${orders.length === 0 ? '<p class="pt-empty">No orders yet.</p>' :
    `<div class="pt-table-wrap"><table class="pt-table">
      <thead><tr><th>Date</th><th>Status</th><th>Type</th><th>Side</th><th>Symbol</th><th>Qty</th><th>Price</th></tr></thead>
      <tbody>${orders.map(o => `<tr>
        <td class="pt-sub">${fmtDate(o.at)}</td>
        <td><span class="pt-status-${o.status || 'filled'}">${(o.status || 'filled').toUpperCase()}</span></td>
        <td>${(o.oType || o.type || '').toUpperCase()}</td>
        <td><span class="pt-side-badge pt-side-${o.side}">${o.side.toUpperCase()}</span></td>
        <td><strong>${o.sym}</strong></td>
        <td>${o.qty}</td>
        <td>${cur(o.price || o.lim || 0)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`}
  </div>

  <div class="pt-card" id="htab-pending" style="display:none;">
    ${acct.pending.length === 0 ? '<p class="pt-empty">No pending orders.</p>' :
    `<div class="pt-table-wrap"><table class="pt-table">
      <thead><tr><th>Created</th><th>Side</th><th>Symbol</th><th>Qty</th><th>Limit Price</th><th>Current Price</th><th></th></tr></thead>
      <tbody>${acct.pending.map(o => `<tr>
        <td class="pt-sub">${fmtDate(o.at)}</td>
        <td><span class="pt-side-badge pt-side-${o.side}">${o.side.toUpperCase()}</span></td>
        <td><strong>${o.sym}</strong></td>
        <td>${o.qty}</td>
        <td>${cur(o.lim)}</td>
        <td>${cur(price(o.sym))}</td>
        <td><button class="pt-btn-sm pt-btn-cancel" data-action="cancel-order" data-id="${o.id}">Cancel</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`}
  </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ══════════════════════════════════
   UI — ANALYTICS
══════════════════════════════════ */
function renderStats() {
  const a = analytics();
  const c = document.getElementById('pt-content');
  c.innerHTML = `
  <div class="pt-stat-grid pt-stat-grid-3">
    <div class="pt-card pt-stat-card pt-stat-highlight">
      <div class="pt-stat-label">Total Return</div>
      <div class="pt-stat-value ${cls(a.totalPL)}">${sign(a.totalPL)}${cur(a.totalPL)}</div>
      <div class="pt-stat-sub ${cls(a.totalPct)}">${sign(a.totalPct)}${fmt(a.totalPct)}%</div>
    </div>
    <div class="pt-card pt-stat-card">
      <div class="pt-stat-label">Win Rate</div>
      <div class="pt-stat-value">${fmt(a.winRate)}%</div>
      <div class="pt-stat-sub">${a.closed} closed trades</div>
    </div>
    <div class="pt-card pt-stat-card">
      <div class="pt-stat-label">Max Drawdown</div>
      <div class="pt-stat-value down">-${fmt(a.maxDD)}%</div>
      <div class="pt-stat-sub">from peak</div>
    </div>
  </div>

  <div class="pt-stat-grid pt-stat-grid-4">
    <div class="pt-card pt-stat-card-sm">
      <div class="pt-stat-label">Avg Win</div>
      <div class="pt-stat-value-sm up">${cur(a.avgWin)}</div>
    </div>
    <div class="pt-card pt-stat-card-sm">
      <div class="pt-stat-label">Avg Loss</div>
      <div class="pt-stat-value-sm down">-${cur(a.avgLoss)}</div>
    </div>
    <div class="pt-card pt-stat-card-sm">
      <div class="pt-stat-label">Profit Factor</div>
      <div class="pt-stat-value-sm">${a.pf === Infinity ? '∞' : fmt(a.pf)}</div>
    </div>
    <div class="pt-card pt-stat-card-sm">
      <div class="pt-stat-label">Total Trades</div>
      <div class="pt-stat-value-sm">${a.trades}</div>
    </div>
  </div>

  ${a.best ? `
  <div class="pt-stat-grid pt-stat-grid-2">
    <div class="pt-card pt-stat-card-sm">
      <div class="pt-stat-label">Best Trade</div>
      <div class="pt-stat-value-sm up">${sign(a.best.pl)}${cur(a.best.pl)}</div>
      <div class="pt-stat-sub">${a.best.sym} · ${a.best.qty} shares · ${fmtDate(a.best.at)}</div>
    </div>
    <div class="pt-card pt-stat-card-sm">
      <div class="pt-stat-label">Worst Trade</div>
      <div class="pt-stat-value-sm down">${sign(a.worst.pl)}${cur(a.worst.pl)}</div>
      <div class="pt-stat-sub">${a.worst.sym} · ${a.worst.qty} shares · ${fmtDate(a.worst.at)}</div>
    </div>
  </div>` : ''}

  <div class="pt-card">
    <div class="pt-card-title">Equity Curve</div>
    <canvas id="pt-equity-canvas" height="220" style="width:100%;"></canvas>
  </div>`;

  drawEquity();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ══════════════════════════════════
   UI — SETTINGS
══════════════════════════════════ */
function renderSettings() {
  const c = document.getElementById('pt-content');
  c.innerHTML = `
  <div class="pt-settings-grid">
    <div class="pt-card">
      <div class="pt-card-title">Account Info</div>
      <div class="pt-settings-row"><span>Created</span><span>${fmtDate(acct.created)}</span></div>
      <div class="pt-settings-row"><span>Starting Balance</span><span>${cur(acct.startBal)}</span></div>
      <div class="pt-settings-row"><span>Currency</span><span>${acct.currency}</span></div>
      <div class="pt-settings-row"><span>Account Value</span><span>${cur(acctValue())}</span></div>
      <div class="pt-settings-row"><span>Total P&L</span><span class="${cls(totalPL())}">${sign(totalPL())}${cur(totalPL())} (${sign(totalPLPct())}${fmt(totalPLPct())}%)</span></div>
    </div>

    <div class="pt-card">
      <div class="pt-card-title">Commission Settings</div>
      <div class="pt-form-group">
        <label class="pt-toggle-label">
          <input type="checkbox" id="s-comm" ${acct.commOn ? 'checked' : ''}/> Enable commissions
        </label>
      </div>
      <div class="pt-form-group" id="s-comm-fields" style="display:${acct.commOn ? 'block' : 'none'};">
        <select id="s-comm-type" class="pt-input">
          <option value="per-trade" ${acct.commType === 'per-trade' ? 'selected' : ''}>Per trade (flat fee)</option>
          <option value="per-share" ${acct.commType === 'per-share' ? 'selected' : ''}>Per share/unit</option>
        </select>
        <input type="number" id="s-comm-amt" class="pt-input" value="${acct.commAmt}" min="0" step="0.01" style="margin-top:8px;"/>
      </div>
      <button class="pt-btn-primary" id="save-comm-btn" style="margin-top:12px;">Save Commission Settings</button>
    </div>

    <div class="pt-card pt-card-danger">
      <div class="pt-card-title">Reset Account</div>
      <p class="pt-sub" style="margin-bottom:12px;">This will permanently delete all positions, trades, and history. This cannot be undone.</p>
      <button class="pt-btn-danger" id="reset-btn">Reset Paper Trading Account</button>
    </div>
  </div>`;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('s-comm').addEventListener('change', function() {
    document.getElementById('s-comm-fields').style.display = this.checked ? 'block' : 'none';
  });
  document.getElementById('save-comm-btn').addEventListener('click', () => {
    acct.commOn = document.getElementById('s-comm').checked;
    acct.commType = document.getElementById('s-comm-type').value;
    acct.commAmt = parseFloat(document.getElementById('s-comm-amt').value) || 0;
    save();
    toast('Commission settings saved', 'success');
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset your paper trading account? All data will be lost.')) {
      localStorage.removeItem(CFG.KEY);
      acct = null; selAsset = null; panel = 'pt-dash';
      ready = false;
      renderSetup();
      toast('Account reset. Set up a new one to continue.', 'info');
    }
  });
}

/* ══════════════════════════════════
   EQUITY CURVE CHART
══════════════════════════════════ */
function drawEquity() {
  const canvas = document.getElementById('pt-equity-canvas');
  if (!canvas || !acct || acct.equity.length < 2) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const data = acct.equity;
  const vals = data.map(d => d.v);
  const min = Math.min(...vals) * 0.998;
  const max = Math.max(...vals) * 1.002;
  const range = max - min || 1;

  // Background
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(42,48,64,0.5)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = 20 + (i / 4) * (H - 40);
    ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(W - 10, y); ctx.stroke();
    const val = max - (i / 4) * range;
    ctx.fillStyle = '#7a8599';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('$' + fmt(val, 0), 45, y + 4);
  }

  // Line
  const startColor = vals[vals.length - 1] >= acct.startBal ? '#26a69a' : '#ef5350';
  ctx.strokeStyle = startColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = 55 + (i / (data.length - 1)) * (W - 70);
    const y = 20 + ((max - d.v) / range) * (H - 40);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill under line
  const lastX = 55 + (W - 70);
  ctx.lineTo(lastX, H - 20);
  ctx.lineTo(55, H - 20);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, startColor + '30');
  grad.addColorStop(1, startColor + '05');
  ctx.fillStyle = grad;
  ctx.fill();

  // Starting balance line
  const startY = 20 + ((max - acct.startBal) / range) * (H - 40);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(55, startY); ctx.lineTo(W - 10, startY); ctx.stroke();
  ctx.setLineDash([]);
}

/* ══════════════════════════════════
   EVENT DELEGATION
══════════════════════════════════ */
function setupEvents() {
  const root = document.getElementById('section-paper');
  if (!root) return;

  root.addEventListener('click', function(e) {
    // Sub-nav tabs
    const tab = e.target.closest('.pt-tab');
    if (tab) { showPanel(tab.dataset.panel); return; }

    // History tabs
    const htab = e.target.closest('.pt-htab');
    if (htab) {
      root.querySelectorAll('.pt-htab').forEach(t => t.classList.remove('active'));
      htab.classList.add('active');
      ['trades','orders','pending'].forEach(id => {
        const el = document.getElementById('htab-' + id);
        if (el) el.style.display = htab.dataset.tab === id ? '' : 'none';
      });
      return;
    }

    const action = e.target.closest('[data-action]');
    if (!action) return;
    const act = action.dataset.action;

    if (act === 'select-asset') {
      selAsset = action.dataset.sym;
      renderTrade();
      return;
    }
    if (act === 'set-side') {
      orderSide = action.dataset.side;
      renderTrade();
      return;
    }
    if (act === 'set-type') {
      orderType = action.dataset.type;
      renderTrade();
      return;
    }
    if (act === 'close') {
      const sym = action.dataset.sym;
      if (confirm('Close entire ' + sym + ' position?')) {
        closePos(sym);
        renderPanel();
      }
      return;
    }
    if (act === 'cancel-order') {
      cancelOrd(action.dataset.id);
      renderPanel();
      return;
    }
  });

  // Place order button (delegated)
  root.addEventListener('click', function(e) {
    if (e.target.id === 'pt-place-btn' || e.target.closest('#pt-place-btn')) {
      if (!selAsset) return;
      const qty = parseFloat(document.getElementById('pt-qty')?.value);
      const lim = parseFloat(document.getElementById('pt-lim')?.value);
      if (!qty || qty <= 0) { toast('Enter a valid quantity', 'error'); return; }
      if (orderType === 'limit' && (!lim || lim <= 0)) { toast('Enter a valid limit price', 'error'); return; }
      const result = placeOrder(selAsset, orderSide, orderType, qty, lim);
      if (result.ok) {
        toast(result.msg, 'success');
        document.getElementById('pt-qty').value = '';
        if (document.getElementById('pt-lim')) document.getElementById('pt-lim').value = '';
        renderTrade();
      } else {
        toast(result.err, 'error');
      }
    }
  });
}

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
function init() {
  initPrices();
  acct = load();

  renderNav();
  if (acct) { ready = true; renderPanel(); }
  else { renderSetup(); }

  setupEvents();
  tickTimer = setInterval(tick, CFG.TICK);
}

// Expose
window.PaperTrading = { init, showPanel };

})();
