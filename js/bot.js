/* ─────────────────────────────────────────
   TRADEBASE — BOT.JS
   Live crypto bot dashboard — fetches from
   the local API server at localhost:8765
───────────────────────────────────────── */

const BOT_API = 'http://localhost:8765';
const BOT_GOAL = 20000;
const BOT_REFRESH_MS = 30000;

let botRefreshTimer = null;

/* ══════════════════════════════════════════
   INIT & REFRESH
══════════════════════════════════════════ */
window.BotDashboard = {
  init() {
    this.load();
    if (botRefreshTimer) clearInterval(botRefreshTimer);
    botRefreshTimer = setInterval(() => this.load(), BOT_REFRESH_MS);
  },

  async load() {
    try {
      const res = await fetch(BOT_API + '/state', { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      this.render(data);
      this.setStatus(true, data.timestamp);
    } catch (e) {
      this.setStatus(false, null);
      this.renderOffline();
    }
  },

  /* ── Status Bar ── */
  setStatus(online, timestamp) {
    const dot  = document.getElementById('bot-status-dot');
    const text = document.getElementById('bot-status-text');
    const ts   = document.getElementById('bot-status-ts');
    if (!dot) return;
    dot.className  = 'bot-dot ' + (online ? 'bot-dot-online' : 'bot-dot-offline');
    text.textContent = online ? 'Bot Online' : 'Bot Offline';
    text.style.color = online ? 'var(--green)' : 'var(--red)';
    if (timestamp) {
      const d = new Date(timestamp);
      ts.textContent = 'Updated ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}) + ' UTC';
    } else {
      ts.textContent = 'Run: python main.py bot-server';
    }
  },

  /* ── Offline State ── */
  renderOffline() {
    const body = document.getElementById('bot-dashboard-body');
    if (!body) return;
    body.innerHTML = `
      <div class="bot-offline-card">
        <div class="bot-offline-icon"><i data-lucide="wifi-off" class="icon icon-xl"></i></div>
        <h3>Bot API Not Running</h3>
        <p>Start the API server on your local machine to see live bot data.</p>
        <div class="bot-code-block">python main.py bot-server</div>
        <p class="bot-offline-sub">Keep your watch loop running in a separate terminal, then run the above command. This page auto-refreshes every 30 seconds.</p>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /* ══ MAIN RENDER ══ */
  render(d) {
    const acc  = d.account;
    const cb   = d.circuit_breakers;
    const m    = d.metrics;
    const body = document.getElementById('bot-dashboard-body');
    if (!body) return;

    const halted = cb.any_tripped;
    const statusColor = halted ? 'var(--red)' : 'var(--green)';
    const statusLabel = halted ? ('HALTED: ' + (cb.tripped_names.join(', ') || 'Unknown')) : 'ALL SYSTEMS OPERATIONAL';

    body.innerHTML = `
      ${this._renderSystemBanner(statusLabel, statusColor)}
      ${this._renderStatRow(acc, m)}
      ${this._renderGoalProgress(acc.equity, acc.starting_capital)}
      ${this._renderCircuitBreakers(cb, d)}
      ${this._renderOpenPositions(d.open_positions)}
      ${this._renderPerformance(m)}
      ${this._renderRecentTrades(d.recent_trades)}
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /* ── System Banner ── */
  _renderSystemBanner(label, color) {
    return `
      <div class="bot-banner" style="border-color:${color};color:${color}">
        <span class="bot-banner-dot" style="background:${color}"></span>
        <strong>${label}</strong>
        <span class="bot-banner-sub">BTC/USDT · 1h · Paper Trading Mode</span>
      </div>`;
  },

  /* ── Stat Row ── */
  _renderStatRow(acc, m) {
    const pnlPos = acc.total_pnl >= 0;
    const ddColor = acc.drawdown_pct < 5 ? 'var(--green)' : acc.drawdown_pct < 10 ? 'var(--yellow)' : 'var(--red)';
    const todayPos = (m.today_pnl || 0) >= 0;
    return `
      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="stat-card">
          <div class="stat-label">Account Equity</div>
          <div class="stat-value ${acc.equity >= acc.starting_capital ? 'up' : 'down'}">$${this._fmt(acc.equity)}</div>
          <div class="stat-sub ${pnlPos ? 'up' : 'down'}">${pnlPos?'▲':'▼'} ${pnlPos?'+':''}$${this._fmt(acc.total_pnl)} all-time</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Today P&L</div>
          <div class="stat-value ${todayPos ? 'up' : 'down'}">${todayPos?'+':''}$${this._fmt(m.today_pnl||0)}</div>
          <div class="stat-sub neutral">${m.today_trades||0} trades today</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Drawdown</div>
          <div class="stat-value" style="color:${ddColor}">${acc.drawdown_pct.toFixed(2)}%</div>
          <div class="stat-sub neutral">Peak $${this._fmt(acc.peak_equity)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Open Positions</div>
          <div class="stat-value neutral">${(window._botOpenCount||0)}/3</div>
          <div class="stat-sub neutral">${m.n_trades||0} total closed</div>
        </div>
      </div>`;
  },

  /* ── Goal Progress ── */
  _renderGoalProgress(equity, start) {
    const BAR = 52;
    let filled = 0;
    if (equity > start) {
      const progress = Math.log(Math.max(equity, start + 0.01) / start) / Math.log(BOT_GOAL / start);
      filled = Math.max(0, Math.min(BAR, Math.floor(progress * BAR)));
    }
    const pct = Math.min(((equity - start) / (BOT_GOAL - start)) * 100, 100).toFixed(1);
    const remaining = Math.max(BOT_GOAL - equity, 0);
    const milestones = [[1000,'$1k'],[2000,'$2k'],[5000,'$5k'],[10000,'$10k'],[20000,'$20k']];
    const msHtml = milestones.map(([val, label]) =>
      `<span style="color:${equity>=val?'var(--green)':'var(--muted)'}">${label}</span>`
    ).join('  ');
    return `
      <div class="card" style="margin-bottom:16px;padding:16px 20px">
        <div class="card-title" style="margin-bottom:10px"><i data-lucide="target" class="icon icon-sm"></i> Goal: $1,000 → $20,000</div>
        <div style="font-family:monospace;font-size:13px;margin-bottom:6px">
          <span style="color:var(--green)">${'█'.repeat(filled)}</span><span style="color:var(--border)">${'░'.repeat(BAR-filled)}</span>
          <span style="margin-left:10px;color:var(--text-primary);font-weight:600">$${this._fmt(equity)}</span>
          <span style="color:var(--muted)"> (${pct}% · $${this._fmtInt(remaining)} to go)</span>
        </div>
        <div style="font-size:12px">${msHtml}</div>
      </div>`;
  },

  /* ── Circuit Breakers ── */
  _renderCircuitBreakers(cb, d) {
    const acc = d.account;
    const today_loss = d.metrics.today_pnl || 0;
    const daily_limit = acc.starting_capital * 0.03;
    const streak = d.metrics.current_losing_streak || 0;
    const today_count = d.metrics.today_trades || 0;

    const breakers = [
      ['Daily Loss Limit',   cb.daily_loss_tripped,    `$${Math.abs(today_loss).toFixed(2)} today`,     `limit: $${daily_limit.toFixed(2)}`],
      ['Losing Streak',      cb.losing_streak_tripped, `${streak} consecutive`,                          'limit: 4'],
      ['Max Drawdown',       cb.drawdown_tripped,       `${acc.drawdown_pct.toFixed(1)}% from peak`,     'limit: 15%'],
      ['Manual Halt',        cb.manual_halt,            cb.manual_halt ? 'User activated' : 'Not set',   '—'],
      ['Daily Trade Limit',  cb.daily_trade_limit_tripped, `${today_count} trades`,                      'limit: 8'],
    ];

    const rows = breakers.map(([name, tripped, current, limit]) => `
      <div class="bot-breaker-row">
        <span class="bot-breaker-name">${name}</span>
        <span class="bot-breaker-val" style="color:var(--muted)">${current}</span>
        <span class="bot-breaker-limit" style="color:var(--muted)">${limit}</span>
        <span class="bot-breaker-status" style="color:${tripped?'var(--red)':'var(--green)'}">
          ${tripped ? '⬤ TRIPPED' : '● CLEAR'}
        </span>
      </div>`).join('');

    return `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title"><i data-lucide="shield-alert" class="icon icon-sm"></i> Circuit Breakers</div>
        <div class="bot-breaker-grid">${rows}</div>
        ${cb.last_reason ? `<div style="font-size:11px;color:var(--muted);margin-top:8px">Last: ${cb.last_reason}</div>` : ''}
      </div>`;
  },

  /* ── Open Positions ── */
  _renderOpenPositions(positions) {
    window._botOpenCount = positions.length;
    if (!positions.length) {
      return `
        <div class="card" style="margin-bottom:16px">
          <div class="card-title"><i data-lucide="layers" class="icon icon-sm"></i> Open Positions</div>
          <p style="color:var(--muted);font-size:13px;margin:8px 0 0">No open positions — bot is watching for a valid signal.</p>
        </div>`;
    }
    const rows = positions.map(p => {
      const buy = p.direction === 'BUY';
      const pPos = p.unrealized_pnl >= 0;
      return `
        <tr>
          <td><span style="font-family:monospace;font-size:11px;color:var(--muted)">${p.trade_id}</span></td>
          <td><strong>${p.symbol}</strong></td>
          <td><span style="color:${buy?'var(--green)':'var(--red)'}">${p.direction}</span></td>
          <td>$${this._fmt(p.entry_price)}</td>
          <td>$${this._fmt(p.current_price)}</td>
          <td style="color:var(--red)">$${this._fmt(p.stop_loss)}</td>
          <td style="color:var(--green)">$${this._fmt(p.take_profit)}</td>
          <td style="color:${pPos?'var(--green)':'var(--red)'}">${pPos?'+':''}$${p.unrealized_pnl.toFixed(2)} (${pPos?'+':''}${p.unrealized_pnl_pct.toFixed(2)}%)</td>
          <td>$${this._fmt(p.position_size_usd)}</td>
        </tr>`;
    }).join('');
    return `
      <div class="card" style="margin-bottom:16px;overflow-x:auto">
        <div class="card-title"><i data-lucide="layers" class="icon icon-sm"></i> Open Positions (${positions.length})</div>
        <table class="bot-table">
          <thead><tr><th>ID</th><th>Symbol</th><th>Dir</th><th>Entry</th><th>Current</th><th>Stop</th><th>Target</th><th>Unreal. P&L</th><th>Size</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  /* ── Performance Stats ── */
  _renderPerformance(m) {
    if (!m.n_trades) {
      return `
        <div class="card" style="margin-bottom:16px">
          <div class="card-title"><i data-lucide="bar-chart-2" class="icon icon-sm"></i> Performance</div>
          <p style="color:var(--muted);font-size:13px;margin:8px 0 0">No closed trades yet — stats will appear after the first trade closes.</p>
        </div>`;
    }
    const wColor = m.win_rate_pct >= 50 ? 'var(--green)' : 'var(--red)';
    const pfColor = m.profit_factor >= 1.5 ? 'var(--green)' : m.profit_factor >= 1 ? 'var(--yellow)' : 'var(--red)';
    const shColor = m.sharpe_ratio >= 1 ? 'var(--green)' : m.sharpe_ratio >= 0 ? 'var(--yellow)' : 'var(--red)';
    const stats = [
      ['Total Trades',    m.n_trades, ''],
      ['Win Rate',        m.win_rate_pct.toFixed(1) + '%', wColor],
      ['Profit Factor',   m.profit_factor.toFixed(3), pfColor],
      ['Sharpe Ratio',    m.sharpe_ratio.toFixed(3), shColor],
      ['Avg Win',         '+$' + m.avg_win.toFixed(2), 'var(--green)'],
      ['Avg Loss',        '$' + m.avg_loss.toFixed(2), 'var(--red)'],
      ['Expectancy',      (m.expectancy >= 0 ? '+' : '') + '$' + m.expectancy.toFixed(2), m.expectancy >= 0 ? 'var(--green)' : 'var(--red)'],
      ['Max Drawdown',    '-$' + m.max_drawdown_usd.toFixed(2) + ' (' + m.max_drawdown_pct.toFixed(2) + '%)', 'var(--red)'],
      ['Week P&L',        (m.week_pnl >= 0 ? '+' : '') + '$' + m.week_pnl.toFixed(2), m.week_pnl >= 0 ? 'var(--green)' : 'var(--red)'],
      ['Month P&L',       (m.month_pnl >= 0 ? '+' : '') + '$' + m.month_pnl.toFixed(2), m.month_pnl >= 0 ? 'var(--green)' : 'var(--red)'],
      ['Total Fees',      '-$' + m.total_fees.toFixed(4), 'var(--red)'],
      ['Fee Drag',        m.fee_drag_pct.toFixed(1) + '% of profit', 'var(--red)'],
    ];
    const cards = stats.map(([label, val, color]) => `
      <div class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value" style="${color ? 'color:' + color : ''};font-size:18px">${val}</div>
      </div>`).join('');
    return `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title"><i data-lucide="bar-chart-2" class="icon icon-sm"></i> Performance Stats</div>
        <div class="grid grid-4" style="margin-top:12px">${cards}</div>
      </div>`;
  },

  /* ── Recent Trades ── */
  _renderRecentTrades(trades) {
    if (!trades || !trades.length) return '';
    const reasonMap = { stop_loss:'SL', take_profit:'TP', manual:'MAN', counter_signal:'REV' };
    const rows = trades.map(t => {
      const buy = t.direction === 'BUY';
      const win = t.net_pnl > 0;
      return `
        <tr>
          <td><span style="font-family:monospace;font-size:11px;color:var(--muted)">${t.trade_id}</span></td>
          <td>${t.symbol}</td>
          <td><span style="color:${buy?'var(--green)':'var(--red)'}">${t.direction}</span></td>
          <td>$${this._fmt(t.entry_price)}</td>
          <td>$${this._fmt(t.exit_price)}</td>
          <td style="color:${win?'var(--green)':'var(--red)'}">${win?'+':''}$${t.net_pnl.toFixed(4)}</td>
          <td style="color:${win?'var(--green)':'var(--red)'}">${win?'+':''}${t.net_pnl_pct.toFixed(2)}%</td>
          <td><span class="bot-reason-badge bot-reason-${t.close_reason}">${reasonMap[t.close_reason]||'?'}</span></td>
          <td style="color:var(--muted);font-size:11px">${t.exit_time.slice(0,16).replace('T',' ')}</td>
        </tr>`;
    }).join('');
    return `
      <div class="card" style="overflow-x:auto">
        <div class="card-title"><i data-lucide="history" class="icon icon-sm"></i> Recent Trades (last ${trades.length})</div>
        <table class="bot-table" style="margin-top:10px">
          <thead><tr><th>ID</th><th>Symbol</th><th>Dir</th><th>Entry</th><th>Exit</th><th>Net P&L</th><th>%</th><th>Exit</th><th>Time</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  /* ── Helpers ── */
  _fmt(n) {
    if (n === null || n === undefined) return '—';
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
    if (abs >= 1)    return n.toFixed(4);
    return n.toFixed(6);
  },
  _fmtInt(n) {
    return Math.round(n).toLocaleString('en-US');
  },
};
