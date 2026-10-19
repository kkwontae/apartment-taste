// 화면: F.next가 준 묘사만 그리고, 답은 F.answer로만 넘긴다. 결과는 R.build/R.html. (계산은 engine.js·flow.js·report.js)
const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const photo = id => `img/${id}.webp`;
const DRAFT = 'kr-apt-draft', DAY = 864e5, FORMS = ['start', 'matrix', 'life'], CHOICE = ['choice', 'photos', 'closer'];
let st, scr, snaps, trail, vals, shownAt = 0, busy = false, seq = 0, consult = null, chipsOn = true, pro = false, held = '';

// ── 취향 지도: 스타일은 이름 없는 점, 내 점·점구름은 애니메이션 ──
const mapSvg = ax => `<svg class="map${ax ? ' ax' : ''}" viewBox="0 0 100 100" role="img" aria-label="취향 지도">
  <rect class="field" x=".3" y=".3" width="99.4" height="99.4" rx="3"/>
  <g class="axes" aria-hidden="true"><text x="50" y="5.5" text-anchor="middle">${DATA.map.y[0]}</text><text x="50" y="98" text-anchor="middle">${DATA.map.y[1]}</text><text x="2" y="51">${DATA.map.x[0]}</text><text x="98" y="51" text-anchor="end">${DATA.map.x[1]}</text></g>
  ${Object.entries(E.styleAt).map(([id, [x, y]]) => `<circle class="sd" cx="${x}" cy="${y}" r="1.3" fill="${DATA.styles[id].palette[2]}"/>`).join('')}
  <polyline class="trail"/><g class="cloud">${'<circle r=".9"/>'.repeat(20)}</g><circle class="me" r="2.4"/></svg>`;
const place = (svg, p) => {
  const m = $('.me', svg); m.setAttribute('cx', p.me[0]); m.setAttribute('cy', p.me[1]);
  $$('.cloud circle', svg).forEach((c, i) => { c.setAttribute('cx', p.cloud[i][0]); c.setAttribute('cy', p.cloud[i][1]); });
};
const move = (svg, to, animate) => { // 700ms 이동(움직임 줄이기면 바로)
  const from = svg._p || to, d = animate && !reduce() ? 700 : 0, t0 = performance.now();
  cancelAnimationFrame(svg._raf);
  const f = now => {
    const e = d ? Math.min(1, (now - t0) / d) : 1, k = 1 - (1 - e) ** 3, mix = (a, b) => a + (b - a) * k;
    svg._p = { me: to.me.map((v, j) => mix(from.me[j], v)), cloud: to.cloud.map((p, i) => p.map((v, j) => mix(from.cloud[i][j], v))) };
    place(svg, svg._p);
    if (e < 1) svg._raf = requestAnimationFrame(f);
  };
  svg._raf = requestAnimationFrame(f);
};
const liveOf = s => { const P = E.replay(s); return { me: E.mapPos(P.m), cloud: E.cloud(P, s.seed), words: words(P) }; };
// 상위 태그 3개(고객 말): 짝 차원은 부호로 한쪽 태그, 나머지는 양수일 때만
const words = P => E.LAT.map((d, i) => { const m = P.m[i], p = DATA.pairs[i]; return i < 5 ? [m > 0 ? p[0] : p[1], Math.abs(m)] : [d, m]; })
  .filter(([t, v]) => v > 0.15 && !DATA.styleSkip.includes(t) && DATA.tags[t]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => DATA.tags[t].word);
const tagChips = w => w.map(x => `<span class="tag">${esc(x)}</span>`).join('');
const drawTrail = svg => $('.trail', svg).setAttribute('points', trail.map(p => p.map(n => n.toFixed(1)).join(',')).join(' '));
const updateLive = animate => {
  const live = $('#live'); if (!live) return;
  const L = liveOf(st), svg = $('.map', live);
  move(svg, L, animate); drawTrail(svg);
  $('#tags').innerHTML = chipsOn && st.log.length >= 2 ? tagChips(L.words) || '<span class="small">고를수록 나타나요</span>' : '';
  return L;
};

// ── 견본·사진 그리기 ──
const TINT = { 2700: 'rgba(255,150,50,.34)', 3000: 'rgba(255,160,60,.30)', 4000: 'rgba(255,214,170,.14)', 6500: 'rgba(150,190,255,.25)' };
const visHtml = v => v.svg ? `<span class="ph">${v.svg}</span>`
  : v.render ? `<span class="ph"><img src="${photo(v.render.img)}" alt="" style="filter:brightness(${v.render.bright})"><i class="tint" style="background:${TINT[v.render.k] || 'transparent'}"></i>${v.render.glows.map(([x, y, r]) => `<i class="glow" style="background:radial-gradient(ellipse ${r || 22}% ${(r || 22) * 4 / 3}% at ${x}% ${y}%,rgba(255,190,120,.45),transparent)"></i>`).join('')}</span>`
  : v.chips ? `<span class="board">${v.img ? `<span class="ph"><img src="${photo(v.img)}" alt="${esc(v.alt)}"></span>` : ''}<span class="ph pal">${v.pal.map(c => `<i style="background:${c}"></i>`).join('')}</span><span class="chipsrow">${v.chips.map(visHtml).join('')}</span></span>`
  : v.pal ? `<span class="ph pal">${v.pal.map(c => `<i style="background:${c}"></i>`).join('')}</span>`
  : v.img ? `<span class="ph"><img src="${photo(v.img)}" alt="${esc(v.alt)}"></span>` : '';
const urls = s => !s ? [] : [...new Set(s.opts.flatMap(o => { const v = o.vis || {}; return [v.img, v.render && v.render.img, ...(v.chips || []).flatMap(c => [c.img, c.render && c.render.img])]; }).filter(Boolean))].map(photo);
const load = u => { const i = new Image(); i.src = u; return i.decode ? i.decode().catch(() => {}) : Promise.resolve(); };
const preload = s => Promise.race([Promise.all(urls(s).map(load)), new Promise(r => setTimeout(r, 4000))]);
const ahead = () => { // 사진 화면은 답마다(최대 4) 다음 화면 이미지를 미리 받는다
  if (scr.type !== 'photos') return;
  const my = seq, base = st, cur = scr; let k = 0;
  const step = () => { if (my !== seq || k >= cur.opts.length) return; try { urls(F.next(F.answer(base, cur, k++, 0))).forEach(load); } catch (e) {} setTimeout(step, 80); };
  setTimeout(step, 400);
};
const zoom = html => {
  const o = document.createElement('div'), from = document.activeElement;
  o.className = 'ovl'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', '확대');
  o.innerHTML = `<div class="zbox">${html}</div><button class="ghost" style="background:var(--card)">닫기</button>`;
  const close = () => { o.remove(); if (from && from.focus) from.focus(); };
  o.onclick = close; o.onkeydown = e => { if (e.key === 'Escape') close(); };
  document.body.append(o); $('button', o).focus();
};

// ── 진행 ──
const save = () => store.set(DRAFT, JSON.stringify({ t: Date.now(), st, trail }));
const quizShell = () => {
  $app.innerHTML = `<div class="quiz nolive" id="quiz"><aside class="live" id="live" hidden aria-label="지금까지의 취향">
    <div class="progress" role="progressbar" aria-label="진행" aria-valuemin="0" aria-valuemax="100"><div></div></div>
    <div class="lv-body">${mapSvg()}<div class="lv-side"><p class="where" id="where"></p><p class="chips live-tags" id="tags" aria-live="polite"></p>
    ${consult ? `<label class="consult-tog"><input type="checkbox" id="tagtog" ${chipsOn ? 'checked' : ''}> 고객 화면에 태그 칩 보이기</label>` : ''}</div></div></aside><div id="q"></div></div>`;
  const tg = $('#tagtog'); if (tg) tg.onchange = () => { chipsOn = tg.checked; updateLive(false); };
  const svg = $('#live .map'), L = liveOf(st); svg._p = L; place(svg, L);
};
const boot = (msg = '') => {
  seq++;
  const p = new URLSearchParams(location.hash.slice(1)), by = p.get('by') || '';
  consult = p.get('mode') === 'consult' ? { by: by.slice(0, 20), zones: (p.get('z') || '').split(',').filter(z => DATA.start.zones.some(x => x.id === z)) } : null;
  st = E.fresh({ by: consult ? consult.by : '', at: Date.now() }); snaps = []; trail = []; vals = {}; held = msg;
  quizShell(); show(F.next(st));
};
const show = async s => {
  const my = ++seq; scr = s; busy = true; $('#q').classList.add('busy');
  await preload(s);
  if (my !== seq) return;
  render(s); busy = false;
  const live = $('#live'), first = s.type === 'start' && s.sid === 'start';
  live.hidden = !st.mode || first; $('#quiz').classList.toggle('nolive', live.hidden); live.classList.toggle('fold', !!s.big);
  const scored = CHOICE.includes(s.type);
  $('#where').textContent = [s.secName, scored && s.pos ? `${s.pos.i}/${s.pos.n}` : ''].filter(Boolean).join(' · ');
  $('.progress div', live).style.width = (s.pos ? s.pos.sec * 100 : 0) + '%';
  $('.progress', live).setAttribute('aria-valuenow', Math.round((s.pos ? s.pos.sec : 0) * 100));
  const h = $('#q h2'); if (h) h.focus({ preventScroll: true });
  scrollTo(0, 0);
  requestAnimationFrame(() => { shownAt = performance.now(); $('#q').classList.remove('busy'); });
  if (s.type === 'card') { const t = setTimeout(() => my === seq && !busy && answer(0), 1500); $('.card-me').addEventListener('click', () => clearTimeout(t)); }
  ahead();
};
const answer = pick => {
  if (busy) return;
  const t = Math.round(performance.now() - shownAt), n = F.answer(st, scr, pick, t);
  if (n === st) return false;
  if (scr.type !== 'card') snaps.push({ st, scr, tl: trail.length });
  const grew = n.log.length > st.log.length; st = n;
  if (grew) trail.push(E.mapPos(E.replay(st).m));
  busy = true; updateLive(true); save();
  setTimeout(() => { const s = F.next(st); if (s) show(s); else finish(); }, 0);
  return true;
};
const back = () => {
  if (busy || !snaps.length) return;
  const s = snaps.pop(); st = s.st; trail.length = s.tl; updateLive(true); save(); show(s.scr);
};

// ── 화면 그리기 ──
const render = s => {
  const q = $('#q'), body = FORMS.includes(s.type) ? formScr(s) : CHOICE.includes(s.type) ? choiceScr(s) : s.type === 'card' ? cardScr(s) : pickScr(s);
  q.innerHTML = `<section class="q" data-type="${s.type}" data-kind="${s.kind || ''}" data-sid="${esc(s.sid)}">${body}</section>`;
  const b = $('#back'); if (b) b.onclick = back;
  (s.type === 'card' ? cardWire : FORMS.includes(s.type) ? formWire : CHOICE.includes(s.type) ? choiceWire : pickWire)(s);
};
const backRow = (extra = '') => `<div class="row">${snaps.length ? '<button class="back" id="back">← 이전</button>' : '<span></span>'}<span class="skips">${extra}</span></div>`;

// 점수 화면(견본·사진·마무리 비교)
const capOf = (s, o) => o.cap ? `<span class="cap">${esc(o.cap)}${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</span>` : '';
const choiceScr = s => {
  const text = s.opts.some(o => o.vis.text), cls = text ? 'list' : s.big ? 'big' : s.type === 'closer' ? 'two' : s.opts.length === 3 && s.kind === 'taste' ? 'three' : 'grid';
  const cell = (o, k) => {
    const v = o.vis, name = v.alt ? `${o.label}: ${v.alt}` : o.label, zoomable = !text && !v.pal || v.chips;
    return `<div class="cell"><button class="opt ${text ? 'text' : ''}" data-k="${k}" data-n="${k + 1}" aria-label="${esc(name)}">${text ? `<span>${esc(o.label)}${o.desc ? `<small class="sub">${esc(o.desc)}</small>` : ''}</span>` : visHtml(v) + capOf(s, o)}</button>${zoomable ? `<button class="zoom" data-z="${k}" aria-label="${esc(o.label)} 확대">확대</button>` : ''}</div>`;
  };
  return `<h2 tabindex="-1">${esc(s.q)}</h2><div class="opts ${cls}" role="group" aria-label="${esc(s.q)}">${s.opts.map(cell).join('')}</div>
    ${backRow(`${s.unsure ? '<button class="skip" data-k="-2">잘 모르겠어요</button>' : ''}${s.none ? `<button class="skip" data-k="-1">${esc(s.none)}</button>` : ''}`)}`;
};
const choiceWire = s => {
  $$('.opt, .skip[data-k]').forEach(b => (b.onclick = () => answer(+b.dataset.k)));
  $$('.zoom').forEach(b => (b.onclick = () => zoom(visHtml(s.opts[+b.dataset.z].vis))));
};

// 구간 끝 '지금까지의 나': 지도 + 축 이름 + 견본 칩(스타일 이름 없음)
const cardScr = s => `<div class="card-me" id="cardme"><p class="eyebrow">${esc(s.secName)} 구간 끝</p><h2 tabindex="-1">${esc(s.q)}</h2>${mapSvg(true)}<p class="chips" id="cardtags"></p>
  <button class="primary" id="cardgo">계속하기</button><p class="small">탭하면 바로 넘어가요</p></div>`;
const cardWire = () => {
  const svg = $('#cardme .map'), L = liveOf(st); svg._p = L; place(svg, L); drawTrail(svg);
  $('#cardtags').innerHTML = tagChips(L.words);
  $('#cardme').onclick = () => answer(0);
};

// NG·필수: 여러 개 고르기 + 40자 메모
const pickScr = s => {
  const v = vals[s.sid] || { ids: [], memo: '' };
  return `<h2 tabindex="-1">${esc(s.q)}</h2><p class="sub">최대 ${s.max}개</p>
    <div class="opts grid" role="group" aria-label="${esc(s.q)}">${s.opts.map(o => `<div class="cell"><button class="opt ${o.vis.text ? 'text' : ''}" data-id="${o.key}" aria-pressed="${v.ids.includes(o.key)}">${o.vis.text ? esc(o.label) : visHtml(o.vis) + capOf(s, o)}</button></div>`).join('')}</div>
    <p class="cnt" id="cnt"></p>
    <label class="fld">${esc(s.memoQ)}<input type="text" id="memo" maxlength="${s.memo}" value="${esc(v.memo)}"></label>
    <div class="row sticky"><span>${snaps.length ? '<button class="back" id="back">← 이전</button>' : ''}</span><span class="skips"><button class="skip" id="nonebtn">${esc(s.none)}</button><button class="primary" id="nextbtn">다음</button></span></div>`;
};
const pickWire = s => {
  const v = vals[s.sid] = vals[s.sid] || { ids: [], memo: '' }, bs = $$('.opt[data-id]');
  const sync = () => { bs.forEach(b => { const on = v.ids.includes(b.dataset.id); b.setAttribute('aria-pressed', on); b.disabled = !on && v.ids.length >= s.max; }); $('#cnt').textContent = `${v.ids.length}/${s.max}개 골랐어요`; };
  bs.forEach(b => (b.onclick = () => { const i = v.ids.indexOf(b.dataset.id); if (i >= 0) v.ids.splice(i, 1); else if (v.ids.length < s.max) v.ids.push(b.dataset.id); sync(); }));
  $('#memo').oninput = e => { v.memo = e.target.value; };
  $('#nextbtn').onclick = () => answer({ ids: v.ids, memo: v.memo });
  $('#nonebtn').onclick = () => answer({ ids: [], memo: '' });
  sync();
};

// 폼 화면(시작·우리 집·바꿀 것·생활)
const showIf = (f, v) => Object.entries(f.if || {}).every(([k, x]) => Array.isArray(v[k]) ? v[k].includes(x) : v[k] === x);
const fieldHtml = (f, v) => {
  const cur = v[f.id], on = o => f.multi ? (cur || []).includes(o.id) : cur === o.id;
  const btn = o => `<button type="button" class="chipb${on(o) ? ' on' : ''}" data-f="${f.id}" data-o="${o.id}" aria-pressed="${on(o)}">${o.icon ? `<span class="ic" aria-hidden="true">${o.icon}</span>` : ''}${esc(o.label)}</button>`;
  if (f.text) return `<label class="fld">${esc(f.q)}<input type="text" data-t="${f.id}" maxlength="${f.text}" value="${esc(cur || '')}" autocomplete="off">${f.desc ? `<small class="sub">${esc(f.desc)}</small>` : ''}</label>`;
  if (f.toggle) return `<div class="fld"><label class="cb"><input type="checkbox" data-c="${f.id}" ${cur ? 'checked' : ''}> ${esc(f.q)}</label></div>`;
  if (f.rows) return `<fieldset class="fld"><legend>${esc(f.q)}</legend><p class="sub">고르지 않은 항목은 ${v.scope === 'partial' ? '유지' : '모름'}으로 봐요</p>${f.rows.map(r => `<div class="mrow" role="group" aria-label="${esc(r.label)}"><b>${esc(r.label)}</b>${f.opts.map(o => `<button type="button" class="chipb${(cur || {})[r.id] === o.id ? ' on' : ''}" data-f="${f.id}" data-r="${r.id}" data-o="${o.id}" aria-pressed="${(cur || {})[r.id] === o.id}">${esc(o.label)}</button>`).join('')}</div>`).join('')}</fieldset>`;
  const sel = f.opts.find(o => o.desc && on(o));
  return `<fieldset class="fld"><legend>${esc(f.q)}</legend><div class="${f.opts.some(o => o.icon) ? 'zones' : 'chips'}">${f.opts.map(btn).join('')}</div>${sel ? `<p class="sub">${esc(sel.desc)}</p>` : ''}</fieldset>`;
};
const homePick = v => { const home = {}; for (const k in v) if (k.startsWith('home.')) home[k.slice(5)] = v[k]; return { ...v, home }; };
const ready = (s, v) => s.sid !== 'start' || (v.mode && v.scope && (v.zones || []).length && (!(v.zones || []).includes('smallroom') || (v.rooms || []).length));
const initVals = s => { // 처음 보는 폼: 기본값 + 상담 링크 미리 채움
  const v = {};
  for (const f of s.fields) if (f.def !== undefined) v[f.id] = JSON.parse(JSON.stringify(f.def));
  if (s.sid === 'start' && consult) { v.mode = 'standard'; v.scope = 'partial'; v.zones = consult.zones; }
  return v;
};
const formScr = s => {
  const first = s.sid === 'start', d = store.get(DRAFT); let draft = null;
  try { draft = first && d ? JSON.parse(d) : null; } catch (e) {}
  if (draft && (Date.now() - draft.t > DAY || !draft.st || !draft.st.mode)) draft = null;
  return `${first ? `<div class="intro"><p class="eyebrow">우리 집 취향 리포트</p><h1>인테리어를 몰라도<br>취향은 이미 있어요</h1><p>사진과 견본을 느낌대로 고르기만 하면, 집 전체와 공간별 취향을 찾아 인테리어 상담에 바로 쓸 수 있는 리포트로 정리해 드려요.${consult && consult.by ? ` <b>${esc(consult.by)}</b>에서 보낸 상담 링크예요.` : ''}</p></div>` : `<h2 tabindex="-1">${esc(s.q)}</h2>`}
    ${held ? `<p class="rp-warn" role="alert">${esc(held)}</p>` : ''}
    ${draft ? `<div class="banner"><p>하던 진행이 있어요 · ${Math.max(1, Math.round((Date.now() - draft.t) / 6e4))}분 전</p><span><button class="ghost" id="resume">이어서 하기</button> <button class="skip" id="fresh">새로 시작</button></span></div>` : ''}
    ${s.desc ? `<p class="sub">${esc(s.desc)}</p>` : ''}<div id="flds"></div><p class="est" id="est" aria-live="polite"></p>
    <div class="row sticky"><span>${snaps.length ? '<button class="back" id="back">← 이전</button>' : ''}</span><button class="primary" id="nextbtn">${first ? '시작하기' : '다음'}</button></div>
    ${first ? `<details class="cl"><summary>전문가이신가요? 상담 링크 만들기</summary><div class="row"><input id="clby" maxlength="20" placeholder="업체명" aria-label="업체명"><button class="ghost" id="clcopy">링크 복사</button></div><p class="small">위에서 고른 공간이 링크에 미리 채워져요.</p></details>` : ''}`;
};
const formWire = s => {
  const v = vals[s.sid] = vals[s.sid] || initVals(s), box = $('#flds');
  const draw = () => {
    const at = document.activeElement, sel = at && at.dataset && at.dataset.f ? `[data-f="${at.dataset.f}"]${at.dataset.r ? `[data-r="${at.dataset.r}"]` : ''}[data-o="${at.dataset.o}"]` : '';
    box.innerHTML = s.fields.filter(f => showIf(f, v)).map(f => fieldHtml(f, v)).join('');
    if (sel) { const b = $(sel, box); if (b) b.focus({ preventScroll: true }); }
    const ok = ready(s, v); $('#nextbtn').setAttribute('aria-disabled', !ok);
    let est = '';
    if (s.sid === 'start' && ok) { try { const n = F.answer(st, s, homePick(v)), e = F.estimate(n); est = `예상 약 ${Math.max(1, Math.round(e.seconds / 60))}분 · 화면 ${e.screens}개`; } catch (x) {} } else if (s.sid === 'start') est = (v.zones || []).includes('smallroom') && !(v.rooms || []).length ? '작은방은 어떤 방인지 골라 주세요' : '모드와 공사 범위를 골라 주세요';
    $('#est').textContent = est;
  };
  box.onclick = e => {
    const b = e.target.closest('.chipb'); if (!b) return;
    const f = s.fields.find(x => x.id === b.dataset.f), o = b.dataset.o, r = b.dataset.r;
    if (r) { v[f.id] = { ...v[f.id] }; if (v[f.id][r] === o) delete v[f.id][r]; else v[f.id][r] = o; }
    else if (f.multi) { const a = v[f.id] || [], i = a.indexOf(o); v[f.id] = i >= 0 ? a.filter(x => x !== o) : f.max && a.length >= f.max ? a : [...a, o]; }
    else v[f.id] = o;
    if (f.id === 'scope') { v.zones = [...(f.opts.find(x => x.id === o).zones || [])]; if (!v.zones.includes('smallroom')) v.rooms = []; }
    draw();
  };
  box.oninput = e => { const t = e.target; if (t.dataset.t) v[t.dataset.t] = t.value; };
  box.onchange = e => { const t = e.target; if (t.dataset.c) v[t.dataset.c] = t.checked; };
  $('#nextbtn').onclick = () => { if (!ready(s, v)) return draw(); const ok = answer(homePick(v)); if (ok === false) { held = ''; draw(); } };
  const rs = $('#resume'), fr = $('#fresh');
  if (rs) rs.onclick = () => { try { const d = JSON.parse(store.get(DRAFT)); st = d.st; trail = d.trail || []; snaps = []; vals = {}; updateLive(false); const n = F.next(st); n ? show(n) : finish(); } catch (e) { store.del(DRAFT); boot(); } };
  if (fr) fr.onclick = () => { store.del(DRAFT); boot(); };
  const cc = $('#clcopy');
  if (cc) cc.onclick = () => copy(cc, `${location.origin}${location.pathname}#z=${(v.zones || []).join(',')}&mode=consult&by=${encodeURIComponent($('#clby').value.trim())}`);
  draw();
};

// ── 끝: 결과 링크 ──
const finish = () => {
  store.del(DRAFT);
  const x = (st.ac ? `&ac=${st.ac}` : '') + ((st.fix || []).length ? `&fix=${st.fix.join(',')}` : ''); // E.encode가 ac·fix를 안 담아서 링크 옆에 붙인다
  history.pushState(null, '', `#r=${E.encode(st)}${x}`);
  document.body.classList.remove('pro-on');
  showResult(fromLink(new URLSearchParams(location.hash.slice(1))) || st);
};
const fromLink = p => {
  const r = E.decode(p.get('r') || ''); if (!r) return null;
  const ac = p.get('ac'), fix = (p.get('fix') || '').split(',');
  return { ...r, ac: DATA.start.ac.opts.some(o => o.id === ac) ? ac : '', fix: DATA.start.fix.opts.map(o => o.id).filter(id => fix.includes(id)) };
};

// ── 결과 화면 ──
const copy = (btn, text) => { const old = btn.textContent, done = () => { btn.textContent = '복사됨 ✓'; setTimeout(() => (btn.textContent = old), 1800); };
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(done, () => { prompt('아래 내용을 복사하세요', text); }); };
const dl = (name, type, data) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const drawResultMap = (root, M) => {
  root.innerHTML = mapSvg(true); const svg = $('svg', root);
  place(svg, { me: M.map.me, cloud: M.map.cloud });
  svg.insertAdjacentHTML('beforeend', M.map.near.map(n => `<text class="nr" x="${n.at[0] + 1.6}" y="${n.at[1] - 1.4}">${n.n}</text>`).join(''));
};
const showResult = r => {
  seq++; document.title = `${r.name ? r.name + '님의 ' : ''}우리 집 취향 리포트`;
  $app.innerHTML = '<p class="small" role="status">리포트를 정리하는 중이에요…</p>';
  setTimeout(() => {
    const M = R.build(r), key = `memo:${M.code}`;
    let memo = store.get(key) || '';
    const draw = () => {
      const h = R.html(M, { pro });
      document.body.classList.toggle('pro-on', pro);
      $('#rp').innerHTML = h.customer + h.expert;
      drawResultMap($('.rp-map'), M);
      $$('[data-copy]').forEach(p => p.insertAdjacentHTML('afterend', '<p class="noprint"><button class="ghost" data-cp>이 문장 복사</button></p>'));
      $$('[data-cp]').forEach(b => (b.onclick = () => copy(b, b.parentNode.previousElementSibling.textContent.trim())));
      const m = $('[data-memo]'); if (m) { m.outerHTML = `<textarea class="memo" aria-label="전문가 메모" placeholder="상담 메모를 적어 두세요 (이 기기에 저장돼요)"></textarea>`; const t = $('.memo'); t.value = memo; t.oninput = () => { memo = t.value; store.set(key, memo); }; }
      $$('a[href^="#r="]').forEach(a => a.setAttribute('href', location.hash)); // 앱 안에서 다시 열 때도 ac·fix가 붙은 링크
      $('#pro').textContent = pro ? '전문가 보기 끄기' : '전문가 보기';
      $('#pro').setAttribute('aria-pressed', pro);
    };
    $app.innerHTML = `<div class="result"><div class="rbar noprint">
      <button class="primary" id="send">상담받을 업체에 보내기</button><button class="ghost" id="print">인쇄 · PDF</button><button class="ghost" id="csv">선정표 CSV</button><button class="ghost" id="json">JSON 저장</button><button class="ghost" id="again">다시 하기</button><button class="ghost" id="pro" aria-pressed="false">전문가 보기</button></div>
      <p class="rnote noprint">전문가이신가요? 위의 <b>전문가 보기</b>를 누르면 마감재 선정표와 근거가 나와요.</p>
      <div id="rp"></div><footer class="noprint">링크를 열면 같은 리포트가 다시 만들어져요. 화면 색은 실물과 달라요.</footer></div>`;
    const edited = () => ({ ...r, memos: { ...r.memos, expert: memo } });
    $('#send').onclick = e => { const url = location.href; if (navigator.share) navigator.share({ title: document.title, url }).catch(() => {}); else copy(e.target, url); };
    $('#print').onclick = () => print();
    $('#csv').onclick = () => dl(`선정표-${r.name || '고객'}-${M.head.date}.csv`, 'text/csv;charset=utf-8', R.csv(M));
    $('#json').onclick = () => dl(`취향리포트-${r.name || '고객'}-${M.head.date}.json`, 'application/json', JSON.stringify(R.json(edited(), M), null, 2));
    $('#again').onclick = () => { store.del(DRAFT); pro = false; document.body.classList.remove('pro-on'); history.pushState(null, '', location.pathname); boot(); };
    $('#pro').onclick = () => { pro = !pro; draw(); };
    draw(); scrollTo(0, 0);
  }, 30);
};

// ── 키보드 1~8, 라우팅 ──
addEventListener('keydown', e => {
  if (e.target.matches('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const n = +e.key;
  if (scr && !busy && CHOICE.includes(scr.type) && n >= 1 && n <= 8 && n <= scr.opts.length && !$('.ovl')) answer(n - 1);
});
const route = () => {
  const p = new URLSearchParams(location.hash.slice(1));
  document.body.classList.remove('pro-on');
  if (p.has('r')) { const r = fromLink(p); if (r) return showResult(r); return boot('결과 링크가 올바르지 않아요. 새로 시작해 주세요.'); }
  boot();
};
addEventListener('hashchange', route);
route();
