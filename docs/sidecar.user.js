// ==UserScript==
// @name         StakeLens Sidecar HUD (v1.4)
// @namespace    https://darkxenom.github.io/sidecar-data
// @match        https://kite.zerodha.com/*
// @match        https://web.dhan.co/*
// @match        https://trade.angelone.in/*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

(() => {
  const BASE = "https://darkxenom.github.io/sidecar-data";
  const THEMES = {
    glassBg: "rgba(17, 23, 30, 0.58)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
    text: "#E6EDF3", subtext: "#94A3B8", accent: "#22D3EE",
    chip: { amber:"#f59e0b", blue:"#3b82f6", green:"#10b981", red:"#ef4444" }
  };
  const PRIORITY = {
    day:   ['nr7','squeeze','bulk_heat','near_52w','hi55_recent','earnings','insider_net','accum','rod','pledge_delta'],
    swing: ['near_52w','hi55_recent','squeeze','bulk_heat','insider_net','accum','rod','pledge_delta','earnings']
  };

  GM_addStyle(`
    #sl-hud{position:fixed;right:16px;bottom:16px;z-index:999999;width:340px;max-height:80vh;overflow:hidden;
      display:none;flex-direction:column;gap:8px;backdrop-filter:blur(10px) saturate(140%);
      background:${THEMES.glassBg};color:${THEMES.text};border:1px solid ${THEMES.glassBorder};border-radius:16px;
      box-shadow:0 10px 30px rgba(0,0,0,0.35);font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial}
    #sl-hud[data-open="1"]{display:flex}
    #sl-hud header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid ${THEMES.glassBorder}}
    #sl-hud header .brand{font-weight:700;letter-spacing:.2px}
    #sl-hud header .controls{display:flex;gap:8px;align-items:center}
    #sl-hud header .pill{padding:4px 10px;border-radius:999px;cursor:pointer;background:rgba(255,255,255,.06);
      border:1px solid ${THEMES.glassBorder};color:${THEMES.subtext};user-select:none}
    #sl-hud header .pill[data-active="1"]{color:${THEMES.text};border-color:rgba(34,211,238,.5);
      background:linear-gradient(to bottom,rgba(34,211,238,.22),rgba(34,211,238,.08))}
    #sl-hud .body{padding:10px 12px 12px;overflow:auto}
    #sl-hud .verdict{font-size:13.5px;margin-bottom:10px}
    #sl-hud .chips{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .sl-chip{border-radius:12px;padding:8px 10px;min-height:44px;display:flex;flex-direction:column;gap:4px;
      border:1px solid ${THEMES.glassBorder};background:rgba(255,255,255,.04)}
    .sl-chip .k{font-size:12px;text-transform:uppercase;letter-spacing:.3px;color:${THEMES.subtext}}
    .sl-chip .v{font-size:13.25px;font-weight:600}
    .sl-chip[data-color="amber"] .bar{background:${THEMES.chip.amber}}
    .sl-chip[data-color="blue"]  .bar{background:${THEMES.chip.blue}}
    .sl-chip[data-color="green"] .bar{background:${THEMES.chip.green}}
    .sl-chip[data-color="red"]   .bar{background:${THEMES.chip.red}}
    .sl-chip .bar{height:3px;width:100%;border-radius:999px;opacity:.9}
    #sl-hud .footer{margin-top:8px;padding-top:8px;border-top:1px solid ${THEMES.glassBorder};display:flex;justify-content:space-between;align-items:center;color:${THEMES.subtext};font-size:12px}
    #sl-hud .muted{color:${THEMES.subtext}}
    #sl-hud .more{cursor:pointer;font-weight:600;color:${THEMES.accent}}
    #sl-hud .raw{display:none;margin-top:8px;padding-top:8px;border-top:1px solid ${THEMES.glassBorder};font-size:12.5px;color:${THEMES.subtext}}
    #sl-hud .raw[data-open="1"]{display:block}
    #sl-hud .raw .row{display:flex;justify-content:space-between;margin:4px 0}
    #sl-hud .raw .k{opacity:.85}.raw .v{color:${THEMES.text}}
    #sl-hud .badge{font-size:11px;border:1px solid ${THEMES.glassBorder};padding:2px 6px;border-radius:999px;margin-left:8px}
    #sl-hud .badge[data-age="fresh"]{color:#10b981;border-color:rgba(16,185,129,.45)}
    #sl-hud .badge[data-age="stale"]{color:#f59e0b;border-color:rgba(245,158,11,.45)}
    #sl-hud .badge[data-age="old"]{color:#ef4444;border-color:rgba(239,68,68,.45)}
    #sl-hud .guide{display:none;margin-top:8px;padding-top:8px;border-top:1px solid ${THEMES.glassBorder};font-size:12.5px}
    #sl-hud .guide[data-open="1"]{display:block}
    #sl-hud .guide h4{margin:0 0 6px;font-size:12.5px;color:${THEMES.text}}
    #sl-hud .guide .g-row{margin:6px 0;color:${THEMES.subtext}}
    #sl-hud .guide .g-row b{color:${THEMES.text}}
    #sl-hud .help{cursor:pointer;color:${THEMES.accent};margin-left:10px}
  `);

  const onLogin = () => /login|connect/i.test(location.pathname);

  function getSymbolFromUrl(){
    const parts = location.pathname.split("/").filter(Boolean);
    const ciqIdx = parts.findIndex(x => x.toLowerCase() === "ciq");
    if (ciqIdx !== -1 && parts.length >= ciqIdx + 3) {
      const ex  = (parts[ciqIdx + 1] || "NSE").toUpperCase();
      const sym = (parts[ciqIdx + 2] || "").toUpperCase().replace(/[^A-Z0-9.:-]/g,"");
      if (ex && sym) return { ex, sym };
    }
    const qIdx = parts.findIndex(x => x.toLowerCase() === "quote");
    if (qIdx !== -1 && parts.length >= qIdx + 3) {
      const ex  = (parts[qIdx + 1] || "NSE").toUpperCase();
      const sym = (parts[qIdx + 2] || "").toUpperCase().replace(/[^A-Z0-9.:-]/g,"");
      if (ex && sym) return { ex, sym };
    }
    const m = document.title.match(/\b(NSE|BSE)[:\s-]*([A-Z0-9.\-]{2,})\b/) || document.title.match(/^([A-Z0-9.\-]{2,})\b.*- Charts/i);
    if (m) {
      const ex  = (m[1] && /^(NSE|BSE)$/i.test(m[1])) ? m[1].toUpperCase() : "NSE";
      const sym = (m[2] || m[1]).toUpperCase();
      return { ex, sym };
    }
    return null;
  }

  const hud = document.createElement("div");
  hud.id = "sl-hud";
  hud.innerHTML = `
    <header>
      <div class="brand">StakeLens Sidecar <span class="badge" id="sl-fresh"></span></div>
      <div class="controls">
        <div class="pill" data-mode="day" data-active="1">Day</div>
        <div class="pill" data-mode="swing">Swing</div>
        <span class="help" id="sl-help">Guide</span>
      </div>
    </header>
    <div class="body">
      <div class="verdict muted">Loading…</div>
      <div class="chips"></div>
      <div class="guide" id="sl-guide"></div>
      <div class="raw" id="sl-raw"></div>
      <div class="footer">
        <span class="muted" id="sl-asof"></span>
        <span class="more" id="sl-more">More</span>
      </div>
    </div>`;
  document.documentElement.appendChild(hud);

  let state = { ex:"NSE", sym:"", mode:"day", lastHref:location.href, expanded:false, data:null, guide:false };

  function minutesSinceIst(iso){
    if(!iso) return Infinity;
    // iso like "2025-11-12T16:48+05:30"
    const d = new Date(iso);
    if (isNaN(d)) return Infinity;
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime())/60000);
  }

  function setFreshness(iso){
    const m = minutesSinceIst(iso);
    const badge = hud.querySelector("#sl-fresh");
    if (m <= 1440){ badge.dataset.age="fresh"; badge.textContent="Fresh"; }
    else if (m <= 3*1440){ badge.dataset.age="stale"; badge.textContent="Stale"; }
    else { badge.dataset.age="old"; badge.textContent="Old"; }
  }

  function scoreOrder(pool, keys){
    return (keys||[]).map(k => [k, (pool[k]||{}).score||0]).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  }
  function rankKeys(pool, mode){
    const keys = Object.keys(pool||{}).filter(k => k !== "post_mortem");
    const prio = PRIORITY[mode] || [];
    const inPrio = prio.filter(k => keys.includes(k));
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
    return bits.length ? bits.join(" • ") : "No near-term catalysts detected.";
  }

  function chipLabelMap(){
    return {
      squeeze: "Squeeze (BB)",
      nr7: "NR7",
      hi55_recent: "55D High Recent",
      near_52w: "Near 52W",
      bulk_heat: "Bulk/Block Heat",
      earnings: "Earnings",
      insider_net: "Insider (30d)",
      accum: "Accumulation",
      rod: "Rate of Delivery",
      pledge_delta: "Pledge Δ30d"
    };
  }
  function chipGuideCopy(k, detail){
    const map = {
      squeeze: ["Volatility is compressed.", "Plan: Buy first daily close above prev day high; invalidation: close back inside range."],
      nr7: ["Narrowest day in 7 = coil.", "Plan: Intraday break of NR7 high on 15–30m close; stop = back inside NR7."],
      hi55_recent: ["Strong momentum recently.", "Plan: Buy first pullback to 5/10 EMA; stop = pullback low."],
      near_52w: ["Price is within ~2% of 52W high.", "Plan: 30m close above 52W; stop = back below 52W."],
      bulk_heat: ["Unusual bulk/block clustering.", "Plan: Size-up when paired with NR7/Squeeze; not a solo trigger."],
      earnings: ["Corporate event risk.", "Plan: Reduce leverage pre-event; trade post-print continuation."],
      insider_net: ["Promoters/insiders net buyers.", "Plan: Use as bias booster with other triggers."],
      accum: ["Deliveries increasing vs volume.", "Plan: Favor pullback entries; avoid chasing gaps."],
      rod: ["Delivery multiplier elevated.", "Plan: Expect slippage; use limit orders or smaller size."],
      pledge_delta: ["Pledge change flagged.", "Plan: Avoid oversized bets until stable."]
    };
    const x = map[k]; if(!x) return null;
    return `<div class="g-row"><b>${chipLabelMap()[k]||k}:</b> ${x[0]}<br/>${x[1]}</div>`;
  }

  function renderGuide(data){
    const p = data.pool || {};
    const ordered = rankKeys(p, state.mode);
    const g = hud.querySelector("#sl-guide");
    if (!state.guide){ g.dataset.open="0"; g.innerHTML=""; return; }
    const blocks = [];
    for (const k of ordered){
      const v = p[k]; if (!v) continue;
      const copy = chipGuideCopy(k, v.detail);
      if (copy) blocks.push(copy);
    }
    g.innerHTML = `<h4>Guide</h4>${blocks.join("") || '<div class="g-row">No signals today. Trade your plan.</div>'}`;
    g.dataset.open="1";
  }

  function renderChips(data){
    const p = data.pool || {};
    const chipsEl = hud.querySelector(".chips");
    chipsEl.innerHTML = "";
    const labels = chipLabelMap();
    const ordered = rankKeys(p, state.mode);
    const showKeys = (state.expanded ? ordered : ordered.slice(0,4));

    for (const k of showKeys){
      const v = p[k]; if (!v || !v.detail) continue;
      const chip = document.createElement("div");
      chip.className = "sl-chip"; chip.dataset.color = (v.color||"blue");
      chip.innerHTML = `<div class="k">${labels[k]||k}</div><div class="v">${v.detail}</div><div class="bar"></div>`;
      chipsEl.appendChild(chip);
    }

    // Raw facts
    const raw = hud.querySelector("#sl-raw");
    const rows = [];
    rows.push(['Symbol', `${data.exchange||'NSE'}:${data.symbol||''}`]);
    rows.push(['As of', (data.as_of||'').replace('T',' ').replace('+05:30',' IST')]);
    rows.push(['Mode', state.mode.toUpperCase()]);
    rows.push(['Signals', ordered.join(', ') || 'none']);
    if (p.bulk_heat?.detail) rows.push(['Deals (30d)', p.bulk_heat.detail]);
    raw.innerHTML = rows.map(([k,v])=>`<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
    raw.dataset.open = state.expanded ? "1" : "0";

    renderGuide(data);
  }

  function setAsOf(s){
    hud.querySelector("#sl-asof").textContent = s ? s.replace("T"," ").replace("+05:30"," IST") : "";
    setFreshness(s);
  }

  function setVerdict(text){
    const el = hud.querySelector(".verdict");
    el.textContent = text || "—";
    el.classList.toggle("muted", !text || /Loading/i.test(text));
  }

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

  function switchMode(mode){
    if (state.mode === mode) return;
    state.mode = mode;
    hud.querySelectorAll('header .pill[data-mode]').forEach(p=>p.dataset.active = (p.dataset.mode===mode) ? "1":"0");
    if (state.data){ setVerdict(makeVerdict(state.data)); renderChips(state.data); }
  }
  function toggleMore(){
    state.expanded = !state.expanded;
    hud.querySelector("#sl-more").textContent = state.expanded ? "Less" : "More";
    if (state.data) renderChips(state.data);
  }
  function toggleGuide(){
    state.guide = !state.guide;
    if (state.data) renderGuide(state.data);
    const h = hud.querySelector("#sl-help");
    h.textContent = state.guide ? "Guide ✓" : "Guide";
  }

  hud.querySelector('header .pill[data-mode="day"]').addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); switchMode("day"); });
  hud.querySelector('header .pill[data-mode="swing"]').addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); switchMode("swing"); });
  hud.querySelector("#sl-more").addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); toggleMore(); });
  hud.querySelector("#sl-help").addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); toggleGuide(); });

  const observeUrl = () => {
    const tick = () => {
      if (onLogin()) { hud.dataset.open = "0"; return; }
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

  if (onLogin()) return;
  const first = getSymbolFromUrl();
  if (first){ state.ex = first.ex; state.sym = first.sym; }
  observeUrl();
  if (state.sym) pull();
})();
