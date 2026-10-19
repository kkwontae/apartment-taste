// 흐름 v4: 다음 화면 정하기(DOM 없음 → node로 검사). 같은 st → 같은 화면, 무작위는 E.rng(st.seed + 화면 순번)만 쓴다.
// 화면 순서 = slots(st)의 고정 목록. 다음 화면은 '마지막으로 답한 칸' 뒤에서 조건이 맞는 첫 칸 → 건너뛴 칸으로 되돌아가지 않는다.
const F = (() => {
  const SEC = Object.fromEntries(DATA.sections.map(s => [s.id, s])), ZONES = DATA.sections.filter(s => s.id !== 'shell' && s.id !== 'detail');
  const PMAX = { quick: 1, standard: 2, precise: 3 }, HOME = ['size', 'rooms', 'baths', 'people'];
  const SCORE = { anchor: 1, global: 1, dim: 1, photo: 1, confirm: 1, closer: 1, sup: 1 }; // 점수 화면(예산·순번에 셈)
  const CUT = { quick: ['CM6', 'BD3', 'DT2'], standard: ['LV3', 'SD2', 'BD4', 'DT5', 'DT3'] }; // ⑧ⓒ 되돌리기 쉬운 문항
  const room = r => r === 'guest' ? 'study' : r;
  const ord = (list, ids) => list.filter(x => [].concat(ids ?? []).includes(x.id)).map(x => x.id); // DATA 순서 = 링크 decode와 같은 모양
  const cut40 = s => [...String(s || '')].slice(0, 40).join('');
  const has = (st, z) => (st.zones || []).includes(z);
  const roomsOf = st => has(st, 'smallroom') ? ord(DATA.start.rooms, st.rooms) : [];
  const inZone = (st, z) => has(st, z) || roomsOf(st).map(room).includes(z);
  const lastPick = (st, sid) => { for (let i = st.log.length - 1; i >= 0; i--) { const e = st.log[i]; if (e.s === sid && e.k >= 0) return { i, key: e.o[e.k] }; } return null; };
  const optOf = key => { const i = key.indexOf('.'); return ((DATA.dims[key.slice(0, i)] || DATA.screens[key.slice(0, i)] || {}).opts || []).find(o => o.id === key.slice(i + 1)); };
  const mix = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // 빛 색 k = A6·C2 중 마지막 직접 선택(E.ctx는 k를 채우지 않는다)
  // 지나간 칸 중 답 없이 건너뛴 문항(ⓓ·예산·선택지 부족)은 추정 1위의 set으로 맥락을 채운다(직접 고른 값은 덮지 않음) → 뒤 조건부 견본이 기본값 대신 추정 위에 그려진다
  const ctx = (st, P, i) => {
    const c = E.ctx(st), a = lastPick(st, 'A6'), b = lastPick(st, 'C2'), p = b && (!a || b.i > a.i) ? b : a, o = p && optOf(p.key); if (o && o.render) c.k = o.render.k;
    for (const s of P ? P.slice(0, i) : []) {
      const d = s.t === 'dim' && DATA.dims[s.id.split(':')[0]];
      if (!d || !d.opts.some(x => x.set) || st.log.some(e => e.s === s.id)) continue;
      const t = (E.decide(st, s.id).opts[0] || {}).key, set = (t && optOf(t) || {}).set || {};
      for (const [k, v] of Object.entries(set)) if (c[k] === DATA.ctx[k]) c[k] = typeof v === 'string' && v[0] === '$' ? c[v.slice(1)] : v;
    }
    return c;
  };

  // ── 문항 거르기 ──
  const peff = (st, d) => (DATA.must || []).some(m => (st.must || []).includes(m.id) && (m.p1 || []).includes(d.id)) ? 1
    : d.id === 'DT2' ? ((st.matrix || {}).switch === 'replace' || st.scope === 'remodel' ? 1 : 2) : d.p; // hint: DT2는 스위치 교체·전체 리모델링일 때만 P1
  const ask = (st, d) => {
    const m = d.scope && (st.matrix || {})[d.scope], row = DATA.matrix.find(r => r.id === d.scope);
    return peff(st, d) <= PMAX[st.mode] && !(st.scope === 'rent' && d.rent === false)
      && m !== 'keep' && !(m === 'reform' && !(row && row.reform.includes(d.id)))
      && !(d.id === 'CM7' && m !== 'replace') // hint: 창호 교체일 때만
      && !(d.id === 'CM6' && st.mode === 'quick' && has(st, 'living')) // hint: 빠르게 + 거실이면 LV2가 대신
      && !(d.zones && !d.zones.some(z => inZone(st, z)))
      && !(d.room && !roomsOf(st).map(room).includes(room(d.room)));
  };
  const lifeOk = (st, q) => { const w = q.when || {}; return (!w.mode || PMAX[st.mode] >= PMAX[w.mode]) && (!w.zone || inZone(st, w.zone)) && (!w.scope || w.scope.includes(st.scope))
    && (!w.pick || w.pick.some(k => { const p = lastPick(st, k.split('.')[0]); return p && p.key === k; })); };
  const imp = q => q.opts.reduce((a, o) => { const e = o.eff || {}; return a + 3 * ((e.hide || []).length + (e.prefer || []).length) + 2 * (e.warn || []).length + (e.rows || []).length; }, 0);
  // 생활 화면 ≤ 6, 한 화면 ≤ 4: 넘치면 마지막 화면을 비우는 데 잃는 효과(hide·prefer·warn·rows)가 가장 작은 pg에서 효과 작은 표준 질문부터 뺀다(뺀 질문은 리포트 '상담 때 확인'), 1개짜리 pg는 이웃 pg에 붙인다
  const lifeGroups = st => {
    const G = Object.keys(DATA.lifeq.pg).map(pg => ({ pg, qs: DATA.life.filter(q => String(q.pg) === pg && lifeOk(st, q)) })).filter(g => g.qs.length), n = () => G.reduce((a, g) => a + Math.ceil(g.qs.length / 4), 0);
    while (n() > 6) {
      const c = G.map(g => { const r = g.qs.length - 4 * (Math.ceil(g.qs.length / 4) - 1), d = g.qs.filter(q => q.when.mode !== 'quick').sort((a, b) => imp(a) - imp(b)); return { g, r, d, w: d.slice(0, r).reduce((a, q) => a + imp(q), 0) }; })
        .filter(x => x.d.length >= x.r).sort((a, b) => a.w - b.w || a.r - b.r)[0];
      if (!c) break;
      const out = c.d.slice(0, c.r); c.g.qs = c.g.qs.filter(q => !out.includes(q));
    }
    for (let j = 0; j < G.length; j++) if (G[j].qs.length === 1 && G.length > 1) { const t = G[j + 1] || G[j - 1]; t.qs = G[j + 1] ? [...G[j].qs, ...t.qs] : [...t.qs, ...G[j].qs]; G.splice(j--, 1); }
    return G.filter(g => g.qs.length).flatMap(({ pg, qs }) => { const k = Math.ceil(qs.length / 4);
      return Array.from({ length: k }, (_, j) => ({ id: `life:${pg}.${j}`, t: 'life', sec: 'life', pg, qs: qs.slice(Math.floor(j * qs.length / k), Math.floor((j + 1) * qs.length / k)) })); });
  };

  // ── 화면 칸 목록 ──
  const slots = st => {
    const S = [{ id: 'start', t: 'start', sec: 'start' }], m = st.mode, card = sec => S.push({ id: `card:${sec}`, t: 'card', sec });
    if (!DATA.modes[m]) return S;
    if (m !== 'quick') S.push({ id: 'home', t: 'home', sec: 'start' });
    if (st.scope !== 'rent') S.push({ id: 'matrix', t: 'matrix', sec: 'matrix' });
    const an = Object.values(DATA.screens).filter(sc => sc.sec === 'anchor' && sc.modes.includes(m)); // ⑥ 같은 감각 분류 연속 금지: 앞과 같으면 뒤의 다른 분류와 바꿈
    for (let j = 1; j < an.length; j++) if (an[j].cat === an[j - 1].cat) { const k = an.findIndex((x, q) => q > j && x.cat !== an[j - 1].cat); if (k > 0) [an[j], an[k]] = [an[k], an[j]]; }
    for (const sc of an) S.push({ id: sc.id, t: 'anchor', sec: 'anchor' });
    card('anchor');
    for (let g = 0; g < DATA.modes[m].adapt[1]; g++) S.push({ id: `global:${g}`, t: 'global', sec: 'global', g });
    card('global');
    const cf = id => DATA.screens[id].modes.includes(m) && !S.some(s => s.id === id) && S.push({ id, t: 'confirm', sec: 'confirm' });
    cf('C2'); // 확인은 구간 사이: C2(A6) → 베이스 앞, C1(CM1) → 첫 공간 뒤, C3(A7) → 둘째 공간 뒤
    for (const s of ['shell', 'detail']) for (const id of SEC[s].dims) if (ask(st, DATA.dims[id])) S.push({ id, t: 'dim', sec: s });
    card('base');
    let nz = 0;
    for (const sec of ZONES) {
      if (!has(st, sec.id)) continue;
      const Z = [], dim = (id, sid = id, z, r) => ask(st, DATA.dims[id]) && Z.push({ id: sid, t: 'dim', sec: sec.id, z, r });
      const ph = (steps, key) => (steps || []).forEach((p, j) => p.modes.includes(m) && Z.push({ id: `${key}:${j}`, t: 'photo', sec: sec.id, pool: room(key), z: room(key), n: p.n, q: p.q, ...(sec.id === 'smallroom' ? { r: key } : {}) }));
      if (sec.id === 'smallroom') {
        const rs = roomsOf(st);
        for (const r of rs) {
          ph(sec.rooms[room(r)].photos, r);
          for (const id of sec.dims) { const d = DATA.dims[id]; if (d.perRoom) dim(id, `${id}:${r}`, room(r), r); else if (d.room && room(d.room) === room(r) && !(r === 'guest' && rs.includes('study'))) dim(id, id, undefined, r); }
        }
        if (!has(st, 'bedroom')) dim('BD5'); // hint: BD5는 침실·작은방 공통
      } else { ph(sec.photos, sec.id); for (const id of sec.dims) dim(id); }
      const ds = Z.filter(s => s.t === 'dim').map(s => s.id);
      if (m === 'precise' && sec.id !== 'utility') [0, 1].forEach(j => Z.push({ id: `sup:${sec.id}:${j}`, t: 'sup', sec: sec.id, j, dims: ds })); // 확신 낮은 문항 보충 최소쌍(공간당 2)
      S.push(...Z); card(sec.id);
      if (++nz === 1) cf('C1'); else if (nz === 2) cf('C3');
    }
    cf('C1'); cf('C3');
    S.push({ id: 'CL', t: 'closer', sec: 'closer' }, { id: 'ng', t: 'ng', sec: 'ng' }, { id: 'must', t: 'must', sec: 'must' }, ...lifeGroups(st));
    return S;
  };
  // ⑧ 화면 예산 ⓐⓑⓒ: 시작 답만으로 정해지는 줄이기(ⓓ와 상한 보장은 trim에서 화면마다)
  const PC = new WeakMap();
  const plan = st => {
    if (PC.has(st)) return PC.get(st);
    const S = slots(st), cap = (DATA.modes[st.mode] || {}).cap, n = () => S.filter(s => SCORE[s.t] && !s.cut).length, drop = f => S.forEach(s => { if (SCORE[s.t] && f(s)) s.cut = true; });
    if (cap && n() > cap) {
      drop(s => s.t === 'global' && s.g >= DATA.modes[st.mode].adapt[0]);
      for (const z of ['entrance', 'living', 'kitchen', 'bath', 'bedroom', 'smallroom'].filter(z => has(st, z)).slice(4)) if (n() > cap) drop(s => s.t === 'photo' && s.sec === z);
      for (const id of CUT[st.mode] || []) if (n() > cap) drop(s => s.t === 'dim' && s.id === id && !(id === 'DT2' && (st.matrix || {}).switch === 'replace'));
    }
    PC.set(st, S);
    return S;
  };
  const reps = (st, sids) => st.log.filter((e, i) => sids.includes(e.s) && st.log.findIndex(f => f.s === e.s) < i).length;
  const answered = (st, s) => SCORE[s.t] ? (s.t === 'sup' ? reps(st, s.dims) > s.j : st.log.some(e => e.s === s.id)) : (st.done || []).includes(s.id);
  const lastAt = (st, P) => { let L = -1; P.forEach((s, j) => { if (answered(st, s)) L = j; }); return L; };
  const rest = (st, P, i) => P.slice(i).filter(s => SCORE[s.t] && !s.cut && s.t !== 'closer' && !answered(st, s) && (s.t !== 'dim' || E.allowed(st, s.id).length >= 2)); // 남은 점수 칸(선택지 부족으로 못 보일 문항·조건부 마무리 비교는 뺌)
  const rank = (st, s) => s.t === 'photo' ? [2, 0] : (d => [peff(st, d), d.irr])(DATA.dims[s.id.split(':')[0]]); // 사진은 P2 문항보다 먼저
  // 예산을 넘으면: ⓓ 묻기 전 P_best ≥ 0.7인 P1 문항 건너뜀 → 그래도 넘치는 만큼은 P3→P2(사진 먼저)→P1, 같은 P면 비가역성 낮은 칸·뒤 칸부터(P1끼리는 P_best 높은 칸부터) 건너뛰어 상한을 지킨다
  const trim = (st, P, i) => {
    const cap = DATA.modes[st.mode].cap, R = rest(st, P, i), over = cap ? st.log.length + R.length - cap : 0, s = P[i];
    if (over <= 0) return false;
    if (s.t === 'dim' && peff(st, DATA.dims[s.id.split(':')[0]]) === 1 && (E.decide(st, s.id).opts[0] || {}).p >= 0.7) return true;
    const pb = x => x.t === 'dim' && rank(st, x)[0] === 1 ? (E.decide(st, x.id).opts[0] || {}).p || 0 : 0;
    return R.map((x, j) => [x, j]).filter(([x]) => x.t === 'dim' || x.t === 'photo').map(([x, j]) => [x, j, [...rank(st, x), pb(x)]]).sort((a, b) => b[2][0] - a[2][0] || b[2][2] - a[2][2] || a[2][1] - b[2][1] || b[1] - a[1]).slice(0, over).some(([x]) => x === s);
  };
  // ⑦ 조기 종료: 1위 비율 ≥ 0.85 그리고 6축 분산 합이 사전의 절반 이하
  const early = st => { const P = E.replay(st), v = p => E.axes(p).reduce((a, x) => a + x.sd * x.sd, 0); return E.styleProbs(P, st.seed)[0][1] >= 0.85 && v(P) <= 0.5 * v(E.replay({ ...st, log: [] })); };

  // ── 선택지 견본 ──
  const ph = id => ({ img: id, alt: (PHOTOS[id] || {}).alt || '' });
  const rend = (o, c, j) => { const x = E.tok(o, c), im = [].concat(x.img); return { render: { img: im[j % im.length], k: x.k, bright: x.bright ?? 1, glows: x.glows || [] } }; };
  const vis = (o, c, r, j) => o.v ? { svg: E.vis(o.v, c) } : o.render ? rend(o.render, c, j) : o.img ? ph(o.img[Math.floor(r() * o.img.length)]) : o.pal ? { pal: o.pal } : { text: true };
  const chip = (ch, c) => Array.isArray(ch) ? { svg: E.vis(ch, c) } : ch.render ? rend(ch.render, c, 0) : ph(ch.img[0]);
  const opt = (key, o, kind, v, n) => ({ key, label: kind === 'taste' ? `${n + 1}번` : o.label, cap: kind === 'taste' ? null : o.label, ...(kind === 'function' && o.desc ? { desc: o.desc } : {}), vis: v });
  const score = (st, x) => ({ type: 'choice', kind: 'taste', none: x.kind === 'function' ? '상관없어요' : x.opts.length === 2 ? '둘 다 별로예요' : '다 별로예요',
    unsure: st.log.filter(e => e.k === -2).length < 3, ...x }); // 잘 모르겠어요는 최대 3회
  const dimScr = (st, sid, os, r, c = ctx(st)) => {
    const d = DATA.dims[sid.split(':')[0]], j = Math.floor(r() * 8);
    const opts = os.map((o, n) => opt(`${d.id}.${o.id}`, o, d.kind, d.visual === 'text' ? { text: true } : vis(o, c, r, j), n));
    return score(st, { sid, q: d.q, kind: d.kind, opts, ...(d.from && opts.length <= 3 && opts.every(o => o.vis.svg) ? { big: true } : {}) });
  };
  const photoScr = (st, ids, q) => ids && score(st, { sid: '', type: 'photos', q, opts: ids.map((id, n) => ({ key: id, label: `${n + 1}번`, cap: null, vis: ph(id) })) });

  // ── 시작·조건 화면 항목 ──
  const HQ = { size: '평형은?', rooms: '방은 몇 개?', baths: '욕실은 몇 개?', people: '함께 사는 사람은?' };
  const homeF = () => [...HOME.map(h => ({ id: `home.${h}`, q: HQ[h], opts: DATA.start.home[h] })),
    { id: 'gates', q: '함께 사는 가족이 있으면 모두 골라 주세요', multi: true, opts: DATA.start.gates.map(g => ({ id: g.id, label: g.label })) }];
  const startF = () => [
    { id: 'mode', q: '어떻게 해 볼까요?', opts: Object.entries(DATA.modes).map(([id, m]) => ({ id, label: m.label })) },
    { id: 'scope', q: '어떤 공사인가요?', opts: DATA.start.scope.map(s => ({ id: s.id, label: s.label, desc: s.note, zones: s.zones })) },
    { id: 'zones', q: '어느 공간을 볼까요?', multi: true, opts: DATA.start.zones },
    { id: 'rooms', q: '작은방은 어떤 방인가요?', multi: true, if: { zones: 'smallroom' }, opts: DATA.start.rooms },
    { id: 'name', q: '이름(선택)', text: 40, desc: '이름은 결과 링크에 함께 들어가요.' },
    { id: 'cb', q: '색 구분이 어려워요', toggle: true },
    ...homeF().map(f => ({ ...f, if: { mode: 'quick' } }))]; // 빠르게는 0-a·0-b 한 화면
  const MXO = [{ id: 'replace', label: '교체' }, { id: 'reform', label: '리폼(필름·도장)' }, { id: 'keep', label: '유지' }, { id: 'unknown', label: '모름' }];
  const matrixF = st => {
    const rows = DATA.matrix.map(r => ({ id: r.id, label: r.label })), ac = DATA.start.ac, fx = DATA.start.fix, rm = st.scope === 'remodel';
    return [st.mode === 'quick' ? { id: 'change', q: '바꿀 것을 모두 골라 주세요', multi: true, opts: rows, def: st.scope === 'partial' ? [] : rows.map(r => r.id) }
      : { id: 'matrix', q: '항목마다 어떻게 할지 골라 주세요', rows, opts: MXO, def: rm ? Object.fromEntries(rows.map(r => [r.id, 'replace'])) : {} },
    ...(!ac.when || !ac.when.scope || ac.when.scope.includes(st.scope) ? [{ id: 'ac', q: ac.q, opts: ac.opts.map(o => ({ id: o.id, label: o.label })) }] : []),
    { id: 'fix', q: fx.q, multi: true, opts: fx.opts.map(o => ({ id: o.id, label: o.label })) }];
  };

  // ── 칸 → 화면 ──
  const NAME = { start: '시작', matrix: '바꿀 것', anchor: '첫인상', global: '끌리는 쪽', base: '집 전체', confirm: '한 번 더', closer: '마지막 비교', ng: '절대 싫은 것', must: '꼭 하고 싶은 것' };
  const secName = s => s.t === 'life' ? DATA.lifeq.pg[s.pg] : SEC[s.sec] ? SEC[s.sec].name + (s.r ? ` · ${(DATA.start.rooms.find(x => x.id === s.r) || {}).label}` : '') : NAME[s.sec] || '';
  const build = (st, P, i) => {
    const s = P[i], r = E.rng(st.seed + st.log.length), c = () => ctx(st, P, i);
    if (s.cut) return null;
    switch (s.t) {
      case 'start': return { sid: 'start', type: 'start', q: '우리 집 이야기부터 들려주세요', kind: 'function', opts: [], fields: startF() };
      case 'home': return { sid: 'home', type: 'start', q: '우리 집은요', kind: 'function', opts: [], fields: homeF() };
      case 'matrix': return { sid: 'matrix', type: 'matrix', q: '이번에 바꿀 것을 알려 주세요', kind: 'function', opts: [], fields: matrixF(st) };
      case 'card': { // 구간 끝 '지금까지의 나': 이 구간에서 점수 화면을 하나라도 답했을 때만
        let j = i - 1; while (j >= 0 && P[j].t !== 'card' && P[j].t !== 'matrix' && P[j].t !== 'start' && P[j].t !== 'home') j--;
        return P.slice(j + 1, i).some(x => SCORE[x.t] && answered(st, x)) ? { sid: s.id, type: 'card', q: '지금까지의 나', kind: 'taste', opts: [] } : null;
      }
      case 'anchor': {
        const sc = DATA.screens[s.id], cx = c(), j = Math.floor(r() * 8); // 렌더는 화면 안 모든 선택지가 같은 사진
        return score(st, { sid: s.id, q: sc.q, kind: sc.kind, opts: mix(sc.opts, r).map((o, n) => opt(`${s.id}.${o.id}`, o, sc.kind, vis(o, cx, r, j), n)) });
      }
      case 'global': {
        if (s.g >= DATA.modes[st.mode].adapt[0] && early(st)) return null;
        const n = s.g % 3 === 2 ? 4 : 2, x = photoScr(st, E.pickPhotos(st, 'global', n, null, r), n === 4 ? '가장 오래 머물고 싶은 곳은?' : '둘 중 더 끌리는 곳은?');
        return x && { ...x, sid: s.id };
      }
      case 'photo': { if (trim(st, P, i)) return null; const x = photoScr(st, E.pickPhotos(st, s.pool, s.n, s.z, r), s.q); return x && { ...x, sid: s.id }; }
      case 'dim': {
        if (trim(st, P, i)) return null;
        const d = DATA.dims[s.id.split(':')[0]], os = E.allowed(st, s.id);
        return os.length < 2 ? null : dimScr(st, s.id, mix(E.pickOpts(st, { ...d, p: peff(st, d) }, os, s.z), r), r, c());
      }
      case 'sup': {
        const again = new Set(st.log.filter((e, k) => st.log.findIndex(f => f.s === e.s) < k).map(e => e.s));
        const [sid, dd] = s.dims.filter(x => !again.has(x) && lastPick(st, x)).map(x => [x, E.decide(st, x)])
          .filter(([, dd]) => dd.opts.length >= 2 && dd.opts[0].p < 0.45).sort((a, b) => a[1].opts[0].p - b[1].opts[0].p)[0] || [];
        if (!sid) return null;
        const x = dimScr(st, sid, mix(dd.opts.slice(0, 2).map(o => optOf(o.key)), r), r, c());
        return { ...x, big: x.opts.every(o => o.vis.svg) || undefined };
      }
      case 'confirm': {
        const sc = DATA.screens[s.id], cx = c();
        if (s.id === 'C1') { // CM1을 큰 바닥 띠로, 좌우는 CM1과 반대
          const e = st.log.filter(e => e.s === 'CM1').pop();
          if (!e) return null;
          const os = e.o.slice().reverse().map(optOf);
          return score(st, { sid: 'C1', q: sc.q, kind: sc.kind, opts: os.map((o, n) => opt(`C1.${o.id}`, o, sc.kind, { svg: E.vis(sc.v, { ...cx, floor: (o.set || {}).floor ?? cx.floor, floorKind: (o.set || {}).floorKind ?? cx.floorKind }) }, n)) });
        }
        const e = st.log.filter(e => e.s === sc.pairs).pop(), at = o => e ? e.o.indexOf(`${sc.pairs}.${o.id}`) : -1;
        const os = sc.opts.every(o => at(o) >= 0) ? sc.opts.slice().sort((a, b) => at(b) - at(a)) : mix(sc.opts, r), j = Math.floor(r() * 8);
        return score(st, { sid: s.id, q: sc.q, kind: sc.kind, opts: os.map((o, n) => opt(`${s.id}.${o.id}`, o, sc.kind, vis(o, cx, r, j), n)) });
      }
      case 'closer': { // ⑨ 1·2위 차이 < 0.2면 이름 없는 두 보드(상한에 닿았으면 생략)
        const pr = E.styleProbs(E.replay(st), st.seed), cap = DATA.modes[st.mode].cap;
        if (pr[0][1] - pr[1][1] >= 0.2 || (cap && st.log.length >= cap)) return null;
        const ids = mix([pr[0][0], pr[1][0]], r), cx = c(), man = DATA.closers.manual.find(x => ids.includes(x.a) && ids.includes(x.b)), used = new Set(st.log.flatMap(e => e.o));
        const board = (a, b) => {
          const A = DATA.styles[a].tags, B = DATA.styles[b].tags, dt = t => (A[t] || 0) - (B[t] || 0);
          const chips = man ? (man.a === a ? man.chipsA : man.chipsB) : Object.keys(DATA.closers.chips).filter(t => !DATA.styleSkip.includes(t) && dt(t) > 0).sort((x, y) => dt(y) - dt(x)).slice(0, 3).map(t => DATA.closers.chips[t]);
          const pic = Object.keys(PHOTOS).filter(id => !PHOTOS[id].retired && !used.has(id) && (PHOTOS[id].st || []).includes(a) && !(PHOTOS[id].zones || []).every(z => z === 'anchor')).sort((x, y) => (PHOTOS[y].q || 0) - (PHOTOS[x].q || 0))[0];
          if (pic) used.add(pic); // 두 보드가 같은 사진을 쓰지 않게
          return { pal: DATA.styles[a].palette, chips: chips.map(ch => chip(ch, cx)), ...(pic ? ph(pic) : {}) };
        };
        return { ...score(st, { sid: 'CL', type: 'closer', q: '마지막이에요. 둘 중 더 우리 집 같은 쪽은?', opts: ids.map((id, n) => ({ key: `@${id}`, label: `${n + 1}번`, cap: null, vis: board(id, ids[1 - n]) })) }), none: null };
      }
      case 'ng': { const cx = c(), q = DATA.ngq; return { sid: 'ng', type: 'ng', q: q.q, kind: 'function', opts: DATA.ng.map(n => ({ key: n.id, label: n.label, cap: n.label, vis: { svg: E.vis(n.v, cx) } })), multi: true, max: q.max, memo: q.memo.max, memoQ: q.memo.label, none: q.none }; }
      case 'must': { const q = DATA.mustq; return { sid: 'must', type: 'must', q: q.q, kind: 'function', opts: DATA.must.map(m => ({ key: m.id, label: m.label, cap: m.label, vis: { text: true } })), multi: true, max: q.max, memo: q.memo.max, memoQ: q.memo.label, none: q.none || '없어요' }; }
      case 'life': return { sid: s.id, type: 'life', q: DATA.lifeq.pg[s.pg], kind: 'function', opts: [], ...(P.find(x => x.t === 'life') === s ? { desc: DATA.lifeq.intro } : {}),
        fields: s.qs.map(q => ({ id: q.id, q: q.q, ...(q.multi ? { multi: true } : {}), ...(q.max ? { max: q.max } : {}), opts: q.opts.map(o => ({ id: o.id, label: o.label })) })) };
    }
    return null;
  };
  const pos = (st, P, i) => { const cap = DATA.modes[st.mode] ? DATA.modes[st.mode].cap : 0, n = st.log.length + rest(st, P, i).length, k = st.log.length + (SCORE[P[i].t] ? 1 : 0), N = Math.max(k, cap ? Math.min(cap, n) : n); return { i: k, n: N, sec: N ? k / N : 0 }; };
  const next = st => {
    const P = plan(st);
    for (let i = lastAt(st, P) + 1; i < P.length; i++) {
      if (answered(st, P[i])) continue;
      const x = build(st, P, i);
      if (x) return { sec: P[i].sec, secName: secName(P[i]), none: null, unsure: false, ...x, pos: pos(st, P, i) };
    }
    return null;
  };

  // ── 답 → 새 st ──
  const mark = (x, ids) => ({ ...x, done: [...new Set([...(x.done || []), ...ids])] }); // 점수 없는 화면을 지났다는 표시(링크에는 안 실림, 결과에는 불필요)
  const homeSet = (st, p, ids) => {
    const home = Object.fromEntries(HOME.map(h => [h, (p.home || {})[h]]).filter(([h, v]) => (DATA.start.home[h] || []).some(o => o.id === v)));
    return mark({ ...st, home, gates: ord(DATA.start.gates, p.gates) }, ids);
  };
  const answer = (st, scr, pick, t) => {
    const p = pick || {};
    switch (scr && scr.type) {
      case 'choice': case 'photos': case 'closer': {
        const k = +pick;
        if (!Number.isInteger(k) || k < -2 || k >= scr.opts.length || (k === -2 && !scr.unsure) || (k === -1 && !scr.none)) return st;
        return E.answer(st, { s: scr.sid, o: scr.opts.map(o => o.key), k, t });
      }
      case 'card': return mark(st, [scr.sid]);
      case 'start': {
        if (scr.sid === 'home') return homeSet(st, p, ['home']);
        const sc = DATA.start.scope.find(s => s.id === p.scope);
        if (!DATA.modes[p.mode] || !sc) return st;
        const zones = ord(DATA.start.zones, p.zones ?? sc.zones), x = { ...st, mode: p.mode, scope: p.scope, zones, rooms: zones.includes('smallroom') ? ord(DATA.start.rooms, p.rooms) : [], name: cut40(p.name), cb: !!p.cb };
        return p.mode === 'quick' ? homeSet(x, p, ['start', 'home']) : mark(x, ['start']);
      }
      case 'matrix': {
        const ch = [].concat(p.change || []), mx = p.matrix || {};
        const matrix = Object.fromEntries(DATA.matrix.map(r => [r.id, st.mode === 'quick' ? (ch.includes(r.id) ? 'replace' : 'keep') // 빠르게: 고름 = 교체(리폼 여부는 상담 확인)
          : MXO.some(o => o.id === mx[r.id]) ? mx[r.id] : st.scope === 'partial' ? 'keep' : 'unknown']));
        const fix = ord(DATA.start.fix.opts, p.fix);
        for (const f of DATA.start.fix.opts) if (fix.includes(f.id)) for (const it of f.items) if (matrix[it] === 'keep') matrix[it] = 'unknown'; // 꼭 바꾸고 싶다고 한 항목은 묻는다
        return mark({ ...st, matrix, ac: DATA.start.ac.opts.some(o => o.id === p.ac) ? p.ac : '', fix }, ['matrix']);
      }
      case 'ng': return mark({ ...st, ng: ord(DATA.ng, p.ids).slice(0, DATA.ngq.max), memos: { ...st.memos, ng: cut40(p.memo) } }, ['ng']);
      case 'must': return mark({ ...st, must: ord(DATA.must, p.ids).slice(0, DATA.mustq.max), memos: { ...st.memos, must: cut40(p.memo) } }, ['must']);
      case 'life': {
        const life = { ...st.life };
        for (const f of scr.fields) {
          const q = DATA.life.find(x => x.id === f.id), v = p[f.id];
          if (!q) continue;
          if (q.multi) { const a = ord(q.opts, v).slice(0, q.max || q.opts.length); if (a.length) life[q.id] = a; else delete life[q.id]; } else if (q.opts.some(o => o.id === v)) life[q.id] = v;
        }
        return mark({ ...st, life }, [scr.sid]);
      }
    }
    return st;
  };

  // ── 예상 시간·구간 ──
  const secs = s => { const T = DATA.start.timePer, d = s.t === 'dim' && DATA.dims[s.id.split(':')[0]];
    return s.t === 'global' ? (s.g % 3 === 2 ? T.photo4 : T.photo2) : s.t === 'photo' ? (s.n >= 4 ? T.photo4 : T.photo2) : s.t === 'closer' ? T.photo4
      : s.t === 'anchor' ? (DATA.screens[s.id].opts.some(o => o.img) ? T.photo4 : T.swatch) : d && (d.kind === 'function' || d.visual === 'text') ? T.chips : SCORE[s.t] ? T.swatch : s.t === 'card' ? 1.5 : T.chips * 2; };
  const estimate = st => {
    const x = DATA.modes[st.mode] ? st : { ...st, mode: 'standard' }, P = plan(x), cap = DATA.modes[x.mode].cap, R = P.slice(lastAt(x, P) + 1).filter(s => !s.cut && !answered(x, s) && s.t !== 'start');
    const sc = R.filter(s => SCORE[s.t]).slice(0, cap ? Math.max(0, cap - x.log.length) : Infinity);
    return { screens: sc.length, seconds: Math.round([...sc, ...R.filter(s => !SCORE[s.t])].reduce((a, s) => a + secs(s), 0)) };
  };
  const sections = st => plan(st).reduce((a, s) => { const l = a[a.length - 1]; if (l && l.sec === s.sec) l.n += SCORE[s.t] && !s.cut ? 1 : 0; else a.push({ sec: s.sec, name: secName(s), n: SCORE[s.t] && !s.cut ? 1 : 0 }); return a; }, []);

  return { next, answer, estimate, sections, ctx, plan };
})();

if (typeof module !== 'undefined') module.exports = F;
