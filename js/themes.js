// 面ごとのアートテーマ(アトモスフィアク風)。
// 背景(空グラデ・多層パララックス)・霧・ビネット・カラーグレード・アンビエント粒子、
// および地形タイルの配色を一元管理する。gfx.js のヘルパー(fillCircle 等)を使う。

const Themes = {
  ambient: [],   // 画面に常時漂う粒子(スクリーン座標)

  get(i) {
    return THEMES[Math.max(0, Math.min(THEMES.length - 1, i))];
  },

  // ステージindex → テーマ(ワールドごとの世界観割り当て)。未定義は巡回でフォールバック
  forStage(i) {
    const idx = (typeof STAGE_THEME !== 'undefined' && STAGE_THEME[i] !== undefined)
      ? STAGE_THEME[i] : (i % THEMES.length);
    return THEMES[Math.max(0, Math.min(THEMES.length - 1, idx))];
  },

  // === 背景(空 → 遠景パララックス → 奥霧) ===
  drawBackground(ctx, t, cam, frame) {
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, t.sky[0]);
    sky.addColorStop(1, t.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (t.sun) {
      const g = ctx.createRadialGradient(t.sun.x, t.sun.y, 8, t.sun.x, t.sun.y, t.sun.r);
      g.addColorStop(0, t.sun.color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(t.sun.x - t.sun.r, t.sun.y - t.sun.r, t.sun.r * 2, t.sun.r * 2);
      fillCircle(ctx, t.sun.x, t.sun.y, t.sun.core || 28, t.sun.coreColor || '#fff4c4');
    }

    for (const layer of t.parallax) drawLayer(ctx, layer, cam, frame);

    // 奥の霧(下半分にうっすら)
    if (t.fog) {
      const f = ctx.createLinearGradient(0, H * 0.45, 0, H);
      f.addColorStop(0, `rgba(${t.fog.color},0)`);
      f.addColorStop(1, `rgba(${t.fog.color},${t.fog.strength})`);
      ctx.fillStyle = f;
      ctx.fillRect(0, H * 0.45, W, H * 0.55);
    }
  },

  // === ワールドの上に重ねる大気(前景霧 → アンビエント → ビネット → グレード) ===
  drawAtmosphere(ctx, t, frame) {
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;

    // 流れる前景もや
    if (t.fog) {
      const drift = (frame * 0.3) % (W + 200);
      ctx.fillStyle = `rgba(${t.fog.color},${t.fog.strength * 0.35})`;
      for (let i = 0; i < 3; i++) {
        const cx = ((i * 420 - drift) % (W + 300) + (W + 300)) % (W + 300) - 150;
        const cy = H - 60 - i * 30;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 180, 40, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this.drawAmbient(ctx);

    // グレード+ビネットは事前に1枚へ焼いて使い回す(毎フレームのラジアル生成を回避)
    const ov = this.overlaySheet(t);
    if (ov) {
      ctx.drawImage(ov, 0, 0);
    } else {
      if (t.grade) { ctx.fillStyle = t.grade; ctx.fillRect(0, 0, W, H); }
      if (t.vignette) {
        const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, `rgba(0,0,0,${t.vignette})`);
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      }
    }
  },

  // === アンビエント粒子(塵・蛍・雪・火の粉など) ===
  reset(t) {
    this.ambient.length = 0;
    if (!t.ambient) return;
    const n = t.ambient.count || 24;
    for (let i = 0; i < n; i++) this.ambient.push(this._make(t.ambient));
  },

  _make(a) {
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: a.size[0] + Math.random() * (a.size[1] - a.size[0]),
      vx: (a.vx[0] + Math.random() * (a.vx[1] - a.vx[0])),
      vy: (a.vy[0] + Math.random() * (a.vy[1] - a.vy[0])),
      ph: Math.random() * Math.PI * 2,
      kind: a.kind,
      color: a.color,
    };
  },

  updateAmbient(t, frame) {
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
    if (!t.ambient) { this.ambient.length = 0; return; }
    if (this.ambient.length === 0) this.reset(t);
    for (const p of this.ambient) {
      p.ph += 0.03;
      p.x += p.vx + (p.kind === 'firefly' ? Math.sin(p.ph) * 0.3 : 0);
      p.y += p.vy + (p.kind === 'firefly' ? Math.cos(p.ph * 0.7) * 0.2 : 0);
      // 画面外に出たら反対側へ
      if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
    }
  },

  drawAmbient(ctx) {
    for (const p of this.ambient) {
      const a = p.kind === 'firefly' || p.kind === 'ember'
        ? 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(p.ph * 2))
        : 0.5;
      if (p.kind === 'firefly' || p.kind === 'ember') {
        const spr = this.glowSprite(p.color);
        ctx.globalCompositeOperation = 'lighter';
        if (spr) {
          ctx.globalAlpha = a;
          const d = p.r * 6;
          ctx.drawImage(spr, p.x - d / 2, p.y - d / 2, d, d);
          ctx.globalAlpha = 1;
        } else {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          g.addColorStop(0, `rgba(${p.color},${a})`);
          g.addColorStop(1, `rgba(${p.color},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.kind === 'snow') {
        fillCircle(ctx, p.x, p.y, p.r, `rgba(${p.color},0.85)`);
      } else {
        fillCircle(ctx, p.x, p.y, p.r, `rgba(${p.color},${a})`);
      }
    }
  },
};

// --- オフスクリーン・キャッシュ(毎フレームの重い描画を1回に減らす) ---

function makeCanvas(w, h) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// テーマごとのグレード+ビネットを1枚に焼く
Themes.overlaySheet = function (t) {
  if (t._overlay !== undefined) return t._overlay;
  const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
  const cv = makeCanvas(W, H);
  if (!cv) { t._overlay = null; return null; }
  const g = cv.getContext('2d');
  if (t.grade) { g.fillStyle = t.grade; g.fillRect(0, 0, W, H); }
  if (t.vignette) {
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${t.vignette})`);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
  t._overlay = cv;
  return cv;
};

// 発光スプライト(色ごとに1枚キャッシュ)
Themes._glowSprites = {};
Themes.glowSprite = function (color) {
  if (color in this._glowSprites) return this._glowSprites[color];
  const S = 32;
  const cv = makeCanvas(S, S);
  if (!cv) { this._glowSprites[color] = null; return null; }
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, `rgba(${color},1)`);
  grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  this._glowSprites[color] = cv;
  return cv;
};

// 地形タイルを3セル(土 / 土+天面 / ブロック)に焼く。Level.draw は drawImage で使う
Themes.tileSheet = function (t) {
  if (t._sheet !== undefined) return t._sheet;
  const T = CONFIG.TILE, tl = t.tile;
  const cv = makeCanvas(T * 3, T);
  if (!cv) { t._sheet = null; return null; }
  const g = cv.getContext('2d');
  const dirt = (ox) => {
    const grad = g.createLinearGradient(0, 0, 0, T);
    grad.addColorStop(0, tl.dirtTop); grad.addColorStop(1, tl.dirtBottom);
    g.fillStyle = grad; g.fillRect(ox, 0, T, T);
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(ox + 6, 14, 3, 3); g.fillRect(ox + 20, 22, 3, 3); g.fillRect(ox + 14, 8, 2, 2);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.strokeRect(ox + 0.5, 0.5, T - 1, T - 1);
  };
  dirt(0);              // セル0: 土だけ
  dirt(T); bakeCap(g, T, tl); // セル1: 土+天面
  // セル2: 浮き足場ブロック
  const ox = T * 2;
  fillRound(g, ox + 1, 1, T - 2, T - 2, 5, tl.block);
  fillRound(g, ox + 3, 3, T - 6, 5, 2, 'rgba(255,255,255,0.4)');
  fillRound(g, ox + 3, T - 8, T - 6, 5, 2, 'rgba(0,0,0,0.18)');
  fillCircle(g, ox + 6, 6, 1.6, tl.blockEdge);
  fillCircle(g, ox + T - 6, 6, 1.6, tl.blockEdge);
  fillCircle(g, ox + 6, T - 6, 1.6, tl.blockEdge);
  fillCircle(g, ox + T - 6, T - 6, 1.6, tl.blockEdge);
  t._sheet = cv;
  return cv;
};

// 天面の固定部分を焼く(ランダムな飾りは Level 側で上描き)
function bakeCap(g, ox, tl) {
  const T = CONFIG.TILE;
  const cap = g.createLinearGradient(0, 0, 0, 12);
  cap.addColorStop(0, tl.capTop); cap.addColorStop(1, tl.capBottom);
  g.fillStyle = cap; g.fillRect(ox, 0, T, 11);
  g.fillStyle = tl.capHi; g.fillRect(ox, 0, T, 3);
  if (tl.cap === 'grass') {
    fillCircle(g, ox + 8, 11, 4, tl.capBottom);
    fillCircle(g, ox + 22, 11, 4, tl.capBottom);
  } else if (tl.cap === 'snow') {
    fillCircle(g, ox + 8, 10, 4, '#fff');
    fillCircle(g, ox + 22, 10, 4, '#fff');
  } else if (tl.cap === 'lava') {
    g.fillStyle = tl.capHi; g.fillRect(ox, 0, T, 2);
  } else if (tl.cap === 'sand') {
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(ox, 2, T, 1.5);
  }
}

// パララックスの1レイヤーを描く
function drawLayer(ctx, layer, cam, frame) {
  const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
  const mod = (v, m) => ((v % m) + m) % m;
  const off = cam.x * layer.par;
  const baseY = layer.baseY;
  ctx.fillStyle = layer.color;

  switch (layer.kind) {
    case 'hills': {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let sx = -20; sx <= W + 20; sx += 20) {
        const wx = sx + off;
        const y = baseY - Math.sin(wx * 0.004) * layer.amp - Math.sin(wx * 0.013) * layer.amp * 0.4;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      break;
    }
    case 'mountains': {
      const span = layer.span || 280;
      for (let i = -1; i < W / span + 2; i++) {
        const cx = i * span - mod(off, span);
        const hw = span * 0.62;
        ctx.beginPath();
        ctx.moveTo(cx - hw, baseY);
        ctx.lineTo(cx, baseY - layer.amp);
        ctx.lineTo(cx + hw, baseY);
        ctx.closePath(); ctx.fill();
        if (layer.snow) {
          ctx.fillStyle = layer.snow;
          ctx.beginPath();
          ctx.moveTo(cx - hw * 0.28, baseY - layer.amp * 0.72);
          ctx.lineTo(cx, baseY - layer.amp);
          ctx.lineTo(cx + hw * 0.28, baseY - layer.amp * 0.72);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = layer.color;
        }
      }
      break;
    }
    case 'trees': {
      const span = layer.span || 120;
      for (let i = -1; i < W / span + 2; i++) {
        const cx = i * span - mod(off, span) + (i % 2) * 18;
        const s = layer.s || 1;
        ctx.fillStyle = layer.trunk || '#3a2a1a';
        ctx.fillRect(cx - 4 * s, baseY - 22 * s, 8 * s, 26 * s);
        ctx.fillStyle = layer.color;
        fillCircle(ctx, cx, baseY - 30 * s, 16 * s, layer.color);
        fillCircle(ctx, cx - 12 * s, baseY - 22 * s, 12 * s, layer.color);
        fillCircle(ctx, cx + 12 * s, baseY - 22 * s, 12 * s, layer.color);
      }
      break;
    }
    case 'clouds': {
      const span = layer.span || 300;
      for (let i = -1; i < W / span + 2; i++) {
        const cx = i * span - mod(off, span);
        const cy = baseY + (i % 3) * 26;
        const s = layer.s || 1;
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        ctx.arc(cx, cy, 22 * s, 0, Math.PI * 2);
        ctx.arc(cx + 26 * s, cy - 10 * s, 17 * s, 0, Math.PI * 2);
        ctx.arc(cx + 52 * s, cy, 22 * s, 0, Math.PI * 2);
        ctx.arc(cx + 26 * s, cy + 8 * s, 18 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'stars': {
      for (let i = 0; i < 60; i++) {
        const x = mod(i * 137 - off, W + 40) - 20;
        const y = (i * 53) % (baseY);
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(frame * 0.05 + i));
        fillCircle(ctx, x, y, i % 7 === 0 ? 1.6 : 1, `rgba(255,255,255,${tw})`);
      }
      break;
    }
    case 'cave': {
      // 上から垂れる岩(鍾乳石)+ 下の岩肌
      const span = layer.span || 110;
      ctx.fillStyle = layer.color;
      for (let i = -1; i < W / span + 2; i++) {
        const cx = i * span - mod(off, span);
        const hh = layer.amp * (0.6 + ((i * 7) % 5) / 10);
        ctx.beginPath();
        ctx.moveTo(cx - 22, 0); ctx.lineTo(cx, hh); ctx.lineTo(cx + 22, 0);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillRect(0, 0, W, layer.top || 10);
      break;
    }
    case 'pillars': {
      // 遺跡/溶岩の柱シルエット
      const span = layer.span || 200;
      ctx.fillStyle = layer.color;
      for (let i = -1; i < W / span + 2; i++) {
        const cx = i * span - mod(off, span);
        const h = layer.amp * (0.7 + ((i * 3) % 4) / 8);
        ctx.fillRect(cx - 22, baseY - h, 44, h);
        ctx.fillRect(cx - 30, baseY - h, 60, 12);
      }
      break;
    }
    case 'dunes': {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let sx = -20; sx <= W + 20; sx += 24) {
        const wx = sx + off;
        const y = baseY - Math.abs(Math.sin(wx * 0.003)) * layer.amp;
        ctx.lineTo(sx, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      break;
    }
  }
}

// ---- 9面ぶんのテーマ定義 ----
const THEMES = [
  { // 1 朝もやの草原
    name: '朝もやの草原',
    sky: ['#bfe3f2', '#f3ead2'],
    sun: { x: 760, y: 110, r: 150, color: 'rgba(255,248,214,0.8)', core: 30, coreColor: '#fff6da' },
    fog: { color: '236,232,214', strength: 0.5 },
    vignette: 0.28, grade: 'rgba(255,238,196,0.08)', glow: '255,236,170',
    parallax: [
      { kind: 'mountains', color: '#a9c6c2', par: -0.12, baseY: 380, amp: 120, span: 320 },
      { kind: 'hills', color: '#9fd08a', par: -0.22, baseY: 400, amp: 44 },
      { kind: 'trees', color: '#6fb45e', trunk: '#5a3f2a', par: -0.38, baseY: 416, s: 1 },
    ],
    ambient: { kind: 'dust', color: '255,255,255', count: 26, size: [1, 2.4], vx: [-0.2, 0.2], vy: [-0.25, -0.05] },
    tile: { dirtTop: '#b08a5a', dirtBottom: '#7c5a32', cap: 'grass', capTop: '#74d35e', capBottom: '#3fa53f', capHi: '#9be884', accent: '#3aa53a', block: '#e8b85d', blockEdge: '#a06a18', deco: '#ffd24a' },
  },
  { // 2 昼の丘
    name: '昼の丘',
    sky: ['#62a8f0', '#bfe6ff'],
    sun: { x: 800, y: 90, r: 130, color: 'rgba(255,250,220,0.7)', core: 26 },
    fog: { color: '210,235,255', strength: 0.28 },
    vignette: 0.22, grade: 'rgba(120,180,255,0.05)', glow: '255,240,180',
    parallax: [
      { kind: 'mountains', color: '#7fb0d8', par: -0.13, baseY: 390, amp: 130, span: 300 },
      { kind: 'clouds', color: 'rgba(255,255,255,0.9)', par: -0.3, baseY: 90, s: 1 },
      { kind: 'hills', color: '#7ec96a', par: -0.24, baseY: 405, amp: 52 },
      { kind: 'trees', color: '#4fae46', trunk: '#5a3f2a', par: -0.4, baseY: 418 },
    ],
    ambient: { kind: 'dust', color: '255,255,255', count: 20, size: [1, 2], vx: [-0.2, 0.3], vy: [-0.2, 0] },
    tile: { dirtTop: '#b07038', dirtBottom: '#7c4a22', cap: 'grass', capTop: '#62cf52', capBottom: '#3aa53a', capHi: '#7be06a', accent: '#3aa53a', block: '#e8a33d', blockEdge: '#a06a18', deco: '#ffd24a' },
  },
  { // 3 夕暮れの平原
    name: '夕暮れの平原',
    sky: ['#f7a85c', '#9a5a8c'],
    sun: { x: 480, y: 200, r: 200, color: 'rgba(255,200,140,0.7)', core: 40, coreColor: '#ffd9a0' },
    fog: { color: '120,80,110', strength: 0.45 },
    vignette: 0.36, grade: 'rgba(255,150,90,0.10)', glow: '255,190,120',
    parallax: [
      { kind: 'mountains', color: '#6e4f78', par: -0.12, baseY: 390, amp: 140, span: 320 },
      { kind: 'hills', color: '#7a5a86', par: -0.24, baseY: 405, amp: 50 },
      { kind: 'trees', color: '#3a2d52', trunk: '#2a2038', par: -0.4, baseY: 418 },
    ],
    ambient: { kind: 'dust', color: '255,210,150', count: 24, size: [1, 2.2], vx: [-0.3, 0.2], vy: [-0.2, -0.02] },
    tile: { dirtTop: '#9a6a52', dirtBottom: '#5e3f3a', cap: 'grass', capTop: '#8a6f9a', capBottom: '#5a4570', capHi: '#a98fc0', accent: '#5a4570', block: '#d88a5a', blockEdge: '#7a4530', deco: '#ffd28a' },
  },
  { // 4 雲海・空
    name: '雲海の空',
    sky: ['#9fd2f5', '#eaf6ff'],
    sun: { x: 700, y: 100, r: 160, color: 'rgba(255,255,240,0.8)', core: 30 },
    fog: { color: '255,255,255', strength: 0.5 },
    vignette: 0.2, grade: 'rgba(200,230,255,0.08)', glow: '255,255,255',
    parallax: [
      { kind: 'clouds', color: 'rgba(255,255,255,0.55)', par: -0.1, baseY: 150, s: 1.6, span: 360 },
      { kind: 'clouds', color: 'rgba(255,255,255,0.8)', par: -0.24, baseY: 250, s: 1.3, span: 300 },
      { kind: 'clouds', color: 'rgba(255,255,255,0.95)', par: -0.42, baseY: 360, s: 1.1, span: 240 },
    ],
    ambient: { kind: 'dust', color: '255,255,255', count: 22, size: [1.5, 3], vx: [-0.4, -0.1], vy: [-0.1, 0.1] },
    tile: { dirtTop: '#cfe6f5', dirtBottom: '#9bbcd6', cap: 'rock', capTop: '#ffffff', capBottom: '#cfe2f0', capHi: '#ffffff', accent: '#a9cbe0', block: '#dff0fb', blockEdge: '#9bbcd6', deco: '#ffffff' },
  },
  { // 5 夜の森(蛍)
    name: '夜の森',
    sky: ['#10183a', '#283a6a'],
    fog: { color: '30,40,80', strength: 0.4 },
    vignette: 0.5, grade: 'rgba(30,40,90,0.16)', glow: '160,255,150',
    parallax: [
      { kind: 'stars', color: '#fff', par: -0.05, baseY: 240 },
      { kind: 'mountains', color: '#1a2348', par: -0.13, baseY: 400, amp: 150, span: 340 },
      { kind: 'trees', color: '#13241f', trunk: '#0c1814', par: -0.3, baseY: 416, s: 1.2 },
      { kind: 'trees', color: '#0c1a16', trunk: '#0a140f', par: -0.5, baseY: 424, s: 1.5 },
    ],
    ambient: { kind: 'firefly', color: '180,255,150', count: 18, size: [1.2, 2.2], vx: [-0.3, 0.3], vy: [-0.2, 0.2] },
    tile: { dirtTop: '#3a3b2a', dirtBottom: '#23241a', cap: 'grass', capTop: '#3f6e44', capBottom: '#274a30', capHi: '#5a8a5a', accent: '#2a5c30', block: '#4a5238', blockEdge: '#2a2e1e', deco: '#9bff8a' },
  },
  { // 6 洞窟
    name: '結晶の洞窟',
    sky: ['#0a0e18', '#161c2e'],
    fog: { color: '20,30,50', strength: 0.45 },
    vignette: 0.6, grade: 'rgba(20,40,70,0.14)', glow: '120,230,255',
    parallax: [
      { kind: 'cave', color: '#141a2a', par: -0.1, baseY: 0, amp: 120, span: 130, top: 14 },
      { kind: 'pillars', color: '#0e1320', par: -0.26, baseY: 440, amp: 200, span: 220 },
    ],
    ambient: { kind: 'firefly', color: '120,230,255', count: 16, size: [1, 2], vx: [-0.15, 0.15], vy: [-0.25, 0.05] },
    tile: { dirtTop: '#3a4055', dirtBottom: '#222636', cap: 'rock', capTop: '#4a5570', capBottom: '#2e3548', capHi: '#6a7aa0', accent: '#7be0ff', block: '#3e4866', blockEdge: '#202840', deco: '#7be0ff' },
  },
  { // 7 雪原・氷
    name: '雪原',
    sky: ['#b9cfe0', '#eef4f8'],
    fog: { color: '230,238,245', strength: 0.5 },
    vignette: 0.26, grade: 'rgba(200,220,240,0.10)', glow: '210,235,255',
    parallax: [
      { kind: 'mountains', color: '#9fb4c6', par: -0.12, baseY: 390, amp: 150, span: 320, snow: '#eef4f8' },
      { kind: 'hills', color: '#d6e4ee', par: -0.24, baseY: 405, amp: 48 },
      { kind: 'trees', color: '#7f99a8', trunk: '#5a6470', par: -0.4, baseY: 418 },
    ],
    ambient: { kind: 'snow', color: '255,255,255', count: 40, size: [1, 2.6], vx: [-0.5, 0.2], vy: [0.4, 1.1] },
    tile: { dirtTop: '#9fb0c0', dirtBottom: '#6f8090', cap: 'snow', capTop: '#ffffff', capBottom: '#dfeaf2', capHi: '#ffffff', accent: '#bcd6e8', block: '#dbe8f2', blockEdge: '#9fb4c6', deco: '#ffffff' },
  },
  { // 8 黄昏の遺跡
    name: '黄昏の遺跡',
    sky: ['#e8a85a', '#7a4a44'],
    sun: { x: 600, y: 160, r: 190, color: 'rgba(255,210,150,0.7)', core: 36, coreColor: '#ffe0b0' },
    fog: { color: '120,80,60', strength: 0.45 },
    vignette: 0.4, grade: 'rgba(200,140,80,0.12)', glow: '255,200,130',
    parallax: [
      { kind: 'mountains', color: '#8a5e4a', par: -0.12, baseY: 390, amp: 130, span: 320 },
      { kind: 'pillars', color: '#6e4a3a', par: -0.24, baseY: 420, amp: 150, span: 210 },
      { kind: 'dunes', color: '#b98a5a', par: -0.4, baseY: 430, amp: 36 },
    ],
    ambient: { kind: 'dust', color: '255,220,160', count: 28, size: [1, 2.4], vx: [-0.5, -0.1], vy: [-0.1, 0.1] },
    tile: { dirtTop: '#c79a64', dirtBottom: '#8a6238', cap: 'sand', capTop: '#e0bd84', capBottom: '#b8915a', capHi: '#f0d4a0', accent: '#8a6238', block: '#d8b070', blockEdge: '#8a6238', deco: '#fff0c8' },
  },
  { // 9 溶岩のボス部屋(W1ボス)
    name: '溶岩の決戦場',
    sky: ['#3a0e0e', '#120608'],
    fog: { color: '90,20,10', strength: 0.5 },
    vignette: 0.6, grade: 'rgba(120,30,10,0.16)', glow: '255,140,40',
    parallax: [
      { kind: 'cave', color: '#1c0c0c', par: -0.1, baseY: 0, amp: 110, span: 140, top: 12 },
      { kind: 'pillars', color: '#2a1010', par: -0.26, baseY: 440, amp: 200, span: 200 },
    ],
    ambient: { kind: 'ember', color: '255,150,50', count: 26, size: [1, 2.4], vx: [-0.3, 0.3], vy: [-1.0, -0.3] },
    tile: { dirtTop: '#4a2418', dirtBottom: '#2a120c', cap: 'lava', capTop: '#7a2e16', capBottom: '#4a1c0e', capHi: '#ff7b3c', accent: '#ff7b1c', block: '#5a2818', blockEdge: '#2a120c', deco: '#ff9a3c' },
  },

  // ===== WORLD 2: 空と氷雪 (index 9〜12) =====
  { // 9 天空回廊
    name: '天空回廊',
    sky: ['#7ec8f5', '#dff2ff'],
    sun: { x: 740, y: 110, r: 150, color: 'rgba(255,255,240,0.8)', core: 30 },
    fog: { color: '230,245,255', strength: 0.4 },
    vignette: 0.2, grade: 'rgba(180,225,255,0.07)', glow: '255,255,255',
    parallax: [
      { kind: 'clouds', color: 'rgba(255,255,255,0.5)', par: -0.1, baseY: 140, s: 1.7, span: 360 },
      { kind: 'clouds', color: 'rgba(255,255,255,0.8)', par: -0.26, baseY: 250, s: 1.3, span: 300 },
      { kind: 'mountains', color: '#bcd8ee', par: -0.13, baseY: 400, amp: 120, span: 320, snow: '#ffffff' },
    ],
    ambient: { kind: 'dust', color: '255,255,255', count: 22, size: [1, 2.4], vx: [-0.4, -0.1], vy: [-0.1, 0.1] },
    tile: { dirtTop: '#cfe6f5', dirtBottom: '#9bbcd6', cap: 'rock', capTop: '#ffffff', capBottom: '#cfe2f0', capHi: '#ffffff', accent: '#a9cbe0', block: '#dff0fb', blockEdge: '#9bbcd6', deco: '#ffffff' },
  },
  { // 10 氷結の谷(滑る)
    name: '氷結の谷',
    sky: ['#a7c8e0', '#e8f3fa'],
    fog: { color: '220,238,248', strength: 0.45 },
    vignette: 0.28, grade: 'rgba(180,215,240,0.1)', glow: '200,235,255',
    parallax: [
      { kind: 'mountains', color: '#8fb0c8', par: -0.12, baseY: 390, amp: 150, span: 320, snow: '#eef6fb' },
      { kind: 'hills', color: '#cfe2ee', par: -0.24, baseY: 405, amp: 46 },
      { kind: 'trees', color: '#7f99a8', trunk: '#5a6470', par: -0.4, baseY: 418 },
    ],
    ambient: { kind: 'snow', color: '255,255,255', count: 44, size: [1, 2.6], vx: [-0.6, 0.1], vy: [0.4, 1.2] },
    tile: { dirtTop: '#a8bccc', dirtBottom: '#74899a', cap: 'snow', capTop: '#ffffff', capBottom: '#dfeaf2', capHi: '#ffffff', accent: '#bcd6e8', block: '#cfe6f5', blockEdge: '#8fb0c8', deco: '#ffffff', slippery: true },
  },
  { // 11 オーロラ夜空
    name: 'オーロラ夜空',
    sky: ['#0b1733', '#1d3a5a'],
    fog: { color: '40,80,120', strength: 0.35 },
    vignette: 0.5, grade: 'rgba(40,120,140,0.14)', glow: '150,255,210',
    parallax: [
      { kind: 'stars', color: '#fff', par: -0.05, baseY: 240 },
      { kind: 'mountains', color: '#16283f', par: -0.13, baseY: 400, amp: 150, span: 340, snow: '#3a5a72' },
      { kind: 'hills', color: '#10202f', par: -0.26, baseY: 410, amp: 44 },
    ],
    ambient: { kind: 'firefly', color: '150,255,210', count: 16, size: [1.2, 2.4], vx: [-0.2, 0.2], vy: [-0.15, 0.15] },
    tile: { dirtTop: '#3a4a5a', dirtBottom: '#222e3a', cap: 'snow', capTop: '#dfeefa', capBottom: '#9fc0d6', capHi: '#ffffff', accent: '#7be0ff', block: '#3e5066', blockEdge: '#202c3a', deco: '#aef0ff' },
  },
  { // 12 氷結の決戦場(W2ボス・滑る)
    name: '氷結の決戦場',
    sky: ['#0c2238', '#08121e'],
    fog: { color: '40,90,130', strength: 0.5 },
    vignette: 0.6, grade: 'rgba(40,110,150,0.16)', glow: '150,230,255',
    parallax: [
      { kind: 'cave', color: '#0c1c2a', par: -0.1, baseY: 0, amp: 110, span: 140, top: 12 },
      { kind: 'pillars', color: '#0a1824', par: -0.26, baseY: 440, amp: 200, span: 200 },
    ],
    ambient: { kind: 'snow', color: '210,240,255', count: 30, size: [1, 2.2], vx: [-0.5, 0.2], vy: [0.3, 0.9] },
    tile: { dirtTop: '#3a5266', dirtBottom: '#1e2c38', cap: 'snow', capTop: '#cfeefa', capBottom: '#8fc0d8', capHi: '#ffffff', accent: '#9be8ff', block: '#3e5a72', blockEdge: '#1c2a38', deco: '#aef0ff', slippery: true },
  },

  // ===== WORLD 3: 魔界と溶岩 (index 13〜17) =====
  { // 13 影の回廊
    name: '影の回廊',
    sky: ['#1a1026', '#0a0612'],
    fog: { color: '60,30,80', strength: 0.45 },
    vignette: 0.6, grade: 'rgba(80,30,110,0.16)', glow: '180,120,255',
    parallax: [
      { kind: 'pillars', color: '#1a1026', par: -0.12, baseY: 420, amp: 160, span: 210 },
      { kind: 'pillars', color: '#120a1c', par: -0.26, baseY: 440, amp: 200, span: 160 },
    ],
    ambient: { kind: 'firefly', color: '180,120,255', count: 16, size: [1, 2], vx: [-0.2, 0.2], vy: [-0.2, 0.1] },
    tile: { dirtTop: '#3a2a4a', dirtBottom: '#201630', cap: 'rock', capTop: '#5a3f78', capBottom: '#3a2858', capHi: '#7a5aa0', accent: '#b48aff', block: '#3e2c58', blockEdge: '#1c1230', deco: '#c8a0ff' },
  },
  { // 14 紅蓮の坑道
    name: '紅蓮の坑道',
    sky: ['#2a0c0c', '#100406'],
    fog: { color: '90,20,10', strength: 0.5 },
    vignette: 0.6, grade: 'rgba(140,30,10,0.16)', glow: '255,140,50',
    parallax: [
      { kind: 'cave', color: '#1c0a0a', par: -0.1, baseY: 0, amp: 110, span: 130, top: 12 },
      { kind: 'pillars', color: '#260e0e', par: -0.26, baseY: 440, amp: 200, span: 200 },
    ],
    ambient: { kind: 'ember', color: '255,140,50', count: 26, size: [1, 2.4], vx: [-0.3, 0.3], vy: [-1.0, -0.3] },
    tile: { dirtTop: '#4a241a', dirtBottom: '#2a120c', cap: 'lava', capTop: '#7a2e16', capBottom: '#4a1c0e', capHi: '#ff7b3c', accent: '#ff7b1c', block: '#5a2818', blockEdge: '#2a120c', deco: '#ff9a3c' },
  },
  { // 15 魔法陣の間
    name: '魔法陣の間',
    sky: ['#1a0a22', '#0a0410'],
    fog: { color: '80,20,90', strength: 0.45 },
    vignette: 0.6, grade: 'rgba(120,20,120,0.16)', glow: '230,90,255',
    parallax: [
      { kind: 'pillars', color: '#22102e', par: -0.14, baseY: 425, amp: 150, span: 200 },
      { kind: 'cave', color: '#160a1e', par: -0.1, baseY: 0, amp: 100, span: 150, top: 10 },
    ],
    ambient: { kind: 'firefly', color: '230,90,255', count: 18, size: [1, 2.2], vx: [-0.2, 0.2], vy: [-0.2, 0.15] },
    tile: { dirtTop: '#3e2450', dirtBottom: '#221432', cap: 'rock', capTop: '#6a3a8a', capBottom: '#43265e', capHi: '#9a5ac0', accent: '#e65aff', block: '#46285e', blockEdge: '#1e1030', deco: '#f0a0ff' },
  },
  { // 16 虚空
    name: '虚空',
    sky: ['#05060f', '#000000'],
    fog: { color: '20,20,50', strength: 0.3 },
    vignette: 0.7, grade: 'rgba(20,20,60,0.18)', glow: '160,160,255',
    parallax: [
      { kind: 'stars', color: '#fff', par: -0.04, baseY: 360 },
      { kind: 'stars', color: '#bfc8ff', par: -0.1, baseY: 240 },
    ],
    ambient: { kind: 'firefly', color: '160,160,255', count: 20, size: [1, 2], vx: [-0.15, 0.15], vy: [-0.1, 0.1] },
    tile: { dirtTop: '#2a2a3e', dirtBottom: '#16161f', cap: 'rock', capTop: '#44446a', capBottom: '#2a2a44', capHi: '#6a6aa0', accent: '#9a9aff', block: '#33334d', blockEdge: '#16161f', deco: '#c8c8ff' },
  },
  { // 17 煉獄の決戦場(W3ボス)
    name: '煉獄の決戦場',
    sky: ['#2a0608', '#0a0204'],
    fog: { color: '110,20,10', strength: 0.55 },
    vignette: 0.68, grade: 'rgba(150,20,10,0.18)', glow: '255,120,40',
    parallax: [
      { kind: 'cave', color: '#1c0808', par: -0.1, baseY: 0, amp: 110, span: 140, top: 12 },
      { kind: 'pillars', color: '#260a0a', par: -0.26, baseY: 440, amp: 210, span: 190 },
    ],
    ambient: { kind: 'ember', color: '255,120,40', count: 30, size: [1, 2.6], vx: [-0.35, 0.35], vy: [-1.1, -0.3] },
    tile: { dirtTop: '#4a1c14', dirtBottom: '#280e0a', cap: 'lava', capTop: '#8a2e16', capBottom: '#4a160c', capHi: '#ff6b2c', accent: '#ff6b1c', block: '#5a2014', blockEdge: '#280e0a', deco: '#ff8a3c' },
  },
];

// ステージ index → テーマ index の割り当て(全27面)。
// THEMES の index: 0-8=既存9テーマ / 9天空回廊 10氷結の谷 11オーロラ 12氷結の決戦場(W2ボス)
//   / 13影の回廊 14紅蓮の坑道 15魔法陣の間 16虚空 17煉獄の決戦場(W3ボス)。
const STAGE_THEME = [
  0, 1, 2, 3, 4, 5, 6, 7, 8,        // W1: 既存(9面目=溶岩の決戦場 idx8)
  9, 10, 9, 11, 10, 11, 10, 9, 12,  // W2: 天空・氷雪(9面目=氷結の決戦場 idx12)
  13, 6, 14, 15, 8, 13, 16, 14, 17, // W3: 魔界・溶岩(9面目=煉獄の決戦場 idx17)
];
