/* ─────────────────────────────────────────
   TRADEBASE — APP.JS
   Dark-themed trading platform controller
───────────────────────────────────────── */

/* ══════════════════════════════════════════
   DATA
══════════════════════════════════════════ */
const WATCHLIST_DATA = [
  { t:'AAPL',  n:'Apple',       p:227.82, c:+1.24,  cp:+0.55 },
  { t:'MSFT',  n:'Microsoft',   p:419.50, c:-2.10,  cp:-0.50 },
  { t:'NVDA',  n:'NVIDIA',      p:875.40, c:+18.20, cp:+2.12 },
  { t:'TSLA',  n:'Tesla',       p:182.63, c:-4.35,  cp:-2.32 },
  { t:'SPY',   n:'S&P 500 ETF', p:548.90, c:+3.20,  cp:+0.59 },
  { t:'QQQ',   n:'Nasdaq ETF',  p:462.15, c:+4.80,  cp:+1.05 },
  { t:'BTC',   n:'Bitcoin',     p:87420,  c:+1240,  cp:+1.44 },
  { t:'ETH',   n:'Ethereum',    p:3480,   c:-55,    cp:-1.56 },
  { t:'GLD',   n:'Gold ETF',    p:242.30, c:+0.80,  cp:+0.33 },
  { t:'USO',   n:'Crude Oil',   p:76.40,  c:-0.90,  cp:-1.16 },
];

const ASSET_DATA = {
  stocks: [
    { t:'AAPL',  n:'Apple Inc.',      p:227.82, c:+1.24,  cp:+0.55 },
    { t:'MSFT',  n:'Microsoft',       p:419.50, c:-2.10,  cp:-0.50 },
    { t:'NVDA',  n:'NVIDIA Corp.',    p:875.40, c:+18.20, cp:+2.12 },
    { t:'TSLA',  n:'Tesla Inc.',      p:182.63, c:-4.35,  cp:-2.32 },
    { t:'AMZN',  n:'Amazon',          p:195.80, c:+0.90,  cp:+0.46 },
    { t:'META',  n:'Meta Platforms',  p:528.20, c:+7.30,  cp:+1.40 },
    { t:'GOOGL', n:'Alphabet',        p:162.40, c:-1.20,  cp:-0.73 },
    { t:'JPM',   n:'JPMorgan Chase',  p:245.60, c:+2.40,  cp:+0.99 },
  ],
  indices: [
    { t:'SPY',   n:'S&P 500 ETF',     p:548.90, c:+3.20,  cp:+0.59 },
    { t:'QQQ',   n:'NASDAQ-100 ETF',  p:462.15, c:+4.80,  cp:+1.05 },
    { t:'DIA',   n:'Dow Jones ETF',   p:421.30, c:+1.80,  cp:+0.43 },
    { t:'IWM',   n:'Russell 2000',    p:207.40, c:-0.60,  cp:-0.29 },
    { t:'VXX',   n:'VIX ETN',         p:18.20,  c:-0.40,  cp:-2.15 },
    { t:'EEM',   n:'Emerging Mkts',   p:43.80,  c:+0.30,  cp:+0.69 },
  ],
  commodities: [
    { t:'GC=F',  n:'Gold Futures',    p:2648.50,c:+12.40, cp:+0.47 },
    { t:'SI=F',  n:'Silver Futures',  p:31.42,  c:-0.28,  cp:-0.88 },
    { t:'CL=F',  n:'Crude Oil (WTI)', p:76.40,  c:-0.90,  cp:-1.16 },
    { t:'NG=F',  n:'Natural Gas',     p:2.84,   c:+0.06,  cp:+2.16 },
    { t:'ZW=F',  n:'Wheat',           p:548.25, c:+4.50,  cp:+0.83 },
    { t:'HG=F',  n:'Copper',          p:4.52,   c:-0.03,  cp:-0.66 },
  ],
  forex: [
    { t:'EUR/USD', n:'Euro / US Dollar',       p:1.0842, c:+0.0012, cp:+0.11 },
    { t:'GBP/USD', n:'Pound / US Dollar',       p:1.2740, c:-0.0018, cp:-0.14 },
    { t:'USD/JPY', n:'US Dollar / Yen',         p:151.82, c:+0.34,  cp:+0.22 },
    { t:'USD/CAD', n:'US Dollar / CAD',         p:1.3618, c:-0.0024, cp:-0.18 },
    { t:'AUD/USD', n:'Australian / USD',        p:0.6524, c:+0.0008, cp:+0.12 },
    { t:'USD/CHF', n:'US Dollar / Swiss Franc', p:0.8962, c:+0.0014, cp:+0.16 },
  ],
  crypto: [
    { t:'BTC/USD', n:'Bitcoin',       p:87420,  c:+1240,  cp:+1.44 },
    { t:'ETH/USD', n:'Ethereum',      p:3480,   c:-55,    cp:-1.56 },
    { t:'SOL/USD', n:'Solana',        p:178.40, c:+4.20,  cp:+2.41 },
    { t:'BNB/USD', n:'BNB',           p:618.50, c:-8.30,  cp:-1.32 },
    { t:'XRP/USD', n:'XRP',           p:0.6240, c:+0.012, cp:+1.96 },
    { t:'ADA/USD', n:'Cardano',       p:0.4821, c:-0.008, cp:-1.63 },
  ],
};

/* ══════════════════════════════════════════
   SECTION NAVIGATION
══════════════════════════════════════════ */
const SECTION_META = {
  dashboard:  ['Dashboard',        'Market overview & quick stats'],
  markets:    ['Live Markets',     'Real-time prices via TradingView'],
  education:  ['Education Center', 'Complete beginner trading curriculum'],
  research:   ['Research Tools',   'How to analyze trades & build watchlists'],
  glossary:   ['Glossary',         'Every trading term explained'],
  paper:      ['Paper Trading',    'Simulated brokerage experience'],
  bot:        ['Trading Bot',      'Live AI bot dashboard — BTC/USDT paper trading'],
};

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => {
    s.classList.remove('active');
    s.classList.remove('fade-in');
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById('section-' + id);
  if (section) {
    section.classList.add('active');
    requestAnimationFrame(() => section.classList.add('fade-in'));
  }
  document.querySelectorAll(`[data-section="${id}"]`).forEach(el => el.classList.add('active'));

  const titleEl = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  if (SECTION_META[id] && titleEl && subtitleEl) {
    titleEl.childNodes[0].textContent = SECTION_META[id][0] + ' ';
    subtitleEl.textContent = SECTION_META[id][1];
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.innerWidth <= 768) closeSidebar();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ══════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════ */
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
}

function setupOutsideClickClose() {
  document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.querySelector('.hamburger, [onclick*="toggleSidebar"]');
    if (window.innerWidth > 768 || !sidebar.classList.contains('open')) return;
    if (!sidebar.contains(e.target) && (!toggle || !toggle.contains(e.target))) {
      closeSidebar();
    }
  });
}

/* ══════════════════════════════════════════
   MARKET TABS
══════════════════════════════════════════ */
function showMarketTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.market-tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.add('active');
  document.querySelectorAll(`[data-tab="${tabId}"]`).forEach(el => el.classList.add('active'));
}

/* ══════════════════════════════════════════
   EDUCATION ACCORDIONS
══════════════════════════════════════════ */
function toggleModule(id) {
  const header = document.getElementById('mh-' + id);
  const body = document.getElementById('mb-' + id);
  const isOpen = header.classList.contains('open');
  document.querySelectorAll('.module-header.open').forEach(h => h.classList.remove('open'));
  document.querySelectorAll('.module-body.open').forEach(b => b.classList.remove('open'));
  if (!isOpen) {
    header.classList.add('open');
    body.classList.add('open');
  }
}

function toggleLesson(id) {
  const header = document.getElementById('lh-' + id);
  const body = document.getElementById('lb-' + id);
  const isOpen = header.classList.contains('open');
  header.classList.toggle('open', !isOpen);
  body.classList.toggle('open', !isOpen);
}

function scrollToModule(id) {
  document.querySelectorAll('.edu-nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll(`[data-edu="${id}"]`).forEach(el => el.classList.add('active'));
  const el = document.getElementById('mod-' + id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const header = el.querySelector('.module-header');
    const body = el.querySelector('.module-body');
    if (header && !header.classList.contains('open')) {
      header.classList.add('open');
      body.classList.add('open');
    }
  }
}

/* ══════════════════════════════════════════
   EDUCATION NAV — INTERSECTION OBSERVER
══════════════════════════════════════════ */
function setupEduNavObserver() {
  const modules = document.querySelectorAll('[id^="mod-"]');
  if (!modules.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id.replace('mod-', '');
        document.querySelectorAll('.edu-nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll(`[data-edu="${id}"]`).forEach(el => el.classList.add('active'));
      }
    });
  }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
  modules.forEach(mod => observer.observe(mod));
}

/* ══════════════════════════════════════════
   GLOSSARY
══════════════════════════════════════════ */
function setupGlossarySearch() {
  const input = document.getElementById('glossary-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll('.gterm').forEach(term => {
      const text = term.textContent.toLowerCase();
      term.classList.toggle('hidden', q && !text.includes(q));
    });
    document.querySelectorAll('.glossary-letter-group').forEach(group => {
      const visible = group.querySelectorAll('.gterm:not(.hidden)').length;
      group.style.display = visible ? '' : 'none';
    });
  });
}

function filterGlossary(letter) {
  document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`[data-alpha="${letter}"]`).forEach(b => b.classList.add('active'));
  if (letter === 'ALL') {
    document.querySelectorAll('.glossary-letter-group').forEach(g => g.style.display = '');
    document.querySelectorAll('.gterm').forEach(t => t.classList.remove('hidden'));
    return;
  }
  document.querySelectorAll('.glossary-letter-group').forEach(g => {
    g.style.display = g.dataset.letter === letter ? '' : 'none';
  });
}

/* ══════════════════════════════════════════
   MARKET STATUS
══════════════════════════════════════════ */
function updateMarketStatus() {
  const now = new Date();
  const day = now.getUTCDay();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && mins >= 870 && mins < 1260;
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  const sub = document.getElementById('status-sub');
  if (!dot) return;
  dot.classList.toggle('open', isOpen);
  text.textContent = isOpen ? 'Markets Open' : 'Markets Closed';
  sub.textContent = isOpen ? 'NYSE \u2022 NASDAQ' : (isWeekday ? 'After Hours' : 'Weekend');
}

/* ══════════════════════════════════════════
   WATCHLIST RENDER & PRICE TICKER
══════════════════════════════════════════ */
function renderWatchlist() {
  const container = document.getElementById('watchlist');
  if (!container) return;
  container.innerHTML = WATCHLIST_DATA.map((d, i) => {
    const up = d.c >= 0;
    const sign = up ? '+' : '';
    const cls = up ? 'up' : 'down';
    return `
      <div class="watchlist-item" data-wl-index="${i}">
        <span class="wl-ticker">${d.t}</span>
        <span class="wl-name">${d.n}</span>
        <span class="wl-price ${cls}">$${d.p.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        <span class="wl-change ${cls}">${sign}${d.cp.toFixed(2)}%</span>
      </div>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function startPriceTicker() {
  function tick() {
    const delay = 3000 + Math.random() * 2000;
    setTimeout(() => {
      WATCHLIST_DATA.forEach((d, i) => {
        const pct = (Math.random() - 0.5) * 0.4;
        const delta = d.p * (pct / 100);
        d.p = Math.max(0.01, d.p + delta);
        d.c += delta;
        d.cp += pct;
        const row = document.querySelector(`[data-wl-index="${i}"]`);
        if (!row) return;
        const priceEl = row.querySelector('.wl-price');
        const changeEl = row.querySelector('.wl-change');
        const up = d.c >= 0;
        const cls = up ? 'up' : 'down';
        const sign = up ? '+' : '';
        priceEl.textContent = '$' + d.p.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
        changeEl.textContent = sign + d.cp.toFixed(2) + '%';
        priceEl.className = 'wl-price ' + cls;
        changeEl.className = 'wl-change ' + cls;

        const flashCls = delta >= 0 ? 'flash-green' : 'flash-red';
        row.classList.add(flashCls);
        setTimeout(() => row.classList.remove(flashCls), 600);
      });
      tick();
    }, delay);
  }
  tick();
}

/* ══════════════════════════════════════════
   ASSET CARDS & TRADINGVIEW
══════════════════════════════════════════ */
function getTVSymbol(ticker) {
  const map = {
    'BTC/USD': 'BINANCE:BTCUSDT', 'ETH/USD': 'BINANCE:ETHUSDT',
    'SOL/USD': 'BINANCE:SOLUSDT', 'BNB/USD': 'BINANCE:BNBUSDT',
    'XRP/USD': 'BINANCE:XRPUSDT', 'ADA/USD': 'BINANCE:ADAUSDT',
    'EUR/USD': 'FX:EURUSD',   'GBP/USD': 'FX:GBPUSD',
    'USD/JPY': 'FX:USDJPY',   'USD/CAD': 'FX:USDCAD',
    'AUD/USD': 'FX:AUDUSD',   'USD/CHF': 'FX:USDCHF',
    'GC=F': 'COMEX:GC1!',  'SI=F': 'COMEX:SI1!',
    'CL=F': 'NYMEX:CL1!',  'NG=F': 'NYMEX:NG1!',
    'ZW=F': 'CBOT:ZW1!',   'HG=F': 'COMEX:HG1!',
  };
  return map[ticker] || ('NASDAQ:' + ticker);
}

function renderAssetTab(tabKey) {
  const container = document.getElementById('assets-' + tabKey);
  if (!container) return;
  const assets = ASSET_DATA[tabKey] || [];
  const fmt = (n) => n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:4});
  container.innerHTML = assets.map(d => {
    const up = d.c >= 0;
    const sign = up ? '+' : '';
    const cls = up ? 'up' : 'down';
    return `
      <div class="asset-card">
        <div class="asset-card-header">
          <div>
            <div class="asset-ticker">${d.t}</div>
            <div class="asset-name">${d.n}</div>
          </div>
          <div class="asset-price-wrap">
            <div class="asset-price ${cls}">$${fmt(d.p)}</div>
            <div class="asset-change ${cls}">${sign}${fmt(d.c)} (${sign}${d.cp.toFixed(2)}%)</div>
          </div>
        </div>
        <div class="asset-chart">
          <div class="tradingview-widget-container" style="height:80px">
            <div class="tradingview-widget-container__widget" style="height:80px"></div>
            <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js" async>
            {
              "symbol": "${getTVSymbol(d.t)}",
              "width": "100%",
              "height": "80",
              "locale": "en",
              "dateRange": "1D",
              "colorTheme": "dark",
              "isTransparent": true,
              "autosize": true,
              "largeChartUrl": ""
            }
            <\/script>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderAllAssetTabs() {
  ['stocks', 'indices', 'commodities', 'forex', 'crypto'].forEach(renderAssetTab);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ══════════════════════════════════════════
   GLOBAL SEARCH
══════════════════════════════════════════ */
function buildSearchIndex() {
  const index = [];
  document.querySelectorAll('.gterm').forEach(el => {
    const title = el.querySelector('strong, .gterm-word');
    const label = title ? title.textContent.trim() : el.textContent.trim().split('\n')[0];
    index.push({ label, section: 'glossary', type: 'Glossary', text: el.textContent.toLowerCase() });
  });
  document.querySelectorAll('.module-header').forEach(el => {
    const id = (el.id || '').replace('mh-', '');
    const label = el.textContent.trim();
    index.push({ label, section: 'education', type: 'Lesson', moduleId: id, text: label.toLowerCase() });
  });
  document.querySelectorAll('[id^="section-research"] h3, [id^="section-research"] h2').forEach(el => {
    const label = el.textContent.trim();
    index.push({ label, section: 'research', type: 'Research', text: label.toLowerCase() });
  });
  Object.keys(SECTION_META).forEach(key => {
    index.push({ label: SECTION_META[key][0], section: key, type: 'Section', text: SECTION_META[key][0].toLowerCase() });
  });
  return index;
}

function setupGlobalSearch() {
  const input = document.getElementById('global-search');
  if (!input) return;

  let dropdown = document.getElementById('global-search-results');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'global-search-results';
    dropdown.className = 'search-dropdown';
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(dropdown);
  }

  let searchIndex = [];
  setTimeout(() => { searchIndex = buildSearchIndex(); }, 500);

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q || q.length < 2) { dropdown.classList.remove('visible'); return; }
    const results = searchIndex.filter(item => item.text.includes(q)).slice(0, 8);
    if (!results.length) {
      dropdown.innerHTML = '<div class="search-no-result">No results found</div>';
    } else {
      dropdown.innerHTML = results.map((r, i) => `
        <div class="search-result-item" data-idx="${i}">
          <span class="search-result-type">${r.type}</span>
          <span class="search-result-label">${r.label}</span>
        </div>`).join('');
      dropdown.querySelectorAll('.search-result-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          const r = results[i];
          showSection(r.section);
          if (r.moduleId) setTimeout(() => scrollToModule(r.moduleId), 300);
          if (r.section === 'glossary') {
            setTimeout(() => {
              const si = document.getElementById('glossary-search');
              if (si) { si.value = input.value; si.dispatchEvent(new Event('input')); }
            }, 300);
          }
          dropdown.classList.remove('visible');
          input.value = '';
        });
      });
    }
    dropdown.classList.add('visible');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.remove('visible'), 200);
  });
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) dropdown.classList.add('visible');
  });
}

/* ══════════════════════════════════════════
   SCROLL-TO-TOP BUTTON
══════════════════════════════════════════ */
function setupScrollToTop() {
  const btn = document.createElement('button');
  btn.id = 'scroll-to-top';
  btn.className = 'scroll-to-top';
  btn.innerHTML = '<i data-lucide="chevron-up" class="icon"></i>';
  btn.title = 'Back to top';
  document.body.appendChild(btn);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });
}

/* ══════════════════════════════════════════
   KEYBOARD SHORTCUT HINTS
══════════════════════════════════════════ */
function showShortcutHints() {
  if (localStorage.getItem('tb-shortcuts-seen')) return;
  const tooltip = document.createElement('div');
  tooltip.className = 'shortcut-tooltip';
  tooltip.innerHTML = `
    <strong>Keyboard Shortcuts</strong>
    <div class="shortcut-row"><kbd>1</kbd>-<kbd>5</kbd> Switch sections</div>
    <div class="shortcut-row"><kbd>/</kbd> Focus search</div>
    <button class="shortcut-dismiss" id="dismiss-shortcuts">Got it</button>`;
  document.body.appendChild(tooltip);
  if (typeof lucide !== 'undefined') lucide.createIcons();
  requestAnimationFrame(() => tooltip.classList.add('visible'));
  document.getElementById('dismiss-shortcuts').addEventListener('click', () => {
    tooltip.classList.remove('visible');
    setTimeout(() => tooltip.remove(), 300);
    localStorage.setItem('tb-shortcuts-seen', '1');
  });
}

/* ══════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const sectionMap = { '1':'dashboard', '2':'markets', '3':'education', '4':'research', '5':'glossary', '6':'paper', '7':'bot' };
    if (sectionMap[e.key]) {
      e.preventDefault();
      showSection(sectionMap[e.key]);
    }
    if (e.key === '/') {
      e.preventDefault();
      const search = document.getElementById('global-search');
      if (search) search.focus();
    }
  });
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  showSection('dashboard');
  showMarketTab('stocks');
  updateMarketStatus();
  renderWatchlist();
  renderAllAssetTabs();
  setupGlossarySearch();
  setupGlobalSearch();
  setupScrollToTop();
  setupOutsideClickClose();
  setupEduNavObserver();
  setupKeyboardShortcuts();
  startPriceTicker();

  setInterval(updateMarketStatus, 60000);
  setTimeout(showShortcutHints, 1500);

  // Init paper trading when section is shown
  if (window.PaperTrading) window.PaperTrading.init();
});
