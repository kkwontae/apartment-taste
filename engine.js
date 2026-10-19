// 취향 엔진 v4 (DOM 없음 → node로 검사. 브라우저에서는 DATA, PHOTOS, IDS 다음에 로드)
// 모델: θ = [전체 취향 g 23차원 ; 고른 공간마다 핵심 차원 블록 d_z], 사후 N(m, Σ) 전체 공분산, probit ADF 갱신.
//   공간 취향 u_z = g + d_z. d_z의 사전분산 τ²가 작을수록 그 공간 답이 전체 취향 쪽으로 강하게 수축한다.
//   상태 st에서 진짜는 응답 기록(log)뿐 → 사후는 늘 같은 순서로 재생해서 만든다(같은 기록 = 같은 결과, LOO = 한 줄 빼고 재생).
const E = (() => {
  const LAT = ['temp', 'value', 'chroma', 'density', 'form', 'contrast', 'wood', 'stone', 'fabric', 'raw', 'green', 'gloss', 'seamless', 'ornate', 'pattern', 'vintage', 'silver', 'brass', 'blackline', 'ambient', 'lamp', 'daylight', 'open'];
  const PAIR = { temp: ['warm', 'cool'], value: ['bright', 'dark'], chroma: ['vivid', 'muted'], density: ['layered', 'minimal'], form: ['curve', 'linear'] };
  const G = LAT.length, I = Object.fromEntries(LAT.map((d, i) => [d, i]));
  const W21 = LAT.map(d => DATA.styleSkip.includes(d) ? 0 : 1); // green·daylight는 사진 편향 흡수용 → 스타일·지도에서 뺀다
  const lat = (tags = {}) => LAT.map(d => PAIR[d] ? ((tags[PAIR[d][0]] || 0) - (tags[PAIR[d][1]] || 0)) / 3 : (tags[d] || 0) / 3);
  const OPT = {}; // 선택지 키 `${문항}.${id}` → 선택지 (문항·앵커·확인 화면 공통)
  for (const [id, d] of Object.entries({ ...DATA.dims, ...DATA.screens })) for (const o of d.opts || []) OPT[`${id}.${o.id}`] = o;
  for (const [id, sc] of Object.entries(DATA.screens)) if (sc.pairs && !sc.opts) for (const o of (DATA.dims[sc.pairs] || DATA.screens[sc.pairs] || {}).opts || []) OPT[`${id}.${o.id}`] = { id: o.id, tags: o.tags }; // C1처럼 대상 문항 선택지를 다시 보이는 확인 화면: 태그만(확인 답이 맥락 set을 덮지 않게)
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k); // 'constructor' 같은 키가 프로토타입에서 잡히지 않게
  const MAXO = Math.max(4, ...Object.values({ ...DATA.dims, ...DATA.screens }).map(d => (d.opts || []).length)); // 한 화면 선택지 상한(사진은 2×2 = 4)
  const tagsOf = k => OPT[k] ? OPT[k].tags || {} : PHOTOS[k] ? PHOTOS[k].tags || {} : k[0] === '@' && DATA.styles[k.slice(1)] ? DATA.styles[k.slice(1)].tags : null;
  const oid = k => k.slice(k.indexOf('.') + 1);

  // ── 공간 키·블록 ──
  const ZK = ['entrance', 'living', 'kitchen', 'bath', 'bedroom', 'kids', 'study', 'dress'];
  const room = r => r === 'guest' ? 'study' : r; // 손님·취미방은 서재 규칙
  const SEC = Object.fromEntries(DATA.sections.map(s => [s.id, s]));
  const zsec = z => SEC[z] || ((SEC.smallroom || {}).rooms || {})[z] || {};
  const zoneKeys = st => ZK.filter(z => (st.zones || []).includes(z) || ((st.zones || []).includes('smallroom') && (st.rooms || []).map(room).includes(z)));
  const lifeOpts = st => (DATA.life || []).flatMap(q => { const v = [].concat((st.life || {})[q.id] ?? []); return q.opts.filter(o => v.includes(o.id)); });
  // 화면 id → 공간 키 z(null = 전역)와 β² 규칙: 문항 'CM1'·유형마다 'SR1:kids', 앵커·확인 'A1'·'C1', 사진 'living:0'·'global:2', 마무리 비교 'CL'
  const screen = s => {
    if (String(s).split(':').length > 2) return null; // 'SR1:kids:zzz' 같은 비정규 id는 거부(점수·결정이 엇갈리지 않게)
    const [a, q] = String(s).split(':'), d = DATA.dims[a], sc = DATA.screens[s];
    if (d && (q === undefined || (d.perRoom && ZK.includes(room(q))))) return { d, z: q ? room(q) : d.room ? room(d.room) : ZK.includes(d.sec) ? d.sec : null };
    if (sc) return { sc, z: null, conf: sc.sec === 'confirm', sens: sc.cat === '감각' };
    if (s === 'CL') return { z: null, closer: true };
    if (/^\d+$/.test(q) && (a === 'global' || ZK.includes(room(a)))) return { z: a === 'global' ? null : room(a), photo: true };
    return null;
  };

  // ── 정규분포 ── erfc(x)·e^{x²} (Numerical Recipes erfcc, 상대오차 < 1.2e-7) → 꼬리에서도 Φ·λ가 0/0으로 무너지지 않게
  const erfcx = x => { const t = 1 / (1 + x / 2); return t * Math.exp(-1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); };
  const cdf = z => z < 0 ? erfcx(-z / Math.SQRT2) * Math.exp(-z * z / 2) / 2 : 1 - erfcx(z / Math.SQRT2) * Math.exp(-z * z / 2) / 2;
  const mills = z => z < 0 ? Math.sqrt(2 / Math.PI) / erfcx(-z / Math.SQRT2) : Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) / cdf(z); // λ = φ/Φ

  // ── 사후분포 ──
  const prior = st => {
    const tau = Object.fromEntries(ZK.map(z => [z, zsec(z).tau2]));
    for (const o of lifeOpts(st)) Object.assign(tau, (o.eff || {}).tau2); // 생활 답이 τ²를 바꿈(예: 거실에서 주방이 안 보이면 .5)
    const blocks = {}; let D = G;
    for (const z of zoneKeys(st)) { const idx = (zsec(z).block || []).map(d => I[d]); blocks[z] = { off: D, idx }; D += idx.length; }
    const m = new Float64Array(D), S = new Float64Array(D * D);
    for (let i = 0; i < G; i++) S[i * D + i] = W21[i] ? 1 : 0.6;
    for (const z in blocks) blocks[z].idx.forEach((_, j) => { const i = blocks[z].off + j; S[i * D + i] = tau[z]; });
    return { D, m, S, blocks };
  };
  const ft = (st, tags) => { const f = lat(tags); if (st.cb) { f[I.temp] /= 2; f[I.chroma] /= 2; } return f; }; // 색 구분이 어려우면 온도·채도 신호를 반만 믿는다
  const X = (P, f, z) => { const x = new Float64Array(P.D); for (let i = 0; i < G; i++) x[i] = f[i]; const b = P.blocks[z]; if (b) b.idx.forEach((d, j) => { x[b.off + j] = f[d]; }); return x; }; // [x; P_z x]
  const quad = (P, x) => { const nz = []; for (let i = 0; i < P.D; i++) if (x[i]) nz.push(i); let s = 0; for (const i of nz) for (const j of nz) s += x[i] * P.S[i * P.D + j] * x[j]; return s; };
  const dotm = (P, x) => { let s = 0; for (let i = 0; i < P.D; i++) s += P.m[i] * x[i]; return s; };
  // probit ADF: s² = β² + xᵀΣx, z = m·x/s, λ = φ/Φ, η = λ(λ+z), m += Σx·λ/s, Σ −= (Σx)(Σx)ᵀ·η/s², 매번 대칭화
  const adf = (P, x, b2) => {
    const { D, m, S } = P, nz = [];
    for (let i = 0; i < D; i++) if (x[i]) nz.push(i);
    if (!nz.length) return;
    const Sx = new Float64Array(D);
    for (let i = 0; i < D; i++) { let s = 0; for (const j of nz) s += S[i * D + j] * x[j]; Sx[i] = s; }
    let q = 0, mu = 0;
    for (const j of nz) { q += x[j] * Sx[j]; mu += m[j] * x[j]; }
    const s2 = b2 + q, s = Math.sqrt(s2), z = mu / s, l = mills(z), c = Math.min(l * (l + z), 1 - 1e-9) / s2;
    for (let i = 0; i < D; i++) m[i] += Sx[i] * l / s;
    for (let i = 0; i < D; i++) for (let j = i; j < D; j++) S[i * D + j] = S[j * D + i] = (S[i * D + j] + S[j * D + i]) / 2 - Sx[i] * Sx[j] * c;
  };
  // 한 응답 → [X 차이, β²] 목록. 2장 1.0 · 3장 이상 쌍 분해 2.0 · 마무리 2.0, 감각 ×1.5 · 반복 확인 ×2, 다 별로 1.0(특징 ×0.5)
  // shortcut: 3장 이상은 '고른 것 vs 나머지 각각' 쌍 분해 근사, 파일럿에서 과신이 보이면 다항 로짓 갱신으로 교체
  const comps = (st, P, e) => {
    const sc = screen(e.s);
    if (!sc || e.k === -2 || e.k >= e.o.length) return []; // 잘 모르겠어요: 갱신 없음
    const xs = e.o.map(k => X(P, ft(st, tagsOf(k) || {}), sc.z));
    const mul = (sc.sens || e.o.some(k => PHOTOS[k] && (PHOTOS[k].zones || []).includes('anchor')) ? 1.5 : 1) * (sc.conf ? 2 : 1);
    if (e.k === -1) return xs.map(x => [x.map(v => -v / 2), mul]); // 다 별로: 보인 것 각각이 빈 선택지에 진다
    const b2 = (sc.closer || xs.length > 2 ? 2 : 1) * mul;
    return xs.flatMap((x, j) => j === e.k ? [] : [[xs[e.k].map((v, i) => v - x[i]), b2]]);
  };
  const run = (st, hook) => {
    const P = prior(st);
    st.log.forEach((e, i) => { const cs = comps(st, P, e); if (hook) hook(P, e, i); for (const [x, b2] of cs) adf(P, x, b2); });
    for (const n of DATA.ng || []) if ((st.ng || []).includes(n.id) && n.tags) adf(P, X(P, ft(st, n.tags).map(v => -v), null), 0.67); // 고른 NG는 빈 선택지에 진다(DATA 순서 = 링크 왕복에도 같은 결과)
    return P;
  };
  const RC = new WeakMap(); // st는 불변 → 같은 객체면 재생 결과도 같다
  const replay = st => { if (!RC.has(st)) RC.set(st, run(st)); return RC.get(st); };
  const loo = (st, i) => run({ ...st, log: st.log.filter((_, j) => j !== i) });
  const fresh = (o = {}) => ({ v: 4, dv: DATA.v, seed: (o.seed ?? Math.random() * 2 ** 32) >>> 0, mode: o.mode || '', scope: o.scope || '', zones: o.zones || [], rooms: o.rooms || [], home: o.home || {},
    gates: o.gates || [], matrix: o.matrix || {}, cb: !!o.cb, at: o.at || 0, name: o.name || '', by: o.by || '', log: [], ng: [], must: [], life: {}, memos: {} });
  // 기록 한 줄 검사(answer·링크 decode 공통) → answer로 만든 세션은 재생이 깨지지 않고 링크로 언제나 돌아온다
  const okEntry = e => {
    const sc = typeof e.s === 'string' && screen(e.s), o = e.o;
    return !!sc && Array.isArray(o) && o.length >= 2 && o.length <= MAXO && new Set(o).size === o.length && Number.isInteger(e.k) && e.k >= -2 && e.k < o.length
      && o.every(x => typeof x === 'string' && (sc.photo ? own(PHOTOS, x) : sc.closer ? x[0] === '@' && own(DATA.styles, x.slice(1)) : x.startsWith(`${e.s.split(':')[0]}.`) && own(OPT, x)));
  };
  const answer = (st, e) => okEntry(e) ? { ...st, log: st.log.concat([{ s: e.s, o: [...e.o], k: e.k, t: Math.max(0, Math.round(+e.t || 0)) }]) } : st; // 틀린 기록이면 같은 st(앱은 next !== st로 확인)

  // ── 표본 ──
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return h >>> 0; };
  const rng = seed => { let a = (typeof seed === 'string' ? fnv(seed) : seed) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }; // mulberry32
  const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const LC = new WeakMap();
  const chol = P => {
    if (LC.has(P)) return LC.get(P);
    const { D, S } = P; let L = new Float64Array(D * D);
    for (let i = 0; i < D && L; i++) for (let j = 0; j <= i; j++) {
      let s = S[i * D + j] + (i === j ? 1e-9 : 0);
      for (let k = 0; k < j; k++) s -= L[i * D + k] * L[j * D + k];
      if (i > j) L[i * D + j] = s / L[j * D + j]; else if (s > 0) L[i * D + i] = Math.sqrt(s); else { L = null; break; }
    }
    LC.set(P, L); return L;
  };
  const sample = (post, n, seed) => {
    const { D, m, S } = post, L = chol(post), r = rng(seed);
    return Array.from({ length: n }, () => {
      const z = Array.from({ length: D }, () => gauss(r)), th = Float64Array.from(m);
      for (let i = 0; i < D; i++) if (L) { let s = 0; for (let k = 0; k <= i; k++) s += L[i * D + k] * z[k]; th[i] += s; } else th[i] += Math.sqrt(Math.max(S[i * D + i], 0)) * z[i]; // 콜레스키 실패 → 대각
      return th;
    });
  };
  const util = (P, th, z) => { const u = th.slice(0, G), b = P.blocks[z]; if (b) b.idx.forEach((d, j) => { u[d] += th[b.off + j]; }); return u; }; // u_z = g + d_z
  const sub = (P, z) => { // [g; d_z]만의 주변분포(가우시안이라 정확) → 79차원 대신 최대 31차원 표본
    const b = P.blocks[z], ix = [...Array(G).keys(), ...(b ? b.idx.map((_, j) => b.off + j) : [])];
    return { D: ix.length, m: Float64Array.from(ix, i => P.m[i]), S: Float64Array.from(ix.flatMap(i => ix.map(j => P.S[i * P.D + j]))), blocks: b ? { [z]: { off: G, idx: b.idx } } : {} };
  };

  // ── 스타일·지도·축 ──
  const SV = Object.entries(DATA.styles).map(([id, s]) => { const v = lat(s.tags).map((x, i) => x * W21[i]), n = Math.hypot(...v) || 1; return [id, v.map(x => x / n)]; });
  const cos = (u, v) => { let a = 0, b = 0; for (let i = 0; i < G; i++) if (W21[i]) { a += u[i] * v[i]; b += u[i] * u[i]; } return b ? a / Math.sqrt(b) : 0; }; // v는 단위 길이
  const styleProbs = (post, seed, z) => {
    const c = SV.map(() => 0), P = sub(post, z);
    for (const th of sample(P, 300, seed)) { const u = util(P, th, z), cs = SV.map(([, v]) => cos(u, v)); c[cs.indexOf(Math.max(...cs))]++; }
    return SV.map(([id], i) => [id, c[i] / 300]).sort((a, b) => b[1] - a[1]);
  };
  const blend = probs => { const t = probs.slice(0, 3), s = t.reduce((a, [, p]) => a + p, 0) || 1; return t.map(([id, p]) => [id, p / s]); };
  // 지도 좌표(scoring ⑦): 단위 스타일 벡터를 두 축 공식으로 투영 → 8~92로 늘림 → 6단위 미만 쌍은 서로 밀어 6.1 확보
  const styleAt = (() => {
    const ax = (v, w) => Object.entries(w).reduce((a, [d, k]) => a + k * v[I[d]], 0);
    const raw = SV.map(([, v]) => [ax(v, { temp: -1, silver: 1, blackline: 1, gloss: 1, contrast: 1, wood: -1, brass: -1, fabric: -1, raw: -1 }), ax(v, { ornate: 1, vintage: 1, pattern: 1, form: 1, density: 1, seamless: -1 })]);
    const P = raw.map(() => [0, 0]), cl = v => Math.min(92, Math.max(8, v));
    for (const k of [0, 1]) { const a = raw.map(p => p[k]), lo = Math.min(...a), hi = Math.max(...a); P.forEach((p, i) => { p[k] = 8 + 84 * (raw[i][k] - lo) / (hi - lo || 1); }); }
    for (let it = 0, moved = true; moved && it < 500; it++) {
      moved = false;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], d = Math.hypot(dx, dy), k = (6.1 - d) / 2 / (d || 1);
        if (d < 6.1) { P[i][0] = cl(P[i][0] - (d ? dx : 1) * k); P[i][1] = cl(P[i][1] - dy * k); P[j][0] = cl(P[j][0] + (d ? dx : 1) * k); P[j][1] = cl(P[j][1] + dy * k); moved = true; }
      }
    }
    return Object.fromEntries(SV.map(([id], i) => [id, P[i].map(v => Math.round(v * 10) / 10)]));
  })();
  const mapPos = mg => { const w = SV.map(([id, v]) => [styleAt[id], Math.exp(8 * cos(mg, v))]), s = w.reduce((a, [, x]) => a + x, 0); return [0, 1].map(k => w.reduce((a, [p, x]) => a + p[k] * x, 0) / s); };
  const cloud = (post, seed) => sample(sub(post), 20, seed).map(mapPos); // 세션 시드 고정 → 점구름이 화면마다 새로 튀지 않고 사후를 따라 움직인다
  const AX = [['temp', '온도', { temp: 1 }], ['value', '명도', { value: 1 }], ['color', '색·대비', { chroma: 1, contrast: 0.5 }],
    ['texture', '질감', { raw: 1, wood: 0.5, fabric: 0.5, gloss: -1, seamless: -0.5 }], ['detail', '디테일', { ornate: 1, vintage: 1, pattern: 0.5, form: 0.5, seamless: -1 }], ['density', '밀도', { density: 1 }]];
  const axes = post => AX.map(([id, name, w]) => {
    const a = Object.entries(w).map(([d, k]) => [I[d], k]);
    return { id, name, m: a.reduce((s, [i, k]) => s + k * post.m[i], 0), sd: Math.sqrt(Math.max(0, a.reduce((s, [i, k]) => s + a.reduce((t, [j, l]) => t + k * l * post.S[i * post.D + j], 0), 0))) };
  });

  // ── 선택지 고르기(adaptive_rules ②③④) ──
  const VT = { bright: I.value, dark: I.value, daylight: I.daylight, layered: I.density }; // 재는 대상이 아니면 섞이면 안 되는 태그
  // 고정 화면 슬롯 사진(img·render.img 후보 전부)도 예약: 앵커 기록에는 선택지 키만 남아 '사용한 사진'으로 안 잡힌다(사진 재사용 금지)
  const RES = new Set([...(DATA.adaptive.reserved || []), ...Object.values({ ...DATA.dims, ...DATA.screens }).flatMap(d => (d.opts || []).flatMap(o => [...(o.img || []), ...((o.render || {}).img || [])]))]);
  const pickPhotos = (st, pool, n, z, rng) => {
    const pools = pool === 'global' ? DATA.adaptive.pools.global : [pool], used = new Set(st.log.flatMap(e => e.o));
    const ids = Object.keys(PHOTOS).filter(id => !PHOTOS[id].retired && !RES.has(id) && !used.has(id) && (PHOTOS[id].zones || []).some(x => pools.includes(x)));
    if (ids.length < 2) return null;
    const P = replay(st), b = P.blocks[z], F = Object.fromEntries(ids.map(id => [id, ft(st, PHOTOS[id].tags || {})])), Ph = id => PHOTOS[id];
    const tm = new Float64Array(P.D); // Σ_T: 공간 단계는 그 공간 핵심 차원(블록 포함)만, 전역은 전부
    if (b) b.idx.forEach((d, j) => { tm[d] = 1; tm[b.off + j] = 1; }); else tm.fill(1, 0, G);
    const ok = (a, c) => !(Math.abs(Ph(a).q - Ph(c).q) > 1) && !(Math.abs(Ph(a).lum - Ph(c).lum) > 12 && Math.abs(F[a][I.value] - F[c][I.value]) * 3 < 2) // 명도 비교 쌍만 L* 차이 허용
      && !(Math.abs(Ph(a).space - Ph(c).space) > 1) && !(Ph(a).set && Ph(a).set === Ph(c).set);
    const pinfo = x => { const q = quad(P, x), p = cdf(dotm(P, x) / Math.sqrt(1 + q)); return [4 * p * (1 - p), q]; };
    const info = (a, c) => {
      const x = X(P, F[a].map((v, i) => v - F[c][i]), z), [pq, q] = pinfo(x), ta = Ph(a).tags || {}, tc = Ph(c).tags || {};
      const mix = Object.keys(VT).some(t => !tm[VT[t]] && Math.abs((ta[t] || 0) - (tc[t] || 0)) >= 2);
      return pq * (b ? 1.5 * quad(P, x.map((v, i) => v * tm[i])) : q) + 0.03 * ((Ph(a).q || 3) + (Ph(c).q || 3)) - (mix ? 0.5 : 0);
    };
    const pairs = []; // shortcut: 후보 N장의 모든 쌍(N²/2)을 점수화 — 전역 약 95장에 9ms, 풀이 300장을 넘으면 정보 상위 후보만 남겨 쌍을 줄일 것
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (ok(ids[i], ids[j])) pairs.push([ids[i], ids[j], info(ids[i], ids[j])]);
    if (!pairs.length) return null;
    pairs.sort((u, v) => v[2] - u[2]);
    // 4장 = 2×2 요인: 정보 큰 두 차원 a·c의 (±,±) 칸마다, 나머지 핵심 차원이 서로 가장 가까운 사진. 네 칸을 다 채우는 쌍을 정보 순으로 10개까지 시도, 없으면 2장
    const T = b ? b.idx : LAT.map((_, i) => i).filter(i => W21[i]);
    const build = (a, c) => {
      const rest = T.filter(d => d !== a && d !== c), cells = [0, 1, 2, 3].map(k => ids.filter(id => (F[id][a] > 0 ? 2 : 0) + (F[id][c] > 0 ? 1 : 0) === k));
      const dist = (u, v) => Math.hypot(...rest.map(d => F[u][d] - F[v][d]));
      let best = null, bc = Infinity;
      for (const s0 of cells[0]) {
        const pick = [s0]; let cost = 0;
        for (const cl of cells.slice(1)) {
          let bb = null, bd = Infinity;
          for (const id of cl) if (pick.every(p => ok(p, id))) { const dd = pick.reduce((s, p) => s + dist(p, id), 0); if (dd < bd) { bd = dd; bb = id; } }
          if (!bb) { cost = Infinity; break; }
          pick.push(bb); cost += bd;
        }
        if (cost < bc) { bc = cost; best = pick; }
      }
      return best;
    };
    const grid = () => {
      const inf = T.map(d => { const e = new Float64Array(G); e[d] = 1; const [pq, q] = pinfo(X(P, e, z)); return [d, pq * q]; }), prs = [];
      for (let i = 0; i < inf.length; i++) for (let j = i + 1; j < inf.length; j++) prs.push([inf[i][0], inf[j][0], inf[i][1] + inf[j][1]]);
      const full = prs.sort((u, v) => v[2] - u[2]).filter(([a, c]) => [0, 1, 2, 3].every(k => ids.some(id => (F[id][a] > 0 ? 2 : 0) + (F[id][c] > 0 ? 1 : 0) === k)));
      for (const [a, c] of full.slice(0, 10)) { const g = build(a, c); if (g) return g; }
      return null;
    };
    const out = (n >= 4 && grid()) || pairs[Math.floor(rng() * Math.min(3, pairs.length))].slice(0, 2); // 상위 3쌍 중 세션 시드로
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } // 좌우·순서 무작위
    return out;
  };
  // P_best: 표본 200개에서 각 선택지가 1위인 비율(동점은 나눔)
  const pbest = (post, fs, z, seed) => {
    const c = fs.map(() => 0), P = sub(post, z);
    for (const th of sample(P, 200, seed)) {
      const u = util(P, th, z), U = fs.map(f => f.reduce((a, v, i) => a + v * u[i], 0)), mx = Math.max(...U), w = U.filter(x => x >= mx - 1e-12).length;
      U.forEach((x, j) => { if (x >= mx - 1e-12) c[j] += 1 / w; });
    }
    return c.map(x => x / 200);
  };
  const pickOpts = (st, dim, opts, z) => {
    const d = typeof dim === 'string' ? DATA.dims[dim] : dim;
    const p1 = d.p === 1 || (DATA.must || []).some(m => (st.must || []).includes(m.id) && (m.p1 || []).includes(d.id)); // 필수 요구가 P1로 올린 문항도 전부
    if (p1 || opts.length < 5) return opts;
    if (z === undefined) z = (screen(d.id) || {}).z;
    const P = replay(st), fs = opts.map(o => lat(o.tags)), pb = pbest(P, fs, z, st.seed), ord = opts.map((_, j) => j).sort((a, b) => pb[b] - pb[a]);
    const inf = j => { const x = X(P, fs[j].map((v, i) => v - fs[ord[0]][i]), z), q = quad(P, x), p = cdf(dotm(P, x) / Math.sqrt(1 + q)); return 4 * p * (1 - p) * q; };
    const keep = [...ord.slice(0, 2), ...ord.slice(2).sort((a, b) => inf(b) - inf(a)).slice(0, 2)]; // P_best 상위 2 + 정보 큰 2
    return opts.filter((_, j) => keep.includes(j));
  };

  // ── 맥락·결정·확신 ──
  const WC = { pure: '#F6F6F4', soft: '#F1EFEA', warm: '#EEE7DC', greige: '#E2DCD2', lightgray: '#E6E7E6' }; // WC-00 벽 바탕색(데이터 report.wallColors가 있으면 그 hex)
  const wallId = st => { // 온도·명도·채도 평균 → 바탕색, 북향이거나 '차갑게 하얀 집' NG면 한 칸 따뜻·밝게
    const m = replay(st).m, t = m[I.temp], W = (DATA.report || {}).wallColors || {};
    let w = t <= -0.3 ? (m[I.value] < 0 ? 'lightgray' : 'pure') : t < 0.3 ? 'soft' : m[I.chroma] <= -0.3 ? 'greige' : 'warm';
    if ((st.life || {}).sun === 'north' && W.north) w = W.north.step[w] || w;
    for (const [n, step] of Object.entries(W.ng || {})) if ((st.ng || []).includes(n)) w = step[w] || w;
    return w;
  };
  const ctx = st => {
    const c = { ...DATA.ctx };
    for (const e of st.log) { const o = e.k >= 0 && OPT[e.o[e.k]]; if (o && o.set) Object.assign(c, o.set); }
    const w = wallId(st); c.wallId = w; c.wall = ((((DATA.report || {}).wallColors || {}).opts || {})[w] || {}).hex || WC[w];
    for (const k in c) if (typeof c[k] === 'string' && c[k][0] === '$') c[k] = c[c[k].slice(1)]; // set 값이 토큰이면 한 번 풂(EN1 흰·우드 틀 → 그때의 벽색·우드)
    return c;
  };
  const last = (st, sid) => { for (let i = st.log.length - 1; i >= 0; i--) { const e = st.log[i]; if (e.s === sid && e.k >= 0) return { i, key: e.o[e.k] }; } return null; }; // 마지막 직접 선택: 다시 물어 패스·다 별로여도 앞 선택이 남는다
  const allowed = (st, sid) => {
    const [id] = sid.split(':'), d = DATA.dims[id];
    if (!d) return [];
    const off = new Set([...DATA.start.gates.filter(g => (st.gates || []).includes(g.id)).flatMap(g => g.hide || []),
      ...(DATA.ng || []).filter(n => (st.ng || []).includes(n.id)).flatMap(n => n.exclude || []), ...lifeOpts(st).flatMap(o => (o.eff || {}).hide || [])]);
    const mine = (last(st, sid) || {}).key, c = ctx(st); // 직접 고른 것은 NG·생활에 걸려도 남긴다(리포트 '충돌 확인')
    return d.opts.filter(o => (`${id}.${o.id}` === mine || !off.has(`${id}.${o.id}`)) && Object.entries(o.if || {}).every(([t, v]) => Array.isArray(v) ? v.includes(c[t]) : c[t] === v));
  };
  const decide = (st, sid, z) => {
    const [id] = sid.split(':'), opts = allowed(st, sid), seen = new Set(st.log.filter(e => e.s === sid).flatMap(e => e.o)), pk = last(st, sid);
    if (z === undefined) z = (screen(sid) || {}).z;
    const p = pbest(replay(st), opts.map(o => lat(o.tags)), z, code(st));
    const rows = opts.map((o, j) => ({ key: `${id}.${o.id}`, id: o.id, p: p[j], seen: seen.has(`${id}.${o.id}`) })).sort((a, b) => b.p - a.p);
    return { sid, z, opts: rows, best: (rows.find(r => r.seen) || {}).key || null, picked: pk ? pk.key : null }; // 추천안은 본 선택지 중 1위
  };
  // 일관성 확인 → [대상 화면, 일치?, 반복 확인?]: 반복 확인 화면(pairs)과 화면 없는 짝(consistency ②)
  const CROSS = [['A5', 'CM1', f => f[I.wood] - f[I.stone]], ['A7', 'CM5', f => f[I.form]], ['A7', 'BA6', f => f[I.form]], ['A3', 'SR1', f => f[I.density]],
    ['A8', 'SR1', f => f[I.density]], ['A3', 'KT6', f => f[I.density]], ['A8', 'KT6', f => f[I.density]], ['DT1', 'EN1', f => f[I.blackline] - f[I.brass]]];
  const checks = st => {
    const pk = s => { for (let i = st.log.length - 1; i >= 0; i--) { const e = st.log[i]; if ((e.s === s || e.s.startsWith(`${s}:`)) && e.k >= 0) return { e, key: e.o[e.k] }; } return null; };
    const F = k => lat(tagsOf(k) || {}), dist = (u, v) => Math.hypot(...u.map((x, i) => x - v[i])), out = [];
    for (const [id, sc] of Object.entries(DATA.screens)) {
      const a = sc.pairs && pk(id), b = a && pk(sc.pairs);
      if (b) out.push([sc.pairs, oid(a.key) === oid(b.key) || (a.e.o.length === 2 && dist(F(b.key), F(a.key)) < dist(F(b.key), F(a.e.o[1 - a.e.k]))), true]); // 같은 id, 아니면 원래 답이 확인에서 이긴 쪽에 더 가까운지
    }
    for (const [x, y, fn] of CROSS) { const a = pk(x), b = pk(y), va = a && fn(F(a.key)), vb = b && fn(F(b.key)); if (va && vb) out.push([y, va * vb > 0, false]); }
    return out;
  };
  const conf = (st, sid) => {
    const d = decide(st, sid), pk = last(st, sid), top = d.opts[0];
    if (!pk) return { ...d, level: top && top.p >= 0.6 ? 'mid' : 'low' }; // 묻지 않음(다 별로·패스 포함): 최대 '보통'
    const keys = d.opts.map(r => r.key), lp = pbest(run({ ...st, log: st.log.filter(e => e.s !== sid) }), keys.map(k => lat(OPT[k].tags)), d.z, code(st)); // LOO = 그 화면을 모두 빼고 재생(다시 물은 답이 남아 스스로를 예측하지 않게)
    const pl = lp[keys.indexOf(pk.key)] ?? 0, rank = pl ? 1 + lp.filter(x => x > pl).length : 0, flip = checks(st).some(c => c[2] && !c[1] && c[0] === sid);
    return { ...d, level: rank === 1 && pl >= 0.4 && !flip ? 'high' : rank && (rank <= 2 || pl >= 0.2) ? 'mid' : 'low', lp: pl, rank, flip };
  };
  // 예측 적중(prequential): 7번째 점수 화면부터 갱신 전 1위 예측 vs 실제, lift = 평균[(적중 − 1/k)/(1 − 1/k)]
  const lift = st => {
    let n = 0, sum = 0, seen = 0;
    run(st, (P, e) => {
      const sc = screen(e.s);
      if (!sc || e.k < 0) return;
      const fs = e.o.map(k => ft(st, tagsOf(k) || {}));
      if (fs.every(f => f.every((v, i) => v === fs[0][i])) || ++seen < 7) return; // 특징이 모두 같은 화면은 예측할 것이 없다
      const U = fs.map(f => dotm(P, X(P, f, sc.z)));
      sum += ((U.indexOf(Math.max(...U)) === e.k) - 1 / U.length) / (1 - 1 / U.length); n++;
    });
    return n ? sum / n : null;
  };
  const flags = st => {
    const L = st.log, two = L.filter(e => e.o.length === 2 && e.k >= 0), left = two.filter(e => e.k === 0).length;
    let streak = 0, fast = false;
    L.forEach((e, i) => { streak = i >= 2 && ds(e.t) < 7 ? streak + 1 : 0; if (streak >= 5) fast = true; }); // 첫 2화면은 익히는 중이라 뺀다(링크와 같게 0.1초 단위로 비교)
    const side = two.length >= 10 && Math.max(left, two.length - left) >= 0.8 * two.length, skip = L.filter(e => e.k < 0).length > 0.25 * L.length;
    const cs = checks(st), mismatch = cs.filter(c => !c[1]).length, lf = lift(st), n = side + fast + skip;
    const grade = lf === null || lf < 0.1 || n >= 2 ? 'weak' : lf >= 0.25 && mismatch <= 1 ? 'high' : cs.length >= 3 && mismatch >= 2 ? 'mixed' : 'normal';
    return { side, fast, skip, n, checks: cs.length, mismatch, lift: lf, grade };
  };

  // ── 결과 코드·링크 ── 링크 = '4~dv~머리~기록~NG~필수~생활~메모~결과.검사합' (칸 구분 ~, 칸 안 구분 ., 모두 URL 안전 문자, 끝은 검사합 16진수)
  const has = (list, ids) => list.filter(x => [].concat(ids ?? []).includes(x.id)).map(x => x.id);
  const ds = t => Math.min(1295, Math.max(0, Math.round((t || 0) / 100))); // 응답 시간은 0.1초 단위로 저장
  const h8 = n => n.toString(16).padStart(8, '0');
  const code = st => h8(fnv(JSON.stringify([st.seed >>> 0, zoneKeys(st), has(DATA.start.gates, st.gates), !!st.cb, st.log.map(e => [e.s, e.o, e.k, ds(e.t)]), has(DATA.ng || [], st.ng),
    has(DATA.must || [], st.must), (DATA.life || []).map(q => has(q.opts, (st.life || {})[q.id]))]))); // 응답 기록 FNV-1a 8자 = 결과 표본 시드 겸 기록·결과 짝 검사(이름·메모는 빼서 결과가 안 바뀜)
  const b36 = n => n.toString(36), p2 = n => b36(n).padStart(2, '0');
  const IDC = Object.fromEntries(Object.entries(typeof IDS === 'undefined' ? {} : IDS).filter(([, c]) => /^[0-9A-Za-z_-]{2}$/.test(c)));
  const RID = Object.fromEntries(Object.entries(IDC).map(([k, c]) => [c, k]));
  const e64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const d64 = s => { if (!/^[A-Za-z0-9_-]*$/.test(s)) throw 0; return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); };
  const tok = k => IDC[k] || `!${e64(k)}!`; // 등록부에 없는 키는 글자 그대로(base64url) → 잃지 않는다
  const num = s => { if (!/^[0-9a-z]{1,10}$/.test(s)) throw 0; return parseInt(s, 36); };
  const bits = (list, ids) => list.reduce((a, x, i) => a + ([].concat(ids ?? []).includes(x.id) ? 2 ** i : 0), 0);
  const unbits = (list, s) => { const n = num(s); if (n >= 2 ** list.length) throw 0; return list.filter((_, i) => Math.floor(n / 2 ** i) % 2).map(x => x.id); };
  const ix = (list, v) => b36(1 + list.indexOf(v)), at1 = (list, c) => { const i = num(c) - 1; if (c.length !== 1 || i >= list.length) throw 0; return i < 0 ? '' : list[i]; }; // 0 = 비어 있음
  const cut = s => [...String(s || '')].slice(0, 40).join('');
  const MX = ['replace', 'reform', 'keep', 'unknown'], HOME = ['size', 'rooms', 'baths', 'people'], SIDS = Object.keys(DATA.styles), MODES = Object.keys(DATA.modes);
  const head = st => [b36(st.seed >>> 0), ix(MODES, st.mode), ix(DATA.start.scope.map(s => s.id), st.scope), b36(bits(DATA.start.zones, st.zones)), b36(bits(DATA.start.rooms, st.rooms)),
    HOME.map(h => ix((DATA.start.home[h] || []).map(o => o.id), (st.home || {})[h])).join(''), b36(bits(DATA.start.gates, st.gates)),
    DATA.matrix.map(r => ix(MX, (st.matrix || {})[r.id])).join(''), st.cb ? '1' : '0', b36(Math.floor((st.at || 0) / 6e4))].join('.');
  const ent = e => b36(Math.max(0, Math.min(35, e.k + 2))) + p2(ds(e.t)) + tok(e.s) + e.o.map(tok).join(''); // 선택 1자 + 0.1초 2자 + 키들
  const TK = /!([A-Za-z0-9_-]*)!|([0-9A-Za-z_-]{2})/y;
  const unent = s => {
    if (!/^[0-9a-z]{3}/.test(s)) throw 0;
    const k = num(s[0]) - 2, t = num(s.slice(1, 3)) * 100, keys = [];
    for (TK.lastIndex = 3; TK.lastIndex < s.length;) { const m = TK.exec(s); if (!m) throw 0; const key = m[1] !== undefined ? d64(m[1]) : RID[m[2]]; if (!key) throw 0; keys.push(key); }
    const [sid, ...o] = keys, e = { s: sid, o, k, t };
    if (!okEntry(e)) throw 0;
    return e;
  };
  const encode = st => {
    const P = replay(st), c = code(st);
    const res = [styleProbs(P, c).slice(0, 3).map(([id, p]) => b36(SIDS.indexOf(id)) + p2(Math.round(p * 1000))).join(''), axes(P).map(a => p2(Math.max(0, Math.min(1295, Math.round(a.m * 100) + 648)))).join(''), c].join('.');
    const body = ['4', DATA.v, head(st), st.log.map(ent).join('.'), b36(bits(DATA.ng || [], st.ng)), b36(bits(DATA.must || [], st.must)),
      (DATA.life || []).map(q => { const n = bits(q.opts, (st.life || {})[q.id]); return n ? b36(n) : ''; }).join('.').replace(/\.+$/, ''),
      [st.name, st.by, (st.memos || {}).ng, (st.memos || {}).must].map(s => e64(cut(s))).join('.'), res].join('~');
    return `${body}.${h8(fnv(body))}`; // 링크 전체 검사합: 결과 코드가 안 덮는 머리·메모·결과 고정본의 깨짐까지 잡는다
  };
  // 링크는 신뢰 경계: 검사합·형식·범위·키·결과 코드까지 맞아야 하고, 하나라도 어긋나면 null(던지지 않음). 검사합은 깨짐 검출일 뿐 서명이 아니라 아래 검사는 그대로 둔다
  const decode = str => {
    try {
      if (typeof str !== 'string' || str.length > 30000) return null;
      const c8 = str.lastIndexOf('.');
      if (c8 < 0 || str.slice(c8 + 1) !== h8(fnv(str.slice(0, c8)))) return null;
      const f = str.slice(0, c8).split('~'), h = (f[2] || '').split('.');
      if (f.length !== 9 || f[0] !== '4' || f[1] !== DATA.v || h.length !== 10 || h[5].length !== HOME.length || h[7].length !== DATA.matrix.length || !/^[01]$/.test(h[8])) return null;
      const seed = num(h[0]), home = {}, matrix = {}, life = {};
      if (seed >= 2 ** 32 || num(h[9]) > 1e8 || (f[3] && f[3].split('.').length > 400)) return null; // 시각은 약 190년, 기록은 400화면까지만(조작된 링크로 메모리·날짜가 깨지지 않게)
      HOME.forEach((k, i) => { const v = at1((DATA.start.home[k] || []).map(o => o.id), h[5][i]); if (v) home[k] = v; });
      DATA.matrix.forEach((r, i) => { const v = at1(MX, h[7][i]); if (v) matrix[r.id] = v; });
      const lv = f[6] ? f[6].split('.') : [], mm = f[7].split('.'), r = f[8].split('.');
      if (lv.length > (DATA.life || []).length || mm.length !== 4 || r.length !== 3 || !/^([0-9a-z]{3}){3}$/.test(r[0]) || !/^[0-9a-z]{12}$/.test(r[1]) || !/^[0-9a-f]{8}$/.test(r[2])) return null;
      lv.forEach((s, i) => { if (!s) return; const q = DATA.life[i], ids = unbits(q.opts, s); if (!ids.length || (!q.multi && ids.length !== 1)) throw 0; life[q.id] = q.multi ? ids : ids[0]; });
      const [name, by, mng, mmust] = mm.map(s => { const t = d64(s); if ([...t].length > 40) throw 0; return t; });
      const st = { v: 4, dv: DATA.v, seed, mode: at1(MODES, h[1]), scope: at1(DATA.start.scope.map(s => s.id), h[2]), zones: unbits(DATA.start.zones, h[3]), rooms: unbits(DATA.start.rooms, h[4]),
        home, gates: unbits(DATA.start.gates, h[6]), matrix, cb: h[8] === '1', at: num(h[9]) * 6e4, name, by,
        log: f[3] ? f[3].split('.').map(unent) : [], ng: unbits(DATA.ng || [], f[4]), must: unbits(DATA.must || [], f[5]), life, memos: { ng: mng, must: mmust } };
      const top3 = [0, 1, 2].map(i => [SIDS[num(r[0][3 * i])], num(r[0].slice(3 * i + 1, 3 * i + 3)) / 1000]);
      if (st.ng.length > 5 || st.must.length > 3 || top3.some(([id, p]) => !id || p > 1) || new Set(top3.map(t => t[0])).size !== 3 || code(st) !== r[2]) return null; // 기록이 한 글자라도 바뀌면 결과 코드가 안 맞는다
      return { ...st, res: { top3, axes: [0, 1, 2, 3, 4, 5].map(i => (num(r[1].slice(2 * i, 2 * i + 2)) - 648) / 100), code: r[2] } };
    } catch (e) { return null; }
  };

  // ── 견본 참조 풀기 ── v = [gen, ...args], 인자 속 '$name'·'$name~k'(밝기 이동)·'$a+$b'(객체 병합)를 맥락값으로 바꿔 V[gen] 호출
  const tokv = (x, c) => typeof x === 'string' ? (/^\$\w+(\+\$\w+)+$/.test(x) ? x.split('+').reduce((a, t) => ({ ...a, ...tokv(t, c) }), {})
    : x[0] === '$' ? (([n, k]) => k !== undefined && typeof c[n] === 'string' && c[n][0] === '#' ? V.shift(c[n], +k) : c[n])(x.slice(1).split('~')) : x)
    : Array.isArray(x) ? x.map(y => tokv(y, c)) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, tokv(y, c)])) : x;
  const vis = (v, c) => { const [g, ...a] = tokv(v, c); return typeof V !== 'undefined' && V[g] ? V[g](...a) : ''; };

  return { tok: tokv, vis, LAT, lat, fresh, replay, answer, rng, pickPhotos, pickOpts, sample, styleProbs, blend, styleAt, mapPos, cloud, axes, allowed, decide, conf, loo, lift, flags, ctx, code, encode, decode };
})();

if (typeof module !== 'undefined') module.exports = E;
