// 리포트 v4: 응답 기록(st) → 리포트 모델(JSON) → 고객·전문가 HTML, 선정표 CSV, 내보내기 JSON. DOM 없음(node로 검사)
// 규칙 원본: docs/v4/design_final.json spec.report · zones[*].report_items, DATA.report(coord·swaps·talk·timeline·scopes …)
const R = (() => {
  const RP = DATA.report, LI = Object.fromEntries(E.LAT.map((d, i) => [d, i]));
  const PAIR = Object.fromEntries(['temp', 'value', 'chroma', 'density', 'form'].map((d, i) => [d, DATA.pairs[i]])); // 짝 차원 → [양(+) 태그, 음(−) 태그]
  const SEC = Object.fromEntries(DATA.sections.map(s => [s.id, s])), ZL = Object.fromEntries(DATA.start.zones.map(z => [z.id, z.label]));
  const ROOM = r => r === 'guest' ? 'study' : r, RL = Object.fromEntries(DATA.start.rooms.map(r => [r.id, r.label]));
  const ZKEY = ['entrance', 'living', 'kitchen', 'bath', 'bedroom'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const jo = (w, a, b) => { // 받침에 맞는 조사(끝 괄호는 빼고, 숫자·영문은 읽는 소리로)
    const s = w.replace(/\([^()]*\)$/, '').replace(/[^가-힣A-Za-z0-9]+$/, ''), c = s.charCodeAt(s.length - 1), ch = s[s.length - 1] || '';
    return (c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 > 0 : /\d/.test(ch) ? '013678'.includes(ch) : /[lmnr]/i.test(ch)) ? a : b;
  };
  const fix = s => s.replace(/은\(는\)|이\(가\)|을\(를\)|과\(와\)|와\(과\)/g, (p, i, all) => { const [a, b] = p.match(/[가-힣]/g); return p[0] === '와' ? jo(all.slice(0, i), b, a) : jo(all.slice(0, i), a, b); });
  const fill = (t, v) => fix(t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? ''));
  const opt = k => { if (!k) return null; const i = k.indexOf('.'), s = k.slice(0, i), d = DATA.dims[s] || DATA.screens[s]; const os = d && (d.opts || (DATA.dims[d.pairs] || {}).opts); return os ? os.find(o => o.id === k.slice(i + 1)) || null : null; };
  const tagsOf = k => (opt(k) || PHOTOS[k] || (k[0] === '@' && DATA.styles[k.slice(1)]) || {}).tags || {};
  const lat = (tags) => E.lat(tags), cos = (u, v) => { const a = u.reduce((s, x, i) => s + x * v[i], 0), n = Math.hypot(...u) * Math.hypot(...v); return n ? a / n : 0; };
  const brief = s => String(s || '').replace(/^\[[^\]]+\]\s*/, '').split(/\.\s| · /)[0].replace(/\s*\([^)]*원[^)]*\)/g, '').replace(/\.$/, '');
  const phase = s => (String(s || '').match(/^\[([^\]]+)\]/) || [])[1] || '';
  const days = t => +((String(t || '').match(/\+(\d+)일/) || [])[1] || 0);
  const ymd = t => { if (!t) return ''; const d = new Date(t); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
  const LV = { high: '높음', mid: '보통', low: '낮음' }, GRADE = { high: '높음', normal: '보통', mixed: '엇갈림', weak: '약함' };
  const METAL = ['DT3', 'KT3', 'BA6'], DETAIL = ['DT1', 'DT2', 'DT3', 'DT4', 'DT5', 'DT6', 'DT7', 'KT3', 'BD5', 'LV3', 'BD3', 'BA6'];
  const COLS = ['코드', '실', '부위', '공종', '범위', '추천안', '절감안', '상향안', '상담 때 보여 줄 안', '근거', '확신', '비가역', '예산', '공기', '결정 시점', '수량·단위', '현장 확인', 'NG', '제조사·품번', '확정', '메모'];
  const CUST = { // 공사 범위 안내(고객 말). DATA.report.scopes.*.rows는 전문가용 메모라 고객 화면에는 이것을 쓴다
    partial: ['고칠 곳만 새로 하고, 나머지는 지금 마감과 어울리는지 확인해요', '새로 하는 곳과 그대로 두는 곳의 경계(문턱·높이 차이)를 업체와 먼저 정하세요'],
    newbuild: ['분양 옵션(마루·중문·붙박이장·조명·확장·시스템에어컨)부터 확인하세요', '기본 마감을 뜯고 다시 하면 비용이 두 번 들어요'],
    rent: (RP.scopes.rent || {}).rows.slice(0, 8),
  };
  const MCODE = { island: ['KC', '주방 가구'], pantry: ['WD', '목공'], tub: ['SN', '설비'], dress: ['WD', '목공'], cafe: ['EL', '전기'], indirect: ['LT', '전기'], midoor: ['WD', '목공'], closet: ['WD', '목공'], study: ['SW', '전기'], pet: ['WF', '바닥'] }; // 필수 요구 잠금 행(행 문구에 코드가 없을 때)
  const NOTE = { // spec report_items 중 늘 붙는 현장 메모(기계 판정이 필요 없는 것만)
    entrance: ['현관 밖 공용 전실 가벽·문은 공동주택관리법 위반 — 추천 안 함', '신발장: 신발 수 기반 수납량, 띄움 높이 현장 결정, 분전함 위치'],
    living: ['TV벽: 반매립 박스·간접 단차(D2), 65인치 이상 벽걸이 하중·앵커', '천장: 시스템에어컨 실내기 위치를 먼저 정하고 조명·실링팬 배치(D1~D2), 스프링클러 확인'],
    kitchen: ['전기 회로(EL, D1): 인덕션·식세기·오븐 전용 회로, 구축은 인입 용량·차단기 확인', '하부장 구성(D5): 식세기 칸·음식물처리기·정수기 자리, 배관·전원 D1'],
    bath: ['공사 범위: UBR·기존 덧방 2회·누수·배치 변경은 올철거 + 방수(필수)', '천장 SMC 평판, 환풍기 + 전동댐퍼, 욕실 난방 환풍기'],
    bedroom: ['헤드월: 침대 위치 확정(D2), 협탁 콘센트 60~70cm 양쪽', '조명: 3로 스위치, 회로 분리, 2700~3000K 디밍'],
    smallroom: ['수납 방식은 정리 습관과 충돌하면 혼합형으로'],
    utility: ['배관·배수·전원(D0): 세탁기 수전·배수구, 건조기 전용 콘센트', '마감(D3): 결로면 단열·환기 먼저(창에 붙는 수납 경고)'],
  };

  const build = st => {
    const P = E.replay(st), code = E.code(st), cx = E.ctx(st), log = st.log || [], m = d => P.m[LI[d]], sd = d => Math.sqrt(Math.max(P.S[LI[d] * P.D + LI[d]], 1e-12));
    const zones = st.zones || [], has = z => zones.includes(z), rooms = has('smallroom') ? (st.rooms || []) : [], home = st.home || {};
    const ans = id => [].concat((st.life || {})[id] ?? (home[id] ?? st[id] ?? [])); // ac·fix는 저장 칸이 정해지지 않아 life → home → st 순으로 읽음
    const isL = (q, o) => ans(q).includes(o), gate = g => (st.gates || []).includes(g);
    const probs = E.styleProbs(P, code), bl = E.blend(probs), ax = E.axes(P), fl = E.flags(st), sname = id => DATA.styles[id].name;
    const G = DATA.start.gates.filter(g => gate(g.id)), NG = DATA.ng.filter(n => (st.ng || []).includes(n.id)), MU = DATA.must.filter(x => (st.must || []).includes(x.id));
    const LS = [...DATA.life.map(q => [q, q.q]), [DATA.start.ac, 'ac'], [DATA.start.fix, 'fix']].flatMap(([q, k]) => q.opts.filter(o => ans(q.id || k).includes(o.id)).map(o => ({ q: q.q, id: q.id || k, o, eff: o.eff || {} })));
    const EFF = [...G.map(g => ({ kind: 'gate', label: g.label, warn: [...(g.warn || []), ...(g.hide || [])], prefer: g.prefer || [] })), ...MU.map(x => ({ kind: 'must', label: `필수 ${x.label}`, warn: x.warn || [], prefer: [] })),
      ...LS.map(l => ({ kind: 'life', label: l.o.label, warn: [...(l.eff.warn || []), ...(l.eff.hide || [])], prefer: l.eff.prefer || [] }))]; // hide도 넣음: 직접 고른 것은 숨겨도 남으니(E.allowed) '충돌 확인'
    const PREF = new Set(EFF.flatMap(e => e.prefer)), budget = ans('budget')[0], more = ans('more'), less = ans('less'), term = ans('term')[0];
    const scope = st.scope || 'remodel', rent = scope === 'rent', bathRange = (st.matrix || {}).bath;
    let metal = ''; // DT1 행을 만든 뒤 그 추천안(안 물었으면 '추정: …')으로 채움 → 손잡이·도어락 마감이 DT1 행과 같다
    const tmed = (a => a.length ? a[a.length >> 1] : 0)(log.map(e => e.t || 0).sort((a, b) => a - b));
    const slow = st.by ? [] : log.filter(e => e.k >= 0 && /\./.test(e.o[e.k]) && e.t >= Math.max(1.8 * tmed, 5000)).sort((a, b) => b.t - a.t).slice(0, 3); // ⑥ 견본 문항 중 느린 3개, 상담 모드는 표시 안 함
    const secOf = s => { const id = s.split(':')[0]; return (DATA.dims[id] || DATA.screens[id] || {}).sec || (RL[id] ? 'smallroom' : id); };
    const nopeSec = Object.entries(log.filter(e => e.k === -1).reduce((a, e) => ({ ...a, [secOf(e.s)]: (a[secOf(e.s)] || 0) + 1 }), {})).filter(([, n]) => n >= 3).map(([z]) => (SEC[z] || {}).name || z); // ⑩ 한 구간 3회 이상
    const rows = [], talk = [], used = new Set();

    // ── 선정표 행(문항) ──
    const range = d => {
      if (rent) return '스타일링';
      if (!d.scope) return '교체';
      const v = (st.matrix || {})[d.scope] || (scope === 'partial' ? 'keep' : d.scope === 'window' || d.scope === 'demolish' ? 'keep' : 'replace');
      return { replace: '교체', reform: '리폼', keep: '유지', unknown: '미정' }[v];
    };
    const area = r => r.code === 'WF' || r.dim === 'CM1' || r.dim === 'CM2' ? 'floor' : ['kitchen', 'bath', 'entrance'].includes(r.sec) ? r.sec : r.code === 'LT' ? 'light'
      : ['closet', 'utility'].includes((DATA.dims[r.dim] || {}).scope) ? 'storage' : r.code === 'WN' ? 'window' : '';
    const ladder = (list, i, lo) => ({ i: Math.max(0, Math.min(list.length - 1, i)), save: list[i - 1] || '—', up: list[i + 1] || '—', lo });
    const mk = o => Object.assign({ code: '', zone: '공통', area: '', trade: '기타', range: rent ? '스타일링' : '교체', rec: null, recText: '', save: '—', up: '—', show: [], src: '추정', conf: '보통', irr: 1, cost: 1, time: '', d: 'D6', qty: '', site: [], ng: [], memo: [], sec: '', dim: '', sid: '', key: null, p: 0, picked: null, status: RP.coord.undecided.fn }, o);
    const dimRow = (d, sid, zone, zkey, sheet) => {
      const id = d.id, cf = E.conf(st, sid), O = k => k && d.opts.find(o => o.id === k.slice(k.indexOf('.') + 1));
      const seen = new Set(cf.opts.filter(r => r.seen).map(r => r.key)), ent = log.filter(e => e.s === sid);
      const picks = d.multi ? [...new Set(ent.filter(e => e.k >= 0).map(e => e.o[e.k]))] : cf.picked ? [cf.picked] : [];
      const nope = !picks.length && ent.length > 0 && ent[ent.length - 1].k === -1, no = new Set(nope ? ent[ent.length - 1].o : []); // 다 별로 = 마지막에 보인 것은 추천하지 않음
      const mu = MU.find(x => (x.p1 || []).includes(id)); // 필수 요구가 잠근 행: 안 골랐으면 필수와 어긋나지 않는 추정 1위
      let rk = nope ? null : d.kind === 'function' ? picks[0] || null : cf.best, src = rk ? (picks.includes(rk) ? '직접' : '추정') : '추정';
      const pf = cf.opts.find(r => PREF.has(r.key) && !no.has(r.key)); // 게이트·생활이 권하는 선택지: 본 것이면 추정 추천안을 바꾸고, 못 본 것이면 상담안 맨 앞
      if (pf && pf.seen && !nope && !picks.includes(rk)) { rk = pf.key; src = '생활'; }
      if (mu && !picks.length) rk = (cf.opts.find(x => !(mu.warn || []).includes(x.key) && !no.has(x.key)) || {}).key || null;
      if (mu && (rk || picks.length)) src = '직접(필수)';
      const o = O(rk), r = mk({ zone, area: d.area, trade: d.trade, range: range(d), irr: d.irr, d: d.d, sec: d.sec, dim: id, sid, zkey, code: d.code, key: rk, picked: cf.picked, kind: d.kind });
      r.p = (cf.opts.find(x => x.key === rk) || {}).p || 0;
      r.conf = rk ? LV[cf.level] : '낮음';
      r.show = cf.opts.filter(x => (nope ? !no.has(x.key) : !x.seen) && x.key !== rk).sort((a, b) => (b.key === (pf || {}).key) - (a.key === (pf || {}).key)).slice(0, 2).map(x => O(x.key).label + (pf && x.key === pf.key ? '(생활 조건)' : ''));
      if (d.multi && picks.length > 1) r.recText = picks.map(k => O(k).label).join(' + ');
      if (o) {
        r.rec = { key: rk, label: o.label + (METAL.includes(id) && !(id === 'KT3' && ['push', 'wood'].includes(o.id)) && metal ? ` · ${metal}` : '') + (mu && !picks.length ? ' (필수)' : ''), spec: o.spec || '' };
        r.cost = o.cost || 1; r.time = o.time || '';
        const segs = String(o.spec || '').split(' · '), sv = segs.find(s => /^절감 /.test(s)), up = segs.find(s => /^상향 /.test(s));
        const sw = RP.swaps.find(s => s.at === rk), alts = cf.opts.map(x => O(x.key)).filter(x => x && x !== o), f = lat(o.tags);
        const near = (c, dir) => alts.filter(x => dir * ((x.cost || 1) - c) > 0).sort((a, b) => dir * ((a.cost || 1) - (b.cost || 1)) || cos(lat(b.tags), f) - cos(lat(a.tags), f))[0];
        const ns = sw && O(sw.use) || (!sv && near(r.cost, -1));
        r.saveKey = ns ? `${id}.${ns.id}` : null;
        r.save = sw && O(sw.use) ? `${O(sw.use).label}(${sw.to})` : sv ? sv.slice(3) : (ns || {}).label || '—';
        r.up = up ? up.slice(3) : (near(r.cost, 1) || {}).label || '—';
        if (cf.level === 'low' || !picks.length) r.memo.push(`2안: ${cf.opts.filter(x => x.key !== rk).slice(0, 1).map(x => O(x.key).label).join('') || '—'}`);
        if (cf.picked && cf.picked !== rk) r.memo.push(`직접 고른 안: ${O(cf.picked).label}`);
        if (cf.flip) r.memo.push('반복 확인에서 답이 바뀜');
      } else r.recText = !cf.opts.length ? '해당 없음(앞 선택으로 빠짐)' : nope && d.kind === 'function' ? `상관없음 — 추정: ${O(cf.opts[0].key).label}` : nope ? d.none || RP.coord.undecided.taste : RP.coord.undecided.fn;
      const fnone = nope && d.kind === 'function'; // 기능 문항의 '상관없어요' = 선호 없음(대안 필요 아님)
      r.status = mu ? (picks.length ? '확정(필수)' : '필수—형태 상담') : picks.length ? '확정' : !cf.opts.length ? '해당 없음' : nope && !fnone ? '대안 필요' : '미정—상담 때 결정';
      if (!picks.length && (!nope || fnone) && cf.opts.length) r.est = O(cf.opts[0].key).label; // 묻지 않은 행: 태그 추정 1위
      if (mu) { r.lock = true; if (!picks.length) r.conf = '보통'; }
      const keep = () => { if (o) r.show.unshift(`취향 참고: ${o.label}`); Object.assign(r, { rec: null, save: '—', up: '—', cost: 1, time: '' }); };
      if (r.range === '유지') { r.recText = '기존 마감과 어울림 확인'; keep(); }
      if (r.range === '리폼' && !((DATA.matrix.find(x => x.id === d.scope) || {}).reform || []).includes(id)) { r.recText = '리폼(필름·도장, D4 전)'; r.src = '현장'; keep(); }
      else r.src = src;
      // NG·게이트·생활·필수 충돌
      for (const n of NG) {
        const ex = d.opts.filter(x => (n.exclude || []).includes(`${id}.${x.id}`));
        if (ex.length) r.ng.push(`제외: ${n.label}(${ex.map(x => x.label).join('·')})`);
        if (!rk) continue;
        if ((n.exclude || []).includes(rk)) { r.ng.push(`충돌 확인: ${n.label}`); talk.push({ on: 'ng', row: r, say: fill(RP.talk.ng.say, { ng: n.label, item: o.label, why: '직접 고르셨어요. 그대로 갈지 확인해 주세요' }) }); }
        else if ((n.warn || []).includes(rk) || Object.entries(n.warnTag || {}).some(([t, w]) => (o.tags[t] || 0) >= w)) { r.ng.push(`경고: ${n.label}`); talk.push({ on: 'ng', row: r, say: fill(RP.talk.ng.say, { ng: n.label, item: `${d.area}의 ${o.label}`, why: '비슷한 느낌이 있어요' }) }); }
        if ((n.swap || {})[rk]) r.memo.push(n.swap[rk]);
        if ((n.memo || {})[rk]) r.memo.push(n.memo[rk]);
      }
      for (const e of EFF) if (rk && e.warn.includes(rk)) { r.ng.push(`충돌 확인: ${e.label}`); talk.push({ on: e.kind === 'must' ? 'must' : 'life', row: r, say: fill(RP.talk.life.say, { text: `${d.area}의 ${o.label}은(는) '${e.label}' 조건과 맞지 않을 수 있어요. 확인해 주세요.` }) }); }
      // 예산 성향·더 쓸 곳·아낄 곳(가성비면 '더 쓸 곳' 밖 ₩₩₩ 행은 절감안이 추천안)
      const ar = area(r), swapS = (why) => { if (r.rec && r.save !== '—') { const t = r.rec.label; r.rec = { key: r.saveKey, label: r.save, spec: (opt(r.saveKey) || {}).spec || '' }; r.up = t; r.save = '—'; r.cost = Math.max(1, r.cost - 1); r.src = '생활'; r.memo.push(why); } };
      if (!(rent ? ['CM1', 'CM3'] : ['CM1', 'KT4']).includes(id) && !r.lock && r.rec) { // 바닥·상판은 아래 소재 사다리가 예산을 반영, 전월세 바닥·벽은 스타일링 행으로 바뀜(여기서 바꾸면 이름·사양이 어긋남)
        if (less.includes(ar)) swapS('아껴도 되는 곳 → 절감안을 추천안으로(원안은 상향안 칸)');
        else if (budget === 'value' && r.cost === 3 && !more.includes(ar)) swapS("가성비 우선 → '더 쓸 곳' 밖 ₩₩₩ 행은 절감안을 추천안으로");
        else if (budget === 'quality' && r.up !== '—') { const u = d.opts.find(x => x.label === r.up && seen.has(`${id}.${x.id}`)); if (u) { r.save = r.rec.label; r.rec = { key: `${id}.${u.id}`, label: u.label, spec: u.spec || '' }; r.up = '—'; r.cost = u.cost || r.cost; r.src = '생활'; r.memo.push('품질 우선 → 본 선택지 중 상향안을 추천안으로'); } }
      }
      if (r.time && ['tight', 'live'].includes(term)) r.memo.push(`공기 늘림(${r.time})`);
      if (ent.some(e => slow.includes(e))) { r.slow = true; talk.push({ on: 'slow', row: r, say: `${d.area}: ${RP.talk.slow.say}` }); }
      if (cf.level === 'low' && o && cf.opts.length > 1) talk.push({ on: 'low', row: r, say: fill(RP.talk.low.say, { row: zkey ? `${zone} ${d.area}` : d.area, q: fix(`${O(cf.opts[0].key).label}과(와) ${O(cf.opts[1].key).label} 중 어느 쪽이 더 편한지 실물로 여쭤보세요.`) }) });
      if (cf.rank > 1 && cf.picked && o) { const alt = cf.opts.find(x => x.key !== cf.picked); if (alt) talk.push({ on: 'loo', row: r, say: zkey ? fill(RP.talk.loo.say, { row: `${zone} ${d.area}`, pick: O(cf.picked).label, alt: O(alt.key).label, zone }) : fill('{row}은(는) {pick}을(를) 고르셨는데 나머지 답으로는 {alt} 쪽이에요. 실물로 다시 비교해 보세요.', { row: d.area, pick: O(cf.picked).label, alt: O(alt.key).label }) }); }
      if (sheet) r.memo.push(...sheet(r, o));
      if (rk) used.add(rk);
      if (id === 'DT1') metal = r.rec ? r.rec.label : r.est ? `추정: ${r.est}` : '';
      return r;
    };
    const kept = r => { if (r.range === '유지') Object.assign(r, { show: [`취향 참고: ${r.recText}`, ...r.show], recText: '기존 마감과 어울림 확인', save: '—', up: '—', cost: 1, irr: 1, d: 'D6', time: '' }); return r; }; // 유지 범위의 유도 행: 추천은 참고로만
    const extra = o => { const r = kept(mk(o)); rows.push(r); return r; };

    // 욕실 2개 이상 → 공용·부부 시트(같은 팔레트, 공용은 관리 우선)
    const baths = has('bath') ? (['b2', 'b3'].includes(home.baths) ? [['공용 욕실', 'common'], ['부부 욕실', 'master']] : [['욕실', '']]) : [];
    const MAINT = { BA7: ['matte', '무광'], BA3: ['tonal', '동색 줄눈'], BA2: ['t300x600', '300×600'] };
    const bathSheet = kind => (r, o) => kind === 'common' && o && MAINT[r.dim] && MAINT[r.dim][0] !== o.id ? [`공용은 관리 우선 → ${MAINT[r.dim][1]} 권장`] : kind === 'master' ? ['부부 욕실: 취향 1안(같은 팔레트)'] : [];
    const inc = d => !(rent && d.rent === false) && (!d.zones || d.zones.some(has));
    for (const s of DATA.sections) {
      if (!['shell', 'detail'].includes(s.id) && !has(s.id)) continue;
      for (const id of s.dims) {
        const d = DATA.dims[id];
        if (!d || !inc(d)) continue;
        if (s.id === 'bath') { for (const [lab, k] of baths) rows.push(dimRow(d, id, lab, 'bath', bathSheet(k))); continue; }
        if (s.id === 'smallroom') {
          if (d.perRoom) { for (const rm of rooms) rows.push(dimRow(d, `${id}:${rm}`, RL[rm], ROOM(rm))); continue; }
          const rm = rooms.find(x => ROOM(x) === d.room);
          if (d.room && !rm) continue;
          rows.push(dimRow(d, id, rm ? RL[rm] : SEC.smallroom.name, rm ? ROOM(rm) : null)); continue;
        }
        rows.push(dimRow(d, id, ['shell', 'detail'].includes(s.id) ? '공통' : ZL[s.id] || s.name, ZKEY.includes(s.id) ? s.id : null));
      }
      if (s.id === 'smallroom' && !has('bedroom')) rows.push(Object.assign(dimRow(DATA.dims.BD5, 'BD5', SEC.smallroom.name, null), { sec: 'smallroom' })); // 침실을 안 고르면 BD5는 작은방에서 물음(flow.js)
    }
    const row = id => rows.find(r => r.dim === id), rk = id => (row(id) || {}).key || null, zm = (z, d) => { const b = P.blocks[z], j = b ? b.idx.indexOf(LI[d]) : -1; return m(d) + (j >= 0 ? P.m[b.off + j] : 0); };
    const lastPick = s => { for (let i = log.length - 1; i >= 0; i--) if (log[i].s === s && log[i].k >= 0) return log[i].o[log[i].k]; return null; };

    // ── 유도 행(spec report_items) ──
    const fl1 = row('CM1'), fk = fl1 && ((fl1.rec || {}).key || fl1.key), stone = fk ? ((opt(fk) || {}).set || {}).floorKind === 'stone' : cx.floorKind === 'stone'; // 바닥 판단은 지금 추천안(예산 교체 뒤) 기준
    if (fl1 && fl1.rec && fl1.range !== '유지' && !rent) { // 바닥 소재 사다리: 맨발 느낌·가족·예산 성향, 절감안은 한 단계 아래
      const L = stone ? [['타일형 강마루', 2], ['포세린', 3]] : [['장판(우드 패턴)', 1], ['강마루', 2], ['원목마루', 3]];
      let i = 1, mat = null;
      if (!stone && (isL('foot', 'soft') || gate('infant') || isL('pain', 'noise'))) { i = 0; mat = isL('foot', 'soft') ? '쿠션 장판(4.5~6T)' : '쿠션 장판(4.5T 이상)'; }
      else if (!stone && gate('pet')) mat = 'PS 인증 펫 시트 바닥재 또는 미끄럼 저항 강마루';
      if (!mat && (budget === 'value' || less.includes('floor')) && !more.includes('floor')) i--;
      if (!mat && budget === 'quality') i++;
      const lad = ladder(L.map(x => x[0]), i);
      fl1.rec.label = `${opt(fk).label}${stone ? '' : ' 톤'} · ${mat || L[lad.i][0]}`; fl1.rec.spec = mat || L[lad.i][0]; fl1.save = lad.save; fl1.up = lad.up; fl1.cost = L[lad.i][1]; fl1.ladder = true;
      if (stone) fl1.code = 'TL';
      if (stone && isL('roomfloor', 'wood')) extra({ code: 'WF', area: '방 바닥', trade: '바닥', range: fl1.range, recText: `방은 마루(${opt(fk).label}과 어울리는 톤)`, src: '생활', irr: 4, cost: 2, d: 'D0', site: ['경계 단차·재료 분리대'] });
      if (!stone && (isL('foot', 'soft') || i === 0)) fl1.site.push('장판은 보통 도배 후 시공, 눌림 자국 안내');
    }
    if (rent) for (const [id, lab] of [['CM1', '러그·데코타일 톤'], ['CM3', '패브릭·커튼 톤']]) { // 전월세: 바닥·벽 질감은 취향 신호로만(공사 대신 러그·패브릭 행)
      const r = row(id);
      if (r && r.rec) Object.assign(r, { rec: { key: r.key, label: `${lab}: ${opt(r.key).label}`, spec: '' }, save: '—', up: '—', cost: 1, time: '', src: '추정', irr: 1, memo: [...r.memo, RP.scopes.rent.rows[RP.scopes.rent.rows.length - 1]] });
    }
    const kt4 = row('KT4');
    if (kt4 && kt4.rec) { // 상판: 무늬 = KT4, 소재 = 조리 빈도 × 예산 성향(무늬는 그대로, 절감안은 늘 더 싸다)
      const L = ((opt(kt4.key).spec || '').match(/소재 사다리\(싼 쪽부터\): ([^·]+)/) || [, '인조대리석 → 엔지니어드 스톤'])[1].trim().split(' → ');
      let i = 0;
      if (isL('cook', 'daily')) i = Math.max(i, L.findIndex(x => /엔지니어드|세라믹/.test(x)));
      if ((budget === 'value' || less.includes('kitchen')) && !more.includes('kitchen')) i--;
      if (budget === 'quality') i++;
      const lad = ladder(L, i), pn = opt(kt4.key).label;
      kt4.rec.label = `${pn} · ${L[lad.i]}`; kt4.save = lad.save === '—' ? '—' : `${pn} · ${lad.save}`; kt4.up = lad.up === '—' ? '—' : `${pn} · ${lad.up}`;
      kt4.code = /인조/.test(L[lad.i]) ? 'AS' : 'ST'; kt4.cost = /인조/.test(L[lad.i]) ? 1 : /세라믹/.test(L[lad.i]) ? 3 : 2; kt4.ladder = true;
      if (isL('cook', 'daily')) { kt4.src += '+생활'; kt4.memo.push('매일 굽기 규칙으로 소재만 상향(무늬 유지)'); }
      kt4.site.push('타공 후 변경 불가, 이음·결 도면(D5)');
    }
    if (row('CM3') && /paint|limewash/.test((row('CM3').rec || {}).key)) row('CM3').code = 'PT';
    // 벽 바탕색 WC-00(유도, 확신 최대 '보통'): 온도 축 이웃 칩 2개는 상담안
    const W = RP.wallColors, wi = W.axis.indexOf(cx.wallId), wo = W.opts[cx.wallId] || {}, wn = [W.axis[wi - 1], W.axis[wi + 1]].filter(Boolean).map(k => W.opts[k].label);
    rows.unshift(kept(mk({ code: 'WC', area: '벽 바탕색', trade: '도배', range: rent ? '스타일링' : range({ scope: 'wall' }), recText: `${wo.label} ${wo.hex}`, show: wn, src: '추정', conf: Math.abs(m('temp')) / sd('temp') >= 1 ? W.confMax : '낮음', irr: 2, cost: 1, d: 'D4', site: [W.note], wall: wo.hex, dim: 'WC-00', sec: 'shell' })));
    // 빛 색·회로(A6·C2): 기본 메인 4000K + 간접 3000K, 흰 빛이 뚜렷하면 주광색 통일, 엇갈리면 색온도 조절형
    const a6 = lastPick('A6'), c2 = lastPick('C2'), white = a6 === 'A6.k6500' && (!c2 || c2 === 'C2.k6500');
    const cct = (a6 === 'A6.k2700' && c2 === 'C2.k6500') || (a6 === 'A6.k6500' && c2 === 'C2.k2700'); // C2는 2700·6500뿐 → 4000K는 어느 쪽과도 엇갈림이 아님
    const kel = cct ? '색온도 조절형(CCT) 메인' : white ? '메인 주광색(약 5700~6500K) + 간접도 같은 색' : a6 === 'A6.k2700' || (a6 !== 'A6.k6500' && c2 === 'C2.k2700') ? '메인 4000K + 간접 2700~3000K' : '메인 4000K + 간접 3000K';
    extra({ code: 'LT', area: '빛 색·회로', trade: '전기', range: range({ scope: 'light' }), recText: kel, save: '—', up: cct ? '—' : '색온도 조절형(CCT) 메인', src: a6 ? '직접' : '추정', conf: a6 ? (cct ? '낮음' : '보통') : '낮음', irr: 2, cost: cct ? 2 : 1, d: 'D1', site: ['한 공간에 3000K·5700K 혼용 금지'], sec: 'shell', dim: 'A6' });
    if (has('entrance') && !rent) {
      const v = m('value'), sh = v >= 0.5 ? 0 : v <= -0.5 && !NG.some(n => n.id === 'dark-floor') ? -20 : -8, hex = V.shift(cx.floor, sh);
      const pol = m('gloss') >= 0.5 && !gate('infant') && !gate('elder') && !NG.some(n => n.id === 'shiny-tile');
      extra({ code: 'TL', zone: '현관', area: '현관 바닥 톤·광택', trade: '타일', range: range({ scope: 'floor' }), recText: `바닥 톤${sh ? `보다 ${sh === -20 ? '두 톤' : '한 톤'} 짙게` : '과 같은 톤'}(${hex}) · 무광 논슬립`, up: pol ? '폴리싱(젖으면 미끄러움)' : '—', src: '추정', irr: 4, cost: 1, d: 'D3', site: ['바닥용 자기질·실측 분할도'], sec: 'entrance', chip: hex });
      extra({ code: 'ST', zone: '현관', area: '디딤판', trade: '타일', range: range({ scope: 'floor' }), recText: '바닥과 같은 계열·색, 도메(45°) 가공' + (gate('elder') ? ' · 논슬립 + 센서등' : ''), src: gate('elder') ? '생활' : '추정', irr: 4, cost: 1, d: 'D0', sec: 'entrance', site: ['중문 위치(디딤석 위·아래)와 함께 결정'] });
      extra({ code: 'HW', zone: '현관', area: '도어락', trade: '기타', recText: `도어락${metal ? ` · ${metal}` : ''}`, src: '추정', irr: 1, cost: 1, d: 'D6', sec: 'entrance', dim: 'DOOR' });
      const en0 = row('EN0');
      if (en0 && (isL('robot', 'yes') || isL('bulky', 'stroller'))) en0.memo.push('하부 레일 없는 상부 행거식 검토(로봇청소기·유모차)');
    }
    if (has('kitchen') && !rent) {
      extra({ code: 'LT', zone: '주방', area: '작업등', trade: '조명', range: range({ scope: 'light' }), recText: '상부장 하부 또는 레일 작업등(항상 포함)', src: '현장', irr: 2, cost: 1, d: 'D1', sec: 'kitchen' });
      if (rk('KT6') === 'KT6.none') row('KT6').memo.push('상부장이 없으면 키큰장·팬트리 필수');
    }
    for (const [lab, kind] of rent ? [] : baths) { // 욕실 바닥(유도)·변기·샤워기 행
      const b2 = rk('BA2'), deop = bathRange === 'reform', safe = gate('infant') || gate('elder'), big = ['BA2.t600', 'BA2.t1200'].includes(b2) && !deop && !safe;
      extra({ code: 'TL', zone: lab, area: '욕실 바닥', trade: '타일', range: range({ scope: 'bath' }), recText: big ? '벽과 같은 계열 무광 바닥 + 일자 배수구·한 방향 구배(업체 확인)' : '300각 이하 무광 논슬립(미끄럼 저항 등급 확인)',
        save: big ? '300×300 무광 논슬립 동색' : '—', src: safe ? '생활' : '추정', irr: 4, cost: big ? 2 : 1, d: 'D3', sec: 'bath', site: ['물 닿는 곳 줄눈은 에폭시 계열'] });
      const sm = zm('bath', 'seamless') >= 0.5, tl = ans('toilet')[0], sw = ans('shower')[0];
      const T = { same: '변기 동급 교체', bidet: '비데 일체형(전원 D1)', wall: '벽걸이(매립 탱크 → 조적·가벽 D0)' }, S = { expose: '해바라기 노출형', embed: '매립 레인샤워(D0, 올철거 전제)', hand: '핸드샤워 + 슬라이드 바' };
      extra({ code: 'SN', zone: lab, area: '변기', trade: '설비', range: range({ scope: 'bath' }), recText: T[tl] || '일반 변기', up: tl === 'wall' ? '—' : sm ? '벽걸이' : '비데 일체형', src: T[tl] ? '생활' : '추정', irr: tl === 'wall' ? 5 : 3, cost: tl === 'wall' ? 3 : tl === 'bidet' ? 2 : 1, d: tl === 'wall' ? 'D0' : 'D1', sec: 'bath', site: tl === 'wall' && deop ? ['덧방이면 벽걸이 불가'] : [] });
      extra({ code: 'SN', zone: lab, area: '샤워기', trade: '설비', range: range({ scope: 'bath' }), recText: S[sw] || (deop ? '해바라기 노출형(덧방 기본)' : '해바라기 노출형'), up: sw === 'embed' ? '—' : sm ? '매립 레인샤워' : '—', src: S[sw] ? '생활' : '추정', irr: sw === 'embed' ? 5 : 2, cost: sw === 'embed' ? 3 : 1, d: sw === 'embed' ? 'D0' : 'D6', sec: 'bath', site: sw === 'embed' && deop ? ['덧방이면 매립 불가'] : [],
        memo: kind === 'common' && (isL('tub', 'often') || gate('infant') || MU.some(x => x.id === 'tub')) ? ['공용 욕실 욕조 유지'] : kind === 'master' && isL('tub', 'never') && !MU.some(x => x.id === 'tub') ? ['욕조 철거 + 샤워 구획'] : [] });
    }
    if (!rent && (isL('ac', 'system') || isL('ac', 'stand') || MU.some(x => x.id === 'ac'))) {
      const sys = !isL('ac', 'stand');
      extra({ code: 'AC', area: '냉난방', trade: '설비', recText: sys ? '시스템에어컨 새로' : '스탠드·벽걸이(배관 숨김)', src: MU.some(x => x.id === 'ac') ? '직접(필수)' : '생활', ...(MU.some(x => x.id === 'ac') ? { status: '필수—형태 상담', lock: true } : {}), irr: sys ? 5 : 3, cost: sys ? 3 : 2, d: 'D0', site: [sys ? 'D0 실외기·배관 경로·전원 / D1 배관·드레인 / D2 단내림·점검구 / 도배 전 실내기' : '배관 매립·슬리브 D1~D2'] });
    }
    for (const x of MU.filter(x => x.id !== 'ac' && !(x.p1 || []).length)) { // 필수 요구 = 잠금 행(완화 규칙보다 우선). ac는 냉난방 행, p1 있는 것은 그 문항 행이 잠금
      const t = x.rows[0] || x.label, cm = t.match(/^([A-Z]{2}) /), [c0, tr] = MCODE[x.id] || ['WD', '기타'];
      extra({ code: cm ? cm[1] : c0, area: x.label, trade: tr, recText: `${t.replace(/^[A-Z]{2} /, '')} (필수)`, src: '직접(필수)', conf: '높음', irr: 3, cost: 2, d: (x.rows.join(' ').match(/D\d/) || ['D2'])[0], site: x.rows.slice(1), status: '필수—형태 상담', lock: true });
    }
    // 코드 번호(같은 코드 안에서 표 순서대로)
    const cn = {};
    for (const r of rows) { cn[r.code] = (cn[r.code] || 0) + 1; r.code = `${r.code}-${String(cn[r.code]).padStart(2, '0')}`; if (!r.recText) r.recText = r.rec ? r.rec.label : RP.coord.undecided.fn; }

    // ── 조화 점검(DATA.report.coord) ──
    const chosen = new Set([...rows.map(r => r.rec && r.rec.key).filter(Boolean), ...Object.keys(DATA.screens).map(lastPick).filter(Boolean)]);
    const grp = g => [].concat(g).reduce((s, x) => s + (RP.coord.groups[x] || []).filter(k => chosen.has(k)).length, 0);
    const ok = c => c.all ? c.all.every(ok) : c.not ? !ok(c.not) : c.n ? (n => (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max))(c.n.filter(ok).length)
      : c.g ? grp(c.g) > 0 : c.cnt ? (n => (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max))(grp(c.cnt)) : c.pick ? [].concat(c.pick).some(k => chosen.has(k))
      : c.ans ? [...chosen].some(k => k.startsWith(`${c.ans}.`)) : c.zone ? has(c.zone) : c.gate ? [].concat(c.gate).some(gate) : c.life ? isL(...c.life.split('.')) : c.scope ? scope === c.scope
      : c.lat ? (v => c.gt !== undefined ? v > c.gt : c.gte !== undefined ? v >= c.gte : c.lt !== undefined ? v < c.lt : v <= c.lte)(m(c.lat)) : false;
    const why = ids => (ids || []).map(id => { const k = [...chosen].find(x => x.startsWith(`${id}.`)), o = opt(k); return o && `${(DATA.dims[id] || {}).area || '저녁 빛'} ${o.label || (o.render ? `${o.render.k}K` : o.id)}`; }).filter(Boolean);
    const coord = { checks: [], plan: [], once: [], alt: [] };
    for (const ru of RP.coord.rules) {
      if (!ok(ru.when)) continue;
      const msg = [].concat(ru.msg).join(' / ');
      if (ru.lv) coord.checks.push({ rule: ru.id, level: ru.lv, msg, why: why(ru.why) });
      else if (ru.out === 'memo') for (const a of ru.at) { const rr = rows.filter(r => r.dim === a); if (rr.length) rr.forEach(r => r.memo.push(msg)); else coord.checks.push({ rule: ru.id, level: 'memo', msg, why: [ZL[a] || a] }); }
      else if (ru.out === 'plan') coord.plan.push(`${msg}: ${[ru.when.pick, ...ru.with].filter(k => chosen.has(k)).map(k => opt(k).label).join(' · ')}`);
      else if (ru.out === 'once') coord.once.push(...[].concat(ru.msg));
      else if (ru.out === 'alt') { coord.alt.push(msg); for (const a of ru.alt) for (const r of rows) if (a.at.some(k => k === r.dim || k === (r.rec || {}).key)) r.memo.push(`전월세 대안: ${a.msg}`); }
    }
    if (rk('KT1') && ((rk('KT1') === 'KT1.purewhite' && ['warm', 'greige'].includes(cx.wallId)) || (rk('KT1') === 'KT1.warmwhite' && ['pure', 'lightgray'].includes(cx.wallId))))
      coord.checks.push({ rule: 'white-one', level: 'check', msg: fill(RP.talk.harmony.say, { a: `주방 도어 ${opt(rk('KT1')).label}`, b: `벽 바탕색 ${wo.label}` }), why: [`주방 도어 ${opt(rk('KT1')).label}`, `벽 바탕색 ${wo.label}`] });
    coord.checks.sort((a, b) => (a.level !== 'check') - (b.level !== 'check'));
    const temps = { main: kel, ...Object.fromEntries(['living', 'bedroom', 'bath', 'entrance'].filter(z => has(z)).map(z => [ZL[z], RP.coord.temps[z]])) };
    if (scope === 'newbuild') for (const r of rows) if (['floor', 'vestibule', 'closet', 'light', 'window'].includes((DATA.dims[r.dim] || {}).scope)) r.site.push('분양 옵션 확인');

    // ── 토킹포인트 ──
    const tk = [];
    if (MU.length) tk.push({ on: 'must', say: fill(RP.talk.must.say, { must: MU.map(x => x.label).join('·') }) });
    const seenT = new Set(), looD = new Set(talk.filter(t => t.on === 'loo').map(t => t.row.dim));
    for (const on of ['low', 'loo', 'slow', 'life', 'must', 'ng']) tk.push(...talk.filter(t => t.on === on && !(on === 'low' && looD.has(t.row.dim)) && !seenT.has(`${on}${t.row.dim}`) && seenT.add(`${on}${t.row.dim}`)).sort((a, b) => (b.row.irr || 0) - (a.row.irr || 0)).slice(0, on === 'low' ? 4 : 3).map(t => ({ on: t.on === 'must' ? 'life' : t.on, say: t.say })));
    for (const l of LS) if (l.o.talk) tk.push({ on: 'life', say: l.o.talk });
    for (const c of coord.checks.filter(c => c.level === 'check').slice(0, 3)) tk.push({ on: 'harmony', say: c.msg });
    const sysAC = isL('ac', 'system') || MU.some(x => x.id === 'ac');
    if (sysAC && (['DT4.wood', 'DT4.white', 'DT4.slim', 'DT4.bladeless', 'LV2.line', 'LV2.cove', 'DT6.line'].some(k => chosen.has(k)))) tk.push({ on: 'ceiling', say: RP.talk.ceiling.say });
    const big = rows.filter(r => r.cost === 3 && r.rec), wd = big.filter(r => r.trade === '목공');
    if (chosen.has('CM4.none') && chosen.has('CM5.hidden')) tk.push({ on: 'budget', say: RP.talk.budget.ex });
    else if (wd.length) tk.push({ on: 'budget', say: fill(RP.talk.budget.say, { item: wd.slice(0, 2).map(r => r.rec.label).join(' + '), alt: '거실만 적용하는 절충안이 있어요.' }) });
    else if (big.length >= 3 || (big.length && ['value', 'consult'].includes(budget))) tk.push({ on: 'budget', say: fix(`${[...new Set(big.map(r => r.rec.label))].slice(0, 2).join(' + ')}은(는) 비용이 커요. 절감안과 함께 같은 사양으로 견적을 받아 보세요.`) });
    if (nopeSec.length) tk.push({ on: 'nope', say: RP.talk.nope.say });
    const p1 = probs[0][1], blab = p1 >= 0.7 ? '뚜렷함' : p1 >= 0.4 ? '약간' : '반반';
    if (blab === '반반' || fl.grade === 'mixed') tk.push({ on: 'mixed', say: RP.talk.mixed.say });

    // ── 취향 요약 ──
    const strong = E.LAT.filter(d => !DATA.styleSkip.includes(d)).map(d => { const v = m(d), t = PAIR[d] ? PAIR[d][v >= 0 ? 0 : 1] : v > 0 ? d : null; return { d, t, v, z: Math.abs(v) / sd(d) }; })
      .filter(x => x.t && DATA.tags[x.t]).sort((a, b) => b.z - a.z);
    const clear = strong.filter(x => x.z >= 2 && Math.abs(x.v) >= 0.6).slice(0, 3); // 세부 태그는 '뚜렷함'만 문장에(없으면 '약간' 이상 1~2개)
    const words = (clear.length ? clear : strong.filter(x => x.z >= 1).slice(0, 2)).map(x => DATA.tags[x.t].word);
    const names = bl.map(([id]) => sname(id)), blend = blab === '뚜렷함' ? fix(`${names[0]} 쪽이 뚜렷해요`) : blab === '약간' ? fix(`${names[0]}을(를) 중심으로 ${names.slice(1).join('·')}이(가) 조금`) : fix(`${names[0]}과(와) ${names[1]}이(가) 반반`);
    const ev = t => { // 근거: 고른 것 n개 중 a개 · 거절한 m개 중 b개에 그 태그
      const pk = log.filter(e => e.k >= 0).map(e => e.o[e.k]), rj = log.filter(e => e.k !== -2).flatMap(e => e.o.filter((_, j) => j !== e.k));
      return `고른 ${pk.length}개 중 ${pk.filter(k => tagsOf(k)[t] > 0).length}개 · 거절한 ${rj.length}개 중 ${rj.filter(k => tagsOf(k)[t] > 0).length}개에 ${DATA.tags[t].label}`;
    };
    const moodV = x => Array.isArray(x) ? x.reduce((s, y) => s + moodV(y), 0) / x.length : x[0] === '-' ? -m(x.slice(1)) : m(x);
    const moods = Object.entries(RP.moods).map(([id, o]) => ({ id, label: o.label, v: o.lat.reduce((s, x) => s + moodV(x), 0) / o.lat.length })).sort((a, b) => b.v - a.v);
    const moodTop = moods.filter((x, i) => i < RP.moodShow[0] || (i < RP.moodShow[1] && x.v > 0.25));
    const north = isL('sun', 'north'), pal = DATA.styles[bl[0][0]].palette.map(h => north ? V.shift(h, RP.palette.north.shift) : h), far = DATA.styles[probs[probs.length - 1][0]].palette;
    const avoid = [...NG.filter(n => RP.palette.avoid.ng.includes(n.id)).map(n => ({ label: n.label, ng: n.id })), ...[far[4], far[3]].map(h => ({ hex: h }))].slice(0, RP.palette.avoid.n);
    const mapMe = E.mapPos(P.m), near = probs.slice(0, 3).map(([id], i) => ({ n: i + 1, id, name: sname(id), at: E.styleAt[id] })); // 범례 = 취향 한 줄과 같은 확률 순
    const photos = log.filter(e => e.k >= 0 && PHOTOS[e.o[e.k]]).map(e => e.o[e.k]).reverse();
    const sw = rows.filter(r => r.rec && r.rec.key && (opt(r.rec.key) || {}).v).sort((a, b) => b.p - a.p).filter((r, i, a) => a.findIndex(x => x.rec.key === r.rec.key) === i);
    const board = [...photos.slice(0, 6).map(id => ({ img: id, alt: PHOTOS[id].alt || '' })), ...sw.slice(0, 9).map(r => ({ key: r.rec.key, label: r.area }))].slice(0, 9);
    const zp = {}, zstyle = z => (zp[z] = zp[z] || E.styleProbs(P, code, z))[0][0];
    const recs = z => [...new Set(rows.filter(r => (r.zkey ? r.zkey === z : r.sec === z) && r.rec && r.kind !== 'function').sort((a, b) => b.irr - a.irr).map(r => `${r.area} ${r.rec.label}`))].slice(0, 2);
    const zline = [];
    for (const z of DATA.start.zones) {
      if (z.id === 'smallroom' && rooms.length) { for (const rm of rooms) zline.push({ zone: RL[rm], style: sname(zstyle(ROOM(rm))), recs: recs(ROOM(rm)), est: false }); continue; }
      const k = ZKEY.includes(z.id) ? z.id : null, on = has(z.id);
      zline.push({ zone: z.label, style: sname(on && k ? zstyle(k) : bl[0][0]), recs: on ? recs(k || z.id) : [], est: !on }); // 블록 없는 공간(다용도실)은 sec로
    }
    const diff = z => { const b = P.blocks[z]; return b ? b.idx.map((d, j) => ({ d: E.LAT[d], v: P.m[b.off + j] })).filter(x => Math.abs(x.v) >= 0.3).map(x => { const t = PAIR[x.d] ? PAIR[x.d][x.v > 0 ? 0 : 1] : x.d; return `전체보다 ${!PAIR[x.d] && x.v < 0 ? '덜' : '더'} ${DATA.tags[t] ? DATA.tags[t].word : t}`; }) : []; };
    const hotel = { bath: zm('bath', 'ambient') >= 0.5 && zm('bath', 'stone') >= 0.3 && zm('bath', 'seamless') >= 0.3 ? '대형 타일·조명거울·건식 세면 분리·매립 수전' : '',
      bedroom: zm('bedroom', 'ambient') >= 0.5 && zm('bedroom', 'fabric') >= 0.3 && zm('bedroom', 'seamless') >= 0.3 ? '헤드월·대칭 벽등·화이트 침구' : '' };
    const zmemo = { bath: [`샤워 구획(추정): ${zm('bath', 'open') >= 0.3 ? '투명 파티션' : '에칭·브론즈 파티션'}`, `젠다이·니치(추정): ${zm('bath', 'density') > 0.3 ? '젠다이 + 니치' : '니치만'}`],
      living: [`소파·러그(추정): ${m('form') >= 0 ? '둥근' : '반듯한'} 형태, ${m('fabric') >= 0.3 ? '포근한 패브릭' : '매끈한 소재'}`], bedroom: ['붙박이장 깊이: 여닫이 약 600mm / 슬라이딩 약 700mm, 장 앞 통로 900~1,000mm'] };
    const zcards = [...DATA.sections.filter(s => !['shell', 'detail'].includes(s.id) && has(s.id)).map(s => ({ id: s.id, name: s.name, rows: rows.filter(r => r.sec === s.id).map(r => r.code),
      diff: s.id === 'smallroom' ? rooms.flatMap(rm => diff(ROOM(rm)).map(t => `${RL[rm]}: ${t}`)) : diff(s.id), style: ZKEY.includes(s.id) ? sname(zstyle(s.id)) : '', hotel: hotel[s.id] || '',
      notes: [...(NOTE[s.id] || []), ...(zmemo[s.id] || []), ...coord.checks.filter(c => c.level === 'memo' && c.why.includes(ZL[s.id])).map(c => c.msg)],
      warn: rows.filter(r => r.sec === s.id && r.ng.some(t => /충돌|경고/.test(t))).map(r => `${r.zone} ${r.area}: ${r.ng.filter(t => /충돌|경고/.test(t)).join(', ')}`) }))];

    // ── 예산·타임라인·현장 ──
    const top = rows.filter(r => r.cost >= 2 && r.range !== '유지').sort((a, b) => b.cost - a.cost || b.irr - a.irr || days(b.time) - days(a.time)).slice(0, RP.budget.top).map(r => r.code);
    const swaps = RP.swaps.map(s => ({ ...s, hit: !!s.at && chosen.has(s.at) }));
    const tl = Object.entries(RP.dlabel).map(([d, label]) => ({ d, label, base: RP.timeline[d] || [], rows: rows.filter(r => r.d === d).map(r => `${r.zone} ${r.area}: ${r.recText}`), plan: d === 'D2' ? coord.plan : [] }));
    const checks = [...new Set([...LS.flatMap(l => l.eff.checks || []), ...rows.flatMap(r => r.site)])];
    const askLater = DATA.life.filter(q => !(q.id in (st.life || {})) && (!q.when.zone || has(q.when.zone) || rooms.map(ROOM).includes(q.when.zone)) && (!q.when.scope || q.when.scope.includes(scope))
      && (!q.when.pick || q.when.pick.some(k => lastPick(k.split('.')[0]) === k))).map(q => q.q); // 7: 묻지 않은(빠르게·화면 상한으로 뺀) 생활 질문
    const lifeRows = LS.filter(l => (l.eff.rows || []).length).map(l => ({ q: l.q, a: l.o.label, rows: l.eff.rows }));
    const extraDays = rows.reduce((s, r) => s + days(r.time), 0), pass = log.length ? log.filter(e => e.k < 0).length / log.length : 0;
    const dis = E.LAT.filter(d => !PAIR[d] && !DATA.styleSkip.includes(d) && m(d) <= -0.8 && m(d) / sd(d) <= -1.2816).map(d => DATA.tags[d] ? DATA.tags[d].label : d);
    const credits = [...new Set(log.flatMap(e => e.o).filter(k => PHOTOS[k]))].map(id => ({ id, ...(PHOTOS[id].credit || (typeof PHOTO_CREDITS !== 'undefined' && PHOTO_CREDITS[id]) || DATA.credits) }));
    const tags = () => strong.slice(0, 5).map(x => ({ word: DATA.tags[x.t].word, label: DATA.tags[x.t].label, m: +Math.abs(x.v).toFixed(2), z: +x.z.toFixed(2), clear: x.z >= 2 && Math.abs(x.v) >= 0.6 ? '뚜렷함' : x.z >= 1 ? '약간' : '판단 보류', ev: ev(x.t) }));

    return {
      v: 4, dv: DATA.v, code, link: `#r=${E.encode(st)}`, scope, scopeName: (RP.scopes[scope] || {}).name || '', scopeRows: (RP.scopes[scope] || {}).rows || [], ctx: cx,
      head: { name: st.name || '', by: st.by || '', date: ymd(st.at), mode: (DATA.modes[st.mode] || {}).label || '', zones: [...zones.filter(z => z !== 'smallroom').map(z => ZL[z]), ...rooms.map(r => RL[r])],
        size: ((DATA.start.home.size.find(o => o.id === home.size)) || {}).label || '', people: ((DATA.start.home.people.find(o => o.id === home.people)) || {}).label || '', baths: ((DATA.start.home.baths.find(o => o.id === home.baths)) || {}).label || '',
        gates: G.map(g => g.label), matrix: DATA.matrix.filter(x => (st.matrix || {})[x.id]).map(x => `${x.label} ${{ replace: '교체', reform: '리폼', keep: '유지', unknown: '미정' }[st.matrix[x.id]]}`),
        budget: ((DATA.life.find(q => q.id === 'budget').opts.find(o => o.id === budget)) || {}).label || '', term: ((DATA.life.find(q => q.id === 'term').opts.find(o => o.id === term)) || {}).label || '',
        who: ((DATA.life.find(q => q.id === 'who').opts.find(o => o.id === ans('who')[0])) || {}).label || '', screens: log.length, minutes: Math.round(log.reduce((s, e) => s + (e.t || 0), 0) / 6e3) / 10,
        grade: GRADE[fl.grade], flags: fl, pass: Math.round(pass * 100), big: rows.filter(r => r.cost === 3).length, extraDays },
      taste: { words, blend, label: blab, styles: bl.map(([id, p]) => ({ id, name: sname(id), p })), of20: probs.slice(0, 5).map(([id, p]) => ({ id, name: sname(id), n: Math.round(p * 20) })), axes: ax.map(a => ({ ...a, m: +a.m.toFixed(2), sd: +a.sd.toFixed(2), clear: Math.abs(a.m) / (a.sd || 1) >= 2 && Math.abs(a.m) >= 0.6 ? '뚜렷함' : Math.abs(a.m) / (a.sd || 1) >= 1 ? '약간' : '판단 보류' })), tags: tags(), dislike: dis },
      map: { me: mapMe, cloud: E.cloud(P, st.seed), near }, moods: moodTop.map(x => ({ ...x, v: +x.v.toFixed(2) })),
      palette: { base: pal.slice(0, 2), sub: pal.slice(2, 4), accent: pal.slice(4), wall: { label: wo.label, hex: wo.hex }, avoid, north },
      board, zones: zline, cards: zcards, must: { items: MU.map(x => ({ id: x.id, label: x.label, rows: x.rows })), memo: (st.memos || {}).must || '' },
      ng: { items: NG.map(n => ({ id: n.id, label: n.label, exclude: (n.exclude || []).map(k => opt(k) ? opt(k).label : k), rows: n.rows || [] })), memo: (st.memos || {}).ng || '' },
      gates: G.map(g => ({ label: g.label, hide: (g.hide || []).map(k => (opt(k) || {}).label || k), notes: g.notes || [] })),
      say: fix([words.length ? `저희는 '${words.join(' · ')}' 느낌의 집을 좋아해요(${blend}).` : `저희 취향은 ${blend}.`, ...(rent ? [] : ['CM1', 'CM3', 'CM4', 'KT1', 'BA1']).map(row).filter(r => r && r.rec && /^직접/.test(r.src)).map(r => `${r.area}은(는) ${r.rec.label}`).slice(0, 4).map(s => `${s}을(를) 생각하고 있어요.`),
        MU.length ? `꼭 하고 싶은 건 ${MU.map(x => x.label).join('·')}이에요.` : '', NG.length ? `${NG.map(x => x.label).join('·')}은(는) 피하고 싶어요.` : ''].filter(Boolean).join(' ')),
      notes: RP.notes, rows, detail: rows.filter(r => DETAIL.includes(r.dim) || r.dim === 'DOOR').map(r => ({ code: r.code, item: r.area, where: r.dim === 'DT1' || r.dim === 'DT2' || r.dim === 'DT6' ? '집 전체' : r.dim === 'DT3' ? '방문 전체' : r.zone !== '공통' ? r.zone : ((DATA.dims[r.dim] || {}).zones || []).filter(has).map(z => ZL[z]).join('·') || '공통',
        form: r.rec ? r.rec.label : r.est ? `추정: ${r.est}` : r.recText, finish: METAL.includes(r.dim) || r.dim === 'DOOR' ? metal || '—' : '—', qty: '—', when: [phase((r.rec || {}).spec), `${r.d} ${RP.dlabel[r.d]}`].filter(Boolean).join(' · '), src: r.src, status: r.status, spec: (r.rec || {}).spec || '' })),
      coord, temps, timeline: tl, talk: tk, budget: { top, swaps, reserve: RP.budget.reserve }, checks, lifeRows, mustRows: MU.flatMap(x => x.rows),
      grid: { picked: photos.slice(0, 12), rejected: [...new Set(log.filter(e => e.k >= 0 || e.k === -1).flatMap(e => e.o.filter((k, j) => j !== e.k && PHOTOS[k])))].slice(0, 12) },
      slow: slow.map(e => { const k = e.o[e.k], o = opt(k), id = k.split('.')[0]; return `${(DATA.dims[id] || {}).area || (DATA.screens[id] || {}).q || id}: ${o ? o.label || o.id : k}`; }), outside: nopeSec, askLater, scopeCust: CUST[scope] || [],
      credits, trend: RP.trend,
    };
  };

  // ── HTML ── (클래스만 쓰고 인라인 스타일 없음, 색 칩은 SVG rect)
  const chip = (hex, w = 24, h = 24) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(hex)}"><rect width="${w}" height="${h}" rx="4" fill="${esc(hex)}"/></svg>`;
  const mini = (r, c) => { const o = r.rec && opt(r.rec.key); return `<span class="rp-mini">${o && o.v ? E.vis(o.v, c) : r.chip ? chip(r.chip, 72, 54) : r.wall ? chip(r.wall, 72, 54) : ''}</span>`; };
  const sec = (h, body, cls = '') => `<section class="rp-sec${cls}"><h2 class="rp-h">${esc(h)}</h2>${body}</section>`;
  const ul = (a, cls = '') => a.length ? `<ul${cls ? ` class="${cls}"` : ''}>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const tbl = (head, body) => `<table class="rp-tbl"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const cost = c => esc(RP.cost[c] || '');
  const dup = r => r.rec.label.includes(brief(r.rec.spec)); // 사양 첫 구절이 이름과 같으면 한 번만
  const recCell = (r, pro) => r.rec ? `<b>${esc(r.rec.label)}</b>${r.rec.spec && !(dup(r) && !pro) ? `<br><small>${esc(pro ? r.rec.spec.replace(/^\[[^\]]+\]\s*/, '') : brief(r.rec.spec))}</small>` : ''}` : esc(r.recText);
  const legend = () => `<p><small>${Object.entries(RP.codes).map(([k, v]) => `${esc(k)} ${esc(v)}`).join(' · ')}</small></p><p><small>${Object.entries(RP.dlabel).map(([k, v]) => `${k} ${esc(v)}`).join(' · ')}</small></p>`;

  const html = (M, o = {}) => {
    const pro = !!o.pro, c = M.ctx, P = M.palette, rowOf = Object.fromEntries(M.rows.map(r => [r.code, r]));
    const customer = `<div class="rp">
${sec('우리 집 취향 리포트', `<p class="rp-one">${esc([M.head.name && `${M.head.name} 님`, M.head.date, M.head.zones.join('·')].filter(Boolean).join(' · '))}</p><p><small>결과 코드 ${esc(M.code)}${M.head.by ? ` · ${esc(M.head.by)}` : ''}${M.scope === 'rent' ? ' · 스타일링 리포트' : ''}</small></p>`)}
${sec('취향 한 줄', `<p class="rp-one">${esc([M.taste.words.join(' · '), M.taste.blend].filter(Boolean).join(' — '))}</p>${M.head.grade === GRADE.mixed ? '<p class="rp-one">여러 취향이 함께 있어요. 공간마다 다르게 가도 좋아요.</p>' : ''}<div class="rp-chips">${M.taste.words.map(w => `<span class="chip">${esc(w)}</span>`).join('')}<span class="chip">${esc(M.taste.label)}</span></div>`)}
${sec('취향 지도', `<div class="rp-map" data-me="${M.map.me.map(v => v.toFixed(1)).join(',')}" data-near="${esc(M.map.near.map(n => `${n.n}:${n.at.join(':')}`).join(','))}" aria-label="취향 지도"></div><ol>${M.map.near.map(n => `<li>${esc(n.name)}</li>`).join('')}</ol>`)}
${sec('분위기', `<div class="rp-chips">${M.moods.map(x => `<span class="rp-badge">${esc(x.label)}</span>`).join('')}</div>`)}
${sec('색 계획', `<div class="rp-pal"><svg viewBox="0 0 100 16" width="100%" height="32" preserveAspectRatio="none" role="img" aria-label="바탕 60 · 보조 30 · 포인트 10"><rect width="60" height="16" fill="${esc(P.base[0])}"/><rect x="60" width="30" height="16" fill="${esc(P.sub[0])}"/><rect x="90" width="10" height="16" fill="${esc(P.accent[0])}"/></svg>
${[['바탕', P.base], ['보조', P.sub], ['포인트', P.accent]].map(([l, a]) => `<span class="sw">${a.map(h => chip(h)).join('')}<small>${l}</small></span>`).join('')}<span class="sw">${chip(P.wall.hex)}<small>벽 바탕색 ${esc(P.wall.label)}</small></span></div>
<p><small>바탕 60 · 보조 30 · 포인트 10${P.north ? ' · 북향이라 한 톤 밝게' : ''}</small></p><div class="rp-chips">${P.avoid.map(a => `<span class="chip neg">${a.hex ? chip(a.hex, 16, 16) : E.vis((DATA.ng.find(n => n.id === a.ng) || {}).v || [], c).replace('<svg', '<svg width="24" height="18"')}${a.label ? esc(a.label) : '피할 색'}</span>`).join('')}</div>`)}
${sec('무드보드', `<div class="rp-mood">${M.board.map(b => b.img ? `<img src="img/${esc(b.img)}.webp" alt="${esc(b.alt)}" loading="lazy">` : `<span class="rp-mini" aria-label="${esc(b.label)}">${E.vis(opt(b.key).v, c)}</span>`).join('')}</div>`)}
${sec('공간별 한 줄', `<ul>${M.zones.map(z => `<li><b>${esc(z.zone)}</b>${z.est ? ' (추정)' : ''} ${esc(z.style)} 느낌${z.recs.length ? ` — ${esc(z.recs.join(', '))}` : ''}</li>`).join('')}</ul>`)}
${M.must.items.length || M.must.memo ? sec('꼭 하고 싶은 것', ul([...M.must.items.map(x => x.label), M.must.memo].filter(Boolean))) : ''}
${M.ng.items.length || M.ng.memo ? sec('피하고 싶은 것', `<div class="rp-chips">${[...M.ng.items.map(x => x.label), M.ng.memo].filter(Boolean).map(t => `<span class="chip neg">${esc(t)}</span>`).join('')}</div>`) : ''}
${M.scopeCust.length ? sec(M.scope === 'rent' ? '공사 없이 꾸미기' : M.scopeName, ul(M.scopeCust)) : ''}
${sec('업체에 이렇게 말해 보세요', `<p class="rp-one" data-copy>${esc(M.say)}</p>`)}
${sec('꼭 지킬 것', ul(M.notes))}
${sec('안내', `<p><small>화면 색은 실물과 달라요. 샘플로 확인하세요. 사진: ${esc(DATA.credits.by)} 외(${esc(DATA.credits.license)} 등, <a href="credits.html">출처 보기</a>). 결과 코드 ${esc(M.code)} · <a href="${esc(M.link)}">결과 다시 열기</a></small></p>`, ' noprint')}
</div>`;

    const H = M.head, T = M.taste;
    const rowTbl = rs => tbl(['견본', '코드', '실', '부위', '추천안', '절감안 / 상향안', '상담 때 보여 줄 안', '근거', '확신', '예산', '결정 시점', 'NG·확인', '메모'],
      rs.map(r => [mini(r, c), esc(r.code), esc(r.zone), esc(r.area), recCell(r, pro), `${esc(r.save)} / ${esc(r.up)}`, esc(r.show.join(' / ') || '—'), esc(`${r.src}${/^[A-Z]{2}\d/.test(r.dim) ? ` · ${r.dim}` : ''}`), esc(r.conf), cost(r.cost), esc(`${r.d} ${RP.dlabel[r.d]}`),
        [...r.ng.map(t => `<span class="rp-warn">${esc(t)}</span>`), ...r.site.map(esc)].join('<br>') || '—', esc([...r.memo, r.time && !r.memo.some(x => x.startsWith('공기')) && `공기 ${r.time}`].filter(Boolean).join(' / ') || '')]));
    const expert = `<div class="rp pro">
${sec('전문가 브리프', `<p class="rp-one">${esc([H.name || '응답자', H.date, H.mode, `v${M.dv}`].filter(Boolean).join(' · '))}</p>${tbl(['항목', '값'], [
      ['결과 코드', M.code], ['응답 시간', `${H.minutes}분 · 점수 화면 ${H.screens}개`], ['일관성 등급', `${H.grade}${H.flags.lift !== null ? ` (예측 적중 ${H.flags.lift.toFixed(2)})` : ''}`], ['패스 비율', `${H.pass}%`],
      ['공사 범위', `${M.scopeName}${H.matrix.length ? ` · ${H.matrix.join(', ')}` : ''}`], ['평형 · 인원 · 욕실', [H.size, H.people, H.baths].filter(Boolean).join(' · ') || '—'], ['가족 게이트', H.gates.join(', ') || '없음'],
      ['예산 성향 · 공사 기간', [H.budget, H.term].filter(Boolean).join(' · ') || '—'], ['결정권자', H.who || '—'], ['₩₩₩ 행 · 추가 공기', `${H.big}개 · +${H.extraDays}일`], ['업체', H.by || '—']].map(r => r.map(esc)))}`, ' pro')}
${sec('근거', `${tbl(['축', '값 ±1σ', '판단'], T.axes.map(a => [esc(a.name), `${a.m >= 0 ? '+' : ''}${a.m} ± ${a.sd}`, esc(a.clear)]))}
<p>${T.of20.map(s => `${esc(s.name)} 20번 중 ${s.n}번`).join(' · ')}</p>${M.outside.length ? `<p><span class="rp-badge">선택지 밖 취향 가능</span> ${esc(M.outside.join(', '))}에서 '다 별로예요' 3회 이상</p>` : ''}${M.slow.length ? `<p>고민한 선택: ${esc(M.slow.join(' · '))}</p>` : ''}${tbl(['태그', '값', '판단', '근거'], T.tags.map(t => [esc(`${t.label}(${t.word})`), `${t.m}`, esc(t.clear), esc(t.ev)]))}
${M.cards.some(z => z.diff.length) ? `<div class="rp-chips">${M.cards.flatMap(z => z.diff.map(d => `<span class="rp-badge">${esc(`${z.name}: ${d}`)}</span>`)).join('')}</div>` : ''}`, ' pro')}
${sec('NG · 필수 · 게이트', `${M.ng.items.map(n => `<p><span class="chip neg">${esc(n.label)}</span> 제외: ${esc(n.exclude.join(', '))}</p>${ul(n.rows)}`).join('')}${M.ng.memo ? `<p>메모: ${esc(M.ng.memo)}</p>` : ''}
${M.mustRows.length ? `<h3 class="rp-h">필수 요구(잠금 행)</h3>${ul(M.mustRows)}` : ''}${M.must.memo ? `<p>메모: ${esc(M.must.memo)}</p>` : ''}
${M.gates.map(g => `<p><b>${esc(g.label)}</b>${g.hide.length ? ` 제외: ${esc(g.hide.join(', '))}` : ''}</p>${ul(g.notes)}`).join('')}
${T.dislike.length ? `<p class="rp-warn">추정 비선호(확인 필요): ${esc(T.dislike.join(', '))}</p>` : ''}${!M.ng.items.length && !M.mustRows.length && !M.gates.length && !T.dislike.length ? '<p>해당 없음</p>' : ''}`, ' pro')}
${sec('셸 방향 + 조화 점검', `${rowTbl(M.rows.filter(r => r.sec === 'shell'))}<div>${M.coord.checks.filter(x => x.level !== 'memo').slice(0, 6).map(x => `<p class="${x.level === 'ok' ? 'rp-ok' : 'rp-warn'}">${esc(x.msg)}${x.why.length ? ` <small>(${esc(x.why.join(' ↔ '))})</small>` : ''}</p>`).join('') || '<p class="rp-ok">점검할 충돌이 없어요</p>'}</div>`, ' pro')}
${M.cards.map(z => `<section class="rp-sec rp-zone pro"><h2 class="rp-h">${esc(z.name)}${z.style ? ` <small>${esc(z.style)}</small>` : ''}</h2>${z.hotel ? `<p><span class="rp-badge">호텔 연출</span> ${esc(z.hotel)}</p>` : ''}${z.diff.length ? `<p>${esc(z.diff.join(' · '))}</p>` : ''}
${rowTbl(z.rows.map(k => rowOf[k]))}${z.warn.map(w => `<p class="rp-warn">${esc(w)}</p>`).join('')}${ul(z.notes)}</section>`).join('\n')}
${sec('디테일 선정표', `${tbl(['품목', '위치', '형태', '마감', '수량(추정)', '결정 시점', '근거', '상태'], M.detail.map(d => [esc(d.item), esc(d.where), esc(d.form) + (pro && d.spec ? `<br><small>${esc(d.spec.replace(/^\[[^\]]+\]\s*/, ''))} (2026.10 기준)</small>` : ''), esc(d.finish), esc(d.qty), esc(d.when), esc(d.src), esc(d.status)]))}
<p>색온도: ${esc(Object.entries(M.temps).map(([k, v]) => k === 'main' ? v : `${k} ${v}`).join(' · '))}</p>${M.coord.once.length ? `<p class="rp-warn">스마트 스위치 확인: ${esc(M.coord.once.join(' · '))}</p>` : ''}${M.coord.alt.length ? `<p class="rp-warn">${esc(M.coord.alt.join(' '))}</p>` : ''}`, ' pro')}
${sec('결정 타임라인', `<ol class="rp-tl">${M.timeline.map(t => `<li><b>${t.d} ${esc(t.label)}</b>${M.scope === 'newbuild' && t.d === 'D0' ? ' <small>(입주일 기준)</small>' : ''}${ul([...t.plan, ...t.rows, ...t.base])}</li>`).join('')}</ol>`, ' pro')}
${sec('토킹포인트', `<ol class="rp-talk">${M.talk.map(t => `<li>${esc(t.say)}</li>`).join('') || '<li>특이 사항 없음</li>'}</ol>`, ' pro')}
${sec('예산', `<p>비용 상승 상위 ${M.budget.top.length}</p>${ul(M.budget.top.map(k => `${k} ${rowOf[k].zone} ${rowOf[k].area}: ${rowOf[k].recText} (${RP.cost[rowOf[k].cost]})`))}
<p>절감안</p>${ul(M.budget.swaps.map(s => `${s.from} → ${s.to}${s.hit ? ' (이번 선택에 해당)' : ''}`))}<p>예비비 ${M.budget.reserve.join('~')}%</p>`, ' pro')}
${sec('현장 확인', `${ul(M.checks)}${M.lifeRows.map(l => `<p><b>${esc(l.q)}</b> ${esc(l.a)}</p>${ul(l.rows)}`).join('')}${M.askLater.length ? `<p><b>상담 때 확인</b></p>${ul(M.askLater)}` : ''}${M.scope !== 'remodel' ? `<p><b>${esc(M.scopeName)}</b></p>${ul(M.scopeRows)}` : ''}`, ' pro')}
${sec('메모', `<p data-memo="${esc(M.code)}">&nbsp;</p><div class="rp-mood">${[...M.grid.picked.map(id => [id, '고름']), ...M.grid.rejected.map(id => [id, '거절'])].slice(0, 9).map(([id, t]) => `<img src="img/${esc(id)}.webp" alt="${esc(`${t}: ${PHOTOS[id].alt || ''}`)}" loading="lazy">`).join('')}</div>
<p><small>트렌드 메모(${esc(M.trend.date)}): ${esc(M.trend.words.map(w => w.say).join(' · '))} · ${esc(M.trend.metals)}</small></p><p><small>사진 출처: ${M.credits.map(x => `${esc(x.id)} ${esc(x.by)} (${esc(x.license)})`).join(' · ') || esc(DATA.credits.by)}</small></p>`, ' pro')}
${sec('마감재 선정표 초안', `${rowTbl(M.rows)}${legend()}`, ' pro')}
</div>`;
    return { customer, expert };
  };

  // ── CSV(BOM, 열 고정) · JSON ──
  const cell = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const line = a => [...a, ...Array(COLS.length).fill('')].slice(0, COLS.length).map(cell).join(',');
  const csv = M => '﻿' + [line(COLS), ...M.rows.map(r => line([r.code, r.zone, r.area, r.trade, r.range, r.rec ? `${r.rec.label}${r.rec.spec && !dup(r) ? ` — ${brief(r.rec.spec)}` : ''}` : r.recText, r.save, r.up, r.show.join(' / '), `${r.src}${/^[A-Z]{2}\d/.test(r.dim) ? ` · ${r.dim}` : ''}`, r.conf,
    r.irr, RP.cost[r.cost], r.time, `${r.d} ${RP.dlabel[r.d]}`, r.qty, r.site.join(' / '), r.ng.join(' / '), '', '☐', r.memo.join(' / ')])), line([]), line(['코드 범례']), ...Object.entries(RP.codes).map(e => line(e)), ...Object.entries(RP.dlabel).map(e => line(e))].join('\r\n');
  const json = (st, M) => ({ v: 4, dv: DATA.v, r: E.encode(st), code: M.code, firm: st.by || '', ng: { ids: st.ng || [], memo: (st.memos || {}).ng || '' }, must: { ids: st.must || [], memo: (st.memos || {}).must || '' },
    edits: st.edits || {}, site: st.site || {}, memos: st.memos || {}, details: M.detail.map(d => ({ zone: d.where, category: d.item, choice: d.form, finish: d.finish, phase: d.when, spec: d.spec, status: d.status })),
    checks: M.coord.checks.map(x => ({ rule: x.rule, level: x.level, message: x.msg })), rows: M.rows });

  return { build, html, csv, json, COLS };
})();

if (typeof module !== 'undefined') module.exports = R;
