// 사진으로 구하기 어려운 선택지(마감·패턴·도면)를 SVG로 그리는 견본 생성기.
// 모든 함수는 viewBox 0 0 120 90(4:3) SVG 문자열을 돌려줌 → 선택 카드(.ph)에 그대로 넣음.
const V = (() => {
  const svg = (body, defs = '') => `<svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
  let uid = 0; // 한 화면에 여러 SVG가 있어도 gradient/pattern id가 겹치지 않게
  const id = p => `${p}${++uid}`;
  const rnd = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; // 항상 같은 무늬가 나오도록 고정 시드

  // ── 금속 마감: 수전 실루엣에 금속 그라디언트 ──
  const METALS = {
    chrome: ['#f7f9fa', '#9aa3ab', '#eef1f3', '#5f6870', '#e2e6e9'],
    black: ['#4a4a4a', '#262626', '#383838', '#1a1a1a', '#303030'],
    gold: ['#efd9a6', '#c9a35b', '#e6c88a', '#a8823f', '#d9b877'],
    gunmetal: ['#7a7e82', '#4a4e52', '#686c70', '#34383b', '#5c6064'],
    nickel: ['#dedcd6', '#aaa7a0', '#cfccc6', '#8f8c86', '#c2bfb9'],
    rosegold: ['#f0c8b4', '#c98b6d', '#e8b49b', '#a96f55', '#dba48b'],
    brass: ['#d6b878', '#8f6c30', '#c09a56', '#5f4721', '#a8843f'], // 앤틱 브라스: 골드보다 갈색·어둡게 (160px에서 구별)
    white: ['#f4f3f0', '#dcdad5', '#eeece8', '#cfccc6', '#e6e4df'], // 화이트 무광 금속(브러시드 결 없음)
  };
  const metal = finish => {
    const g = id('m'), c = METALS[finish] || METALS.chrome, brushed = finish === 'gold' || finish === 'nickel' || finish === 'gunmetal';
    const stops = c.map((s, k) => `<stop offset="${k / (c.length - 1)}" stop-color="${s}"/>`).join('');
    const lines = brushed ? Array.from({ length: 14 }, (_, k) => `<line x1="${50 + k * 1.4}" y1="22" x2="${50 + k * 1.4}" y2="74" stroke="#fff" stroke-opacity=".07"/>`).join('') : '';
    return svg(`
      <rect width="120" height="90" fill="#F3F0EB"/>
      <rect x="10" y="72" width="100" height="18" rx="4" fill="#FFFFFF"/><rect x="10" y="72" width="100" height="2" fill="#E6E1D9"/>
      <g fill="url(#${g})">
        <rect x="49" y="66" width="22" height="7" rx="2"/>
        <rect x="54" y="34" width="12" height="33" rx="3"/>
        <path d="M64 37 H84 Q89 37 89 42 V48 H83.5 V43 H64 Z"/>
        <rect x="52" y="30" width="18" height="4.6" rx="2.3" transform="rotate(-12 55 32)"/>
      </g>${lines}`,
      `<linearGradient id="${g}" x1="0" x2="1">${stops}</linearGradient>`);
  };

  // ── 타일·바닥 패턴 ──
  // o: { layout: grid|stack|subway|herringbone|chevron|hex|terrazzo|marble, w, h (판 크기 비율, 예 60x120 → w:2 h:4), color, grout, scale }
    // ── 타일·바닥 패턴 ──
    // o: { layout: grid|stack|subway|herringbone|chevron|hex|terrazzo|marble|solid|travertine|concrete|checker(= grid 1.33 흑백 별칭), w, h (판 크기 비율, 예 60x120 → w:2 h:4), color, grout, scale,
    //      colors: [a, b] (판마다 교대), vary (판 명도 편차, 기본 14), sheen: matte|satin|polished, chips, chipSize: [최소, 최대] (테라조 입자 크기, 기본 [0.6, 2.8]), vein, slab }
    const tile = (o = {}) => {
      if (o.layout === 'checker') o = { w: 1.33, h: 1.33, colors: ['#EFEBE4', '#4A4744'], ...o, layout: 'grid' }; // 마무리 칩 'vintage'용 체커 별칭
      const { layout = 'grid', color = '#E9E4DC', grout = '#CFC7BB', w = 2, h = 2, colors, sheen = 'matte' } = o;
      const u = o.scale || 9, cl = id('c'), vary = o.vary ?? 14;
      let body = '', defs = `<clipPath id="${cl}"><rect width="120" height="90"/></clipPath>`;
      const rect = (x, y, rw, rh, f = color) => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="${f}" stroke="${grout}" stroke-width=".6"/>`;
      const shade = (r, i = 0) => shift(colors ? colors[(i & 1) % colors.length] : color, Math.round((r() - 0.5) * vary)); // i 홀짝으로 두 색을 번갈아
      const r = rnd(7);
      // 고운 입자: feTurbulence 소음을 회색으로 깔아 a 만큼만 비침
      const grain = (freq, oct, a, seed) => { const f = id('n'); defs += `<filter id="${f}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}"/><feColorMatrix type="saturate" values="0"/></filter>`; return `<rect width="120" height="90" filter="url(#${f})" opacity="${a}"/>`; };
      if (layout === 'grid' || layout === 'stack' || layout === 'subway') {
        const tw = w * u, th = h * u;
        for (let row = -1; row * th < 90 + th; row++)
          for (let col = -2; col * tw < 120 + tw; col++)
            body += rect(col * tw + (layout === 'subway' && row % 2 ? tw / 2 : 0), row * th, tw, th, shade(r, row + col));
      } else if (layout === 'herringbone') {
        // 판 L×W, 격자 벡터 (W,W)·(L,-L), 칸마다 가로판 1 + 세로판 1 → 45° 회전
        const W = (o.w || 1) * u * 0.55, L = (o.h || 4) * u * 0.55;
        for (let i = -20; i < 20; i++) for (let j = -8; j < 8; j++) {
          const x = i * W + j * L, y = i * W - j * L;
          body += rect(x, y, L, W, shade(r, 0)) + rect(x + L, y + W - L, W, L, shade(r, 1));
        }
        body = `<g transform="translate(60 45) rotate(45)">${body}</g>`;
      } else if (layout === 'chevron') {
        const cw = (o.w || 2) * u * 0.7, ch = (o.h || 1) * u * 0.7;
        for (let c = -1; c * cw < 120 + cw; c++) for (let row = -3; row * ch < 90 + 2 * cw; row++) {
          const x = c * cw, y = row * ch, up = c % 2 === 0;
          const pts = up ? [[x, y + cw], [x + cw, y], [x + cw, y + ch], [x, y + cw + ch]] : [[x, y], [x + cw, y + cw], [x + cw, y + cw + ch], [x, y + ch]];
          body += `<polygon points="${pts.map(p => p.map(n => n.toFixed(2)).join(',')).join(' ')}" fill="${shade(r, c + row)}" stroke="${grout}" stroke-width=".6"/>`;
        }
      } else if (layout === 'hex') {
        const s = (o.w || 1) * u * 0.6, hw = Math.sqrt(3) * s;
        for (let row = -1; row * 1.5 * s < 95; row++) for (let col = -1; col * hw < 125; col++) {
          const cx = col * hw + (row % 2 ? hw / 2 : 0), cy = row * 1.5 * s;
          const pts = Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 180 * (60 * k - 30); return `${(cx + s * Math.cos(a)).toFixed(2)},${(cy + s * Math.sin(a)).toFixed(2)}`; });
          body += `<polygon points="${pts.join(' ')}" fill="${shade(r, row + col)}" stroke="${grout}" stroke-width=".6"/>`;
        }
      } else if (layout === 'terrazzo') {
        body = `<rect width="120" height="90" fill="${color}"/>`;
        const chips = o.chips || ['#B9A58A', '#8C8C86', '#D8CFC2', '#6E6A64', '#C98F6B'], [lo, hi] = o.chipSize || [0.6, 2.8];
        for (let k = 0; k < (o.chipSize ? 720 : 260); k++) { // 입자가 잘수록 더 많이 뿌려 같은 밀도로
          const x = r() * 120, y = r() * 90, s = lo + r() * (hi - lo), f = chips[Math.floor(r() * chips.length)];
          const pts = Array.from({ length: 5 }, (_, q) => { const a = q * 1.26 + r(); const rr = s * (0.6 + r() * 0.6); return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`; });
          body += `<polygon points="${pts.join(' ')}" fill="${f}"/>`;
        }
      } else if (layout === 'marble') {
        body = `<rect width="120" height="90" fill="${color}"/>`;
        const vein = o.vein || '#9C9A96';
        for (let k = 0; k < 7; k++) {
          let x = r() * 120, y = -5, d = `M${x.toFixed(1)} ${y}`;
          while (y < 95) { const nx = x + (r() - 0.5) * 30, ny = y + 8 + r() * 14; d += ` Q${((x + nx) / 2 + (r() - 0.5) * 12).toFixed(1)} ${((y + ny) / 2).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`; x = nx; y = ny; }
          body += `<path d="${d}" fill="none" stroke="${vein}" stroke-opacity="${(0.25 + r() * 0.45).toFixed(2)}" stroke-width="${(0.3 + r() * 1.4).toFixed(2)}"/>`;
        }
      } else if (layout === 'solid') { // 단색 상판: 입자 + 좌상→우하 빛 falloff (광택 띠는 넣지 않음: 광택 단서가 됨)
        const lit = id('sl');
        defs += `<linearGradient id="${lit}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".06"/></linearGradient>`;
        body = `<rect width="120" height="90" fill="${color}"/>` + grain(0.9, 1, 0.08, 2) + `<rect width="120" height="90" fill="url(#${lit})"/>`;
      } else if (layout === 'travertine') { // 가로 물결 결 9줄(간격 10u, 진폭 1.5u) + 길쭉한 기공
        body = `<rect width="120" height="90" fill="${color}"/>`;
        const vein = shift(color, -14), pore = shift(color, -38);
        for (let k = 0; k < 9; k++) {
          const y = 5 + k * 10 + (r() - 0.5) * 2, a = 3 * (0.7 + r() * 0.5) * (r() < 0.5 ? -1 : 1); // 제어점 3 → 실제 진폭 1.5, 줄마다 위상·방향이 달라 물결이 정렬되지 않게
          const d = `M${(-2 - r() * 40).toFixed(1)} ${y.toFixed(1)}q10 ${a.toFixed(1)} 20 0${`t20 0`.repeat(8)}`;
          body += `<path d="${d}" fill="none" stroke="${shift(color, 8)}" stroke-opacity=".5" stroke-width="${(2.4 + r() * 1.6).toFixed(1)}"/><path d="${d}" fill="none" stroke="${vein}" stroke-opacity=".5" stroke-width="${(0.6 + r() * 0.8).toFixed(1)}" stroke-dasharray="${(18 + r() * 40).toFixed(0)} ${(2 + r() * 8).toFixed(0)}"/>`;
        }
        for (let k = 0; k < 60; k++) body += `<ellipse cx="${(r() * 120).toFixed(1)}" cy="${(r() * 90).toFixed(1)}" rx="${(0.6 + r() * 1.8).toFixed(1)}" ry="${(0.25 + r() * 0.45).toFixed(1)}" fill="${pore}" fill-opacity="${(0.35 + r() * 0.3).toFixed(2)}"/>`;
      } else if (layout === 'concrete') { // 거친 콘크리트: 고운 입자 + 얼룩 + 기공 30개
        body = `<rect width="120" height="90" fill="${color}"/>` + grain(0.04, 3, 0.2, 5) + grain(0.9, 2, 0.08, 3);
        const pore = shift(color, -44);
        for (let k = 0; k < 30; k++) { const x = (r() * 120).toFixed(1), y = (r() * 90).toFixed(1), s = 0.35 + r() * 0.75; body += `<circle cx="${x}" cy="${y}" r="${s.toFixed(2)}" fill="${pore}" fill-opacity="${(0.4 + r() * 0.3).toFixed(2)}"/><circle cx="${x}" cy="${(+y + s * 0.5).toFixed(2)}" r="${(s * 0.55).toFixed(2)}" fill="#fff" fill-opacity=".18"/>`; }
      }
      if (o.slab && ['marble', 'solid', 'travertine', 'concrete'].includes(layout)) body += `<line x1="60" y1="0" x2="60" y2="90" stroke="${grout}" stroke-width=".5"/>`; // 판석 이음선
      // 광택(원칙 15): matte = 없음, polished = 대각 반사 띠 2줄 + 부드러운 반사 타원, satin = polished 의 .45배
      const k = sheen === 'polished' ? 1 : sheen === 'satin' ? 0.45 : 0;
      if (k) {
        const g = id('sg'), d = id('sd'), b = id('sb'), st = (c, a) => a.map(([s, p]) => `<stop offset="${s}" stop-color="${c}" stop-opacity="${p}"/>`).join('');
        // 흰 반사는 흰 타일에서 안 보여서, 같은 방향으로 어두운 반사(창틀·천장 모서리)를 얕게 곁들임
        defs += `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">${st('#fff', [[0, 0], [0.3, 0], [0.42, 0.38], [0.5, 0], [0.62, 0.14], [0.7, 0]])}</linearGradient>` +
          `<linearGradient id="${d}" x1="0" y1="0" x2="1" y2="1">${st('#46505A', [[0.48, 0], [0.54, 0.1], [0.6, 0], [0.78, 0], [0.84, 0.07], [0.9, 0]])}</linearGradient>` +
          `<filter id="${b}" x="-50%" y="-150%" width="200%" height="400%"><feGaussianBlur stdDeviation="2"/></filter>`;
        body += `<g opacity="${k}"><rect width="120" height="90" fill="url(#${d})"/><rect width="120" height="90" fill="url(#${g})"/><ellipse cx="84" cy="30" rx="18" ry="6" fill="#fff" fill-opacity=".25" filter="url(#${b})"/></g>`;
      }
      return svg(`<g clip-path="url(#${cl})">${body}</g>`, defs);
    };

  // ── 나무 톤: 마루판 + 결 ──
  const WOODS = { whiteoak: '#E6D7BE', oak: '#D1B38A', ash: '#E2D6C3', teak: '#A97B4F', walnut: '#6E4C36', smoked: '#5B4737', greywash: '#B9B1A5' };
    // ── 나무 톤: 마루판 + 결 ── o: { plank: 판 크기 배율 (기본 1 = 60×11.25u, 1.6 = 광폭 72×18u) }
    const wood = (tone, o = {}) => {
      if (Array.isArray(tone)) [tone, o = {}] = tone; // 견본 하네스는 인자를 하나만 넘겨서 [tone, o] 묶음도 받음
      const base = WOODS[tone] || tone, k = o.plank || 1, r = rnd(11), cl = id('c'), L = 60 * k, H = 11.25 * k, f = v => +v.toFixed(2);
      let body = '';
      for (let row = 0; row * H < 90; row++) {
        const y = row * H, off = (row * 37 * k) % L;
        for (let x = -off; x < 120; x += L) {
          const c = shift(base, Math.round((r() - 0.5) * 16));
          body += `<rect x="${f(x)}" y="${f(y)}" width="${f(L)}" height="${f(H)}" fill="${c}" stroke="${shift(base, -28)}" stroke-width=".4"/>`;
          for (let g = 0; g < Math.round(3 * k); g++) {
            const gy = y + 2 * k + r() * 7.5 * k;
            body += `<path d="M${f(x)} ${gy.toFixed(1)} q${f(15 * k)} ${((r() - 0.5) * 3).toFixed(1)} ${f(30 * k)} 0 t${f(30 * k)} 0" fill="none" stroke="${shift(base, -18)}" stroke-opacity=".35" stroke-width=".35"/>`;
          }
        }
      }
      return svg(`<g clip-path="url(#${cl})">${body}</g>`, `<clipPath id="${cl}"><rect width="120" height="90"/></clipPath>`);
    };

  // ── 조명 색온도: 켈빈 → RGB 근사 (Tanner Helland) 로 방을 비춤 ──
  const rgbK = k => {
    const t = k / 100, cl = v => Math.max(0, Math.min(255, v));
    return [t <= 66 ? 255 : cl(329.698727446 * Math.pow(t - 60, -0.1332047592)),
      t <= 66 ? cl(99.4708025861 * Math.log(t) - 161.1195681661) : cl(288.1221695283 * Math.pow(t - 60, -0.0755148492)),
      t >= 66 ? 255 : t <= 19 ? 0 : cl(138.5177312231 * Math.log(t - 10) - 305.0447927307)];
  };
  // 5600K를 흰색으로 보정 → 6500K는 살짝 푸르게, 3000K는 노랗게 (눈이 보는 상대적 차이)
  const kelvin = k => {
    const w = rgbK(5600), q = rgbK(k).map((v, i) => v / w[i]), m = Math.max(...q);
    return `rgb(${q.map(v => Math.round((255 * v) / m)).join(',')})`;
  };
  const light = k => {
    const g = id('l'), c = kelvin(k);
    return svg(`
      <rect width="120" height="62" fill="#F2F0EC"/><rect y="62" width="120" height="28" fill="#D9CFC2"/>
      <rect x="22" y="44" width="60" height="18" rx="4" fill="#BDB6AC"/><rect x="18" y="40" width="10" height="22" rx="3" fill="#B2AA9F"/><rect x="76" y="40" width="10" height="22" rx="3" fill="#B2AA9F"/>
      <rect x="92" y="30" width="3" height="32" fill="#8E877D"/><path d="M86 30 h15 l-3 -10 h-9 z" fill="#E9E4DC"/>
      <rect width="120" height="90" fill="url(#${g})" style="mix-blend-mode:multiply"/>`,
      `<radialGradient id="${g}" cx="78%" cy="28%" r="90%"><stop offset="0" stop-color="${c}" stop-opacity=".8"/><stop offset="1" stop-color="${c}" stop-opacity=".45"/></radialGradient>`);
  };

  // ── 도면형 그림 ──
  const INK = '#5F5850', FILL = '#D9CFC2', GLASS = '#CFE0E6';
  const room = (inner, wall = '#F7F4EF') => svg(`<rect width="120" height="90" fill="${wall}"/>${inner}`);
  const PLANS = {
    // 주방 평면 (위에서 본 모습). 바깥 사각형 = 주방 벽
    'kitchen-straight': `<rect x="15" y="12" width="90" height="66" fill="none" stroke="${INK}" stroke-width="1.5"/><rect x="18" y="15" width="84" height="13" fill="${FILL}"/>`,
    'kitchen-l': `<rect x="15" y="12" width="90" height="66" fill="none" stroke="${INK}" stroke-width="1.5"/><rect x="18" y="15" width="84" height="13" fill="${FILL}"/><rect x="18" y="28" width="13" height="40" fill="${FILL}"/>`,
    'kitchen-u': `<rect x="15" y="12" width="90" height="66" fill="none" stroke="${INK}" stroke-width="1.5"/><rect x="18" y="15" width="84" height="13" fill="${FILL}"/><rect x="18" y="28" width="13" height="40" fill="${FILL}"/><rect x="89" y="28" width="13" height="40" fill="${FILL}"/>`,
    'kitchen-parallel': `<rect x="15" y="12" width="90" height="66" fill="none" stroke="${INK}" stroke-width="1.5"/><rect x="18" y="15" width="84" height="13" fill="${FILL}"/><rect x="18" y="62" width="84" height="13" fill="${FILL}"/>`,
    'kitchen-island': `<rect x="15" y="12" width="90" height="66" fill="none" stroke="${INK}" stroke-width="1.5"/><rect x="18" y="15" width="84" height="13" fill="${FILL}"/><rect x="36" y="46" width="48" height="15" rx="1" fill="${FILL}" stroke="${INK}" stroke-width=".6"/>`,
    'kitchen-facing': `<rect x="15" y="12" width="90" height="66" fill="none" stroke="${INK}" stroke-width="1.5"/><rect x="18" y="15" width="84" height="13" fill="${FILL}"/><rect x="18" y="52" width="66" height="13" fill="${FILL}" stroke="${INK}" stroke-width=".6"/><text x="60" y="84" font-size="6" fill="${INK}" text-anchor="middle">거실 쪽</text>`,
    // 샤워 공간 평면
    'shower-booth': `<rect x="12" y="10" width="96" height="70" fill="none" stroke="${INK}" stroke-width="1.5"/><rect x="70" y="13" width="35" height="35" fill="${GLASS}" fill-opacity=".5" stroke="${INK}" stroke-width=".8"/><circle cx="96" cy="22" r="2.5" fill="${INK}"/><ellipse cx="30" cy="66" rx="9" ry="7" fill="#fff" stroke="${INK}" stroke-width=".8"/>`,
    'shower-partition': `<rect x="12" y="10" width="96" height="70" fill="none" stroke="${INK}" stroke-width="1.5"/><line x1="70" y1="13" x2="70" y2="50" stroke="#7FA7B5" stroke-width="2"/><circle cx="96" cy="22" r="2.5" fill="${INK}"/><ellipse cx="30" cy="66" rx="9" ry="7" fill="#fff" stroke="${INK}" stroke-width=".8"/>`,
    'shower-bathtub': `<rect x="12" y="10" width="96" height="70" fill="none" stroke="${INK}" stroke-width="1.5"/><rect x="15" y="13" width="62" height="26" rx="10" fill="#fff" stroke="${INK}" stroke-width=".8"/><ellipse cx="30" cy="66" rx="9" ry="7" fill="#fff" stroke="${INK}" stroke-width=".8"/>`,
    'shower-tub-partition': `<rect x="12" y="10" width="96" height="70" fill="none" stroke="${INK}" stroke-width="1.5"/><rect x="15" y="13" width="62" height="26" rx="10" fill="#fff" stroke="${INK}" stroke-width=".8"/><line x1="50" y1="40" x2="50" y2="58" stroke="#7FA7B5" stroke-width="2"/><ellipse cx="30" cy="66" rx="9" ry="7" fill="#fff" stroke="${INK}" stroke-width=".8"/>`,
  };
  const plan = name => room(PLANS[name] || '');

  // 중문 (현관 쪽에서 본 입면). o: { type: one-sliding|three-sliding|swing|double-swing|arch, frame, glass: clear|bronze|satin|fluted }
  // 중문 (현관 쪽에서 본 입면). 유리 뒤로 거실 실루엣(소파·창)이 비쳐 유리 종류가 구별됨.
  // o: { type: one-sliding|three-sliding|swing|double-swing|arch|none(개구부), frame: #hex·METALS 키(안쪽 가장자리 흰 하이라이트)·'wood:톤'(길이 방향 결 선; WOODS 값과 같은 맨 hex도 우드), fw: 문짝 프레임 선 두께 u(기본 1.6),
  //      glass: clear|bronze|satin|fluted|mix(위 2/3 맑음 + 아래 1/3 줄무늬), div: 'arch-grid'(아치 r30 + 2×4 격자) }
  const door = (o = {}) => {
    const { type: t = 'one-sliding', frame = '#2B2B2B', fw = 1.6, glass = 'clear', div } = o;
    const type = div === 'arch-grid' ? 'arch' : String(t).replace(/-/g, ''), arch = type === 'arch', none = type === 'none', f = n => +n.toFixed(2);
    // 우드 틀 = 'wood:톤' 또는 WOODS 값과 같은 맨 hex(데이터가 $wood를 그대로 넘겨도 우드로 읽음) → 단색 + 부재 길이 방향 결 선(아래 rim)
    // shortcut: WOODS와 같은 hex면 비우드 색도 우드로 그림(벽색 후보와는 안 겹침 확인), 데이터가 항상 'wood:<hex>'를 넘기게 되면 맨 hex 분기를 지운다
    const wd = typeof frame === 'string' && (frame.startsWith('wood:') ? WOODS[frame.slice(5)] || frame.slice(5) : Object.values(WOODS).find(h => h.toLowerCase() === frame.toLowerCase()));
    const F = paint(wd || frame, id('df')), cv = id('dv'), cs = id('ds'), fl = id('dfl'), ar = id('ar');
    const X0 = 16.4, X1 = 103.6, Y0 = 12, Y1 = 82, H = Y1 - Y0, W = X1 - X0, sp = X0 + W * .6, th = W / 3, mid = (X0 + X1) / 2;
    // 틀(바깥 14~106 × 9~84, 위 3u·옆 2.4u·아래 2u 고리)과 그 안쪽 = 유리·거실이 보이는 칸. 아치는 폭 60 r30
    const out = arch ? 'M30 84V40a30 30 0 0 1 60 0V84Z' : 'M14 9H106V84H14Z', inn = arch ? 'M32.4 82V40a27.6 27.6 0 0 1 55.2 0V82Z' : none ? 'M14.5 9.5H105.5V84H14.5Z' : `M${X0} ${Y0}H${X1}V${Y1}H${X0}Z`;
    const clp = arch ? 'M32.1 82.3V40a27.9 27.9 0 0 1 55.8 0V82.3Z' : none ? inn : `M${X0 - .3} ${Y0 - .3}H${X1 + .3}V${Y1 + .3}H${X0 - .3}Z`; // 유리·거실 칸 클립: 틀 밑으로 0.3 파고듦
    // 틀 위 덧그림: 우드 = 부재마다 길이 방향 결 2~3줄(살짝 휘고 길이·시작이 제각각, 모서리 이음선 안쪽에서 끝남; 160px에서 보이도록 결 색은 shift −46 α .75), 금속 = 안쪽 가장자리 흰 하이라이트(.6u)
    const rr = rnd(17), ps = n => Array.from({ length: n }, (_, k) => (k + 1) / (n + 1));
    const gl = (a, b, c, v) => { // a = 선 위치, b~c = 부재의 길이 방향 범위
      const s = f(b + 1 + rr() * 12), e = f(c - 1 - rr() * 12), m = f((s + e) / 2), p = f(a), q = f(a + (rr() - .5) * .5);
      return v ? `M${p} ${s}Q${q} ${m} ${p} ${e}` : `M${s} ${p}Q${m} ${q} ${e} ${p}`;
    };
    const rim = none ? '' : wd ? `<path d="${(arch
      ? ps(2).flatMap(p => [30 + 2.4 * p, 90 - 2.4 * p].map(x => gl(x, 40, 84 - 2 * p, 1)).concat(`M${f(30 + 2.4 * p)} 40A${f(30 - 2.4 * p)} ${f(30 - 2.4 * p)} 0 0 1 ${f(90 - 2.4 * p)} 40`))
      : [...ps(3).map(p => gl(9 + 3 * p, 14 + 2.4 * p, 106 - 2.4 * p)), ...ps(2).map(p => gl(84 - 2 * p, 14 + 2.4 * p, 106 - 2.4 * p)), ...ps(2).flatMap(p => [14 + 2.4 * p, 106 - 2.4 * p].map(x => gl(x, 9 + 3 * p, 84 - 2 * p, 1)))]).join('')}" fill="none" stroke="${shift(wd, -46)}" stroke-opacity=".75" stroke-width=".5"/>`
      : METALS[frame] ? `<path d="${clp}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".6"/>` : '';
    // [유리 칸 [왼쪽 x, 오른쪽 x]들, 불투명 고정판들]
    const [panes, solids] = {
      onesliding: [[[X0, sp]], [[sp, X1]]], swing: [[[X0, sp]], [[sp, X1]]],
      threesliding: [[[X0, X0 + th], [X0 + th, X0 + 2 * th], [X0 + 2 * th, X1]], []], doubleswing: [[[X0, mid], [mid, X1]], []],
      arch: [[[32.4, 87.6]], []], none: [[], []],
    }[type] || [[[X0, sp]], [[sp, X1]]];
    const G = { clear: ['#CFE0E6', .55], bronze: ['#B79C82', .75], satin: ['#E8ECEC', .72], fluted: ['#D7E3E6', .78] };
    const zones = panes.flatMap(([a, b]) => glass === 'mix'
      ? [{ x: a, y: Y0, w: b - a, h: H * 2 / 3, k: 'clear' }, { x: a, y: Y0 + H * 2 / 3, w: b - a, h: H / 3, k: 'fluted' }]
      : [{ x: a, y: Y0, w: b - a, h: H, k: G[glass] ? glass : 'clear' }]);
    const R = z => `<rect x="${f(z.x)}" y="${f(z.y)}" width="${f(z.w)}" height="${f(z.h)}"`;
    // 문 뒤 거실 실루엣: 창 #DCE8EE · 소파 #9C948A · 스탠드. 바깥으로 넉넉히 깔아 블러 가장자리가 안 비침
    const view = () => '<rect x="4" y="0" width="112" height="96" fill="#F1ECE3"/><rect x="4" y="68" width="112" height="28" fill="#E3D9C9"/><rect x="4" y="67.4" width="112" height="1" fill="#D3C8B6"/>'
      + '<rect x="28" y="19" width="30" height="27" fill="#DCE8EE"/><rect x="42.4" y="19" width="1.2" height="27" fill="#fff" fill-opacity=".85"/><rect x="26.6" y="46" width="32.8" height="1.6" fill="#E6E0D6"/>'
      + '<g fill="#9C948A"><rect x="24" y="52" width="38" height="13" rx="4.5"/><rect x="21" y="58" width="44" height="14" rx="3.5"/><rect x="19" y="55" width="7" height="17" rx="3.5"/><rect x="60" y="55" width="7" height="17" rx="3.5"/><rect x="23" y="72" width="2" height="3"/><rect x="61" y="72" width="2" height="3"/></g>'
      + '<rect x="87.2" y="40" width="1.4" height="35" fill="#B9B1A5"/><path d="M81 40h14l-2.6 -11h-8.8z" fill="#E9E4DC"/><ellipse cx="88" cy="75.4" rx="4.5" ry="1.2" fill="#B9B1A5"/>';
    const blurZ = zones.filter(z => z.k === 'satin' || z.k === 'fluted'); // 블러로 비치는 칸: satin 전체 = 번짐, fluted = 가로로만 번짐(세로결)
    const streak = z => { const x = z.x + .1 * z.w + 3, tr = Math.min(.55 * z.h, .8 * z.w - 6); return `<path d="M${f(x)} ${f(z.y + z.h)}h4.4L${f(x + 4.4 + tr)} ${f(z.y)}h-4.4Z" fill="#fff" fill-opacity=".34"/><path d="M${f(x + 8)} ${f(z.y + z.h)}h1.8L${f(x + 9.8 + tr)} ${f(z.y)}h-1.8Z" fill="#fff" fill-opacity=".42"/>`; }; // 대각 반사선
    const ribs = z => Array.from({ length: Math.floor(z.w / 2.2) }, (_, k) => `<line x1="${f(z.x + 1.1 + k * 2.2)}" y1="${f(z.y)}" x2="${f(z.x + 1.1 + k * 2.2)}" y2="${f(z.y + z.h)}" stroke="#fff" stroke-opacity=".7" stroke-width=".6"/>`).join('');
    const glassLayer = zones.map(z => `${R(z)} fill="${G[z.k][0]}" fill-opacity="${G[z.k][1]}"/>${z.k === 'clear' ? streak(z) : ''}${z.k === 'fluted' ? ribs(z) : ''}`).join('');
    const solid = solids.map(([a, b]) => `<rect x="${f(a)}" y="${Y0}" width="${f(b - a)}" height="${H}" fill="#EDE8E1"/>`).join('');
    // 문짝 프레임 선(fw): 칸마다 사각 테두리, 아치는 가운데 선 + 격자, mix는 칸 사이 가로대
    const bar = (x, y, w, h) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/>`;
    let lines = '';
    if (arch) { lines += bar(60 - fw / 2, Y0, fw, H); if (div === 'arch-grid') for (const y of [28, 46, 64]) lines += bar(32.4, y - fw / 2, 55.2, fw); }
    if (glass === 'mix') for (const [a, b] of panes) lines += bar(a, Y0 + H * 2 / 3 - fw / 2, b - a, fw);
    const leaf = [...panes, ...solids].filter(() => !arch).map(([a, b]) => `<rect x="${f(a + fw / 2 - .4)}" y="${f(Y0 + fw / 2 - .4)}" width="${f(b - a - fw + .8)}" height="${f(H - fw + .8)}" fill="none" stroke="${F.fill}" stroke-width="${fw}"/>`).join('');
    // 하드웨어: 미닫이 = 손잡이 홈 바(+원슬라이딩 화살표), 여닫이 = 경첩 + 레버(가운데 쪽으로 뻗음)
    const pull = x => bar(x - .7, 40, 1.4, 15), hinge = x => [20, 44, 68].map(y => `<rect x="${f(x)}" y="${y}" width="1.8" height="5.4" rx=".5"/>`).join('');
    const lever = (x, d) => `<circle cx="${f(x)}" cy="50" r="1.8"/><rect x="${f(d < 0 ? x - 9 : x)}" y="49.2" width="9" height="1.7" rx=".85"/>`;
    const hw = { onesliding: pull(sp - 3.5), threesliding: pull(X0 + th - 3) + pull(X0 + 2 * th + 3), swing: hinge(X0) + lever(sp - 3.6, -1),
      doubleswing: hinge(X0) + hinge(X1 - 1.8) + lever(mid - 3.6, -1) + lever(mid + 3.6, 1), arch: pull(56.4) + pull(63.6) }[type] || '';
    const arrow = type === 'onesliding' ? `<path d="M${f(sp - 30)} 48h14" stroke="${INK}" stroke-width=".8" marker-end="url(#${ar})"/>` : '';
    const body = none
      ? `<g clip-path="url(#${cv})">${view()}</g><rect x="14.5" y="9.5" width="91" height="3" fill="#000" fill-opacity=".07"/><rect x="14.5" y="9.5" width="2.6" height="74.5" fill="#000" fill-opacity=".05"/><path d="M14 9H106V84H14Z${inn}" fill="#9C948A" fill-rule="evenodd"/>`
      : `<path d="${out}${inn}" fill="#000" fill-opacity=".15" fill-rule="evenodd" transform="translate(1.5 2)"/>`
        + `<g clip-path="url(#${cv})">${view()}${blurZ.length ? `<g clip-path="url(#${cs})"><g filter="url(#${fl})">${view()}</g></g>` : ''}${solid}${glassLayer}<g fill="${F.fill}">${arch ? lines : ''}</g></g>`
        + `<g fill="${F.fill}">${arch ? '' : lines}</g>${leaf}<path d="${out}${inn}" fill="${F.fill}" fill-rule="evenodd"/>${rim}`
        + `<g transform="translate(1.5 2)" opacity=".15" fill="#000">${hw}</g><g fill="${F.fill}">${hw}</g>${arrow}`;
    return svg(`<rect width="120" height="90" fill="#F7F4EF"/><rect y="84" width="120" height="6" fill="#D9CFC2"/>${body}`,
      F.def + `<clipPath id="${cv}"><path d="${clp}"/></clipPath>`
      + (blurZ.length ? `<clipPath id="${cs}">${blurZ.map(z => `${R(z)}/>`).join('')}</clipPath><filter id="${fl}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${glass === 'satin' ? '2' : '1.6 0'}"/></filter>` : '')
      + (arrow ? `<marker id="${ar}" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L6 3L0 6z" fill="${INK}"/></marker>` : ''));
  };

  // 기타 입면 그림
  const ELEV = {
    // 세면대
    'basin-integrated': `<rect x="30" y="40" width="60" height="30" rx="2" fill="${FILL}"/><path d="M30 40 h60 v4 q-30 6 -60 0z" fill="#fff" stroke="${INK}" stroke-width=".6"/><rect x="58" y="32" width="4" height="9" fill="#AEB4B9"/>`,
    'basin-top': `<rect x="22" y="48" width="76" height="6" fill="#CDBFAE"/><rect x="26" y="54" width="68" height="18" fill="${FILL}"/><path d="M44 48 q16 -14 32 0z" fill="#fff" stroke="${INK}" stroke-width=".6"/><path d="M60 26 v8 h8" fill="none" stroke="#AEB4B9" stroke-width="2.5"/>`,
    'basin-under': `<rect x="22" y="46" width="76" height="6" fill="#CDBFAE"/><rect x="26" y="52" width="68" height="20" fill="${FILL}"/><path d="M42 46 q18 10 36 0" fill="#fff" stroke="${INK}" stroke-width=".6"/><rect x="58" y="36" width="4" height="10" fill="#AEB4B9"/>`,
    'basin-wall': `<path d="M38 44 h44 q-4 14 -22 14 q-18 0 -22 -14z" fill="#fff" stroke="${INK}" stroke-width=".7"/><rect x="58" y="34" width="4" height="10" fill="#AEB4B9"/>`,
    // 조명 방식 (천장 단면)
    'light-downlight': `<rect width="120" height="10" fill="#E9E4DC"/>${[24, 48, 72, 96].map(x => `<rect x="${x - 4}" y="9" width="8" height="2" fill="${INK}"/><path d="M${x - 4} 11 L${x - 14} 80 H${x + 14} L${x + 4} 11Z" fill="#FFE7B8" fill-opacity=".45"/>`).join('')}`,
    'light-line': `<rect width="120" height="10" fill="#E9E4DC"/><rect x="10" y="9" width="100" height="2" fill="#FFF6DD" stroke="${INK}" stroke-width=".4"/><path d="M10 11 L0 80 H120 L110 11Z" fill="#FFF0CC" fill-opacity=".45"/>`,
    'light-cove': `<rect width="120" height="16" fill="#E9E4DC"/><rect x="0" y="16" width="16" height="4" fill="#D6CFC5"/><rect x="104" y="16" width="16" height="4" fill="#D6CFC5"/><path d="M16 16 Q60 34 104 16" fill="#FFE2A8" fill-opacity=".55"/>`,
    'light-track': `<rect width="120" height="10" fill="#E9E4DC"/><rect x="12" y="10" width="96" height="3" fill="${INK}"/>${[26, 50, 74, 96].map((x, k) => `<g transform="rotate(${k % 2 ? 18 : -18} ${x} 13)"><rect x="${x - 2}" y="13" width="4" height="9" rx="1" fill="${INK}"/><path d="M${x - 2} 22 L${x - 9} 70 H${x + 9} L${x + 2} 22Z" fill="#FFE7B8" fill-opacity=".4"/></g>`).join('')}`,
    'light-pendant': `<rect width="120" height="10" fill="#E9E4DC"/>${[40, 80].map(x => `<line x1="${x}" y1="10" x2="${x}" y2="34" stroke="${INK}" stroke-width=".6"/><path d="M${x - 9} 44 q9 -14 18 0z" fill="#EFE7DA" stroke="${INK}" stroke-width=".6"/><ellipse cx="${x}" cy="62" rx="22" ry="10" fill="#FFE7B8" fill-opacity=".4"/>`).join('')}`,
    // 천장
    'ceiling-coffered': `<path d="M0 10 H120 V18 H100 V26 H20 V18 H0Z" fill="#E9E4DC" stroke="${INK}" stroke-width=".5"/><rect x="20" y="26" width="80" height="2" fill="#FFE7B8"/><rect x="0" y="28" width="120" height="62" fill="#F7F4EF"/>`,
    'ceiling-flat': `<rect x="0" y="10" width="120" height="8" fill="#E9E4DC" stroke="${INK}" stroke-width=".5"/><rect x="0" y="18" width="120" height="72" fill="#F7F4EF"/>`,
    // 신발장
    'shoe-floating': `<rect x="20" y="10" width="80" height="58" fill="${FILL}" stroke="${INK}" stroke-width=".5"/><line x1="46.6" y1="10" x2="46.6" y2="68" stroke="${INK}" stroke-width=".4"/><line x1="73.3" y1="10" x2="73.3" y2="68" stroke="${INK}" stroke-width=".4"/><path d="M20 68 H100 L108 82 H12Z" fill="#FFE2A8" fill-opacity=".6"/>`,
    'shoe-full': `<rect x="20" y="8" width="80" height="74" fill="${FILL}" stroke="${INK}" stroke-width=".5"/><line x1="46.6" y1="8" x2="46.6" y2="82" stroke="${INK}" stroke-width=".4"/><line x1="73.3" y1="8" x2="73.3" y2="82" stroke="${INK}" stroke-width=".4"/>`,
    'shoe-mirror': `<rect x="20" y="8" width="80" height="74" fill="${FILL}" stroke="${INK}" stroke-width=".5"/><rect x="47" y="8" width="26" height="74" fill="${GLASS}" stroke="${INK}" stroke-width=".5"/><line x1="52" y1="20" x2="58" y2="14" stroke="#fff" stroke-width="1"/>`,
    'shoe-bench': `<rect x="20" y="8" width="80" height="40" fill="${FILL}" stroke="${INK}" stroke-width=".5"/><rect x="20" y="60" width="80" height="6" fill="#B89A78"/><rect x="20" y="66" width="80" height="16" fill="${FILL}" stroke="${INK}" stroke-width=".5"/>`,
    // 거실 TV 벽(아트월)
    'wall-slab': `<rect x="10" y="10" width="100" height="72" fill="#EEEAE4"/>${[10, 43.3, 76.6].map(x => `<rect x="${x}" y="10" width="33.3" height="72" fill="#F2EFEA" stroke="#CFC8BE" stroke-width=".4"/>`).join('')}<path d="M18 20 q20 18 10 40 M60 14 q-8 30 14 60 M92 22 q-12 20 4 50" fill="none" stroke="#B9B4AC" stroke-width=".6"/><rect x="38" y="40" width="44" height="25" fill="#2B2B2B"/>`,
    'wall-slat': `<rect x="10" y="10" width="100" height="72" fill="#C9A982"/>${Array.from({ length: 25 }, (_, k) => `<rect x="${10 + k * 4}" y="10" width="2.2" height="72" fill="#B38F66"/>`).join('')}<rect x="38" y="40" width="44" height="25" fill="#2B2B2B"/>`,
    'wall-paint': `<rect x="10" y="10" width="100" height="72" fill="#ECE6DD"/><rect x="38" y="40" width="44" height="25" fill="#2B2B2B"/>`,
    'wall-none': `<rect x="10" y="10" width="100" height="72" fill="#F7F4EF"/><rect x="24" y="64" width="72" height="12" fill="#CDBFAE"/><rect x="38" y="36" width="44" height="25" fill="#2B2B2B"/>`,
  };
  const ELEV_PLUS = (() => {
    const f = n => +n.toFixed(1), OAK = WOODS.oak, TV = '<rect x="38" y="40" width="44" height="25" fill="#2B2B2B"/>';
    const BK = ['#B5523B', '#2F4A3A', '#D9A441', '#8C8C86']; // 책 블록 4색 (wall-shelf 사양)
    // 책 한 줄: 선반이 달라도 같은 색·같은 규칙으로 세움 (x0~x1 구간, 바닥선 yb, 최대 높이 hm)
    const books = (x0, x1, yb, hm, seed) => {
      const r = rnd(seed); let x = x0 + 1 + r() * 2, s = '';
      while (x < x1 - 3) {
        const w = 2 + r() * 2, h = hm * (.55 + r() * .45);
        s += `<rect x="${f(x)}" y="${f(yb - h)}" width="${f(w)}" height="${f(h)}" fill="${BK[Math.floor(r() * 4)]}"/>`;
        x += w + (r() < .22 ? 3 + r() * 4 : .3); // 가끔 빈 틈
      }
      return s;
    };
    // 칸 책장: 바깥 판 t·칸막이 d, nc×nr칸. niche=[i0,i1,j0,j1]는 칸막이를 빼고 한 칸으로 합침(TV 자리)
    const cells = (X, Y, W, H, nc, nr, t, d, seed, niche) => {
      const cw = (W - 2 * t - (nc - 1) * d) / nc, ch = (H - 2 * t - (nr - 1) * d) / nr, cx = i => X + t + i * (cw + d), cy = j => Y + t + j * (ch + d);
      let s = `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="#CDBFAE"/>`, k = 0;
      for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
        if (niche && i >= niche[0] && i <= niche[1] && j >= niche[2] && j <= niche[3]) continue;
        s += `<rect x="${f(cx(i))}" y="${f(cy(j))}" width="${f(cw)}" height="${f(ch)}" fill="#EAE2D5"/>${books(cx(i), cx(i) + cw, cy(j) + ch, ch - 2, seed + 7 * k++)}`;
      }
      if (niche) { const [i0, i1, j0, j1] = niche; s += `<rect x="${f(cx(i0))}" y="${f(cy(j0))}" width="${f(cx(i1) + cw - cx(i0))}" height="${f(cy(j1) + ch - cy(j0))}" fill="#EAE2D5"/>`; }
      return s;
    };
    const board = (x, y, w, h, c = OAK) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".6" fill="${c}"/><rect x="${x}" y="${y}" width="${w}" height=".7" fill="#fff" fill-opacity=".35"/>`;
    const SYS_B = [14, 29.5, 45, 60.5, 76], SYS_P = [20.8, 58.8, 96.8], RACK = ['<rect x="16" y="10" width="2.4" height="74"/>', '<rect x="101.6" y="10" width="2.4" height="74"/>', '<rect x="14" y="10" width="92" height="2.4"/>', '<rect x="16" y="19.6" width="88" height="1.8"/>'].join('');
    const FLOOR = '<rect y="82" width="120" height="8" fill="#E7DFD2"/><rect y="82" width="120" height=".8" fill="#D3C8B6"/>', CEIL = '<rect width="120" height="4" fill="#E9E4DC"/>';
    // 기둥 행거에 거는 옷 한 벌: k로 코트·셔츠(소매)·원피스·바지 실루엣을 돌려 씀
    const cloth = (x, len, w, c, k) => {
      const t = 25, b = t + len, a = f(x - w / 2), z = f(x + w / 2), cap = `Q${x} ${t - 2.6} ${z} ${t}`, m = k % 4;
      const d = [`M${a} ${t}${cap}L${f(z + 1.6)} ${b}H${f(a - 1.6)}Z`, `M${a} ${t}${cap}V${b}H${a}Z`, `M${f(x - 3)} ${t}Q${x} ${t - 2.4} ${f(x + 3)} ${t}L${f(z + 2.4)} ${b}H${f(a - 2.4)}Z`, `M${a} ${t}${cap}V${b}H${f(x + .6)}V${f(t + len * .4)}H${f(x - .6)}V${b}H${a}Z`][m];
      return `<path d="M${x - 5} ${t - 1}L${x} 21.4L${x + 5} ${t - 1}" fill="none" stroke="#2B2B2B" stroke-width=".6"/><path d="${d}" fill="${c}"/>`
        + (m === 1 ? [a - 2, z - .4].map(sx => `<rect x="${f(sx)}" y="${t + .4}" width="2.4" height="${f(len * .55)}" rx="1.2" fill="${c}"/>`).join('') : '');
    };
    const CL = [[25, 34, 9, '#D9CFC2'], [34, 46, 9.5, '#8C8C86'], [43.5, 26, 8.5, '#EFE7DA'], [52, 40, 9, '#C9A77C'], [61, 30, 8.5, '#B9B1A5'], [70, 48, 10, '#6E4C36'], [79, 24, 8.5, '#E9E4DC'], [87.5, 38, 9, '#A8A29A'], [96, 30, 8.5, '#D9CFC2']];
    const dress = fill => CL.map(([x, len, w, c], k) => cloth(x, len, w, fill || c, k)).join('');
    return {
      // 미장: 바탕 위 얼룩 3개 + 왼쪽에서 비스듬히 드는 빛(결이 살아남) + 흙손 자국
      get 'wall-plaster'() {
        const g = id('pg'), h = id('ph'), l = id('pl'), c = id('pc'), r = rnd(31); let tr = '';
        for (let k = 0; k < 9; k++) { const x = 14 + r() * 80, y = 14 + r() * 62, w = 14 + r() * 14; tr += `M${f(x)} ${f(y)}q${f(w / 2)} ${f(-1.5 - r() * 2)} ${f(w)} ${f(r() * 2 - 1)}`; }
        return `<defs><radialGradient id="${g}"><stop offset="0" stop-color="#E2D9CC" stop-opacity=".5"/><stop offset="1" stop-color="#E2D9CC" stop-opacity="0"/></radialGradient><radialGradient id="${h}"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
          + `<linearGradient id="${l}"><stop offset="0" stop-color="#FFE7B8" stop-opacity=".3"/><stop offset=".6" stop-color="#FFE7B8" stop-opacity="0"/><stop offset="1" stop-color="#5F5850" stop-opacity=".08"/></linearGradient>`
          + `<clipPath id="${c}"><rect x="10" y="10" width="100" height="72"/></clipPath></defs><rect x="10" y="10" width="100" height="72" fill="#ECE6DD"/>`
          + `<g clip-path="url(#${c})">${[[36, 30], [86, 46], [54, 78]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="30" fill="url(#${g})"/>`).join('')}${[[70, 22], [22, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="24" fill="url(#${h})"/>`).join('')}<path d="${tr}" fill="none" stroke="#D5CABB" stroke-opacity=".45" stroke-width=".6" stroke-linecap="round"/><rect x="10" y="10" width="100" height="72" fill="url(#${l})"/></g>${TV}`;
      },
      // 4×4 책장, 가운데 2×2칸이 TV 자리
      'wall-shelf': cells(10, 10, 100, 72, 4, 4, 1.6, 1.6, 40, [1, 2, 1, 2]) + '<rect x="38" y="33.5" width="44" height="25" fill="#2B2B2B"/>',
      // 웨인스코팅: 흰 선 틀 3개 (가운데 틀 안에 TV)
      'wall-wainscot': `<rect x="10" y="10" width="100" height="72" fill="#F2EEE8"/>${[[13, 14, 18, 64], [35, 14, 50, 64], [89, 14, 18, 64]].map(([x, y, w, h]) => `<rect x="${x + .7}" y="${y + .9}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-opacity=".14" stroke-width="1.4"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#fff" stroke-width="1.4"/><rect x="${x + 1.4}" y="${y + 1.4}" width="${w - 2.8}" height="${h - 2.8}" fill="none" stroke="#DDD5C8" stroke-width=".5"/>`).join('')}${TV}`,
      // 천장 중앙 원판 하나 + 방 전체에 고르게 퍼지는 빛 (기준 선택지). 원뿔(빔) 없음: downlight·line과 같은 말투라 스포트라이트로 읽혔음 → 균일 막 + 원판 둘레 둥근 번짐
      get 'light-main'() {
        const b = id('lb');
        return `<defs><radialGradient id="${b}"><stop offset="0" stop-color="#FFE7B8" stop-opacity=".35"/><stop offset="1" stop-color="#FFE7B8" stop-opacity="0"/></radialGradient></defs>`
          + `<rect width="120" height="10" fill="#E9E4DC"/><rect y="10" width="120" height="70" fill="#FFF6E6" fill-opacity=".4"/><circle cx="60" cy="13" r="45" fill="url(#${b})"/><ellipse cx="60" cy="80" rx="58" ry="5" fill="#FFE7B8" fill-opacity=".2"/>`
          + `<ellipse cx="61.5" cy="12" rx="10" ry="3.2" fill="#000" fill-opacity=".15"/><ellipse cx="60" cy="10" rx="10" ry="3.2" fill="#FBF8F2" stroke="${INK}" stroke-width=".5"/><ellipse cx="60" cy="10.6" rx="6.4" ry="1.7" fill="#FFF6DD"/>`;
      },
      // 허리 높이 신발장 + 위에 둥근 거울
      'shoe-half': `<circle cx="61.5" cy="29" r="12" fill="#000" fill-opacity=".15"/><circle cx="60" cy="27" r="12" fill="${GLASS}" stroke="${INK}" stroke-width=".8"/><path d="M52 32L58.5 21.5M55.4 34.4L61 25.4" stroke="#fff" stroke-width="1" stroke-linecap="round"/>`
        + `<rect x="20" y="50" width="80" height="32" fill="${FILL}" stroke="${INK}" stroke-width=".5"/><rect x="20" y="50" width="80" height="2.6" fill="#CDBFAE"/><line x1="46.6" y1="52.6" x2="46.6" y2="82" stroke="${INK}" stroke-width=".5"/><line x1="73.3" y1="52.6" x2="73.3" y2="82" stroke="${INK}" stroke-width=".5"/>`
        + `<rect x="25" y="41" width="5.6" height="9" rx="1.6" fill="#B9B1A5"/><path d="M27.8 41Q26 35 24 33M27.8 41Q29 35 32 34" fill="none" stroke="#8A9A82" stroke-width=".8" stroke-linecap="round"/><rect x="78" y="46.6" width="14" height="3.4" rx=".8" fill="#C9A77C"/>`,
      // 천장까지 4×5칸 붙박이
      'shelf-builtin': `${CEIL}${FLOOR}${cells(14, 4, 92, 78, 4, 5, 1.8, 1.4, 60)}`,
      // 기둥 3개 + 선반 5단 시스템 선반 (기둥·선반 그림자 먼저)
      'shelf-system': `${CEIL}${FLOOR}<g transform="translate(1.5 2)" fill="#000" opacity=".15">${SYS_B.map(y => `<rect x="14" y="${y}" width="92" height="2.4"/>`).join('')}${SYS_P.map(x => `<rect x="${x}" y="8" width="2.4" height="74"/>`).join('')}</g>`
        + SYS_B.map((y, k) => `<rect x="14" y="${y}" width="92" height="2.4" fill="#E9E4DC" stroke="#CFC8BE" stroke-width=".5"/>${books(23.2, 58.8, y, Math.min(12, y - 6), 80 + k * 3)}${books(61.2, 96.8, y, Math.min(12, y - 6), 90 + k * 3)}`).join('')
        + SYS_P.map(x => `<rect x="${x}" y="8" width="2.4" height="74" fill="#2B2B2B"/>`).join(''),
      // 벽에 띄운 우드 선반 3단 (그림자 먼저)
      'shelf-floating': `${CEIL}${FLOOR}<g transform="translate(1.5 2)" fill="#000" opacity=".15">${[26, 47, 68].map(y => `<rect x="16" y="${y}" width="88" height="3.2" rx=".6"/>`).join('')}</g>`
        + [26, 47, 68].map((y, k) => `${books(16, 104, y, 16, 100 + k * 4)}${board(16, y, 88, 3.2)}`).join(''),
      // 아래는 닫힌 문, 위는 우드 오픈 선반
      'shelf-lowerdoor': `${CEIL}${FLOOR}<rect x="14" y="52" width="92" height="30" fill="${FILL}" stroke="${INK}" stroke-width=".5"/>${[44.7, 75.3].map(x => `<line x1="${x}" y1="52" x2="${x}" y2="82" stroke="${INK}" stroke-width=".5"/>`).join('')}${[29.3, 60, 90.7].map(x => `<rect x="${x - 5}" y="54.4" width="10" height="1.2" rx=".6" fill="#B9B1A5"/>`).join('')}`
        + [19, 34, 49].map((y, k) => books(16, 104, y, 11, 120 + k * 5)).join('') + `<rect x="14" y="4" width="2" height="45" fill="${OAK}"/><rect x="104" y="4" width="2" height="45" fill="${OAK}"/>` + [4, 19, 34].map(y => board(14, y, 92, 2.4)).join('') + board(12, 49, 96, 3),
      // 기둥 행거 (검은 기둥 + 옷걸이 봉 + 옷, 기둥·옷 그림자 먼저)
      'dress-open': `<g transform="translate(1.5 2)" fill="#000" opacity=".15">${RACK}${dress('#000')}</g><rect y="84" width="120" height="6" fill="#E7DFD2"/>${dress()}<g fill="#2B2B2B">${RACK}</g>`,
    };
  })();
  const elevPlus = name => room(ELEV_PLUS[name] || '');
  Object.assign(ELEV, ELEV_PLUS); // v4에서 더한 입면들
  const elev = name => room(ELEV[name] || '');

  // ── 디테일(하드웨어·조명·창) ── 금속은 METALS 키(chrome·black·gold·gunmetal·nickel·rosegold·brass) 또는 #hex 단색
  // 색 인자 해석: METALS 키 → 금속 그라디언트, 'wood:<WOODS 키|#hex>' → 나뭇결 무늬, 그 밖 → 단색
  const paint = (finish, gid) => {
    if (METALS[finish]) {
      const c = METALS[finish];
      return { fill: `url(#${gid})`, def: `<linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="1">${c.map((s, k) => `<stop offset="${k / (c.length - 1)}" stop-color="${s}"/>`).join('')}</linearGradient>` };
    }
    if (typeof finish === 'string' && finish.startsWith('wood:')) {
      const t = finish.slice(5), base = WOODS[t] || t, r = rnd(13), grain = Array.from({ length: 5 }, (_, k) => `<path d="M0 ${(2 + k * 4.4 + r() * 1.5).toFixed(1)} q10 ${((r() - 0.5) * 2.4).toFixed(1)} 20 0 t20 0" fill="none" stroke="${shift(base, -22)}" stroke-opacity=".4" stroke-width=".35"/>`).join('');
      return { fill: `url(#${gid})`, def: `<pattern id="${gid}" width="40" height="22" patternUnits="userSpaceOnUse"><rect width="40" height="22" fill="${base}"/>${grain}</pattern>` };
    }
    return { fill: finish || '#F7F7F5', def: '' };
  };
  // 다른 생성기의 SVG를 (x, y, w, h) 칸에 끼워 넣기 (예: 욕실 벽에 타일 견본) — 중첩 <svg>는 칸 밖을 잘라 냄
  const nest = (s, x, y, w, h) => s.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `).replace(' aria-hidden="true"', '');
  const WALL = '#EFEBE5';

  // 금속 톤 견본: 같은 레버·로즈(프레임 M)에 색과 결만 바꿈. o: METALS 키(black·gold·brass·nickel·chrome), 모르는 키는 nickel
  const finish = (o = {}) => {
    const k = METALS[o] ? o : 'nickel', c = METALS[k], gl = id('fl'), gr = id('fr');
    const lev = '<path d="M34 39H100Q106 39 106 45Q106 51 100 51H34Z"/>', rose = '<circle cx="34" cy="45" r="13"/>';
    const brush = `<g stroke="#fff" stroke-opacity=".08" stroke-width=".5">${Array.from({ length: 8 }, (_, i) => { const y = (40.5 + i * 1.2).toFixed(1); return `<line x1="40" y1="${y}" x2="102" y2="${y}"/>`; }).join('')}</g>`; // 브러시드 결
    const face = { gold: brush, nickel: brush, chrome: '<rect x="40" y="40.6" width="60" height="1.2" fill="#fff" fill-opacity=".7"/>',
      brass: brush + '<g fill="#4F3D1A" fill-opacity=".2"><ellipse cx="52" cy="43" rx="3" ry="1.4"/><ellipse cx="70" cy="47" rx="4" ry="1.6"/><ellipse cx="88" cy="44" rx="2.5" ry="1.2"/></g>' }[k] || ''; // 파티나 얼룩
    return svg(`<rect width="120" height="90" fill="#F4F1EC"/><rect width="12" height="90" fill="#E6E0D7"/><line x1="12" y1="0" x2="12" y2="90" stroke="#CFC7BB" stroke-width=".6"/>` +
      `<g fill="#000" opacity=".16" transform="translate(2 3)">${lev}${rose}</g><g fill="url(#${gl})">${lev}</g>${face}<g fill="url(#${gr})" stroke="${c[3]}" stroke-width=".6">${rose}</g>` +
      (k === 'chrome' ? '<ellipse cx="30" cy="40" rx="4" ry="2.5" fill="#fff" fill-opacity=".6"/>' : ''),
      `<linearGradient id="${gl}" x2="0" y2="1">${c.map((s, i) => `<stop offset="${i / 4}" stop-color="${s}"/>`).join('')}</linearGradient>` +
      `<radialGradient id="${gr}" cx=".35" cy=".3"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[3]}"/></radialGradient>`);
  };

  // 스위치 플레이트. o: 옵션 id (cream|black|toggle|flush|glass)
  const switchPlate = (o = {}) => {
    const g = id('s'), l = id('l'), S = 'x="43" y="16" width="34" height="58" rx="3"', sq = rx => `x="38" y="23" width="44" height="44" rx="${rx}"`;
    const drop = a => `<rect ${a} fill="#000" fill-opacity=".12" transform="translate(1.2 1.8)"/>`; // 판 그림자: 같은 도형을 옮겨 먼저 깐다
    // 프레임 S: 국내 1구 세로형 판 + 2구 와이드 누름판 (p·ps 판, k·ks·kw 누름판, d 누름판마다 덧그림)
    const wide = (p, ps, k, ks, kw, d) => drop(S) + `<rect ${S} fill="${p}" stroke="${ps}" stroke-width=".8"/>` +
      [46, 60.4].map(x => `<rect x="${x}" y="19.5" width="13.6" height="51" rx="1.6" fill="${k}" stroke="${ks}" stroke-width="${kw}"/>${d(x)}`).join('');
    const lever = (x, y, ty) => `<rect x="${x - 1.8}" y="${y}" width="3.6" height="14" rx="1.8"/><ellipse cx="${x}" cy="${ty}" rx="2.4" ry="1.8"/>`;
    const levers = lever(51, 31, 31) + lever(69, 45, 59); // 왼쪽 켜짐(위)·오른쪽 꺼짐(아래)
    const T = { // [벽, 그림, defs]
      cream: ['#ECE6DC', wide('#EDE4D3', '#CBBFA8', '#F0E8D9', '#DCD1BE', .6, x => `<rect x="${x + 4.8}" y="66" width="4" height="1.2" fill="#E9B872" fill-opacity=".6"/>`)], // 완전 무광(반사광 없음) + 표시창
      black: ['#F4F2EE', wide('#2A2A2A', '#1A1A1A', '#313131', '#444444', .5, x => `<path d="M${x + 1} 20.2 H${x + 12.6}" stroke="#555555" stroke-width=".5"/>`)], // 윗가장자리 하이라이트
      toggle: ['#F3F0EB', drop(sq(3)) + `<rect ${sq(3)} fill="url(#${g})"/>` +
        Array.from({ length: 12 }, (_, k) => `<path d="M39 ${(252 + k * 36) / 10} H81" stroke="#FFFFFF" stroke-opacity=".07" stroke-width=".5"/>`).join('') + // 헤어라인
        [51, 69].map(x => `<circle cx="${x}" cy="45" r="5.5" fill="#B48E4A" stroke="#8E6D33" stroke-width=".6"/>`).join('') +
        `<g transform="translate(1.5 1.5)" fill="#000" opacity=".18">${levers}</g><g fill="url(#${l})">${levers}</g>`,
        `<linearGradient id="${g}" x1="0" x2="1">${METALS.brass.map((s, k) => `<stop offset="${k / 4}" stop-color="${s}"/>`).join('')}</linearGradient><linearGradient id="${l}" x1="0" x2="1"><stop offset="0" stop-color="#F3E2B5"/><stop offset=".5" stop-color="#B8913F"/><stop offset="1" stop-color="#E9CF94"/></linearGradient>`],
      // 플러시: 벽과 같은 색, 그림자 없이 머리카락 같은 틈선만 (가운데 틈 = 2구 누름판, 빈 액자로 읽히지 않게)
      flush: [`url(#${g})`, `<rect x="46" y="20" width="28" height="50" rx=".8" fill="none" stroke="#D2CABE" stroke-width=".6"/><rect x="48.5" y="22.5" width="23" height="45" rx=".6" fill="#ECE6DE"/><path d="M49 22.75 H71" stroke="#F7F3EE" stroke-width=".5"/><path d="M49 67.25 H71" stroke="#CFC7BB" stroke-width=".5"/><path d="M60 22.5V67.5" stroke="#D2CABE" stroke-width=".5"/>`,
        `<radialGradient id="${g}" cx=".4" cy=".3"><stop offset="0" stop-color="#F1ECE5"/><stop offset="1" stop-color="#E6DFD5"/></radialGradient>`],
      glass: ['#F3F0EB', drop(sq(5)) + `<rect ${sq(5)} fill="#121212" stroke="#2E2E2E" stroke-width=".8"/><path d="M38 49 V28 A5 5 0 0 1 43 23 H64Z" fill="#FFFFFF" fill-opacity=".07"/><path d="M43 23.65 H77" stroke="#FFFFFF" stroke-opacity=".35" stroke-width=".5"/>` +
        [49, 60, 71].map((x, k) => `<circle cx="${x}" cy="43" r="3.8" fill="none" stroke="#E8E8E8" stroke-width=".7"/><circle cx="${x}" cy="43" r=".9" fill="#E8E8E8"/><rect x="${x - 2}" y="52" width="4" height=".9" fill="#7CC7FF" fill-opacity="${k === 1 ? 1 : .35}"/>`).join('')],
    };
    const [w, body, defs] = T[o] || T.cream;
    return svg(`<rect width="120" height="90" fill="${w}"/><g transform="translate(-12 -9) scale(1.2)">${body}</g>`, defs); // 카드 중심 기준 1.2배: 판이 작아 보이지 않게(폭 40% 규칙)
  };

  // 선 처리: 방 정면 입면 (몰딩·걸레받이·문선·방문). o: 'flush'|'slim'|'classic'|'wood'|'arch'
  const lineRoom = (o = {}) => {
    const g = id('n'), cg = id('g'), N = paint('nickel', g), W = '#FFFFFF';
    const band = (y, h, f) => `<rect y="${y}" width="120" height="${h}" fill="${f}"/>`; // 몰딩·걸레받이는 한 장으로 깔고 문틀이 덮음
    const hr = (y, c, w = .6) => `<path d="M0 ${y}H120" stroke="${c}" stroke-width="${w}"/>`;
    const leaf = f => `<rect x="72" y="18" width="28" height="64" fill="${f}"/>`;
    const trim = (d, f, s = 'none', w = .6) => `<path d="${d}" fill="${f}" stroke="${s}" stroke-width="${w}"/>`;
    const box = ([x, y, w, h], s, sw, k = 0) => `<rect x="${x + k}" y="${y + k}" width="${w - 2 * k}" height="${h - 2 * k}" fill="none" stroke="${s}" stroke-width="${sw}"/>`;
    const T = {
      flush: ['#F1EDE7', hr(8, '#00000022', .5) + `<rect y="79.8" width="120" height="2.2" fill="#2F2B27" fill-opacity=".35"/><rect x="71" y="17" width="30" height="65" fill="#E3DFD9" stroke="#00000026" stroke-width=".5"/>` + leaf('#ECE8E2')],
      // 가운데 홈(y52)은 손잡이와 겹쳐서 뺌
      slim: ['#ECE7DF', band(8, 3, W) + hr(11, '#0000002A') + band(78, 4, W) + hr(78, '#0000002A') + leaf('#F5F5F3') +
        trim('M75 36H97M75 68H97', 'none', '#00000024') + trim('M75 36.55H97M75 68.55H97', 'none', W, .5) + trim('M69 82V15H103V82H100V18H72V82Z', W, '#0000002A')],
      classic: ['#EFE8DD', `<rect y="8" width="120" height="7" fill="url(#${cg})"/>` + band(15, 1.5, '#00000010') +
        [[6, 24, 26, 30], [36, 24, 26, 30], [6, 63, 26, 9], [36, 63, 26, 9]].map(r => box(r, W, 1.6) + box(r, '#00000012', .6, 1.2)).join('') +
        band(58, 1.8, W) + band(74, 8, W) + hr(75.2, '#00000018') + leaf('#F4F1EC') +
        [[76, 24, 20, 22], [76, 56, 20, 20]].map(r => box(r, '#0000001E', .7) + box(r, W, .7, 1.2)).join('') + // 아래 패널은 손잡이 아래에서 시작
        trim('M68 82V14H104V82H100V18H72V82Z', W, '#0000001A', .5) + trim('M70 82V16H102V82', 'none', '#00000014', .5)],
      wood: ['#F3EFE9', hr(8, '#00000022', .5) + band(76, 6, '#B8935F') + band(76, 1, '#C9A777') + leaf('#C9A77C') +
        [74, 78, 82, 86, 90, 94, 98].map((x, k) => trim(`M${x} 18q1.6 16 0 32t0 32`, 'none', k % 3 === 1 ? '#FFFFFF22' : '#00000018', .5)).join('') + trim('M69 82V15H103V82H100V18H72V82Z', '#B8935F')],
      arch: ['#F2EEE8', band(8, 2.4, W) + band(79, 3, W) + `<path d="M72 82V32A14 14 0 0 1 100 32V82Z" fill="#EDE3D2" stroke="#E2DCD3" stroke-width="6" paint-order="stroke"/>`], // 굵은 선의 바깥 3px가 문선
    };
    const [wall, body] = T[o] || T.flush;
    return svg(`<rect width="120" height="8" fill="#FAF8F5"/><rect y="8" width="120" height="74" fill="${wall}"/>${body}<rect x="89" y="51.3" width="7" height="1.4" fill="${N.fill}"/><circle cx="96" cy="52" r="1.8" fill="${N.fill}"/><rect y="82" width="120" height="8" fill="#D1B38A"/><path d="M20 82V90M58 82V90M96 82V90" stroke="#B99A70" stroke-width=".5"/>`,
      N.def + (o === 'classic' ? `<linearGradient id="${cg}" x2="0" y2="1">${['#FFFFFF', '#E7E1D7', '#FFFFFF', '#DAD3C8', '#F7F4EF'].map((c, k) => `<stop offset="${k / 4}" stop-color="${c}"/>`).join('')}</linearGradient>` : ''));
  };

  // 천장 매입등 (올려다본 천장 평면). o: 옵션 id (round|pinhole|square|line)
  const ceiling = (o = {}) => {
    const each = f => [30, 60, 90].map(x => f(x, 30) + f(x, 62)).join(''); // 조명 6개 중심
    const L = {
      round: each((x, y) => `<circle cx="${x}" cy="${y}" r="13" fill="#FFE7B8" fill-opacity=".28"/><circle cx="${x}" cy="${y}" r="7" fill="#FFFFFF" stroke="#D6CFC5" stroke-width=".6"/><circle cx="${x}" cy="${y}" r="5" fill="#FFF6DD"/>`),
      pinhole: each((x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="#FFE7B8" fill-opacity=".3"/><circle cx="${x}" cy="${y}" r="4.5" fill="#FFE7B8" fill-opacity=".45"/><circle cx="${x}" cy="${y}" r="1.5" fill="#FFF6DD" stroke="#3A3632" stroke-width=".5"/>`), // 켜진 작은 점: 어두운 구멍은 꺼진 그로밋처럼 읽혔다
      square: each((x, y) => `<rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="3" fill="#FFE7B8" fill-opacity=".22"/><rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="1" fill="#262626"/><rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="#FFF6DD"/>`),
      line: [24, 56].map(y => `<rect x="6" y="${y}" width="108" height="12" rx="6" fill="#FFE7B8" fill-opacity=".22"/><rect x="10" y="${y + 4.8}" width="100" height="2.4" fill="#FFF6DD" stroke="${INK}" stroke-width=".5"/>`).join(''),
    };
    return svg(`<rect width="120" height="90" fill="${WALL}"/><rect x="2" y="2" width="116" height="86" fill="none" stroke="#D6CFC5" stroke-width=".8"/>${L[o] || L.round}`);
  };

  // 수납장 손잡이 (서랍 2칸 클로즈업). o: { type: bar|edge|push|wood|vintage, finish: METALS 키(금속 톤 응답) }
  const handle = (o = {}) => {
    const { type = 'bar', finish = 'nickel' } = o, c = METALS[finish] || METALS.nickel, g = id('h'), r = id('hr'), M = `url(#${g})`;
    const lift = s => `<g transform="translate(1.5 2)" opacity=".15">${s('#000', '#000')}</g>${s()}`; // 같은 도형을 옮긴 그림자 먼저
    const knobs = f => [42, 78].map(x => `<circle cx="${x}" cy="67" r="5.5" fill="${f}"/>`).join('');
    const top = '<rect width="120" height="5" fill="#D6CFC4"/>'; // 상판 그늘
    const T = {
      bar: lift((f = M, p = c[3]) => [20, 65].map(y => `<rect x="34" y="${y}" width="52" height="4" rx="2" fill="${f}"/><rect x="38" y="${y + 4}" width="3" height="2.5" fill="${p}"/><rect x="79" y="${y + 4}" width="3" height="2.5" fill="${p}"/>`).join('')),
      edge: top + [5.3, 45.3].map(y => `<g transform="translate(0 ${y})">${lift((f = M, t = c[0]) => `<rect x="46" y="-1.8" width="28" height="1.8" fill="${t}"/><rect x="46" width="28" height="7" rx=".8" fill="${f}"/>`)}<rect x="46.8" y="6.4" width="26.4" height=".6" fill="#000" fill-opacity=".2"/></g>`).join(''),
      push: top + [5, 44].map(y => `<rect y="${y}" width="120" height="5" fill="${M}" opacity=".6"/><rect y="${y + 5}" width="120" height=".5" fill="#fff" fill-opacity=".5"/>`).join(''),
      wood: lift((f = '#C9A27A') => `<rect x="36" y="19" width="48" height="6" rx="3" fill="${f}"/>${knobs(f)}`) +
        `<path d="M39 21.2q5 -.9 10 0t10 0t10 0t10 0M41 23.2q6 .8 12 0t12 0t12 0" fill="none" stroke="#A8835C" stroke-opacity=".6" stroke-width=".5"/>${[42, 78].map(x => `<circle cx="${x}" cy="67" r="3.5" fill="none" stroke="#A8835C" stroke-width=".5"/>`).join('')}`,
      vintage: lift((f = M) => `<rect x="41" y="18" width="6" height="4" rx="1" fill="${f}"/><rect x="73" y="18" width="6" height="4" rx="1" fill="${f}"/><path d="M45 19H75V21Q75 31 60 31Q45 31 45 21Z" fill="${f}"/>`) +
        '<path d="M47 21H73Q72 27 60 27.5Q48 27 47 21Z" fill="#000" fill-opacity=".22"/>' + lift((f = `url(#${r})`) => knobs(f)) + [42, 78].map(x => `<circle cx="${x - 1.6}" cy="65.4" r="1.6" fill="#fff" fill-opacity=".5"/>`).join(''),
    };
    const stops = (type === 'push' ? ['#3A332B', '#6B6156'] : c).map((s, k, a) => `<stop offset="${k / (a.length - 1)}" stop-color="${s}"/>`).join('');
    return svg(`<rect width="120" height="90" fill="${type === 'wood' ? '#F3F0EB' : '#EEEAE3'}"/>${type === 'push' ? '' : '<rect y="44.6" width="120" height=".8" fill="#CFC7BB"/>'}${T[type] || T.bar}`,
      `<linearGradient id="${g}" x2="0" y2="1">${stops}</linearGradient><radialGradient id="${r}" cx=".35" cy=".3"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[3]}"/></radialGradient>`);
  };

  // 방문 손잡이 (손잡이 쪽 문짝 클로즈업, 프레임 D2). o: { type: slim|square|plate|hidden, finish: METALS 키(없거나 모르면 nickel) }
  const lever = (o = {}) => {
    const c = METALS[o.finish] || METALS.nickel, g = id('dl'), r = id('dr'), p = id('dp'), h = id('dh');
    const stops = c.map((s, i) => `<stop offset="${i / 4}" stop-color="${s}"/>`).join('');
    const L = `fill="url(#${g})"`, R = `fill="url(#${r})" stroke="${c[3]}" stroke-width=".6"`;
    const T = { // [모양, 칠] 아래에 깔리는 것부터
      slim: [['<rect x="30" y="41" width="58" height="8" rx="4"/>', L], ['<circle cx="86" cy="45" r="10"/>', R]],
      square: [['<rect x="28" y="41" width="60" height="8" rx=".6"/>', L], ['<rect x="28" y="41" width="1.6" height="8"/>', 'fill="#000" fill-opacity=".35"'], ['<rect x="77" y="36" width="18" height="18" rx="1.2"/>', R]],
      plate: [['<rect x="79" y="14" width="14" height="62" rx="7"/>', `fill="url(#${p})"`], ['<rect x="80.4" y="15.4" width="11.2" height="59.2" rx="5.6"/>', `fill="none" stroke="${c[3]}" stroke-width=".6"`],
        ['<path d="M86 37C70 36 50 39 36 46Q30 50 35 53C50 48 68 45 86 45Z"/>', L], ['<circle cx="86" cy="62" r="1.8"/><path d="M85.1 62.6H86.9L86.6 66.4H85.4Z"/>', 'fill="#000" fill-opacity=".75"']], // 열쇠 구멍: 밝은 판에선 #3A3632쯤, 블랙 판에서도 보이게
      hidden: [['<rect x="89" y="22" width="7" height="46" rx="3.5"/>', `fill="${c[1]}"`], ['<rect x="89.8" y="22.8" width="5.4" height="44.4" rx="2.7"/>', `fill="url(#${h})"`],
        ['<path d="M90.18 65.12A2.4 2.4 0 0 0 94.82 65.12"/>', 'fill="none" stroke="#fff" stroke-opacity=".8" stroke-width=".6"']], // 홈 안쪽 아래 턱에 빛: 파인 홈으로 읽히게(밝은 문 위에선 안 보임)
    };
    const hid = o.type === 'hidden', parts = T[o.type] || T.slim;
    const frame = hid ? `<rect x="106" width="14" height="90" fill="${WALL}"/><line x1="106" y1="0" x2="106" y2="90" stroke="#0000003A" stroke-width=".6"/>` // 문과 벽이 같은 면
      : '<rect x="106" width="14" height="90" fill="#E7E2DA"/><line x1="106" y1="0" x2="106" y2="90" stroke="#00000022" stroke-width=".6"/><rect x="109" width="1.2" height="90" fill="#0000000F"/>';
    const shadow = hid ? '' : `<g fill="#000" opacity=".15" transform="translate(1.5 2)">${parts.map(s => s[0]).join('')}</g>`; // 튀어나온 게 없으면 그림자도 없음
    return svg(`<rect width="120" height="90" fill="#F2EFEA"/>${frame}${shadow}${parts.map(([s, f]) => `<g ${f}>${s}</g>`).join('')}`,
      `<linearGradient id="${g}" x2="0" y2="1">${stops}</linearGradient><linearGradient id="${p}">${stops}</linearGradient>` +
      `<radialGradient id="${r}" cx=".35" cy=".3"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[3]}"/></radialGradient>` +
      `<linearGradient id="${h}" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>`);
  };

  // 욕실 벽 (거울·액세서리). o: { type: glow|cabinet|frame|arch, finish: 욕실 수전 응답, 없으면 금속 톤 응답 }
  const bathWall = (o = {}) => {
    const { type = 'glow', finish = 'chrome' } = o, F = paint(finish, id('b')), M = F.fill;
    const ref = (x, y) => `<path d="M${x} ${y + 7}l7 -7" stroke="#fff" stroke-opacity=".8"/><path d="M${x + 2} ${y + 11}l9 -9" stroke="#fff" stroke-opacity=".6"/>`; // 거울 반사선
    const rim = (s, w, h) => `<${s} fill="#DCE6EA" stroke="#000" stroke-opacity=".3" stroke-width="${h}"/><${s} fill="none" stroke="${M}" stroke-width="${w}"/>`; // 금속 테 양쪽에 어두운 실선 (밝은 크롬이 거울에 묻히지 않게)
    const T = {
      glow: [[29, .16], [26, .26], [24, .38]].map(([r, a]) => `<circle cx="60" cy="32" r="${r}" fill="#FFE7B8" fill-opacity="${a}"/>`).join('') +
        `<circle cx="60" cy="32" r="22" fill="#DCE6EA" stroke="#C9D6DC" stroke-width=".6"/>${ref(46, 17)}<rect x="94" y="40" width="20" height="18" fill="#D6CFC4"/><rect x="94" y="40" width="20" height="3" fill="#000" fill-opacity=".14"/><rect x="95" y="40.5" width="18" height=".8" fill="#FFF2CF"/><rect x="98" y="48" width="4" height="10" rx="1.2" fill="#fff"/><rect x="105" y="46" width="5" height="12" rx="1.5" fill="#B9C9C2"/>`,
      cabinet: `<rect x="17.5" y="8" width="88" height="48" fill="#000" fill-opacity=".15"/><rect x="16" y="6" width="88" height="48" fill="#ECE8E2"/>${[18, 58].map(x => `<rect x="${x}" y="8" width="44" height="44" fill="#DCE6EA" stroke="#C3CED4" stroke-width=".6"/>${ref(x + 5, 13)}`).join('')}<rect x="16" y="54" width="88" height="1.4" fill="#FFF2CF"/><path d="M16 55.4H104L110 66H10Z" fill="#FFE7B8" fill-opacity=".3"/>`,
      frame: `<rect x="37.5" y="7" width="48" height="50" rx="2" fill="#000" fill-opacity=".1"/>${rim('rect x="36" y="5" width="48" height="50" rx="2"', 2.2, 2.9)}${ref(41, 10)}<rect x="8" y="42.4" width="14" height="18" fill="#F7F4EE" stroke="#E3DCCF" stroke-width=".5"/><rect x="4" y="40" width="22" height="2.4" rx="1.2" fill="${M}"/><circle cx="5" cy="41.2" r="2.6" fill="${M}"/><circle cx="25" cy="41.2" r="2.6" fill="${M}"/>`,
      arch: `${rim('path d="M42 56V22A18 18 0 0 1 78 22V56Z"', 1.6, 2.1)}${ref(47, 13)}<rect x="90" y="36" width="24" height="2.4" fill="#CFE0E6" fill-opacity=".8"/><rect x="90" y="37.9" width="24" height=".5" fill="#9FC0C8"/><rect x="96" y="27" width="5" height="9" rx="1.5" fill="#B9C9C2"/><circle cx="107" cy="33" r="3" fill="#D8C3A5"/>` +
        `<circle cx="14" cy="28" r="1.8" fill="${M}"/><rect x="9" y="40" width="10" height="20" rx="1" fill="#F7F4EE"/><circle cx="14" cy="36" r="6" fill="none" stroke="${M}" stroke-width="1.4"/>`,
    };
    return svg(`<rect width="120" height="90" fill="#E4DED5"/><path d="M30 0V66M90 0V66" stroke="#D2CBC0" stroke-width=".5"/><rect x="10" y="66" width="100" height="5" fill="#F4F1EC"/><rect x="10" y="71" width="100" height="19" fill="#DCD5CA"/>${T[type] || T.glow}<rect x="58" y="59" width="4" height="4" fill="${M}"/><rect x="60" y="61" width="9" height="2" rx=".8" fill="${M}"/>`, F.def);
  };

  // 창 연출 (오후 햇살 드는 창 정면). o: sheer|linen|woodblind|shade|velvet
  // 창 연출 (오후 햇살 드는 창 정면). arg: 종류 id 문자열 또는 {type, color, frame}
  // type: sheer|linen|woodblind|shade|velvet(기존 5종, 인자 없으면 옛 그림 그대로) + double|combi|blackout|roll|honeycomb(=shade)|none(창만)
  // color: 천·살 색(#hex, 없으면 종류별 기본색), frame: 창틀 색(#hex·METALS 키·'wood:톤' → 선 3u + 가운데 문틀 3u)
  const windowDress = (arg = {}) => {
    const { type: o = 'sheer', color: C, frame } = typeof arg === 'string' ? { type: arg } : arg;
    const f = v => +v.toFixed(2), r = rnd(5), sky = id('s'), blind = ['woodblind', 'shade', 'honeycomb', 'combi', 'roll'].includes(o);
    const T = (def, k) => (C ? shift(C, k) : def); // color를 받으면 기본색과 같은 간격(k)으로 밝고 어둡게 파생
    let defs = `<linearGradient id="${sky}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#D6E6F2"/><stop offset="1" stop-color="#F2F6F9"/></linearGradient>`;
    const box = '<rect x="6" y="6" width="108" height="4" fill="#3A3A3A" fill-opacity=".2"/>'; // 커튼박스 홈 (레일은 안 보임)
    // 양옆으로 걷은 린넨 폭들: xs = 폭마다 왼쪽 x, pw = 폭 너비 (32 = 옛 그림, 16 = roll 곁 린넨)
    const linen = (xs, pw) => {
      const c = id('c'), g = id('g'), P = xs.map(x => `<rect x="${x}" y="8" width="${pw}" height="75"/>`).join(''), fd = T('#8A7658', -100);
      defs += `<clipPath id="${c}">${P}</clipPath><linearGradient id="${g}"><stop offset="0" stop-color="${fd}" stop-opacity="0"/><stop offset=".5" stop-color="${fd}" stop-opacity=".25"/><stop offset="1" stop-color="${fd}" stop-opacity="0"/></linearGradient>`;
      let fold = '', weave = '', slub = '', crease = '';
      for (const x0 of xs) {
        for (let x = x0 - r() * 4; x < x0 + pw;) { const w = (10 + r() * 2) * pw / 32; fold += `<rect x="${f(x)}" y="8" width="${f(w)}" height="75" fill="url(#${g})"/>`; x += w; } // 느슨한 주름
        for (let y = 9; y < 83; y += 1.5 + r() * 1.5) { weave += `M${x0} ${f(y)}`; for (let x = x0; x < x0 + pw;) { const d = 2 + r() * 4, gap = 1 + r() * 2; weave += `h${f(d)}m${f(gap)} 0`; x += d + gap; } } // 끊긴 가로 결
        for (let k = 0; k < 3; k++) slub += `M${f(x0 + 2 + r() * (pw - 8))} ${f(12 + r() * 66)}h${f(3 + r() * 3)}`;
        crease += `M${f(x0 + 8 + r() * (pw - 18))} 80l2.5 3`;
      }
      return `<g fill="${T('#E3D9C8', 0)}" fill-opacity=".9">${P}</g><g clip-path="url(#${c})">${fold}<g fill="none" stroke="${T('#C9BBA3', -31)}"><path d="${weave}" stroke-opacity=".5" stroke-width=".5"/><path d="${slub}" stroke-opacity=".8"/><path d="${crease}" stroke-width=".6"/></g></g>${box}`;
    };
    const sheer = () => {
      const b = id('b'), g = id('g'), p = 100 / 12; // 반 물결 8.33: 100px에 12개가 딱 맞게
      const edge = `M10 8q${f(p / 2)} -3 ${f(p)} 0${`t${f(p)} 0`.repeat(11)}V83q${f(-p / 2)} -3 ${f(-p)} 0${`t${f(-p)} 0`.repeat(11)}Z`; // 제어점 3 → 실제 진폭 1.5
      // 물결 마루(흰 .35)·골(#E6E6E6 .25)이 번갈아 부드럽게 이어지는 띠
      defs += `<linearGradient id="${b}" gradientUnits="userSpaceOnUse" x1="${f(10 + p / 2)}" x2="${f(10 + 2.5 * p)}" spreadMethod="repeat"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#E6E6E6" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient><radialGradient id="${g}"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
      return `<path d="${edge}" fill="#fff" fill-opacity=".5"/><path d="${edge}" fill="url(#${b})"/>${box}<rect x="26" y="14" width="68" height="62" fill="url(#${g})"/>`;
    };
    // 두꺼운 천 한 쌍에 세로 주름 띠를 입힘: xs = 폭 왼쪽 x들, pw 너비, c 천색, dk 주름 그늘 색
    const drape = (xs, pw, c, dk) => {
      const g = id('g');
      defs += `<linearGradient id="${g}"><stop offset="0" stop-color="${dk}" stop-opacity="0"/><stop offset=".5" stop-color="${dk}" stop-opacity=".32"/><stop offset="1" stop-color="${dk}" stop-opacity="0"/></linearGradient>`;
      return xs.map(x0 => `<rect x="${x0}" y="8" width="${pw}" height="76" fill="${c}"/>${[0, 1, 2].map(k => `<rect x="${f(x0 + k * pw / 3)}" y="8" width="${f(pw / 3)}" height="76" fill="url(#${g})"/>`).join('')}<rect x="${x0}" y="80" width="${pw}" height="4" fill="${dk}" fill-opacity=".18"/>`).join('') + box;
    };
    const D = {
      sheer,
      linen: () => linen([10, 78], 32),
      woodblind: () => {
        let s = '', grain = '';
        for (let k = 0; k < 8; k++) {
          const y = f(19 + 6.2 * k);
          s += `<rect x="30" y="${y}" width="60" height="5.2" fill="${T('#C8A47A', 0)}"/><rect x="30" y="${y}" width="60" height="1" fill="${T('#DDB98F', 21)}"/><rect x="30" y="${f(y + 4.2)}" width="60" height="1" fill="${T('#A0835F', -33)}"/>`;
          grain += `M30 ${f(y + 2)}q15 ${f(r() - .5)} 30 0t30 0M30 ${f(y + 3.2)}q15 ${f(r() - .5)} 30 0t30 0`;
        }
        return `<rect x="28" y="12" width="64" height="6" fill="${T('#C8A47A', 0)}"/>${s}<path d="${grain}" fill="none" stroke="${T('#8C7050', -52)}" stroke-opacity=".35" stroke-width=".5"/><rect x="43" y="18" width="4" height="50" fill="#E8DCC8"/><rect x="73" y="18" width="4" height="50" fill="#E8DCC8"/><rect x="30" y="69" width="60" height="3" fill="${T('#C8A47A', 0)}"/><path d="M86 18V58M88 18V62" stroke="${T('#A8835C', -32)}" stroke-width=".6"/><circle cx="86" cy="58" r="1.25" fill="${T('#A8835C', -32)}"/><circle cx="88" cy="62" r="1.25" fill="${T('#A8835C', -32)}"/>`;
      },
      shade: () => {
        let pleat = '', hi = '';
        for (let y = 21; y <= 57; y += 4) { pleat += `M30 ${y}H90`; hi += `M30 ${f(y - .8)}H90`; } // 4px 주름. 셀 단면 기둥은 구슬 줄로 읽혀서 뺌(무선이 핵심)
        return `<rect x="29" y="13" width="62" height="4" fill="${T('#ECE8E1', -7)}"/><rect x="30" y="17" width="60" height="43" fill="${T('#F3EEE6', 0)}" fill-opacity=".92"/><path d="${hi}" stroke="#fff" stroke-opacity=".7"/><path d="${pleat}" stroke="${T('#D3CCC2', -32)}" stroke-width=".6"/><rect x="30" y="60" width="60" height="2" fill="${T('#E1DBD2', -18)}"/>`;
      },
      velvet: () => {
        const c = id('c'), L = 'M10 8H40Q34 36 32 55Q35 70 42 84H8Q12 70 14 55Q12 36 10 8Z', vc = T('#2F4A3A', 0);
        defs += `<clipPath id="${c}"><path d="${L}"/></clipPath>`;
        // 주름선은 바깥(t=0)~안쪽(t=1) 가장자리를 t로 보간 → 타이백에서 모였다 퍼짐 (위쪽 주기 7.5)
        const fold = ts => ts.map(t => `M${f(10 + 30 * t)} 8Q${f(12 + 22 * t)} 36 ${f(14 + 18 * t)} 55Q${f(12 + 23 * t)} 70 ${f(8 + 34 * t)} 84`).join('');
        const half = `<ellipse cx="25" cy="84.5" rx="19" ry="2.5" fill="${vc}"/><path d="${L}" fill="${vc}"/><g clip-path="url(#${c})" fill="none"><path d="${fold([0, .25, .5, .75, 1])}" stroke="${T('#1F3A2A', -16)}" stroke-width="3"/><path d="${fold([.125, .375, .625, .875])}" stroke="${T('#4F6A5A', 32)}" stroke-opacity=".7" stroke-width="1.5"/></g><rect x="13" y="53.5" width="20" height="3" fill="#B8955A"/>`;
        return half + `<g transform="matrix(-1 0 0 1 120 0)">${half}</g>${box}`; // 오른쪽은 좌우 대칭
      },
      // 쉬폰 + 암막 2중: 속커튼(쉬폰)은 창 전체, 겉커튼(암막)은 양옆에 걷음
      double: () => { const dc = T('#B9AC9C', 0); return sheer() + drape([10, 84], 26, dc, shift(dc, -60)); },
      // 콤비 블라인드: 천 띠와 비치는 띠가 번갈아
      combi: () => {
        const c = T('#E9E4DC', 0); let s = '';
        for (let k = 0; k < 5; k++) { const y = f(17 + k * 9.4); s += `<rect x="30" y="${y}" width="60" height="5.2" fill="${c}"/><rect x="30" y="${y}" width="60" height=".8" fill="#fff" fill-opacity=".6"/><rect x="30" y="${f(y + 4.4)}" width="60" height=".8" fill="${shift(c, -30)}"/><rect x="30" y="${f(y + 5.2)}" width="60" height="4.2" fill="#fff" fill-opacity=".38"/>`; }
        return `<rect x="29" y="13" width="62" height="4" fill="${shift(c, -7)}"/>${s}<rect x="30" y="64" width="60" height="2.4" fill="${shift(c, -22)}"/>`;
      },
      // 암막 커튼: 창을 다 덮은 두꺼운 천, 촘촘한 세로 주름
      blackout: () => {
        const bc = T('#7C7268', 0), g = id('g'), p = 100 / 12;
        defs += `<linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="10" x2="${f(10 + p)}" spreadMethod="repeat"><stop offset="0" stop-color="${shift(bc, 14)}"/><stop offset=".5" stop-color="${shift(bc, -26)}"/><stop offset="1" stop-color="${shift(bc, 14)}"/></linearGradient>`;
        return `<rect x="10" y="8" width="100" height="76" fill="url(#${g})"/><rect x="59.2" y="8" width="1.6" height="76" fill="${shift(bc, -44)}" fill-opacity=".55"/><rect x="10" y="80" width="100" height="4" fill="${shift(bc, -50)}" fill-opacity=".3"/>${box}`;
      },
      // 롤스크린: 평평한 천을 반쯤 내림 + 양옆 린넨 16u
      roll: () => {
        const c = T('#EFEAE0', 0);
        return linen([12, 92], 16) + `<rect x="30" y="17" width="60" height="43" fill="${c}"/><rect x="30" y="17" width="60" height="4" fill="#000" fill-opacity=".06"/><rect x="29" y="12.4" width="62" height="5.4" rx="2.7" fill="${shift(c, -14)}"/><rect x="30" y="60" width="60" height="2.6" rx="1.3" fill="${shift(c, -38)}"/><path d="M86 21V66" stroke="#9C948A" stroke-width=".6"/><circle cx="86" cy="66.6" r="1.4" fill="#9C948A"/>`;
      },
      none: () => '', // 창만: 창틀 색이 주인공
    };
    D.honeycomb = D.shade;
    const fm = frame || (o === 'none' ? '#BFC5CA' : null), FR = fm && paint(fm, id('wf')); // 창틀 색을 받으면 선 3u + 가운데 문틀 3u + 그림자
    if (FR) defs += FR.def;
    const [x, y, w, h] = o === 'none' ? [22, 12, 76, 66] : blind ? [30, 16, 60, 56] : [26, 14, 68, 62], body = (D[o] || D.sheer)();
    const win = FR
      ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000" fill-opacity=".15" stroke="#000" stroke-opacity=".15" stroke-width="3" transform="translate(1.5 2)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${sky})" stroke="${FR.fill}" stroke-width="3"/>`
        + (o === 'none' ? `<path d="M${x + 10} ${y + h}L${x + 22} ${y + h}L${x + 58} ${y}L${x + 46} ${y}Z" fill="#fff" fill-opacity=".35"/>` : '') + `<rect x="58.5" y="${y}" width="3" height="${h}" fill="${FR.fill}"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${sky})" stroke="#BFC5CA" stroke-width="${blind ? 3 : 2}"/><line x1="60" y1="${y}" x2="60" y2="${y + h}" stroke="#BFC5CA" stroke-width="1.5"/>`;
    return svg(`<rect width="120" height="90" fill="${o === 'velvet' ? '#ECE6DD' : '#F4F1EC'}"/><rect width="120" height="6" fill="#E9E4DC"/>${win}${blind ? '<rect x="27" y="72" width="66" height="3" fill="#E2DDD4"/>' : o === 'none' ? `<rect x="19" y="${y + h}" width="82" height="3" fill="#E2DDD4"/>` : ''}<rect y="84" width="120" height="6" fill="#CDBFAE"/>${body}`, defs);
  };

  // 스탠드·테이블 램프·벽등: 불을 하나만 켠 장면. o: 'paper'|'tripod'|'travertine'|'mushroom'|'swing'
  const lamp = (o = {}) => {
    const Y = '#FFE7B8', g = id('lg'), M = paint('black', id('lm'));
    const lit = (shape, op = .35) => `<${shape} fill="${Y}" fill-opacity="${op}"/>`;
    const sh = s => `<g transform="translate(1.5 2)" opacity=".15">${s.replace(/(fill|stroke)="(?!none)[^"]*"/g, '$1="#000"')}</g>${s}`; // 같은 도형 그림자를 먼저
    const L = {
      // 종이 원통: 안에서 번지는 빛 + 옅은 후광
      paper: [lit('ellipse cx="60" cy="45" rx="30" ry="34"', .18) + `<rect x="54" y="76" width="12" height="8" fill="#8B6A4E"/><rect x="50" y="14" width="20" height="62" rx="3" fill="#FBF6EA" stroke="#D9CDB8" stroke-width=".6"/><rect x="50" y="14" width="20" height="62" rx="3" fill="url(#${g})"/><path d="M50 24h20M50 34h20M50 44h20M50 54h20M50 64h20" stroke="#D9CDB8" stroke-width=".5"/>`,
        `<radialGradient id="${g}"><stop offset="0" stop-color="${Y}" stop-opacity=".45"/><stop offset="1" stop-color="${Y}" stop-opacity="0"/></radialGradient>`],
      // 나무 삼각대 + 소파 팔걸이, 갓 아래 빛 원뿔 (타원은 둥근 상판처럼 보여서)
      tripod: [sh(`<rect x="88" y="58" width="32" height="26" rx="4" fill="${FILL}"/>`) + lit('path d="M43 38L30 84H90L77 38Z"', .3) + `<path d="M60 36L44 84M60 36L76 84M60 36V84" stroke="#8B6A4E" stroke-width="2"/><path d="M47 16h26l5 22h-36z" fill="#F4EEE4" stroke="#D9CDB8"/>`],
      // 협탁 위 트래버틴 베이스, 갓 위아래로 빛
      travertine: [lit('path d="M44 20L36 4H84L76 20Z"', .2) + `<rect x="20" y="70" width="80" height="4" fill="#C9A77C"/><rect x="24" y="74" width="72" height="16" fill="#B8935F"/>${sh('<path d="M50 70Q44 56 52 48H68Q76 56 70 70Z" fill="#D8CBB6"/>')}<path d="M49 54H71M48.5 59H71.5M49 64H71" stroke="#BFAF96" stroke-width=".6"/><rect x="58" y="42" width="4" height="6" fill="#B8955A"/>${lit('ellipse cx="60" cy="44" rx="24" ry="4"', .45)}<path d="M42 20H78L82 42H38Z" fill="#F1EADF" stroke="#DCD2C3" stroke-width=".5"/>`],
      // 테이블 위 버섯 갓
      mushroom: [`<rect y="72" width="120" height="18" fill="#E6D7BE"/>${lit('ellipse cx="60" cy="52" rx="24" ry="5"', .45)}${sh('<rect x="57" y="48" width="6" height="22" fill="#D9A441"/><ellipse cx="60" cy="71" rx="12" ry="3" fill="#C9932F"/><path d="M38 48Q38 24 60 24Q82 24 82 48Z" fill="#D9A441"/>')}<path d="M46 34Q52 27 62 27" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>`],
      // 왼쪽 벽 스윙암이 침대 베개를 비춤
      swing: [sh(`<rect x="70" y="60" width="50" height="24" fill="${FILL}"/>`) + sh('<rect x="78" y="62" width="20" height="8" rx="3" fill="#F4EFE7"/>') + sh(`<circle cx="16" cy="34" r="5" fill="#262626"/><polyline points="16,34 46,28 68,38" fill="none" stroke="${M.fill}" stroke-width="2"/><circle cx="46" cy="28" r="2" fill="#262626"/><circle cx="68" cy="38" r="2" fill="#262626"/><path d="M62 38L76 38L80 52L58 52Z" fill="#262626"/>`) + lit('path d="M58 52L50 84H88L80 52Z"'), M.def],
    };
    const [b, d] = L[o] || L.paper;
    return svg(`<rect width="120" height="90" fill="#F7F4EF"/><rect y="84" width="120" height="6" fill="${FILL}"/>${b}`, d);
  };

  // 식탁 펜던트: 같은 식탁 위에 등만 바꿔 건 장면, 켜진 등이라 그림자 없음. o: 'dome'|'globe'|'paper'|'linear'|'rattan'
  const pendant = (o = {}) => {
    const Y = '#FFE7B8', g = id('pg'), M = paint('black', id('pm')), A = paint('gold', id('pa')), r = rnd(2);
    const lit = (shape, op = .38) => `<${shape} fill="${Y}" fill-opacity="${op}"/>`;
    const cord = (x, y2, w = .6) => `<line x1="${x}" y1="8" x2="${x}" y2="${y2}" stroke="#555" stroke-width="${w}"/>`;
    const rg = (a, b, oa = 1, ob = 1) => `<radialGradient id="${g}"><stop offset="0" stop-color="${a}" stop-opacity="${oa}"/><stop offset="1" stop-color="${b}" stop-opacity="${ob}"/></radialGradient>`;
    const P = {
      // 검은 금속 반구 돔 + 아래로 모이는 빛 (전선이 꼭대기에 닿게 원호)
      dome: [cord(60, 32) + `<path d="M42 50A18 18 0 0 1 78 50Z" fill="${M.fill}"/><path d="M42 50H78" stroke="#6A6A6A" stroke-width=".8"/><path d="M57 50a3 3 0 0 0 6 0z" fill="#FFF6DD"/>` + lit('path d="M44 50L30 74H90L76 50Z"'), M.def],
      // 오팔 유리구 두 개, 사방으로 번지는 빛
      globe: [`<g fill="${Y}" opacity=".3"><circle cx="44" cy="40" r="20"/><circle cx="76" cy="40" r="20"/></g>` + lit('ellipse cx="60" cy="73" rx="34" ry="4"', .4) + [44, 76].map(x => cord(x, 26) + `<rect x="${x - 3}" y="26" width="6" height="3" fill="${A.fill}"/><circle cx="${x}" cy="40" r="11" fill="url(#${g})" stroke="#00000018"/>`).join(''), A.def + rg('#FBF8F2', '#ECE6DC')],
      // 종이 갓: 타원 폭에 맞춘 가로 리브
      paper: [lit('ellipse cx="60" cy="73" rx="30" ry="4"', .4) + cord(60, 22) + `<ellipse cx="60" cy="44" rx="18" ry="22" fill="#FBF6EA" stroke="#D9CDB8" stroke-width=".5"/><ellipse cx="60" cy="44" rx="18" ry="22" fill="url(#${g})"/>${[26, 32, 38, 44, 50, 56, 62].map(y => { const w = 18 * Math.sqrt(1 - ((y - 44) / 22) ** 2); return `<line x1="${(60 - w).toFixed(2)}" y1="${y}" x2="${(60 + w).toFixed(2)}" y2="${y}" stroke="#D9CDB8" stroke-width=".5"/>`; }).join('')}`, rg(Y, Y, .35, 0)],
      // 일자 바 + 아랫면 발광
      linear: [cord(30, 42, .5) + cord(90, 42, .5) + `<rect x="26" y="42" width="68" height="4" rx="2" fill="${M.fill}"/>` + lit('path d="M26 47L16 74H104L94 47Z"') + '<rect x="26" y="46" width="68" height="1.2" fill="#FFF6DD"/>', M.def],
      // 라탄 반구: 사선 격자 + 벽에 흩어진 빛 점
      rattan: [Array.from({ length: 12 }, () => lit(`circle cx="${(6 + r() * 108).toFixed(1)}" cy="${(12 + r() * 54).toFixed(1)}" r="1.6"`, .45)).join('') + cord(60, 26) + `<path d="M34 52A26 26 0 0 1 86 52Z" fill="#C9A274"/><path d="M34 52A26 26 0 0 1 86 52Z" fill="url(#${g})"/>` + lit('path d="M36 52L24 74H96L84 52Z"'),
        `<pattern id="${g}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M2 0V4M0 2H4" stroke="#9C7A52" stroke-width=".7"/></pattern>`],
    };
    const [b, d] = P[o] || P.dome;
    return svg(`<rect width="120" height="90" fill="#F7F4EF"/><rect width="120" height="8" fill="#E9E4DC"/><rect x="14" y="74" width="92" height="4" fill="#D1B38A"/><rect x="20" y="78" width="3" height="12" fill="#B8935F"/><rect x="97" y="78" width="3" height="12" fill="#B8935F"/>${b}`, d);
  };

  // 실링팬 (3/4 투시). 국내 천장고 약 2.3m라 모두 천장 밀착형, 아래 y40~90은 비움. o: wood|white|slim|bladeless
  // 실링팬 (3/4 투시). 국내 천장고 약 2.3m라 모두 천장 밀착형, 아래 y40~90은 비움. o: 'none'|'wood'|'white'|'slim'|'bladeless' (+ black|light|hugger) 또는 {type}
  const fan = (arg = {}) => {
    const o = typeof arg === 'string' ? arg : arg.type;
    const pair = s => `${s}<g transform="matrix(-1 0 0 1 120 0)">${s}</g>`; // 좌우 대칭 날개
    const side = 'M60 15L14 21Q11 24 15 26L60 21Z', front = 'M60 17L52 35Q60 39 68 35Z';
    const thin = pair('<path d="M60 11.5L10 13.4L10.4 15.8L60 13.6Z"/>') + '<path d="M58.6 12.6L54 24H66L61.4 12.6Z"/>';
    // 나무·검정 날개 팬: 날개색 c, 몸체색 m, 결 선 색 hl
    const blades = (c, m, hl) => pair(`<path d="${side}" fill="${c}"/><path d="M57 17.5Q37 19.6 18 22.2M57 19.5Q37 21.6 18 23.9" fill="none" stroke="${hl}" stroke-opacity=".2" stroke-width=".5"/>`)
      + `<g opacity=".85"><path d="${front}" fill="${c}"/><path d="M58.5 20L55.5 36M61.5 20L64.5 36" stroke="${hl}" stroke-opacity=".2" stroke-width=".5"/></g>`
      + `<rect x="52" y="8" width="16" height="4" fill="${m}"/><ellipse cx="60" cy="15" rx="11" ry="5" fill="${m}"/>`;
    const F = {
      // 기준 선택지: 천장 띠 + 매입등 하나 (켜진 등: 그림자 없음). 원뿔 없음 — 어떤 팬의 빛보다 커서 '아무것도 없음'이 조명 옵션으로 읽혔음 → 트림 아래 작은 번짐 + 옅은 바닥 빛만. getter: gradient id를 이 종류일 때만 새로 받음
      get none() {
        const g = id('fg');
        return `<defs><radialGradient id="${g}"><stop offset="0" stop-color="#FFE7B8" stop-opacity=".3"/><stop offset="1" stop-color="#FFE7B8" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="10.4" r="10" fill="url(#${g})"/><ellipse cx="60" cy="60" rx="16" ry="4" fill="#FFE7B8" fill-opacity=".12"/>`
          + '<rect x="50" y="7.2" width="20" height="2.8" rx="1.4" fill="#FFFFFF" stroke="#D6CFC5" stroke-width=".6"/><rect x="53" y="9.4" width="14" height="1.4" rx=".7" fill="#FFF6DD"/>';
      },
      wood: blades('#6E4C36', '#3A3A3A', '#000'),
      black: blades('#2B2B2B', '#171717', '#fff'),
      white: '<ellipse cx="60" cy="58" rx="34" ry="10" fill="#FFE7B8" fill-opacity=".35"/>'
        + `<g fill="#F4F2EE" stroke="#00000022">${pair(`<path d="${side}"/><path d="M60 16L30 30Q30 34 35 33Z"/>`)}<path d="${front}"/></g>`
        + '<rect x="52" y="8" width="16" height="4" fill="#E8E6E2"/><ellipse cx="60" cy="15" rx="11" ry="5" fill="#E8E6E2"/><path d="M51 19q9 10 18 0z" fill="#FFF6E0" stroke="#00000022"/>',
      // 조명 일체형: 날개는 옆으로만, 몸체 아래에 켜진 유리 구
      light: '<ellipse cx="60" cy="62" rx="34" ry="9" fill="#FFE7B8" fill-opacity=".35"/><circle cx="60" cy="29" r="22" fill="#FFE7B8" fill-opacity=".3"/>'
        + `<g fill="#C9B79C" stroke="#00000022">${pair(`<path d="${side}"/>`)}</g>`
        + '<rect x="52" y="8" width="16" height="4" fill="#8C8C86"/><ellipse cx="60" cy="15" rx="11" ry="5" fill="#8C8C86"/><rect x="57.5" y="19" width="5" height="3" fill="#8C8C86"/><circle cx="60" cy="29" r="8" fill="#FFF6DD" stroke="#E4D6B8" stroke-width=".6"/>',
      slim: `<g transform="translate(1.5 2)" fill="#000" fill-opacity=".1">${thin}</g><g fill="#E9E7E3" stroke="#00000040" stroke-width=".5">${thin}</g><ellipse cx="60" cy="11" rx="14" ry="3.2" fill="#F4F3F0" stroke="#00000040" stroke-width=".5"/>`,
      bladeless: '<ellipse cx="60" cy="58" rx="40" ry="10" fill="#FFE7B8" fill-opacity=".3"/><ellipse cx="60" cy="14" rx="36" ry="7" fill="#FFF9EE" stroke="#00000022" stroke-width=".5"/>'
        + '<ellipse cx="60" cy="15" rx="11" ry="3" fill="#E9E4DC" stroke="#C9C1B5" stroke-width=".6"/><ellipse cx="60" cy="15" rx="7" ry="1.9" fill="none" stroke="#C9C1B5" stroke-width=".5"/><ellipse cx="60" cy="15" rx="3" ry=".9" fill="#C9C1B5"/>'
        + '<path d="M50 23Q47 31 40 37M60 24V36M70 23Q73 31 80 37M40.6 33.6L40 37L43.4 36.6M57.6 33.6L60 36L62.4 33.6M76.6 36.6L80 37L79.4 33.6" fill="none" stroke="#9FB4BC" stroke-opacity=".8" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/>', // 송풍 그릴 + 아래로 퍼지는 바람 (세로 물결선은 김으로 읽혀서 화살표)
    };
    F.hugger = F.slim; // 밀착형 = 천장에 붙은 얇은 날개 (옛 설계안 id)
    return room(`<rect width="120" height="8" fill="#E9E4DC"/>${F[o] || F.wood}`);
  };

  // 침대·책상 곁 스위치·콘센트 (기능 도식, 카드 아래 캡션 있음). o: 'threeway'|'wireless'|'height'|'keep'
  const power = (o = {}) => {
    const A = '#C9A35B', WAVE = '#9FB4BC', B = '#CDBFAE';
    const ln = (d, c = INK, w = .6, x = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"${x}/>`;
    const bed = `<rect y="82" width="120" height="8" fill="${FILL}"/><rect x="34" y="46" width="52" height="16" fill="${FILL}" stroke="${INK}" stroke-width=".5"/><rect x="34" y="62" width="52" height="12" fill="#EFE7DA"/><rect x="34" y="74" width="52" height="8" fill="${B}"/>`; // 침대 입면 공통
    const stand = x => `<rect x="${x}" y="66" width="16" height="16" fill="${B}" stroke="${INK}" stroke-width=".5"/>`;
    const ghost = (x, y, s, op) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="none" stroke="${INK}" stroke-width=".5" stroke-dasharray="1 1" opacity="${op}"/>`; // 가려진·예전 콘센트
    const bulb = (x, y) => `<circle cx="${x}" cy="${y}" r="4" fill="#FFF1CC" stroke="${INK}" stroke-width=".5"/>`;
    const P = {
      threeway: ln('M18 80H12V10H108V80H34', INK, 1.5) + ln('M18 80V64', INK, 1) + ln('M18 64A16 16 0 0 1 34 80', INK, .5, ' stroke-dasharray="1.5 1"') +
        `<rect x="56" y="14" width="40" height="46" fill="${FILL}" stroke="${INK}" stroke-width=".6"/><rect x="60" y="17" width="14" height="6" fill="#F4EFE7"/><rect x="78" y="17" width="14" height="6" fill="#F4EFE7"/>` +
        ln('M38 76Q42 52 60 45Q56 28 52 18', A, .8, ' stroke-dasharray="2 1.5"') + bulb(60, 45) + ln('M57.2 42.2l5.6 5.6m0-5.6l-5.6 5.6', INK, .5) +
        [[38, 76], [52, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="none" stroke="${A}" stroke-width=".6"/><circle cx="${x}" cy="${y}" r="2.2" fill="${INK}"/>`).join(''),
      wireless: bed + stand(14) + ln('M60 0V5') + `<rect x="58" y="5" width="4" height="3" fill="${INK}"/>` + bulb(60, 12) +
        `<rect x="92" y="48" width="9" height="9" rx="2.5" fill="#FFFFFF" stroke="${INK}" stroke-width=".6"/>` + ln('M94.5 51H98.5M94.5 54H98.5', INK, .5) +
        [5, 8, 11].map(r => ln(`M${(92 - r * .91).toFixed(2)} ${(48 - r * .42).toFixed(2)}A${r} ${r} 0 0 1 ${(92 + r * .09).toFixed(2)} ${48 - r}`, WAVE, .9)).join('') + // 스위치 왼쪽 위로 퍼지는 전파
        ln('M86 38Q76 22 66 15', WAVE, .8, ' stroke-dasharray="2 1.5"'),
      height: bed + stand(14) + stand(90) + ghost(20, 76, 4, .3) + ghost(96, 76, 4, .3) +
        [19.5, 95.5].map(x => `<rect x="${x}" y="59" width="5" height="6" fill="#FFFFFF" stroke="${INK}" stroke-width=".6"/><circle cx="${x + 1.6}" cy="62" r=".6" fill="${INK}"/><circle cx="${x + 3.4}" cy="62" r=".6" fill="${INK}"/>`).join('') +
        ln('M102 66V58') + `<path d="M97 58H107L105 52H99Z" fill="#F4E2BF" stroke="${INK}" stroke-width=".5"/>`,
      keep: bed + `<rect x="4" y="24" width="20" height="58" fill="none" stroke="${INK}" stroke-width=".8"/><circle cx="20" cy="55" r="1" fill="${INK}"/><rect x="26" y="45" width="5" height="8" fill="#FFFFFF" stroke="${INK}" stroke-width=".6"/>` +
        ghost(80, 76, 5, .35) + ln('M29 54V82', '#9C948A', .5, ' stroke-dasharray="1.5"') +
        `<text x="29" y="68" font-size="5" fill="${INK}" text-anchor="middle" transform="rotate(-90 29 68)" dy="1.8" stroke="#F7F4EF" stroke-width="1.6" paint-order="stroke">1.2m</text>`,
    };
    return room(P[o] || P.keep);
  };

  // 욕실 정면 입면: 벽 타일 + 바닥 띠 + 세면대·거울·수전. 한 화면에서는 비교하는 것 하나만 바꾸고 나머지는 중립으로 둠.
  // o: { tile: tile() 옵션(벽에 nest), grout, sheen: matte|satin|polished, vanity: floatunder|topbowl|halfped|tileclad|legs,
  //      mirror: rect|round|arch|cabinet|oct, light: halo|under, metal: METALS 키(수전·테), wood: 탑볼장 우드(WOODS 키·#hex) }
  const bath = (o = {}) => {
    const t = { ...o.tile }, tc = t.color || '#E9E4DC', sheen = o.sheen || t.sheen, V = ['topbowl', 'halfped', 'tileclad', 'legs'].includes(o.vanity) ? o.vanity : 'floatunder', Lt = o.light;
    if (o.grout) t.grout = o.grout;
    delete t.sheen; // 광택은 여기서 직접 덮음: 타일 생성기 버전과 상관없이 같은 모습
    const n = parseInt(tc.slice(1), 16), lum = ((n >> 16) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11) / 255;
    let defs = '';
    const wallTile = (x = 0, y = 0, w = 120, h = 80) => nest(tile(t), x, y, w, h).replace(/stroke-width="(\d*\.\d+)"/g, (m, w) => +w < .5 ? 'stroke-width=".5"' : m);
    const mf = paint(o.metal || 'nickel', id('bm')), br = paint('brass', id('bb')); defs += mf.def + br.def;
    const sh = s => `<g fill="#000" fill-opacity=".15" transform="translate(1.5 2)">${s}</g>`; // 같은 도형을 옮긴 그림자
    const ln = (d, c, w = .5, a = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-opacity="${a}" stroke-width="${w}"/>`;
    const blur = (sd, w = 160) => { const f = id('bf'); defs += `<filter id="${f}" x="-${w / 2}%" y="-${w / 2}%" width="${100 + w}%" height="${100 + w}%"><feGaussianBlur stdDeviation="${sd}"/></filter>`; return `url(#${f})`; };

    // 수전: 상판 위 L자 한 덩어리 + 반대쪽으로 뻗은 레버 (x 줄기, y 상판 높이, h 줄기 높이, d 주둥이 방향)
    const tap = (x, y, h = 8, d = 1) => {
      const q = (dx, dy) => `${+(x + d * dx).toFixed(2)} ${+(y + dy).toFixed(2)}`, T = -h - 2.6; // T: 주둥이 윗선
      const s = `M${q(-3, 0)}L${q(-3, -1.4)}L${q(-1.3, -1.4)}L${q(-1.3, T + 1.3)}Q${q(-1.3, T)} ${q(0, T)}L${q(7.4, T)}Q${q(8.7, T)} ${q(8.7, T + 1.3)}L${q(8.7, -h + 2.2)}L${q(6.1, -h + 2.2)}L${q(6.1, -h)}L${q(1.3, -h)}L${q(1.3, -1.4)}L${q(3, -1.4)}L${q(3, 0)}Z`;
      const lv = `<rect x="${+(d > 0 ? x - 6.4 : x + 1.9).toFixed(2)}" y="${y - h + 1.6}" width="4.5" height="1.5" rx=".75"/>`;
      return sh(`<path d="${s}"/>${lv}`) + `<g fill="${mf.fill}" stroke="#000" stroke-opacity=".25" stroke-width=".5"><path d="${s}"/>${lv}</g>` + ln(`M${+(x - d * .3).toFixed(2)} ${y - h + 1}V${y - 3}`, '#fff', .5, .75);
    };

    const MI = { // 거울 도형(b 아래 y, w 아래빛 폭, r 반사선 위치). 거울을 안 고른 화면(벽·세면대 비교)은 작고 얌전한 def
      def: { b: 38, w: 40, s: a => `<rect x="40" y="8" width="40" height="30" rx="1.2" ${a}/>`, r: [44, 11] },
      rect: { b: 42, w: 50, s: a => `<rect x="35" y="6" width="50" height="36" rx="1.2" ${a}/>`, r: [39, 10] },
      round: { b: 42.5, w: 38, s: a => `<circle cx="60" cy="23.5" r="19" ${a}/>`, r: [46, 9.5] },
      arch: { b: 43, w: 32, s: a => `<path d="M44 43V19A16 16 0 0 1 76 19V43Z" ${a}/>`, r: [48, 11] },
      cabinet: { b: 42, w: 76, s: a => `<rect x="22" y="6" width="76" height="36" rx="1" ${a}/>`, r: [27, 11] },
      oct: { b: 42.5, w: 38, s: a => `<path d="M67.87 4.5H52.13L41 15.63V31.37L52.13 42.5H67.87L79 31.37V15.63Z" ${a}/>`, r: [46, 9.5] },
    };
    const M = MI[o.mirror || 'def'] || MI.def, Mi = o.mirror || 'def';
    const ref = ([x, y]) => ln(`M${x} ${y + 7}l7 -7`, '#fff', 1, .8) + ln(`M${x + 2} ${y + 11}l9 -9`, '#fff', 1, .6); // 거울 반사선
    const mirror = () => {
      let g = '';
      if (Lt === 'halo') { // 뒤에서 번지는 빛: 3000K를 거울보다 2.5u 크게 블러 + 넓은 퍼짐
        const K = kelvin(3000);
        g += `<g filter="${blur(5)}">${M.s('fill="#FFE7B8" stroke="#FFE7B8" stroke-width="14" opacity=".3"')}</g><g filter="${blur(2.5)}">${M.s(`fill="${K}" stroke="${K}" stroke-width="5" opacity=".6"`)}</g>`;
      }
      g += sh(M.s(''));
      if (Mi === 'arch') g += M.s('fill="#DCE6EA" stroke="#000" stroke-opacity=".3" stroke-width="2.9"') + M.s(`fill="none" stroke="${mf.fill}" stroke-width="1.6"`) + ref(M.r);
      else if (Mi === 'oct') g += M.s('fill="#DCE6EA" stroke="#000" stroke-opacity=".3" stroke-width="2.6"') + M.s(`fill="none" stroke="${br.fill}" stroke-width="1.4"`) + ref(M.r);
      else if (Mi === 'cabinet') g += M.s('fill="#ECE8E2" stroke="#CFC8BD" stroke-width=".6"') + [24, 60.5].map(x => `<rect x="${x}" y="8" width="35.5" height="32" fill="#DCE6EA" stroke="#C3CED4" stroke-width=".6"/>${ref([x + 4, 12])}`).join('') + `<rect x="98" y="6" width="2.2" height="36" fill="#000" fill-opacity=".1"/>` + ln('M22 6.6H98', '#fff', .5, .8);
      else g += M.s('fill="#DCE6EA" stroke="#B4C3CA" stroke-width=".7"') + ref(M.r); // 프레임리스: 테 없이 얇은 선
      if (Lt === 'under') {
        const g1 = id('ug'), x0 = 60 - M.w / 2, x1 = 60 + M.w / 2;
        defs += `<linearGradient id="${g1}" x2="0" y2="1"><stop offset="0" stop-color="#FFE7B8" stop-opacity=".85"/><stop offset="1" stop-color="#FFE7B8" stop-opacity=".08"/></linearGradient>`;
        g = `<path d="M${x0} ${M.b}H${x1}L${x1 + 7} ${M.b + 14}H${x0 - 7}Z" fill="url(#${g1})"/>` + g + `<rect x="${x0}" y="${M.b}" width="${M.w}" height="1.8" fill="#FFF6DD" stroke="#E9C98F" stroke-width=".5"/>`;
      }
      return g;
    };

    // 세면대·하부장: [그림, 수전 위치] — 수전은 맨 위에 따로 얹음
    const tone = '#D9CFC2', rim = '#D8D2C7';
    let tapAt = [60, 51.5, 8, 1], pre = '';
    if (V === 'floatunder') { // x32~88 y54~68, 벽에 뜬 장 + 얇은 상판
      pre = sh('<rect x="32" y="54" width="56" height="14"/>') + `<rect x="32" y="54" width="56" height="14" fill="${tone}"/><rect x="32" y="54" width="56" height="1.4" fill="#000" fill-opacity=".1"/>` + ln('M60 55V68', '#000', .5, .14) + `<rect x="30" y="51.5" width="60" height="3" rx=".8" fill="#EFEBE4" stroke="${rim}" stroke-width=".5"/><rect x="33" y="68" width="55" height="3" fill="#000" fill-opacity=".07"/>`;
      tapAt = [56, 51.5, 8, 1];
    } else if (V === 'topbowl') { // 상판 #CDBFAE + 볼 + 우드장
      const wc = String(o.wood || 'oak'), wd = WOODS[wc.replace('wood:', '')] || wc.replace('wood:', ''), gr = rnd(41); // 나뭇결은 선 두께 0.5 이상으로 직접 그림
      const grain = Array.from({ length: 7 }, (_, k) => ln(`M32 ${(58.2 + k * 3.3 + gr() * 1.2).toFixed(1)}q14 ${((gr() - .5) * 2.2).toFixed(1)} 28 0t28 0`, shift(wd, -26), .5, .45)).join('');
      pre = sh('<rect x="32" y="56" width="56" height="24"/>') + `<rect x="32" y="56" width="56" height="24" fill="${wd}" stroke="#000" stroke-opacity=".2" stroke-width=".5"/>` + grain + ln('M32 68H88M60 56V68', '#000', .5, .3) + `<rect x="32" y="56" width="56" height="1.6" fill="#000" fill-opacity=".14"/>` + [[46, 62], [74, 62], [46, 74], [74, 74]].map(([x, y]) => `<rect x="${x - 3}" y="${y}" width="6" height="1.2" rx=".6" fill="${mf.fill}"/>`).join('') +
        sh('<rect x="28" y="52" width="64" height="4" rx="1"/>') + `<rect x="28" y="52" width="64" height="4" rx="1" fill="#CDBFAE"/><rect x="28" y="52" width="64" height="1" fill="#fff" fill-opacity=".35"/>` +
        sh('<path d="M45 44C45 50 51 52 60 52S75 50 75 44Z"/>') + `<path d="M45 44C45 50 51 52 60 52S75 50 75 44Z" fill="#FBFAF8" stroke="${rim}" stroke-width=".6"/><ellipse cx="60" cy="44" rx="15" ry="2.6" fill="#F1EEE9" stroke="${rim}" stroke-width=".6"/><ellipse cx="60" cy="44.4" rx="12" ry="1.8" fill="#DDD8CF"/>`;
      tapAt = [79, 52, 17, -1];
    } else if (V === 'halfped') { // 벽걸이 세면대 + 짧은 반다리(바닥에 닿지 않음), 장 없이 타일 배경이 보임
      pre = sh('<rect x="34" y="47" width="52" height="4" rx="1.5"/><path d="M36 51H84Q84 62 60 62Q36 62 36 51Z"/><path d="M52 61H68L66.5 74H53.5Z"/>') +
        `<path d="M52 61H68L66.5 74H53.5Z" fill="#EFECE6" stroke="${rim}" stroke-width=".6"/><path d="M36 51H84Q84 62 60 62Q36 62 36 51Z" fill="#F7F5F1" stroke="${rim}" stroke-width=".6"/><rect x="34" y="47" width="52" height="4" rx="1.5" fill="#FDFCFA" stroke="${rim}" stroke-width=".6"/><ellipse cx="60" cy="49" rx="20" ry="1" fill="#E4E0D8"/>` + ln('M38 54Q60 58 82 54', '#000', .5, .08);
      tapAt = [56, 47, 8, 1];
    } else if (V === 'tileclad') { // x32~88 y52~72: 벽과 같은 타일을 입힌 조적 세면대 (벽과 줄눈이 어긋나게 비켜 놓음)
      const c = id('tc');
      defs += `<clipPath id="${c}"><rect x="32" y="52" width="56" height="20"/></clipPath>`;
      pre = sh('<rect x="32" y="52" width="56" height="20"/>') + `<g clip-path="url(#${c})"><rect x="32" y="52" width="56" height="20" fill="${tc}"/>${wallTile(4.5, 3, 120, 90)}<rect x="32" y="52" width="56" height="20" fill="${lum > .5 ? '#000' : '#fff'}" fill-opacity="${lum > .5 ? .04 : .09}"/></g><rect x="32" y="52" width="56" height="20" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".6"/><rect x="32" y="52" width="56" height="2" fill="#fff" fill-opacity=".4"/><rect x="86" y="52" width="2" height="20" fill="#000" fill-opacity=".08"/><rect x="33" y="72" width="55" height="3" fill="#000" fill-opacity=".07"/>`;
      tapAt = [56, 52, 8, 1];
    } else if (V === 'legs') { // 몰딩 도어 + 다리 4개, 클래식 가구형
      const leg = x => `<path d="M${x - 2.6} 71.4H${x + 2.6}L${x + 1.8} 74.2Q${x + 3.2} 76 ${x + 1.6} 77.4L${x + 1.8} 80H${x - 1.8}L${x - 1.6} 77.4Q${x - 3.2} 76 ${x - 1.8} 74.2Z"/>`;
      const legs = [34.5, 46, 74, 85.5].map(leg).join('');
      pre = sh('<rect x="32" y="54.4" width="56" height="17"/>') + `<g fill="#F3EFE8" stroke="${rim}" stroke-width=".6">${legs}</g><rect x="32" y="54.4" width="56" height="17" fill="#F3EFE8" stroke="${rim}" stroke-width=".6"/>` +
        [34, 62].map(x => `<rect x="${x}" y="56.6" width="24" height="12.4" fill="none" stroke="#000" stroke-opacity=".22" stroke-width=".6"/><rect x="${x + 1.5}" y="58.1" width="21" height="9.4" fill="none" stroke="#fff" stroke-width=".8"/><rect x="${x + 1.5}" y="58.1" width="21" height="9.4" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".5"/>`).join('') +
        `<rect x="32" y="69.4" width="56" height="2" fill="#E6E0D4"/>` + [58.6, 61.4].map(x => `<circle cx="${x}" cy="62.8" r="1.1" fill="${mf.fill}"/>`).join('') +
        sh('<rect x="29" y="51" width="62" height="3.4" rx=".8"/>') + `<rect x="29" y="51" width="62" height="3.4" rx=".8" fill="#FBFAF8" stroke="${rim}" stroke-width=".5"/>`;
      tapAt = [56, 51, 8, 1];
    }

    // 벽 → (타일 세면대) → 광택 → 바닥 → 거울 → 세면대 → 수전
    const k = sheen === 'polished' ? 1 : sheen === 'satin' ? .45 : 0; // 원칙 15: satin = polished 투명도 ×0.45
    let shine = '';
    if (k) {
      const g = id('sg'), d = id('sd');
      const A = (nm, st, c) => `<linearGradient id="${nm}" x1="0" y1="0" x2="1" y2="1">${st.map(([s, a]) => `<stop offset="${s}" stop-color="${c}" stop-opacity="${+(a * k).toFixed(3)}"/>`).join('')}</linearGradient>`;
      defs += A(g, [[0, 0], [.3, 0], [.42, .38], [.5, 0], [.62, .14], [.7, 0], [1, 0]], '#fff') + A(d, [[0, 0], [.14, .09], [.3, 0], [.5, .13], [.56, .13], [.64, 0], [.84, .08], [1, .13]], '#000'); // 흰 광택 띠 옆에 어두운 반사 띠: 흰 타일에서도 광택이 읽히게
      shine = `<rect width="120" height="80" fill="url(#${d})"/><rect width="120" height="80" fill="url(#${g})"/><ellipse cx="84" cy="30" rx="18" ry="6" fill="#fff" fill-opacity="${+(.25 * k).toFixed(3)}" filter="${blur(2, 120)}"/>`;
    }
    const fl = shift(tc, -22);
    const floor = `<rect y="80" width="120" height="10" fill="${fl}"/>${ln('M0 85H120', shift(fl, -16), .5)}${ln('M18 80V90M54 80V90M90 80V90', shift(fl, -16), .5)}<rect y="80" width="120" height="1" fill="#000" fill-opacity=".14"/>`;
    const wall = `<rect width="120" height="80" fill="${tc}"/>${wallTile()}`;
    const clad = V === 'tileclad';
    return svg(wall + (clad ? pre : '') + shine + floor + mirror() + (clad ? '' : pre) + tap(...tapAt), defs);
  };

  // 붙박이장 정면(방 한쪽 벽 전체): x10~110 y6~84, 4짝. o: { style: flat|wood|frame|glass|gansal|mirror|mixed, color, finish }
  // color: flat·frame·mirror·mixed = 바탕색(#hex), wood·gansal = CM1 우드('#hex' | WOODS 키 | 'wood:<톤>', 기본 오크). finish: frame·glass는 기본 gold, mixed 행거봉은 기본 nickel
  const closet = (o = {}) => {
    const { style = 'flat' } = o, wooden = style === 'wood' || style === 'gansal';
    const c0 = o.color || (wooden ? 'oak' : '#F1EFEA'), tone = String(c0).replace(/^wood:/, ''), wb = WOODS[tone] || tone;
    const X = [10, 35, 60, 85], ED = 'stroke="#000" stroke-opacity=".2" stroke-width=".5"';
    let defs = '';
    const leaf = (x, fill, extra = '') => `<rect x="${x}" y="6" width="25" height="78" fill="${fill}" ${ED}/>${extra}`;
    const fin = paint(o.finish || (style === 'mixed' ? 'nickel' : 'gold'), id('cf')), cm = METALS[o.finish] || (style === 'mixed' ? METALS.nickel : METALS.gold);
    defs += fin.def;
    // 옷걸이에 걸린 옷 실루엣(길이·색을 번갈아, 포개지지 않게 cap으로 길이 제한)
    const COL = ['#EDE6D8', '#B9B1A5', '#8C8C86', '#C98F6B', '#6E6A64', '#D8CFC2', '#A3B09B', '#7C6A58'], LEN = [24, 33, 20, 36, 26, 30, 22, 34];
    const cloth = (x, k, cap = 40) => {
      const len = Math.min(LEN[k % 8], cap), w = len > 30 ? 5.4 : 4.6;
      return `<path d="M${x - w} 18L${x - 1.4} 15.8H${x + 1.4}L${x + w} 18V${15.5 + len}H${x - w}Z" fill="${COL[k % 8]}"/><rect x="${x - .4}" y="13" width=".8" height="3" fill="#6E6A64"/>`;
    };
    let body = '';
    if (style === 'wood' || style === 'gansal') {
      const g = id('cw');
      if (style === 'wood') {
        const r = rnd(345679);
        let bd = '', dk = '', lt = '';
        r();
        for (let x = 0; x < 100;) { const w = 2.5 + r() * 5; bd += `<rect x="${x.toFixed(1)}" width="${w.toFixed(1)}" height="78" fill="${r() < .5 ? '#fff' : '#000'}" fill-opacity="${(.02 + r() * .035).toFixed(3)}"/>`; x += w; }
        for (let x = .6; x < 100; x += 1.1 + r() * 2) for (let k = 0; k < 2; k++) { // 세로결: 위아래가 고르게 차도록 시작점을 위쪽 바깥까지 흩뿌림
          const y = -30 + r() * 85, n = 30 + r() * 40, d = `M${(x + k * .5).toFixed(1)} ${y.toFixed(1)}q${((r() - .5) * 1.2).toFixed(1)} ${(n / 4).toFixed(1)} 0 ${(n / 2).toFixed(1)}t0 ${(n / 2).toFixed(1)}`;
          if (r() < .65) dk += d; else lt += d;
        }
        defs += `<pattern id="${g}" x="10" y="6" width="100" height="78" patternUnits="userSpaceOnUse"><rect width="100" height="78" fill="${wb}"/>${bd}<path d="${dk}" fill="none" stroke="${shift(wb, -28)}" stroke-opacity=".55" stroke-width=".55"/><path d="${lt}" fill="none" stroke="${shift(wb, 18)}" stroke-opacity=".6" stroke-width=".55"/></pattern>`;
        body = X.map((x, i) => leaf(x, `url(#${g})`, `<rect x="${x}" y="6" width="25" height="78" fill="${i % 2 ? '#000' : '#fff'}" fill-opacity="${[.05, .04, .03, .05][i]}"/>`)).join('');
      } else { // 간살: 문틀(상하 레일·좌우 기둥) 안에 7줄(약 3u 간격) 살 + 사이로 보이는 어두운 뒷판
        defs += `<pattern id="${g}" x="11.56" y="0" width="3.125" height="10" patternUnits="userSpaceOnUse"><rect width="3.125" height="10" fill="${shift(wb, -78)}"/><rect width="2.1" height="10" fill="${wb}"/><rect width=".5" height="10" fill="#fff" fill-opacity=".3"/><rect x="1.7" width=".4" height="10" fill="#000" fill-opacity=".14"/></pattern>`;
        body = X.map(x => leaf(x, wb, `<rect x="${x + 1.56}" y="9" width="21.875" height="72" fill="url(#${g})" ${ED}/>`)).join('');
      }
    } else if (style === 'frame') {
      const kn = id('ck');
      defs += `<radialGradient id="${kn}" cx=".35" cy=".3"><stop offset="0" stop-color="${cm[0]}"/><stop offset=".55" stop-color="${cm[1]}"/><stop offset="1" stop-color="${cm[3]}"/></radialGradient>`;
      const pan = (x, y, h) => `<rect x="${x + 2.5}" y="${y}" width="20" height="${h}" fill="#000" fill-opacity=".04" stroke="#000" stroke-opacity=".22" stroke-width=".5"/><path d="M${x + 2.5} ${y + h}H${x + 22.5}V${y}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width=".5"/>`;
      body = X.map((x, i) => {
        const cx = x + (i % 2 ? 1.7 : 23.3);
        return leaf(x, c0, pan(x, 8.5, 42) + pan(x, 53, 28.5) + `<circle cx="${cx + 1.5}" cy="49.2" r="1.4" fill="#000" fill-opacity=".15"/><circle cx="${cx}" cy="47.2" r="1.4" fill="url(#${kn})" stroke="${cm[3]}" stroke-width=".5"/>`);
      }).join('');
    } else if (style === 'mirror') {
      const mg = id('cm');
      const mf = id('cr');
      defs += `<linearGradient id="${mg}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#DFE7EA"/><stop offset="1" stop-color="#F7FAFB"/></linearGradient><linearGradient id="${mf}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9CFC2" stop-opacity="0"/><stop offset=".3" stop-color="#D9CFC2" stop-opacity=".55"/><stop offset="1" stop-color="#D9CFC2" stop-opacity=".55"/></linearGradient>`;
      body = X.map((x, i) => i === 1 || i === 2
        ? leaf(x, `url(#${mg})`, `<rect x="${x}" y="68" width="25" height="16" fill="url(#${mf})"/><rect x="${x + 1}" y="7" width="23" height="76" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width=".5"/><path d="M${x + 2} 84L${x + 11} 84L${x + 23} 6L${x + 14} 6Z" fill="#fff" fill-opacity=".4"/><path d="M${x + 12.5} 84H${x + 15}L${x + 25} 6H${x + 22.5}Z" fill="#fff" fill-opacity=".4"/>`)
        : leaf(x, c0)).join('');
    } else if (style === 'glass') { // 브론즈 유리 + 골드 프레임 + 안쪽 3000K 조명으로 옷이 비침
      const bk = id('cb'), gl = id('cg');
      defs += `<linearGradient id="${bk}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9C0"/><stop offset=".6" stop-color="#EBD7B2"/><stop offset="1" stop-color="#CDB68E"/></linearGradient><linearGradient id="${gl}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7B8" stop-opacity=".45"/><stop offset="1" stop-color="#FFE7B8" stop-opacity="0"/></linearGradient>`;
      const inner = `<rect x="10" y="6" width="100" height="78" fill="url(#${bk})"/><rect x="10" y="6" width="100" height="30" fill="url(#${gl})"/><rect x="12" y="8" width="96" height="1.4" fill="#FFF6DD"/><rect x="12" y="14" width="96" height="1" fill="#8C8C86"/>` +
        Array.from({ length: 12 }, (_, k) => cloth(16 + 7.9 * k, k)).join('') + '<rect x="12" y="54" width="96" height="1.4" fill="#F3E6CC"/>' +
        [[12, 57], [62, 57], [12, 70.5], [62, 70.5]].map(([x, y]) => `<rect x="${x}" y="${y}" width="46" height="12" fill="#EFE0C0" stroke="#000" stroke-opacity=".12" stroke-width=".5"/><rect x="${x + 17}" y="${y + 3}" width="12" height="1.2" fill="#8C8C86"/>`).join('');
      body = inner + X.map(x => `<rect x="${x}" y="6" width="25" height="78" fill="#B79C82" fill-opacity=".55"/><path d="M${x + 3} 84L${x + 10} 84L${x + 22} 6H${x + 15}Z" fill="#fff" fill-opacity=".14"/><rect x="${x + .7}" y="6.7" width="23.6" height="76.6" fill="none" stroke="${fin.fill}" stroke-width="1.4"/>`).join('') + `<rect x="10" y="6" width="100" height="30" fill="url(#${gl})" opacity=".6"/>`;
    } else if (style === 'mixed') { // 왼쪽 2짝 도어 + 오른쪽 오픈 행거
      const sg = id('cs');
      defs += `<linearGradient id="${sg}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`;
      body = `<rect x="60" y="6" width="50" height="78" fill="${shift(c0, -14)}" ${ED}/><rect x="60" y="6" width="7" height="78" fill="url(#${sg})"/><rect x="62" y="13.4" width="46" height="1.2" fill="${fin.fill}"/>` +
        Array.from({ length: 6 }, (_, k) => cloth(66 + 7.4 * k, k + 1, 28)).join('') + '<rect x="62" y="56" width="46" height="1.4" fill="#fff" fill-opacity=".7"/>' +
        [[64, 14, 8], [79, 12, 9], [94, 14, 8]].map(([x, w, h], k) => `<rect x="${x}" y="${56 - h}" width="${w}" height="${h}" fill="${COL[(k + 5) % 8]}" stroke="#000" stroke-opacity=".15" stroke-width=".5"/>`).join('') +
        [[64, 18], [86, 20]].map(([x, w]) => `<rect x="${x}" y="70" width="${w}" height="14" rx="1.5" fill="#C9A27A" stroke="#000" stroke-opacity=".2" stroke-width=".5"/><path d="M${x} 75H${x + w}M${x} 79.5H${x + w}" stroke="#A8835C" stroke-opacity=".6" stroke-width=".5"/>`).join('') +
        X.slice(0, 2).map(x => leaf(x, c0)).join('');
    } else body = X.map(x => leaf(x, c0)).join('');

    return svg(`<rect width="120" height="90" fill="${WALL}"/><rect width="120" height="3" fill="#E9E4DC"/><rect y="84" width="120" height="6" fill="#D9CFC2"/>` +
      `<rect x="11.5" y="8" width="100" height="78" fill="#000" fill-opacity=".15"/>${body}`, defs);
  };

  // 방 모서리 입면(천장 y0~18 · 벽 y18~80 · 바닥 y80~90). o: { top: flat|minus|none|crown, base: base80|base40|flush, wall: 'wainscot'(벽 패널), wallColor: 벽 색, floor: 바닥 색('#hex'|'wood:톤'),
  //   floorKind?: 'wood'|'stone' + floorH?: 바닥 높이(u) — C1 바닥 재확인용: 위쪽을 눌러 담고 바닥을 마루판·타일 무늬로 크게 그림 }
  const corner = (o = {}) => {
    const { top = 'flat', base = { minus: 'base40', none: 'flush' }[top] || 'base80', wall, wallColor = '#F1EFEA', floor = '#D1B38A', floorKind, floorH = 10 } = o; // base를 안 주면 CM4 짝(minus→base40, none→flush)대로
    const n = parseInt(wallColor.slice(1), 16), L = ((n >> 16) * .299 + (n >> 8 & 255) * .587 + (n & 255) * .114) / 255; // 벽이 어두울수록 빛 번짐을 줄임
    const F = paint(floor, id('cf')); F.def = F.def.replace(/stroke-width="\.35"/g, 'stroke-width=".5"');
    const fb = floor.startsWith('wood:') ? WOODS[floor.slice(5)] || floor.slice(5) : floor, g = id('cg'), c = id('cc'), w = id('cw'), W = '#FFFFFF';
    const sh = s => `<g transform="translate(1.5 2)" opacity=".15" fill="#000">${s}</g>`, ln = (y, a = .12) => `<path d="M0 ${y}H120" stroke="#000" stroke-opacity="${a}" stroke-width=".5"/>`;
    const bar = (y, h) => `<rect x="-3" y="${y}" width="126" height="${h}"/>`, band = (y, h) => `<rect y="${y}" width="120" height="${h}" fill="${W}"/>`;
    const T = {
      flat: sh(bar(18, 4)) + band(18, 4) + ln(22), // 평몰딩: 흰 띠 h4
      minus: '<rect y="18" width="120" height="2.2" fill="#5E574F" fill-opacity=".55"/><path d="M0 20.45H120" stroke="#fff" stroke-opacity=".7" stroke-width=".5"/>', // 그림자 홈 h2.2
      none: ln(17.75, .1), // 선 없이 맞닿음: 머리카락 선 하나
      crown: sh(bar(18, 9.4)) + band(18, 2.4) + `<rect y="20.4" width="120" height="5" fill="url(#${c})"/>` + band(25.4, 2) + Array.from({ length: 28 }, (_, k) => `<rect x="${(k * 4.4 + .8).toFixed(1)}" y="25.9" width="2.4" height="1.5" fill="#E2DCD0"/>`).join('') + ln(25.4, .15) + ln(27.4), // 3단 크라운(맨 아래 단에 이빨 장식)
    };
    const B = { base80: [75, 5], base40: [77.5, 2.5] }[base];
    const bs = B ? sh(bar(...B)) + band(...B) + ln(B[0]) + (base === 'base80' ? ln(76.6, .08) : '') : '<rect y="78.8" width="120" height="1.2" fill="#5E574F" fill-opacity=".4"/>'; // flush: 그림자 h1.2
    const fr = [10, 65].map(x => `<rect x="${x}" y="46" width="45" height="26"`);
    const pan = wall === 'wainscot' ? sh(bar(38.6, 2.8) + fr.map(r => `${r} fill="none" stroke="#000" stroke-width="1.4"/>`).join('')) + band(38.6, 2.8) + ln(41.4) +
      fr.map(r => `${r} fill="${shift(wallColor, -5)}" stroke="${W}" stroke-width="1.4"/>`).join('') : ''; // 웨인스코팅: 허리몰딩 y40 + 프레임 2개
    const up = `<rect width="120" height="18" fill="#F4F1EC"/><rect width="120" height="18" fill="url(#${g})"/><rect y="18" width="120" height="62" fill="${wallColor}"/><rect y="18" width="120" height="62" fill="url(#${w})"/>`;
    const big = floorKind === 'wood' || floorKind === 'stone', fy = 90 - floorH; // 큰 바닥: 벽·몰딩을 (90−floorH)/80로 눌러 담음
    const fl = big ? nest(floorKind === 'stone' ? tile({ layout: 'stack', w: 2, h: 4, color: fb, grout: shift(fb, -12) }) : wood(fb), 0, fy, 120, floorH)
      : `<rect y="80" width="120" height="10" fill="${F.fill}"/><path d="M${[20, 58, 96].map(x => `${x} 80V90`).join('M')}" stroke="${shift(fb, -28)}" stroke-opacity=".6" stroke-width=".5"/>`;
    return svg((big ? `<g transform="scale(1 ${(fy / 80).toFixed(4)})">${up}${pan}${T[top] || T.flat}${bs}</g>` : up) + fl + (big ? '' : `${pan}${T[top] || T.flat}${bs}`),
      F.def + `<linearGradient id="${g}" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".035"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>` +
      `<radialGradient id="${w}" cx=".12" cy="0" r="1"><stop offset="0" stop-color="#FFE7B8" stop-opacity="${(.08 + .32 * L).toFixed(2)}"/><stop offset="1" stop-color="#FFE7B8" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="${c}" x2="0" y2="1"><stop offset="0" stop-color="#CFC8BC"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>`);
  };

  // 중문 프레임 왼쪽 위 모서리 확대(1u = 5mm, 바깥 모서리 (14,12) 고정). o: { fw: 프레임 두께 u, color: 프레임 색('#hex'|METALS 키|'wood:톤'), molding: 안쪽 몰딩 2단(2u·1.2u, 간격 1.5u) }
  const doorCorner = (o = {}) => {
    const { fw = 12, color = '#2B2B2B', molding = false } = o, ox = 14, oy = 12, ix = ox + fw, iy = oy + fw;
    const R = paint(color, id('fr')), S = paint(color, id('fs')), cl = id('gc'), edge = 'stroke="#00000033" stroke-width=".5"';
    R.def = R.def.replace(/stroke-width="\.35"/g, 'stroke-width=".5"').replace('x1="0" x2="1" y1="0" y2="1"', 'x1="0" x2="0" y1="0" y2="1"'); // 금속은 두께 방향으로 음영, 나뭇결은 길이 방향
    S.def = S.def.replace(/stroke-width="\.35"/g, 'stroke-width=".5"').replace('<pattern ', '<pattern patternTransform="rotate(90)" ').replace('x1="0" x2="1" y1="0" y2="1"', 'x1="0" x2="1" y1="0" y2="0"');
    const base = /^#/.test(color) ? color : color.startsWith('wood:') ? WOODS[color.slice(5)] || color.slice(5) : (METALS[color] || METALS.black)[2];
    const L = (a, b) => `M${ix - b} ${iy - b}H121V${iy - a}H${ix - a}V91H${ix - b}Z`; // 안쪽 모서리에서 a~b만큼 바깥으로 떨어진 ㄱ자 띠
    const bands = molding ? [[1.5, 2.7], [4.2, 6.2]] : [], gw = 121 - ix, gh = 91 - iy;
    return svg(`<rect width="120" height="90" fill="#EFEBE5"/>` +
      `<g clip-path="url(#${cl})"><rect x="${ix}" y="${iy}" width="${gw}" height="${gh}" fill="#E6E2DA"/><rect x="${ix}" y="${iy}" width="${gw}" height="${gh}" fill="#CFE0E6" fill-opacity=".55"/>` +
      `<path d="M34 95L49 95L99 5L84 5Z" fill="#fff" fill-opacity=".5"/><path d="M56 95L61 95L111 5L106 5Z" fill="#fff" fill-opacity=".3"/></g>` + // 맑은 유리 + 대각 반사선
      `<path d="${L(0, fw)}" transform="translate(1.5 2)" fill="#000" fill-opacity=".15"/>` +
      `<polygon points="${ox},${oy} 121,${oy} 121,${iy} ${ix},${iy}" fill="${R.fill}" ${edge}/><polygon points="${ox},${oy} ${ix},${iy} ${ix},91 ${ox},91" fill="${S.fill}" ${edge}/>` +
      `<path d="M${ox + .25} 91V${oy + .25}H121" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".5"/>` +
      (bands.length ? `<g transform="translate(1.5 2)" opacity=".15">${bands.map(([a, b]) => `<path d="${L(a, b)}" fill="#000"/>`).join('')}</g>` +
        bands.map(([a, b]) => `<path d="${L(a, b)}" fill="${shift(base, -20)}" ${edge}/><path d="M121 ${iy - a}H${ix - a}V91" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".5"/>`).join('') : ''),
      R.def + S.def + `<clipPath id="${cl}"><rect x="${ix}" y="${iy}" width="${gw}" height="${gh}"/></clipPath>`);
  };

  // 침대 머리 쪽 벽 정면 입면: 침대 x24~96 y56~76 + 협탁 2는 모든 타입이 같고 등 뒤 벽(헤드)만 바뀜.
  // o: { type: none|fabric|slat|wainscot|panel|color, color: #hex(slat은 'wood:…'·WOODS 키도 됨), wall: 바탕 벽색(기본 #F1EFEA) }
  const head = (o = {}) => {
    const { type = 'none' } = o, wall = o.wall || '#F1EFEA';
    const hex = c => String(c).startsWith('wood:') ? (WOODS[c.slice(5)] || c.slice(5)) : (WOODS[c] || c);
    const col = hex(o.color || { fabric: '#D9CFC2', slat: WOODS.oak, panel: '#6E5A4A', color: '#7C8B6E' }[type] || '#D9CFC2');
    let defs = '';
    const sh = s => `<g fill="#000" fill-opacity=".15" transform="translate(1.5 2)">${s}</g>`; // 같은 도형을 옮긴 그림자
    const ln = (d, c, w = .5, a = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-opacity="${a}" stroke-width="${w}"/>`;
    const grad = (stops, v = false) => { const g = id('hg'); defs += `<linearGradient id="${g}"${v ? ' x2="0" y2="1"' : ''}>${stops.map(([s, c, a = 1]) => `<stop offset="${s}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`; return `url(#${g})`; };
    const K = kelvin(3000), Y = '#FFE7B8';

    // 방: 천장 띠 · 벽 · 걸레받이 · 바닥 (color 타입은 벽 한 면만 색을 칠한 것이라 천장·걸레받이는 그대로)
    const flo = '#D1B38A';
    let body = `<rect width="120" height="90" fill="${type === 'color' ? col : wall}"/><rect width="120" height="5" fill="#F4F1EC"/>${ln('M0 5H120', '#000', .5, .08)}` +
      `<rect y="77.5" width="120" height="2.5" fill="#F7F4EF"/>${ln('M0 77.5H120', '#000', .5, .1)}<rect y="80" width="120" height="10" fill="${flo}"/>${ln('M0 84.5H120M0 88H120', shift(flo, -20), .5, .7)}`;

    // 헤드월
    if (type === 'fabric') { // x24~96 y30~62, 세로 채널 7개
      const w = 72 / 7, g = grad([[0, shift(col, 12)], [.5, col], [1, shift(col, -14)]]), ch = (x, f) => `<rect x="${+x.toFixed(2)}" y="30" width="${+w.toFixed(2)}" height="32" rx="4"${f ? ` fill="${f}" stroke="${shift(col, -30)}" stroke-width=".6"` : ''}/>`;
      const xs = Array.from({ length: 7 }, (_, i) => 24 + i * w);
      body += sh(xs.map(x => ch(x)).join('')) + xs.map(x => ch(x, g)).join('');
    } else if (type === 'slat') { // x10~110 y8~62, 슬랫 25줄 + 상단 3000K 띠
      const r = rnd(31), back = grad([[0, shift(col, -60)], [1, shift(col, -48)]], true);
      body += sh('<rect x="10" y="8" width="100" height="54"/>') + `<rect x="10" y="8" width="100" height="54" fill="${back}"/>`;
      for (let i = 0; i < 25; i++) { const x = 10 + i * 4 + .6, f = shift(col, Math.round((r() - .5) * 14)); body += `<rect x="${x.toFixed(1)}" y="8" width="2.8" height="54" fill="${f}"/><rect x="${x.toFixed(1)}" y="8" width=".9" height="54" fill="#fff" fill-opacity=".2"/><rect x="${(x + 2).toFixed(1)}" y="8" width=".8" height="54" fill="#000" fill-opacity=".14"/>`; }
      body += `<rect x="10" y="10" width="100" height="20" fill="${grad([[0, K, .5], [1, K, 0]], true)}"/><rect x="10" y="8" width="100" height="2.4" fill="#FFF3D6"/>`;
    } else if (type === 'wainscot') { // 프레임 3개, 흰 선 1.4u + 한쪽 그림자로 도드라지게
      for (const x of [13, 47, 81]) body += `<rect x="${x}" y="13" width="26" height="45" fill="${shift(wall, -8)}"/>` + `<rect x="${x + .7}" y="13.8" width="26" height="45" fill="none" stroke="#000" stroke-opacity=".16" stroke-width=".7"/>` + `<rect x="${x}" y="13" width="26" height="45" fill="none" stroke="#fff" stroke-width="1.4"/>` + `<rect x="${x + 2.6}" y="15.6" width="20.8" height="39.8" fill="none" stroke="#000" stroke-opacity=".1" stroke-width=".5"/>`;
    } else if (type === 'panel') { // x4~116 y36~62 #6E5A4A + 빛 띠 + 핀조명 2
      const r = rnd(17);
      body += `<rect x="6" y="22" width="108" height="14" fill="${grad([[0, Y, 0], [1, Y, .45]], true)}"/>` + sh('<rect x="4" y="36" width="112" height="26"/>') + `<rect x="4" y="36" width="112" height="26" fill="${col}"/>` +
        Array.from({ length: 5 }, (_, k) => ln(`M4 ${(40 + k * 4.6 + r() * 1.5).toFixed(1)}q28 ${((r() - .5) * 3).toFixed(1)} 56 0t56 0`, '#000', .5, .18)).join('') +
        `<rect x="4" y="36" width="112" height="14" fill="${grad([[0, K, .55], [1, K, 0]], true)}"/><rect x="6" y="35" width="108" height="1.8" fill="#FFF3D6"/>` +
        [30, 90].map(x => `<path d="M${x - 1.4} 40.4L${x - 10} 61H${x + 10}L${x + 1.4} 40.4Z" fill="${Y}" fill-opacity=".34"/><rect x="${x - 3}" y="37.4" width="6" height="3.2" rx="1.2" fill="#262626"/><rect x="${x - 1.6}" y="40.2" width="3.2" height=".9" fill="#FFF6DD"/>`).join('');
    }

    // 침대 x24~96 y56~76 (베개 · 이불 · 프레임) + 협탁
    const stand = x => sh(`<rect x="${x}" y="64" width="15" height="16"/>`) + `<rect x="${x}" y="64" width="15" height="16" fill="#CDBFAE" stroke="#B9A58A" stroke-width=".5"/><rect x="${x - .8}" y="62.6" width="16.6" height="2.2" fill="#B9A58A"/>${ln(`M${x} 72H${x + 15}`, '#000', .5, .22)}<circle cx="${x + 7.5}" cy="68.2" r="1" fill="#8C7A64"/><circle cx="${x + 7.5}" cy="76" r="1" fill="#8C7A64"/>`;
    body += sh('<rect x="24" y="56" width="72" height="24" rx="3"/>') +
      `<rect x="24" y="71" width="72" height="5" fill="#B9A58A"/><rect x="27" y="76" width="3" height="4" fill="#8C7A64"/><rect x="90" y="76" width="3" height="4" fill="#8C7A64"/>` +
      `<rect x="24" y="61" width="72" height="11" rx="2.5" fill="#E8DECE" stroke="#D2C5B0" stroke-width=".5"/><rect x="24.5" y="63" width="71" height="3.2" fill="#fff" fill-opacity=".55"/>${ln('M24.5 66.2H95.5', '#000', .5, .08)}${ln('M44 67V71.5M60 67V71.5M76 67V71.5', '#000', .5, .06)}` +
      [28, 63].map(x => `<rect x="${x}" y="56" width="29" height="11" rx="5" fill="#FBF8F2" stroke="#E0D6C5" stroke-width=".5"/>${ln(`M${x + 6} 60.5Q${x + 14.5} 62.5 ${x + 23} 60.5`, '#000', .5, .07)}`).join('') +
      stand(7) + stand(98);
    // 협탁 위: 왼쪽 꺼진 스탠드, 오른쪽 책
    body += `<rect x="13.1" y="58.6" width="1.8" height="4" fill="#8B6A4E"/><path d="M10 52H18L19.6 59H8.4Z" fill="#F4EEE4" stroke="#D9CDB8" stroke-width=".5"/>` +
      `<rect x="100" y="60.4" width="11" height="2.2" fill="#B8956B"/><rect x="101" y="58" width="9" height="2.4" fill="#D9CFC2"/><rect x="102" y="55.8" width="7" height="2.2" fill="#8FA08A"/>`;
    if (type === 'none') { // 벽등 2개: 판·팔 #B9B1A5 + 린넨 드럼 갓(아랫변 9u x18.5~27.5, 윗변 7u, y32~40, 테 INK α.5) + y54까지 연하게 퍼지는 빛 (오른쪽은 좌우 대칭, 그림자는 같은 방향으로 바깥에서)
      const mir = s => s + `<g transform="matrix(-1 0 0 1 120 0)">${s}</g>`;
      const arm = '<rect x="11" y="31" width="3" height="10" rx="1.2"/><rect x="13" y="35.2" width="8" height="1.6"/>', drum = '<path d="M19.5 32H26.5L27.5 40H18.5Z"/>';
      body += mir(`<path d="M19.5 40L15 54H31L26.5 40Z" fill="${Y}" fill-opacity=".25"/>`) + sh(mir(arm + drum)) +
        mir(`<g fill="#B9B1A5">${arm}</g><g fill="#EFE7DA" stroke="${INK}" stroke-opacity=".5" stroke-width=".5" stroke-linejoin="round">${drum}</g><rect x="19.5" y="39.4" width="7" height="1.2" fill="#FFF6DD"/>`);
    }
    return svg(body, defs);
  };

  // 방문 입면 (벽 속 문 한 짝, x42~78 y12~84). o: { type: standard|slim|hidden|hidoor|sliding|arch|gansal, color: 문·문선 색('#hex'|'wood:톤'), wall: 벽 색, metal: 레버 금속(METALS 키) }
  const IDOOR_HEX = c => /^#/.test(c) ? c : c.startsWith('wood:') ? WOODS[c.slice(5)] || c.slice(5) : METALS[c] ? METALS[c][2] : '#F1EFEA';
  const idoor = (o = {}) => {
    const { type = 'standard', color = '#F1EFEA', wall = '#EFEBE5', metal = 'nickel' } = o;
    const D = paint(color, id('dc')), Dv = paint(color, id('dv')), M = paint(metal, id('dm')), base = IDOOR_HEX(color);
    for (const p of [D, Dv]) p.def = p.def.replace(/stroke-width="\.35"/g, 'stroke-width=".5"'); // paint 나뭇결 선(.35)을 하우스 규칙 .5로
    Dv.def = Dv.def.replace('<pattern ', '<pattern patternTransform="rotate(90)" '); // 세로 부재(문설주·살)는 결이 세로로
    const C = D.def ? D : { fill: shift(base, 5) }, Cv = Dv.def ? Dv : C; // 문선은 문짝보다 한 톤 밝게 떠 보이게(나뭇결은 그대로)
    const top = type === 'hidoor' ? 2 : 12, cw = { hidden: 0, sliding: 0, slim: 1.2, hidoor: 1.2 }[type] ?? 4, R = 18 + cw; // 문선 폭: 일반·아치·간살 4u · 슬림·천장 문 1.2u · 히든·미닫이는 없음
    const sh = d => `<path d="${d}" transform="translate(1.5 2)" fill="#000" fill-opacity=".15"/>`, line = 'stroke="#00000026" stroke-width=".5"';
    const lv = (x, y) => { const s = f => `<rect x="${x - 9.5}" y="${y - 1}" width="10" height="2" rx="1" fill="${f}"/><circle cx="${x}" cy="${y}" r="2.6" fill="${f}"/>`; return `<g transform="translate(1.5 2)" opacity=".15">${s('#000')}</g>${s(M.fill)}<circle cx="${x - .8}" cy="${y - .9}" r=".9" fill="#fff" fill-opacity=".55"/>`; };
    const leaf = type === 'arch' ? 'M42 84V30A18 18 0 0 1 78 30V84Z' : `M42 84V${top}H78V84Z`, gap = `<path d="${leaf}" fill="none" stroke="#00000030" stroke-width=".6"/>`; // 문짝 둘레 틈 0.6u
    const floor = `<rect y="84" width="120" height="6" fill="#D1B38A"/><path d="M20 84V90M58 84V90M96 84V90" stroke="#B99A70" stroke-width=".5"/>`;
    let defs = D.def + Dv.def + M.def, body;
    if (type === 'sliding') {
      const g = id('sb'), pull = f => `<rect x="63" y="45" width="2.6" height="16" rx="1.3" fill="${f}"/>`;
      defs += `<linearGradient id="${g}" x2="0" y2="1"><stop offset="0" stop-color="${shift(wall, -24)}"/><stop offset="1" stop-color="${shift(wall, -8)}"/></linearGradient>`;
      body = `<rect x="42" y="12" width="36" height="72" fill="url(#${g})"/><path d="M42 12H78V14H43.5V84H42Z" fill="#000" fill-opacity=".15"/>${floor}` + // 열린 칸: 옆방은 벽보다 한 톤 어둡게
        `${sh('M60 12H96V84H60Z')}<rect x="60" y="12" width="36" height="72" fill="${D.fill}" ${line}/>` +
        `<g transform="translate(1.5 2)" opacity=".15">${pull('#000')}</g>${pull(M.fill)}<rect x="63.8" y="47" width="1" height="12" rx=".5" fill="#000" fill-opacity=".4"/>` +
        '<rect x="40" y="9.6" width="58" height=".8" fill="#5F5850"/><rect x="65" y="10.4" width="2.4" height="1.6" fill="#5F5850"/><rect x="89" y="10.4" width="2.4" height="1.6" fill="#5F5850"/>'; // 상부 레일 0.8u + 걸이
    } else {
      const arc = `M${42 - cw} 84V30A${R} ${R} 0 0 1 ${78 + cw} 30V84H78V30A18 18 0 0 0 42 30V84Z`, pg = (fill, pts) => `<polygon points="${pts}" fill="${fill}" ${line}/>`;
      const casing = !cw ? '' : type === 'arch' ? sh(arc) + `<path d="${arc}" fill="${C.fill}" ${line}/>`
        : sh(`M${42 - cw} 84V${top - cw}H${78 + cw}V84H78V${top}H42V84Z`) + pg(Cv.fill, `${42 - cw},84 ${42 - cw},${top - cw} 42,${top} 42,84`) + pg(C.fill, `${42 - cw},${top - cw} ${78 + cw},${top - cw} 78,${top} 42,${top}`) + pg(Cv.fill, `78,84 78,${top} ${78 + cw},${top - cw} ${78 + cw},84`);
      const inner = type === 'gansal' ? `<path d="${leaf}" fill="${shift(base, -24)}"/>` + Array.from({ length: 10 }, (_, k) => { const x = 42.6 + k * 3.6; return `<rect x="${x.toFixed(1)}" y="12" width="2.4" height="72" fill="${Dv.fill}"/><path d="M${(x + .3).toFixed(1)} 12V84" stroke="#fff" stroke-opacity=".3" stroke-width=".5"/>`; }).join('') // 세로 살 + 틈(shift −24)
        : `<path d="${leaf}" fill="${D.fill}"/>`;
      const grip = type === 'hidden' ? '<rect x="71" y="41" width="3" height="18" rx="1.5" fill="#000" fill-opacity=".3"/><rect x="71.5" y="41.5" width="2" height="17" rx="1" fill="#000" fill-opacity=".25"/><path d="M71.6 57.6A1.4 1.4 0 0 0 74.4 57.6" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width=".6"/>' : lv(73, 50); // 숨은 문은 세로 홈 손잡이 3×18u
      body = floor + inner + casing + gap + grip; // 문선 그림자가 문짝 위·왼쪽 안쪽에 떨어지게 문짝을 먼저 깔고 문선을 덮는다
    }
    return svg(`<rect width="120" height="90" fill="${wall}"/><path d="M0 .6H120" stroke="#000" stroke-opacity=".12" stroke-width=".6"/>${body}<path d="M0 84H120" stroke="#000" stroke-opacity=".18" stroke-width=".5"/>`, defs);
  };

    // 아이방 가구 방향 (정면 입면: 같은 벽·바닥에 가구만 바뀜, 1u ≈ 28mm). mode: growing|theme|natural|bunker|floorbed
    const kidsRoom = (mode = 'growing') => {
      const W = paint('wood:oak', id('kw')), ASH = '#E2D6C3', FR = '#D9CFC2', LN = '#BFB09A', SHEET = '#FBF8F2', BLUE = '#C6D6DE', PEACH = '#E8D2C5', SAGE = '#D5E0C8', PINK = '#F6DCDD';
      const sh = s => `<g transform="translate(1.5 2)" opacity=".15">${s.replace(/(fill|stroke)="(?!none)[^"]*"/g, '$1="#000"')}</g>${s}`; // 같은 도형 그림자를 먼저
      const R = (x, y, w, h, f, rx = 0, e = ` stroke="${LN}" stroke-width=".5"`) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"${e}/>`;
      const soft = ' stroke="#E3DACB" stroke-width=".5"';
      const star = (x, y, r, f = '#F3D58B') => `<polygon points="${Array.from({ length: 10 }, (_, k) => { const a = Math.PI / 180 * (k * 36 - 90), q = k % 2 ? r * 0.45 : r; return `${(x + q * Math.cos(a)).toFixed(1)},${(y + q * Math.sin(a)).toFixed(1)}`; }).join(' ')}" fill="${f}"/>`;
      const cloud = (x, y, s, f = '#DCEBF2') => `<g transform="translate(${x} ${y}) scale(${s})" fill="${f}"><circle cx="-4.8" cy=".6" r="3.6"/><circle cy="-2.4" r="4.7"/><circle cx="4.9" cy=".4" r="3.8"/><rect x="-8.2" y="1" width="16.4" height="4" rx="2"/></g>`;
      // 정면 침대(머리맡이 벽): x 왼쪽, 폭 39u(슈퍼싱글 1100mm). head 헤드보드 칠, quilt 이불색
      const bedF = (x, head, quilt, ls = ` stroke="${LN}" stroke-width=".5"`) => sh(`<path d="M${x} 76V52Q${x} 48 ${x + 4} 48H${x + 35}Q${x + 39} 48 ${x + 39} 52V76Z" fill="${head}"${ls}/>` + R(x + 1.5, 62, 36, 14, quilt, 3, '') + R(x + 1, 76, 3, 4, head, .4, ls) + R(x + 35, 76, 3, 4, head, .4, ls)) +
        R(x + 4, 55, 13, 8, SHEET, 3, soft) + R(x + 22, 55, 13, 8, SHEET, 3, soft) + R(x + 1.5, 62, 36, 14, quilt, 3, '') + R(x + 1.5, 62, 36, 4.6, SHEET, 2, soft);
      const S = {
        // 책상이 3단으로 올라가고(아래가 지금 높이, 위는 자란 뒤 높이) + 슈퍼싱글 + 모듈 수납(큐브 2×4)
        growing: () => {
          const cube = (c, r) => [5 + c * 12.5, 30 + r * 12.5], knob = (x, y) => `<circle cx="${x}" cy="${y}" r=".9" fill="#A8977C"/>`;
          const inner = [`<rect x="7.4" y="34" width="1.8" height="7.5" fill="${BLUE}"/><rect x="9.6" y="35.6" width="1.8" height="5.9" fill="${PEACH}"/><rect x="11.8" y="33.8" width="1.8" height="7.7" fill="${SAGE}"/>`, '',
            R(6.4, 48.6, 9, 5.4, BLUE, 1, '') + R(7.4, 45.4, 7, 3.2, SAGE, 1, ''), R(18.8, 48.2, 9, 5.8, PEACH, 1.4, ''),
            '', R(18.6, 62, 9, 4.5, BLUE, 1, '') + '<circle cx="23" cy="59" r="3" fill="#F3D58B"/>', R(6.4, 73, 9, 6, PEACH, 1.4, ''), ''];
          const mod = sh(R(5, 30, 25, 50, ASH, .6)) + Array.from({ length: 8 }, (_, k) => { const [x, y] = cube(k % 2, k >> 1); return R(x + 1, y + 1, 10.5, 10.5, '#D2C4AB', 0, ''); }).join('') + inner.join('') +
            [1, 4, 7].map(k => { const [x, y] = cube(k % 2, k >> 1); return R(x + .6, y + .6, 11.3, 11.3, '#EBE2D2', .4) + knob(x + 9, y + 6.2); }).join('') + `<path d="M5 30H30M5 42.5H30M5 55H30M5 67.5H30M17.5 30V80" stroke="${LN}" stroke-width=".5" fill="none"/>`;
          const dash = ` stroke="#A8977C" stroke-width=".5" stroke-dasharray="1.6 1"`; // 자란 뒤 높이는 점선 윤곽
          const desk = [50, 56].map((y, k) => `<rect x="34" y="${y}" width="36" height="2.6" fill="${ASH}" fill-opacity="${k ? .6 : .38}"${dash}/>`).join('') +
            [36, 65.6].map(x => `<rect x="${x}" y="50" width="2.4" height="30" fill="${ASH}" fill-opacity=".45"${dash}/>`).join('') +
            sh(R(34, 62, 36, 3, ASH, .6) + R(36, 65, 2.4, 15, ASH, .4) + R(65.6, 65, 2.4, 15, ASH, .4)) +
            [36.6, 66.2].map(x => `<rect x="${x}" y="65" width="1.2" height="8" fill="#CDBFA5"/>`).join('') +
            R(38, 60.2, 9, 1.8, BLUE, .4) + R(39, 58.4, 7, 1.8, PEACH, .4) + `<path d="M74 51V61M71.8 53.4L74 50.6L76.2 53.4M71.8 58.6L74 61.4L76.2 58.6" fill="none" stroke="#A8977C" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/>`;
          return mod + desk + bedF(79, ASH, BLUE);
        },
        // 중립 크림 캐노피·커튼 + 파스텔 가랜드(깃발 3색 교대) + 별·구름 벽: 남녀 상관없이 '꾸민 방'
        theme: () => {
          const f1 = v => +v.toFixed(2), sag = x => 9 + 14 * (1 - ((x - 60) / 60) ** 2); // 가랜드 줄: 양 끝 y9, 가운데 y23(캐노피 뒤에 가려짐)
          const cur = `<path d="M54 9L57 10C54 24 45 38 37 50C37.4 60 38 70 38 80H17C22 68 28 58 31 50C40 36 48 22 54 9Z" fill="#F3E6CF" stroke="#D6C29C" stroke-width=".5"/><path d="M35 52C33 62 27 72 21 80M36.4 54C36 64 33 72 29 80M37.6 54C38 64 38.4 72 37.6 80M50 12C45 28 38 40 34 49" fill="none" stroke="#DFCBA5" stroke-width=".6"/><ellipse cx="34" cy="50.4" rx="3.4" ry="1.4" transform="rotate(-62 34 50.4)" fill="#D9C197"/>`;
          const flags = Array.from({ length: 16 }, (_, i) => { const x = 4.5 + i * 7.4, c = ['#DCEBF2', '#FFF1C9', PINK][i % 3]; return `<path d="M${f1(x - 3)} ${f1(sag(x - 3))}L${f1(x + 3)} ${f1(sag(x + 3))}L${f1(x)} ${f1(sag(x) + 7.5)}Z" fill="${c}" stroke="${shift(c, -34)}" stroke-width=".5"/>`; }).join('');
          const deco = [star(8, 30, 3.2), star(28, 37, 3), star(112, 29, 3.4), star(93, 31, 2.6), star(108, 53, 4.4), star(8, 67, 2.6)].join('') + cloud(16, 44, .9) + cloud(103, 40, .8) + cloud(9, 57, .6);
          return deco + sh('<path d="M0 9Q60 37 120 9" fill="none" stroke="#B8A27E" stroke-width=".6"/>' + flags) +
            '<path d="M54 9H66L84 52H36Z" fill="#FAF3E4" stroke="#E6D6B6" stroke-width=".5"/><path d="M60 0V6" stroke="#CDB993" stroke-width=".8"/><ellipse cx="60" cy="8" rx="6.5" ry="2" fill="#E9D8B5" stroke="#CDB993" stroke-width=".6"/>' +
            bedF(40.5, '#E8DCC8', '#DCEBF2') + sh(cur) + sh(`<g transform="matrix(-1 0 0 1 120 0)">${cur}</g>`);
        },
        // 오크 결 가구(침대·교구장·의자) + 낮은 교구장
        natural: () => {
          const ws = ' stroke="#A8835C" stroke-width=".5"';
          const shelf = sh(R(5, 57, 34, 23, W.fill, .8, ws)) + R(7.2, 59.2, 29.6, 18.6, '#EADFC9', 0, '') + R(17.4, 59.2, 2.2, 18.6, W.fill, 0, '') + R(26.8, 59.2, 2.2, 18.6, W.fill, 0, '') + R(7.2, 67.4, 29.6, 2.2, W.fill, 0, '') +
            `<rect x="8.2" y="62.4" width="8" height="5" rx="1.4" fill="#C9A274"/><path d="M8.4 64.2H16M8.4 66H16" stroke="#A8835C" stroke-width=".5"/>` +
            '<rect x="20" y="64.2" width="3.4" height="3.2" fill="#D98E73"/><rect x="23.8" y="64.2" width="3" height="3.2" fill="#E3B96A"/><rect x="21.6" y="61" width="3.4" height="3.2" fill="#9CB59C"/>' +
            '<rect x="30" y="61.4" width="1.7" height="6" fill="#B9C7C9"/><rect x="32" y="62.6" width="1.7" height="4.8" fill="#E8D2C5"/><rect x="34" y="61" width="1.7" height="6.4" fill="#D5E0C8"/>' +
            '<rect x="8.2" y="71.2" width="8" height="6.4" rx="1.4" fill="#C9A274"/><path d="M8.4 73.6H16M8.4 75.6H16" stroke="#A8835C" stroke-width=".5"/>' +
            '<rect x="20" y="72.4" width="7.6" height="5.2" rx="1" fill="#E8D2C5"/><rect x="21" y="69.6" width="5.6" height="2.8" rx="1" fill="#B9C7C9"/><circle cx="32.6" cy="74.8" r="2.8" fill="#E3B96A"/>';
          const stool = sh(R(46, 70, 11, 3, W.fill, 1, ws) + R(47.6, 73, 2, 7, W.fill, .4, ws) + R(53.4, 73, 2, 7, W.fill, .4, ws));
          const ledge = sh(R(8, 44, 30, 2.4, W.fill, .6, ws)) + [[10, '#B9C7C9'], [19.6, '#E8D2C5'], [29.2, '#D5E0C8']].map(([x, f]) => R(x, 33.6, 7.6, 10.4, f, .6, soft)).join('') + R(8, 44, 30, 2.4, W.fill, .6, ws); // 벽 책 선반: 표지가 보이게
          return ledge + shelf + stool + bedF(72, W.fill, '#E3D3B8', ws);
        },
        // 이층 침대 + 가드
        bunker: () => {
          const post = x => R(x, 12, 4.4, 68, FR, .6);
          // 위아래 층이 서로 반대 방향으로 누움: 베개 쪽(x0 앞/뒤)만 시트가 보이고 나머지는 이불
          const deck = (y, blanket, x0, x1, px) => R(30, y, 64, 4, FR, .4) + R(30, y - 8.5, 64, 8.5, SHEET, 2, soft) + `<path d="M${x0} ${y - 6.6}Q${x0 + 4} ${y - 9.6} ${x0 + 14} ${y - 8.6}T${x0 + 34} ${y - 8.6}T${x1} ${y - 8}V${y}H${x0}Z" fill="${blanket}"/>` + R(px, y - 12.4, 14, 4.4, SHEET, 2.2, soft);
          const guard = R(26, 14, 72, 3, FR, .6) + [38, 48, 58, 68, 78, 88].map(x => R(x, 17, 2, 19, FR, .4)).join('');
          const ladder = R(100, 30, 2, 50, FR, .4) + R(109, 30, 2, 50, FR, .4) + [38, 46, 54, 62, 70].map(y => R(102, y, 7, 2, FR, .4)).join('');
          return sh(post(26) + post(94) + R(26, 36, 72, 4, FR, .4) + R(26, 64, 72, 4, FR, .4) + ladder) + post(26) + post(94) + deck(40, BLUE, 30, 78, 80) + deck(68, PEACH, 46, 94, 32) + guard + ladder;
        },
        // 낮은 바닥 침대(옆면): 머리맡은 3u 얇은 판, 가드는 몸 쪽만 낮게(y66~76, 이불이 위로 보임), 벽 액자 2 + 러그 위 장난감
        floorbed: () => {
          const ws = ' stroke="#A8835C" stroke-width=".5"', OAK = '#C9A274', EAR = '#EBD9BE', DK = '#6B5444';
          const print = (x, y, w, h, art) => sh(R(x, y, w, h, OAK, .6, ws)) + R(x + 1.8, y + 1.8, w - 3.6, h - 3.6, SHEET, 0, '') + art;
          const prints = print(37, 22, 18, 22, `<circle cx="45.2" cy="30.6" r="2.4" fill="#F3D58B"/><path d="M38.8 42.2V37.4Q43 33.6 47 37Q50.4 35 53.2 36.8V42.2Z" fill="#C9D8BC"/><path d="M38.8 42.2V39.6Q44 36.6 49 40.2Q51.4 39 53.2 40V42.2Z" fill="${SAGE}"/>`) +
            print(60, 28, 22, 16, [[8, '#E7B8A6'], [6.3, '#F3D58B'], [4.6, '#B5C9A6'], [2.9, '#A9C4CC']].map(([r, c]) => `<path d="M${71 - r} 42.2A${r} ${r} 0 0 1 ${71 + r} 42.2" fill="none" stroke="${c}" stroke-width="1.5"/>`).join(''));
          const rug = R(7, 78.4, 106, 7.8, '#EFE4D0', 3.6, '') + '<rect x="10" y="80.4" width="100" height="3.8" rx="1.9" fill="none" stroke="#DDCFB4" stroke-width=".5"/>';
          const base = `<path d="M24 80V63Q24 62 25 62H26Q27 62 27 63V75H96V80Z" fill="${FR}" stroke="${LN}" stroke-width=".5"/>`; // 머리판 + 틀을 한 모양으로
          const rail = sh(R(44, 66, 3.4, 10, FR, .6) + R(92.6, 66, 3.4, 10, FR, .6) + R(44, 66, 52, 2.4, FR, .6)) + [52.3, 59, 65.7, 72.4, 79.2, 85.9].map(x => R(x, 68.4, 1.8, 7.6, FR, .4)).join(''); // 그림자는 기둥·윗살만(살마다 깔면 발처럼 보임)
          const quilt = `<path d="M44.6 75V67.5Q44.6 63.4 50 62.6Q56 61.4 62 62.8T74 62.2T86 62.8Q94 62 96 66V75Z" fill="${BLUE}"/><path d="M56 63.4Q57.4 67 56.4 71M72 62.8Q73.4 67 72.4 71M86.6 63.2Q88 67 87 71" fill="none" stroke="#AFC3CE" stroke-width=".5"/>`;
          const bear = `<circle cx="13.1" cy="72.7" r="1.3" fill="${OAK}"${ws}/><circle cx="17.9" cy="72.7" r="1.3" fill="${OAK}"${ws}/><ellipse cx="15.5" cy="80.6" rx="3.8" ry="3.9" fill="${OAK}"${ws}/><circle cx="15.5" cy="75.4" r="3.1" fill="${OAK}"${ws}/>`;
          const toys = sh(bear) + `<ellipse cx="15.5" cy="81.2" rx="2.1" ry="2.3" fill="${EAR}"/><ellipse cx="15.5" cy="76.3" rx="1.5" ry="1.1" fill="${EAR}"/><circle cx="15.5" cy="75.8" r=".5" fill="${DK}"/><circle cx="14" cy="74.4" r=".45" fill="${DK}"/><circle cx="17" cy="74.4" r=".45" fill="${DK}"/>` +
            sh('<circle cx="92" cy="82.6" r="3" fill="#D98E73" stroke="#B87258" stroke-width=".5"/>') + '<path d="M89.2 81.4Q92 84.2 94.8 81.4" fill="none" stroke="#FBF8F2" stroke-width=".7"/>' +
            sh(R(99, 80, 4.6, 4.6, PEACH, .6) + R(103.6, 80, 4.6, 4.6, BLUE, .6) + R(101.3, 75.4, 4.6, 4.6, '#E3B96A', .6));
          return prints + rug + sh(base) + R(27, 67, 69, 8, SHEET, 2, soft) + R(27.8, 62.2, 14.2, 6.6, SHEET, 3.2, soft) + quilt + rail + toys;
        },
      };
      return svg(`<rect width="120" height="90" fill="#F4EFE7"/><rect y="74" width="120" height="16" fill="#E6D7BE"/><rect y="74" width="120" height=".8" fill="#CDBA97"/><path d="M0 81H120M0 87H120" stroke="#D8C7AA" stroke-width=".5" stroke-opacity=".6"/>${(S[mode] || S.growing)()}`, mode === 'natural' ? W.def : '');
    };

  // 주방 정면 입면. o: { door, lower, sheen: matte|satin|polished, form: flat|shaker|fluted, upper: full|flap|none|openshelf|mixed, top, wall, floor, metal, wood }
  // 색 인자: '#hex' | METALS 키 | 'wood:<톤>'(세로결). top은 타일 인자 객체도 받음. wood = 선반 나무(CM1 우드, 기본 오크)
  const kitchen = (o = {}) => {
    const { upper = 'full', form = 'flat', sheen = 'matte', metal = 'nickel', wall = '#F1EFEA' } = o;
    const door = o.door || '#F4F1EC', lower = o.lower || door, wt = String(o.wood || 'oak').replace(/^wood:/, ''), wd = WOODS[wt] || wt;
    const fr = String(o.floor || '#D9CFC2').replace(/^wood:/, ''), flr = WOODS[fr] || fr;
    const K = sheen === 'polished' ? 1 : sheen === 'satin' ? .45 : 0; // 원칙 15: satin = polished ×0.45
    let defs = '';
    const col = (c, seed) => {
      const g = id('kc');
      if (typeof c === 'string' && c.startsWith('wood:')) {
        const base = WOODS[c.slice(5)] || c.slice(5), r = rnd(seed);
        let bd = '', dk = '', lt = '';
        r();
        for (let x = 0; x < 104;) { const w = 4 + r() * 8; bd += `<rect x="${x.toFixed(1)}" width="${w.toFixed(1)}" height="48" fill="${r() < .5 ? '#fff' : '#000'}" fill-opacity="${(.03 + r() * .04).toFixed(3)}"/>`; x += w; }
        for (let x = .8; x < 104; x += 1.6 + r() * 2.6) {
          const y = r() * 8, n = 22 + r() * 30, d = `M${x.toFixed(1)} ${y.toFixed(1)}q${((r() - .5) * 1.2).toFixed(1)} ${(n / 4).toFixed(1)} 0 ${(n / 2).toFixed(1)}t0 ${(n / 2).toFixed(1)}`;
          if (r() < .72) dk += d; else lt += d;
        }
        defs += `<pattern id="${g}" x="8" y="0" width="104" height="48" patternUnits="userSpaceOnUse"><rect width="104" height="48" fill="${base}"/>${bd}<path d="${dk}" fill="none" stroke="${shift(base, -26)}" stroke-opacity=".42" stroke-width=".5"/><path d="${lt}" fill="none" stroke="${shift(base, 16)}" stroke-opacity=".55" stroke-width=".5"/></pattern>`;
        return { fill: `url(#${g})`, base, wood: 1 };
      }
      const p = paint(c, g);
      defs += p.def;
      return { fill: p.fill, base: METALS[c] ? METALS[c][2] : c };
    };
    const D = col(door, 123457), L = lower === door ? D : col(lower, 234567);
    const gl = id('kg'), gd = id('kd'), rg = id('kr'), flutes = {};
    if (K) defs += `<linearGradient id="${gl}" x1="0" y1="0" x2="1" y2="1">${[[0, 0], [.3, 0], [.42, .38], [.5, 0], [.62, .14], [.7, 0], [1, 0]].map(([s, a]) => `<stop offset="${s}" stop-color="#fff" stop-opacity="${+(a * K).toFixed(3)}"/>`).join('')}</linearGradient><linearGradient id="${gd}" x1="0" y1="0" x2="1" y2="1">${[[0, 0], [.47, 0], [.55, .1], [.62, 0], [1, 0]].map(([s, a]) => `<stop offset="${s}" stop-color="#000" stop-opacity="${+(a * K).toFixed(3)}"/>`).join('')}</linearGradient><radialGradient id="${rg}"><stop offset="0" stop-color="#fff" stop-opacity="${.3 * K}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
    // 플루티드 홈: 밝은 문은 흰 선 α.55, 짙은 문은 흰 선을 낮춤(진한 바탕에서 줄무늬로만 읽히지 않게)
    const flute = c => flutes[c.base] || (flutes[c.base] = (() => {
      const g = id('kf'), n = parseInt(c.base.slice(1), 16), lum = ((n >> 16) * .3 + ((n >> 8 & 255) * .59) + (n & 255) * .11) / 255;
      defs += `<pattern id="${g}" width="1.8" height="4" patternUnits="userSpaceOnUse"><rect width=".6" height="4" fill="#fff" fill-opacity="${+(.55 * Math.min(1, .45 + lum * .6)).toFixed(2)}"/><rect x=".9" width=".6" height="4" fill="#000" fill-opacity=".2"/></pattern>`;
      return g;
    })());
    const sh = []; // 같은 도형을 (+1.5,+2) 옮긴 그림자
    // 문짝 한 짝: 색 → 형태 → 광택 순으로 덧그림 (나무 문은 짝마다 살짝 다른 톤)
    const leaf = (x, y, w, h, c, i) => {
      const box = `x="${x}" y="${y}" width="${w}" height="${h}"`;
      let s = `<rect ${box} fill="${c.fill}" stroke="#000" stroke-opacity=".2" stroke-width=".5"/>`;
      if (c.wood) s += `<rect ${box} fill="${i % 2 ? '#000' : '#fff'}" fill-opacity="${[.05, .04, .03, .05][i % 4]}"/>`;
      if (form === 'shaker') s += `<rect x="${x + 2.5}" y="${y + 2.5}" width="${w - 5}" height="${h - 5}" fill="#000" fill-opacity=".04" stroke="#000" stroke-opacity=".18" stroke-width=".5"/><path d="M${x + 2.5} ${y + h - 2.5}H${x + w - 2.5}V${y + 2.5}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".5"/>`;
      if (form === 'fluted') s += `<rect ${box} fill="url(#${flute(c)})"/>`;
      if (K) s += `<rect ${box} fill="url(#${gd})"/><rect ${box} fill="url(#${gl})"/><ellipse cx="${x + w * .68}" cy="${y + h * .24}" rx="${w * .3}" ry="${h * .1}" fill="url(#${rg})"/>`;
      return s;
    };
    const row = (n, x, w, y, h, c) => { sh.push(`<rect x="${x}" y="${y}" width="${w * n}" height="${h}"/>`); return Array.from({ length: n }, (_, i) => leaf(x + w * i, y, w, h, c, i)).join(''); };
    const board = (x, y, w) => {
      sh.push(`<rect x="${x}" y="${y}" width="${w}" height="1.6"/>`);
      return `<rect x="${x}" y="${y}" width="${w}" height="1.6" fill="${wd}" stroke="#000" stroke-opacity=".2" stroke-width=".5"/><rect x="${x}" y="${y}" width="${w}" height=".5" fill="#fff" fill-opacity=".35"/>`;
    };
    const bowl = (cx, y, w, h, f) => { // 바닥이 y(선반 윗면)에 닿는 그릇
      const d = `M${cx - w / 2} ${y - h}a${w / 2} ${h} 0 0 0 ${w} 0z`;
      sh.push(`<path d="${d}"/>`);
      return `<path d="${d}" fill="${f}" stroke="#000" stroke-opacity=".2" stroke-width=".5"/><rect x="${cx - w * .5}" y="${y - h}" width="${w}" height=".8" fill="#fff" fill-opacity=".5"/>`;
    };

    // ── 상부 ──
    let up = '';
    if (upper === 'flap') up = row(2, 8, 52, 16, 14, D);
    else if (upper === 'none') {
      const cap = 'points="77,22 91,22 96,30 72,30"';
      sh.push(`<polygon ${cap}/><rect x="80" y="4" width="8" height="18"/>`);
      up = `<rect x="80" y="4" width="8" height="18" fill="#DCDCD9" stroke="#000" stroke-opacity=".2" stroke-width=".5"/><rect x="85.5" y="4" width="2.5" height="18" fill="#000" fill-opacity=".07"/><rect x="81.2" y="4" width="1" height="18" fill="#fff" fill-opacity=".5"/>` +
        `<polygon ${cap} fill="#DCDCD9" stroke="#000" stroke-opacity=".2" stroke-width=".5"/><rect x="72.5" y="28.6" width="23" height="1.2" fill="#000" fill-opacity=".14"/><path d="M78 22.6H90" stroke="#fff" stroke-opacity=".5" stroke-width=".5"/>`;
    } else if (upper === 'openshelf') {
      const f = ['#F7F4EF', '#E6D7BE', '#A3B09B', '#C98F6B', '#F7F4EF', '#B9B1A5'];
      up = board(8, 16, 62) + board(8, 28.4, 62) +
        [[17, 10], [34, 9], [52, 10]].map(([x, w], i) => bowl(x, 16, w, 4.6, f[i])).join('') +
        [[14, 9], [30, 10], [48, 9]].map(([x, w], i) => bowl(x, 28.4, w, 4.6, f[i + 3])).join('');
      sh.push('<rect x="74" y="6" width="38" height="24"/>');
      up += `<rect x="74" y="6" width="38" height="24" fill="${D.fill}" stroke="#000" stroke-opacity=".2" stroke-width=".5"/>` +
        [76, 95].map(x => `<rect x="${x}" y="8" width="15" height="20" fill="${GLASS}" fill-opacity=".45" stroke="#000" stroke-opacity=".2" stroke-width=".5"/><path d="M${x} 15.5H${x + 15}M${x} 22H${x + 15}" stroke="#000" stroke-opacity=".18" stroke-width=".5"/><path d="M${x + 2} 14.6H${x + 8}M${x + 2} 21.1H${x + 10}M${x + 9} 27.4H${x + 13}" stroke="#8C8C86" stroke-opacity=".7" stroke-width="1.4"/>`).join('') +
        `<path d="M78 27L84 9H87L81 27Z" fill="#fff" fill-opacity=".3"/><path d="M97 27L103 9H106L100 27Z" fill="#fff" fill-opacity=".3"/>`;
    } else if (upper === 'mixed') {
      up = row(3, 8, 26, 6, 24, D) + board(86, 16, 26) + board(86, 28.4, 26) + bowl(93, 16, 5, 7, '#F7F4EF') + bowl(104, 16, 9, 4.6, '#A3B09B') + bowl(94, 28.4, 9, 4.6, '#E6D7BE') + bowl(105, 28.4, 9, 4.6, '#F7F4EF');
    } else up = row(4, 8, 26, 6, 24, D);

    // ── 하부·상판·수전 ──
    const low = row(4, 8, 26, 58, 22, L) + `<rect x="8" y="58" width="104" height="1.4" fill="#000" fill-opacity=".1"/><rect x="8" y="80" width="104" height="2" fill="${shift(L.base, -46)}"/>`;
    sh.push('<rect x="8" y="80" width="104" height="2"/>');
    const T = o.top && typeof o.top === 'object' ? o.top : null, TC = col(T ? T.color || '#E8E4DC' : o.top || '#E8E4DC', 345678);
    sh.push('<rect x="6" y="55" width="108" height="3"/>');
    const slab = `<rect x="6" y="55" width="108" height="3" fill="${TC.fill}" stroke="#000" stroke-opacity=".2" stroke-width=".5"/>${T ? nest(tile(T), 6, 55, 108, 3) : ''}<rect x="6" y="55" width="108" height=".7" fill="#fff" fill-opacity=".55"/><rect x="70" y="54.1" width="28" height=".9" fill="#3A3632"/>`;
    const M = paint(metal, id('km')), c3 = METALS[metal] ? METALS[metal][3] : '#8F8C86';
    const tap = 'M29.4 54V45Q29.4 40 34.4 40Q39.4 40 39.4 45V48.2H37.4V45Q37.4 42 34.4 42Q31.4 42 31.4 45V54Z', nz = '<rect x="37.1" y="47.6" width="3" height="2.4" rx=".8"/>', bs = '<rect x="28" y="53.4" width="10" height="1.8" rx=".9"/>';
    sh.push(`<path d="${tap}"/>${nz}${bs}`);
    const faucet = `<g fill="${M.fill}" stroke="${c3}" stroke-width=".5"><path d="${tap}"/>${nz}${bs}</g>`;

    return svg(`<rect width="120" height="90" fill="${wall}"/><rect width="120" height="4" fill="#E9E4DC"/><rect y="82" width="120" height="8" fill="${flr}"/><path d="M22 82V90M58 82V90M96 82V90" stroke="${shift(flr, -24)}" stroke-width=".5"/>` +
      `<g fill="#000" opacity=".15" transform="translate(1.5 2)">${sh.join('')}</g>${up}${low}${slab}${faucet}`, defs + M.def);
  };

  // 한옥 창살(세살 두 짝 창): 먹색 문살·문틀 + 한지, 뒤에서 번지는 불빛. 취향 칩용(인자 없음)
  const lattice = () => {
    const g = id('lg'), r = rnd(7), K = '#3B332C', X0 = 19.5, X1 = 100.5, Y0 = 12.5, Y1 = 75.5;
    const bars = [[X0, 57.5], [62.5, X1]].map(([a, b]) => Array.from({ length: 7 }, (_, k) => `<rect x="${(a + (k + .5) * (b - a) / 7 - .7).toFixed(2)}" y="${Y0}" width="1.4" height="${Y1 - Y0}"/>`).join('') + // 세로 살 7개
      [24.5, 44, 63.5].map(y => `<rect x="${a}" y="${y}" width="${b - a}" height="1.8"/>`).join('')).join('') + `<rect x="57.5" y="${Y0}" width="5" height="${Y1 - Y0}"/>`; // 가로 띠 3개 + 가운데 문설주
    const frame = `M16 9H104V79H16ZM${X0} ${Y0}V${Y1}H${X1}V${Y0}Z`;
    const fibers = Array.from({ length: 60 }, () => { const x = X0 + r() * (X1 - X0), y = Y0 + r() * (Y1 - Y0), a = r() * 3.14, l = 1.5 + r() * 3; return `M${x.toFixed(1)} ${y.toFixed(1)}l${(l * Math.cos(a)).toFixed(1)} ${(l * Math.sin(a)).toFixed(1)}`; }).join('');
    const sh = s => `<g transform="translate(1.5 2)" opacity=".15" fill="#000">${s}</g>`, pw = X1 - X0, ph = Y1 - Y0;
    return svg(`<rect width="120" height="90" fill="#E9E0D1"/>` +
      `<rect x="${X0}" y="${Y0}" width="${pw}" height="${ph}" fill="#F6F0E3"/><path d="${fibers}" fill="none" stroke="#E1D6BF" stroke-opacity=".5" stroke-width=".5"/><rect x="${X0}" y="${Y0}" width="${pw}" height="${ph}" fill="url(#${g})"/>` + // 한지 + 결 + 뒤에서 번지는 불빛
      `<g fill="${K}">${bars}</g>${sh(`<path d="${frame}" fill-rule="evenodd"/>`)}<path d="${frame}" fill="${K}" fill-rule="evenodd"/>` +
      `<path d="M16.25 79V9.25H104" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width=".5"/>` +
      `${sh('<rect x="12" y="79" width="96" height="3.6"/>')}<rect x="12" y="79" width="96" height="3.6" fill="#A58560"/><rect x="12" y="79" width="96" height=".8" fill="#C9A77C"/>` +
      `<circle cx="60" cy="46" r="2.8" fill="#B8955A" stroke="#8F6C30" stroke-width=".6"/><circle cx="60" cy="47.8" r="1.6" fill="none" stroke="#6B5126" stroke-width=".9"/>`, // 놋쇠 문고리
      `<radialGradient id="${g}" cx=".5" cy=".5" r=".62"><stop offset="0" stop-color="#FFE7B8" stop-opacity=".45"/><stop offset="1" stop-color="#FFE7B8" stop-opacity="0"/></radialGradient>`);
  };

    // 벽지 무늬 견본. kind: 'kids' = 구름·토끼 실루엣이 20u 격자로 반복 (바탕 #FBF6EC, 파스텔 3색 돌려쓰기)
    const motif = (kind = 'kids') => {
      const c = id('mc'), b = id('mb'), P = ['#F6DCDD', '#DCEBF2', '#E8F0D8'];
      const defs = `<g id="${c}"><circle cx="-4.8" cy=".6" r="3.6"/><circle cx="0" cy="-2.4" r="4.7"/><circle cx="4.9" cy=".4" r="3.8"/><rect x="-8.2" y="1" width="16.4" height="4" rx="2"/></g>` +
        `<g id="${b}"><ellipse cx="-2.3" cy="-8" rx="1.8" ry="4.8" transform="rotate(-9 -2.3 -8)"/><ellipse cx="2.3" cy="-8" rx="1.8" ry="4.8" transform="rotate(9 2.3 -8)"/><circle cy="-2" r="4.2"/><ellipse cy="5.2" rx="5.2" ry="4.4"/><circle cx="5.4" cy="6.6" r="1.5"/><ellipse cx="-2.6" cy="9.2" rx="2.2" ry="1.1"/><ellipse cx="2.6" cy="9.2" rx="2.2" ry="1.1"/>` +
        `<g fill="#FBF6EC" fill-opacity=".7"><ellipse cx="-2.3" cy="-8" rx=".8" ry="3" transform="rotate(-9 -2.3 -8)"/><ellipse cx="2.3" cy="-8" rx=".8" ry="3" transform="rotate(9 2.3 -8)"/></g></g>`;
      let body = '<rect width="120" height="90" fill="#FBF6EC"/>';
      for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) // 구름·토끼가 바둑판으로 번갈아, 색은 (i+2j)로 돌려 이웃과 겹치지 않게
        body += `<use href="#${(i + j) % 2 ? b : c}" x="${10 + 20 * i}" y="${5 + 20 * j}" fill="${P[(i + 2 * j) % 3]}"/>`;
      return svg(body, defs);
    };

  // 개구부(문 없는 통로) 정면: 사각·아치 × 몰딩 유무 2×2 취향 카드. 네 장은 이 두 가지 외엔 모두 같다. o: { arch: 윗부분 둥글게, molding: 문선 몰딩(3단 문선·머릿돌·굽돌) }
  const opening = (o = {}) => {
    const { arch = false, molding = false } = o, g = id('og'), f = id('of'), k = id('ok'), K = '#FBFAF7', ln = 'stroke="#00000022" stroke-width=".5"';
    const hole = arch ? 'M36 84V40A24 24 0 0 1 84 40V84Z' : 'M36 84V16H84V84Z', wallHole = `M0 0H120V90H0Z${hole}`; // 벽 = 전체에서 구멍 뺀 evenodd
    const ring = (a, c) => arch ? `M${36 - c} 84V40A${24 + c} ${24 + c} 0 0 1 ${84 + c} 40V84H${84 + a}V40A${24 + a} ${24 + a} 0 0 0 ${36 - a} 40V84Z` : `M${36 - c} 84V${16 - c}H${84 + c}V84H${84 + a}V${16 - a}H${36 - a}V84Z`; // 구멍에서 a~c만큼 바깥 띠
    const sh = d => `<path d="${d}" transform="translate(1.5 2)" fill="#000" fill-opacity=".15"/>`;
    const head = arch ? '55,7.2 65,7.2 63.6,16.8 56.4,16.8' : '26.5,6.6 93.5,6.6 93.5,9.2 26.5,9.2'; // 아치는 머릿돌, 사각은 처마 띠
    const blocks = [[27, 77, 9, 7], [84, 77, 9, 7]]; // 굽돌
    const dress = molding ? sh(ring(0, 7)) + `<polygon points="${head}" transform="translate(1.5 2)" fill="#000" fill-opacity=".15"/>` + blocks.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" transform="translate(1.5 2)" fill="#000" fill-opacity=".15"/>`).join('') +
      `<path d="${ring(0, 7)}" fill="${K}" ${ln}/><path d="${ring(3, 4.4)}" fill="#E3DDD2" stroke="#fff" stroke-opacity=".7" stroke-width=".5"/>` + (arch ? '' : '<path d="M29 9L36 16M91 9L84 16" stroke="#000" stroke-opacity=".12" stroke-width=".5"/>') +
      `<polygon points="${head}" fill="${K}" ${ln}/>` + blocks.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${K}" ${ln}/>`).join('') : '';
    const base = [[0, 36], [84, 36]].map(([x, w]) => `<rect x="${x}" y="80.5" width="${w}" height="3.5" fill="#fff"/>`).join(''); // 걸레받이: 개구부에서 끊김
    return svg(`<rect x="36" y="10" width="48" height="76" fill="url(#${g})"/><rect x="36" y="76" width="48" height="8" fill="url(#${f})"/><rect x="30" y="14" width="60" height="72" fill="url(#${k})"/>` +
      `<path d="${wallHole}" transform="translate(1.5 2)" fill="#000" fill-opacity=".15" fill-rule="evenodd"/><path d="${wallHole}" fill="#EFEBE5" fill-rule="evenodd"/>` +
      `<rect y="84" width="120" height="6" fill="#D1B38A"/><path d="M20 84V90M58 84V90M96 84V90" stroke="#B99A70" stroke-width=".5"/>${base}${dress}`,
      `<linearGradient id="${g}" x2="0" y2="1"><stop offset="0" stop-color="#F6EBD8"/><stop offset="1" stop-color="#EBDABD"/></linearGradient>` +
      `<linearGradient id="${f}" x2="0" y2="1"><stop offset="0" stop-color="#E9D3AB"/><stop offset="1" stop-color="#D9BF94"/></linearGradient>` +
      `<radialGradient id="${k}" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#FFE7B8" stop-opacity=".45"/><stop offset="1" stop-color="#FFE7B8" stop-opacity="0"/></radialGradient>`);
  };

    // 팔레트 견본: 가로 5칸 띠, 넓이 30:25:20:15:10 (왼쪽이 바탕색). colors: '#hex' 5개
    const palette = (colors = []) => {
      const k = colors.length === 5 ? [30, 25, 20, 15, 10] : colors.map(() => 1), sum = k.reduce((a, b) => a + b, 0);
      let x = 0;
      const bands = colors.map((c, i) => { const w = (120 * k[i]) / sum, s = `<rect x="${+x.toFixed(2)}" width="${+w.toFixed(2)}" height="90" fill="${c}"/>`; x += w; return s; });
      // 바탕이 흰색에 가까운 팔레트도 칸이 갈리도록 이음새와 가장자리에 머리카락 선만
      const seams = k.slice(0, -1).map((_, i) => `M${+(120 * k.slice(0, i + 1).reduce((a, b) => a + b, 0) / sum).toFixed(2)} 0V90`).join('');
      return svg(`${bands.join('')}<path d="${seams}" stroke="#000" stroke-opacity=".07" stroke-width=".5"/><rect x=".3" y=".3" width="119.4" height="89.4" fill="none" stroke="#000" stroke-opacity=".08" stroke-width=".6"/>`);
    };

  // 수납 벽(소품 12개는 모드와 상관없이 같은 칸·같은 물건): x10~110 y8~84, 4칸 × 3줄. o: { mode: hidden|mixed|open|glass, wall: 바탕색 }
  // hidden = 문 4짝(안 보임) · mixed = 아래 줄 문 + 위 두 줄 오픈 · open = 기둥 #2F2F2F + 전부 보임 · glass = 유리 #CFE0E6 α.45 + 골드 프레임 + 3000K
  const shelf = (o = {}) => {
    const { mode = 'mixed', wall = '#F1EFEA' } = o;
    const X = [10, 35, 60, 85], Y = [8, 33.33, 58.67, 84], ED = 'stroke="#000" stroke-opacity=".2" stroke-width=".5"', EB = ' stroke="#000" stroke-opacity=".15" stroke-width=".5"';
    const T = '#B5523B', G = '#2F4A3A', M = '#D9A441', S = '#8C8C86', C = '#E9E4DC', B = '#C9B79C', W = '#F7F4EF', N = '#6E6A64';
    const f = n => +n.toFixed(2), r = (x, y, w, h, c, ex = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${c}"${ex}/>`;
    let defs = '';
    const books = (cx, by, ws, hs, cs) => { let x = cx - ws.reduce((a, b) => a + b, 0) / 2; return ws.map((w, i) => { const s = r(x, by - hs[i], w, hs[i], cs[i], EB); x += w; return s; }).join(''); };
    const ITEMS = [ // 줄마다 4개, 바닥선 by에 놓임
      (cx, by) => books(cx, by, [3, 2.6, 3.4, 2.8, 3], [16, 13, 17, 14, 15], [G, M, T, S, C]),
      (cx, by) => `<path d="M${cx} ${by - 12}L${cx + 3.4} ${by - 19}" stroke="${G}" stroke-width=".8" fill="none"/><ellipse cx="${cx + 3.4}" cy="${by - 19}" rx="1.6" ry="2.6" fill="${G}"/><ellipse cx="${cx - .6}" cy="${by - 16}" rx="1.4" ry="2.4" fill="#5E7D5A" transform="rotate(-35 ${cx - .6} ${by - 16})"/><path d="M${cx - 3} ${by}Q${cx - 5.6} ${by - 7} ${cx - 2} ${by - 10}V${by - 13}H${cx + 2}V${by - 10}Q${cx + 5.6} ${by - 7} ${cx + 3} ${by}Z" fill="${C}"${EB}/>`,
      (cx, by) => r(cx - 8, by - 8, 16, 8, B, EB) + r(cx - 8, by - 6.2, 16, .6, '#000', ' fill-opacity=".15"') + r(cx - 5, by - 14, 10, 6, C, EB) + r(cx - 5, by - 12.2, 10, .6, '#000', ' fill-opacity=".15"'),
      (cx, by) => r(cx - 7.5, by - 3, 15, 3, G, EB) + r(cx - 6.5, by - 6, 13, 3, M, EB) + r(cx - 7, by - 9, 14, 3, T, EB) + `<circle cx="${cx + 1}" cy="${by - 11.6}" r="2.6" fill="${C}"${EB}/>`,
      (cx, by) => `<path d="M${cx - 8} ${by - 9}H${cx + 8}L${cx + 6.5} ${by}H${cx - 6.5}Z" fill="#C9A27A"${EB}/><path d="M${cx - 7.6} ${by - 5.5}H${cx + 7.6}M${cx - 7.1} ${by - 2.5}H${cx + 7.1}" stroke="#A8835C" stroke-opacity=".7" stroke-width=".5" fill="none"/><path d="M${cx - 8} ${by - 9}Q${cx - 8} ${by - 15} ${cx - 3} ${by - 15}H${cx + 3}Q${cx + 8} ${by - 15} ${cx + 8} ${by - 9}" stroke="#A8835C" stroke-width="1" fill="none"/>`,
      (cx, by) => `<ellipse cx="${cx - 4.6}" cy="${by - 11.5}" rx="2.2" ry="5" fill="${G}" transform="rotate(-28 ${cx - 4.6} ${by - 11.5})"/><ellipse cx="${cx + 4.6}" cy="${by - 11.5}" rx="2.2" ry="5" fill="#5E7D5A" transform="rotate(28 ${cx + 4.6} ${by - 11.5})"/><ellipse cx="${cx}" cy="${by - 14}" rx="2.4" ry="6" fill="${G}"/><path d="M${cx - 4} ${by - 7}H${cx + 4}L${cx + 3} ${by}H${cx - 3}Z" fill="${T}"${EB}/>`,
      (cx, by) => books(cx, by, [2.6, 3.2, 2.4, 3, 2.8], [15, 17, 12, 16, 13], [S, M, C, T, G]),
      (cx, by) => r(cx - 8, by - 15, 12, 15, N, EB) + r(cx - 6.6, by - 13.6, 9.2, 12.2, '#E6D7BE') + `<circle cx="${cx - 2}" cy="${by - 9}" r="1.8" fill="${M}"/><path d="M${cx - 6.6} ${by - 1.4}L${cx - 3.5} ${by - 6}L${cx - .5} ${by - 3}L${cx + 1} ${by - 4.5}V${by - 1.4}Z" fill="${G}"/>` + r(cx + 5.5, by - 7, 3, 7, C, EB) + `<ellipse cx="${cx + 7}" cy="${by - 8.6}" rx=".9" ry="1.5" fill="${M}"/>`,
      (cx, by) => r(cx - 8, by - 4, 16, 4, S, EB) + r(cx - 7, by - 8, 14, 4, B, EB) + r(cx - 8, by - 12, 16, 4, C, EB),
      (cx, by) => r(cx - 8.5, by - 12, 17, 12, S, EB).replace('/>', ' rx="1.5"/>') + r(cx - 4, by - 8, 8, 3, C),
      (cx, by) => r(cx - 3.5, by - 17, 7, 3, N).replace('/>', ' rx="1"/>') + r(cx - 4.5, by - 14, 9, 14, W, EB).replace('/>', ' rx="2"/>'),
      (cx, by) => r(cx - 9, by - 8, 8, 8, T, EB) + r(cx + 1, by - 8, 8, 8, M, EB) + r(cx - 4, by - 16, 8, 8, G, EB),
    ];
    const objs = rows => ITEMS.slice(0, rows * 4).map((it, i) => it(X[i % 4] + 12.5, Y[(i >> 2) + 1] - 1.6)).join('');
    const sh = s => `<g transform="translate(1.5 2)" opacity=".15">${s.replace(/(fill|stroke)="(?!none)[^"]*"/g, '$1="#000"')}</g>${s}`; // 같은 도형을 옮긴 그림자 먼저
    const bd = shift(wall, 8), block = '<rect x="11.5" y="10" width="100" height="76" fill="#000" fill-opacity=".15"/>';
    const door = (x, y, h) => r(x, y, 25, h, wall, ` ${ED}`);
    const bg = `<rect width="120" height="90" fill="${wall}"/><rect width="120" height="4" fill="#E9E4DC"/><rect y="84" width="120" height="6" fill="#D9CFC2"/>`;
    let body = '';
    if (mode === 'hidden') body = block + X.map(x => door(x, 8, 76)).join('');
    else if (mode === 'open') {
      const fr = [8, Y[1] - 1.6, Y[2] - 1.6, Y[3] - 1.6].map(y => r(10, y, 100, 1.6, C, ` ${ED}`)).join('') + [10, 35, 60, 85, 110].map(x => r(x - .8, 8, 1.6, 76, '#2F2F2F')).join('');
      body = sh(fr + objs(3));
    } else if (mode === 'glass') {
      const bk = id('sb'), gl = id('sg'), L = paint('gold', id('sf'));
      defs += `<linearGradient id="${bk}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFEFD0"/><stop offset="1" stop-color="#EBD9B6"/></linearGradient><linearGradient id="${gl}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7B8" stop-opacity=".45"/><stop offset="1" stop-color="#FFE7B8" stop-opacity="0"/></linearGradient>` + L.def;
      const bds = [Y[1] - 1.6, Y[2] - 1.6].map(y => r(11.4, y, 97.2, 1.6, '#F6EAD2', ` ${ED}`)).join('');
      const led = [8, Y[1] - 1.6, Y[2] - 1.6].map(y => r(10, y + 1.6, 100, 9, `url(#${gl})`) + r(11.4, y + 1.6, 97.2, .9, '#FFF6DD')).join('');
      body = block + r(10, 8, 100, 76, `url(#${bk})`) + led + bds + sh(objs(3)) +
        X.map(x => `<rect x="${x}" y="8" width="25" height="76" fill="${GLASS}" fill-opacity=".45"/><path d="M${x + 3} 84L${x + 10} 84L${x + 22} 8H${x + 15}Z" fill="#fff" fill-opacity=".22"/><rect x="${x + .7}" y="8.7" width="23.6" height="74.6" fill="none" stroke="${L.fill}" stroke-width="1.4"/>`).join('');
    } else { // mixed
      const sg = id('ss');
      defs += `<linearGradient id="${sg}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`;
      body = block + r(10, 8, 100, Y[2] - 8, shift(wall, -12)) + r(10, 8, 100, 7, `url(#${sg})`) +
        [8, Y[1] - 1.6, Y[2] - 1.6].map(y => r(11.4, y, 97.2, 1.6, bd, ` ${ED}`)).join('') + sh(objs(2)) +
        r(10, 8, 1.4, 76, bd, ` ${ED}`) + r(108.6, 8, 1.4, 76, bd, ` ${ED}`) + X.map(x => door(x, Y[2], Y[3] - Y[2])).join('');
    }
    return svg(bg + body, defs);
  };

  // 거실 소파 정면 입면: 색(#D9CFC2)·크기·구성·배경은 같고 모서리 처리(둥근 ↔ 각진)만 다름. 쿠션과 벽 액자도 같은 기준으로 맞춤.
  // kind: 'round' | 'square'
  const sofa = (kind = 'round') => {
    const S = '#D9CFC2', rd = kind !== 'square', ink = shift(S, -44);
    const sh = s => `<g fill="#000" fill-opacity=".15" transform="translate(1.5 2)">${s}</g>`; // 같은 도형을 옮긴 그림자
    let defs = '';
    const gr = (a, b, v = true) => { const q = id('sg'); defs += `<linearGradient id="${q}"${v ? ' x2="0" y2="1"' : ''}><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`; return `url(#${q})`; };
    const back = gr(shift(S, 2), shift(S, -14)), seat = gr(shift(S, 14), S), arm = gr(shift(S, -2), shift(S, -24), false);
    const R = rd ? { base: 5, bk: 12, st: 6.5, arm: 8 } : { base: 1, bk: 1.6, st: 1.2, arm: 1.6 }; // 모서리 반지름만 다르다
    const flo = '#D1B38A', st = ` stroke="${ink}" stroke-opacity=".55" stroke-width=".6"`;
    const box = (x, y, w, h, r, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"${f ? ` fill="${f}"${st}` : ''}/>`;
    const hi = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="1.2" rx=".6" fill="#fff" fill-opacity=".5"/>`; // 윗면 하이라이트
    const dome = 'M21 68V54Q21 34 60 34Q99 34 99 54V68Z';
    const frame = (c, k = 0) => rd ? `<circle cx="60" cy="17" r="${11 - k}"${c}/>` : `<rect x="${49 + k}" y="${6 + k}" width="${22 - 2 * k}" height="${22 - 2 * k}"${c}/>`;
    const pillow = c => rd ? `<circle cx="39" cy="53" r="8.2"${c}/>` : `<rect x="31" y="44.5" width="15.6" height="15.6" rx="1.2" transform="rotate(-9 38.8 52.3)"${c}/>`; // 쿠션도 원 ↔ 각진 정사각
    const bx = rd ? [[27, 39, 32, 24], [61, 39, 32, 24]] : [[26, 38, 33, 25], [60.5, 38, 33, 25]], sx = rd ? [22, 60, 38] : [24, 60, 36];
    const body = (rd ? `<path d="${dome}"/>` : '<rect x="24" y="36" width="72" height="33" rx="1.6"/>') + box(14, 66, 92, 10, R.base) + box(10, 50, 16, 26, R.arm) + box(94, 50, 16, 26, R.arm);
    let b = `<rect width="120" height="90" fill="#F1EFEA"/><rect y="76" width="120" height="2" fill="#F7F4EF"/><rect y="78" width="120" height="12" fill="${flo}"/><path d="M0 78H120M0 83.5H120M0 87.5H120" stroke="${shift(flo, -20)}" stroke-width=".5" stroke-opacity=".7"/>`;
    b += sh(frame('')) + frame(' fill="#EFE6D6" stroke="#8B7A66" stroke-width="1.6"') + frame(' fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".6"', 3);
    b += sh(body);
    if (!rd) b += [19, 98].map(x => `<rect x="${x}" y="75" width="3" height="4" fill="#6E5A4A"/>`).join('');
    b += (rd ? `<path d="${dome}" fill="${back}"${st}/>` : box(24, 36, 72, 33, R.bk, back)) + box(14, 66, 92, 10, R.base, shift(S, -18));
    for (const [x, y, w, h] of bx) b += box(x, y, w, h, R.bk, S) + hi(x + 4, y + 1.2, w - 8);
    b += [0, 1].map(i => box(sx[0] + i * (sx[1] - sx[0]), 57, sx[2], 13, R.st, seat) + hi(sx[0] + i * (sx[1] - sx[0]) + 3, 58.2, sx[2] - 6)).join('');
    b += box(10, 50, 16, 26, R.arm, arm) + box(94, 50, 16, 26, R.arm, arm) + hi(13, 51.2, 10) + hi(97, 51.2, 10);
    b += sh(pillow('')) + pillow(' fill="#C4B29A" stroke="#A89780" stroke-width=".6"') + (rd ? '<circle cx="39" cy="53" r="1" fill="#A89780"/>' : '');
    return svg(b, defs);
  };

  // 벽 마감 질감 견본(전면 클로즈업, 바탕색 위에 질감만 얹음). kind: silk | paint | plaster | limewash, color: 바탕 벽색(기본 #F1EFEA)
  // 질감은 검정·흰색 반점/띠만 얹어서 어떤 바탕색에서도 같은 느낌이 나게 함 (옅은 벽엔 검정이, 짙은 벽엔 흰색이 더 보임). 예외: limewash 의 큰 어두운 얼룩은 바탕색을 어둡게 한 색(회색 얼룩 방지)
  const wallTex = (kind = 'paint', color = '#F1EFEA') => {
    let defs = '';
    const ln = (d, c, w = .5, a = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-opacity="${a}" stroke-width="${w}"/>`;
    const lin = (stops, [x1, y1, x2, y2]) => { const g = id('wg'); defs += `<linearGradient id="${g}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([s, c, a = 1]) => `<stop offset="${s}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`; return `url(#${g})`; };
    // 노이즈(밝기 L)를 검정·흰색 반투명 층으로: L이 mid보다 어두우면 검정, 밝으면 흰색 (gain = 대비, op = 전체 진하기)
    // light 가 있으면 노이즈를 높이 지도로 보고 비스듬한 빛(feDistantLight)으로 요철 그림자를 만든 뒤 같은 방식으로 변환
    const tex = ({ fx, fy = fx, oct = 2, seed = 1, gain = 3, op = .1, rot = 0, relief = 0 }) => {
      const f = id('wf'), mid = relief ? Math.sin(45 * Math.PI / 180) : .5;
      const m = (c, a) => `<feColorMatrix in="l" type="matrix" values="0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 0 ${c} ${c ? gain : -gain} 0 0 0 ${(c ? -gain : gain) * mid}" result="${c ? 'w' : 'd'}"/>`;
      const src = relief
        ? `<feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="${oct}" seed="${seed}" result="n"/><feDiffuseLighting in="n" surfaceScale="${relief}" diffuseConstant="1" lighting-color="#fff" result="l"><feDistantLight azimuth="215" elevation="45"/></feDiffuseLighting>`
        : `<feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="${oct}" seed="${seed}" result="l"/>`;
      const [x, y, w, h] = rot ? [-80, -80, 280, 250] : [0, 0, 120, 90]; // 돌린 층은 어느 각도로 돌려도 카드를 덮게 크게
      defs += `<filter id="${f}" x="${x}" y="${y}" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">${src}${m(0)}${m(1)}<feMerge><feMergeNode in="d"/><feMergeNode in="w"/></feMerge></filter>`;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" filter="url(#${f})" opacity="${op}"${rot ? ` transform="rotate(${rot} 60 45)"` : ''}/>`;
    };
    const clip = id('wc');
    defs += `<clipPath id="${clip}"><rect width="120" height="90"/></clipPath>`;
    const base = f => `<rect width="120" height="90" fill="${f || color}"/>`;
    const K = {
      // 무광 도장: 이음선·결 없이 좌상→우하로 ±4만 어두워지는 밋밋한 면
      paint: () => base(lin([[0, shift(color, 4)], [1, shift(color, -4)]], [0, 0, 1, 1])),
      // 실크벽지: 세로 롤 이음선(35u 간격) + 폭마다 아주 조금 다른 톤 + 미세 엠보 + 대각 광택(polished ×0.3)
      silk: () => {
        const sheen = lin([[0, '#fff', 0], [.3, '#fff', 0], [.42, '#fff', .38 * .3], [.5, '#fff', 0], [.62, '#fff', .14 * .3], [.7, '#fff', 0], [1, '#fff', 0]], [0, 0, 1, 1]);
        return base() + [1, 3].map(i => `<rect x="${i * 35}" width="35" height="90" fill="#000" fill-opacity=".045"/>`).join('') + tex({ fx: .8, oct: 2, seed: 5, gain: 2, op: .05 }) +
          [35, 70, 105].map(x => ln(`M${x} 0V90`, '#000', .5, .18) + ln(`M${x + .6} 0V90`, '#fff', .5, .6)).join('') + `<rect width="120" height="90" fill="${sheen}"/>`;
      },
      // 회벽: 거친 요철(.9, 2옥타브) + 왼쪽 위에서 비스듬히 드는 빛
      plaster: () => base() + tex({ fx: .9, oct: 2, seed: 3, gain: 2, op: .22, relief: 1 }) + tex({ fx: .07, oct: 3, seed: 8, gain: 2, op: .18, relief: 2.4 }) +
        `<rect width="120" height="90" fill="${lin([[0, '#fff', .2], [.45, '#fff', 0], [1, '#000', .14]], [0, 0, 1, .25])}"/>`,
      // 석회 미장: 큰 얼룩 5개(r20~35u, 가장자리로 번짐; 어두운 3개는 검정이 아니라 바탕색 −22 한 같은 색상 α.35 → 따뜻한 벽이 회색 얼룩으로 안 변함, 밝은 2개는 흰색 α.15)
      //           + 구름 같은 농담 + 엇갈린 두 방향 붓결(α.06·.03: 마름모 격자·대리석 결로 안 읽히게 아주 옅게)
      limewash: () => {
        const r = rnd(23);
        let s = base();
        for (let i = 0; i < 5; i++) {
          const g = id('wb'), dark = i !== 1 && i !== 4, c = dark ? shift(color, -22) : '#fff', a = dark ? .35 : .15, rr = 20 + r() * 15, cx = 12 + r() * 96, cy = 10 + r() * 70;
          defs += `<radialGradient id="${g}"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/><stop offset=".55" stop-color="${c}" stop-opacity="${a * .5}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
          s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rr.toFixed(1)}" fill="url(#${g})"/>`;
        }
        return s + tex({ fx: .025, oct: 3, seed: 12, gain: 1.6, op: .12 }) + tex({ fx: .025, fy: .11, oct: 3, seed: 9, gain: 2, op: .06, rot: -24 }) + tex({ fx: .03, fy: .15, oct: 2, seed: 4, gain: 2, op: .03, rot: 28 });
      },
    };
    return svg(`<g clip-path="url(#${clip})">${(K[kind] || K.paint)()}</g>`, defs);
  };

  // 색 밝기 조절 (#rrggbb, k: -255..255)
  function shift(hex, k) {
    const n = parseInt(hex.slice(1), 16), c = v => Math.max(0, Math.min(255, v + k));
    return '#' + [16, 8, 0].map(s => c((n >> s) & 255).toString(16).padStart(2, '0')).join('');
  }

  return { shift, metal, tile, wood, light, kelvin, plan, door, elev, finish, switchPlate, lineRoom, ceiling, handle, lever, bathWall, windowDress, lamp, pendant, fan, power, bath, closet, corner, doorCorner, head, idoor, kidsRoom, kitchen, lattice, motif, opening, palette, shelf, sofa, wallTex, METALS, WOODS, PLANS, ELEV };
})();

if (typeof module !== 'undefined') module.exports = V;
