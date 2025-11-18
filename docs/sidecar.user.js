// ==UserScript==
// @name         StakeLens Sidecar HUD (v1.3)
// @namespace    https://darkxenom.github.io/sidecar-data
// @match        https://kite.zerodha.com/*
// @match        https://web.dhan.co/*
// @match        https://trade.angelone.in/*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

(() => {
  // ---------- Config ----------
  const BASE = "https://darkxenom.github.io/sidecar-data";
  const THEMES = {
    glassBg: "rgba(17, 23, 30, 0.58)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
    text: "#E6EDF3",
    subtext: "#94A3B8",
    accent: "#22D3EE",
    chip: { amber:"#f59e0b", blue:"#3b82f6", green:"#10b981", red:"#ef4444" }
  };

  // Mode-specific display priority so Day/Swing actually differs even if backend is identical
  const PRIORITY = {
    day:   ['nr7','squeeze','bulk_heat','near_52w','hi55_recent','earnings','insider_net','accum','rod','pledge_delta'],
    swing: ['near_52w','hi55_recent','squeeze','bulk_heat','insider_net','accum','rod','pledge_delta','earnings']
  };

  // ---------- Style (bottom-right only) ----------
  GM_addStyle(`
    #sl-hud {
      position: fixed; right: 16px; bottom: 16px; z-index: 999999;
      width: 340px; max-height: 80vh; overflow: hidden;
      display: none; flex-direction: column; gap: 8px;
      backdrop-filter: blur(10px) saturate(140%);
      background: ${THEMES.glassBg}; color: ${THEMES.text};
      border: 1px solid ${THEMES.glassBorder};
      border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      font: 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
    }
    #sl-hud[data-open="1"]{ display:flex; }
    #sl-hud header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-bottom: 1px solid ${THEMES.glassBorder};
    }
    #sl-hud header .brand { font-weight: 700; letter-spacing: .2px; }
    #sl-hud header .controls { display: flex; gap: 8px; align-items: center; }
    #sl-hud header .pill {
      padding: 4px 10px; border-radius: 999px; cursor: pointer;
      background: rgba(255,255,255,0.06); border: 1px solid ${THEMES.glassBorder};
      color: ${THEMES.subtext}; user-select: none;
    }
    #sl-hud header .pill[data-active="1"]{
      color: ${THEMES.text}; border-color: rgba(34,211,238,.5);
      background: linear-gradient( to bottom, rgba(34,211,238,.22), rgba(34,211,238,.08) );
    }
    #sl-hud .body { padding: 10px 12px 12px; overflow: auto; }
    #sl-hud .verdict { font-size: 13.5px; margin-bottom: 10px; }
    #sl-hud .chips { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .sl-chip {
      border-radius: 12px; padding: 8px 10px; min-height: 44px;
      display: flex; flex-direction: column; gap: 4px;
      border: 1px solid ${THEMES.glassBorder};
      background: rgba(255,255,255,0.04);
    }
    .sl-chip .k { font-size: 12px; text-transform: uppercase; letter-spacing: .3px; color: ${THEMES.subtext}; }
    .sl-chip .v { font-size: 13.25px; font-weight: 600; }
    .sl-chip[data-color="amber"] .bar { background: ${THEMES.chip.amber}; }
    .sl-chip[data-color="blue"]  .bar { background: ${THEMES.chip.blue};  }
    .sl-chip[data-color="green"] .bar { background: ${THEMES.chip.green}; }
    .sl-chip[data-color="red"]   .bar { background: ${THEMES.chip.red};   }
    .sl-chip .bar { height: 3px; width: 100%; border-radius: 999px; opacity: .9; }
    #sl-hud .footer {
      margin-top: 8px; padding-top: 8px; border-top: 1px solid ${THEMES.glassBorder};
      display: flex; justify-content: space-between; align-items: center; color: ${THEMES.subtext};
      font-size: 12px;
    }
    #sl-hud .more { cursor: pointer; font-weight: 600; color: ${THEMES.accent}; }
    #sl-hud .muted { color: ${THEMES.subtext}; }
    #sl-hud .raw {
      display:none; margin-top:8px; padding-top:8px; border-top:1px solid ${THEMES.glassBorder};
      font-size:12.5px; color:${THEMES.subtext};
    }
    #sl-hud .raw[data-open="1"]{ display:block; }
    #sl-hud .raw .row{ display:flex; justify-content:space-between; margin:4px 0; }
    #sl-hud .raw .k{ opacity:.85; }  #sl-hud .raw .v{ color:${THEMES.text}; }
  `);

  // ---------- URL & Symbol detection ----------
  const onLogin = () => /login|connect/i.test(location.pathname);

  function getSymbolFromUrl(){
    const parts = location.pathname.split("/").filter(Boolean);
    // ciq route
    {
      const ciqIdx = parts.findIndex(x => x.toLowerCase() === "ciq");
      if (ciqIdx !== -1 && parts.length >= ciqIdx + 3) {
        const ex  = (parts[ciqIdx + 1] || "NSE").toUpperCase();
        const sym = (parts[ciqIdx + 2] || "").toUpperCase().replace(/[^A-Z0-9.:-]/g,"");
        if (ex && sym) return { ex, sym };
      }
    }
    // quote route
    {
      const qIdx = parts.findIndex(x => x.toLowerCase() === "quote");
      if (qIdx !== -1 && parts.length >= qIdx + 3) {
        const ex  = (parts[qIdx + 1] || "NSE").toUpperCase();
        const sym = (parts[qIdx + 2] || "").toUpperCase().replace(/[^A-Z0-9.:-]/g,"");
        if (ex && sym) return { ex, sym };
      }
    }
    // title fallback
    const m = document.title.match(/\b(NSE|BSE)[:\s-]*([A-Z0-9.\-]{2,})\b/) || document.title.match(/^([A-Z0-9.\-]{2,})\b.*- Charts/i);
    if (m) {
      const ex  = (m[1] && /^(NSE|BSE)$/i.test(m[1])) ? m[1].toUpperCase() : "NSE";
      const sym = (m[2] || m[1]).toUpperCase();
      return { ex, sym };
    }
    return null;
  }

  // ---------- HUD root ----------
  const hud = document.createElement("div");
  hud.id = "sl-hud";
  hud.innerHTML = `
    <header>
      <div class="brand">StakeLens Sidecar</div>
      <div class="controls">
        <div class="pill" data-mode="day" data-active="1">Day</div>
        <div class="pill" data-mode="swing">Swing</div>
      </div>
    </header>
    <div class="body">
      <div class="verdict muted">Loading…</div>
      <div class="chips"></div>
      <div class="raw" id="sl-raw"></div>
      <div class="footer">
        <span class="muted" id="sl-asof"></span>
        <span class="more" id="sl-more">More</span>
      </div>
    </div>`;
  document.documentElement.appendChild(hud);

  let state = {
    ex: "NSE",
    sym: "",
    mode: "day",
    lastHref: location.href,
    expanded: false,
    data: null
  };

  // ---------- Helpers ----------
  const pick = (obj, key) => (obj && obj[key]) ? obj[key] : null;

  function scoreOrder(pool, keys){
    return (keys||[]).map(k => [k, (pool[k]||{}).score||0]).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  }

  function rankKeys(pool, mode){
    const keys = Object.keys(pool||{}).filter(k => k !== "post_mortem");
    const prio = PRIORITY[mode] || [];
    // First, any keys that are in our priority list, ordered by that list
    const inPrio = prio.filter(k => keys.includes(k));
    // Then, the rest by score
    const rest = scoreOrder(pool, keys.filter(k => !inPrio.includes(k)));
    return [...inPrio, ...rest];
  }

  function makeVerdict(data){
    const p = data.pool || {};
    const top = rankKeys(p, state.mode).slice(0,2);
    const map = {
      squeeze:     p.squeeze?.detail,
      nr7:         p.nr7?.detail,
      hi55_recent: p.hi55_recent?.detail,
      near_52w:    p.near_52w?.detail,
      bulk_heat:   p.bulk_heat?.detail,
      earnings:    p.earnings?.detail,
      insider_net: p.insider_net?.detail,
      accum:       p.accum?.detail,
      rod:         p.rod?.detail,
      pledge_delta:p.pledge_delta?.detail
    };
    const bits = top.map(k => map[k]).filter(Boolean);
    if (!bits.length) return "No near-term catalysts detected.";
    return bits.join(" • ");
  }

  function renderChips(data){
    const p = data.pool || {};
    const chipsEl = hud.querySelector(".chips");
    chipsEl.innerHTML = "";

    const labels = {
      earnings: "Earnings",
      egs: "Earnings Gap Safety",
      accum: "Accumulation",
      rod: "Rate of Delivery",
      insider_net: "Insider (30d)",
      pledge_delta: "Pledge Δ30d",
      bulk_heat: "Bulk/Block Heat",
      hi55_recent: "55D High Recent",
      near_52w: "Near 52W",
      squeeze: "Squeeze (BB)",
      nr7: "NR7"
    };

    const ordered = rankKeys(p, state.mode);
    const showKeys = (state.expanded ? ordered : ordered.slice(0,4));

    for (const k of showKeys){
      const v = p[k]; if (!v || !v.detail) continue;
      const chip = document.createElement("div");
      chip.className = "sl-chip";
      chip.dataset.color = (v.color||"blue");
      chip.innerHTML = `
        <div class="k">${labels[k]||k}</div>
        <div class="v">${v.detail}</div>
        <div class="bar"></div>`;
      chipsEl.appendChild(chip);
    }

    // Raw panel content (always rebuild so “More” feels richer)
    const raw = hud.querySelector("#sl-raw");
    const rows = [];
    rows.push(['Symbol', `${data.exchange||'NSE'}:${data.symbol||''}`]);
    rows.push(['As of', (data.as_of||'').replace('T',' ').replace('+05:30',' IST')]);
    rows.push(['Mode', state.mode.toUpperCase()]);
    rows.push(['Signals', ordered.join(', ') || 'none']);
    if (p.bulk_heat?.detail) rows.push(['Deals (30d)', p.bulk_heat.detail]);
    raw.innerHTML = rows.map(([k,v])=>`<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
    raw.dataset.open = state.expanded ? "1" : "0";
  }

  function setAsOf(s){
    hud.querySelector("#sl-asof").textContent = s ? s.replace("T"," ").replace("+05:30"," IST") : "";
  }

  function setVerdict(text){
    const el = hud.querySelector(".verdict");
    el.textContent = text || "—";
    el.classList.toggle("muted", !text || /Loading/i.test(text));
  }

  // ---------- Fetch + Render ----------
  async function pull(){
    if (!state.sym) return;
    try{
      setVerdict("Loading…");
      const url = `${BASE}/data/${state.ex}:${state.sym}.json?ts=${Date.now()}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("No data");
      const data = await r.json();
      state.data = data;

      setAsOf(data.as_of || "");
      setVerdict(makeVerdict(data));
      renderChips(data);

      hud.dataset.open = "1";
    }catch(err){
      setAsOf("");
      setVerdict("No Sidecar data for this symbol yet.");
      hud.dataset.open = "1";
      renderChips({ pool:{} , mode_top:{} });
    }
  }

  // ---------- Events ----------
  function switchMode(mode){
    if (state.mode === mode) return;
    state.mode = mode;
    hud.querySelectorAll('header .pill[data-mode]').forEach(p=>p.dataset.active = (p.dataset.mode===mode) ? "1":"0");
    if (state.data){
      setVerdict(makeVerdict(state.data));
      renderChips(state.data);
    }
  }
  function toggleMore(){
    state.expanded = !state.expanded;
    hud.querySelector("#sl-more").textContent = state.expanded ? "Less" : "More";
    if (state.data) renderChips(state.data);
  }
  hud.querySelector('header .pill[data-mode="day"]').addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); switchMode("day"); });
  hud.querySelector('header .pill[data-mode="swing"]').addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); switchMode("swing"); });
  hud.querySelector("#sl-more").addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); toggleMore(); });

  // Hide on login/connect
  const onLoginTick = () => { if (onLogin()) hud.dataset.open = "0"; };

  // Monitor SPA route changes
  const observeUrl = () => {
    const tick = () => {
      onLoginTick();
      if (state.lastHref !== location.href){
        state.lastHref = location.href;
        const pair = getSymbolFromUrl();
        if (!pair){ hud.dataset.open = "0"; return; }
        state.ex = pair.ex; state.sym = pair.sym;
        pull();
      }
    };
    setInterval(tick, 700);
  };

  // ---------- Bootstrap ----------
  if (onLogin()) return;
  const first = getSymbolFromUrl();
  if (first){ state.ex = first.ex; state.sym = first.sym; }
  observeUrl();
  if (state.sym) pull();
})();
